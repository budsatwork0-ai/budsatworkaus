/**
 * Photo QA — reviews uploaded job photos. Uses Claude's vision capability
 * to check completeness, framing, lighting, and to tag content (yard,
 * window, vehicle, room, before/after). Flags marketing-ready shots and
 * missing-photo issues before invoicing.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are reviewing job photos for Buds At Work — a local
home services business. For each photo, return a strict JSON object:
{
  "score": 0-100,         // overall quality
  "framing": "good" | "ok" | "poor",
  "lighting": "good" | "ok" | "poor",
  "subject_clear": boolean,
  "tags": ["yard","window","cleaning","auto","before","after","damage",...],
  "marketing_ok": boolean,
  "notes": "..."
}
Marketing-ok requires score >= 80 AND no people/faces AND no number plates.`;

interface VisionPart {
  type: 'image';
  source: { type: 'url'; url: string } | { type: 'base64'; media_type: string; data: string };
}

export const photoQaAgent: AgentDefinition = {
  id: 'photo-qa',
  name: 'Photo QA',
  description: 'Reviews before/after job photos; flags missing shots and picks marketing-ready ones.',
  category: 'ops',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const { data: photos } = await ctx.supabase
      .from('job_photos')
      .select('id, job_id, kind, storage_path, uploaded_at')
      .is('qa_score', null)
      .order('uploaded_at', { ascending: true })
      .limit(20);

    if (!photos?.length) return { summary: 'No photos awaiting QA.' };

    // Resolve public URLs (your bucket may be private; signed URLs work too)
    const minScore = Number((ctx.config?.min_score_for_marketing as number) ?? 80);
    const bucket = (ctx.config?.bucket as string) ?? 'job-photos';

    let reviewed = 0;
    let marketingReady = 0;

    for (const p of photos) {
      const { data: signed } = await ctx.supabase
        .storage
        .from(bucket)
        .createSignedUrl(p.storage_path, 60 * 10);
      if (!signed?.signedUrl) continue;

      const raw = await callVision(signed.signedUrl, SYSTEM);
      let parsed: { score: number; framing: string; lighting: string; subject_clear: boolean; tags: string[]; marketing_ok: boolean; notes: string };
      try { parsed = JSON.parse(raw); } catch { continue; }

      const isMarketing = parsed.marketing_ok && parsed.score >= minScore;
      if (isMarketing) marketingReady += 1;

      await ctx.supabase
        .from('job_photos')
        .update({
          qa_score: parsed.score,
          qa_notes: parsed.notes,
          marketing_ok: isMarketing,
          tags: parsed.tags,
        })
        .eq('id', p.id);

      reviewed += 1;
    }

    // Check for jobs with completed work but missing before/after pairs
    type MissingPair = { job_id: string; missing: string };
    const { data: rawIncomplete } = await ctx.supabase.rpc('jobs_missing_photo_pairs', {});
    const incompleteJobs = rawIncomplete as MissingPair[] | null;

    for (const j of incompleteJobs ?? []) {
      await ctx.proposeAction({
        action_type: 'flag_for_review',
        target_table: 'jobs',
        target_id: j.job_id,
        preview: `Job ${j.job_id} missing ${j.missing} photo`,
        payload: j,
      });
    }

    return {
      summary: `Reviewed ${reviewed} photo(s) · ${marketingReady} marketing-ready · ${incompleteJobs?.length ?? 0} job(s) missing pairs.`,
      output: { reviewed, marketing_ready: marketingReady },
    };
  },
};

async function callVision(imageUrl: string, system: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: imageUrl } } as VisionPart,
            { type: 'text', text: 'Review this photo. Return JSON only.' },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`vision ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  return json.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
}
