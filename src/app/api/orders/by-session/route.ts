import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home/Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Dump Runs',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: order, error } = await (client as any)
      .from('orders')
      .select('id, customer_name, service_type, context, final_price, created_at, status, scheduled_date')
      .eq('stripe_checkout_session_id', sessionId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: order.id,
      customer_name: order.customer_name,
      service_type: order.service_type,
      service_label: SERVICE_LABELS[order.service_type] || order.service_type,
      context: order.context,
      final_price: order.final_price,
      created_at: order.created_at,
      status: order.status,
      scheduled_date: order.scheduled_date,
    });
  } catch (error) {
    console.error('Order by-session lookup error:', error);
    return NextResponse.json({ error: 'Failed to look up order' }, { status: 500 });
  }
}
