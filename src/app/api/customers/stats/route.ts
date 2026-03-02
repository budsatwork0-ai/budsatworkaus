import { NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role === 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  const { count: totalCustomers } = await db
    .from('customers')
    .select('*', { count: 'exact', head: true });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: monthlyOrders } = await db
    .from('orders')
    .select('customer_id')
    .gte('created_at', startOfMonth.toISOString())
    .not('customer_id', 'is', null);

  const uniqueCustomers = new Set(monthlyOrders?.map((o: { customer_id: string }) => o.customer_id) || []);

  const { data: completedOrders } = await db
    .from('orders')
    .select('final_price')
    .eq('status', 'completed');

  const totalRevenue = completedOrders?.reduce((sum: number, o: { final_price: number }) => sum + o.final_price, 0) || 0;
  const avgOrderValue = completedOrders && completedOrders.length > 0
    ? totalRevenue / completedOrders.length
    : 0;

  return NextResponse.json({
    totalCustomers: totalCustomers || 0,
    activeThisMonth: uniqueCustomers.size,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
  });
}
