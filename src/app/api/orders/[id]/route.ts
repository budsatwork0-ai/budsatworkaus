import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import type { UpdateOrderInput } from '@/types/orders';
import type { OrderUpdate } from '@/types/database';
import { getAuthUser } from '@/lib/auth';
import { recordAnalyticsEvent } from '@/lib/analytics/server';
import { createOrderRepository } from '@/lib/orders/repository';
import { orderWorkspace } from '@/lib/orders/workspace';
import { LIVE_WORKSPACE, withWorkspaceContext } from '@/lib/workspace/server';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Sandbox orders are admin-only regardless of role or ownership — the
 * id-first counterpart to the admin-only sandbox gate applied to list/
 * create requests (there's no query param to resolve here; the workspace is
 * a property of the fetched order itself). Production orders keep their
 * existing employee/customer permissions unchanged.
 */
function canAccessOrder(
  authUser: { id: string; role: string } | null,
  order: { customer_id: string | null; environment?: unknown }
) {
  if (!authUser) return false;
  if (orderWorkspace(order) !== LIVE_WORKSPACE && authUser.role !== 'admin') return false;
  if (authUser.role === 'admin' || authUser.role === 'employee') return true;
  return authUser.role === 'customer' && order.customer_id === authUser.id;
}

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

  const repository = createOrderRepository({ client });
  const { data: order, error } = await repository.getById(id);

  if (error || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (!canAccessOrder(authUser, order)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(order);
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

  const repository = createOrderRepository({ client });
  const { data: existingOrder, error: existingError } = await repository.getById(id);

  if (existingError || !existingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Sandbox orders may only be updated by an admin — an employee otherwise
  // allowed to PATCH production orders may not touch a sandbox one.
  const workspace = orderWorkspace(existingOrder);
  if (workspace !== LIVE_WORKSPACE && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

  const { data, error } = await withWorkspaceContext(workspace, () => repository.update(id, updateData));

  if (error || !data) {
    console.error('[api/orders/[id]] DB error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  const scheduleBecameSet =
    !existingOrder.scheduled_date &&
    !existingOrder.scheduled_time &&
    (Boolean(updateData.scheduled_date) || Boolean(updateData.scheduled_time));

  if (body.status && body.status !== existingOrder.status) {
    const eventName =
      body.status === 'completed'
        ? 'order_completed'
        : body.status === 'cancelled'
          ? 'order_cancelled'
          : body.status === 'scheduled'
            ? 'order_scheduled'
            : body.status === 'in_progress'
              ? 'order_in_progress'
              : 'order_status_changed';

    void recordAnalyticsEvent({
      sessionId: (existingOrder.analytics_session_id as string | null) ?? null,
      eventName,
      source: 'server',
      quoteId: (existingOrder.quote_id as string | null) ?? null,
      orderId: existingOrder.id,
      eventValue: (data as { final_price?: number | null }).final_price ?? null,
      eventData: {
        service: existingOrder.service_type,
        context: existingOrder.context,
        scope: existingOrder.scope,
        from_status: existingOrder.status,
        to_status: body.status,
      },
    });
  } else if (scheduleBecameSet) {
    void recordAnalyticsEvent({
      sessionId: (existingOrder.analytics_session_id as string | null) ?? null,
      eventName: 'order_scheduled',
      source: 'server',
      quoteId: (existingOrder.quote_id as string | null) ?? null,
      orderId: existingOrder.id,
      eventValue: (data as { final_price?: number | null }).final_price ?? null,
      eventData: {
        service: existingOrder.service_type,
        context: existingOrder.context,
        scope: existingOrder.scope,
        scheduled_date: updateData.scheduled_date ?? null,
        scheduled_time: updateData.scheduled_time ?? null,
      },
    });
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

  const repository = createOrderRepository({ client });
  const { data: existingOrder, error: existingError } = await repository.getById(id);

  if (existingError || !existingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Sandbox orders may only be cancelled by an admin — mirrors the PATCH gate.
  const workspace = orderWorkspace(existingOrder);
  if (workspace !== LIVE_WORKSPACE && authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (authUser.role === 'customer' && existingOrder.customer_id !== authUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Soft delete by setting status to cancelled
  const { data, error } = await withWorkspaceContext(workspace, () =>
    repository.update(id, { status: 'cancelled' })
  );

  if (error || !data) {
    console.error('[api/orders/[id]] DB error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Order cancelled', order: data });
}
