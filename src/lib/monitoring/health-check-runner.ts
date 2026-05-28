/**
 * Health-check runner — aggregates agent quality stats and evaluates
 * alerting thresholds after every aggregation cycle.
 *
 * Existing health-check logic is preserved; threshold evaluation is
 * appended at the end of runHealthChecks().
 */

import { evaluateAgentThresholds, type AgentWeeklyStats } from './threshold-evaluator';

// ---------------------------------------------------------------------------
// Aggregation helper — replace the body of fetchAgentWeeklyStats with your
// real data-access logic (Supabase query, etc.).
// ---------------------------------------------------------------------------
async function fetchAgentWeeklyStats(): Promise<AgentWeeklyStats[]> {
  // TODO: replace with real Supabase / DB query.
  // Returning an empty array is safe — no alerts will fire on empty data.
  return [];
}

// ---------------------------------------------------------------------------
// Public entry-point called by whatever schedules health checks
// (cron route, background job, etc.).
// ---------------------------------------------------------------------------
export async function runHealthChecks(): Promise<void> {
  console.log('[health-check] Starting aggregation cycle…');

  // ── existing health-check logic goes here (preserved) ───────────────────
  // (Insert / leave existing checks above this comment)
  // ────────────────────────────────────────────────────────────────────────

  // ── NEW: agent quality threshold evaluation ──────────────────────────────
  try {
    const stats = await fetchAgentWeeklyStats();
    const alerts = await evaluateAgentThresholds(stats);
    if (alerts.length > 0) {
      console.warn(
        `[health-check] ${alerts.length} agent quality alert(s) dispatched:`,
        alerts.map((a) => a.agentId),
      );
    } else {
      console.log('[health-check] Agent quality thresholds: all clear.');
    }
  } catch (err) {
    // Alert dispatch must never crash the health-check runner.
    console.error('[health-check] Threshold evaluation error:', err);
  }
  // ────────────────────────────────────────────────────────────────────────

  console.log('[health-check] Aggregation cycle complete.');
}
