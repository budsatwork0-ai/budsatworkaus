import { createClient } from '@supabase/supabase-js';
import { InvoicesList, type InvoiceRow } from './InvoicesList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DAY = 86_400_000;

export default async function InvoicesPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <p className="p-4 text-[#7f9187]">Can&apos;t load invoices right now.</p>;
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data } = await db.from('orders')
    .select('id, customer_name, customer_email, customer_phone, final_price, status, scheduled_date, created_at, stripe_invoice_id, stripe_invoice_status, stripe_invoice_url, stripe_invoice_number, stripe_invoice_sent_at, stripe_invoice_paid_at')
    .eq('environment', 'production').eq('is_test', false).neq('status', 'cancelled')
    .order('created_at', { ascending: false }).limit(300);

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' }).format(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;

  const rows: InvoiceRow[] = (data ?? [])
    .filter((o) => o.stripe_invoice_id || o.status === 'completed' || o.stripe_invoice_paid_at)
    .map((o) => {
      const paid = o.stripe_invoice_status === 'paid' || !!o.stripe_invoice_paid_at;
      const sent = o.stripe_invoice_sent_at ? new Date(o.stripe_invoice_sent_at).getTime() : null;
      const overdue = !paid && sent !== null && Date.now() - sent > 7 * DAY;
      return {
        id: o.id,
        customer: o.customer_name || 'Customer',
        email: o.customer_email,
        phone: o.customer_phone,
        amount: Number(o.final_price || 0),
        date: (o.stripe_invoice_sent_at || o.scheduled_date || o.created_at || '').slice(0, 10),
        status: paid ? 'Paid' : overdue ? 'Overdue' : 'Unpaid',
        url: o.stripe_invoice_url,
        number: o.stripe_invoice_number,
      };
    });

  const moneyIn = (data ?? [])
    .filter((o) => o.stripe_invoice_paid_at && o.stripe_invoice_paid_at.slice(0, 10) >= monthStart)
    .reduce((t, o) => t + Number(o.final_price || 0), 0);
  const owed = rows.filter((r) => r.status !== 'Paid').reduce((t, r) => t + r.amount, 0);

  return <InvoicesList rows={rows} moneyIn={moneyIn} owed={owed} />;
}
