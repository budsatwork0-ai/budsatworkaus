import { createClient } from '@supabase/supabase-js';
import { CustomersList, type CustomerCard } from './CustomersList';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CustomersPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <p className="p-4 text-[#7f9187]">Can&apos;t load customers right now.</p>;
  const db = createClient(url, key, { auth: { persistSession: false } });

  const [custRes, ordersRes] = await Promise.all([
    db.from('customers').select('id, full_name, email, phone, created_at')
      .eq('is_test', false).order('full_name', { ascending: true }).limit(1000),
    db.from('orders').select('customer_id, customer_email, scheduled_date, completed_at')
      .eq('environment', 'production').neq('status', 'cancelled').limit(5000),
  ]);

  const last: Record<string, string> = {};
  for (const o of ordersRes.data ?? []) {
    const d = (o.completed_at as string | null)?.slice(0, 10) || (o.scheduled_date as string | null);
    if (!d) continue;
    for (const k of [o.customer_id, o.customer_email?.toLowerCase()]) {
      if (k && (!last[k] || last[k] < d)) last[k] = d;
    }
  }

  const customers: CustomerCard[] = (custRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.full_name,
    email: c.email,
    phone: c.phone,
    lastJob: last[c.id] || (c.email ? last[c.email.toLowerCase()] : undefined) || null,
  }));

  return <CustomersList customers={customers} />;
}
