/**
 * Canonical status enumerations for the three core entity types.
 *
 * Each export is both a value (const object) and a type (union of its values),
 * following the TypeScript companion-namespace pattern. Callers import the
 * object for comparisons and the type for annotations:
 *
 *   import { OrderStatus, type OrderStatus as OrderStatusType } from '@/lib/types/status';
 *   const s: OrderStatusType = OrderStatus.completed;
 *
 * DO NOT add status values here without a corresponding DB migration.
 * The authoritative constraint lives in supabase/migrations/.
 */

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

/**
 * Application-layer quote statuses. Legacy DB values ('pending', 'approved',
 * 'adjusted', 'converted') are normalised to these at read time in the API
 * routes — they do not appear here.
 */
export const QuoteStatus = {
  submitted: 'submitted',
  inReview: 'in_review',
  finalized: 'finalized',
  paymentPending: 'payment_pending',
  paid: 'paid',
  denied: 'denied',
  cancelled: 'cancelled',
} as const;

export type QuoteStatus = (typeof QuoteStatus)[keyof typeof QuoteStatus];

export const VALID_QUOTE_STATUSES: QuoteStatus[] = Object.values(QuoteStatus) as QuoteStatus[];

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

/** Matches the CHECK constraint on orders.status in the DB. */
export const OrderStatus = {
  pending: 'pending',
  confirmed: 'confirmed',
  scheduled: 'scheduled',
  inProgress: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const VALID_ORDER_STATUSES: OrderStatus[] = Object.values(OrderStatus) as OrderStatus[];

// ---------------------------------------------------------------------------
// Job Assignment
// ---------------------------------------------------------------------------

/** Matches the values used across job_assignments rows and cron routes. */
export const JobAssignmentStatus = {
  available: 'available',
  accepted: 'accepted',
  inProgress: 'in_progress',
  completed: 'completed',
  declined: 'declined',
} as const;

export type JobAssignmentStatus = (typeof JobAssignmentStatus)[keyof typeof JobAssignmentStatus];
