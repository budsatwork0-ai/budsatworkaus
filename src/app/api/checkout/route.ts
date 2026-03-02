import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

// Backward-compat endpoint:
// Step 3 now stores a quote request only. Stripe checkout happens after final review.

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

async function logAudit(
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
      source: 'checkout',
    }]);
  } catch {
    // Non-blocking
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const authUser = await getAuthUser();

  let body: {
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    service_type: string;
    context: string;
    scope?: string;
    frequency?: string;
    final_price?: number;
    submitted_total?: number;
    notes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.customer_name || !body.customer_email || !body.service_type || !body.context) {
    return NextResponse.json(
      { error: 'Missing required fields: customer_name, customer_email, service_type, context' },
      { status: 400 }
    );
  }

  const submittedTotal = Number(body.submitted_total ?? body.final_price ?? 0);
  if (!Number.isFinite(submittedTotal) || submittedTotal <= 0) {
    return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
  }

  try {
    const quoteData = {
      customer_id: authUser?.role === 'customer' ? authUser.id : null,
      customer_name: body.customer_name,
      customer_email: body.customer_email || null,
      customer_phone: body.customer_phone || null,
      service_type: body.service_type,
      context: body.context,
      scope: body.scope || null,
      frequency: body.frequency || 'none',
      total: submittedTotal,
      submitted_total: submittedTotal,
      reviewed_total: null,
      status: 'submitted',
      payment_status: 'not_requested',
      notes: body.notes || null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: quote, error } = await (client as any)
      .from('quotes')
      .insert([quoteData])
      .select()
      .single();

    if (error || !quote) {
      return NextResponse.json({ error: error?.message || 'Failed to create quote' }, { status: 400 });
    }

    logAudit(client, quote.id, 'submitted', {
      submitted_total: submittedTotal,
      customer_email: body.customer_email,
      service_type: body.service_type,
    });

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('Checkout quote submission error:', error);
    return NextResponse.json({ error: 'Failed to submit quote' }, { status: 500 });
  }
}
