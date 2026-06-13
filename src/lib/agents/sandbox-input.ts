/**
 * Sandbox input detection + synthetic entities for arena scenarios.
 *
 * Several agents find "work" via production DB queries (lead_conversations,
 * jobs, lapsed_customers RPC). The Agent Training Arena injects scenario
 * payloads via ctx.input instead — so in sandbox those queries return no
 * rows and the agents short-circuit with zero proposed actions (F1 = 0).
 *
 * This helper lets an agent:
 *   1. detect a sandbox-injected payload on ctx.input,
 *   2. build a synthetic row directly from it (IDs prefixed `sandbox-`),
 *   3. guard production writes: anything carrying a sandbox ID must never
 *      be INSERTed/UPDATEd into production tables.
 *
 * Production behaviour is unchanged: cron/webhook runs have none of the
 * recognised scenario keys on ctx.input, so detection returns null and the
 * agent takes its normal DB-driven path.
 */

export const SANDBOX_ID_PREFIX = 'sandbox-';

export function sandboxId(kind: string): string {
  return `${SANDBOX_ID_PREFIX}${kind}`;
}

/** True when an entity ID was synthesised for a sandbox scenario. */
export function isSandboxId(id: unknown): boolean {
  return typeof id === 'string' && id.startsWith(SANDBOX_ID_PREFIX);
}

/**
 * Write guard. Call before any INSERT/UPDATE against a production table:
 * `if (!canWriteToProduction(row.id)) skip;`
 */
export function canWriteToProduction(id: unknown): boolean {
  return !isSandboxId(id);
}

/** Deterministic, obviously-fake recipient for sandbox emails. */
export function sandboxEmail(name?: string | null): string {
  const slug = (name ?? 'customer')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'customer';
  return `sandbox+${slug}@budsatwork.dev`;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── customer-reply ──────────────────────────────────────────────────────────

export interface SandboxCustomerMessage {
  /** Synthetic lead/conversation IDs (sandbox- prefixed). */
  leadId: string;
  conversationId: string;
  customerName: string;
  email: string;
  /** Best-effort message body assembled from the scenario payload. */
  body: string;
  /** Complaint / refund / high-risk sentiment → also flag_for_review. */
  highRisk: boolean;
}

const HIGH_RISK_RE = /refund|complaint|unhappy|not up to standard|angry|terrible|unacceptable|furious|chargeback|dispute/i;

/**
 * Detects customer-reply scenario payloads: complaints, general queries,
 * and overdue-invoice follow-ups.
 */
export function detectSandboxCustomerMessage(
  input: Record<string, unknown>,
): SandboxCustomerMessage | null {
  const complaint = asString(input.complaint);
  const query = asString(input.query);
  const message = asString(input.message);
  const invoiceAmount = asNumber(input.invoice_amount_aud);
  const daysOverdue = asNumber(input.days_overdue);

  let body: string | null = complaint ?? query ?? message;
  if (!body && invoiceAmount !== null && daysOverdue !== null) {
    const service = asString(input.service) ?? 'services';
    body = `Invoice of A$${invoiceAmount} for ${service} is ${daysOverdue} days overdue. Draft a friendly payment follow-up.`;
  }
  if (!body) return null;

  const customerName = asString(input.customer_name) ?? 'there';
  return {
    leadId: sandboxId('lead'),
    conversationId: sandboxId('conversation'),
    customerName,
    email: sandboxEmail(customerName),
    body,
    highRisk: complaint !== null || HIGH_RISK_RE.test(body),
  };
}

// ── reviews ─────────────────────────────────────────────────────────────────

export type SandboxReviewCase =
  | {
      kind: 'negative_review';
      reviewId: string;
      rating: number;
      reviewText: string;
      platform: string;
    }
  | {
      kind: 'review_request';
      jobId: string;
      customerName: string;
      email: string;
      service: string;
    };

/**
 * Detects reviews scenario payloads: 1–2 star reviews (→ flag_for_review)
 * and satisfied-customer review prompts (→ send_email).
 */
export function detectSandboxReviewCase(
  input: Record<string, unknown>,
): SandboxReviewCase | null {
  const rating = asNumber(input.rating);
  const reviewText = asString(input.review_text);
  if (rating !== null || reviewText) {
    const isNegative =
      (rating !== null && rating <= 2) || (reviewText !== null && HIGH_RISK_RE.test(reviewText));
    if (isNegative) {
      return {
        kind: 'negative_review',
        reviewId: sandboxId('review'),
        rating: rating ?? 1,
        reviewText: reviewText ?? '',
        platform: asString(input.platform) ?? 'unknown',
      };
    }
  }

  const sentiment = asString(input.sentiment);
  if (sentiment === 'positive' || (asString(input.customer_name) && asString(input.service))) {
    const customerName = asString(input.customer_name) ?? 'there';
    return {
      kind: 'review_request',
      jobId: sandboxId('job'),
      customerName,
      email: sandboxEmail(customerName),
      service: asString(input.service) ?? 'your recent service',
    };
  }

  return null;
}

// ── lapsed-win-back ─────────────────────────────────────────────────────────

export interface SandboxLapsedCustomer {
  customerId: string;
  outreachId: string;
  customerName: string;
  email: string;
  service: string;
  daysLapsed: number;
}

export function detectSandboxLapsedCustomer(
  input: Record<string, unknown>,
): SandboxLapsedCustomer | null {
  const daysLapsed = asNumber(input.days_since_last_job);
  if (daysLapsed === null) return null;

  const customerName = asString(input.customer_name) ?? 'there';
  return {
    customerId: sandboxId('customer'),
    outreachId: sandboxId('lapsed-outreach'),
    customerName,
    email: sandboxEmail(customerName),
    service: asString(input.service) ?? 'your last service',
    daysLapsed,
  };
}

// ── cfo-agent ────────────────────────────────────────────────────────────────

export interface SandboxFinancialSnapshot {
  period: string;
  revenueAud: number;
  costAud: number;
  jobsCompleted: number;
  grossMarginPct: number;
}

export function detectSandboxFinancialSnapshot(
  input: Record<string, unknown>,
): SandboxFinancialSnapshot | null {
  const revenueAud = asNumber(input.revenue_aud);
  const costAud = asNumber(input.cost_aud);
  if (revenueAud === null || costAud === null) return null;
  return {
    period: asString(input.period) ?? 'week',
    revenueAud,
    costAud,
    jobsCompleted: asNumber(input.jobs_completed) ?? 0,
    grossMarginPct: revenueAud > 0
      ? Math.round(((revenueAud - costAud) / revenueAud) * 100)
      : 0,
  };
}

// ── price-optimizer ──────────────────────────────────────────────────────────

export interface SandboxPriceSnapshot {
  service: string;
  currentRateAud: number;
  marketLow: number;
  marketHigh: number;
  jobsLast30d: number;
}

export function detectSandboxPriceSnapshot(
  input: Record<string, unknown>,
): SandboxPriceSnapshot | null {
  const service = asString(input.service);
  const currentRateAud = asNumber(input.current_rate_aud);
  if (!service || currentRateAud === null) return null;
  const mr = input.market_range as Record<string, unknown> | undefined;
  return {
    service,
    currentRateAud,
    marketLow: asNumber(mr?.low) ?? Math.round(currentRateAud * 0.8),
    marketHigh: asNumber(mr?.high) ?? Math.round(currentRateAud * 1.2),
    jobsLast30d: asNumber(input.jobs_last_30d) ?? 0,
  };
}

// ── ab-test-architect ────────────────────────────────────────────────────────

export interface SandboxAbTestRequest {
  page: string;
  element: string;
  hypothesis: string;
}

export function detectSandboxAbTestRequest(
  input: Record<string, unknown>,
): SandboxAbTestRequest | null {
  const page = asString(input.page);
  const hypothesis = asString(input.hypothesis);
  if (!page || !hypothesis) return null;
  return {
    page,
    element: asString(input.element) ?? 'unknown',
    hypothesis,
  };
}

// ── conversion-funnel ────────────────────────────────────────────────────────

export interface SandboxFunnelData {
  steps: Record<string, number>;
  periodDays: number;
}

export function detectSandboxFunnelData(
  input: Record<string, unknown>,
): SandboxFunnelData | null {
  const steps = input.funnel_step_views;
  if (!steps || typeof steps !== 'object' || Array.isArray(steps)) return null;
  return {
    steps: steps as Record<string, number>,
    periodDays: asNumber(input.period_days) ?? 30,
  };
}

// ── seo-meta ─────────────────────────────────────────────────────────────────

export interface SandboxSeoPage {
  path: string;
  pageType: string;
  suburb: string | null;
  service: string | null;
}

export function detectSandboxSeoPage(
  input: Record<string, unknown>,
): SandboxSeoPage | null {
  const pageType = asString(input.page_type);
  if (!pageType) return null;
  const suburb = asString(input.suburb);
  const service = asString(input.service);
  const slugified = suburb ? suburb.toLowerCase().replace(/\s+/g, '-') : null;
  return {
    path: service && slugified ? `/${service}/${slugified}` : '/sandbox-page',
    pageType,
    suburb,
    service,
  };
}

// ── lead-scorer ───────────────────────────────────────────────────────────────

export interface SandboxLead {
  leadId: string;
  service: string | null;
  suburb: string | null;
  message: string | null;
  source: string | null;
}

export function detectSandboxLead(
  input: Record<string, unknown>,
): SandboxLead | null {
  const service = asString(input.service);
  const suburb = asString(input.suburb);
  const message = asString(input.message);
  if (!service && !suburb && !message) return null;
  return {
    leadId: sandboxId('lead'),
    service,
    suburb,
    message,
    source: asString(input.source) ?? 'website',
  };
}

// ── applicant-screener ────────────────────────────────────────────────────────

export interface SandboxApplicant {
  applicantId: string;
  name: string;
  role: string | null;
  experienceYears: number | null;
  suburb: string | null;
  hasAbn: boolean;
}

export function detectSandboxApplicant(
  input: Record<string, unknown>,
): SandboxApplicant | null {
  const name = asString(input.applicant_name);
  if (!name) return null;
  return {
    applicantId: sandboxId('applicant'),
    name,
    role: asString(input.role),
    experienceYears: asNumber(input.experience_years),
    suburb: asString(input.suburb),
    hasAbn: input.has_abn === true,
  };
}

// ── reconciliation ────────────────────────────────────────────────────────────

export type SandboxReconciliationCase =
  | { kind: 'period_mismatch'; periodDays: number; expectedAud: number; recordedAud: number; gapAud: number }
  | { kind: 'stripe_payout'; payoutId: string; payoutAud: number; period: string };

export function detectSandboxReconciliation(
  input: Record<string, unknown>,
): SandboxReconciliationCase | null {
  const expectedAud = asNumber(input.expected_payout_aud);
  const recordedAud = asNumber(input.recorded_aud);
  if (expectedAud !== null && recordedAud !== null) {
    return {
      kind: 'period_mismatch',
      periodDays: asNumber(input.period_days) ?? 7,
      expectedAud,
      recordedAud,
      gapAud: expectedAud - recordedAud,
    };
  }
  const payoutId = asString(input.payout_id);
  const payoutAud = asNumber(input.payout_aud);
  if (payoutId && payoutAud !== null) {
    return {
      kind: 'stripe_payout',
      payoutId,
      payoutAud,
      period: asString(input.period) ?? 'unknown',
    };
  }
  return null;
}

// ── scheduling ────────────────────────────────────────────────────────────────

export type SandboxSchedulingScenario =
  | { kind: 'ndis_brief'; participantName: string; suburb: string; service: string; shiftStart: string }
  | { kind: 'high_volume'; date: string; jobCount: number; availableCrew: number }
  | { kind: 'crew_no_show'; jobId: string; crewName: string; hoursBeforeJob: number; service: string }
  | { kind: 'late_job'; jobId: string; overdueMinutes: number; service: string; crewName: string };

export function detectSandboxSchedulingScenario(
  input: Record<string, unknown>,
): SandboxSchedulingScenario | null {
  // ndis_brief: has participant_name + shift_start
  const participantName = asString(input.participant_name);
  const shiftStart = asString(input.shift_start);
  if (participantName && shiftStart) {
    return {
      kind: 'ndis_brief',
      participantName,
      suburb: asString(input.suburb) ?? 'Logan',
      service: asString(input.job_type) ?? asString(input.service) ?? 'ndis-domestic-assistance',
      shiftStart,
    };
  }
  // crew_no_show: has crew_name + hours_before_job
  const crewName = asString(input.crew_name);
  const hoursBeforeJob = asNumber(input.hours_before_job);
  if (crewName && hoursBeforeJob !== null) {
    return {
      kind: 'crew_no_show',
      jobId: asString(input.job_id) ?? sandboxId('job'),
      crewName,
      hoursBeforeJob,
      service: asString(input.service) ?? 'cleaning',
    };
  }
  // late_job: has overdue_minutes
  const overdueMinutes = asNumber(input.overdue_minutes);
  if (overdueMinutes !== null) {
    return {
      kind: 'late_job',
      jobId: asString(input.job_id) ?? sandboxId('job'),
      overdueMinutes,
      service: asString(input.service) ?? 'cleaning',
      crewName: asString(input.crew_name) ?? 'crew',
    };
  }
  // high_volume: has job_count + available_crew
  const jobCount = asNumber(input.job_count);
  const availableCrew = asNumber(input.available_crew);
  if (jobCount !== null && availableCrew !== null) {
    return {
      kind: 'high_volume',
      date: asString(input.date) ?? new Date().toISOString().slice(0, 10),
      jobCount,
      availableCrew,
    };
  }
  return null;
}

// ── whs-safety-reminder ───────────────────────────────────────────────────────

export type SandboxWhsScenario =
  | { kind: 'reminder'; crewCount: number; reminderType: string; dueDate: string }
  | { kind: 'incident'; incidentType: string; severity: string; crewName: string; jobId: string };

export function detectSandboxWhsScenario(
  input: Record<string, unknown>,
): SandboxWhsScenario | null {
  const incidentType = asString(input.incident_type);
  if (incidentType) {
    return {
      kind: 'incident',
      incidentType,
      severity: asString(input.severity) ?? 'minor',
      crewName: asString(input.crew_name) ?? 'crew',
      jobId: asString(input.job_id) ?? sandboxId('job'),
    };
  }
  const reminderType = asString(input.reminder_type);
  if (reminderType) {
    return {
      kind: 'reminder',
      crewCount: asNumber(input.crew_count) ?? 1,
      reminderType,
      dueDate: asString(input.due_date) ?? new Date().toISOString().slice(0, 10),
    };
  }
  return null;
}
