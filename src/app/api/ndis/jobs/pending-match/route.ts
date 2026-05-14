import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

// GET /api/ndis/jobs/pending-match
// Returns confirmed/pending orders that are available for NDIS participant matching.
// Admin-only.
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (client as any)
    .from('profiles')
    .select('role')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get confirmed/pending orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders, error } = await (client as any)
    .from('orders')
    .select('id, customer_name, service_type, context, scheduled_date, scheduled_time, final_price, estimated_duration_minutes, status')
    .in('status', ['confirmed', 'pending', 'scheduled'])
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!orders || orders.length === 0) {
    return NextResponse.json({ jobs: [] });
  }

  const orderIds = orders.map((o: { id: string }) => o.id);

  // Load job_requirements for these orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reqs } = await (client as any)
    .from('job_requirements')
    .select('order_id, ndis_matching_enabled, required_support_mode, physical_intensity, location_suburb')
    .in('order_id', orderIds);

  const reqMap: Record<string, Record<string, unknown>> = {};
  for (const r of reqs ?? []) reqMap[r.order_id] = r;

  // Count publications per order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pubs } = await (client as any)
    .from('job_publications')
    .select('order_id')
    .in('order_id', orderIds)
    .in('status', ['published', 'accepted']);

  const pubCount: Record<string, number> = {};
  for (const p of pubs ?? []) {
    pubCount[p.order_id] = (pubCount[p.order_id] ?? 0) + 1;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobs = (orders as any[]).map((o) => ({
    ...o,
    requirements: reqMap[o.id] ?? null,
    publication_count: pubCount[o.id] ?? 0,
  }));

  return NextResponse.json({ jobs });
}
