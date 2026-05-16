/**
 * Price Optimizer
 *
 * Weekly job. For each (service, suburb) with enough quote volume, computes
 *   - 28-day win rate
 *   - 14-day crew capacity utilisation
 *   - competitor price band (p25/p50/p75 from competitor_intel)
 *   - cost drift since the last price change
 * then asks the model for hold/raise/lower with a one-paragraph rationale,
 * stores the recommendation, and proposes an action requiring admin approval.
 *
 * No price change is ever applied without an admin approving it on
 * /dashboard/agents. Approved actions update service_pricing via
 * runtime.executeApprovedAction.
 */
import type { AgentDefinition, AgentContext } from '../types';

interface PriceOptimizerConfig {
  min_quote_volume_28d?: number;
  max_delta_pct?: number;
  capacity_lookahead_days?: number;
  win_rate_lookback_days?: number;
  competitor_stale_after_days?: number;
  exclude_ndis?: boolean;
  services_in_scope?: string[];
}

const DEFAULTS: Required<PriceOptimizerConfig> = {
  min_quote_volume_28d: 8,
  max_delta_pct: 10,
  capacity_lookahead_days: 14,
  win_rate_lookback_days: 28,
  competitor_stale_after_days: 45,
  exclude_ndis: true,
  services_in_scope: ['cleaning', 'yard', 'windows', 'dump', 'auto', 'laundry_sneakers'],
};

const SYSTEM = `You are the Price Optimizer for Buds At Work (Logan & South
Brisbane home services). You receive a snapshot of one service/suburb pair
and must return a single pricing decision.

You are conservative. Reject any change larger than the max_delta_pct
provided. Prefer "hold" when signals conflict. Capacity is the dominant
signal: if we are >85% booked for the next two weeks, lean toward raise;
if we are <60% booked AND win rate is low, lean toward lower. Competitor
data is a sanity check, not a target — never recommend matching a
competitor that sits more than 25% below our cost-recovered floor.

Return JSON only:
{
  "direction": "raise" | "lower" | "hold",
  "recommended_price": number,         // AUD
  "delta_pct": number,                  // signed, -10..+10
  "confidence": number,                 // 0..1
  "rationale": string                   // ≤ 80 words, plain English, cite numbers
}`;

interface ServicePricingRow {
  id: string;
  service: string;
  suburb: string | null;
  price_unit: string;
  price_aud: number;
  effective_from: string;
}

interface QuoteRow {
  id: string;
  service: string | null;
  agent_service: string | null;
  suburb: string | null;
  agent_estimate_aud: number | null;
  agent_ndis: boolean | null;
  status: string | null;
  created_at: string;
}

interface CompetitorRow {
  service: string | null;
  suburb: string | null;
  price_aud: number | null;
  price_unit: string | null;
  scraped_at: string;
}

interface JobRow {
  scheduled_for: string | null;
  estimated_hours: number | null;
  status: string | null;
}

interface CrewRow {
  active: boolean | null;
}

interface ModelOutput {
  direction: 'raise' | 'lower' | 'hold';
  recommended_price: number;
  delta_pct: number;
  confidence: number;
  rationale: string;
}

export const priceOptimizerAgent: AgentDefinition = {
  id: 'price-optimizer',
  name: 'Price Optimizer',
  description:
    'Recommends price changes per service/suburb based on win rate, crew capacity, cost drift, and competitor moves. Every change requires admin approval.',
  category: 'sales',
  autonomy: 'review',
  schedule: '0 5 * * 1', // 5am Mondays Brisbane time (server time may differ)
  config: DEFAULTS,
  async run(ctx: AgentContext) {
    const cfg = { ...DEFAULTS, ...(ctx.config as PriceOptimizerConfig) };

    // 1) Load current rate card
    const { data: pricingRows, error: pricingErr } = await ctx.supabase
      .from('service_pricing')
      .select('id, service, suburb, price_unit, price_aud, effective_from')
      .order('effective_from', { ascending: false });
    if (pricingErr) throw new Error(`load service_pricing: ${pricingErr.message}`);

    const currentByKey = new Map<string, ServicePricingRow>();
    for (const row of (pricingRows ?? []) as ServicePricingRow[]) {
      const key = `${row.service}|${row.suburb ?? ''}|${row.price_unit}`;
      if (!currentByKey.has(key)) currentByKey.set(key, row); // keep newest
    }

    if (currentByKey.size === 0) {
      return {
        summary:
          'No service_pricing rows found. Backfill the rate card before this agent can run.',
      };
    }

    // 2) Load quotes for win-rate
    const since = new Date(Date.now() - cfg.win_rate_lookback_days * 86_400_000).toISOString();
    const { data: quotes } = await ctx.supabase
      .from('quotes')
      .select('id, service, agent_service, suburb, agent_estimate_aud, agent_ndis, status, created_at')
      .gte('created_at', since);

    // 3) Load capacity signals (jobs + crew)
    const horizon = new Date(Date.now() + cfg.capacity_lookahead_days * 86_400_000).toISOString();
    const [{ data: jobs }, { data: crew }] = await Promise.all([
      ctx.supabase
        .from('jobs')
        .select('scheduled_for, estimated_hours, status')
        .gte('scheduled_for', new Date().toISOString())
        .lte('scheduled_for', horizon),
      ctx.supabase.from('crew_members').select('active'),
    ]);
    const capacityPct = computeCapacityPct(jobs as JobRow[] | null, crew as CrewRow[] | null, cfg.capacity_lookahead_days);

    // 4) Load competitor intel
    const compSince = new Date(
      Date.now() - cfg.competitor_stale_after_days * 86_400_000,
    ).toISOString();
    const { data: comps } = await ctx.supabase
      .from('competitor_intel')
      .select('service, suburb, price_aud, price_unit, scraped_at')
      .gte('scraped_at', compSince);

    let proposed = 0;
    let skipped = 0;

    for (const [key, current] of currentByKey) {
      if (!cfg.services_in_scope.includes(current.service)) {
        skipped += 1;
        continue;
      }

      const scopedQuotes = (quotes as QuoteRow[] | null ?? []).filter((q) => {
        const svc = q.agent_service ?? q.service;
        if (svc !== current.service) return false;
        if (current.suburb && q.suburb && q.suburb !== current.suburb) return false;
        if (cfg.exclude_ndis && q.agent_ndis) return false;
        return true;
      });

      if (scopedQuotes.length < cfg.min_quote_volume_28d) {
        ctx.log(`skip ${key}: only ${scopedQuotes.length} quotes (need ${cfg.min_quote_volume_28d})`);
        skipped += 1;
        continue;
      }

      const won = scopedQuotes.filter((q) => q.status === 'won' || q.status === 'accepted').length;
      const winRatePct = (won / scopedQuotes.length) * 100;

      const compBand = computeCompetitorBand(
        (comps as CompetitorRow[] | null) ?? [],
        current.service,
        current.suburb,
        current.price_unit,
      );

      const costDriftPct = await computeCostDriftPct(ctx, current);

      const snapshot = {
        service: current.service,
        suburb: current.suburb ?? '(any)',
        price_unit: current.price_unit,
        current_price_aud: Number(current.price_aud),
        win_rate_pct: round1(winRatePct),
        capacity_pct: capacityPct == null ? null : round1(capacityPct),
        cost_drift_pct: costDriftPct == null ? null : round1(costDriftPct),
        competitor_band: compBand,
        max_delta_pct: cfg.max_delta_pct,
        sample_size: scopedQuotes.length,
      };

      const raw = await ctx.llm(JSON.stringify(snapshot, null, 2), { system: SYSTEM });
      let parsed: ModelOutput;
      try {
        parsed = parseJsonResponse(raw) as ModelOutput;
      } catch (err) {
        ctx.log('json_parse_failed', { key, err: String(err), head: raw.slice(0, 200) });
        skipped += 1;
        continue;
      }

      // Cap deltas defensively even if the model misbehaves
      const cappedDelta = clamp(parsed.delta_pct, -cfg.max_delta_pct, cfg.max_delta_pct);
      const cappedPrice = round2(Number(current.price_aud) * (1 + cappedDelta / 100));

      // Persist the recommendation regardless of direction (audit trail)
      const { data: recRow, error: recErr } = await ctx.supabase
        .from('pricing_recommendations')
        .insert({
          run_id: ctx.runId,
          service: current.service,
          suburb: current.suburb,
          price_unit: current.price_unit,
          current_price: current.price_aud,
          recommended_price: cappedPrice,
          direction: parsed.direction,
          delta_pct: cappedDelta,
          capacity_pct: capacityPct,
          win_rate_pct: winRatePct,
          competitor_p25: compBand.p25,
          competitor_p50: compBand.p50,
          competitor_p75: compBand.p75,
          cost_drift_pct: costDriftPct,
          rationale: parsed.rationale,
          status: parsed.direction === 'hold' ? 'applied' : 'pending',
        })
        .select('id')
        .single();
      if (recErr) {
        ctx.log('insert_recommendation_failed', { key, err: recErr.message });
        continue;
      }

      if (parsed.direction === 'hold') continue;

      await ctx.proposeAction({
        action_type: 'update_service_price',
        target_table: 'service_pricing',
        target_id: current.id,
        requiresApproval: true,
        preview:
          `${current.service}${current.suburb ? ` (${current.suburb})` : ''} ` +
          `${parsed.direction} ${cappedDelta > 0 ? '+' : ''}${round1(cappedDelta)}% → ` +
          `$${cappedPrice} ${current.price_unit.replace('_', ' ')} ` +
          `(win ${round1(winRatePct)}%, capacity ${capacityPct == null ? '—' : round1(capacityPct) + '%'})`,
        payload: {
          recommendation_id: recRow?.id,
          service_pricing_id: current.id,
          new_price_aud: cappedPrice,
          previous_price_aud: current.price_aud,
          direction: parsed.direction,
          delta_pct: cappedDelta,
          rationale: parsed.rationale,
          signals: snapshot,
        },
      });
      proposed += 1;
    }

    return {
      summary: `Reviewed ${currentByKey.size} price(s); ${proposed} change(s) proposed; ${skipped} skipped (low volume or out of scope).`,
      output: { reviewed: currentByKey.size, proposed, skipped, capacity_pct: capacityPct },
    };
  },
};

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

function computeCapacityPct(
  jobs: JobRow[] | null,
  crew: CrewRow[] | null,
  lookaheadDays: number,
): number | null {
  if (!jobs || !crew) return null;
  const activeCrew = crew.filter((c) => c.active !== false).length;
  if (activeCrew === 0) return null;
  // Assume 7 billable hours/crew/day
  const availableHours = activeCrew * 7 * lookaheadDays;
  const bookedHours = jobs
    .filter((j) => j.status !== 'cancelled' && j.status !== 'completed')
    .reduce((sum, j) => sum + (Number(j.estimated_hours) || 0), 0);
  if (availableHours === 0) return null;
  return Math.min(100, (bookedHours / availableHours) * 100);
}

function computeCompetitorBand(
  rows: CompetitorRow[],
  service: string,
  suburb: string | null,
  priceUnit: string,
): { p25: number | null; p50: number | null; p75: number | null; n: number } {
  const matching = rows
    .filter((r) => r.service === service && r.price_aud != null && r.price_unit === priceUnit)
    .filter((r) => (suburb ? r.suburb === suburb || r.suburb == null : true))
    .map((r) => Number(r.price_aud))
    .sort((a, b) => a - b);
  if (matching.length === 0) return { p25: null, p50: null, p75: null, n: 0 };
  return {
    p25: round2(percentile(matching, 25)),
    p50: round2(percentile(matching, 50)),
    p75: round2(percentile(matching, 75)),
    n: matching.length,
  };
}

async function computeCostDriftPct(
  ctx: AgentContext,
  current: ServicePricingRow,
): Promise<number | null> {
  // Optional: read agent_memory for cost baselines. Absent today; returns null.
  const { data } = await ctx.supabase
    .from('agent_memory')
    .select('value')
    .eq('agent_id', 'price-optimizer')
    .eq('key', `cost_baseline:${current.service}`)
    .maybeSingle();
  const baseline = (data?.value as { aud?: number } | null)?.aud;
  if (!baseline) return null;
  const drift = ((Number(current.price_aud) - baseline) / baseline) * 100;
  return drift;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseJsonResponse(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  }
  if (!cleaned.startsWith('{')) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) cleaned = m[0];
  }
  return JSON.parse(cleaned);
}
