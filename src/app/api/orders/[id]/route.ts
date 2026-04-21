import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import type { UpdateOrderInput } from '@/types/orders';
import type { OrderUpdate } from '@/types/database';
import { getAuthUser } from '@/lib/auth';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/orders/[id] - Get a single order
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any).from('orders').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    console.error('[api/orders/[id]] DB error:', error.message);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  if (authUser.role === 'customer' && data.customer_id !== authUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(data);
}

// PATCH /api/orders/[id] - Update an order
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  let body: UpdateOrderInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingOrder } = await (client as any)
    .from('orders')
    .select('id, customer_id')
    .eq('id', id)
    .maybeSingle();

  if (!existingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const isCustomer = authUser.role === 'customer';
  if (isCustomer && existingOrder.customer_id !== authUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Build update object with only provided fields
  const updateData: OrderUpdate = {};
  if (!isCustomer) {
    if (body.customer_name !== undefined) updateData.customer_name = body.customer_name;
    if (body.customer_email !== undefined) updateData.customer_email = body.customer_email;
    if (body.customer_phone !== undefined) updateData.customer_phone = body.customer_phone;
    if (body.scheduled_date !== undefined) updateData.scheduled_date = body.scheduled_date;
    if (body.scheduled_time !== undefined) updateData.scheduled_time = body.scheduled_time;
    if (body.estimated_duration_minutes !== undefined) updateData.estimated_duration_minutes = body.estimated_duration_minutes;
    if (body.assigned_crew_id !== undefined) updateData.assigned_crew_id = body.assigned_crew_id;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;
  } else {
    if (body.scheduled_date !== undefined) updateData.scheduled_date = body.scheduled_date;
    if (body.scheduled_time !== undefined) updateData.scheduled_time = body.scheduled_time;
    if (body.status !== undefined) {
      if (body.status !== 'cancelled') {
        return NextResponse.json({ error: 'Customers can only cancel orders' }, { status: 403 });
      }
      updateData.status = body.status;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
  }

  // Auto-set completed_at when marking as completed
  if (!isCustomer && body.status === 'completed' && !body.completed_at) {
    updateData.completed_at = new Date().toISOString();
  } else if (!isCustomer && body.completed_at !== undefined) {
    updateData.completed_at = body.completed_at;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    console.error('[api/orders/[id]] DB error:', error.message);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/orders/[id] - Cancel/delete an order
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingOrder } = await (client as any)
    .from('orders')
    .select('id, customer_id')
    .eq('id', id)
    .maybeSingle();

  if (!existingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (authUser.role === 'customer' && existingOrder.customer_id !== authUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Soft delete by setting status to cancelled
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    console.error('[api/orders/[id]] DB error:', error.message);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Order cancelled', order: data });
}
