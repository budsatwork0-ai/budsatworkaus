'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { brand } from '@/app/ui/theme';

type StageKey = 'intake' | 'verify' | 'paperwork' | 'induct' | 'ready';
type Role = 'Crew' | 'Support Worker' | 'Contractor';

type Onboardee = {
  id: string;
  name: string;
  role: Role;
  suburb: string;
  services: string[];
  owner?: string;
  missingDocs?: string[];
  slaHoursLeft: number; // simple countdown for UX
  stage: StageKey;
  selected?: boolean;
};

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

const STAGES: { key: StageKey; label: string; hint?: string }[] = [
  { key: 'intake', label: 'Intake', hint: 'New form captured' },
  { key: 'verify', label: 'Verify', hint: 'ID / refs / checks' },
  { key: 'paperwork', label: 'Paperwork', hint: 'ABN / insurance' },
  { key: 'induct', label: 'Induct', hint: 'Onboarding & shadow' },
  { key: 'ready', label: 'Ready', hint: 'Assignable' },
];

function SLA({ hours }: { hours: number }) {
  const bg =
    hours <= 0 ? '#FEE2E2'
    : hours <= 24 ? '#FEF3C7'
    : '#ECFDF5';
  const fg =
    hours <= 0 ? '#991B1B'
    : hours <= 24 ? '#92400E'
    : brand.primary;
  return (
    <span className="px-2 py-0.5 rounded-md text-xs" style={{ background: bg, color: fg }}>
      ⏱ {hours > 0 ? `${hours}h left` : 'Overdue'}
    </span>
  );
}

export default function OnboardingPipelinePage() {
  const [items, setItems] = useState<Onboardee[]>(() => ([
    { id: 'OB-3001', name: 'Nate R.', role: 'Crew', suburb: 'Ipswich', services: ['Windows','Lawns'], owner: 'Jackson', missingDocs: ['Insurance'], slaHoursLeft: 30, stage: 'verify' },
    { id: 'OB-3002', name: 'Silvan S.', role: 'Crew', suburb: 'Logan', services: ['Cleaning'], owner: 'Dean', slaHoursLeft: 60, stage: 'intake' },
    { id: 'OB-3003', name: 'Maria P.', role: 'Contractor', suburb: 'Brisbane Sth', services: ['Dump Runs','Bin Cleans'], missingDocs: ['ABN','Insurance'], slaHoursLeft: 10, stage: 'paperwork' },
    { id: 'OB-3004', name: 'Arthur P.', role: 'Support Worker', suburb: 'Springfield', services: ['Cleaning','Windows'], owner: 'Jackson', slaHoursLeft: 6, stage: 'verify' },
    { id: 'OB-3005', name: 'Daniel S.', role: 'Crew', suburb: 'Jimboomba', services: ['Lawns'], slaHoursLeft: 90, stage: 'induct' },
  ]));

  const [filter, setFilter] = useState<'all' | 'needs_docs' | 'mine' | 'aging'>('all');
  const [bulkMode, setBulkMode] = useState(false);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'needs_docs': return items.filter(i => (i.missingDocs?.length ?? 0) > 0);
      case 'mine': return items.filter(i => i.owner === 'Jackson'); // mock “me”
      case 'aging': return items.filter(i => i.slaHoursLeft <= 24);
      default: return items;
    }
  }, [items, filter]);

  function move(id: string, dir: -1 | 1) {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const idx = STAGES.findIndex(s => s.key === i.stage);
      const next = Math.min(STAGES.length - 1, Math.max(0, idx + dir));
      return { ...i, stage: STAGES[next].key };
    }));
  }

  function toggleSelect(id: string) {
    setItems(prev => prev.map(i => i.id === id ? ({ ...i, selected: !i.selected }) : i));
  }

  function bulkAssign(owner: string) {
    setItems(prev => prev.map(i => i.selected ? ({ ...i, owner }) : i));
  }

  function bulkMove(target: StageKey) {
    setItems(prev => prev.map(i => i.selected ? ({ ...i, stage: target }) : i));
  }

  return (
    <div className="min-h-screen" style={{ background: brand.bg }}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>Onboarding</h1>
          <p className="text-sm md:text-base mt-1" style={{ color: brand.muted }}>
            Pipeline for new onboardees (design-only; actions are mocked).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/onboarding/new" className="px-3 py-2 rounded-lg border"
                style={{ borderColor: brand.border, color: brand.primary }}>
            + New Onboardee
          </Link>
          <button className="px-3 py-2 rounded-lg border"
                  style={{ borderColor: brand.border, color: brand.muted }}
                  onClick={() => setBulkMode(v => !v)}>
            {bulkMode ? 'Exit Bulk' : 'Bulk Select'}
          </button>
        </div>
      </div>

      {/* Saved views */}
      <div className="flex items-center gap-2 mb-4">
        {[
          {k:'all', label:'All'},
          {k:'needs_docs', label:'Needs Docs'},
          {k:'mine', label:'My Onboardees'},
          {k:'aging', label:'Aging (<24h)'},
        ].map(t => (
          <button key={t.k}
            className={`px-3 py-1.5 rounded-lg border ${filter===t.k ? 'bg-black/5' : ''}`}
            style={{ borderColor: brand.border, color: filter===t.k ? brand.primary : brand.muted }}
            onClick={() => setFilter(t.k as any)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Bulk bar */}
      {bulkMode && filtered.some(i => i.selected) && (
        <div className={`${glass} rounded-xl px-4 py-3 mb-4 flex items-center gap-3`}
             style={{ borderColor: 'rgba(0,0,0,0.08)', background: '#fff' }}>
          <span className="text-sm" style={{ color: brand.muted }}>
            {filtered.filter(i=>i.selected).length} selected
          </span>
          <button className="px-3 py-1.5 rounded-lg border"
                  style={{ borderColor: brand.border, color: brand.primary }}
                  onClick={() => bulkAssign('Jackson')}>
            Assign to me
          </button>
          <div className="flex items-center gap-1">
            <span className="text-sm" style={{ color: brand.muted }}>Move to:</span>
            {STAGES.map(s => (
              <button key={s.key} className="px-2 py-1 rounded border text-xs"
                      style={{ borderColor: brand.border, color: brand.primary }}
                      onClick={() => bulkMove(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {STAGES.map(stage => (
          <div key={stage.key} className={`${glass} rounded-2xl p-4`}
               style={{ background: brand.card, color: brand.text, borderColor: 'rgba(0,0,0,0.08)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: brand.primary }}>{stage.label}</h2>
                {stage.hint && <div className="text-xs" style={{ color: brand.muted }}>{stage.hint}</div>}
              </div>
              <span className="px-2 py-0.5 rounded-md text-xs"
                    style={{ background: '#F3F4F6', color: brand.muted }}>
                {filtered.filter(i => i.stage === stage.key).length}
              </span>
            </div>

            <div className="space-y-3">
              {filtered.filter(i => i.stage === stage.key).map(card => (
                <div key={card.id} className="rounded-xl border p-3"
                     style={{ borderColor: brand.border, background: '#fff' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{card.name} <span className="opacity-60">· {card.role}</span></div>
                      <div className="text-xs opacity-70">{card.suburb} • {card.services.join(', ')}</div>
                    </div>
                    {bulkMode ? (
                      <input type="checkbox" checked={!!card.selected} onChange={() => toggleSelect(card.id)} />
                    ) : (
                      <SLA hours={card.slaHoursLeft} />
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded-md border" style={{ borderColor: brand.border }}>
                      Owner: {card.owner ?? '—'}
                    </span>
                    {(card.missingDocs?.length ?? 0) > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-md border"
                            style={{ borderColor: brand.border, background:'#FFF4E5', color:'#8B5E00' }}>
                        Docs: {card.missingDocs?.join(', ')}
                      </span>
                    )}
                  </div>

                  {!bulkMode && (
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <button className="px-2 py-1 rounded-lg border text-xs"
                                style={{ borderColor: brand.border, color: brand.muted }}
                                onClick={() => move(card.id, -1)}>
                          ←
                        </button>
                        <button className="px-2 py-1 rounded-lg border text-xs"
                                style={{ borderColor: brand.border, color: brand.primary }}
                                onClick={() => move(card.id, +1)}>
                          →
                        </button>
                      </div>
                      <Link href={`/dashboard/onboarding/${card.id}`} className="text-xs hover:underline"
                            style={{ color: brand.primary }}>
                        Open
                      </Link>
                    </div>
                  )}
                </div>
              ))}

              {/* Empty state */}
              {filtered.filter(i => i.stage === stage.key).length === 0 && (
                <div className="text-xs px-3 py-6 text-center rounded-lg border"
                     style={{ borderColor: brand.border, color: brand.muted }}>
                  No items
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
