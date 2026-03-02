import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

type RouteParams = { params: Promise<{ id: string }> };

type QuoteStatus =
  | 'submitted'
  | 'in_review'
  | 'finalized'
  | 'payment_pending'
  | 'paid'
  | 'denied';

const VALID_STATUSES: QuoteStatus[] = [
  'submitted',
  'in_review',
  'finalized',
  'payment_pending',
  'paid',
  'denied',
];

function canAccessQuote(
  authUser: { id: string; role: string } | null,
  quote: { customer_id: string | null }
) {
  if (!authUser) return false;
  if (authUser.role === 'admin' || authUser.role === 'employee') return true;
  // Customers may only access quotes they own by user ID — never by email.
  // Email-based matching is insecure: emails can be reused or changed.
  return authUser.role === 'customer' && quote.customer_id === authUser.id;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote, error } = await (client as any)
    .from('quotes')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  if (!canAccessQuote(authUser, quote)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ quote });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role === 'customer') {
    return NextResponse.json({ error: 'Admin or employee access required' }, { status: 403 });
  }

  const { id } = await params;
  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentQuote, error: currentError } = await (client as any)
    .from('quotes')
    .select('*')
    .eq('id', id)
    .single();

  if (currentError || !currentQuote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status !== undefined) {
    const nextStatus = String(body.status) as QuoteStatus;
    if (!VALID_STATUSES.includes(nextStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }
    updates.status = nextStatus;

    if (nextStatus === 'finalized') {
      // Finalizing a quote requires admin — employees may not set the final reviewed price.
      if (authUser.role !== 'admin') {
        return NextResponse.json({ error: 'Only admins may finalize quotes' }, { status: 403 });
      }
      const reviewed = body.reviewed_total ?? currentQuote.reviewed_total ?? currentQuote.submitted_total;
      const reviewedTotal = Number(reviewed);
      if (!Number.isFinite(reviewedTotal) || reviewedTotal <= 0) {
        return NextResponse.json({ error: 'Finalized quotes require a valid reviewed_total' }, { status: 400 });
      }
      updates.reviewed_total = reviewedTotal;
      updates.finalized_at = new Date().toISOString();
      updates.finalized_by = authUser.email || authUser.id;
    }

    if (nextStatus === 'denied') {
      updates.payment_status = 'cancelled';
    }
  }

  if (body.reviewed_total !== undefined) {
    // Direct reviewed_total writes (outside of finalizing) require admin.
    if (authUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins may set reviewed_total directly' }, { status: 403 });
    }
    const reviewedTotal = Number(body.reviewed_total);
    if (!Number.isFinite(reviewedTotal) || reviewedTotal <= 0) {
      return NextResponse.json({ error: 'reviewed_total must be greater than 0' }, { status: 400 });
    }
    updates.reviewed_total = reviewedTotal;
    if (currentQuote.status === 'submitted') {
      updates.status = 'in_review';
    }
  }

  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.converted_order_id) updates.converted_order_id = body.converted_order_id;
  if (body.converted_subscription_id) updates.converted_subscription_id = body.converted_subscription_id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('quotes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[api/quotes] PATCH failed:', error.message);
    return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 });
  }
  return NextResponse.json({ quote: data });
}
