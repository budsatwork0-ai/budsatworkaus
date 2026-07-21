import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import type { CreateOrderInput, OrderStatus, ServiceType } from '@/types/orders';
import { getAuthUser } from '@/lib/auth';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import { recordAnalyticsEvent } from '@/lib/analytics/server';
import { createOrderRepository } from '@/lib/orders/repository';
import { orderWorkspace, resolveOrderWorkspace } from '@/lib/orders/workspace';
import { assertWorkspaceCompatibility, withWorkspaceContext } from '@/lib/workspace/server';

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
  const unscheduled = searchParams.get('unscheduled') === 'true';
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const workspace = resolveOrderWorkspace(searchParams, authUser.role);

  return withWorkspaceContext(workspace, async () => {
    const repository = createOrderRepository({ client });

    const { data, count, error } = await repository.list({
      status,
      serviceType,
      search,
      dateFrom,
      dateTo,
      unscheduled,
      customerId: authUser.role === 'customer' ? authUser.id : undefined,
      limit,
      offset,
    });

    if (error) {
      console.error('[api/orders] GET list failed:', error);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    return NextResponse.json({ orders: data, total: count });
  });
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

  const { searchParams } = new URL(req.url);
  const workspace = resolveOrderWorkspace(searchParams, authUser.role);

  return withWorkspaceContext(workspace, async () => {
    // Validate related quote/customer compatibility where the request
    // supplies them — reject incompatible relationships rather than
    // silently reassigning the order's workspace to match. No name/email/
    // timestamp/UUID-pattern inference: this reads the actual `environment`
    // column off each referenced row.
    if (body.quote_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: relatedQuote } = await (client as any)
        .from('quotes')
        .select('id, environment')
        .eq('id', body.quote_id)
        .maybeSingle();

      if (!relatedQuote) {
        return NextResponse.json({ error: 'quote_id does not reference an existing quote' }, { status: 400 });
      }
      try {
        assertWorkspaceCompatibility(workspace, orderWorkspace(relatedQuote));
      } catch {
        return NextResponse.json(
          { error: 'quote_id belongs to a different workspace than the order being created' },
          { status: 409 }
        );
      }
    }

    if (body.customer_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: relatedCustomer } = await (client as any)
        .from('customers')
        .select('id, environment')
        .eq('id', body.customer_id)
        .maybeSingle();

      if (!relatedCustomer) {
        return NextResponse.json({ error: 'customer_id does not reference an existing customer' }, { status: 400 });
      }
      try {
        assertWorkspaceCompatibility(workspace, orderWorkspace(relatedCustomer));
      } catch {
        return NextResponse.json(
          { error: 'customer_id belongs to a different workspace than the order being created' },
          { status: 409 }
        );
      }
    }

    const repository = createOrderRepository({ client });
    const { data, error } = await repository.create({
      quote_id: body.quote_id || null,
      customer_id: body.customer_id || null,
      customer_name: body.customer_name,
      customer_email: body.customer_email || null,
      customer_phone: body.customer_phone || null,
      service_type: body.service_type,
      context: body.context,
      scope: body.scope || null,
      frequency: body.frequency || 'none',
      analytics_session_id: body.analytics_session_id || null,
      base_price: body.base_price,
      discount_percent: body.discount_percent || 0,
      final_price: body.final_price,
      scheduled_date: body.scheduled_date || null,
      scheduled_time: body.scheduled_time || null,
      status: body.status || 'pending',
      notes: body.notes || null,
    });

    if (error || !data) {
      console.error('[api/orders] POST failed:', error);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    // Defensive verification: `repository.create` already stamps the
    // payload with the active workspace, so this should never actually
    // disagree — if it ever does, that's a data integrity problem worth
    // failing loudly on rather than returning an order silently sitting in
    // the wrong workspace.
    try {
      assertWorkspaceCompatibility(workspace, orderWorkspace(data));
    } catch (compatErr) {
      console.error('[api/orders] Inserted order workspace mismatch:', compatErr);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    void recordAnalyticsEvent({
      sessionId: body.analytics_session_id ?? null,
      eventName: 'order_created',
      source: 'server',
      quoteId: body.quote_id || null,
      orderId: data.id,
      eventValue: body.final_price,
      eventData: {
        service: body.service_type,
        context: body.context,
        scope: body.scope || null,
        created_by_role: authUser.role,
      },
    });

    return NextResponse.json(data, { status: 201 });
  });
}
