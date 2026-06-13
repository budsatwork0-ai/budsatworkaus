import { describe, it, expect } from 'vitest';
import {
  nextCronRun,
  prevCronRun,
  formatCountdown,
  SANDBOX_CRONS,
} from '../../src/lib/sandbox/cron-schedule';

// ── nextCronRun ─────────────────────────────────────────────────────────────

describe('nextCronRun — hourly (0 * * * *)', () => {
  it('correctly calculates next hourly run from mid-hour', () => {
    const from = new Date('2026-06-13T14:30:00.000Z');
    expect(nextCronRun('0 * * * *', from).toISOString()).toBe('2026-06-13T15:00:00.000Z');
  });

  it('correctly calculates next hourly run from seconds past the hour', () => {
    const from = new Date('2026-06-13T14:00:01.000Z');
    expect(nextCronRun('0 * * * *', from).toISOString()).toBe('2026-06-13T15:00:00.000Z');
  });

  it('advances to next hour when exactly on the hour boundary', () => {
    const from = new Date('2026-06-13T14:00:00.000Z');
    expect(nextCronRun('0 * * * *', from).toISOString()).toBe('2026-06-13T15:00:00.000Z');
  });

  it('wraps from 23:00 to 00:00 next day', () => {
    const from = new Date('2026-06-13T23:30:00.000Z');
    expect(nextCronRun('0 * * * *', from).toISOString()).toBe('2026-06-14T00:00:00.000Z');
  });
});

describe('nextCronRun — daily at 03:00 (0 3 * * *)', () => {
  it('correctly calculates next daily run when before 03:00', () => {
    const from = new Date('2026-06-13T02:00:00.000Z');
    expect(nextCronRun('0 3 * * *', from).toISOString()).toBe('2026-06-13T03:00:00.000Z');
  });

  it('correctly calculates next daily run when after 03:00', () => {
    const from = new Date('2026-06-13T14:00:00.000Z');
    expect(nextCronRun('0 3 * * *', from).toISOString()).toBe('2026-06-14T03:00:00.000Z');
  });

  it('advances to next day when exactly on 03:00', () => {
    const from = new Date('2026-06-13T03:00:00.000Z');
    expect(nextCronRun('0 3 * * *', from).toISOString()).toBe('2026-06-14T03:00:00.000Z');
  });
});

describe('nextCronRun — full regression at 01:30 (30 1 * * *)', () => {
  it('correctly calculates next full run when before 01:30', () => {
    const from = new Date('2026-06-13T01:00:00.000Z');
    expect(nextCronRun('30 1 * * *', from).toISOString()).toBe('2026-06-13T01:30:00.000Z');
  });

  it('correctly calculates next full run when after 01:30', () => {
    const from = new Date('2026-06-13T02:00:00.000Z');
    expect(nextCronRun('30 1 * * *', from).toISOString()).toBe('2026-06-14T01:30:00.000Z');
  });

  it('advances to next day when exactly on 01:30', () => {
    const from = new Date('2026-06-13T01:30:00.000Z');
    expect(nextCronRun('30 1 * * *', from).toISOString()).toBe('2026-06-14T01:30:00.000Z');
  });
});

// ── Simultaneous runs ────────────────────────────────────────────────────────

describe('simultaneous hourly + daily at 03:00 UTC', () => {
  it('both hourly and daily resolve to the same next run time at 02:55', () => {
    const from = new Date('2026-06-13T02:55:00.000Z');
    const hourlyNext = nextCronRun('0 * * * *', from);
    const dailyNext  = nextCronRun('0 3 * * *', from);
    expect(hourlyNext.toISOString()).toBe('2026-06-13T03:00:00.000Z');
    expect(dailyNext.toISOString()).toBe('2026-06-13T03:00:00.000Z');
    expect(hourlyNext.getTime()).toBe(dailyNext.getTime());
  });

  it('full regression does NOT fire at 03:00', () => {
    const from = new Date('2026-06-13T02:55:00.000Z');
    const fullNext = nextCronRun('30 1 * * *', from);
    // Full ran at 01:30, so next is tomorrow 01:30
    expect(fullNext.toISOString()).toBe('2026-06-14T01:30:00.000Z');
    expect(fullNext.getTime()).not.toBe(nextCronRun('0 * * * *', from).getTime());
  });
});

// ── prevCronRun ──────────────────────────────────────────────────────────────

describe('prevCronRun', () => {
  it('returns 1 hour before next run for hourly schedule', () => {
    const from = new Date('2026-06-13T14:30:00.000Z');
    const prev = prevCronRun('0 * * * *', from);
    expect(prev.toISOString()).toBe('2026-06-13T14:00:00.000Z');
  });

  it('returns 24 hours before next run for daily schedule', () => {
    const from = new Date('2026-06-13T14:00:00.000Z');
    const prev = prevCronRun('0 3 * * *', from);
    expect(prev.toISOString()).toBe('2026-06-13T03:00:00.000Z');
  });
});

// ── Missing last batch ───────────────────────────────────────────────────────

describe('missing last batch handling', () => {
  it('next run is always in the future regardless of null lastCronRun', () => {
    const now = new Date('2026-06-13T14:00:00.000Z');
    for (const cron of SANDBOX_CRONS) {
      const next = nextCronRun(cron.schedule, now);
      expect(next.getTime()).toBeGreaterThan(now.getTime());
    }
  });

  it('SANDBOX_CRONS has three entries matching vercel.json sandbox schedules', () => {
    expect(SANDBOX_CRONS).toHaveLength(3);
    const schedules = SANDBOX_CRONS.map((c) => c.schedule);
    expect(schedules).toContain('0 * * * *');
    expect(schedules).toContain('0 3 * * *');
    expect(schedules).toContain('30 1 * * *');
  });
});

// ── formatCountdown ──────────────────────────────────────────────────────────

describe('formatCountdown', () => {
  it('formats 1 hour as 01:00:00', () => {
    expect(formatCountdown(60 * 60 * 1000)).toBe('01:00:00');
  });

  it('formats 90 minutes as 01:30:00', () => {
    expect(formatCountdown(90 * 60 * 1000)).toBe('01:30:00');
  });

  it('formats zero or negative as 00:00:00', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(-500)).toBe('00:00:00');
  });

  it('pads single-digit values', () => {
    expect(formatCountdown(61 * 1000)).toBe('00:01:01');
  });
});
