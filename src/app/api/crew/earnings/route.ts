import { NextResponse } from 'next/server';
import { createAuthServerClient } from '@/lib/supabase/server-client';

export async function GET() {
  const supabase = await createAuthServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: employee } = await db
    .from('employees')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!employee) {
    return NextResponse.json({ thisWeek: 0, thisFortnight: 0, thisMonth: 0, allTime: 0, jobs: [] });
  }

  const { data: assignments, error: assignError } = await db
    .from('job_assignments')
    .select('id, order_id, status, completed_at, created_at')
    .eq('employee_id', employee.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (assignError) {
    return NextResponse.json({ error: assignError.message }, { status: 500 });
  }

  const orderIds = (assignments || []).map((a: { order_id: string }) => a.order_id);
  let orders: Record<string, { service_type: string; customer_name: string; final_price: number; scheduled_date: string | null }> = {};

  if (orderIds.length > 0) {
    const { data: orderData } = await db
      .from('orders')
      .select('id, service_type, customer_name, final_price, scheduled_date')
      .in('id', orderIds);

    if (orderData) {
      orders = Object.fromEntries(orderData.map((o: { id: string; service_type: string; customer_name: string; final_price: number; scheduled_date: string | null }) => [o.id, o]));
    }
  }

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfFortnight = new Date(startOfWeek);
  startOfFortnight.setDate(startOfFortnight.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let thisWeek = 0, thisFortnight = 0, thisMonth = 0, allTime = 0;

  const jobs = (assignments || []).map((a: { id: string; order_id: string; completed_at: string | null }) => {
    const order = orders[a.order_id];
    const amount = order?.final_price || 0;
    const completedDate = a.completed_at ? new Date(a.completed_at) : null;

    allTime += amount;
    if (completedDate && completedDate >= startOfMonth) thisMonth += amount;
    if (completedDate && completedDate >= startOfFortnight) thisFortnight += amount;
    if (completedDate && completedDate >= startOfWeek) thisWeek += amount;

    return {
      id: a.id,
      orderId: a.order_id,
      serviceType: order?.service_type || 'unknown',
      customerName: order?.customer_name?.split(' ')[0] || 'Customer',
      amount,
      completedAt: a.completed_at,
      scheduledDate: order?.scheduled_date,
    };
  });

  return NextResponse.json({
    thisWeek: Math.round(thisWeek * 100) / 100,
    thisFortnight: Math.round(thisFortnight * 100) / 100,
    thisMonth: Math.round(thisMonth * 100) / 100,
    allTime: Math.round(allTime * 100) / 100,
    jobs,
  });
}
