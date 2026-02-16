import { NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export type Alert = {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  timestamp: string;
  read: boolean;
};

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window cleaning',
  cleaning: 'Home/Commercial cleaning',
  yard: 'Yard care',
  dump: 'Dump runs',
  auto: 'Auto detailing',
  laundry_sneakers: 'Laundry & Sneaker care',
};

export async function GET() {
  const client = createServiceClientSafe();

  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch orders and payables in parallel
    const [ordersResult, payablesResult] = await Promise.all([
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

    const alerts: Alert[] = [];

    // Critical: Overdue jobs (non-completed, scheduled_date in the past)
    const overdueJobs = orders.filter(o => {
      if (o.status === 'completed') return false;
      if (!o.scheduled_date) return false;
      return new Date(o.scheduled_date) < now;
    });
    overdueJobs.forEach(o => {
      const serviceName = SERVICE_LABELS[o.service_type] || o.service_type;
      const daysPast = Math.floor((now.getTime() - new Date(o.scheduled_date!).getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: `overdue-job-${o.id}`,
        title: 'Overdue job',
        message: `${serviceName} for ${o.customer_name} is ${daysPast} day${daysPast !== 1 ? 's' : ''} past the scheduled date. Update status or reschedule.`,
        severity: 'critical',
        source: 'Jobs',
        timestamp: o.scheduled_date!,
        read: false,
      });
    });

    // Critical: Overdue payables (due_date in the past)
    const overduePayables = payables.filter(p => {
      if (!p.due_date) return false;
      return new Date(p.due_date) < now;
    });
    overduePayables.forEach(p => {
      const daysPast = Math.floor((now.getTime() - new Date(p.due_date!).getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: `overdue-bill-${p.id}`,
        title: 'Overdue bill',
        message: `${p.vendor_name} (${p.category}) — $${p.amount.toFixed(2)} was due ${daysPast} day${daysPast !== 1 ? 's' : ''} ago.`,
        severity: 'critical',
        source: 'Payables',
        timestamp: p.due_date!,
        read: false,
      });
    });

    // Warning: Bills due within 7 days
    const dueSoonPayables = payables.filter(p => {
      if (!p.due_date) return false;
      const due = new Date(p.due_date);
      return due >= now && due <= sevenDaysFromNow;
    });
    dueSoonPayables.forEach(p => {
      const daysUntil = Math.ceil((new Date(p.due_date!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      alerts.push({
        id: `due-soon-${p.id}`,
        title: 'Bill due soon',
        message: `${p.vendor_name} — $${p.amount.toFixed(2)} due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}.`,
        severity: 'warning',
        source: 'Payables',
        timestamp: p.created_at,
        read: false,
      });
    });

    // Warning: Confirmed orders with no scheduled date
    const unscheduled = orders.filter(o =>
      (o.status === 'confirmed' || o.status === 'pending') && !o.scheduled_date
    );
    unscheduled.forEach(o => {
      const serviceName = SERVICE_LABELS[o.service_type] || o.service_type;
      alerts.push({
        id: `unscheduled-${o.id}`,
        title: 'Job needs scheduling',
        message: `${serviceName} for ${o.customer_name} is confirmed but has no scheduled date.`,
        severity: 'warning',
        source: 'Jobs',
        timestamp: o.created_at,
        read: false,
      });
    });

    // Info: Recent bookings (last 7 days, confirmed)
    const recentBookings = orders.filter(o => {
      if (o.status !== 'confirmed') return false;
      return new Date(o.created_at) >= sevenDaysAgo;
    });
    recentBookings.forEach(o => {
      const serviceName = SERVICE_LABELS[o.service_type] || o.service_type;
      alerts.push({
        id: `booking-${o.id}`,
        title: 'New booking confirmed',
        message: `${serviceName} for ${o.customer_name} — $${o.final_price.toFixed(2)} received.`,
        severity: 'info',
        source: 'Orders',
        timestamp: o.created_at,
        read: true,
      });
    });

    // Sort: critical first, then warning, then info; within each group newest first
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      const sev = severityOrder[a.severity] - severityOrder[b.severity];
      if (sev !== 0) return sev;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Alerts API error:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}
