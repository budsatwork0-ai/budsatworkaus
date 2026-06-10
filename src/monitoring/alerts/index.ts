/**
 * Alert registry — all AlertRule objects registered here are discovered
 * automatically by the evaluation loop.
 *
 * Add new rules by importing them and appending to ALERT_RULES.
 */

import { agentSilentSuccessAlert, type AlertRule } from './agent-silent-success';

export type { AlertRule };

export const ALERT_RULES: AlertRule[] = [
  agentSilentSuccessAlert,
];
