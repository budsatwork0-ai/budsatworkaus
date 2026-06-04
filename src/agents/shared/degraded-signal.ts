// ─── Degraded signal ─────────────────────────────────────────────────────────
// Shared type and builder used by all agents to emit a structured degraded
// signal instead of propagating errors to callers.

export interface DegradedSignal {
  type: 'degraded';
  agent: string;
  reason: string;
  occurredAt: string;
  rawInput?: unknown;
}

export function buildDegradedSignal(params: {
  agent: string;
  reason: string;
  rawInput?: unknown;
}): DegradedSignal {
  return {
    type: 'degraded',
    agent: params.agent,
    reason: params.reason,
    occurredAt: new Date().toISOString(),
    rawInput: params.rawInput,
  };
}
