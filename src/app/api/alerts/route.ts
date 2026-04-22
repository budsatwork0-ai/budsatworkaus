import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import {
  ADMIN_ALERT_STATE_KEY,
  DEFAULT_ADMIN_ALERT_STATE,
  buildAdminAlerts,
  dismissAlertIds,
  getAdminAlertState,
} from '@/lib/admin-alerts';
import { createServiceClientSafe } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
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

    const allAlerts = buildAdminAlerts({ orders, payables });

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
