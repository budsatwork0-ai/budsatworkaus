import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

type Params = { params: Promise<{ orderId: string }> };

async function requireAdmin(authUser: { id: string } | null, client: ReturnType<typeof createServiceClientSafe>) {
  if (!authUser) return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (client as any)
    .from('profiles')
    .select('role')
    .eq('id', authUser.id)
    .maybeSingle();
  return data?.role === 'admin';
}

// GET /api/ndis/jobs/[orderId]/requirements
export async function GET(_req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  if (!await requireAdmin(authUser, client)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (client as any)
    .from('orders')
    .select('id, customer_name, service_type, context, scheduled_date, scheduled_time, estimated_duration_minutes, status, notes, final_price')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: requirements } = await (client as any)
    .from('job_requirements')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();

  return NextResponse.json({ order, requirements: requirements ?? null });
}

// POST /api/ndis/jobs/[orderId]/requirements — upsert job requirements
export async function POST(req: NextRequest, { params }: Params) {
  const { orderId } = await params;
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  if (!await requireAdmin(authUser, client)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (client as any)
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const allowed = [
    'estimated_duration_minutes', 'required_support_mode', 'physical_intensity',
    'transport_required', 'customer_facing_required', 'service_type',
    'location_suburb', 'location_lat', 'location_lng',
    'start_time', 'end_time', 'can_split_shift', 'requires_team',
    'risk_notes', 'ndis_matching_enabled',
  ];

  const payload: Record<string, unknown> = { order_id: orderId };
  for (const key of allowed) {
    if (key in body) payload[key] = body[key];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('job_requirements')
    .upsert(payload, { onConflict: 'order_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ requirements: data });
}
