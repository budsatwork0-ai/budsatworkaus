import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import type { CreateOrderInput, OrderStatus, ServiceType } from '@/types/orders';
import { getAuthUser } from '@/lib/auth';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

// 30 order creations per IP per 15 minutes (admin/employee only).
const checkOrderPostLimit = createRateLimiter({ limit: 30, windowMs: 15 * 60 * 1000 });

// GET /api/orders - List orders with optional filters
export async function GET(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as OrderStatus | 'all' | null;
  const serviceType = searchParams.get('service_type') as ServiceType | 'all' | null;
  const search = searchParams.get('search');
  const dateFrom = searchParams.get('date_from') || searchParams.get('scheduled_date_from');
  const dateTo = searchParams.get('date_to') || searchParams.get('scheduled_date_to');
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  let query = client
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  if (serviceType && serviceType !== 'all') {
    query = query.eq('service_type', serviceType);
  }
  if (search) {
    query = query.or(`customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
  }
  if (dateFrom) {
    query = query.gte('scheduled_date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('scheduled_date', dateTo);
  }

  if (authUser.role === 'customer') {
    query = query.eq('customer_id', authUser.id);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[api/orders] GET list failed:', error.message);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }

  return NextResponse.json({ orders: data, total: count });
}

// POST /api/orders - Create a new order
export async function POST(req: NextRequest) {
  const { allowed } = checkOrderPostLimit(getClientIp(req));
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authUser.role === 'customer') {
    return NextResponse.json({ error: 'Admin or employee access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: CreateOrderInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.customer_name || !body.service_type || !body.context) {
    return NextResponse.json(
      { error: 'Missing required fields: customer_name, service_type, context' },
      { status: 400 }
    );
  }

  const orderData = {
    quote_id: body.quote_id || null,
    customer_id: body.customer_id || null,
    customer_name: body.customer_name,
    customer_email: body.customer_email || null,
    customer_phone: body.customer_phone || null,
    service_type: body.service_type,
    context: body.context,
    scope: body.scope || null,
    frequency: body.frequency || 'none',
    base_price: body.base_price,
    discount_percent: body.discount_percent || 0,
    final_price: body.final_price,
    scheduled_date: body.scheduled_date || null,
    scheduled_time: body.scheduled_time || null,
    status: body.status || 'pending',
    notes: body.notes || null,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).from('orders').insert([orderData]).select().single();

  if (error) {
    console.error('[api/orders] POST failed:', error.message);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
