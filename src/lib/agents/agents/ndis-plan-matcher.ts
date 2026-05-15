/**
 * NDIS Plan Matcher — given a participant's plan goals (text), proposes
 * which Buds At Work services map cleanly and how many hours are likely
 * to be fundable, with justification language that mirrors NDIS planner
 * wording.
 *
 * Manual autonomy because each match should be reviewed before quoting.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You map NDIS participant plan goals to Buds At Work services
(home cleaning, yard care, dump runs, window cleaning, auto detailing).
For each match, write a 1-sentence justification using language an NDIS
planner would recognise (capacity building vs. core supports). Strict JSON:
{
  "matched_services": [
    { "service": "...", "estimated_hours_per_fortnight": number, "support_category": "core_daily" | "core_assistance" | "capacity_building" | "consumables", "justification": "..." }
  ],
  "non_matches": [{"goal":"...","reason":"..."}],
  "estimated_total_aud_per_fortnight": number
}`;

export const ndisPlanMatcherAgent: AgentDefinition = {
  id: 'ndis-plan-matcher',
  name: 'NDIS Plan Matcher',
  description: 'Maps participant plan goals to Buds services with fundable-hours estimates.',
  category: 'compliance',
  autonomy: 'manual',
  async run(ctx: AgentContext) {
    const participantId = ctx.input?.participant_id as string | undefined;
    const goals = ctx.input?.plan_goals as string[] | undefined;
    if (!goals?.length) return { summary: 'No plan goals provided.', output: { error: 'missing plan_goals' } };

    const raw = await ctx.llm(`Plan goals:\n- ${goals.join('\n- ')}`, { system: SYSTEM });
    let parsed: {
      matched_services: Array<{ service: string; estimated_hours_per_fortnight: number; support_category: string; justification: string }>;
      non_matches: Array<{ goal: string; reason: string }>;
      estimated_total_aud_per_fortnight: number;
    };
    try { parsed = JSON.parse(raw); } catch { return { summary: 'Could not parse plan match.' }; }

    const { data: row } = await ctx.supabase.from('ndis_plan_matches').insert({
      participant_id: participantId,
      plan_goals: goals,
      matched_services: parsed.matched_services,
      estimated_total_aud: parsed.estimated_total_aud_per_fortnight,
      run_id: ctx.runId,
    }).select('id').single();

    await ctx.proposeAction({
      action_type: 'flag_for_review',
      target_table: 'ndis_plan_matches',
      target_id: row?.id,
      preview: `${parsed.matched_services.length} service(s) matched · ~$${parsed.estimated_total_aud_per_fortnight}/fortnight`,
      payload: parsed,
    });

    return {
      summary: `Matched ${parsed.matched_services.length} service(s); est. $${parsed.estimated_total_aud_per_fortnight}/fortnight.`,
      output: parsed,
    };
  },
};
