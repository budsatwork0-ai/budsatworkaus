import { getSiteSettingObject } from './site-settings';

export const ADMIN_ALERT_STATE_KEY = 'adminAlertState';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AdminAlert = {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  source: string;
  timestamp: string;
  href?: string;
};

export type AdminAlertState = {
  dismissedIds: string[];
};

export const DEFAULT_ADMIN_ALERT_STATE: AdminAlertState = {
  dismissedIds: [],
};

export function normalizeAdminAlertState(value: unknown): AdminAlertState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_ADMIN_ALERT_STATE;
  }

  const rawDismissedIds = 'dismissedIds' in value ? (value as { dismissedIds?: unknown }).dismissedIds : [];
  const dismissedIds = Array.isArray(rawDismissedIds)
    ? Array.from(new Set(rawDismissedIds.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)))
    : [];

  return { dismissedIds };
}

export async function getAdminAlertState(): Promise<AdminAlertState> {
  const state = await getSiteSettingObject(ADMIN_ALERT_STATE_KEY, DEFAULT_ADMIN_ALERT_STATE);
  return normalizeAdminAlertState(state);
}

export function dismissAlertIds(state: AdminAlertState, ids: string[]): AdminAlertState {
  return {
    dismissedIds: Array.from(new Set([...state.dismissedIds, ...ids.filter(Boolean)])),
  };
}
