import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { QuoteStatus } from '@/lib/types/status';

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home / Commercial Cleaning',
  yard: 'Yard Care',
  dump: 'Rubbish & Dump Run',
  auto: 'Car Detailing',
  laundry_sneakers: 'Laundry & Sneaker Care',
};

// GET /api/pay/[quoteId]
// Public — returns only the minimal fields needed to render the payment page.
// Does NOT expose sensitive quote internals (notes, address, etc.).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  const { quoteId } = await params;
  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote, error } = await (client as any)
    .from('quotes')
    .select('id, customer_name, service_type, context, status, payment_status, reviewed_total, submitted_total, total, stripe_checkout_url, paid_at, environment')
    .eq('id', quoteId)
    .maybeSingle();

  const isPaid = quote?.payment_status === 'paid' || quote?.status === QuoteStatus.paid;
  const isCancelled = quote?.status === QuoteStatus.cancelled || quote?.status === QuoteStatus.denied;
  const isReady = !!quote && ([QuoteStatus.finalized, QuoteStatus.paymentPending].includes(quote.status) || quote.status === 'approved');
  if (error || !quote || quote.environment !== 'production' || (!isReady && !isPaid && !isCancelled)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const amount = Number(quote.reviewed_total ?? quote.submitted_total ?? quote.total ?? 0);

  return NextResponse.json({
    id: quote.id,
    customer_name: quote.customer_name,
    service_label: SERVICE_LABELS[quote.service_type] ?? quote.service_type,
    context: quote.context,
    amount,
    stripe_checkout_url: quote.stripe_checkout_url ?? null,
    is_paid: isPaid,
    is_cancelled: isCancelled,
    is_ready: isReady,
    paid_at: quote.paid_at ?? null,
  });
}
