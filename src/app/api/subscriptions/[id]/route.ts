import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { UpdateSubscriptionInput } from '@/types/subscriptions';

// Safe client creation with fallback
function supabaseSafe() {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/subscriptions/[id] - Get a single subscription
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = supabaseSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { data, error } = await client.from('subscriptions').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PATCH /api/subscriptions/[id] - Update a subscription
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = supabaseSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: UpdateSubscriptionInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {};
  if (body.customer_name !== undefined) updateData.customer_name = body.customer_name;
  if (body.customer_email !== undefined) updateData.customer_email = body.customer_email;
  if (body.customer_phone !== undefined) updateData.customer_phone = body.customer_phone;
  if (body.frequency !== undefined) updateData.frequency = body.frequency;
  if (body.base_price !== undefined) updateData.base_price = body.base_price;
  if (body.discount_percent !== undefined) updateData.discount_percent = body.discount_percent;
  if (body.price_per_cycle !== undefined) updateData.price_per_cycle = body.price_per_cycle;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.next_service_date !== undefined) updateData.next_service_date = body.next_service_date;
  if (body.last_service_date !== undefined) updateData.last_service_date = body.last_service_date;
  if (body.end_date !== undefined) updateData.end_date = body.end_date;
  if (body.notes !== undefined) updateData.notes = body.notes;

  // Auto-set end_date when cancelling
  if (body.status === 'cancelled' && !body.end_date) {
    updateData.end_date = new Date().toISOString().split('T')[0];
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await client
    .from('subscriptions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/subscriptions/[id] - Cancel a subscription
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = supabaseSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // Soft delete by setting status to cancelled and end_date
  const { data, error } = await client
    .from('subscriptions')
    .update({
      status: 'cancelled',
      end_date: new Date().toISOString().split('T')[0],
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Subscription cancelled', subscription: data });
}
