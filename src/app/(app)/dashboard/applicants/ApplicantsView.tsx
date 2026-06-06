'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { dashboardTheme } from '@/lib/design-system/themes';
import { useOpenMessaging } from '../hooks/useMessagingHub';

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
  employee_id?: string | null;
  onboarding?: {
    onboardingComplete: boolean;
    crewAccessApproved: boolean;
    awaitingApproval: boolean;
    currentSectionLabel: string | null;
    progress: {
      completed: number;
      total: number;
      currentStep: number;
    };
    crewPortalEnabled: boolean;
  } | null;
  quality_message?: string | null;
  quality_business_name?: string | null;
  quality_contribution_types?: string[] | null;
};

const STAGES = ['intake', 'verify', 'paperwork', 'induct', 'ready'];
const COMMUNITY_STAGES = ['intake', 'verify'];

const STAGE_LABELS: Record<string, string> = {
  intake: 'Intake', verify: 'Verify', paperwork: 'Paperwork', induct: 'Induct', ready: 'Ready',
};
const COMMUNITY_STAGE_LABELS: Record<string, string> = {
  intake: 'New', verify: 'Contacted',
};
const STAGE_COLORS: Record<string, { bg: string; fg: string }> = {
  intake: { bg: '#F1F5F9', fg: '#475569' },
  verify: { bg: '#DBEAFE', fg: '#1E40AF' },
  paperwork: { bg: '#FEF3C7', fg: '#92400E' },
  induct: { bg: '#E0E7FF', fg: '#3730A3' },
  ready: { bg: '#ECFDF5', fg: '#065F46' },
};

const ROLE_LABELS: Record<string, string> = {
  'Casual crew': 'Casual Crew',
  'Support worker': 'Support Worker',
  'Quality partner': 'Volunteer',
  'Innovation partner': 'Innovation Partner',
  'Sponsor': 'Sponsor',
};

const ROLE_COLORS: Record<string, { bg: string; fg: string }> = {
  'Quality partner': { bg: '#ECFDF5', fg: '#065F46' },
  'Sponsor': { bg: '#EEF2FF', fg: '#4338CA' },
};

const CREW_ROLES = ['Casual crew', 'Support worker'];
const COMMUNITY_ROLES = ['Quality partner', 'Sponsor'];

type GroupFilter = 'all' | 'crew' | 'community';

function sanitizeGroup(value?: string | null): GroupFilter {
  if (value === 'crew' || value === 'community') return value;
  return 'all';
}

export function ApplicantsView({ initialGroup }: { initialGroup?: string | null } = {}) {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [activating, setActivating] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupFilter>(() => sanitizeGroup(initialGroup));
  const openMessaging = useOpenMessaging();

  useEffect(() => {
    setGroup(sanitizeGroup(initialGroup));
  }, [initialGroup]);

  useEffect(() => {
    fetch('/api/applicants')
      .then((r) => r.json())
      .then((data) => setApplicants(data.applicants || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = applicants.filter((a) => {
    if (group === 'crew') return CREW_ROLES.includes(a.role);
    if (group === 'community') return COMMUNITY_ROLES.includes(a.role);
    return true;
  });

  const isCommunity = (role: string) => COMMUNITY_ROLES.includes(role);

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
        toast.success(`Updated`);
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

  const communityCount = applicants.filter((a) => COMMUNITY_ROLES.includes(a.role)).length;
  const linkedCrewOnboarding = applicants.filter((a) => CREW_ROLES.includes(a.role) && a.user_id && a.onboarding).length;

  // Stages to show depend on active filter
  const visibleStages = group === 'community' ? COMMUNITY_STAGES : STAGES;
  const stageLabel = (stage: string) =>
    group === 'community' ? (COMMUNITY_STAGE_LABELS[stage] ?? STAGE_LABELS[stage]) : STAGE_LABELS[stage];

  function crewJourneyMeta(applicant: Applicant) {
    const onboarding = applicant.onboarding;
    if (!onboarding) return null;
    if (onboarding.crewPortalEnabled) {
      return {
        label: 'Crew active',
        detail: 'This applicant is now approved and has crew portal access.',
        bg: '#ECFDF5',
        fg: '#047857',
      };
    }
    if (onboarding.awaitingApproval) {
      return {
        label: 'Awaiting approval',
        detail: 'Onboarding is complete and ready for final admin approval.',
        bg: '#DBEAFE',
        fg: '#1D4ED8',
      };
    }
    return {
      label: `Onboarding step ${onboarding.progress.currentStep}/${onboarding.progress.total}`,
      detail: onboarding.currentSectionLabel
        ? `Currently on ${onboarding.currentSectionLabel}.`
        : 'Onboarding is in progress.',
      bg: '#FEF3C7',
      fg: '#92400E',
    };
  }

  function RoleBadge({ role }: { role: string }) {
    const rc = ROLE_COLORS[role];
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
        style={rc ? { background: rc.bg, color: rc.fg } : { background: '#F1F5F9', color: '#475569' }}
      >
        {ROLE_LABELS[role] ?? role}
      </span>
    );
  }

  return (
    <div className="grid gap-6 w-full px-4 md:px-10 lg:px-12 pb-14">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: dashboardTheme.color.primary }}>Applicant Pipeline</h1>
          <p className="text-sm text-slate-500">Track applicants, volunteers, and sponsor enquiries.</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-white/60 border border-black/5">
          <button onClick={() => setView('kanban')} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={view === 'kanban' ? { background: dashboardTheme.color.primary, color: 'white' } : { color: dashboardTheme.color.muted }}>Board</button>
          <button onClick={() => setView('list')} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={view === 'list' ? { background: dashboardTheme.color.primary, color: 'white' } : { color: dashboardTheme.color.muted }}>List</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`${glass} p-4`}>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: dashboardTheme.color.muted }}>Total</p>
          <p className="text-2xl font-bold mt-1" style={{ color: dashboardTheme.color.primary }}>{applicants.length}</p>
        </div>
        <div className={`${glass} p-4`}>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: dashboardTheme.color.muted }}>This Week</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#3B82F6' }}>{thisWeek}</p>
        </div>
        <div className={`${glass} p-4`}>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: dashboardTheme.color.muted }}>In Pipeline</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#8B5CF6' }}>{applicants.filter((a) => a.stage !== 'ready').length}</p>
        </div>
        <div className={`${glass} p-4`}>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: dashboardTheme.color.muted }}>Community</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#4338CA' }}>{communityCount}</p>
        </div>
        <div className={`${glass} p-4`}>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: dashboardTheme.color.muted }}>Linked onboarding</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#1D4ED8' }}>{linkedCrewOnboarding}</p>
        </div>
      </div>

      {/* Group filter */}
      <div className="flex gap-1.5">
        {(['all', 'crew', 'community'] as GroupFilter[]).map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
            style={
              group === g
                ? { background: dashboardTheme.color.primary, color: 'white', borderColor: dashboardTheme.color.primary }
                : { background: 'white', color: dashboardTheme.color.muted, borderColor: '#E5E7EB' }
            }
          >
            {g === 'all' ? 'All' : g === 'crew' ? 'Crew' : 'Community'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-5 gap-3">{STAGES.map((s) => <div key={s} className="h-64 rounded-xl bg-white/50 animate-pulse" />)}</div>
      ) : view === 'kanban' ? (
        /* Kanban View */
        <div className={`grid gap-3 overflow-x-auto`} style={{ gridTemplateColumns: `repeat(${visibleStages.length}, minmax(200px, 1fr))` }}>
          {visibleStages.map((stage) => {
            const stageApplicants = filtered.filter((a) => {
              if (group === 'community' && stage === 'verify') {
                // "Contacted" bucket: any stage other than 'intake' for community
                return !['intake'].includes(a.stage);
              }
              return a.stage === stage;
            });
            const sc = STAGE_COLORS[stage] || STAGE_COLORS.intake;
            const nextStage = STAGES[STAGES.indexOf(stage) + 1];
            return (
              <div key={stage} className="min-w-[200px]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.fg }}>
                    {stageLabel(stage)}
                  </span>
                  <span className="text-xs text-slate-400">{stageApplicants.length}</span>
                </div>
                <div className="space-y-2">
                  {stageApplicants.map((a) => {
                    const community = isCommunity(a.role);
                    const onboardingMeta = !community ? crewJourneyMeta(a) : null;
                    return (
                      <div key={a.id} className={`${glass} p-3`}>
                        <p className="text-sm font-medium" style={{ color: dashboardTheme.color.text }}>{a.full_name}</p>
                        <div className="mt-1">
                          <RoleBadge role={a.role} />
                        </div>
                        <p className="text-[10px] mt-1" style={{ color: dashboardTheme.color.muted }}>
                          {new Date(a.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                        </p>
                        {a.email && (
                          <p className="text-[10px] truncate mt-0.5" style={{ color: dashboardTheme.color.muted }}>{a.email}</p>
                        )}
                        {!a.missing_docs?.length && community && a.quality_business_name && (
                          <p className="text-[10px] mt-0.5 truncate" style={{ color: dashboardTheme.color.muted }}>{a.quality_business_name}</p>
                        )}
                        {a.missing_docs && a.missing_docs.length > 0 && (
                          <p className="text-[10px] mt-1" style={{ color: '#DC2626' }}>{a.missing_docs.length} missing docs</p>
                        )}
                        {onboardingMeta && (
                          <div
                            className="mt-2 rounded-lg px-2.5 py-2"
                            style={{ background: onboardingMeta.bg, color: onboardingMeta.fg }}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">{onboardingMeta.label}</p>
                            <p className="text-[10px] mt-0.5">{onboardingMeta.detail}</p>
                          </div>
                        )}

                        {/* Community actions */}
                        {community && a.stage === 'intake' && (
                          <button
                            onClick={() => updateStage(a.id, 'verify')}
                            className="mt-2 w-full text-[11px] px-2 py-1 rounded-lg font-medium text-white"
                            style={{ background: '#4338CA' }}
                          >
                            Mark contacted
                          </button>
                        )}
                        {community && (
                          <a
                            href={`mailto:${a.email}`}
                            className="mt-1 block w-full text-[11px] px-2 py-1 rounded-lg font-medium text-center border"
                            style={{ borderColor: '#E5E7EB', color: dashboardTheme.color.muted }}
                          >
                            Email →
                          </a>
                        )}

                        {/* Crew actions */}
                        {!community && !a.user_id && nextStage && (
                          <button
                            onClick={() => updateStage(a.id, nextStage)}
                            className="mt-2 w-full text-[11px] px-2 py-1 rounded-lg font-medium text-white"
                            style={{ background: dashboardTheme.color.primary }}
                          >
                            Move to {STAGE_LABELS[nextStage]}
                          </button>
                        )}
                        {!community && a.stage === 'ready' && !a.user_id && (
                          <button
                            onClick={() => activateApplicant(a)}
                            disabled={activating === a.id}
                            className="mt-1 w-full text-[11px] px-2 py-1 rounded-lg font-medium border disabled:opacity-50"
                            style={{ background: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }}
                          >
                            {activating === a.id ? 'Sending...' : 'Convert to Staff'}
                          </button>
                        )}
                        {!community && a.user_id && (
                          <Link
                            href="/dashboard/onboarding"
                            className="mt-2 block w-full text-[11px] px-2 py-1 rounded-lg font-medium text-center border"
                            style={{ borderColor: '#BFDBFE', background: '#EFF6FF', color: '#1D4ED8' }}
                          >
                            Open linked onboarding
                          </Link>
                        )}
                      </div>
                    );
                  })}
                  {stageApplicants.length === 0 && (
                    <div className="p-4 text-center rounded-xl border-2 border-dashed border-slate-200">
                      <p className="text-[11px] text-slate-400">Empty</p>
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
              {filtered.map((a) => {
                const sc = STAGE_COLORS[a.stage] || STAGE_COLORS.intake;
                const nextStage = STAGES[STAGES.indexOf(a.stage) + 1];
                const community = isCommunity(a.role);
                const displayStage = community && COMMUNITY_STAGE_LABELS[a.stage] ? COMMUNITY_STAGE_LABELS[a.stage] : STAGE_LABELS[a.stage];
                const onboardingMeta = !community ? crewJourneyMeta(a) : null;
                return (
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{a.full_name}</p>
                      <p className="text-[11px] text-slate-500">{a.email}</p>
                      {community && a.quality_business_name && (
                        <p className="text-[11px] text-slate-400">{a.quality_business_name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={a.role} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: sc.bg, color: sc.fg }}>
                          {displayStage ?? a.stage}
                        </span>
                        {onboardingMeta && (
                          <div className="text-[11px]" style={{ color: onboardingMeta.fg }}>
                            {onboardingMeta.label}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(a.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Community actions */}
                        {community && a.stage === 'intake' && (
                          <button
                            onClick={() => updateStage(a.id, 'verify')}
                            className="text-xs px-2 py-1 rounded-lg text-white"
                            style={{ background: '#4338CA' }}
                          >
                            Mark contacted
                          </button>
                        )}
                        {community && (
                          <a
                            href={`mailto:${a.email}`}
                            className="text-xs px-2 py-1 rounded-lg border"
                            style={{ borderColor: '#E5E7EB', color: dashboardTheme.color.muted }}
                          >
                            Email
                          </a>
                        )}

                        {/* Crew actions */}
                        {!community && !a.user_id && nextStage && (
                          <button onClick={() => updateStage(a.id, nextStage)} className="text-xs px-2 py-1 rounded-lg text-white" style={{ background: dashboardTheme.color.primary }}>
                            Advance
                          </button>
                        )}
                        {!community && a.stage === 'ready' && !a.user_id && (
                          <button
                            onClick={() => activateApplicant(a)}
                            disabled={activating === a.id}
                            className="text-xs px-2 py-1 rounded-lg font-medium border disabled:opacity-50"
                            style={{ background: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }}
                          >
                            {activating === a.id ? 'Sending...' : 'Convert to Staff'}
                          </button>
                        )}
                        {!community && a.user_id && (
                          <Link
                            href="/dashboard/onboarding"
                            className="text-xs px-2 py-1 rounded-lg border"
                            style={{ borderColor: '#BFDBFE', background: '#EFF6FF', color: '#1D4ED8' }}
                          >
                            Open onboarding
                          </Link>
                        )}
                        <button
                          onClick={() => openMessaging({
                            entity_type: 'applicant',
                            entity_id: a.id,
                            display_name: a.full_name,
                          })}
                          className="text-xs px-2 py-1 rounded-lg border"
                          style={{ borderColor: '#D1FAE5', background: '#ECFDF5', color: '#065F46' }}
                        >
                          Message
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No entries found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
