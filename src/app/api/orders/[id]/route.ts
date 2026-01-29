import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { UpdateOrderInput } from '@/types/orders';

// Safe client creation with fallback
function supabaseSafe() {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/orders/[id] - Get a single order
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = supabaseSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { data, error } = await client.from('orders').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PATCH /api/orders/[id] - Update an order
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = supabaseSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: UpdateOrderInput;
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
  if (body.scheduled_date !== undefined) updateData.scheduled_date = body.scheduled_date;
  if (body.scheduled_time !== undefined) updateData.scheduled_time = body.scheduled_time;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.notes !== undefined) updateData.notes = body.notes;

  // Auto-set completed_at when marking as completed
  if (body.status === 'completed' && !body.completed_at) {
    updateData.completed_at = new Date().toISOString();
  } else if (body.completed_at !== undefined) {
    updateData.completed_at = body.completed_at;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await client
    .from('orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/orders/[id] - Cancel/delete an order
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = supabaseSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // Soft delete by setting status to cancelled
  const { data, error } = await client
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Order cancelled', order: data });
}
