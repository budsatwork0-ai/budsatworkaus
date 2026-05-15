'use client';

import { useMemo, useState } from 'react';

interface Intel {
  id: string;
  competitor_name: string;
  url: string;
  suburb: string | null;
  service: string | null;
  price_aud: number | null;
  price_unit: string | null;
  promo: string | null;
  raw_snippet: string | null;
  confidence: number | null;
  scraped_at: string;
}

interface Setting { key: string; value: unknown }

const SERVICE_LABELS: Record<string, string> = {
  cleaning: 'Cleaning',
  yard: 'Yard Care',
  windows: 'Windows',
  dump: 'Dump Runs',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneakers',
  other: 'Other',
};

const SERVICE_COLOR: Record<string, string> = {
  cleaning: 'sky',
  yard: 'emerald',
  windows: 'cyan',
  dump: 'amber',
  auto: 'violet',
  laundry_sneakers: 'rose',
  other: 'zinc',
};

export function IntelClient({ intel, ourPricing }: { intel: Intel[]; ourPricing: Setting[] }) {
  const [serviceFilter, setServiceFilter] = useState<string>('all');

  const byService = useMemo(() => {
    const m = new Map<string, Intel[]>();
    for (const r of intel) {
      if (!r.service || r.price_aud == null) continue;
      const arr = m.get(r.service) ?? [];
      arr.push(r);
      m.set(r.service, arr);
    }
    return m;
  }, [intel]);

  const ourMap = useMemo(() => {
    const m: Record<string, number | null> = {};
    for (const s of ourPricing) {
      const k = s.key.replace(/^pricing\./, '');
      const v = typeof s.value === 'number' ? s.value : (s.value as { aud?: number })?.aud ?? null;
      m[k] = v;
    }
    return m;
  }, [ourPricing]);

  const services = Array.from(byService.keys()).sort();
  const competitors = useMemo(() => Array.from(new Set(intel.map((i) => i.competitor_name))).sort(), [intel]);
  const promos = intel.filter((i) => i.promo).slice(0, 8);

  const filtered = serviceFilter === 'all' ? intel : intel.filter((i) => i.service === serviceFilter);

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto">
      <header className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Competitor Intel</h1>
          <p className="text-sm text-zinc-600 mt-1">
            Scraped by the Competitor Scout agent. Updated every Wednesday.
          </p>
        </div>
        <div className="flex gap-6 text-sm">
          <Stat label="Competitors tracked" value={competitors.length.toString()} />
          <Stat label="Price points" value={intel.filter((i) => i.price_aud != null).length.toString()} />
          <Stat label="Active promos" value={promos.length.toString()} accent={promos.length > 0} />
        </div>
      </header>

      {/* Price distribution per service */}
      <section className="mb-10">
        <h2 className="text-lg font-medium mb-3">Where you sit in the market</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((svc) => (
            <DistributionCard
              key={svc}
              service={svc}
              competitorPrices={(byService.get(svc) ?? []).map((r) => r.price_aud!).filter((n): n is number => n != null)}
              ourPrice={ourMap[svc] ?? null}
            />
          ))}
          {services.length === 0 && (
            <div className="col-span-2 rounded-lg border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">
              No competitor data scraped yet. Run the <b>Competitor Scout</b> agent from <a className="underline" href="/dashboard/agents">/dashboard/agents</a>.
            </div>
          )}
        </div>
      </section>

      {/* Promo wall */}
      {promos.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-medium mb-3">What your rivals are running right now</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {promos.map((p) => (
              <div key={p.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs text-amber-700 uppercase tracking-wide">{p.competitor_name} · {p.service ? SERVICE_LABELS[p.service] : ''}</div>
                <div className="mt-1 text-sm text-amber-900">{p.promo}</div>
                <a href={p.url} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block text-xs text-amber-700 underline">view source</a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Comparison matrix */}
      <section className="mb-10">
        <h2 className="text-lg font-medium mb-3">Comparison matrix</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wide">Competitor</th>
                {services.map((svc) => (
                  <th key={svc} className="text-right px-3 py-2 text-xs font-medium uppercase tracking-wide">{SERVICE_LABELS[svc] ?? svc}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-zinc-100 bg-emerald-50/50">
                <td className="px-3 py-2 font-semibold text-emerald-800">Buds At Work (you)</td>
                {services.map((svc) => (
                  <td key={svc} className="text-right px-3 py-2 font-medium text-emerald-800">
                    {ourMap[svc] != null ? `$${ourMap[svc]}` : '—'}
                  </td>
                ))}
              </tr>
              {competitors.map((c) => (
                <tr key={c} className="border-t border-zinc-100">
                  <td className="px-3 py-2 font-medium text-zinc-900">{c}</td>
                  {services.map((svc) => {
                    const row = intel.find((i) => i.competitor_name === c && i.service === svc && i.price_aud != null);
                    const our = ourMap[svc];
                    const better = our != null && row?.price_aud != null && our < row.price_aud;
                    const worse  = our != null && row?.price_aud != null && our > row.price_aud;
                    return (
                      <td key={svc} className={`text-right px-3 py-2 ${better ? 'text-emerald-700' : worse ? 'text-rose-700' : 'text-zinc-700'}`}>
                        {row?.price_aud != null ? `$${row.price_aud}` : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent scrapes */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-medium">Recent scrapes</h2>
          <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}
                  className="text-sm rounded-md border border-zinc-200 px-2 py-1">
            <option value="all">All services</option>
            {services.map((s) => <option key={s} value={s}>{SERVICE_LABELS[s] ?? s}</option>)}
          </select>
        </div>
        <ul className="space-y-2">
          {filtered.slice(0, 40).map((r) => (
            <li key={r.id} className="rounded-lg border border-zinc-200 bg-white p-3 flex items-start gap-3">
              <span className={`mt-1 w-2 h-2 rounded-full bg-${SERVICE_COLOR[r.service ?? 'other']}-500`} />
              <div className="flex-1">
                <div className="text-sm">
                  <span className="font-medium text-zinc-900">{r.competitor_name}</span>
                  <span className="text-zinc-500"> · {r.service ? SERVICE_LABELS[r.service] : 'unknown'}</span>
                  {r.suburb && <span className="text-zinc-500"> · {r.suburb}</span>}
                  {r.price_aud != null && <span className="ml-2 inline-block px-2 py-0.5 rounded bg-zinc-100 text-zinc-800">${r.price_aud}{r.price_unit ? ` ${r.price_unit.replace('_',' ')}` : ''}</span>}
                </div>
                {r.raw_snippet && <div className="mt-1 text-xs text-zinc-600 italic">"{r.raw_snippet}"</div>}
                <div className="mt-1 text-[10px] text-zinc-400">{new Date(r.scraped_at).toLocaleString()} · conf {((r.confidence ?? 0) * 100).toFixed(0)}%</div>
              </div>
              <a href={r.url} target="_blank" rel="noreferrer noopener" className="text-xs text-zinc-500 hover:text-zinc-900 underline">source</a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className={`text-xl font-semibold ${accent ? 'text-amber-600' : 'text-zinc-900'}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  );
}

function DistributionCard({ service, competitorPrices, ourPrice }: { service: string; competitorPrices: number[]; ourPrice: number | null }) {
  const sorted = [...competitorPrices].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 100;
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const range = Math.max(1, max - min);
  const pos = (p: number) => `${((p - min) / range) * 100}%`;

  const cheaperThan = ourPrice != null ? sorted.filter((p) => p > ourPrice).length : 0;
  const pricierThan = ourPrice != null ? sorted.filter((p) => p < ourPrice).length : 0;
  const totalN = sorted.length;
  const stance =
    ourPrice == null ? 'No internal price set for this service' :
    cheaperThan > pricierThan ? `You're cheaper than ${Math.round((cheaperThan / totalN) * 100)}% of the market` :
    pricierThan > cheaperThan ? `You're pricier than ${Math.round((pricierThan / totalN) * 100)}% of the market` :
    `You're right at the median`;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-base font-semibold capitalize">{SERVICE_LABELS[service] ?? service}</h3>
        <span className="text-xs text-zinc-500">{totalN} competitor{totalN === 1 ? '' : 's'}</span>
      </div>

      <div className="relative h-10 bg-zinc-50 rounded-md mb-2">
        {/* tick marks for each competitor price */}
        {sorted.map((p, i) => (
          <span key={i} className="absolute top-1 bottom-1 w-px bg-zinc-400" style={{ left: pos(p) }} />
        ))}
        {/* median */}
        <span className="absolute top-0 bottom-0 w-px bg-zinc-700" style={{ left: pos(median) }} />
        {/* you */}
        {ourPrice != null && (
          <span className="absolute -top-1 -bottom-1 w-1 rounded-sm bg-emerald-500"
                style={{ left: pos(ourPrice), boxShadow: '0 0 0 2px white, 0 0 12px rgba(16,185,129,.5)' }}
                title={`You: $${ourPrice}`} />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-zinc-500">
        <span>${min}</span>
        <span>median ${median}</span>
        <span>${max}</span>
      </div>
      <div className="mt-3 text-sm text-zinc-700">{stance}</div>
    </div>
  );
}
