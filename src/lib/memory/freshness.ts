/**
 * Freshness scoring for memory documents.
 *
 * Score is 0.0–1.0. Decays exponentially over time based on category
 * volatility. Boosted slightly each time an agent reads the document.
 * Below FRESHNESS_STALE_THRESHOLD (0.3) → document is considered stale.
 */

import type { MemoryCategory } from './types';
import {
  FRESHNESS_DECAY,
  FRESHNESS_STALE_THRESHOLD,
  FRESHNESS_READ_BOOST,
} from './config';

// ── Score calculation ─────────────────────────────────────────────────────────

/**
 * Compute the current freshness score for a document.
 *
 * Formula: base * decay_rate^(days_since_updated)
 * Where base is the stored freshness_score (allows boosted documents to
 * start from their boosted value rather than always resetting to 1.0).
 */
export function computeFreshness(
  category: MemoryCategory,
  updatedAt: Date,
  storedScore: number = 1.0,
): number {
  const decay    = FRESHNESS_DECAY[category] ?? 0.99;
  const now      = Date.now();
  const ageMs    = now - updatedAt.getTime();
  const ageDays  = ageMs / 86_400_000;

  const computed = storedScore * Math.pow(decay, ageDays);
  return Math.max(0.0, Math.min(1.0, computed));
}

// ── Read boost ────────────────────────────────────────────────────────────────

/**
 * Apply a read boost to a freshness score.
 * Reading a memory signals it's still relevant, countering time decay.
 */
export function applyReadBoost(currentScore: number): number {
  return Math.min(1.0, currentScore + FRESHNESS_READ_BOOST);
}

// ── Stale detection ───────────────────────────────────────────────────────────

export function isStale(score: number): boolean {
  return score < FRESHNESS_STALE_THRESHOLD;
}

/** How many days until a document at score `s` crosses the stale threshold? */
export function daysUntilStale(
  category: MemoryCategory,
  currentScore: number,
): number {
  if (currentScore <= FRESHNESS_STALE_THRESHOLD) return 0;
  const decay = FRESHNESS_DECAY[category] ?? 0.99;
  // solve: currentScore * decay^d = STALE_THRESHOLD → d = log(t/s) / log(decay)
  return Math.log(FRESHNESS_STALE_THRESHOLD / currentScore) / Math.log(decay);
}

// ── Bulk freshness refresh ────────────────────────────────────────────────────
// Called by the sync process or a scheduled job.

export interface FreshnessUpdate {
  id: string;
  freshness_score: number;
}

/** Recompute freshness for a batch of documents and return update payloads. */
export function bulkRefreshFreshness(
  docs: Array<{
    id: string;
    category: MemoryCategory;
    updated_at: string;
    freshness_score: number;
  }>,
): FreshnessUpdate[] {
  return docs.map((d) => ({
    id: d.id,
    freshness_score: computeFreshness(
      d.category,
      new Date(d.updated_at),
      d.freshness_score,
    ),
  }));
}

// ── Freshness label ───────────────────────────────────────────────────────────

export type FreshnessLabel = 'fresh' | 'aging' | 'stale';

export function freshnessLabel(score: number): FreshnessLabel {
  if (score >= 0.7) return 'fresh';
  if (score >= FRESHNESS_STALE_THRESHOLD) return 'aging';
  return 'stale';
}
