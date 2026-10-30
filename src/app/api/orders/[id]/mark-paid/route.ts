import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

// POST /api/orders/[id]/mark-paid: owner marks an invoice paid (cash, bank transfer).
// Does not contact Stripe or the customer.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  const { id } = await params;
  const paidAt = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client as any)
    .from('orders')
    .update({ stripe_invoice_status: 'paid', stripe_invoice_paid_at: paidAt })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, stripe_invoice_paid_at: paidAt });
}
