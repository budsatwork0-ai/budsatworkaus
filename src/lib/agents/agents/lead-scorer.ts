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

/** Leads scored more than this many days ago are eligible for re-scoring. */
const RESCORE_STALENESS_DAYS = Number(process.env.LEAD_SCORER_STALENESS_DAYS ?? 7);

export const leadScorerAgent: AgentDefinition = {
  id: 'lead-scorer',
  name: 'Lead Scorer',
  description: 'Scores every inbound lead 0-100 on suburb, service, message quality, and behaviour.',
  category: 'sales',
  autonomy: 'auto',
  async run(ctx: AgentContext) {
    // ── 1. Validate that lead_score column exists by probing a single row ──────
    const { data: probe, error: probeError } = await ctx.supabase
      .from('quotes')
      .select('id, lead_score')
      .limit(1);

    if (probeError) {
      ctx.log(
        `[lead-scorer] Schema probe failed — cannot access quotes.lead_score: ${probeError.message}`,
      );
      return {
        summary: 'Lead scorer stalled: schema probe on quotes.lead_score failed.',
        actions: [
          {
            type: 'warning',
            label: 'Schema probe failed',
            detail: `quotes.lead_score column may be missing or inaccessible. Supabase error: ${probeError.message}`,
            reply_channel: 'operator_inbox',
          },
        ],
        output: { scored: 0, hot: 0, stalled: true, reason: 'schema_probe_failed' },
      };
    }

    // ── 2. Total quotes count for observability ───────────────────────────────
    const { count: totalCount, error: totalError } = await ctx.supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true });

    const total = totalError ? null : (totalCount ?? 0);
    if (totalError) {
      ctx.log(`[lead-scorer] Warning: could not fetch total quotes count: ${totalError.message}`);
    }

    // ── 3. Count leads eligible for re-score (integrity gap + staleness) ──────
    const stalenessThreshold = new Date(
      Date.now() - RESCORE_STALENESS_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    // 3a. Leads where lead_score_at IS NULL but lead_score IS NOT NULL (integrity gap)
    const { count: integrityGapCount, error: integrityGapError } = await ctx.supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .not('lead_score', 'is', null)
      .is('lead_score_at', null);

    if (integrityGapError) {
      ctx.log(`[lead-scorer] Warning: could not fetch integrity-gap count: ${integrityGapError.message}`);
    } else {
      ctx.log(`[lead-scorer] Integrity-gap leads (score set, scored_at NULL): ${integrityGapCount ?? 0}`);
    }

    // 3b. Leads where lead_score_at is older than the staleness window
    const { count: staleCount, error: staleError } = await ctx.supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .not('lead_score_at', 'is', null)
      .lt('lead_score_at', stalenessThreshold);

    if (staleError) {
      ctx.log(`[lead-scorer] Warning: could not fetch stale-score count: ${staleError.message}`);
    } else {
      ctx.log(
        `[lead-scorer] Stale leads (scored_at older than ${RESCORE_STALENESS_DAYS}d): ${staleCount ?? 0}`,
      );
    }

    // ── 4. Fetch unscored leads (null score OR null scored_at OR stale scored_at) ──
    //
    // Supabase JS doesn't support multi-condition OR across columns in a single
    // .or() when mixing IS NULL and lt() — we fetch in two passes and deduplicate.
    //
    // Pass A: lead_score IS NULL  OR  lead_score_at IS NULL
    const { data: leadsPassA, error: leadsErrorA } = await ctx.supabase
      .from('quotes')
      .select('id, customer_email, customer_name, suburb, service, notes, customer_id, created_at, lead_score_at')
      .or('lead_score.is.null,lead_score_at.is.null')
      .order('created_at', { ascending: true })
      .limit(25);

    if (leadsErrorA) {
      ctx.log(`[lead-scorer] Query error fetching unscored leads (pass A): ${leadsErrorA.message}`);
      return {
        summary: 'Lead scorer stalled: query for unscored leads failed.',
        actions: [
          {
            type: 'warning',
            label: 'Unscored leads query failed',
            detail: `Supabase error: ${leadsErrorA.message}. Total quotes in table: ${
              total !== null ? total : 'unknown'
            }.`,
            reply_channel: 'operator_inbox',
          },
        ],
        output: { scored: 0, hot: 0, stalled: true, reason: 'query_error' },
      };
    }

    // Pass B: lead_score_at is older than staleness window (stale re-score)
    const { data: leadsPassB, error: leadsErrorB } = await ctx.supabase
      .from('quotes')
      .select('id, customer_email, customer_name, suburb, service, notes, customer_id, created_at, lead_score_at')
      .not('lead_score_at', 'is', null)
      .lt('lead_score_at', stalenessThreshold)
      .order('lead_score_at', { ascending: true })
      .limit(25);

    if (leadsErrorB) {
      ctx.log(`[lead-scorer] Warning: stale-leads query failed (pass B): ${leadsErrorB.message}`);
    }

    // Merge and deduplicate by id, capping at 25 total
    const seenIds = new Set<string>();
    const mergedLeads: NonNullable<typeof leadsPassA> = [];
    for (const lead of [...(leadsPassA ?? []), ...(leadsPassB ?? [])]) {
      if (!seenIds.has(lead.id) && mergedLeads.length < 25) {
        seenIds.add(lead.id);
        mergedLeads.push(lead);
      }
    }
    const leads = mergedLeads;

    ctx.log(
      `[lead-scorer] Total quotes: ${
        total !== null ? total : 'unknown'
      } · Eligible batch (unscored + integrity-gap + stale): ${leads.length}` +
      ` · integrity-gap: ${integrityGapCount ?? 0}` +
      ` · stale (>${RESCORE_STALENESS_DAYS}d): ${staleCount ?? 0}`,
    );

    if (!leads.length) {
      // Distinguish: are there any quotes at all?
      if (total !== null && total > 0) {
        // Leads exist but all are already scored and fresh — emit a structured
        // warning so it surfaces in the operator inbox rather than silently completing.
        ctx.log(
          `[lead-scorer] ${total} quote(s) exist but none are unscored/stale — possible stall or column issue.`,
        );
        return {
          summary: `No unscored leads found, but ${total} quote(s) exist in the table.`,
          actions: [
            {
              type: 'warning',
              label: 'No unscored leads despite quotes existing',
              detail:
                `${total} quote(s) are present but lead_score is non-null, lead_score_at is non-null, ` +
                `and all scores are fresher than ${RESCORE_STALENESS_DAYS} days. ` +
                'If this is unexpected, verify the lead_score column is being reset correctly.',
              reply_channel: 'operator_inbox',
            },
          ],
          output: {
            scored: 0,
            hot: 0,
            totalQuotes: total,
            integrityGapLeads: integrityGapCount ?? 0,
            staleLeads: staleCount ?? 0,
            stalled: false,
          },
        };
      }
      // Genuinely no quotes yet — normal empty-table case.
      return {
        summary: 'No unscored leads.',
        output: {
          scored: 0,
          hot: 0,
          totalQuotes: total ?? 0,
          integrityGapLeads: integrityGapCount ?? 0,
          staleLeads: staleCount ?? 0,
        },
      };
    }

    // ── 5. Score each lead ────────────────────────────────────────────────────
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

      const isRescoring = lead.lead_score_at !== null;
      const prompt = `Lead${
        isRescoring ? ' (re-score)' : ''
      }:
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
      ctx.log(`lead ${lead.id} → ${parsed.score} (${parsed.tier})${
        isRescoring ? ' [rescore]' : ''
      }`);
    }

    return {
      summary: `Scored ${scored} lead(s) · ${hot} hot · total quotes: ${
        total !== null ? total : 'unknown'
      } · integrity-gap: ${integrityGapCount ?? 0} · stale: ${staleCount ?? 0} · avg cost ~ $0.001/lead.`,
      output: {
        scored,
        hot,
        totalQuotes: total ?? undefined,
        integrityGapLeads: integrityGapCount ?? 0,
        staleLeads: staleCount ?? 0,
      },
    };
  },
};
