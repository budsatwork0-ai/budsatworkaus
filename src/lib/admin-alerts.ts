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

export type AlertOrderInput = {
  id: string;
  customer_name: string;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  created_at: string;
  final_price: number;
};

export type AlertPayableInput = {
  id: string;
  vendor_name: string;
  category: string;
  amount: number;
  due_date: string | null;
  status: string;
  created_at: string;
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

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window cleaning',
  cleaning: 'Home/Commercial cleaning',
  yard: 'Yard care',
  dump: 'Dump runs',
  auto: 'Auto detailing',
  laundry_sneakers: 'Laundry & Sneaker care',
};

export function buildAdminAlerts({
  orders,
  payables,
  now = new Date(),
}: {
  orders: AlertOrderInput[];
  payables: AlertPayableInput[];
  now?: Date;
}): AdminAlert[] {
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const allAlerts: AdminAlert[] = [];

  const overdueJobs = orders.filter((order) => {
    if (order.status === 'completed' || order.status === 'cancelled') return false;
    if (!order.scheduled_date) return false;
    return new Date(order.scheduled_date) < now;
  });

  overdueJobs.forEach((order) => {
    const serviceName = SERVICE_LABELS[order.service_type] || order.service_type;
    const daysPast = Math.floor((now.getTime() - new Date(order.scheduled_date!).getTime()) / (1000 * 60 * 60 * 24));
    allAlerts.push({
      id: `overdue-job-${order.id}`,
      title: 'Overdue job',
      message: `${serviceName} for ${order.customer_name} is ${daysPast} day${daysPast !== 1 ? 's' : ''} past the scheduled date. Update status or reschedule.`,
      severity: 'critical',
      source: 'Jobs',
      timestamp: order.scheduled_date!,
      href: '/dashboard/schedule?view=list&scheduleState=scheduled',
    });
  });

  const overduePayables = payables.filter((payable) => {
    if (!payable.due_date) return false;
    return new Date(payable.due_date) < now;
  });

  overduePayables.forEach((payable) => {
    const daysPast = Math.floor((now.getTime() - new Date(payable.due_date!).getTime()) / (1000 * 60 * 60 * 24));
    allAlerts.push({
      id: `overdue-bill-${payable.id}`,
      title: 'Overdue bill',
      message: `${payable.vendor_name} (${payable.category}) — $${payable.amount.toFixed(2)} was due ${daysPast} day${daysPast !== 1 ? 's' : ''} ago.`,
      severity: 'critical',
      source: 'Payables',
      timestamp: payable.due_date!,
      href: '/dashboard/invoices?tab=expenses&status=Overdue',
    });
  });

  const dueSoonPayables = payables.filter((payable) => {
    if (!payable.due_date) return false;
    const due = new Date(payable.due_date);
    return due >= now && due <= sevenDaysFromNow;
  });

  dueSoonPayables.forEach((payable) => {
    const daysUntil = Math.ceil((new Date(payable.due_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    allAlerts.push({
      id: `due-soon-${payable.id}`,
      title: 'Bill due soon',
      message: `${payable.vendor_name} — $${payable.amount.toFixed(2)} due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}.`,
      severity: 'warning',
      source: 'Payables',
      timestamp: payable.created_at,
      href: '/dashboard/invoices?tab=expenses&status=Upcoming',
    });
  });

  const unscheduledOrders = orders.filter(
    (order) => (order.status === 'confirmed' || order.status === 'pending') && !order.scheduled_date
  );

  unscheduledOrders.forEach((order) => {
    const serviceName = SERVICE_LABELS[order.service_type] || order.service_type;
    allAlerts.push({
      id: `unscheduled-${order.id}`,
      title: 'Job needs scheduling',
      message: `${serviceName} for ${order.customer_name} is confirmed but has no scheduled date.`,
      severity: 'warning',
      source: 'Jobs',
      timestamp: order.created_at,
      href: '/dashboard/schedule?view=list&scheduleState=unscheduled',
    });
  });

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  return allAlerts.sort((left, right) => {
    const severityDelta = severityOrder[left.severity] - severityOrder[right.severity];
    if (severityDelta !== 0) return severityDelta;
    return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
  });
}
