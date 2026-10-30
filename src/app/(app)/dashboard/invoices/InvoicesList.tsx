'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useDashboardData } from '../hooks/useDashboardData';
import { filterWorkerToPeriod, getPayPeriodBounds, readPayHistory, writePayHistory, type PayHistoryEntry } from './MoneyFlowWorkspace';

export type InvoiceRow = {
  id: string;
  customer: string;
  email: string | null;
  phone: string | null;
  amount: number;
  date: string;
  status: 'Paid' | 'Unpaid' | 'Overdue';
  url: string | null;
  number: string | null;
};

const aud = (n: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n || 0);
const chip: Record<InvoiceRow['status'], string> = {
  Paid: 'bg-[#e7f4ec] text-[#3c8259]',
  Unpaid: 'bg-[#fdf3dc] text-[#9a6b0c]',
  Overdue: 'bg-[#fde8e4] text-[#c2410c]',
};

function reminderHref(r: InvoiceRow) {
  const first = r.customer.split(' ')[0];
  const text = `Hi ${first}, a friendly reminder about your Buds At Work invoice for ${aud(r.amount)}.${r.url ? ` You can pay here: ${r.url}` : ''} Thanks!`;
  if (r.phone) return `sms:${r.phone}?&body=${encodeURIComponent(text)}`;
  if (r.email) return `mailto:${r.email}?subject=${encodeURIComponent('Invoice reminder')}&body=${encodeURIComponent(text)}`;
  return null;
}

function CrewPayLine() {
  const { moneyFlow } = useDashboardData('full');
  const [history, setHistory] = useState<PayHistoryEntry[]>([]);
  useEffect(() => { setHistory(readPayHistory()); }, []);
  const period = 'fortnight' as const;
  const paidIds = useMemo(() => new Set(history.filter((h) => h.periodKey === period).map((h) => h.workerId)), [history]);
  const owed = useMemo(
    () => (moneyFlow?.crewPay?.workers ?? [])
      .map((w) => filterWorkerToPeriod(w, period, paidIds))
      .filter((w): w is NonNullable<typeof w> => Boolean(w) && w!.displayPayStatus !== 'Paid' && w!.approvedPay > 0),
    [moneyFlow, paidIds],
  );
  if (owed.length === 0) return null;
  const label = getPayPeriodBounds(period).label;
  const markPaid = (w: (typeof owed)[number]) => {
    const next = [{ id: `${w.id}-${Date.now()}`, workerId: w.id, workerName: w.name, periodKey: period, periodLabel: label, paidAt: new Date().toISOString(), hours: w.approvedHours, amount: w.approvedPay }, ...history].slice(0, 80);
    setHistory(next);
    writePayHistory(next);
    toast.success(`${w.name} marked paid`);
  };
  return (
    <div className="flex flex-col gap-2">
      {owed.map((w) => (
        <div key={w.id} className="flex items-center justify-between gap-2 rounded-[22px] bg-white px-4 py-3 shadow-sm">
          <span className="text-[15px] font-semibold text-[#17392b]">{w.name.split(' ')[0]} owed {aud(w.approvedPay)}</span>
          <button type="button" onClick={() => markPaid(w)} className="h-9 rounded-full bg-[#f4faf6] px-4 text-sm font-bold text-[#0F3F33]">Mark paid</button>
        </div>
      ))}
    </div>
  );
}

export function InvoicesList({ rows, moneyIn, owed }: { rows: InvoiceRow[]; moneyIn: number; owed: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const markPaid = async (r: InvoiceRow) => {
    if (!window.confirm(`Mark ${aud(r.amount)} from ${r.customer} as paid?`)) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/orders/${r.id}/mark-paid`, { method: 'POST' });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || 'Could not save');
      toast.success('Marked paid');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 pb-10">
      <div className="grid grid-cols-2 gap-3">
        {[{ label: 'Money in this month', value: aud(moneyIn) }, { label: 'Money owed', value: aud(owed) }].map((s) => (
          <div key={s.label} className="rounded-[22px] bg-white px-4 py-4 shadow-sm">
            <div className="text-[24px] font-extrabold text-[#0F3F33]">{s.value}</div>
            <div className="text-xs font-semibold text-[#7f9187]">{s.label}</div>
          </div>
        ))}
      </div>

      <CrewPayLine />

      {rows.length === 0 ? (
        <p className="rounded-[22px] bg-white px-4 py-6 text-center text-[15px] text-[#7f9187]">No invoices yet.</p>
      ) : rows.map((r) => {
        const remind = r.status !== 'Paid' ? reminderHref(r) : null;
        return (
          <div key={r.id} className="rounded-[22px] bg-white p-4 shadow-[0_10px_30px_rgba(15,61,46,0.05)]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[16px] font-bold text-[#17392b]">{r.customer}</span>
              <span className="shrink-0 text-[16px] font-extrabold text-[#0F3F33]">{aud(r.amount)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-sm text-[#7f9187]">{r.date ? new Date(r.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${chip[r.status]}`}>{r.status}</span>
            </div>
            {r.status !== 'Paid' ? (
              <div className="mt-3 flex gap-2">
                {remind ? <a href={remind} className="flex h-10 flex-1 items-center justify-center rounded-full bg-[#f4faf6] text-sm font-bold text-[#0F3F33]">Send reminder</a> : null}
                <button type="button" disabled={busy === r.id} onClick={() => markPaid(r)} className="h-10 flex-1 rounded-full bg-[#0F3F33] text-sm font-bold text-white disabled:opacity-60">Mark paid</button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
