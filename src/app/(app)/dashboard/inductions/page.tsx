'use client';

import { useEffect, useState, useCallback } from 'react';
import { brand } from '@/app/ui/theme';
import type { Inductee } from '@/app/api/inductions/route';

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

const STEPS = [
  { key: 'id_check', label: 'ID & Background', description: 'Identity verification and police check submitted' },
  { key: 'docs',     label: 'Documents',        description: 'Tax, super, and insurance paperwork completed' },
  { key: 'training', label: 'Training Modules', description: 'Safety, customer service, and service-specific training' },
  { key: 'shadow',   label: 'Shadow Shift',     description: 'Completed a supervised ride-along or job shadow' },
  { key: 'sign_off', label: 'Manager Sign-off', description: 'Final approval to begin independent work' },
];

function completedCount(ind: Inductee) {
  return STEPS.filter(s => ind.induction_progress[s.key]).length;
}

function Skeleton() {
  return (
    <div className={`${glass} rounded-2xl p-4 animate-pulse`} style={{ borderColor: brand.border, background: brand.card }}>
      <div className="flex items-center justify-between mb-3">
        <div className="space-y-1">
          <div className="h-4 w-28 bg-slate-200 rounded" />
          <div className="h-3 w-40 bg-slate-100 rounded" />
        </div>
        <div className="h-2 w-24 bg-slate-100 rounded-full" />
      </div>
      {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-lg mb-2" />)}
    </div>
  );
}

export default function InductionsPage() {
  const [inductees, setInductees] = useState<Inductee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchInductees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/inductions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setInductees(data.inductees || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load inductees.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchInductees(); }, [fetchInductees]);

  async function toggleStep(inducteeId: string, stepKey: string, currentValue: boolean) {
    setInductees(prev =>
      prev.map(ind =>
        ind.id === inducteeId
          ? { ...ind, induction_progress: { ...ind.induction_progress, [stepKey]: !currentValue } }
          : ind
      )
    );

    setSaving(inducteeId);
    try {
      const res = await fetch(`/api/inductions/${inducteeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepKey, value: !currentValue }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error(err);
      // Revert on error
      setInductees(prev =>
        prev.map(ind =>
          ind.id === inducteeId
            ? { ...ind, induction_progress: { ...ind.induction_progress, [stepKey]: currentValue } }
            : ind
        )
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: brand.bg }}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>Inductions</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>
          Track onboarding steps, checks, and approvals for new team members.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        {[
          { label: 'Active', value: isLoading ? '—' : String(inductees.length), color: brand.primary },
          { label: 'Completed', value: isLoading ? '—' : String(inductees.filter(i => completedCount(i) === STEPS.length).length), color: '#22c55e' },
          { label: 'In progress', value: isLoading ? '—' : String(inductees.filter(i => completedCount(i) > 0 && completedCount(i) < STEPS.length).length), color: '#f59e0b' },
          { label: 'Steps each', value: String(STEPS.length), color: brand.muted },
        ].map(s => (
          <div key={s.label} className={`${glass} rounded-2xl p-3`} style={{ borderColor: brand.border, background: brand.card }}>
            <div className="text-[11px] uppercase tracking-wide" style={{ color: brand.muted }}>{s.label}</div>
            <div className="text-xl font-semibold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl p-4 bg-red-50 border border-red-100 text-sm text-red-700 flex items-center justify-between">
          {error}
          <button onClick={fetchInductees} className="text-xs underline ml-4" style={{ color: brand.primary }}>Retry</button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} />)}</div>
      ) : inductees.length === 0 ? (
        <div className={`${glass} rounded-2xl p-8 text-center`} style={{ borderColor: brand.border, background: brand.card }}>
          <div className="text-sm font-medium mb-1" style={{ color: brand.text }}>No active inductees</div>
          <div className="text-xs" style={{ color: brand.muted }}>
            Applicants in the Verify, Paperwork, or Induct stages will appear here.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {inductees.map(ind => {
            const done = completedCount(ind);
            const pct = Math.round((done / STEPS.length) * 100);
            const isSaving = saving === ind.id;

            return (
              <div key={ind.id} className={`${glass} rounded-2xl p-4`} style={{ borderColor: brand.border, background: brand.card }}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <div className="font-semibold flex items-center gap-2" style={{ color: brand.text }}>
                      {ind.full_name}
                      {isSaving && <span className="text-[10px] text-slate-400">Saving…</span>}
                    </div>
                    <div className="text-xs" style={{ color: brand.muted }}>
                      {ind.role} &middot; Started {new Date(ind.created_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : brand.primary }}
                      />
                    </div>
                    <span className="text-xs font-medium" style={{ color: pct === 100 ? '#22c55e' : brand.text }}>
                      {done}/{STEPS.length}
                    </span>
                  </div>
                </div>

                <div className="grid gap-2">
                  {STEPS.map((step, idx) => {
                    const checked = !!ind.induction_progress[step.key];
                    return (
                      <button
                        key={step.key}
                        onClick={() => toggleStep(ind.id, step.key, checked)}
                        disabled={isSaving}
                        className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition ${checked ? 'bg-emerald-50/50' : 'bg-white/60 hover:bg-white'} disabled:opacity-60`}
                        style={{ borderColor: checked ? '#bbf7d0' : brand.border }}
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${checked ? 'bg-emerald-500 border-emerald-500' : ''}`}
                          style={checked ? {} : { borderColor: brand.border }}
                        >
                          {checked && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${checked ? 'line-through text-slate-400' : ''}`} style={checked ? {} : { color: brand.text }}>
                            {idx + 1}. {step.label}
                          </div>
                          <div className="text-[11px]" style={{ color: brand.muted }}>{step.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
