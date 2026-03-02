import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

// 10 quote submissions per IP per 15 minutes.
const checkQuotePostLimit = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '50');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client as any)
    .from('quotes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status && status !== 'all') {
    const statuses = status
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length > 1) {
      query = query.in('status', statuses);
    } else if (statuses.length === 1) {
      query = query.eq('status', statuses[0]);
    }
  }

  if (authUser.role === 'customer') {
    query = query.eq('customer_id', authUser.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[api/quotes] GET list failed:', error.message);
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }
  return NextResponse.json({ quotes: data || [] });
}

export async function POST(request: NextRequest) {
  const { allowed } = checkQuotePostLimit(getClientIp(request));
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many quote submissions. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.customer_name || !body.service_type || !body.context) {
    return NextResponse.json(
      { error: 'Missing required fields: customer_name, service_type, context' },
      { status: 400 }
    );
  }

  const submittedTotal = Number(body.submitted_total ?? body.total ?? body.final_price ?? 0);
  if (!Number.isFinite(submittedTotal) || submittedTotal <= 0) {
    return NextResponse.json({ error: 'Invalid quote total' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('quotes')
    .insert({
      customer_id: authUser.role === 'customer' ? authUser.id : null,
      customer_name: body.customer_name,
      customer_email: body.customer_email,
      customer_phone: body.customer_phone,
      service_type: body.service_type,
      context: body.context || 'home',
      scope: body.scope,
      frequency: body.frequency || 'none',
      total: submittedTotal,
      submitted_total: submittedTotal,
      reviewed_total: null,
      status: 'submitted',
      payment_status: 'not_requested',
      service_address: body.service_address || null,
      notes: body.notes,
    })
    .select()
    .single();

  if (error) {
    console.error('[api/quotes] POST failed:', error.message);
    return NextResponse.json({ error: 'Failed to submit quote' }, { status: 500 });
  }
  return NextResponse.json({ quote: data });
}
