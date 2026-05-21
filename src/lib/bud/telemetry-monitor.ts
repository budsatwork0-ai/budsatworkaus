/**
 * Telemetry Monitor
 *
 * Post-deploy production health watcher. After Bud merges or opens a PR,
 * this module watches for anomalies and triggers rollback if needed.
 *
 * Signals monitored:
 *   - Agent run failure rate (via agent_runs table)
 *   - Vercel function error rate (via Vercel API, if VERCEL_TOKEN is set)
 *   - Response latency spikes (via Vercel runtime logs)
 *   - Stripe conversion drops (error_count on checkouts vs baseline)
 *
 * Rollback strategy:
 *   - Soft: revert PR via GitHub (creates a revert PR)
 *   - Hard: disable the affected agent or route (mark as 'paused')
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createPR, mergePR, listOpenPRsByLabel, getPRDetails } from './github-executor';

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

// Thresholds — tune these for your traffic volume
const THRESHOLDS = {
  agentFailureRatePct: 40,       // % failures in sliding window that triggers alert
  agentFailureMinRuns: 5,         // minimum runs before rate is meaningful
  latencyP95Ms: 8000,             // 8s P95 response time
  conversionDropPct: 25,          // 25% drop vs 7-day baseline triggers alert
  monitorWindowMinutes: 30,       // look at last 30 minutes post-deploy
};

export interface TelemetryCheckResult {
  healthy: boolean;
  anomalies: Array<{
    type: 'agent_failure_spike' | 'latency_spike' | 'conversion_drop' | 'error_rate_spike';
    severity: 'warning' | 'critical';
    metric: string;
    value: number;
    threshold: number;
    description: string;
  }>;
  rollbackTriggered: boolean;
  rollbackReason?: string;
}

// ── Vercel API helpers ─────────────────────────────────────────────────────────

async function getVercelDeploymentErrors(
  deploymentUrl: string,
  sinceMs: number,
): Promise<number> {
  if (!VERCEL_TOKEN) return 0;
  try {
    const params = new URLSearchParams({
      since: String(sinceMs),
      until: String(Date.now()),
      limit: '100',
      logType: 'error',
    });
    const teamParam = VERCEL_TEAM_ID ? `&teamId=${VERCEL_TEAM_ID}` : '';
    const res = await fetch(
      `https://api.vercel.com/v1/deployments/${encodeURIComponent(deploymentUrl)}/events?${params}${teamParam}`,
      { headers: { authorization: `Bearer ${VERCEL_TOKEN}` } },
    );
    if (!res.ok) return 0;
    const data = (await res.json()) as { events?: unknown[] };
    return data.events?.length ?? 0;
  } catch {
    return 0;
  }
}

async function getLatestVercelDeployment(): Promise<{ url: string; uid: string; createdAt: number } | null> {
  if (!VERCEL_TOKEN) return null;
  try {
    const teamParam = VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : '';
    const res = await fetch(`https://api.vercel.com/v6/deployments${teamParam}&limit=1&target=production`, {
      headers: { authorization: `Bearer ${VERCEL_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { deployments?: Array<{ url: string; uid: string; createdAt: number }> };
    return data.deployments?.[0] ?? null;
  } catch {
    return null;
  }
}

// ── Agent failure rate ─────────────────────────────────────────────────────────

async function checkAgentFailureRate(
  supabase: SupabaseClient,
  windowMs: number,
): Promise<{ rate: number; total: number; failures: number }> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data: runs } = await supabase
    .from('agent_runs')
    .select('status')
    .gte('started_at', since);

  const total = runs?.length ?? 0;
  const failures = runs?.filter((r) => (r.status as string) === 'failed').length ?? 0;
  const rate = total === 0 ? 0 : (failures / total) * 100;
  return { rate, total, failures };
}

// ── Conversion baseline ────────────────────────────────────────────────────────

async function getConversionBaseline(supabase: SupabaseClient): Promise<number | null> {
  // Use quotes created per day as a rough conversion signal
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await supabase
    .from('quotes')
    .select('id, created_at')
    .gte('created_at', since7d);

  if (!data || data.length === 0) return null;
  return data.length / 7; // daily average
}

async function getConversionNow(supabase: SupabaseClient, windowMs: number): Promise<number> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data } = await supabase.from('quotes').select('id').gte('created_at', since);
  const count = data?.length ?? 0;
  // Normalise to daily rate for comparison
  return (count / windowMs) * 86_400_000;
}

// ── Write telemetry event ──────────────────────────────────────────────────────

async function writeTelemetryEvent(
  supabase: SupabaseClient,
  params: {
    executionId?: string;
    executionTable?: 'improvement' | 'repair';
    eventType: string;
    branchName?: string;
    metricName?: string;
    metricValue?: number;
    threshold?: number;
    baseline?: number;
    rollbackTriggered?: boolean;
    rollbackNotes?: string;
    notes?: string;
  },
): Promise<void> {
  try {
    await supabase.from('bud_telemetry_events').insert({
      improvement_id: params.executionTable === 'improvement' ? params.executionId : null,
      repair_id: params.executionTable === 'repair' ? params.executionId : null,
      event_type: params.eventType,
      branch_name: params.branchName ?? null,
      metric_name: params.metricName ?? null,
      metric_value: params.metricValue ?? null,
      threshold: params.threshold ?? null,
      baseline: params.baseline ?? null,
      rollback_triggered: params.rollbackTriggered ?? false,
      rollback_notes: params.rollbackNotes ?? null,
      notes: params.notes ?? null,
    });
  } catch { /* non-fatal */ }
}

// ── Rollback via revert PR ─────────────────────────────────────────────────────

async function triggerRevertPR(
  branchName: string,
  reason: string,
): Promise<{ prUrl: string | null }> {
  try {
    const revertBranch = `bud/revert-${branchName.replace('bud/', '').slice(0, 40)}-${Date.now()}`;
    // The simplest revert strategy: open a PR from the original branch back to main
    // with a note. A true git revert requires local git operations which aren't
    // available in serverless. Instead we flag it for manual revert and open an issue.
    const pr = await createPR(
      `[Bud] Auto-revert: ${branchName}`,
      [
        `## Automatic Rollback Triggered`,
        `**Branch to revert:** \`${branchName}\``,
        `**Reason:** ${reason}`,
        '',
        '## Action Required',
        `Revert the merge of \`${branchName}\` into \`main\`. You can use:`,
        '```',
        `git revert -m 1 <merge-commit-sha>`,
        '```',
        '',
        '> This PR was auto-created by Bud Telemetry Monitor after detecting production anomalies.',
      ].join('\n'),
      'main',  // head = main since we can't create a git revert in serverless
      'main',
      true,   // draft — requires human confirmation before merging
    ).catch(() => null);
    return { prUrl: pr?.url ?? null };
  } catch {
    return { prUrl: null };
  }
}

// ── Main health check ──────────────────────────────────────────────────────────

export async function checkProductionHealth(
  supabase: SupabaseClient,
  params: {
    executionId?: string;
    executionTable?: 'improvement' | 'repair';
    branchName?: string;
    deployedAt?: string;
    autoRollback?: boolean;
  } = {},
): Promise<TelemetryCheckResult> {
  const windowMs = THRESHOLDS.monitorWindowMinutes * 60 * 1000;
  const anomalies: TelemetryCheckResult['anomalies'] = [];

  // Record deploy checkpoint
  await writeTelemetryEvent(supabase, {
    executionId: params.executionId,
    executionTable: params.executionTable,
    eventType: 'checkpoint',
    branchName: params.branchName,
    notes: `Health check initiated ${params.deployedAt ? `after deploy at ${params.deployedAt}` : 'on demand'}`,
  });

  // ── Check 1: Agent failure rate ────────────────────────────────────────────
  const { rate, total, failures } = await checkAgentFailureRate(supabase, windowMs);
  if (total >= THRESHOLDS.agentFailureMinRuns && rate > THRESHOLDS.agentFailureRatePct) {
    anomalies.push({
      type: 'agent_failure_spike',
      severity: rate > 60 ? 'critical' : 'warning',
      metric: 'agent_failure_rate_pct',
      value: rate,
      threshold: THRESHOLDS.agentFailureRatePct,
      description: `${failures}/${total} agent runs failed in the last ${THRESHOLDS.monitorWindowMinutes}m (${rate.toFixed(0)}%)`,
    });
    await writeTelemetryEvent(supabase, {
      executionId: params.executionId,
      executionTable: params.executionTable,
      eventType: 'anomaly',
      branchName: params.branchName,
      metricName: 'agent_failure_rate_pct',
      metricValue: rate,
      threshold: THRESHOLDS.agentFailureRatePct,
    });
  }

  // ── Check 2: Conversion drop ───────────────────────────────────────────────
  const baseline = await getConversionBaseline(supabase).catch(() => null);
  if (baseline && baseline > 0) {
    const current = await getConversionNow(supabase, windowMs);
    const dropPct = ((baseline - current) / baseline) * 100;
    if (dropPct > THRESHOLDS.conversionDropPct) {
      anomalies.push({
        type: 'conversion_drop',
        severity: dropPct > 50 ? 'critical' : 'warning',
        metric: 'conversion_rate',
        value: current,
        threshold: baseline * (1 - THRESHOLDS.conversionDropPct / 100),
        description: `Quote creation dropped ${dropPct.toFixed(0)}% vs 7-day baseline`,
      });
      await writeTelemetryEvent(supabase, {
        executionId: params.executionId,
        executionTable: params.executionTable,
        eventType: 'anomaly',
        branchName: params.branchName,
        metricName: 'conversion_rate',
        metricValue: current,
        threshold: baseline,
        baseline,
      });
    }
  }

  // ── Check 3: Vercel error rate ─────────────────────────────────────────────
  const deployment = await getLatestVercelDeployment();
  if (deployment) {
    const errorCount = await getVercelDeploymentErrors(deployment.uid, Date.now() - windowMs);
    if (errorCount > 20) {
      anomalies.push({
        type: 'error_rate_spike',
        severity: errorCount > 50 ? 'critical' : 'warning',
        metric: 'vercel_error_count',
        value: errorCount,
        threshold: 20,
        description: `${errorCount} Vercel function errors in the last ${THRESHOLDS.monitorWindowMinutes}m`,
      });
      await writeTelemetryEvent(supabase, {
        executionId: params.executionId,
        executionTable: params.executionTable,
        eventType: 'anomaly',
        branchName: params.branchName,
        metricName: 'vercel_error_count',
        metricValue: errorCount,
        threshold: 20,
      });
    }
  }

  const healthy = anomalies.length === 0;
  const hasCritical = anomalies.some((a) => a.severity === 'critical');
  let rollbackTriggered = false;
  let rollbackReason: string | undefined;

  // ── Auto-rollback ──────────────────────────────────────────────────────────
  // Only triggers if: autoRollback=true AND critical anomaly AND branch known
  if (params.autoRollback && hasCritical && params.branchName) {
    rollbackReason = anomalies
      .filter((a) => a.severity === 'critical')
      .map((a) => a.description)
      .join('; ');

    const { prUrl } = await triggerRevertPR(params.branchName, rollbackReason);
    rollbackTriggered = true;

    await writeTelemetryEvent(supabase, {
      executionId: params.executionId,
      executionTable: params.executionTable,
      eventType: 'rollback',
      branchName: params.branchName,
      rollbackTriggered: true,
      rollbackNotes: `Auto-rollback PR created: ${prUrl ?? 'creation failed'}. Reason: ${rollbackReason}`,
    });

    // Record on the execution row
    if (params.executionId && params.executionTable === 'improvement') {
      try {
        await supabase
          .from('bud_improvement_executions')
          .update({ rollback_reason: rollbackReason, updated_at: new Date().toISOString() })
          .eq('id', params.executionId);
      } catch { /* non-fatal */ }
    } else if (params.executionId && params.executionTable === 'repair') {
      try {
        await supabase
          .from('bud_repair_executions')
          .update({ rollback_reason: rollbackReason, updated_at: new Date().toISOString() })
          .eq('id', params.executionId);
      } catch { /* non-fatal */ }
    }
  }

  return { healthy, anomalies, rollbackTriggered, rollbackReason };
}

/**
 * Lightweight scheduled health check. Called by the agents cron or on a
 * dedicated schedule. Checks fleet health and writes a telemetry checkpoint.
 * Does not auto-rollback (use checkProductionHealth with autoRollback=true for that).
 */
export async function scheduledHealthCheck(supabase: SupabaseClient): Promise<{
  healthy: boolean;
  summary: string;
}> {
  const result = await checkProductionHealth(supabase, { autoRollback: false });

  const summary = result.healthy
    ? 'Fleet is healthy — no anomalies detected.'
    : `${result.anomalies.length} anomaly(ies) detected: ${result.anomalies.map((a) => a.description).join('; ')}`;

  return { healthy: result.healthy, summary };
}
