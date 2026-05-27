/**
 * Persistent Thought Stream
 *
 * Synthesize a live "Bud Thinking" stream from existing telemetry so that
 * the operator sees continuous operational awareness instead of static
 * logs. Never invents thoughts - every entry has to map to a real signal.
 */
import type { MissionControlHealth } from './health';
import type { BudActivityEvent } from './types';
import type { StructuredFailure } from './structured-failure';
import type { BudInitiative } from './initiatives';

export type BudThought = {
  id: string;
  at: string;
  state: 'observing' | 'thinking' | 'investigating' | 'planning' | 'delegating' | 'repairing' | 'redesigning' | 'deploying' | 'verifying' | 'learning' | 'waiting' | 'blocked';
  narrative: string;
  source: 'activity' | 'health' | 'failure' | 'initiative' | 'deployment' | 'approval';
  source_id: string;
};

function pickState(eventType: string): BudThought['state'] {
  if (eventType === 'investigation') return 'investigating';
  if (eventType === 'repair') return 'repairing';
  if (eventType === 'deployment') return 'deploying';
  if (eventType === 'learning') return 'learning';
  if (eventType === 'approval') return 'waiting';
  if (eventType === 'delegation') return 'delegating';
  if (eventType === 'detection') return 'observing';
  if (eventType === 'completion') return 'verifying';
  if (eventType === 'error') return 'blocked';
  return 'thinking';
}

export function buildThoughtStream(args: {
  commandState: MissionControlHealth;
  activity: BudActivityEvent[];
  failures: StructuredFailure[];
  initiatives: BudInitiative[];
  limit?: number;
}): BudThought[] {
  const thoughts: BudThought[] = [];

  for (const event of args.activity) {
    thoughts.push({
      id: `act-${event.id}`,
      at: event.created_at,
      state: pickState(event.event_type),
      narrative: event.narrative,
      source: 'activity',
      source_id: event.id,
    });
  }

  for (const session of args.commandState.repair_sessions.slice(0, 5)) {
    if (session.phase === 'awaiting_approval') {
      thoughts.push({
        id: `repair-${session.id}-await`,
        at: session.created_at,
        state: 'waiting',
        narrative: `Holding on ${session.agent_name} - waiting for human approval before continuing.`,
        source: 'approval',
        source_id: session.id,
      });
    } else if (['patching', 'repairing'].includes(session.phase)) {
      thoughts.push({
        id: `repair-${session.id}-patch`,
        at: session.created_at,
        state: 'repairing',
        narrative: `Drafting a patch for ${session.agent_name}: ${session.description}.`,
        source: 'activity',
        source_id: session.id,
      });
    } else if (['validating', 'verifying'].includes(session.phase)) {
      thoughts.push({
        id: `repair-${session.id}-verify`,
        at: session.created_at,
        state: 'verifying',
        narrative: `Verifying the ${session.agent_name} fix held under live traffic.`,
        source: 'activity',
        source_id: session.id,
      });
    } else if (session.phase === 'planning') {
      thoughts.push({
        id: `repair-${session.id}-plan`,
        at: session.created_at,
        state: 'planning',
        narrative: `Planning the repair path for ${session.agent_name}.`,
        source: 'activity',
        source_id: session.id,
      });
    }
  }

  for (const failure of args.failures.slice(0, 4)) {
    thoughts.push({
      id: `failure-${failure.runId}`,
      at: failure.createdAt,
      state: 'investigating',
      narrative: `Investigating ${failure.agentName} ${failure.errorType.replaceAll('_', ' ').toLowerCase()} - ${failure.suspectedCause}`,
      source: 'failure',
      source_id: failure.runId,
    });
  }

  for (const initiative of args.initiatives.slice(0, 3)) {
    if (initiative.status === 'in_progress') {
      thoughts.push({
        id: `init-${initiative.id}`,
        at: new Date().toISOString(),
        state: 'planning',
        narrative: `Working initiative: ${initiative.title}. ${initiative.why}`,
        source: 'initiative',
        source_id: initiative.id,
      });
    } else if (initiative.status === 'blocked') {
      thoughts.push({
        id: `init-blocked-${initiative.id}`,
        at: new Date().toISOString(),
        state: 'blocked',
        narrative: `Initiative blocked: ${initiative.title}. ${initiative.signals[0] ?? initiative.why}`,
        source: 'initiative',
        source_id: initiative.id,
      });
    }
  }

  if (args.commandState.deployment.status === 'deploying') {
    thoughts.push({
      id: 'dep-active',
      at: args.commandState.deployment.last_event_at ?? new Date().toISOString(),
      state: 'deploying',
      narrative: 'Deployment in flight. Verification gates engaged.',
      source: 'deployment',
      source_id: 'current',
    });
  }
  if (args.commandState.deployment.status === 'failed') {
    thoughts.push({
      id: 'dep-failed',
      at: args.commandState.deployment.last_event_at ?? new Date().toISOString(),
      state: 'blocked',
      narrative: 'Deployment failed. Not declaring any repair successful until verification recovers.',
      source: 'deployment',
      source_id: 'failed',
    });
  }

  if (args.commandState.is_nominal) {
    thoughts.push({
      id: 'observing-watch',
      at: new Date().toISOString(),
      state: 'observing',
      narrative: 'Workforce nominal. Watching for new patterns and friction.',
      source: 'health',
      source_id: 'nominal',
    });
  }

  thoughts.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // Deduplicate by narrative — after sorting newest-first, first occurrence is always newest
  const seen = new Set<string>();
  const deduped = thoughts.filter(t => {
    if (seen.has(t.narrative)) return false;
    seen.add(t.narrative);
    return true;
  });

  const limit = args.limit ?? 30;
  return deduped.slice(0, limit);
}
