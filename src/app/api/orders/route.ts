import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { CreateOrderInput, OrderStatus, ServiceType } from '@/types/orders';

// Safe client creation with fallback
function supabaseSafe() {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

// GET /api/orders - List orders with optional filters
export async function GET(req: NextRequest) {
  const client = supabaseSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as OrderStatus | 'all' | null;
  const serviceType = searchParams.get('service_type') as ServiceType | 'all' | null;
  const search = searchParams.get('search');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
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

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data, total: count });
}

// POST /api/orders - Create a new order
export async function POST(req: NextRequest) {
  const client = supabaseSafe();
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

  const { data, error } = await client.from('orders').insert([orderData]).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
