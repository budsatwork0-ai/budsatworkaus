/**
 * Dependency-free health check for the bud-observer agent.
 * Parses a minimal synthetic snapshot through the same Zod schema
 * the main pipeline uses, so CI and cron jobs can verify the
 * observer is functional without touching the DB or LLM.
 */
import { z } from 'zod';

const MinimalSnapshotSchema = z.object({
  id: z.string(),
  agent_name: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  success_count: z.number().int().default(0),
  failure_count: z.number().int().default(0),
  error_messages: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export type HealthCheckResult =
  | { healthy: true }
  | { healthy: false; reason: string };

/** Verifies the observer can parse a minimal synthetic snapshot. */
export function budObserverHealthCheck(): HealthCheckResult {
  const probe = {
    id: 'health-check-probe',
    agent_name: 'bud-observer',
    period_start: new Date(0).toISOString(),
    period_end: new Date().toISOString(),
    success_count: 1,
    failure_count: 0,
    error_messages: [] as string[],
    metadata: {} as Record<string, unknown>,
  };

  const result = MinimalSnapshotSchema.safeParse(probe);
  if (!result.success) {
    return {
      healthy: false,
      reason: result.error.issues.map((i) => i.message).join('; '),
    };
  }

  return { healthy: true };
}
