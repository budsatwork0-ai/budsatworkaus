import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { CreateSubscriptionInput, SubscriptionStatus, SubscriptionFrequency } from '@/types/subscriptions';
import type { ServiceType } from '@/types/orders';

// Safe client creation with fallback
function supabaseSafe() {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

// GET /api/subscriptions - List subscriptions with optional filters
export async function GET(req: NextRequest) {
  const client = supabaseSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as SubscriptionStatus | 'all' | null;
  const serviceType = searchParams.get('service_type') as ServiceType | 'all' | null;
  const frequency = searchParams.get('frequency') as SubscriptionFrequency | 'all' | null;
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  let query = client
    .from('subscriptions')
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
  if (frequency && frequency !== 'all') {
    query = query.eq('frequency', frequency);
  }
  if (search) {
    query = query.or(`customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscriptions: data, total: count });
}

// POST /api/subscriptions - Create a new subscription
export async function POST(req: NextRequest) {
  const client = supabaseSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: CreateSubscriptionInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.customer_name || !body.service_type || !body.context || !body.frequency || !body.start_date) {
    return NextResponse.json(
      { error: 'Missing required fields: customer_name, service_type, context, frequency, start_date' },
      { status: 400 }
    );
  }

  const subscriptionData = {
    customer_id: body.customer_id || null,
    customer_name: body.customer_name,
    customer_email: body.customer_email || null,
    customer_phone: body.customer_phone || null,
    service_type: body.service_type,
    context: body.context,
    scope: body.scope || null,
    frequency: body.frequency,
    base_price: body.base_price,
    discount_percent: body.discount_percent || 0,
    price_per_cycle: body.price_per_cycle,
    status: body.status || 'active',
    start_date: body.start_date,
    next_service_date: body.next_service_date || body.start_date,
    notes: body.notes || null,
  };

  const { data, error } = await client.from('subscriptions').insert([subscriptionData]).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
