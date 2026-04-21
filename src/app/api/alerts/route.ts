import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import {
  ADMIN_ALERT_STATE_KEY,
  DEFAULT_ADMIN_ALERT_STATE,
  dismissAlertIds,
  getAdminAlertState,
  type AdminAlert,
} from '@/lib/admin-alerts';
import { createServiceClientSafe } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window cleaning',
  cleaning: 'Home/Commercial cleaning',
  yard: 'Yard care',
  dump: 'Dump runs',
  auto: 'Auto detailing',
  laundry_sneakers: 'Laundry & Sneaker care',
};

function requireStaff(role: string | undefined) {
  return role === 'admin' || role === 'employee';
}

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!requireStaff(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [ordersResult, payablesResult, alertState] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)
        .from('orders')
        .select('id, customer_name, service_type, status, scheduled_date, created_at, final_price')
        .neq('status', 'cancelled'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)
        .from('payables')
        .select('id, vendor_name, category, amount, due_date, status, created_at')
        .neq('status', 'paid'),
      getAdminAlertState(),
    ]);

    const orders: Array<{
      id: string;
      customer_name: string;
      service_type: string;
      status: string;
      scheduled_date: string | null;
      created_at: string;
      final_price: number;
    }> = ordersResult.data || [];

    const payables: Array<{
      id: string;
      vendor_name: string;
      category: string;
      amount: number;
      due_date: string | null;
      status: string;
      created_at: string;
    }> = payablesResult.data || [];

    const allAlerts: AdminAlert[] = [];

    const overdueJobs = orders.filter((order) => {
      if (order.status === 'completed') return false;
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
        href: '/dashboard/schedule',
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
        href: '/dashboard/invoices',
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
        href: '/dashboard/invoices',
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
        href: '/dashboard/schedule',
      });
    });

    const severityOrder = { critical: 0, warning: 1, info: 2 };
    allAlerts.sort((left, right) => {
      const severityDelta = severityOrder[left.severity] - severityOrder[right.severity];
      if (severityDelta !== 0) return severityDelta;
      return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
    });

    const dismissedSet = new Set(alertState.dismissedIds);
    const alerts = allAlerts.filter((alert) => !dismissedSet.has(alert.id));

    return NextResponse.json({
      alerts,
      dismissedCount: allAlerts.length - alerts.length,
    });
  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!requireStaff(authUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: { action?: 'dismiss' | 'restore_all'; ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const action = body.action;
  if (!action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }

  const currentState = await getAdminAlertState();
  const nextState =
    action === 'restore_all'
      ? DEFAULT_ADMIN_ALERT_STATE
      : dismissAlertIds(currentState, body.ids || []);

  if (action === 'dismiss' && nextState.dismissedIds.length === currentState.dismissedIds.length) {
    return NextResponse.json({ ok: true, state: nextState });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client as any)
    .from('site_settings')
    .upsert(
      [{
        key: ADMIN_ALERT_STATE_KEY,
        value: nextState,
        description: 'Dismissed admin alerts and notification state',
        updated_at: new Date().toISOString(),
        updated_by: authUser.email || authUser.id,
      }],
      { onConflict: 'key' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, state: nextState });
}
