/**
 * Field Producer — issues a dead-simple daily capture brief from the day's
 * scheduled jobs: what to film, the one before/after to nail, and the line to
 * say to camera. Evergreen brief on no-job days. Feeds the Marketing Studio.
 *
 * Lightweight aggregation → runs on Haiku.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are the Buds At Work Field Producer. Voice: warm Australian
tradie, Logan / South Brisbane local, never corporate. Given today's job (or an
evergreen day), write a phone-shootable capture brief a busy crew can follow in
30 seconds. Strict JSON:
{
  "shot_list": ["...", "...", "..."],   // exactly 3 short shots, before/after where it fits
  "say_to_camera": "one short spoken line, ends with the Buds promise"
}`;

export const fieldProducerAgent: AgentDefinition = {
  id: 'field-producer',
  name: 'Field Producer',
  description: 'Daily capture brief from the day\'s scheduled jobs — what to film and the line to say to camera.',
  category: 'sales',
  autonomy: 'auto',
  preferredModel: 'claude-haiku-4-5-20251001',
  async run(ctx: AgentContext) {
    const today = new Date().toISOString().slice(0, 10);

    // Already briefed today? Don't double up.
    const { data: existing } = await ctx.supabase
      .from('capture_briefs')
      .select('id')
      .eq('brief_date', today)
      .maybeSingle();
    if (existing) return { summary: 'Capture brief already issued for today.' };

    // Today's scheduled work (orders carry service_type + scheduled_date).
    const { data: orders } = await ctx.supabase
      .from('orders')
      .select('id, service_type, scheduled_date')
      .eq('scheduled_date', today)
      .limit(5);

    const job = orders?.[0] ?? null;
    const jobContext = job?.service_type
      ? `${job.service_type} job scheduled today`
      : 'Evergreen day — no job scheduled (film team, tips, or behind-the-scenes)';

    const raw = await ctx.llm(
      `Today: ${today}\nContext: ${jobContext}\nReturn the capture brief JSON.`,
      { system: SYSTEM },
    );

    let parsed: { shot_list?: string[]; say_to_camera?: string };
    try { parsed = JSON.parse(raw); } catch { return { summary: 'Could not parse capture brief.' }; }

    const shotList = (parsed.shot_list ?? []).slice(0, 3);
    await ctx.supabase.from('capture_briefs').insert({
      brief_date: today,
      job_context: jobContext,
      shot_list: shotList,
      say_to_camera: parsed.say_to_camera ?? null,
      run_id: ctx.runId,
    });

    return {
      summary: `Issued today's capture brief (${shotList.length} shots) for: ${jobContext}.`,
      output: { brief_date: today, shots: shotList.length, has_job: Boolean(job) },
    };
  },
};
