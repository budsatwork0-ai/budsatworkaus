// -----------------------------------------------------------------------------
// Bud Leads — domain types
// -----------------------------------------------------------------------------
// These types are the contract between the Live Leads Feed, Needs Attention
// panel, Lead Funnel, Response Performance panel, and Suburb Heatmap.
//
// Why this lives in a leads/lib/ subfolder (and not src/types):
//   - It's lead-intelligence specific. Keeping it co-located avoids polluting
//     the global dashboard type surface.
//   - When module 9 (Lead Database Architecture) ships its own Supabase
//     `leads` table, the adapter is the only file that has to change — these
//     types stay stable.
// -----------------------------------------------------------------------------

/**
 * Lead temperature.
 *
 *   HOT  — fresh (< 1h), high-value, unanswered, or contact requested.
 *   WARM — recent (< 24h), engaged, finalized but unpaid.
 *   COLD — > 48h with no progression, or stuck in review.
 *   LOST — explicitly lost (cancelled / declined) or stale beyond recovery.
 */
export type LeadTemperature = 'HOT' | 'WARM' | 'COLD' | 'LOST';

/**
 * Where a lead came from. Defaults to `unknown` when the source can't be
 * inferred. `website` covers any quote that began on budsatwork.com.
 */
export type LeadSource =
  | 'website'
  | 'messenger'
  | 'sms'
  | 'instagram'
  | 'email'
  | 'phone'
  | 'referral'
  | 'unknown';

/**
 * Operational response status — distinct from quote status. This is "has
 * a human at Buds At Work touched this lead yet?".
 */
export type LeadResponseStatus =
  | 'awaiting_response'  // never been touched
  | 'in_conversation'    // we've replied at least once
  | 'quoted'             // formal quote sent
  | 'booked'             // converted to an order
  | 'completed'          // job finished
  | 'no_response'        // we never replied → missed lead
  | 'lost';              // cancelled / declined

/**
 * Funnel stages, ordered. The funnel chart iterates this array — keep order.
 */
export const FUNNEL_STAGES = [
  'visitors',
  'quote_started',
  'quote_submitted',
  'contacted',
  'booked',
  'completed',
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

/**
 * A single lead — the unit of work in Bud Leads.
 *
 * Fields are intentionally minimal. Anything derived (e.g. age, slaBreached)
 * is computed at render time, never persisted.
 */
export type Lead = {
  id: string;
  customerName: string;
  service: string;          // raw service_type slug (e.g. "yard")
  serviceLabel: string;     // human label (e.g. "Yard care")
  suburb: string | null;    // parsed from service_address
  address: string | null;   // raw service_address
  source: LeadSource;
  temperature: LeadTemperature;
  responseStatus: LeadResponseStatus;
  quoteStatus: string;      // normalized quote status (submitted/in_review/finalized/paid/...)
  value: number;            // dollar value of the lead (reviewed_total ?? submitted_total ?? total)
  createdAt: string;        // ISO timestamp
  ageHours: number;         // hours since createdAt
  firstResponseAt: string | null;     // when we first replied (best estimate)
  firstResponseHours: number | null;  // hours from createdAt → firstResponseAt
  bookedAt: string | null;            // when it converted to an order
  isHotPulse: boolean;      // UI hint — show pulsing glow
  isAbandoned: boolean;     // quote started but never submitted
  isStale: boolean;         // > 48h with no progression
  /** Free-form action hint for the Needs Attention panel. */
  attentionReason: string | null;
  href: string;             // deep link to the quote in /dashboard/quotes
  /** 0–100 quality score written by the lead-scorer agent. Null until scored. */
  leadScore: number | null;
};

/**
 * Funnel snapshot returned by buildFunnelSnapshot().
 */
export type FunnelSnapshot = {
  stage: FunnelStage;
  label: string;
  count: number;
  /** Conversion % from the *previous* stage (visitors stage is always 100). */
  conversionFromPrev: number;
  /** Drop-off from the previous stage (1 - conversionFromPrev), as a 0–1 number. */
  dropOff: number;
  /** True when this stage has the largest drop-off in the funnel. */
  isBiggestDropOff: boolean;
};

/**
 * Response performance KPIs.
 */
export type ResponseMetrics = {
  avgFirstResponseHours: number | null;
  medianFirstResponseHours: number | null;
  fastestChannel: { source: LeadSource; hours: number } | null;
  slowestChannel: { source: LeadSource; hours: number } | null;
  missedLeadEstimate: number;          // leads that aged > 24h with no response
  fastResponseConversion: number;      // conversion % for leads responded < 1h
  slowResponseConversion: number;      // conversion % for leads responded > 6h
  channelBreakdown: Array<{
    source: LeadSource;
    avgHours: number | null;
    leads: number;
    booked: number;
    bookedRate: number;
  }>;
};

/**
 * Suburb intelligence row used by the heatmap and the Opportunity Radar.
 */
export type SuburbInsight = {
  suburb: string;
  activeLeads: number;
  bookedJobs: number;
  hotLeads: number;
  revenue: number;
  /** Heat weight 0–1 (relative within the dataset). */
  heat: number;
  /** Approx Lat/Lng — when geocoded by a separate pass. Null in the MVP. */
  lat: number | null;
  lng: number | null;
};

/**
 * Operational attention item for the Needs Attention panel.
 */
export type AttentionItem = {
  id: string;
  leadId: string;
  category: 'unanswered' | 'overdue_followup' | 'abandoned_quote' | 'waiting_long' | 'failed_contact';
  title: string;
  detail: string;
  ageHours: number;
  source: LeadSource;
  value: number;
  href: string;
};
