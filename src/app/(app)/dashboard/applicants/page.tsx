'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

type Applicant = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  stage: string;
  suburb: string | null;
  created_at: string;
  missing_docs: string[] | null;
  user_id: string | null;
};

const STAGES = ['intake', 'verify', 'paperwork', 'induct', 'ready'];
const STAGE_LABELS: Record<string, string> = {
  intake: 'Intake', verify: 'Verify', paperwork: 'Paperwork', induct: 'Induct', ready: 'Ready',
};
const STAGE_COLORS: Record<string, { bg: string; fg: string }> = {
  intake: { bg: '#F1F5F9', fg: '#475569' },
  verify: { bg: '#DBEAFE', fg: '#1E40AF' },
  paperwork: { bg: '#FEF3C7', fg: '#92400E' },
  induct: { bg: '#E0E7FF', fg: '#3730A3' },
  ready: { bg: '#ECFDF5', fg: '#065F46' },
};

const ROLE_LABELS: Record<string, string> = {
  casual_crew: 'Casual Crew', support_worker: 'Support Worker',
  quality_partner: 'Quality Partner', innovation_partner: 'Innovation Partner',
};

export default function ApplicantsPage() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/applicants')
      .then((r) => r.json())
      .then((data) => setApplicants(data.applicants || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activateApplicant = async (a: Applicant) => {
    setActivating(a.id);
    try {
      const res = await fetch(`/api/applicants/${a.id}/activate`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setApplicants((prev) => prev.map((x) => x.id === a.id ? { ...x, user_id: data.userId, stage: 'induct' } : x));
        toast.success(`Invite sent to ${a.email}`);
      } else {
        toast.error(data.error || 'Failed to activate');
      }
    } catch {
      toast.error('Failed to activate');
    } finally {
      setActivating(null);
    }
  };

  const updateStage = async (id: string, newStage: string) => {
    try {
      const res = await fetch(`/api/applicants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
      if (res.ok) {
        setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, stage: newStage } : a)));
        toast.success(`Moved to ${STAGE_LABELS[newStage]}`);
      } else {
        toast.error('Failed to update');
      }
    } catch {
      toast.error('Failed to update');
    }
  };

  const thisWeek = applicants.filter((a) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(a.created_at) >= weekAgo;
  }).length;

  return (
    <div className="grid gap-6 w-full px-4 md:px-10 lg:px-12 pb-14">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: brand.primary }}>Applicant Pipeline</h1>
          <p className="text-sm text-slate-500">Track applicants from application through to onboarding.</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-white/60 border border-black/5">
          <button onClick={() => setView('kanban')} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={view === 'kanban' ? { background: brand.primary, color: 'white' } : { color: brand.muted }}>Board</button>
          <button onClick={() => setView('list')} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={view === 'list' ? { background: brand.primary, color: 'white' } : { color: brand.muted }}>List</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`${glass} p-4`}>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: brand.muted }}>Total</p>
          <p className="text-2xl font-bold mt-1" style={{ color: brand.primary }}>{applicants.length}</p>
        </div>
        <div className={`${glass} p-4`}>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: brand.muted }}>This Week</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#3B82F6' }}>{thisWeek}</p>
        </div>
        <div className={`${glass} p-4`}>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: brand.muted }}>In Pipeline</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#8B5CF6' }}>{applicants.filter((a) => a.stage !== 'ready').length}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-5 gap-3">{STAGES.map((s) => <div key={s} className="h-64 rounded-xl bg-white/50 animate-pulse" />)}</div>
      ) : view === 'kanban' ? (
        /* Kanban View */
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 overflow-x-auto">
          {STAGES.map((stage) => {
            const stageApplicants = applicants.filter((a) => a.stage === stage);
            const sc = STAGE_COLORS[stage] || STAGE_COLORS.applied;
            const nextStage = STAGES[STAGES.indexOf(stage) + 1];
            return (
              <div key={stage} className="min-w-[200px]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.fg }}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="text-xs text-slate-400">{stageApplicants.length}</span>
                </div>
                <div className="space-y-2">
                  {stageApplicants.map((a) => (
                    <div key={a.id} className={`${glass} p-3`}>
                      <p className="text-sm font-medium" style={{ color: brand.text }}>{a.full_name}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: brand.muted }}>{ROLE_LABELS[a.role] || a.role}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: brand.muted }}>
                        {new Date(a.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                      </p>
                      {a.missing_docs && a.missing_docs.length > 0 && (
                        <p className="text-[10px] mt-1" style={{ color: '#DC2626' }}>{a.missing_docs.length} missing docs</p>
                      )}
                      {nextStage && (
                        <button
                          onClick={() => updateStage(a.id, nextStage)}
                          className="mt-2 w-full text-[11px] px-2 py-1 rounded-lg font-medium text-white"
                          style={{ background: brand.primary }}
                        >
                          Move to {STAGE_LABELS[nextStage]}
                        </button>
                      )}
                      {a.stage === 'ready' && !a.user_id && (
                        <button
                          onClick={() => activateApplicant(a)}
                          disabled={activating === a.id}
                          className="mt-1 w-full text-[11px] px-2 py-1 rounded-lg font-medium border disabled:opacity-50"
                          style={{ background: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }}
                        >
                          {activating === a.id ? 'Sending...' : 'Convert to Staff'}
                        </button>
                      )}
                      {a.user_id && (
                        <p className="mt-1 text-[10px] text-center text-slate-400">Staff account active</p>
                      )}
                    </div>
                  ))}
                  {stageApplicants.length === 0 && (
                    <div className="p-4 text-center rounded-xl border-2 border-dashed border-slate-200">
                      <p className="text-[11px] text-slate-400">No applicants</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/90">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-white/95 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-100 px-4 py-2">Name</th>
                <th className="border-b border-slate-100 px-4 py-2">Role</th>
                <th className="border-b border-slate-100 px-4 py-2">Stage</th>
                <th className="border-b border-slate-100 px-4 py-2">Applied</th>
                <th className="border-b border-slate-100 px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((a) => {
                const sc = STAGE_COLORS[a.stage] || STAGE_COLORS.applied;
                const nextStage = STAGES[STAGES.indexOf(a.stage) + 1];
                return (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{a.full_name}</p>
                      <p className="text-[11px] text-slate-500">{a.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{ROLE_LABELS[a.role] || a.role}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.fg }}>{STAGE_LABELS[a.stage]}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(a.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {nextStage && (
                          <button onClick={() => updateStage(a.id, nextStage)} className="text-xs px-2 py-1 rounded-lg text-white" style={{ background: brand.primary }}>
                            Advance
                          </button>
                        )}
                        {a.stage === 'ready' && !a.user_id && (
                          <button
                            onClick={() => activateApplicant(a)}
                            disabled={activating === a.id}
                            className="text-xs px-2 py-1 rounded-lg font-medium border disabled:opacity-50"
                            style={{ background: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }}
                          >
                            {activating === a.id ? 'Sending...' : 'Convert to Staff'}
                          </button>
                        )}
                        {a.user_id && (
                          <span className="text-[11px] text-slate-400">Staff active</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
