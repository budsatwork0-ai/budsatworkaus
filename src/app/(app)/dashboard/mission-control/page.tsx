import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { BudOsToday, type TodayJob } from './BudOsToday';
import { FeedbackButton } from '../_components/FeedbackButton';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DAY = 24 * 3600_000;

function aud(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n || 0);
}

function brisbaneToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' }).format(new Date());
}

async function loadData() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const db = createClient(url, key, { auth: { persistSession: false } });

  const today = brisbaneToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  const threeDaysAgo = new Date(Date.now() - 3 * DAY).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const dayAgo = new Date(Date.now() - DAY).toISOString();

  const [jobs, newLeads, staleQuotes, unpaid, paidMonth, doneMonth, owed, bots, failedRuns] = await Promise.all([
    db.from('orders')
      .select('id, customer_name, customer_email, service_type, scheduled_time, final_price, status, stripe_invoice_id, stripe_invoice_status, stripe_invoice_url, stripe_invoice_number, stripe_invoice_sent_at')
      .eq('environment', 'production').eq('scheduled_date', today).neq('status', 'cancelled')
      .order('scheduled_time', { ascending: true }),
    db.from('leads').select('id', { count: 'exact', head: true })
      .eq('environment', 'production').eq('is_test', false).eq('response_status', 'awaiting_response'),
    db.from('quotes').select('id', { count: 'exact', head: true })
      .eq('environment', 'production').eq('is_test', false).in('status', ['submitted', 'finalized'])
      .neq('payment_status', 'paid').lt('created_at', threeDaysAgo),
    db.from('orders').select('id', { count: 'exact', head: true })
      .eq('environment', 'production').eq('is_test', false).eq('stripe_invoice_status', 'open').lt('stripe_invoice_sent_at', sevenDaysAgo),
    db.from('orders').select('final_price')
      .eq('environment', 'production').eq('is_test', false).gte('stripe_invoice_paid_at', monthStart),
    db.from('orders').select('id', { count: 'exact', head: true })
      .eq('environment', 'production').eq('is_test', false).eq('status', 'completed').gte('completed_at', monthStart),
    db.from('orders').select('final_price')
      .eq('environment', 'production').eq('is_test', false).eq('stripe_invoice_status', 'open'),
    db.from('agents').select('id', { count: 'exact', head: true }).eq('status', 'enabled'),
    db.from('agent_runs').select('id', { count: 'exact', head: true })
      .eq('environment', 'production').eq('status', 'failed').gte('started_at', dayAgo),
  ]);

  const sum = (rows: { final_price: number | null }[] | null) => (rows ?? []).reduce((t, r) => t + Number(r.final_price ?? 0), 0);

  return {
    jobs: (jobs.data ?? []) as TodayJob[],
    needs: {
      leads: newLeads.count ?? 0,
      quotes: staleQuotes.count ?? 0,
      invoices: unpaid.count ?? 0,
    },
    month: { moneyIn: sum(paidMonth.data), jobsDone: doneMonth.count ?? 0, owed: sum(owed.data) },
    bots: { on: bots.count ?? 0, failed: failedRuns.count ?? 0 },
  };
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] bg-white p-4 shadow-[0_10px_30px_rgba(15,61,46,0.05)] sm:p-5">
      <h2 className="mb-3 text-[17px] font-extrabold text-[#0F3F33]">{title}</h2>
      {children}
    </section>
  );
}

function NeedRow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-[16px] bg-[#f4faf6] px-4 py-3 text-[15px] font-semibold text-[#17392b]">
      <span>{label}</span>
      <span className="text-[#3c8259]">Open →</span>
    </Link>
  );
}

export default async function BudOsPage() {
  const data = await loadData();
  if (!data) {
    return <Card title="Bud OS"><p className="text-[#7f9187]">Can&apos;t load data right now.</p></Card>;
  }
  const { needs, month, bots } = data;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const anyNeeds = needs.leads + needs.quotes + needs.invoices > 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-10">
      <Card title="Today's jobs">
        <BudOsToday jobs={data.jobs} />
      </Card>

      <Card title="Needs you">
        {anyNeeds ? (
          <div className="flex flex-col gap-2">
            {needs.leads > 0 && <NeedRow href="/dashboard/leads" label={`${plural(needs.leads, 'new lead', 'new leads')} to reply to`} />}
            {needs.quotes > 0 && <NeedRow href="/dashboard/leads" label={`${plural(needs.quotes, 'quote', 'quotes')} to chase`} />}
            {needs.invoices > 0 && <NeedRow href="/dashboard/invoices" label={`${plural(needs.invoices, 'invoice', 'invoices')} unpaid over 7 days`} />}
          </div>
        ) : (
          <p className="rounded-[16px] bg-[#f4faf6] px-4 py-3 text-[15px] font-semibold text-[#3c8259]">All caught up ✓</p>
        )}
      </Card>

      <Card title="This month">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'Money in', value: aud(month.moneyIn) },
            { label: 'Jobs done', value: String(month.jobsDone) },
            { label: 'Owed', value: aud(month.owed) },
          ].map((s) => (
            <div key={s.label} className="rounded-[16px] bg-[#f4faf6] px-2 py-3">
              <div className="text-[20px] font-extrabold text-[#0F3F33]">{s.value}</div>
              <div className="text-xs font-semibold text-[#7f9187]">{s.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-white px-4 py-3 shadow-[0_10px_30px_rgba(15,61,46,0.05)]">
        <Link href="/dashboard/mission-control/advanced?tab=agents" className="text-[15px] font-semibold text-[#17392b]">
          <span className={bots.failed > 0 ? 'text-[#c2410c]' : 'text-[#3c8259]'}>●</span>{' '}
          {bots.failed > 0 ? `Bots: ${plural(bots.failed, 'problem', 'problems')} today` : `Bots: ${bots.on} on, all OK`}
        </Link>
        <FeedbackButton className="bg-[#F5B83D] text-[#0F3F33]" />
      </div>
    </div>
  );
}
