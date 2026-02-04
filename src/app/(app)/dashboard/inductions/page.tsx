'use client';

import { useState } from 'react';
import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

type InductionStep = {
  key: string;
  label: string;
  description: string;
};

type Inductee = {
  id: string;
  name: string;
  role: string;
  startDate: string;
  progress: Record<string, boolean>;
};

const STEPS: InductionStep[] = [
  { key: 'id_check', label: 'ID & Background', description: 'Identity verification and police check submitted' },
  { key: 'docs', label: 'Documents', description: 'Tax, super, and insurance paperwork completed' },
  { key: 'training', label: 'Training Modules', description: 'Safety, customer service, and service-specific training' },
  { key: 'shadow', label: 'Shadow Shift', description: 'Completed a supervised ride-along or job shadow' },
  { key: 'sign_off', label: 'Manager Sign-off', description: 'Final approval to begin independent work' },
];

const MOCK_INDUCTEES: Inductee[] = [
  { id: 'i1', name: 'Dean R.', role: 'Field Tech — Lawns & Yards', startDate: '2026-01-20', progress: { id_check: true, docs: true, training: true, shadow: false, sign_off: false } },
  { id: 'i2', name: 'Nate K.', role: 'Field Tech — Cleaning', startDate: '2026-01-27', progress: { id_check: true, docs: true, training: false, shadow: false, sign_off: false } },
  { id: 'i3', name: 'Lily T.', role: 'Field Tech — Windows', startDate: '2026-02-03', progress: { id_check: true, docs: false, training: false, shadow: false, sign_off: false } },
];

export default function InductionsPage() {
  const [inductees, setInductees] = useState<Inductee[]>(MOCK_INDUCTEES);

  function toggleStep(inducteeId: string, stepKey: string) {
    setInductees(prev =>
      prev.map(ind =>
        ind.id === inducteeId
          ? { ...ind, progress: { ...ind.progress, [stepKey]: !ind.progress[stepKey] } }
          : ind
      )
    );
  }

  function completedCount(ind: Inductee) {
    return STEPS.filter(s => ind.progress[s.key]).length;
  }

  return (
    <div className="min-h-screen" style={{ background: brand.bg }}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>Inductions</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>
          Track onboarding steps, checks, and approvals for new team members.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        {[
          { label: 'Active', value: inductees.length, color: brand.primary },
          { label: 'Completed', value: inductees.filter(i => completedCount(i) === STEPS.length).length, color: '#22c55e' },
          { label: 'Pending checks', value: inductees.filter(i => completedCount(i) < STEPS.length).length, color: '#f59e0b' },
          { label: 'Steps total', value: STEPS.length, color: brand.muted },
        ].map(s => (
          <div key={s.label} className={`${glass} rounded-2xl p-3`} style={{ borderColor: brand.border, background: brand.card }}>
            <div className="text-[11px] uppercase tracking-wide" style={{ color: brand.muted }}>{s.label}</div>
            <div className="text-xl font-semibold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Inductee cards */}
      <div className="space-y-4">
        {inductees.map(ind => {
          const done = completedCount(ind);
          const pct = Math.round((done / STEPS.length) * 100);
          return (
            <div key={ind.id} className={`${glass} rounded-2xl p-4`} style={{ borderColor: brand.border, background: brand.card }}>
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <div className="font-semibold" style={{ color: brand.text }}>{ind.name}</div>
                  <div className="text-xs" style={{ color: brand.muted }}>{ind.role} &middot; Started {ind.startDate}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : brand.primary }}
                    />
                  </div>
                  <span className="text-xs font-medium" style={{ color: pct === 100 ? '#22c55e' : brand.text }}>{done}/{STEPS.length}</span>
                </div>
              </div>

              <div className="grid gap-2">
                {STEPS.map((step, idx) => {
                  const checked = ind.progress[step.key];
                  return (
                    <button
                      key={step.key}
                      onClick={() => toggleStep(ind.id, step.key)}
                      className={`flex items-center gap-3 rounded-lg border p-2.5 text-left transition ${checked ? 'bg-emerald-50/50' : 'bg-white/60 hover:bg-white'}`}
                      style={{ borderColor: checked ? '#bbf7d0' : brand.border }}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${checked ? 'bg-emerald-500 border-emerald-500' : ''}`} style={checked ? {} : { borderColor: brand.border }}>
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

      <p className="text-xs mt-6" style={{ color: brand.muted }}>
        Design-only. Steps are mocked locally and will persist to the database when connected.
      </p>
    </div>
  );
}
