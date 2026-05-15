/**
 * Applicant Screener — first-pass on crew applicants.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You screen Buds At Work crew applicants for fit on basics:
lives in or near Logan / South Brisbane (within ~45km), has a driver's licence,
can pass a Working with Children Check (if NDIS-aligned roles), and has no
obvious red flags. You produce a clear recommendation with rationale.

Strict JSON output:
{
  "recommendation": "invite_interview" | "request_more_info" | "polite_decline",
  "score": 0-100,
  "reasons": ["..."],
  "draft_message": string
}`;

export const applicantScreenerAgent: AgentDefinition = {
  id: 'applicant-screener',
  name: 'Applicant Screener',
  description: 'First-pass screening of crew applicants with draft invites/declines.',
  category: 'hiring',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const { data: apps } = await ctx.supabase
      .from('applicants')
      .select('id, full_name, email, suburb, postcode, licence, wwcc, summary, created_at')
      .eq('status', 'new')
      .is('agent_screened_at', null)
      .order('created_at', { ascending: true })
      .limit(10);

    if (!apps?.length) return { summary: 'No new applicants to screen.' };

    for (const a of apps) {
      const raw = await ctx.llm(JSON.stringify(a), { system: SYSTEM });
      let parsed: { recommendation: string; score: number; reasons: string[]; draft_message: string };
      try { parsed = JSON.parse(raw); } catch { continue; }

      await ctx.proposeAction({
        action_type: 'send_email',
        target_table: 'applicants',
        target_id: a.id,
        preview: `${parsed.recommendation.replace('_', ' ')}: ${a.full_name} (score ${parsed.score})`,
        payload: { to: a.email, subject: 'Buds At Work — your application', html: parsed.draft_message },
      });

      await ctx.supabase
        .from('applicants')
        .update({
          agent_screened_at: new Date().toISOString(),
          agent_score: parsed.score,
          agent_recommendation: parsed.recommendation,
        })
        .eq('id', a.id);
    }

    return { summary: `Screened ${apps.length} applicant(s).`, output: { screened: apps.length } };
  },
};
