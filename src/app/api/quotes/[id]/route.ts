import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { createStripeClientSafe } from '@/lib/stripe/server';

type RouteParams = { params: Promise<{ id: string }> };

type QuoteStatus =
  | 'submitted'
  | 'in_review'
  | 'finalized'
  | 'payment_pending'
  | 'paid'
  | 'denied'
  | 'cancelled';

const VALID_STATUSES: QuoteStatus[] = [
  'submitted',
  'in_review',
  'finalized',
  'payment_pending',
  'paid',
  'denied',
  'cancelled',
];

function normalizeStatus(rawStatus: string): QuoteStatus {
  if (rawStatus === 'pending') return 'submitted';
  if (rawStatus === 'approved') return 'finalized';
  if (rawStatus === 'adjusted') return 'in_review';
  if (rawStatus === 'converted') return 'paid';
  if (
    rawStatus === 'submitted' ||
    rawStatus === 'in_review' ||
    rawStatus === 'finalized' ||
    rawStatus === 'payment_pending' ||
    rawStatus === 'paid' ||
    rawStatus === 'denied' ||
    rawStatus === 'cancelled'
  ) {
    return rawStatus;
  }
  return 'submitted';
}

async function logQuoteAudit(
  client: ReturnType<typeof createServiceClientSafe>,
  entityId: string,
  action: string,
  newValue: Record<string, unknown>
) {
  if (!client) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).from('audit_log').insert([{
      entity_type: 'quote',
      entity_id: entityId,
      action,
      new_value: newValue,
      source: 'dashboard',
    }]);
  } catch {
    // Non-blocking
  }
}

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

  const currentStatus = normalizeStatus(currentQuote.status);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let auditAction: string | null = null;
  let auditValue: Record<string, unknown> | null = null;

  if (body.status !== undefined) {
    const nextStatus = String(body.status) as QuoteStatus;
    if (!VALID_STATUSES.includes(nextStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    if (nextStatus === 'cancelled') {
      if (authUser.role !== 'admin') {
        return NextResponse.json({ error: 'Only admins may cancel approved quotes' }, { status: 403 });
      }
      if (!['finalized', 'payment_pending'].includes(currentStatus)) {
        return NextResponse.json(
          { error: 'Only approved quotes can be cancelled. Use denied for quotes still under review.' },
          { status: 409 }
        );
      }

      const cancellationReason =
        typeof body.cancellation_reason === 'string' ? body.cancellation_reason.trim() : '';
      if (!cancellationReason) {
        return NextResponse.json({ error: 'cancellation_reason is required when cancelling a quote' }, { status: 400 });
      }

      const stripe = createStripeClientSafe();
      if (stripe && currentQuote.stripe_checkout_session_id) {
        try {
          await stripe.checkout.sessions.expire(currentQuote.stripe_checkout_session_id);
        } catch (stripeError) {
          console.warn('[api/quotes] Failed to expire checkout session during quote cancellation:', stripeError);
        }
      }

      if (currentQuote.converted_order_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: linkedOrderError } = await (client as any)
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', currentQuote.converted_order_id);

        if (linkedOrderError) {
          console.error('[api/quotes] Failed to cancel linked order:', linkedOrderError.message);
          return NextResponse.json({ error: 'Failed to cancel the linked order' }, { status: 500 });
        }
      }

      updates.status = 'cancelled';
      updates.payment_status = 'cancelled';
      updates.cancellation_reason = cancellationReason;
      updates.cancelled_at = new Date().toISOString();
      updates.cancelled_by = authUser.email || authUser.id;
      updates.stripe_checkout_url = null;
      auditAction = 'cancelled';
      auditValue = {
        from_status: currentStatus,
        cancellation_reason: cancellationReason,
        cancelled_by: authUser.email || authUser.id,
        converted_order_id: currentQuote.converted_order_id ?? null,
      };
    } else {
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
    if (currentStatus === 'submitted') {
      updates.status = 'in_review';
    }
  }

  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.converted_order_id) updates.converted_order_id = body.converted_order_id;
  if (body.converted_subscription_id) updates.converted_subscription_id = body.converted_subscription_id;

  // NDIS routing flags — admin can mark quotes as forwarded / accepted / booked.
  // Values accept ISO timestamps, `true` (stamp now) or `null` (clear).
  const ndisStampFields: Array<'ndis_forwarded_at' | 'ndis_accepted_at' | 'ndis_booked_at'> = [
    'ndis_forwarded_at',
    'ndis_accepted_at',
    'ndis_booked_at',
  ];
  for (const field of ndisStampFields) {
    if (body[field] !== undefined) {
      const val = body[field];
      if (val === null) updates[field] = null;
      else if (val === true) updates[field] = new Date().toISOString();
      else if (typeof val === 'string' && val.length > 0) updates[field] = val;
    }
  }
  if (typeof body.ndis_management_type === 'string' &&
      ['plan_managed', 'self_managed', 'agency_managed'].includes(body.ndis_management_type)) {
    updates.ndis_management_type = body.ndis_management_type;
  }
  if (typeof body.ndis_forward_contact === 'string') {
    updates.ndis_forward_contact = body.ndis_forward_contact.trim() || null;
  }
  if (typeof body.ndis_forward_email === 'string') {
    const e = body.ndis_forward_email.trim().toLowerCase();
    updates.ndis_forward_email = e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null;
  }

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

  if (auditAction && auditValue) {
    logQuoteAudit(client, id, auditAction, auditValue);
  }
  return NextResponse.json({ quote: data });
}
