'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { brand } from '@/app/ui/theme';
import { useAuth } from '@/app/hooks/useAuth';
import type { Applicant } from '@/types/database';

type StageKey = 'intake' | 'verify' | 'paperwork' | 'induct' | 'ready';

type Onboardee = {
  id: string;
  name: string;
  email: string;
  role: string;
  suburb: string;
  services: string[];
  owner?: string;
  missingDocs?: string[];
  slaHoursLeft: number;
  stage: StageKey;
  selected?: boolean;
  activated?: boolean;
  userId?: string;
};

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

const STAGES: { key: StageKey; label: string; hint?: string }[] = [
  { key: 'intake', label: 'Intake', hint: 'New form captured' },
  { key: 'verify', label: 'Verify', hint: 'ID / refs / checks' },
  { key: 'paperwork', label: 'Paperwork', hint: 'ABN / insurance' },
  { key: 'induct', label: 'Induct', hint: 'Onboarding & shadow' },
  { key: 'ready', label: 'Ready', hint: 'Assignable' },
];

const ROLE_MAP: Record<string, string> = {
  'Casual crew': 'Crew',
  'Support worker': 'Support Worker',
  'Quality partner': 'Quality Partner',
  'Innovation partner': 'Innovation Partner',
};

function mapApiToOnboardee(row: Applicant): Onboardee {
  const slaHoursLeft = row.sla_deadline
    ? Math.max(0, Math.round((new Date(row.sla_deadline).getTime() - Date.now()) / 3600000))
    : 72;
  return {
    id: row.id,
    name: row.full_name,
    email: row.email || '',
    role: ROLE_MAP[row.role] || row.role,
    suburb: row.suburb || '',
    services: row.services || [],
    owner: row.owner || undefined,
    missingDocs: row.missing_docs || undefined,
    slaHoursLeft,
    stage: row.stage as StageKey,
    activated: !!row.user_id,
    userId: row.user_id || undefined,
  };
}

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
      {hours > 0 ? `${hours}h left` : 'Overdue'}
    </span>
  );
}

export default function OnboardingPipelinePage() {
  const { user } = useAuth();
  const adminName = ((user?.user_metadata?.full_name as string) || user?.email || 'Admin').split(' ')[0];

  const [items, setItems] = useState<Onboardee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'needs_docs' | 'mine' | 'aging'>('all');
  const [bulkMode, setBulkMode] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

  const fetchApplicants = useCallback(async () => {
    try {
      const res = await fetch('/api/applicants');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setItems((data.applicants || []).map(mapApiToOnboardee));
      setError(null);
    } catch {
      setError('Could not load applicants');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplicants();
  }, [fetchApplicants]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'needs_docs': return items.filter(i => (i.missingDocs?.length ?? 0) > 0);
      case 'mine': return items.filter(i => i.owner === adminName);
      case 'aging': return items.filter(i => i.slaHoursLeft <= 24);
      default: return items;
    }
  }, [items, filter, adminName]);

  async function move(id: string, dir: -1 | 1) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const idx = STAGES.findIndex(s => s.key === item.stage);
    const nextIdx = Math.min(STAGES.length - 1, Math.max(0, idx + dir));
    const nextStage = STAGES[nextIdx].key;
    if (nextStage === item.stage) return;

    // Optimistic update
    setItems(prev => prev.map(i => i.id === id ? { ...i, stage: nextStage } : i));

    try {
      const res = await fetch(`/api/applicants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStage }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure
      setItems(prev => prev.map(i => i.id === id ? { ...i, stage: item.stage } : i));
    }
  }

  function toggleSelect(id: string) {
    setItems(prev => prev.map(i => i.id === id ? ({ ...i, selected: !i.selected }) : i));
  }

  async function bulkAssign(owner: string) {
    const selected = items.filter(i => i.selected);
    setItems(prev => prev.map(i => i.selected ? ({ ...i, owner }) : i));
    await Promise.allSettled(
      selected.map(i =>
        fetch(`/api/applicants/${i.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner }),
        })
      )
    );
  }

  async function bulkMove(target: StageKey) {
    const selected = items.filter(i => i.selected);
    setItems(prev => prev.map(i => i.selected ? ({ ...i, stage: target }) : i));
    await Promise.allSettled(
      selected.map(i =>
        fetch(`/api/applicants/${i.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: target }),
        })
      )
    );
  }

  async function activateApplicant(id: string) {
    setActivating(id);
    try {
      const res = await fetch(`/api/applicants/${id}/activate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Activation failed');
        return;
      }
      setItems(prev =>
        prev.map(i => i.id === id ? { ...i, activated: true, userId: data.userId, stage: 'induct' } : i)
      );
    } catch {
      alert('Failed to activate applicant');
    } finally {
      setActivating(null);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: brand.bg }}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>Onboarding</h1>
          <p className="text-sm md:text-base mt-1" style={{ color: brand.muted }}>
            Pipeline for new crew, support workers, and partners.
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
          <button className="px-3 py-2 rounded-lg border"
                  style={{ borderColor: brand.border, color: brand.muted }}
                  onClick={() => { setLoading(true); fetchApplicants(); }}>
            Refresh
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
            onClick={() => setFilter(t.k as typeof filter)}>
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
                  onClick={() => bulkAssign(adminName)}>
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

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {STAGES.map(stage => (
            <div key={stage.key} className={`${glass} rounded-2xl p-4`}
                 style={{ background: brand.card, borderColor: 'rgba(0,0,0,0.08)' }}>
              <div className="mb-3">
                <div className="h-4 w-16 rounded bg-slate-200 animate-pulse" />
                <div className="h-3 w-24 rounded bg-slate-100 animate-pulse mt-1" />
              </div>
              <div className="space-y-3">
                {[1, 2].map(n => (
                  <div key={n} className="rounded-xl border p-3" style={{ borderColor: brand.border }}>
                    <div className="h-4 w-28 rounded bg-slate-200 animate-pulse" />
                    <div className="h-3 w-20 rounded bg-slate-100 animate-pulse mt-2" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: brand.muted }}>{error}</p>
          <button className="mt-2 text-sm underline" style={{ color: brand.primary }}
                  onClick={() => { setLoading(true); fetchApplicants(); }}>
            Try again
          </button>
        </div>
      )}

      {/* Columns */}
      {!loading && !error && (
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
                        <div className="text-xs opacity-70">
                          {card.suburb}{card.services.length > 0 ? ` · ${card.services.join(', ')}` : ''}
                        </div>
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
                      <div className="mt-3 space-y-2">
                        {/* Activate button for ready-stage cards */}
                        {card.stage === 'ready' && !card.activated && (
                          <button
                            className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-60"
                            style={{ background: brand.primary }}
                            disabled={activating === card.id}
                            onClick={() => activateApplicant(card.id)}
                          >
                            {activating === card.id ? 'Activating...' : 'Activate as Employee'}
                          </button>
                        )}
                        {card.stage === 'ready' && card.activated && (
                          <div className="px-3 py-2 rounded-lg text-xs font-medium text-center"
                               style={{ background: '#ECFDF5', color: brand.primary }}>
                            Invite sent to {card.email}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button className="px-2 py-1 rounded-lg border text-xs"
                                    style={{ borderColor: brand.border, color: brand.muted }}
                                    onClick={() => move(card.id, -1)}>
                              &larr;
                            </button>
                            {card.stage !== 'ready' && (
                              <button className="px-2 py-1 rounded-lg border text-xs"
                                      style={{ borderColor: brand.border, color: brand.primary }}
                                      onClick={() => move(card.id, +1)}>
                                &rarr;
                              </button>
                            )}
                          </div>
                          <Link href={`/dashboard/onboarding/${card.id}`} className="text-xs hover:underline"
                                style={{ color: brand.primary }}>
                            Open
                          </Link>
                        </div>
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
      )}
    </div>
  );
}
