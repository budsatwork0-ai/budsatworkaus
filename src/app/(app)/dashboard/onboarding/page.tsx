'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { brand } from '@/app/ui/theme';

type EmployeeCard = {
  id: string;
  full_name: string;
  email: string;
  suburb: string | null;
  services: string[] | null;
  status: string;
  onboarding_complete: boolean;
  crew_access_approved: boolean;
  created_at: string;
  progress: {
    completed: number;
    total: number;
    currentStep: number;
  };
  currentSection: string | null;
  currentSectionLabel: string | null;
  sections: Array<{
    section: string;
    label: string;
    completed: boolean;
  }>;
  requiredDocuments: Array<{
    docType: string;
    label: string;
    submitted: boolean;
    fileUrl: string | null;
  }>;
  awaitingApproval: boolean;
  canApproveCrewAccess: boolean;
  crewPortalEnabled: boolean;
};

type FilterKey = 'all' | 'in_progress' | 'awaiting_approval' | 'approved';

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

function statusMeta(employee: EmployeeCard) {
  if (employee.crewPortalEnabled) {
    return { label: 'Crew active', bg: '#ECFDF5', fg: '#047857' };
  }
  if (employee.awaitingApproval) {
    return { label: 'Awaiting approval', bg: '#DBEAFE', fg: '#1D4ED8' };
  }
  return { label: 'In progress', bg: '#FEF3C7', fg: '#92400E' };
}

export default function OnboardingPipelinePage() {
  const [employees, setEmployees] = useState<EmployeeCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [approving, setApproving] = useState<string | null>(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/crew/employees');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setEmployees(data.employees || []);
      setError(null);
    } catch {
      setError('Could not load onboarding progress');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'in_progress':
        return employees.filter((employee) => !employee.awaitingApproval && !employee.crewPortalEnabled);
      case 'awaiting_approval':
        return employees.filter((employee) => employee.awaitingApproval);
      case 'approved':
        return employees.filter((employee) => employee.crewPortalEnabled);
      default:
        return employees;
    }
  }, [employees, filter]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const aRank = a.awaitingApproval ? 0 : a.crewPortalEnabled ? 2 : 1;
        const bRank = b.awaitingApproval ? 0 : b.crewPortalEnabled ? 2 : 1;
        if (aRank !== bRank) return aRank - bRank;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }),
    [filtered],
  );

  async function approveEmployee(id: string) {
    setApproving(id);
    try {
      const res = await fetch(`/api/crew/employees/${id}/approve`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Unable to approve employee');
      }
      await fetchEmployees();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to approve employee');
    } finally {
      setApproving(null);
    }
  }

  const summary = {
    total: employees.length,
    inProgress: employees.filter((employee) => !employee.awaitingApproval && !employee.crewPortalEnabled).length,
    awaitingApproval: employees.filter((employee) => employee.awaitingApproval).length,
    activeCrew: employees.filter((employee) => employee.crewPortalEnabled).length,
  };

  return (
    <div className="min-h-screen" style={{ background: brand.bg }}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>Crew onboarding</h1>
          <p className="text-sm md:text-base mt-1" style={{ color: brand.muted }}>
            Live onboarding progress from each employee’s actual crew onboarding steps.
          </p>
        </div>
        <button
          className="px-3 py-2 rounded-lg border"
          style={{ borderColor: brand.border, color: brand.muted }}
          onClick={() => {
            setLoading(true);
            fetchEmployees();
          }}
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total', value: summary.total, color: brand.primary },
          { label: 'In progress', value: summary.inProgress, color: '#92400E' },
          { label: 'Awaiting approval', value: summary.awaitingApproval, color: '#1D4ED8' },
          { label: 'Crew active', value: summary.activeCrew, color: '#047857' },
        ].map((item) => (
          <div key={item.label} className={`${glass} rounded-2xl p-4`} style={{ background: brand.card, borderColor: 'rgba(0,0,0,0.08)' }}>
            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: brand.muted }}>{item.label}</p>
            <p className="text-2xl font-bold mt-2" style={{ color: item.color }}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-5">
        {[
          { key: 'all', label: 'All' },
          { key: 'in_progress', label: 'In Progress' },
          { key: 'awaiting_approval', label: 'Awaiting Approval' },
          { key: 'approved', label: 'Approved' },
        ].map((item) => (
          <button
            key={item.key}
            className={`px-3 py-1.5 rounded-lg border ${filter === item.key ? 'bg-black/5' : ''}`}
            style={{ borderColor: brand.border, color: filter === item.key ? brand.primary : brand.muted }}
            onClick={() => setFilter(item.key as FilterKey)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className={`${glass} rounded-2xl p-5 h-44 animate-pulse`} style={{ background: brand.card, borderColor: 'rgba(0,0,0,0.08)' }} />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: brand.muted }}>{error}</p>
          <button className="mt-2 text-sm underline" style={{ color: brand.primary }} onClick={() => { setLoading(true); fetchEmployees(); }}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          {sorted.map((employee) => {
            const meta = statusMeta(employee);
            const progressPct = employee.progress.total > 0
              ? Math.round((employee.progress.completed / employee.progress.total) * 100)
              : 0;

            return (
              <div
                key={employee.id}
                className={`${glass} rounded-3xl p-5 md:p-6`}
                style={{ background: brand.card, borderColor: 'rgba(0,0,0,0.08)' }}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold" style={{ color: brand.text }}>{employee.full_name}</h2>
                      <span
                        className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: meta.bg, color: meta.fg }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: brand.muted }}>
                      {employee.email}
                      {employee.suburb ? ` · ${employee.suburb}` : ''}
                      {employee.services?.length ? ` · ${employee.services.join(', ')}` : ''}
                    </p>

                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <p style={{ color: brand.text }}>
                          {employee.currentSectionLabel
                            ? `Step ${employee.progress.currentStep} of ${employee.progress.total}: ${employee.currentSectionLabel}`
                            : 'All onboarding steps completed'}
                        </p>
                        <span style={{ color: brand.muted }}>
                          {employee.progress.completed}/{employee.progress.total}
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(15,61,46,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: brand.primary }} />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {employee.sections.map((section) => (
                        <span
                          key={section.section}
                          className="px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{
                            background: section.completed ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
                            color: section.completed ? '#047857' : '#475569',
                          }}
                        >
                          {section.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="w-full lg:w-[320px] rounded-2xl border p-4" style={{ borderColor: brand.border, background: '#fff' }}>
                    <p className="text-sm font-semibold" style={{ color: brand.text }}>Required documents</p>
                    <div className="mt-3 space-y-2">
                      {employee.requiredDocuments.map((document) => (
                        <div key={document.docType} className="flex items-center justify-between gap-3 text-sm">
                          <span style={{ color: brand.muted }}>{document.label}</span>
                          <span style={{ color: document.submitted ? '#047857' : '#B45309' }}>
                            {document.submitted ? 'Submitted' : 'Missing'}
                          </span>
                        </div>
                      ))}
                    </div>

                    {employee.canApproveCrewAccess && (
                      <button
                        onClick={() => approveEmployee(employee.id)}
                        disabled={approving === employee.id}
                        className="mt-4 w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                        style={{ background: brand.primary }}
                      >
                        {approving === employee.id ? 'Approving...' : 'Convert to staff'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {sorted.length === 0 && (
            <div className="text-xs px-3 py-8 text-center rounded-lg border" style={{ borderColor: brand.border, color: brand.muted }}>
              No employees match this filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
