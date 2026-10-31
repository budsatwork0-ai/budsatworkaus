'use client';

import React from 'react';

export type PriceRow = {
  id: string; service: string; item: string; label: string; unit: string;
  price: number | null; minimum: number | null; market_low: number | null; market_high: number | null;
  source: string | null; checked_at: string | null; note: string | null; active: boolean;
};

const SERVICE_NAMES: Record<string, string> = { windows: 'Window cleaning' };
const money = (n: number | null) => (n == null ? '—' : `$${Number(n).toLocaleString('en-AU', { maximumFractionDigits: 2 })}`);
const daysOld = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 9999);
const input = 'w-full rounded-lg border border-[#0F3F33]/15 bg-white px-3 py-2 text-base';

function Card({ row, onSaved }: { row: PriceRow; onSaved: (r: PriceRow) => void }) {
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState(row);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState('');
  const isMin = row.item === 'job_minimum';
  const stale = daysOld(row.checked_at) > 90;

  const save = async () => {
    setSaving(true); setErr('');
    const res = await fetch('/api/price-list', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, price: f.price, minimum: f.minimum, market_low: f.market_low, market_high: f.market_high, source: f.source, checked_at: f.checked_at, note: f.note, active: f.active }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setErr(j.error || 'Could not save'); return; }
    onSaved(j.row); setOpen(false);
  };
  const num = (k: keyof PriceRow) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value === '' ? null : Number(e.target.value) });

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${stale ? 'border-amber-300' : 'border-[#0F3F33]/10'} ${row.active ? '' : 'opacity-60'}`}>
      <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen(!open)}>
        <div>
          <p className="font-semibold text-[#0F3F33]">{row.label}</p>
          <p className="text-xs text-[#0F3F33]/60">
            Market {money(row.market_low)}–{money(row.market_high)} · checked {row.checked_at ?? 'never'}{stale ? ' · needs a check' : ''}
          </p>
        </div>
        <span className="rounded-full bg-[#E8F5EE] px-3 py-1 text-lg font-bold text-[#0F3F33]">
          {isMin ? money(row.minimum) : money(row.price)}<span className="text-xs font-normal">{isMin ? '' : ` /${row.unit}`}</span>
        </span>
      </button>
      {open && (
        <div className="mt-3 grid gap-2">
          <label className="text-xs text-[#0F3F33]/70">{isMin ? 'Minimum job ($)' : `Price per ${row.unit} ($)`}
            <input className={input} type="number" inputMode="decimal" min={0} step="0.5" value={(isMin ? f.minimum : f.price) ?? ''} onChange={num(isMin ? 'minimum' : 'price')} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-[#0F3F33]/70">Market low ($)<input className={input} type="number" inputMode="decimal" value={f.market_low ?? ''} onChange={num('market_low')} /></label>
            <label className="text-xs text-[#0F3F33]/70">Market high ($)<input className={input} type="number" inputMode="decimal" value={f.market_high ?? ''} onChange={num('market_high')} /></label>
          </div>
          <label className="text-xs text-[#0F3F33]/70">Last checked<input className={input} type="date" value={f.checked_at ?? ''} onChange={(e) => setF({ ...f, checked_at: e.target.value || null })} /></label>
          <label className="text-xs text-[#0F3F33]/70">Source links<textarea className={input} rows={2} value={f.source ?? ''} onChange={(e) => setF({ ...f, source: e.target.value })} /></label>
          <label className="text-xs text-[#0F3F33]/70">Note<textarea className={input} rows={2} value={f.note ?? ''} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm text-[#0F3F33]"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Show on website</label>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={saving} className="flex-1 rounded-xl bg-[#0F3F33] py-2.5 font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => { setF(row); setOpen(false); }} className="rounded-xl border border-[#0F3F33]/15 px-4 py-2.5 text-[#0F3F33]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PriceListClient({ initialRows }: { initialRows: PriceRow[] }) {
  const [rows, setRows] = React.useState(initialRows);
  const services = Array.from(new Set(rows.map((r) => r.service)));
  if (!rows.length) return <p className="rounded-2xl bg-white p-4 text-sm text-[#0F3F33]/70">No prices yet.</p>;
  return (
    <div className="flex flex-col gap-5">
      {services.map((s) => (
        <section key={s} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#0F3F33]/60">{SERVICE_NAMES[s] ?? s}</h2>
          {rows.filter((r) => r.service === s).map((r) => (
            <Card key={r.id} row={r} onSaved={(nr) => setRows((prev) => prev.map((x) => (x.id === nr.id ? nr : x)))} />
          ))}
        </section>
      ))}
      <p className="text-xs text-[#0F3F33]/60">No GST (not registered). Every change is saved in price history. Other services still use the built-in prices until approved.</p>
    </div>
  );
}
