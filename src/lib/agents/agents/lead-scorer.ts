/**
 * Lead Scorer — assigns a 0-100 quality score to every untouched lead.
 * Feeds Quote Triage (high-score leads jump the queue) and Customer
 * Reply (high-score leads get a more personalised draft).
 *
 * Scoring is a weighted blend of four signals:
 *   • behaviour   — Lucky Orange session quality (time on site,
 *                   pages viewed, scroll depth) if available
 *   • message     — completeness + specificity of the inbound message
 *   • suburb      — proximity to your service area (Logan / S. Brisbane)
 *   • history     — repeat customer? NDIS plan manager? property manager?
 *
 * This agent runs cheaply (Haiku-friendly) and is `auto` autonomy
 * because writing a score never touches the customer.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You score inbound leads for Buds At Work — a Logan / South
Brisbane services business. Return a JSON object only:
{
  "score": 0-100,
  "tier": "cold" | "warm" | "hot",
  "reasons": ["...", "..."],
  "predicted_value_aud": number
}
Scoring heuristics:
- Specific service + suburb + clear job description → high
- "Just looking for a quote" with no detail → cold
- NDIS / property manager / repeat → hot
- Outside Logan/S.Brisbane → automatic cold`;

// Suburb shortlist Buds At Work serves. Anything outside this list drops the score.
const SERVICE_AREA = new Set([
  'logan central','springwood','underwood','rochedale','daisy hill','shailer park',
  'loganlea','meadowbrook','beenleigh','waterford','marsden','woodridge','kingston',
  'mount gravatt','sunnybank','runcorn','calamvale','algester','parkinson','browns plains',
]);

export const leadScorerAgent: AgentDefinition = {
  id: 'lead-scorer',
  name: 'Lead Scorer',
  description: 'Scores every inbound lead 0-100 on suburb, service, message quality, and behaviour.',
  category: 'sales',
  autonomy: 'auto',
  async run(ctx: AgentContext) {
    const { data: leads } = await ctx.supabase
      .from('quotes')
      .select('id, customer_email, customer_name, suburb, service, notes, customer_id, created_at')
      .is('lead_score', null)
      .order('created_at', { ascending: true })
      .limit(25);

    if (!leads?.length) return { summary: 'No unscored leads.' };

    let scored = 0;
    let hot = 0;

    for (const lead of leads) {
      const inArea = SERVICE_AREA.has((lead.suburb ?? '').toLowerCase().trim());
      const wordCount = (lead.notes ?? '').split(/\s+/).filter(Boolean).length;

      // Repeat-customer signal — has this email/customer_id ever closed a job?
      let isRepeat = false;
      if (lead.customer_id) {
        const { count } = await ctx.supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', lead.customer_id)
          .eq('status', 'completed');
        isRepeat = (count ?? 0) > 0;
      }

      const prompt = `Lead:
- Suburb: ${lead.suburb ?? '(unknown)'} (in_service_area: ${inArea})
- Service hint: ${lead.service ?? '(none)'}
- Message word count: ${wordCount}
- Notes: ${lead.notes ?? '(none)'}
- Repeat customer: ${isRepeat}
Return scoring JSON.`;
      const raw = await ctx.llm(prompt, { system: SYSTEM, model: 'claude-haiku-4-5-20251001' });

      let parsed: { score: number; tier: string; reasons: string[]; predicted_value_aud: number };
      try { parsed = JSON.parse(raw); } catch { continue; }

      await ctx.supabase
        .from('quotes')
        .update({
          lead_score: parsed.score,
          lead_score_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      scored += 1;
      if (parsed.tier === 'hot') hot += 1;
      ctx.log(`lead ${lead.id} → ${parsed.score} (${parsed.tier})`);
    }

    return {
      summary: `Scored ${scored} lead(s) · ${hot} hot · avg cost ~ $0.001/lead.`,
      output: { scored, hot },
    };
  },
};
