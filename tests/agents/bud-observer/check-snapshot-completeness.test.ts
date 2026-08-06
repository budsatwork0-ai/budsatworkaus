/**
 * Smoke tests for the bud-observer completeness check.
 *
 * Covers:
 *  1. A minimal valid snapshot (one entry per category) — no warning expected.
 *  2. A snapshot with 3 empty categories — warning expected.
 *  3. A snapshot exactly at the threshold (2 empty) — no warning expected.
 */

import { describe, it, expect } from 'vitest';
import {
  checkSnapshotCompleteness,
  EMPTY_CATEGORY_THRESHOLD,
} from '../../../src/agents/bud-observer/check-snapshot-completeness';
import { HealthSnapshot } from '../../../src/agents/bud-observer/health-snapshot-schema';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const RECORDED_AT = '2024-01-01T00:00:00.000Z';
const SNAPSHOT_AT = '2024-01-01T00:00:00.000Z';

const minimalEntry = { recordedAt: RECORDED_AT };

/** One entry in every category — the minimal valid healthy snapshot. */
const fullSnapshot: HealthSnapshot = {
  snapshotAt: SNAPSHOT_AT,
  signals: [minimalEntry],
  errors: [minimalEntry],
  conversions: [minimalEntry],
  ux: [minimalEntry],
  design: [minimalEntry],
};

/** Only required categories populated; all three optional categories are absent. */
const sparseSnapshot: HealthSnapshot = {
  snapshotAt: SNAPSHOT_AT,
  signals: [minimalEntry],
  errors: [minimalEntry],
  // conversions, ux, design intentionally omitted
};

/** Two optional categories absent — exactly at the warning threshold. */
const atThresholdSnapshot: HealthSnapshot = {
  snapshotAt: SNAPSHOT_AT,
  signals: [minimalEntry],
  errors: [minimalEntry],
  conversions: [minimalEntry],
  // ux and design intentionally omitted
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('checkSnapshotCompleteness', () => {
  it('returns ok=true and no warning for a fully-populated snapshot', () => {
    const result = checkSnapshotCompleteness(fullSnapshot);

    expect(result.ok).toBe(true);
    expect(result.emptyCount).toBe(0);
    expect(result.emptyCategories).toHaveLength(0);
    expect(result.warning).toBeUndefined();
  });

  it('returns ok=false and emits a snapshot_incomplete warning when 3 categories are empty', () => {
    const result = checkSnapshotCompleteness(sparseSnapshot);

    expect(result.ok).toBe(false);
    expect(result.emptyCount).toBe(3);
    expect(result.emptyCategories).toEqual(
      expect.arrayContaining(['conversions', 'ux', 'design']),
    );

    expect(result.warning).toBeDefined();
    expect(result.warning?.type).toBe('snapshot_incomplete');
    expect(result.warning?.severity).toBe('low');
    expect(result.warning?.emptyCategories).toHaveLength(3);
    expect(result.warning?.message).toMatch(/snapshot_incomplete/);
    expect(result.warning?.message).toMatch(/3\/5/);
  });

  it(`does NOT warn when exactly ${EMPTY_CATEGORY_THRESHOLD} categories are empty (at threshold)`, () => {
    const result = checkSnapshotCompleteness(atThresholdSnapshot);

    expect(result.ok).toBe(true);
    expect(result.emptyCount).toBe(EMPTY_CATEGORY_THRESHOLD);
    expect(result.warning).toBeUndefined();
  });

  it('includes the correct emptyCategories list in the warning', () => {
    const result = checkSnapshotCompleteness(sparseSnapshot);

    expect(result.warning?.emptyCategories).toEqual(
      expect.arrayContaining(['conversions', 'ux', 'design']),
    );
  });

  it('emits a warning with a valid ISO-8601 emittedAt timestamp', () => {
    const result = checkSnapshotCompleteness(sparseSnapshot);
    const ts = result.warning?.emittedAt ?? '';

    expect(ts).not.toBe('');
    expect(new Date(ts).toISOString()).toBe(ts);
  });
});
