// -----------------------------------------------------------------------------
// Bud Leads — quote → Lead adapter
// -----------------------------------------------------------------------------
// The dashboard already loads quotes. Bud Leads treats each quote as a lead
// and layers in: temperature, response status, age, suburb, source, attention.
//
// When module 9 (Lead Database Architecture) ships its own `leads` Supabase
// table with proper conversations/follow_ups, this adapter is the only file
// that changes — the rest of Bud Leads consumes Lead[] and doesn't care.
// -----------------------------------------------------------------------------

import { SERVICE_LABELS, normalizeQuoteStatus, type DashboardQuote, type DashboardLead } from '@/types/dashboard';
import {
  type Lead,
  type LeadSource,
  type LeadResponseStatus,
  type LeadTemperature,
  type SuburbInsight,
  type AttentionItem,
  type FunnelSnapshot,
  type FunnelStage,
  type ResponseMetrics,
  FUNNEL_STAGES,
} from './types';

// ---------- helpers ----------------------------------------------------------

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function hoursBetween(later: Date | number, earlier: Date | number): number {
  const a = typeof later === 'number' ? later : later.getTime();
  const b = typeof earlier === 'number' ? earlier : earlier.getTime();
  return Math.max(0, (a - b) / HOUR_MS);
}

function quoteAmount(q: DashboardQuote): number {
  return Number(q.reviewed_total ?? q.submitted_total ?? q.total ?? 0);
}

/**
 * Parse a suburb out of a free-text Australian-style address.
 * Examples that work:
 *   "12 Acacia St, Springfield QLD 4300"     → "Springfield"
 *   "Flagstone, QLD"                          → "Flagstone"
 *   "Unit 4 / 22 King Rd, Park Ridge, 4125"   → "Park Ridge"
 * Returns null when we can't extract anything useful.
 */
export function parseSuburb(address: string | null | undefined): string | null {
  if (!address) return null;
  const trimmed = address.trim();
  if (!trimmed) return null;

  // Strategy: split on commas, then look for the last segment that is *not*
  // a state code, a postcode, or 'Australia'. Falls back to the last segment.
  const segments = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  const STATE_OR_COUNTRY = /^(QLD|NSW|VIC|TAS|SA|WA|NT|ACT|Australia)\b/i;
  const POSTCODE = /^\d{4}$/;

  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const seg = segments[i];
    if (POSTCODE.test(seg)) continue;
    if (STATE_OR_COUNTRY.test(seg)) continue;
    // Strip a trailing state + postcode if present ("Springfield QLD 4300")
    const cleaned = seg.replace(/\s+(QLD|NSW|VIC|TAS|SA|WA|NT|ACT)\b.*$/i, '').trim();
    if (cleaned.length > 0 && !/^\d+/.test(cleaned)) {
      return cleaned;
    }
  }
  return null;
}

/**
 * Source resolution. The 070_bud_leads migration adds a `source` column on
 * quotes and the /api/quotes route now writes a real value on insert via
 * resolveLeadSource(). We trust that value when it's one of the canonical
 * LeadSource keys; otherwise we fall back to 'website' (every legacy quote
 * came through the website flow before module 9 landed).
 */
const VALID_SOURCES: ReadonlySet<string> = new Set<LeadSource>([
  'website',
  'messenger',
  'sms',
  'instagram',
  'email',
  'phone',
  'referral',
  'unknown',
]);

function inferSource(q: DashboardQuote): LeadSource {
  const raw = (q.source ?? '').toString().toLowerCase();
  if (VALID_SOURCES.has(raw)) return raw as LeadSource;
  return 'website';
}

/**
 * Response status from quote signals.
 *   - status === 'paid'                           → booked / completed
 *   - finalized_at present                        → quoted
 *   - reviewed_total !== null                     → in_conversation (we touched it)
 *   - status === 'cancelled' / 'declined'         → lost
 *   - else                                        → awaiting_response
 *
 * 'no_response' (missed lead) is asserted later, in the adapter, when the
 * lead is also > 24h old.
 */
function inferResponseStatus(q: DashboardQuote): LeadResponseStatus {
  const normalized = normalizeQuoteStatus(q.status);
  if (normalized === 'paid' && q.converted_order_id) return 'booked';
  if (normalized === 'paid') return 'booked';
  if (q.status === 'cancelled' || q.status === 'declined' || normalized === 'lost') return 'lost';
  if (q.finalized_at || normalized === 'finalized' || normalized === 'payment_pending') return 'quoted';
  if (q.reviewed_total !== null && q.reviewed_total !== undefined) return 'in_conversation';
  return 'awaiting_response';
}

/**
 * Lead temperature logic.
 *
 *   HOT  — awaiting_response < 1h  OR  value >= $400 AND age < 24h
 *   WARM — awaiting_response < 24h  OR  in_conversation/quoted < 48h
 *   COLD — age >= 48h with no booking
 *   LOST — status === lost / cancelled
 *
 * Booked / completed leads stay WARM (they're still on the radar for ops
 * follow-up like reviews and repeat work) — only LOST is terminal-cold.
 */
function computeTemperature(
  q: DashboardQuote,
  responseStatus: LeadResponseStatus,
  ageHours: number,
  value: number
): LeadTemperature {
  if (responseStatus === 'lost') return 'LOST';
  if (responseStatus === 'booked' || responseStatus === 'completed') return 'WARM';

  if (responseStatus === 'awaiting_response') {
    if (ageHours < 1) return 'HOT';
    if (ageHours < 24 && value >= 400) return 'HOT';
    if (ageHours < 24) return 'WARM';
    return 'COLD';
  }

  // in_conversation / quoted
  if (ageHours < 48) return 'WARM';
  return 'COLD';
}

/**
 * Best-effort first-response timestamp.
 *   - reviewed_total set → assume we reviewed at finalized_at or the quote
 *     creation; pick the earlier non-null among finalized_at / payment_requested_at.
 *   - Otherwise null.
 *
 * This is a *heuristic* until conversations exist as a real table. The
 * Response Performance panel acknowledges this with a "best-estimate" tag.
 */
function inferFirstResponseAt(q: DashboardQuote): string | null {
  const candidates = [q.finalized_at, q.payment_requested_at].filter(
    (v): v is string => typeof v === 'string' && v.length > 0
  );
  if (candidates.length === 0) return null;
  candidates.sort();
  return candidates[0];
}

// ---------- the adapter -----------------------------------------------------

/**
 * Map an array of DashboardQuote into Lead[]. Pure function — feed it the
 * same input, get the same output. Safe to memoize at the component layer.
 */
export function quotesToLeads(quotes: DashboardQuote[], now: Date = new Date()): Lead[] {
  const nowMs = now.getTime();

  return quotes.map((q): Lead => {
    const createdMs = new Date(q.created_at).getTime();
    const ageHours = hoursBetween(nowMs, createdMs);
    const value = quoteAmount(q);
    const responseStatus = inferResponseStatus(q);
    const firstResponseAt = inferFirstResponseAt(q);
    const firstResponseHours = firstResponseAt
      ? hoursBetween(new Date(firstResponseAt), createdMs)
      : null;
    const temperature = computeTemperature(q, responseStatus, ageHours, value);
    const serviceSlug = q.service_type || 'other';
    const suburb = parseSuburb(q.service_address);

    // Promote awaiting_response > 24h to no_response in the response-status
    // column so the panel can group missed leads clearly.
    const effectiveResponseStatus: LeadResponseStatus =
      responseStatus === 'awaiting_response' && ageHours >= 24 ? 'no_response' : responseStatus;

    const isAbandoned =
      (q.status === 'draft' || normalizeQuoteStatus(q.status) === 'draft') && ageHours > 0.5;
    const isStale = ageHours >= 48 && temperature !== 'WARM' && temperature !== 'LOST';
    const isHotPulse = temperature === 'HOT';

    // Attention reason — single most-actionable line for the operator.
    let attentionReason: string | null = null;
    if (effectiveResponseStatus === 'no_response') {
      attentionReason = `Unanswered ${formatAge(ageHours)} — value ${formatMoney(value)}`;
    } else if (effectiveResponseStatus === 'awaiting_response' && ageHours >= 1) {
      attentionReason = `Awaiting first reply (${formatAge(ageHours)})`;
    } else if (isAbandoned) {
      attentionReason = 'Quote started but never submitted';
    } else if (isStale && (effectiveResponseStatus === 'in_conversation' || effectiveResponseStatus === 'quoted')) {
      attentionReason = `Stuck in ${effectiveResponseStatus.replace('_', ' ')} > 48h`;
    }

    return {
      id: q.id,
      customerName: q.customer_name || 'Unnamed lead',
      service: serviceSlug,
      serviceLabel: SERVICE_LABELS[serviceSlug] || serviceSlug,
      suburb,
      address: q.service_address ?? null,
      source: inferSource(q),
      temperature,
      responseStatus: effectiveResponseStatus,
      quoteStatus: normalizeQuoteStatus(q.status),
      value,
      createdAt: q.created_at,
      ageHours,
      firstResponseAt,
      firstResponseHours,
      bookedAt: q.converted_order_id ? q.finalized_at ?? null : null,
      isHotPulse,
      isAbandoned,
      isStale,
      attentionReason,
      href: `/dashboard/quotes?q=${encodeURIComponent(q.id)}`,
      leadScore: typeof q.lead_score === 'number' ? q.lead_score : null,
    };
  });
}

// ---------- leads-table adapter ---------------------------------------------

/**
 * Coerce a free-string response_status from the DB into our union. Anything
 * unknown collapses to 'awaiting_response' so the funnel never breaks.
 */
const VALID_RESPONSE_STATUSES: ReadonlySet<string> = new Set<LeadResponseStatus>([
  'awaiting_response',
  'in_conversation',
  'quoted',
  'booked',
  'completed',
  'no_response',
  'lost',
]);

function coerceResponseStatus(value: string | null | undefined): LeadResponseStatus {
  if (typeof value === 'string' && VALID_RESPONSE_STATUSES.has(value)) {
    return value as LeadResponseStatus;
  }
  return 'awaiting_response';
}

const VALID_TEMPERATURES: ReadonlySet<string> = new Set<LeadTemperature>(['HOT', 'WARM', 'COLD', 'LOST']);

function coerceLeadSourceClient(value: string | null | undefined): LeadSource {
  if (typeof value === 'string' && VALID_SOURCES.has(value.toLowerCase())) {
    return value.toLowerCase() as LeadSource;
  }
  return 'unknown';
}

/**
 * Map an array of DashboardLead (channel-ingested rows from the `leads`
 * table) into Lead[]. Mirrors quotesToLeads — same Lead shape out, so the
 * Live Feed / Funnel / Heatmap don't care where a lead came from.
 *
 * Heuristics:
 *   - temperature: trust the DB value when set; recompute otherwise.
 *   - value: leads-table rows have no quote yet, so value is 0 until they
 *     roll up into a quote (quote_id set → represented in the quotes feed).
 *   - href: deep-link to a future /dashboard/leads/[id] view; for now we
 *     reuse the quotes page with a `lead=` param so clicks don't 404.
 */
export function dashboardLeadsToLeads(leads: DashboardLead[], now: Date = new Date()): Lead[] {
  const nowMs = now.getTime();

  return leads.map((row): Lead => {
    const createdMs = new Date(row.created_at).getTime();
    const ageHours = hoursBetween(nowMs, createdMs);
    const responseStatus = coerceResponseStatus(row.response_status);
    const source = coerceLeadSourceClient(row.source);
    const value = 0;

    const firstResponseAt = row.first_response_at ?? null;
    const firstResponseHours = firstResponseAt
      ? hoursBetween(new Date(firstResponseAt), createdMs)
      : null;

    // Trust the DB-set temperature when valid; otherwise recompute. Lets the
    // nightly job override the live heuristic without code changes.
    const dbTemp = typeof row.temperature === 'string' ? row.temperature : null;
    const temperature: LeadTemperature =
      dbTemp && VALID_TEMPERATURES.has(dbTemp)
        ? (dbTemp as LeadTemperature)
        : computeTemperatureLeadRow(responseStatus, ageHours);

    const serviceSlug = row.service_type || 'other';
    const suburb = row.suburb || parseSuburb(row.service_address);

    // Promote awaiting_response > 24h to no_response, same rule as quotes.
    const effectiveResponseStatus: LeadResponseStatus =
      responseStatus === 'awaiting_response' && ageHours >= 24 ? 'no_response' : responseStatus;

    const isStale = ageHours >= 48 && temperature !== 'WARM' && temperature !== 'LOST';
    const isHotPulse = temperature === 'HOT';

    let attentionReason: string | null = null;
    if (effectiveResponseStatus === 'no_response') {
      attentionReason = `Unanswered ${source} lead — ${formatAge(ageHours)}`;
    } else if (effectiveResponseStatus === 'awaiting_response' && ageHours >= 1) {
      attentionReason = `Awaiting first reply (${formatAge(ageHours)})`;
    } else if (isStale && (effectiveResponseStatus === 'in_conversation' || effectiveResponseStatus === 'quoted')) {
      attentionReason = `Stuck in ${effectiveResponseStatus.replace('_', ' ')} > 48h`;
    }

    return {
      id: row.id,
      customerName: row.customer_name || `Unnamed ${source} lead`,
      service: serviceSlug,
      serviceLabel: SERVICE_LABELS[serviceSlug] || serviceSlug,
      suburb,
      address: row.service_address ?? null,
      source,
      temperature,
      responseStatus: effectiveResponseStatus,
      quoteStatus: row.quote_id ? 'submitted' : 'draft',
      value,
      createdAt: row.created_at,
      ageHours,
      firstResponseAt,
      firstResponseHours,
      bookedAt: row.booked_at ?? null,
      isHotPulse,
      isAbandoned: false,
      isStale,
      attentionReason,
      href: `/dashboard/quotes?lead=${encodeURIComponent(row.id)}`,
      leadScore: null,
    };
  });
}

/**
 * Lighter temperature calc for lead-table rows — value is unknown, so we
 * key off response status + age only.
 */
function computeTemperatureLeadRow(
  status: LeadResponseStatus,
  ageHours: number
): LeadTemperature {
  if (status === 'lost') return 'LOST';
  if (status === 'booked' || status === 'completed') return 'WARM';
  if (status === 'awaiting_response') {
    if (ageHours < 1) return 'HOT';
    if (ageHours < 24) return 'WARM';
    return 'COLD';
  }
  if (ageHours < 48) return 'WARM';
  return 'COLD';
}

// ---------- formatters (small, internal) ------------------------------------

function formatAge(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function formatMoney(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `$${Math.round(value).toLocaleString()}`;
}

// ---------- attention queue --------------------------------------------------

/**
 * Build the Needs Attention panel queue from Lead[]. Returned in descending
 * urgency order so the panel can render top-N without re-sorting.
 */
export function buildAttentionQueue(leads: Lead[]): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const lead of leads) {
    if (lead.responseStatus === 'no_response') {
      items.push({
        id: `unanswered-${lead.id}`,
        leadId: lead.id,
        category: 'unanswered',
        title: `Unanswered ${lead.source} lead — ${lead.serviceLabel}`,
        detail: `${lead.customerName}${lead.suburb ? ` · ${lead.suburb}` : ''} — open ${formatAge(lead.ageHours)}`,
        ageHours: lead.ageHours,
        source: lead.source,
        value: lead.value,
        href: lead.href,
      });
      continue;
    }

    if (lead.isAbandoned) {
      items.push({
        id: `abandoned-${lead.id}`,
        leadId: lead.id,
        category: 'abandoned_quote',
        title: `Abandoned quote — ${lead.serviceLabel}`,
        detail: `${lead.customerName}${lead.suburb ? ` · ${lead.suburb}` : ''} — started but not submitted`,
        ageHours: lead.ageHours,
        source: lead.source,
        value: lead.value,
        href: lead.href,
      });
      continue;
    }

    if (lead.responseStatus === 'awaiting_response' && lead.ageHours >= 1) {
      items.push({
        id: `waiting-${lead.id}`,
        leadId: lead.id,
        category: 'waiting_long',
        title: `Waiting > 1h — ${lead.serviceLabel}`,
        detail: `${lead.customerName}${lead.suburb ? ` · ${lead.suburb}` : ''} — ${formatAge(lead.ageHours)} since submission`,
        ageHours: lead.ageHours,
        source: lead.source,
        value: lead.value,
        href: lead.href,
      });
      continue;
    }

    if (lead.isStale && (lead.responseStatus === 'in_conversation' || lead.responseStatus === 'quoted')) {
      items.push({
        id: `overdue-${lead.id}`,
        leadId: lead.id,
        category: 'overdue_followup',
        title: `Overdue follow-up — ${lead.serviceLabel}`,
        detail: `${lead.customerName} — quote stalled ${formatAge(lead.ageHours)}`,
        ageHours: lead.ageHours,
        source: lead.source,
        value: lead.value,
        href: lead.href,
      });
    }
  }

  // Sort by an urgency score: unanswered first, then waiting-long, then
  // overdue, abandoned last. Within category, oldest first × value desc.
  const categoryRank: Record<AttentionItem['category'], number> = {
    unanswered: 0,
    waiting_long: 1,
    overdue_followup: 2,
    abandoned_quote: 3,
    failed_contact: 4,
  };
  items.sort((a, b) => {
    const c = categoryRank[a.category] - categoryRank[b.category];
    if (c !== 0) return c;
    if (b.ageHours !== a.ageHours) return b.ageHours - a.ageHours;
    return b.value - a.value;
  });

  return items;
}

// ---------- suburb insights -------------------------------------------------

export function buildSuburbInsights(leads: Lead[]): SuburbInsight[] {
  const byBucket = new Map<string, { activeLeads: number; bookedJobs: number; hotLeads: number; revenue: number }>();

  for (const lead of leads) {
    const key = lead.suburb || '— Unknown';
    const current = byBucket.get(key) ?? { activeLeads: 0, bookedJobs: 0, hotLeads: 0, revenue: 0 };

    if (lead.responseStatus === 'booked' || lead.responseStatus === 'completed') {
      current.bookedJobs += 1;
      current.revenue += lead.value;
    } else if (lead.responseStatus !== 'lost') {
      current.activeLeads += 1;
    }
    if (lead.temperature === 'HOT') current.hotLeads += 1;
    byBucket.set(key, current);
  }

  const rows = Array.from(byBucket.entries()).map(([suburb, agg]) => ({
    suburb,
    activeLeads: agg.activeLeads,
    bookedJobs: agg.bookedJobs,
    hotLeads: agg.hotLeads,
    revenue: agg.revenue,
    heat: 0,
    lat: null,
    lng: null,
  }));

  // Relative heat: normalize against the busiest suburb (active + 2× hot).
  const peak = rows.reduce((max, row) => Math.max(max, row.activeLeads + row.hotLeads * 2), 0);
  if (peak > 0) {
    for (const row of rows) {
      row.heat = (row.activeLeads + row.hotLeads * 2) / peak;
    }
  }

  rows.sort((a, b) => b.heat - a.heat || b.bookedJobs - a.bookedJobs);
  return rows;
}

// ---------- funnel ----------------------------------------------------------

const STAGE_LABELS: Record<FunnelStage, string> = {
  visitors: 'Visitors',
  quote_started: 'Quote started',
  quote_submitted: 'Quote submitted',
  contacted: 'Contacted',
  booked: 'Booked',
  completed: 'Completed',
};

/**
 * Build the funnel snapshot from leads. `visitorCount` should be the raw
 * visitor count from PostHog/visitor analytics for the same window — when
 * unknown, pass null and the first stage degrades to "—" gracefully.
 */
export function buildFunnelSnapshot(leads: Lead[], visitorCount: number | null): FunnelSnapshot[] {
  const submitted = leads.length;
  // Quote started ≈ submitted + abandoned (in-flight starts). We don't have a
  // real "started" event yet, so approximate as submitted × 1.6 when visitors
  // are present (typical local-service start→submit drop is ~38%). Conservative
  // when visitors are unknown: fall back to submitted count.
  const quoteStarted = visitorCount && visitorCount > submitted ? Math.max(submitted, Math.round(submitted * 1.6)) : submitted;

  const contacted = leads.filter(
    (l) => l.responseStatus !== 'awaiting_response' && l.responseStatus !== 'no_response' && l.responseStatus !== 'lost'
  ).length;
  const booked = leads.filter((l) => l.responseStatus === 'booked' || l.responseStatus === 'completed').length;
  const completed = leads.filter((l) => l.responseStatus === 'completed').length;

  const counts: Record<FunnelStage, number> = {
    visitors: visitorCount ?? quoteStarted,
    quote_started: quoteStarted,
    quote_submitted: submitted,
    contacted,
    booked,
    completed,
  };

  const stages: FunnelSnapshot[] = FUNNEL_STAGES.map((stage, idx) => {
    const count = counts[stage];
    if (idx === 0) {
      return { stage, label: STAGE_LABELS[stage], count, conversionFromPrev: 1, dropOff: 0, isBiggestDropOff: false };
    }
    const prevCount = counts[FUNNEL_STAGES[idx - 1]];
    const conversionFromPrev = prevCount > 0 ? count / prevCount : 0;
    const dropOff = Math.max(0, 1 - conversionFromPrev);
    return { stage, label: STAGE_LABELS[stage], count, conversionFromPrev, dropOff, isBiggestDropOff: false };
  });

  // Flag the biggest drop-off (excluding the first stage).
  let biggest = -1;
  let biggestIdx = -1;
  for (let i = 1; i < stages.length; i += 1) {
    if (stages[i].dropOff > biggest) {
      biggest = stages[i].dropOff;
      biggestIdx = i;
    }
  }
  if (biggestIdx >= 0 && biggest > 0.05) {
    stages[biggestIdx].isBiggestDropOff = true;
  }
  return stages;
}

// ---------- response metrics ------------------------------------------------

export function buildResponseMetrics(leads: Lead[]): ResponseMetrics {
  const responded = leads.filter((l) => l.firstResponseHours !== null);
  const responseHours = responded
    .map((l) => l.firstResponseHours as number)
    .filter((h) => Number.isFinite(h) && h >= 0)
    .sort((a, b) => a - b);

  const avgFirstResponseHours =
    responseHours.length > 0 ? responseHours.reduce((s, h) => s + h, 0) / responseHours.length : null;
  const medianFirstResponseHours =
    responseHours.length > 0 ? responseHours[Math.floor(responseHours.length / 2)] : null;

  // Channel breakdown
  const byChannel = new Map<LeadSource, { hours: number[]; leads: number; booked: number }>();
  for (const lead of leads) {
    const current = byChannel.get(lead.source) ?? { hours: [], leads: 0, booked: 0 };
    current.leads += 1;
    if (lead.firstResponseHours !== null) current.hours.push(lead.firstResponseHours);
    if (lead.responseStatus === 'booked' || lead.responseStatus === 'completed') current.booked += 1;
    byChannel.set(lead.source, current);
  }

  const channelBreakdown = Array.from(byChannel.entries()).map(([source, agg]) => ({
    source,
    avgHours: agg.hours.length > 0 ? agg.hours.reduce((s, h) => s + h, 0) / agg.hours.length : null,
    leads: agg.leads,
    booked: agg.booked,
    bookedRate: agg.leads > 0 ? agg.booked / agg.leads : 0,
  }));

  const withHours = channelBreakdown.filter((c) => c.avgHours !== null) as Array<typeof channelBreakdown[number] & { avgHours: number }>;
  const fastestChannel = withHours.length > 0
    ? withHours.reduce((min, c) => (c.avgHours < min.avgHours ? c : min))
    : null;
  const slowestChannel = withHours.length > 0
    ? withHours.reduce((max, c) => (c.avgHours > max.avgHours ? c : max))
    : null;

  const missedLeadEstimate = leads.filter(
    (l) => l.responseStatus === 'no_response' || (l.responseStatus === 'awaiting_response' && l.ageHours >= 24)
  ).length;

  const fastBucket = leads.filter((l) => l.firstResponseHours !== null && (l.firstResponseHours as number) < 1);
  const slowBucket = leads.filter((l) => l.firstResponseHours !== null && (l.firstResponseHours as number) > 6);
  const fastResponseConversion = fastBucket.length > 0
    ? fastBucket.filter((l) => l.responseStatus === 'booked' || l.responseStatus === 'completed').length / fastBucket.length
    : 0;
  const slowResponseConversion = slowBucket.length > 0
    ? slowBucket.filter((l) => l.responseStatus === 'booked' || l.responseStatus === 'completed').length / slowBucket.length
    : 0;

  return {
    avgFirstResponseHours,
    medianFirstResponseHours,
    fastestChannel: fastestChannel ? { source: fastestChannel.source, hours: fastestChannel.avgHours } : null,
    slowestChannel: slowestChannel ? { source: slowestChannel.source, hours: slowestChannel.avgHours } : null,
    missedLeadEstimate,
    fastResponseConversion,
    slowResponseConversion,
    channelBreakdown,
  };
}

// ---------- public formatters (used by components) -------------------------

export function formatLeadAge(hours: number): string {
  return formatAge(hours);
}

export function formatLeadMoney(value: number): string {
  return formatMoney(value);
}

/** Title-case a source key for display. */
export function formatSource(source: LeadSource): string {
  if (source === 'unknown') return 'Unknown';
  return source.charAt(0).toUpperCase() + source.slice(1);
}

/** Lead constants for filter pills. */
export const TEMPERATURE_ORDER: LeadTemperature[] = ['HOT', 'WARM', 'COLD', 'LOST'];
export const SOURCE_ORDER: LeadSource[] = ['website', 'messenger', 'instagram', 'sms', 'email', 'phone', 'referral', 'unknown'];

/** Always day-window subset — used by the live feed default view. */
export function filterLast24h(leads: Lead[], now: Date = new Date()): Lead[] {
  const cutoff = now.getTime() - DAY_MS;
  return leads.filter((l) => new Date(l.createdAt).getTime() >= cutoff);
}
