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
