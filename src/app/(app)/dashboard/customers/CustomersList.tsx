'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export type CustomerCard = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lastJob: string | null;
};

const btn = 'flex h-10 flex-1 items-center justify-center rounded-full text-sm font-bold';

export function CustomersList({ customers }: { customers: CustomerCard[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) => [c.name, c.email, c.phone].some((v) => v?.toLowerCase().includes(s)));
  }, [q, customers]);

  const save = async () => {
    if (!form.full_name.trim()) { toast.error('Add a name'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: form.full_name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || 'Could not save');
      toast.success('Customer added');
      setForm({ full_name: '', phone: '', email: '' });
      setAdding(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 pb-10">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customers"
          className="h-11 min-w-0 flex-1 rounded-full bg-white px-5 text-[15px] text-[#17392b] shadow-sm outline-none"
        />
        <button type="button" aria-label="Add customer" onClick={() => setAdding(true)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0F3F33] text-xl font-bold text-white">+</button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[22px] bg-white px-4 py-6 text-center text-[15px] text-[#7f9187]">No customers found.</p>
      ) : shown.map((c) => (
        <div key={c.id} className="rounded-[22px] bg-white p-4 shadow-[0_10px_30px_rgba(15,61,46,0.05)]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[16px] font-bold capitalize text-[#17392b]">{c.name}</span>
            <span className="shrink-0 text-xs font-semibold text-[#7f9187]">
              {c.lastJob ? `Last job ${new Date(c.lastJob).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'No jobs yet'}
            </span>
          </div>
          <div className="mt-0.5 truncate text-sm text-[#7f9187]">{c.phone || c.email || 'No contact details'}</div>
          <div className="mt-3 flex gap-2">
            {c.phone ? <a href={`tel:${c.phone}`} className={`${btn} bg-[#f4faf6] text-[#0F3F33]`}>Call</a> : null}
            {c.phone ? <a href={`sms:${c.phone}`} className={`${btn} bg-[#f4faf6] text-[#0F3F33]`}>Text</a> : null}
            {!c.phone && c.email ? <a href={`mailto:${c.email}`} className={`${btn} bg-[#f4faf6] text-[#0F3F33]`}>Email</a> : null}
            <button type="button" onClick={() => window.dispatchEvent(new Event('bud:new-job'))} className={`${btn} bg-[#F5B83D] text-[#0F3F33]`}>New job</button>
          </div>
        </div>
      ))}

      {adding ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-3 sm:items-center" onClick={() => setAdding(false)}>
          <div className="w-full max-w-md rounded-[24px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold text-[#0F3F33]">Add customer</h2>
            {(['full_name', 'phone', 'email'] as const).map((f) => (
              <input key={f} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                placeholder={f === 'full_name' ? 'Name' : f === 'phone' ? 'Phone' : 'Email'}
                type={f === 'email' ? 'email' : f === 'phone' ? 'tel' : 'text'}
                className="mt-3 h-11 w-full rounded-[14px] border border-[#dbe7df] px-4 text-[15px] outline-none focus:border-[#3c8259]" />
            ))}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAdding(false)} className="h-11 rounded-full px-5 text-sm font-semibold text-[#7f9187]">Cancel</button>
              <button type="button" disabled={saving} onClick={save} className="h-11 rounded-full bg-[#3c8259] px-6 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
