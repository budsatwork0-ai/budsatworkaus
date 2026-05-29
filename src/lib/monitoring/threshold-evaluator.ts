import { dispatchAlert, type AgentAlert } from './alerting-config';

export interface ErrorRecord {
  agentId: string;
  occurredAt: Date;
}

export interface ThresholdConfig {
  /** Errors per rolling window before an alert fires. Default: 5. */
  maxErrorsPerWindow?: number;
  /** Rolling window in minutes. Default: 60. */
  windowMinutes?: number;
}

/**
 * Evaluates per-agent error counts within a rolling time window and dispatches
 * an alert for any agent that breaches the configured threshold.
 *
 * @param records   Flat list of error records from the monitoring store.
 * @param config    Optional threshold overrides.
 * @returns         The set of agentIds that triggered alerts.
 */
export async function evaluateThresholds(
  records: ErrorRecord[],
  config: ThresholdConfig = {},
): Promise<Set<string>> {
  const maxErrors = config.maxErrorsPerWindow ?? 5;
  const windowMinutes = config.windowMinutes ?? 60;
  const windowMs = windowMinutes * 60 * 1000;
  const now = Date.now();
  const cutoff = now - windowMs;

  // Count errors per agent within the rolling window
  const countByAgent = new Map<string, number>();
  for (const record of records) {
    if (record.occurredAt.getTime() >= cutoff) {
      countByAgent.set(record.agentId, (countByAgent.get(record.agentId) ?? 0) + 1);
    }
  }

  const alerted = new Set<string>();
  const firedAt = new Date(now).toISOString();

  const dispatches: Promise<void>[] = [];

  for (const [agentId, errorCount] of countByAgent.entries()) {
    if (errorCount >= maxErrors) {
      const alert: AgentAlert = {
        agentId,
        errorCount,
        windowMinutes,
        threshold: maxErrors,
        firedAt,
      };
      alerted.add(agentId);
      dispatches.push(dispatchAlert(alert));
    }
  }

  await Promise.all(dispatches);
  return alerted;
}
