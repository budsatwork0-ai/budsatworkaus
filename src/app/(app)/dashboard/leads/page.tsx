import { createClient } from '@supabase/supabase-js';
import { LeadsInbox, type InboxItem } from './LeadsInbox';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NEW_LEAD = ['awaiting_response', 'in_conversation', 'new', 'no_response'];
const QUOTED_LEAD = ['quoted'];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return <p className="p-4 text-[#7f9187]">Can&apos;t load leads right now.</p>;
  const db = createClient(url, key, { auth: { persistSession: false } });

  const since = new Date(Date.now() - 180 * 86_400_000).toISOString();
  const [leadsRes, quotesRes] = await Promise.all([
    db.from('leads')
      .select('id, customer_name, customer_phone, customer_email, service_type, suburb, response_status, quote_id, created_at')
      .eq('environment', 'production').eq('is_test', false).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(200),
    db.from('quotes')
      .select('id, customer_name, customer_phone, customer_email, service_type, service_address, status, payment_status, converted_order_id, total, created_at')
      .eq('environment', 'production').eq('is_test', false).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(200),
  ]);
  const leads = leadsRes.data ?? [];
  const quotes = quotesRes.data ?? [];

  const leadIds = leads.map((l) => l.id);
  const latest: Record<string, string> = {};
  if (leadIds.length) {
    const { data: convo } = await db.from('lead_conversations')
      .select('lead_id, body, created_at').in('lead_id', leadIds)
      .order('created_at', { ascending: false }).limit(1000);
    for (const c of convo ?? []) if (c.lead_id && !latest[c.lead_id] && c.body) latest[c.lead_id] = c.body;
  }

  const linkedQuoteIds = new Set(leads.map((l) => l.quote_id).filter(Boolean));
  const items: InboxItem[] = [];

  for (const l of leads) {
    const q = l.quote_id ? quotes.find((x) => x.id === l.quote_id) : undefined;
    if (q) continue; // shown via its quote below
    const stage = NEW_LEAD.includes(l.response_status) ? 'new' : QUOTED_LEAD.includes(l.response_status) ? 'quoted' : 'done';
    items.push({
      key: `lead-${l.id}`,
      stage,
      name: l.customer_name || 'No name yet',
      service: l.service_type,
      suburb: l.suburb,
      phone: l.customer_phone,
      createdAt: l.created_at,
      preview: latest[l.id] ?? null,
      href: `/dashboard/leads/${l.id}`,
      doneLabel: l.response_status,
    });
  }

  for (const q of quotes) {
    const lead = leads.find((l) => l.quote_id === q.id);
    const done = q.status === 'cancelled' || q.payment_status === 'paid' || !!q.converted_order_id || (lead && !NEW_LEAD.includes(lead.response_status) && !QUOTED_LEAD.includes(lead.response_status));
    const stage = done ? 'done' : q.status === 'finalized' ? 'quoted' : 'new';
    items.push({
      key: `quote-${q.id}`,
      stage,
      name: q.customer_name || 'No name yet',
      service: q.service_type,
      suburb: q.service_address?.split(',').slice(-2, -1)[0]?.trim() || null,
      phone: q.customer_phone,
      createdAt: q.created_at,
      preview: lead ? latest[lead.id] ?? null : null,
      href: `/dashboard/quotes/${q.id}`,
      isQuote: true,
      total: q.total,
      doneLabel: q.status === 'cancelled' ? 'cancelled' : q.converted_order_id || q.payment_status === 'paid' ? 'booked' : q.status,
    });
  }
  void linkedQuoteIds;

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const initial = tab === 'quoted' || tab === 'done' ? tab : 'new';
  return <LeadsInbox items={items} initialTab={initial} />;
}
