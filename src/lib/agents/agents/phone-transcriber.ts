/**
 * Phone Transcriber — picks up unprocessed call rows (recording_url
 * present, agent_processed_at null), runs Whisper to transcribe,
 * then asks Claude for a summary + action items + sentiment, and
 * attaches everything to the customer record.
 *
 * Set OPENAI_API_KEY for Whisper or wire your own transcription
 * provider in `transcribeAudio()`.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SUMMARY_SYSTEM = `You summarise a customer phone call for Buds At Work.
Return strict JSON only:
{
  "summary": "...2-4 sentences in plain English...",
  "action_items": [
    { "owner": "office" | "crew" | "customer", "text": "..." }
  ],
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "topics": ["quote","complaint","scheduling","payment","other"]
}`;

export const phoneTranscriberAgent: AgentDefinition = {
  id: 'phone-transcriber',
  name: 'Phone Transcriber',
  description: 'Transcribes calls, extracts summary + action items, attaches to customer.',
  category: 'support',
  autonomy: 'auto',
  async run(ctx: AgentContext) {
    const { data: calls } = await ctx.supabase
      .from('phone_calls')
      .select('id, customer_id, direction, from_number, recording_url, duration_s')
      .is('agent_processed_at', null)
      .not('recording_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(10);

    if (!calls?.length) return { summary: 'No calls awaiting transcription.' };

    let processed = 0;
    let frustrated = 0;

    for (const call of calls) {
      let transcript: string;
      try {
        transcript = await transcribeAudio(call.recording_url as string);
      } catch (err) {
        ctx.log(`transcribe failed for ${call.id}: ${err instanceof Error ? err.message : err}`);
        continue;
      }

      const raw = await ctx.llm(
        `Direction: ${call.direction}\nFrom: ${call.from_number ?? ''}\nDuration: ${call.duration_s}s\nTranscript:\n"""\n${transcript}\n"""`,
        { system: SUMMARY_SYSTEM },
      );

      let parsed: { summary: string; action_items: Array<{ owner: string; text: string }>; sentiment: string; topics: string[] };
      try { parsed = JSON.parse(raw); } catch { continue; }

      await ctx.supabase
        .from('phone_calls')
        .update({
          transcript,
          summary: parsed.summary,
          action_items: parsed.action_items,
          sentiment: parsed.sentiment,
          agent_processed_at: new Date().toISOString(),
        })
        .eq('id', call.id);

      if (parsed.sentiment === 'frustrated' || parsed.sentiment === 'negative') {
        frustrated += 1;
        await ctx.proposeAction({
          action_type: 'flag_for_review',
          target_table: 'phone_calls',
          target_id: call.id,
          preview: `${parsed.sentiment} call — ${parsed.summary.slice(0, 80)}…`,
          payload: { call_id: call.id, customer_id: call.customer_id, topics: parsed.topics },
        });
      }

      processed += 1;
    }

    return {
      summary: `Transcribed ${processed} call(s) · ${frustrated} flagged for follow-up.`,
      output: { processed, flagged: frustrated },
    };
  },
};

async function transcribeAudio(url: string): Promise<string> {
  // Whisper via OpenAI. Swap to Deepgram / AssemblyAI / your own if you prefer.
  if (!process.env.OPENAI_API_KEY) {
    // Fixture transcript so the agent stays runnable in dev.
    return '[fixture] Hi, just calling about a quote for window cleaning in Springwood. Two-story house, six windows. When can someone come around? Thanks.';
  }

  const audio = await fetch(url).then((r) => r.blob());
  const form = new FormData();
  form.append('file', audio, 'call.mp3');
  form.append('model', 'whisper-1');
  form.append('language', 'en');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`whisper ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { text: string };
  return json.text;
}
