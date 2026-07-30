/**
 * Central registry of all alert rules.
 *
 * The alert evaluation loop should import `alertRules` and iterate over
 * every entry, evaluating each rule against the metrics store on its
 * configured window and firing notifications when thresholds are breached.
 */

import { agentSilentSuccessAlert, type AlertRule } from './agent-silent-success';

export type { AlertRule };

/**
 * All registered alert rules.  Add new rules here so the evaluation loop
 * picks them up automatically.
 */
export const alertRules: AlertRule[] = [
  agentSilentSuccessAlert,
];

export { agentSilentSuccessAlert };
