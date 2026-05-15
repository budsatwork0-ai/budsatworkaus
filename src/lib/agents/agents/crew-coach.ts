/**
 * Crew Coach — once a month, for each active crew member, assembles a
 * gentle coaching summary from completed jobs, Photo QA scores, customer
 * feedback, and review responses.
 *
 * Output is a `crew_coach_notes` row + a queued approval action so you
 * (or the crew lead) can read it, tweak it, and share it as a 1:1.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You write a warm, balanced monthly coaching note for a
Buds At Work crew member. Two strengths, one or two growth areas, and 1-2
notable jobs (good or bad) with specifics. Australian English. ≤ 180 words.
Strict JSON:
{
  "strengths": ["...", "..."],
  "growth_areas": ["...", "..."],
  "notable_jobs": [{"job_id":"...","what_stood_out":"..."}],
  "summary": "...prose..."
}`;

export const crewCoachAgent: AgentDefinition = {
  id: 'crew-coach',
  name: 'Crew Coach',
  description: 'Monthly per-crew-member summary: strengths, growth areas, notable jobs.',
  category: 'hiring',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd); periodStart.setMonth(periodStart.getMonth() - 1);

    const { data: crew } = await ctx.supabase
      .from('crew_members').select('id, name').eq('active', true);
    if (!crew?.length) return { summary: 'No active crew.' };

    let written = 0;
    for (const member of crew) {
      const [jobsRes, photosRes, reviewsRes] = await Promise.all([
        ctx.supabase.from('jobs').select('id, service, suburb, customer_notes, completed_at')
          .eq('crew_member_id', member.id).eq('status', 'completed')
          .gte('completed_at', periodStart.toISOString()).lte('completed_at', periodEnd.toISOString()),
        ctx.supabase.from('job_photos').select('job_id, qa_score, marketing_ok')
          .gte('uploaded_at', periodStart.toISOString())
          .in('job_id', []), // hydrated next
        ctx.supabase.from('reviews').select('rating, comment, job_id')
          .gte('created_at', periodStart.toISOString()),
      ]);

      const jobIds = (jobsRes.data ?? []).map((j) => j.id);
      const { data: photos } = await ctx.supabase
        .from('job_photos').select('job_id, qa_score, marketing_ok').in('job_id', jobIds);

      if (!jobsRes.data?.length) continue;

      const raw = await ctx.llm(
        JSON.stringify({ member: member.name, jobs: jobsRes.data, photo_qa: photos, reviews: reviewsRes.data }),
        { system: SYSTEM },
      );
      let parsed: { strengths: string[]; growth_areas: string[]; notable_jobs: Array<{ job_id: string; what_stood_out: string }>; summary: string };
      try { parsed = JSON.parse(raw); } catch { continue; }

      const { data: row } = await ctx.supabase.from('crew_coach_notes').insert({
        crew_member_id: member.id,
        run_id: ctx.runId,
        period_start: periodStart.toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
        strengths: parsed.strengths,
        growth_areas: parsed.growth_areas,
        notable_jobs: parsed.notable_jobs,
        summary: parsed.summary,
      }).select('id').single();

      await ctx.proposeAction({
        action_type: 'flag_for_review',
        target_table: 'crew_coach_notes',
        target_id: row?.id,
        preview: `Coaching note ready: ${member.name}`,
        payload: { crew_member: member.name, summary: parsed.summary.slice(0, 120) },
      });
      written += 1;
    }

    return { summary: `Drafted ${written} coaching note(s) for review.`, output: { written } };
  },
};
