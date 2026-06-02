/**
 * Mission Control Overview v2 — operator view model
 *
 * Derives an operator-focused projection from the existing Bud data without
 * inventing new domain state. Every field here maps to a real signal already
 * flowing into the page (commandState, queue items, repair sessions, etc.).
 *
 * Design rules:
 *  - Operator first. Translate telemetry into impact statements.
 *  - One global truth state (Healthy / Degraded / Blocked / Recovering).
 *  - Hide gates/stages until they are active.
 *  - Confidence ties to evidence. No deployment state without deployment proof.
 *  - No AI-theatre vocabulary ("quorum", "constitution", "surgical", etc.).
 */
import type { MissionControlHealth } from './health';

/* ────────────────────────────────────────────────────────────────────────── */
/*                              GLOBAL TRUTH STATE                            */
/* ────────────────────────────────────────────────────────────────────────── */

export type GlobalTruthState = 'healthy' | 'degraded' | 'approval' | 'blocked' | 'recovering';

export type GlobalTruth = {
  state: GlobalTruthState;
  headline: string;
  detail: string;
  /** Single integer 0-100 representing platform health. Derived, not invented. */
  index: number;
};

export function deriveGlobalTruth(commandState: MissionControlHealth): GlobalTruth {
  const c = commandState.counts;
  const hardBlocked = commandState.deployment.status === 'failed' || c.broken_agents > 0;
  const awaitingDecision =
    !hardBlocked &&
    (c.blocked_repairs > 0 ||
      c.pending_approvals > 0 ||
      commandState.repair_sessions.some((s) => s.phase === 'awaiting_approval' || s.phase === 'blocked'));
  const recovering =
    commandState.global_status === 'repairing' ||
    commandState.operating_mode === 'repairing' ||
    commandState.operating_mode === 'verifying' ||
    commandState.repair_sessions.some((s) =>
      ['repairing', 'patching', 'validating', 'verifying', 'deploying', 'monitoring'].includes(s.phase),
    );
  const degraded =
    c.failed_runs > 0 ||
    c.broken_agents > 0 ||
    c.needs_repair_agents > 0 ||
    c.watch_agents > 0 ||
    c.parse_failures > 0 ||
    c.unresolved_alerts > 0 ||
    c.low_success_rate_agents > 0 ||
    c.pending_approvals > 0;

  let state: GlobalTruthState;
  if (hardBlocked) state = 'blocked';
  else if (recovering) state = 'recovering';
  else if (awaitingDecision) state = 'approval';
  else if (degraded) state = 'degraded';
  else state = 'healthy';

  const deductions =
    c.broken_agents * 12 +
    c.needs_repair_agents * 7 +
    c.failed_runs * 3 +
    c.parse_failures * 4 +
    c.watch_agents * 2 +
    c.pending_approvals * 1 +
    c.unresolved_alerts * 2 +
    c.blocked_repairs * 15;
  const index = Math.max(0, Math.min(100, 100 - deductions));

  const headline = ({
    healthy: 'Healthy',
    degraded: 'Degraded',
    approval: 'Awaiting decision',
    blocked: 'Blocked',
    recovering: 'Recovering',
  } as const)[state];

  const detail =
    state === 'healthy'
      ? 'No active incidents. Platform is operating within expected envelopes.'
      : state === 'blocked'
        ? buildBlockedDetail(commandState)
        : state === 'approval'
          ? buildApprovalDetail(commandState)
          : state === 'recovering'
            ? buildRecoveringDetail(commandState)
            : buildDegradedDetail(commandState);

  return { state, headline, detail, index };
}

function buildDegradedDetail(c: MissionControlHealth): string {
  const parts: string[] = [];
  if (c.counts.broken_agents > 0) parts.push(`${c.counts.broken_agents} broken capabilit${c.counts.broken_agents === 1 ? 'y' : 'ies'}`);
  if (c.counts.failed_runs > 0) parts.push(`${c.counts.failed_runs} failed run${c.counts.failed_runs === 1 ? '' : 's'}`);
  if (c.counts.pending_approvals > 0) parts.push(`${c.counts.pending_approvals} awaiting decision`);
  if (parts.length === 0) parts.push('minor watch signals');
  return `${parts.join(' · ')}. No customer-facing outage detected.`;
}

function buildRecoveringDetail(c: MissionControlHealth): string {
  const active = c.repair_sessions.filter((s) =>
    ['repairing', 'patching', 'validating', 'verifying', 'deploying'].includes(s.phase),
  ).length;
  if (active === 0) return 'A repair pipeline is in flight.';
  return `${active} repair${active === 1 ? '' : 's'} in flight. Holding deployment status until verification passes.`;
}

function buildBlockedDetail(c: MissionControlHealth): string {
  if (c.deployment.status === 'failed') return 'Last deployment failed. Verification gates are holding new releases.';
  if (c.counts.broken_agents > 0) return `${c.counts.broken_agents} agent${c.counts.broken_agents === 1 ? '' : 's'} halted. Treat as operationally blocked.`;
  return 'A hard operational gate is preventing forward progress.';
}

function buildApprovalDetail(c: MissionControlHealth): string {
  const waiting = c.counts.blocked_repairs + c.approvals.total_pending;
  if (waiting > 0) return `${waiting} item${waiting === 1 ? '' : 's'} awaiting operator approval. Platform remains operational.`;
  return 'Repair is pending an operator decision.';
}
