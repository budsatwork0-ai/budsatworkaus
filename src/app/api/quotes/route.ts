import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import { getResendClient, FROM_ADDRESS } from '@/lib/email/resend';
import { quoteReceivedEmail } from '@/lib/email/templates';

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home/Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Dump Runs',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

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
    // Best-effort: permanently link orphaned quotes via Postgres function.
    if (authUser.email) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (client as any).rpc('claim_anonymous_quotes', {
        p_user_id: authUser.id,
        p_email: authUser.email,
      });
    }
    query = query.eq('customer_id', authUser.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[api/quotes] GET list failed:', error.message);
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 });
  }

  let quotes = data || [];

  // Fallback: also include any still-orphaned quotes matching by email.
  // This ensures quotes are visible immediately even if the RPC link hasn't
  // run yet or the DB function is not yet applied.
  if (authUser.role === 'customer' && authUser.email) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orphaned } = await (client as any)
      .from('quotes')
      .select('*')
      .ilike('customer_email', authUser.email)
      .is('customer_id', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (orphaned && orphaned.length > 0) {
      const seen = new Set(quotes.map((q: { id: string }) => q.id));
      quotes = [...quotes, ...orphaned.filter((q: { id: string }) => !seen.has(q.id))];
    }
  }

  return NextResponse.json({ quotes });
}

export async function POST(request: NextRequest) {
  const { allowed } = checkQuotePostLimit(getClientIp(request));
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many quote submissions. Please wait a few minutes and try again.' },
      { status: 429 }
    );
  }

  // Auth is optional — anonymous visitors can submit quotes.
  // If they are logged in we link the quote to their account.
  let authUser: Awaited<ReturnType<typeof getAuthUser>> = null;
  try {
    authUser = await getAuthUser();
  } catch {
    // Non-critical — proceed as anonymous if auth check fails
  }

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

  const ALLOWED_SERVICE_TYPES = Object.keys(SERVICE_LABELS);
  if (!ALLOWED_SERVICE_TYPES.includes(body.service_type as string)) {
    return NextResponse.json({ error: 'Invalid service_type' }, { status: 400 });
  }

  if (!['home', 'commercial'].includes(body.context as string)) {
    return NextResponse.json({ error: 'Invalid context' }, { status: 400 });
  }

  // Guard against context/service mismatch (e.g. auto detailing is home-only)
  const SERVICES_BY_CONTEXT: Record<string, string[]> = {
    home: ['windows', 'cleaning', 'yard', 'dump', 'auto', 'laundry_sneakers'],
    commercial: ['windows', 'cleaning', 'yard'],
  };
  if (!SERVICES_BY_CONTEXT[body.context as string]?.includes(body.service_type as string)) {
    return NextResponse.json({ error: 'Service not available for this context' }, { status: 400 });
  }

  if (body.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customer_email as string)) {
    return NextResponse.json({ error: 'Invalid customer_email format' }, { status: 400 });
  }

  const submittedTotal = Number(body.submitted_total ?? body.total ?? body.final_price ?? 0);
  if (!Number.isFinite(submittedTotal) || submittedTotal <= 0) {
    return NextResponse.json({ error: 'Invalid quote total' }, { status: 400 });
  }

  // Combine address + notes into a single field — quotes table has no
  // dedicated service_address column, so we prepend it to notes.
  const combinedNotes = [
    body.service_address ? `Address: ${body.service_address}` : '',
    typeof body.notes === 'string' ? body.notes : '',
  ].filter(Boolean).join('\n') || null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('quotes')
    .insert({
      customer_id: authUser?.role === 'customer' ? authUser.id : null,
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
      notes: combinedNotes,
    })
    .select()
    .single();

  if (error) {
    console.error('[api/quotes] POST failed:', error.message);
    return NextResponse.json({ error: 'Failed to submit quote' }, { status: 500 });
  }

  // Send "quote received" confirmation email — fire and forget
  const customerEmail = body.customer_email as string | undefined;
  if (customerEmail && data) {
    const resend = getResendClient();
    if (resend) {
      const { subject, html } = quoteReceivedEmail({
        customerName: body.customer_name as string,
        serviceLabel: SERVICE_LABELS[body.service_type as string] ?? String(body.service_type),
        total: submittedTotal,
        quoteId: data.id,
      });
      resend.emails.send({ from: FROM_ADDRESS, to: customerEmail, subject, html }).catch((err) => {
        console.error('[email] quote_received send failed:', err);
      });
    }
  }

  return NextResponse.json({ quote: data });
}
