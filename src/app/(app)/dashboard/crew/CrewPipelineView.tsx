'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';

type PipelineStage = 'intake' | 'verify' | 'paperwork' | 'induct' | 'ready';
type ReadinessStatus = 'ready' | 'waiting' | 'blocked' | 'inactive';
type CrewScore = 'good' | 'neutral' | 'risk';

type PipelinePerson = {
  id: string;
  applicantId: string | null;
  employeeId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  suburb: string | null;
  pipelineRole: string;
  defaultRole: string | null;
  employmentType: string | null;
  hourlyRate: number | null;
  rosterActive: boolean;
  stage: PipelineStage;
  readiness: {
    status: ReadinessStatus;
    label: string;
    detail: string;
  };
  score: CrewScore;
  availability: string;
  availabilitySlots: string[];
  capabilityTags: string[];
  flags: string[];
  note: string | null;
  timeInStage: string;
  stageAgeDays: number;
  onboarding: {
    currentSectionLabel: string | null;
    progress: {
      completed: number;
      total: number;
      currentStep: number;
    };
    missingRequiredDocs: number;
    missingRequiredDocLabels: string[];
  } | null;
  staffing: {
    assignable: boolean;
    assignedJobs: number;
    inProgressJobs: number;
    nextJobDate: string | null;
  };
  canAdvanceStage: boolean;
  canRewindStage: boolean;
  canRequestDocs: boolean;
  canScheduleInduction: boolean;
  canConvertToStaff: boolean;
  isApprovalAction: boolean;
  status: string | null;
};

type OrderOption = {
  id: string;
  customer_name: string;
  service_type: string;
  scheduled_date: string | null;
  status: string;
};

type ReadinessFilter = 'all' | ReadinessStatus;

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';
const STAGES: PipelineStage[] = ['intake', 'verify', 'paperwork', 'induct', 'ready'];
const STAGE_LABELS: Record<PipelineStage, string> = {
  intake: 'Intake',
  verify: 'Verify',
  paperwork: 'Paperwork',
  induct: 'Induct',
  ready: 'Ready',
};
const STAGE_COLORS: Record<PipelineStage, { bg: string; fg: string }> = {
  intake: { bg: '#F1F5F9', fg: '#475569' },
  verify: { bg: '#DBEAFE', fg: '#1D4ED8' },
  paperwork: { bg: '#FEF3C7', fg: '#92400E' },
  induct: { bg: '#E0E7FF', fg: '#3730A3' },
  ready: { bg: '#ECFDF5', fg: '#065F46' },
};
const READINESS_COLORS: Record<ReadinessStatus, { bg: string; fg: string }> = {
  ready: { bg: '#ECFDF5', fg: '#047857' },
  waiting: { bg: '#EFF6FF', fg: '#1D4ED8' },
  blocked: { bg: '#FEF2F2', fg: '#B91C1C' },
  inactive: { bg: '#F1F5F9', fg: '#475569' },
};
const SCORE_META: Record<CrewScore, { label: string; bg: string; fg: string }> = {
  good: { label: 'Good', bg: '#ECFDF5', fg: '#047857' },
  neutral: { label: 'Neutral', bg: '#EFF6FF', fg: '#1D4ED8' },
  risk: { label: 'Risk', bg: '#FEF2F2', fg: '#B91C1C' },
};
const EMPLOYMENT_OPTIONS = [
  { value: 'casual', label: 'Casual' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'full_time', label: 'Full-time' },
];

function titleize(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No job scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No job scheduled';
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function formatEmploymentType(value: string | null | undefined) {
  if (!value) return null;
  const option = EMPLOYMENT_OPTIONS.find((item) => item.value === value);
  return option?.label || value.replace('_', ' ');
}

function sanitizePhone(value: string | null | undefined) {
  return (value || '').replace(/[^\d+]/g, '');
}

function buildMessageHref(person: PipelinePerson) {
  if (person.phone) {
    return `sms:${sanitizePhone(person.phone)}`;
  }
  if (person.email) {
    return `mailto:${person.email}?subject=${encodeURIComponent(`Buds At Work update for ${person.fullName}`)}`;
  }
  return null;
}

function buildRequestDocsHref(person: PipelinePerson) {
  if (!person.email) return null;
  const body = [
    `Hi ${person.fullName},`,
    '',
    'We need a few final items to keep your Buds At Work setup moving.',
    `Current stage: ${STAGE_LABELS[person.stage]}.`,
    person.onboarding?.missingRequiredDocs
      ? `Missing required documents: ${person.onboarding.missingRequiredDocs}.`
      : 'Please reply with the outstanding documents when ready.',
    '',
    'Thanks,',
    'Buds At Work',
  ].join('\n');
  return `mailto:${person.email}?subject=${encodeURIComponent('Buds At Work documents request')}&body=${encodeURIComponent(body)}`;
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-lg rounded-3xl border border-black/10 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold" style={{ color: brand.text }}>{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm" style={{ color: brand.muted }}>
            Close
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function CrewPipelineView() {
  const router = useRouter();
  const [pipeline, setPipeline] = useState<PipelinePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>('all');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<PipelinePerson | null>(null);
  const [assignTarget, setAssignTarget] = useState<PipelinePerson | null>(null);
  const [availableOrders, setAvailableOrders] = useState<OrderOption[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [convertForm, setConvertForm] = useState({
    defaultRole: '',
    employmentType: 'casual',
    hourlyRate: '25',
    rosterActive: true,
  });

  const [contractTarget, setContractTarget] = useState<PipelinePerson | null>(null);
  const [contractSending, setContractSending] = useState(false);
  const [contractForm, setContractForm] = useState({
    contractType: 'pay_amendment' as 'pay_amendment' | 'employment_type_change' | 'role_change' | 'general_amendment',
    newRate: '',
    newEmploymentType: '',
    newRole: '',
    effectiveDate: '',
    notes: '',
  });

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crew/pipeline');
      if (!res.ok) throw new Error('Failed to load crew pipeline');
      const data = await res.json();
      setPipeline(data.pipeline || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load crew pipeline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return pipeline.filter((person) => {
      if (readinessFilter !== 'all' && person.readiness.status !== readinessFilter) return false;
      if (!normalized) return true;
      const haystack = [
        person.fullName,
        person.email,
        person.suburb,
        person.defaultRole,
        person.pipelineRole,
        ...person.capabilityTags,
        ...person.flags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [pipeline, query, readinessFilter]);

  const grouped = useMemo(
    () =>
      STAGES.reduce<Record<PipelineStage, PipelinePerson[]>>((acc, stage) => {
        acc[stage] = filtered.filter((person) => person.stage === stage);
        return acc;
      }, { intake: [], verify: [], paperwork: [], induct: [], ready: [] }),
    [filtered],
  );

  const summary = useMemo(
    () => ({
      total: pipeline.length,
      ready: pipeline.filter((person) => person.readiness.status === 'ready').length,
      blocked: pipeline.filter((person) => person.readiness.status === 'blocked').length,
      waiting: pipeline.filter((person) => person.readiness.status === 'waiting').length,
      activeRoster: pipeline.filter((person) => person.staffing.assignable).length,
    }),
    [pipeline],
  );

  const openConvertModal = (person: PipelinePerson) => {
    setConvertTarget(person);
    setConvertForm({
      defaultRole: person.defaultRole || person.capabilityTags[0] || '',
      employmentType: person.employmentType || 'casual',
      hourlyRate: person.hourlyRate != null ? String(person.hourlyRate) : '25',
      rosterActive: person.employeeId ? person.rosterActive : true,
    });
  };

  const openAssignModal = async (person: PipelinePerson) => {
    setAssignTarget(person);
    setOrdersLoading(true);
    try {
      const res = await fetch('/api/orders?unscheduled=true&limit=25');
      if (!res.ok) throw new Error('Failed to load open jobs');
      const data = await res.json();
      setAvailableOrders(data.orders || []);
    } catch {
      toast.error('Could not load open jobs');
      setAvailableOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const updateStage = async (person: PipelinePerson, stage: PipelineStage) => {
    if (!person.applicantId) return;
    setWorkingId(person.id);
    try {
      const res = await fetch(`/api/applicants/${person.applicantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update stage');
      toast.success(`Moved to ${STAGE_LABELS[stage]}`);
      await fetchPipeline();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update stage');
    } finally {
      setWorkingId(null);
    }
  };

  const scheduleInduction = async (person: PipelinePerson) => {
    if (person.stage !== 'induct' && person.applicantId) {
      await updateStage(person, 'induct');
    }
    router.push('/dashboard/inductions');
  };

  const submitConversion = async () => {
    if (!convertTarget) return;
    const hourlyRate = Number(convertForm.hourlyRate);
    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
      toast.error('Enter a valid hourly rate');
      return;
    }

    const payload = {
      default_role: convertForm.defaultRole.trim() || null,
      employment_type: convertForm.employmentType,
      hourly_rate: hourlyRate,
      roster_active: convertForm.rosterActive,
    };

    setWorkingId(convertTarget.id);
    try {
      const url = convertTarget.employeeId
        ? `/api/crew/employees/${convertTarget.employeeId}/approve`
        : `/api/applicants/${convertTarget.applicantId}/activate`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to convert to staff');
      toast.success(convertTarget.employeeId ? 'Crew member converted to staff' : 'Staff invite sent and setup saved');
      setConvertTarget(null);
      await fetchPipeline();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to convert to staff');
    } finally {
      setWorkingId(null);
    }
  };

  const assignOrder = async (orderId: string) => {
    if (!assignTarget?.employeeId) return;
    setWorkingId(assignTarget.id);
    try {
      const res = await fetch(`/api/orders/${orderId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_ids: [assignTarget.employeeId] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to assign job');
      toast.success('Job assigned');
      setAssignTarget(null);
      await fetchPipeline();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign job');
    } finally {
      setWorkingId(null);
    }
  };

  const openContractModal = (person: PipelinePerson) => {
    setContractTarget(person);
    setContractForm({
      contractType: 'pay_amendment',
      newRate: person.hourlyRate != null ? String(person.hourlyRate) : '',
      newEmploymentType: person.employmentType || 'casual',
      newRole: person.defaultRole || '',
      effectiveDate: '',
      notes: '',
    });
  };

  const submitContract = async () => {
    if (!contractTarget?.employeeId) return;
    setContractSending(true);
    try {
      const payload: Record<string, unknown> = {
        employee_id: contractTarget.employeeId,
        contract_type: contractForm.contractType,
        effective_date: contractForm.effectiveDate || undefined,
        notes: contractForm.notes || undefined,
      };
      if (contractForm.contractType === 'pay_amendment') {
        const rate = Number(contractForm.newRate);
        if (!rate || rate <= 0) { toast.error('Enter a valid new hourly rate'); return; }
        payload.new_rate = rate;
      }
      if (contractForm.contractType === 'employment_type_change') {
        if (!contractForm.newEmploymentType) { toast.error('Select a new employment type'); return; }
        payload.new_employment_type = contractForm.newEmploymentType;
      }
      if (contractForm.contractType === 'role_change') {
        if (!contractForm.newRole.trim()) { toast.error('Enter the new role title'); return; }
        payload.new_role = contractForm.newRole.trim();
      }

      const res = await fetch('/api/admin/docusign/send-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to send contract');
      toast.success(`Contract sent to ${contractTarget.fullName} via DocuSign`);
      setContractTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send contract');
    } finally {
      setContractSending(false);
    }
  };

  return (
    <div className="grid gap-5 px-4 pb-14 md:px-10 lg:px-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: brand.primary }}>Crew Pipeline</h1>
          <p className="mt-1 text-sm" style={{ color: brand.muted }}>
            One continuous flow from first enquiry to deployable crew, with readiness and staffing actions built in.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search crew, suburb, role"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none sm:w-64"
            style={{ borderColor: brand.border, color: brand.text, background: 'white' }}
          />
          <button
            onClick={() => fetchPipeline()}
            className="rounded-xl border px-3 py-2 text-sm font-medium"
            style={{ borderColor: brand.border, color: brand.muted, background: 'white' }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'People', value: summary.total, color: brand.primary },
          { label: 'Ready now', value: summary.ready, color: '#047857' },
          { label: 'Blocked', value: summary.blocked, color: '#B91C1C' },
          { label: 'Waiting', value: summary.waiting, color: '#1D4ED8' },
          { label: 'Assignable', value: summary.activeRoster, color: '#0F766E' },
        ].map((card) => (
          <div key={card.label} className={`${glass} p-4`}>
            <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: brand.muted }}>{card.label}</p>
            <p className="mt-2 text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'ready', 'waiting', 'blocked', 'inactive'] as ReadinessFilter[]).map((item) => (
          <button
            key={item}
            onClick={() => setReadinessFilter(item)}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
            style={
              readinessFilter === item
                ? { background: brand.primary, borderColor: brand.primary, color: 'white' }
                : { background: 'white', borderColor: '#E5E7EB', color: brand.muted }
            }
          >
            {item === 'all' ? 'All' : item === 'ready' ? 'Ready to work' : item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, minmax(260px, 1fr))' }}>
          {STAGES.map((stage) => (
            <div key={stage} className="space-y-3">
              <div className="h-8 rounded-xl bg-white/70 animate-pulse" />
              <div className="h-64 rounded-2xl bg-white/70 animate-pulse" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className={`${glass} p-8 text-center`}>
          <p className="text-sm" style={{ color: brand.muted }}>{error}</p>
          <button onClick={() => fetchPipeline()} className="mt-3 text-sm font-medium" style={{ color: brand.primary }}>
            Try again
          </button>
        </div>
      ) : (
        <div className="grid gap-3 overflow-x-auto" style={{ gridTemplateColumns: 'repeat(5, minmax(280px, 1fr))' }}>
          {STAGES.map((stage) => {
            const stagePeople = grouped[stage];
            const sc = STAGE_COLORS[stage];
            return (
              <div key={stage} className="min-w-[280px] space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-black/5 bg-white/70 px-3 py-2">
                  <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: sc.bg, color: sc.fg }}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="text-xs" style={{ color: brand.muted }}>{stagePeople.length}</span>
                </div>

                {stagePeople.length === 0 ? (
                  <div className={`${glass} border-dashed p-5 text-center`}>
                    <p className="text-xs" style={{ color: brand.muted }}>No one in {STAGE_LABELS[stage].toLowerCase()}.</p>
                  </div>
                ) : (
                  stagePeople.map((person) => {
                    const readinessColor = READINESS_COLORS[person.readiness.status];
                    const score = SCORE_META[person.score];
                    const messageHref = buildMessageHref(person);
                    const requestDocsHref = buildRequestDocsHref(person);
                    const prevStage = person.canRewindStage ? STAGES[STAGES.indexOf(person.stage) - 1] : null;
                    const nextStage = person.canAdvanceStage ? STAGES[STAGES.indexOf(person.stage) + 1] : null;
                    return (
                      <div key={person.id} className={`${glass} p-3.5`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold" style={{ color: brand.text }}>{person.fullName}</p>
                            <p className="mt-0.5 text-[11px]" style={{ color: brand.muted }}>
                              {person.defaultRole || person.pipelineRole}
                              {person.suburb ? ` · ${person.suburb}` : ''}
                            </p>
                          </div>
                          <span
                            className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold"
                            style={{ background: readinessColor.bg, color: readinessColor.fg }}
                          >
                            {person.readiness.label}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
                          <span style={{ color: brand.muted }}>{person.timeInStage}</span>
                          <span className="rounded-full px-2 py-1 font-semibold" style={{ background: score.bg, color: score.fg }}>
                            {score.label}
                          </span>
                        </div>

                        <div className="mt-2 rounded-xl px-3 py-2" style={{ background: '#F8FBF9' }}>
                          <div className="flex items-start justify-between gap-3 text-[11px]">
                            <span className="shrink-0 pt-0.5" style={{ color: brand.muted }}>Availability</span>
                            {person.availabilitySlots.length > 0 ? (
                              <div className="flex flex-col items-end gap-0.5">
                                {person.availabilitySlots.map((slot) => {
                                  const m = slot.match(/^(\w{3}):(\d{2}:\d{2})-(\d{2}:\d{2})$/);
                                  const lm = slot.match(/^(\w{3})_(am|pm)$/);
                                  const dayLabels: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
                                  if (m) return <span key={slot} style={{ color: '#047857' }}>{dayLabels[m[1]] || m[1]} {m[2]}–{m[3]}</span>;
                                  if (lm) return <span key={slot} style={{ color: '#047857' }}>{dayLabels[lm[1]] || lm[1]} {lm[2].toUpperCase()}</span>;
                                  return <span key={slot} style={{ color: '#047857' }}>{slot}</span>;
                                })}
                              </div>
                            ) : (
                              <span style={{ color: '#64748B' }}>Not set</span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3 text-[11px]">
                            <span style={{ color: brand.muted }}>Deployability</span>
                            <span style={{ color: brand.text }}>
                              {person.staffing.assignable ? 'Can assign now' : person.readiness.detail}
                            </span>
                          </div>
                          {(person.employmentType || person.hourlyRate != null) && (
                            <div className="mt-1 flex items-center justify-between gap-3 text-[11px]">
                              <span style={{ color: brand.muted }}>Staff setup</span>
                              <span style={{ color: brand.text }}>
                                {[formatEmploymentType(person.employmentType), person.hourlyRate != null ? `$${person.hourlyRate}/hr` : null].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                          )}
                        </div>

                        {person.capabilityTags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {person.capabilityTags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full border px-2 py-1 text-[10px] font-medium"
                                style={{ borderColor: '#D7E7DD', background: '#F4FBF6', color: brand.primary }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {person.flags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {person.flags.map((flag) => (
                              <span
                                key={flag}
                                className="rounded-full px-2 py-1 text-[10px]"
                                style={{ background: '#F1F5F9', color: '#475569' }}
                              >
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}

                        {person.onboarding && (
                          <div className="mt-3 rounded-xl border border-slate-100 bg-white/70 px-3 py-2 text-[11px]">
                            <div className="flex items-center justify-between gap-3">
                              <span style={{ color: brand.muted }}>Onboarding</span>
                              <span style={{ color: brand.text }}>
                                {person.onboarding.progress.completed}/{person.onboarding.progress.total}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-3">
                              <span style={{ color: brand.muted }}>
                                {person.onboarding.currentSectionLabel ? `Current: ${person.onboarding.currentSectionLabel}` : 'All sections complete'}
                              </span>
                              {person.onboarding.missingRequiredDocs > 0 && (
                                <span className="font-semibold" style={{ color: '#B45309' }}>
                                  {person.onboarding.missingRequiredDocs} doc{person.onboarding.missingRequiredDocs === 1 ? '' : 's'} missing
                                </span>
                              )}
                            </div>
                            {person.onboarding.missingRequiredDocLabels && person.onboarding.missingRequiredDocLabels.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {person.onboarding.missingRequiredDocLabels.map((label: string) => (
                                  <span
                                    key={label}
                                    className="rounded px-1.5 py-0.5"
                                    style={{ background: '#FEF3C7', color: '#92400E' }}
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {person.staffing.assignedJobs > 0 && (
                          <div className="mt-3 rounded-xl px-3 py-2 text-[11px]" style={{ background: '#F8FBF9' }}>
                            <div className="flex items-center justify-between gap-3">
                              <span style={{ color: brand.muted }}>Assignments</span>
                              <span style={{ color: brand.text }}>
                                {person.staffing.assignedJobs} total · {person.staffing.inProgressJobs} active
                              </span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-3">
                              <span style={{ color: brand.muted }}>Next job</span>
                              <span style={{ color: brand.text }}>{formatDate(person.staffing.nextJobDate)}</span>
                            </div>
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-2">
                          {person.staffing.assignable && person.employeeId && (
                            <button
                              onClick={() => openAssignModal(person)}
                              className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white"
                              style={{ background: brand.primary }}
                            >
                              Assign to job
                            </button>
                          )}
                          {person.employeeId && (
                            <a
                              href={`/dashboard/crew/${person.employeeId}/documents`}
                              className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
                              style={{ borderColor: brand.border, color: brand.accent }}
                            >
                              View documents
                            </a>
                          )}
                          {person.employeeId && person.email && (
                            <button
                              onClick={() => openContractModal(person)}
                              className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
                              style={{ borderColor: '#C7D2FE', background: '#EEF2FF', color: '#4338CA' }}
                            >
                              Send contract
                            </button>
                          )}
                          {messageHref && (
                            <a
                              href={messageHref}
                              className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
                              style={{ borderColor: '#E5E7EB', color: brand.muted }}
                            >
                              Send message
                            </a>
                          )}
                          {person.canRequestDocs && requestDocsHref && (
                            <a
                              href={requestDocsHref}
                              className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
                              style={{ borderColor: '#FDE68A', background: '#FFF7ED', color: '#9A3412' }}
                            >
                              Request docs
                            </a>
                          )}
                          {person.canScheduleInduction && (
                            <button
                              onClick={() => scheduleInduction(person)}
                              className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
                              style={{ borderColor: '#C7D2FE', background: '#EEF2FF', color: '#4338CA' }}
                            >
                              Schedule induction
                            </button>
                          )}
                          {person.canConvertToStaff && (
                            <button
                              onClick={() => openConvertModal(person)}
                              className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
                              style={
                                person.isApprovalAction && person.onboarding?.missingRequiredDocs === 0
                                  ? { background: '#047857', color: 'white', borderColor: '#047857' }
                                  : { borderColor: '#BBF7D0', background: '#ECFDF5', color: '#047857' }
                              }
                            >
                              {person.isApprovalAction ? 'Approve crew access' : 'Convert to Staff'}
                            </button>
                          )}
                        </div>

                        {person.applicantId && (
                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                            <button
                              disabled={!person.canRewindStage || workingId === person.id}
                              onClick={() => prevStage && updateStage(person, prevStage)}
                              className="rounded-lg px-2 py-1 text-[11px] font-medium disabled:opacity-40"
                              style={{ color: brand.muted }}
                            >
                              Move back
                            </button>
                            <button
                              disabled={!person.canAdvanceStage || workingId === person.id}
                              onClick={() => nextStage && updateStage(person, nextStage)}
                              className="rounded-lg px-2 py-1 text-[11px] font-medium disabled:opacity-40"
                              style={{ color: brand.primary }}
                            >
                              Move forward
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      {convertTarget && (
        <ModalShell
          title={convertTarget.isApprovalAction ? `Approve ${convertTarget.fullName} for crew access` : `Convert ${convertTarget.fullName} to staff`}
          onClose={() => setConvertTarget(null)}
        >
          <div className="space-y-4">
            <p className="text-sm leading-6" style={{ color: brand.muted }}>
              {convertTarget.isApprovalAction
                ? 'Confirm their role and pay setup, then approve to unlock the full crew portal. You can still request specific documents after approval.'
                : 'Save the core staff setup now so the crew member lands with a default role, pay settings, and roster status instead of just a label change.'}
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: brand.text }}>Default role</label>
              <input
                value={convertForm.defaultRole}
                onChange={(event) => setConvertForm((prev) => ({ ...prev, defaultRole: event.target.value }))}
                placeholder="e.g. Team Lead, Window Cleaning"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: brand.border }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: brand.text }}>Employment type</label>
                <select
                  value={convertForm.employmentType}
                  onChange={(event) => setConvertForm((prev) => ({ ...prev, employmentType: event.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: brand.border }}
                >
                  {EMPLOYMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: brand.text }}>Hourly rate</label>
                <input
                  value={convertForm.hourlyRate}
                  onChange={(event) => setConvertForm((prev) => ({ ...prev, hourlyRate: event.target.value }))}
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: brand.border }}
                />
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-xl border px-3 py-3" style={{ borderColor: brand.border }}>
              <input
                checked={convertForm.rosterActive}
                onChange={(event) => setConvertForm((prev) => ({ ...prev, rosterActive: event.target.checked }))}
                type="checkbox"
                className="mt-1 h-4 w-4 accent-emerald-700"
              />
              <div>
                <p className="text-sm font-medium" style={{ color: brand.text }}>Add to active crew roster</p>
                <p className="text-xs" style={{ color: brand.muted }}>
                  When on, this person becomes available for scheduling as soon as they are approved.
                </p>
              </div>
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConvertTarget(null)}
                className="rounded-xl border px-3 py-2 text-sm font-medium"
                style={{ borderColor: brand.border, color: brand.muted }}
              >
                Cancel
              </button>
              <button
                onClick={submitConversion}
                disabled={workingId === convertTarget.id}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: brand.primary }}
              >
                {workingId === convertTarget.id
                  ? (convertTarget.isApprovalAction ? 'Approving…' : 'Saving…')
                  : (convertTarget.isApprovalAction ? 'Approve crew access' : 'Save and continue')}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {assignTarget && (
        <ModalShell title={`Assign ${assignTarget.fullName} to a job`} onClose={() => setAssignTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm" style={{ color: brand.muted }}>
              Open jobs are filtered toward this crew member’s current capabilities so dispatch stays quick.
            </p>
            {ordersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-2xl bg-slate-100" />)}
              </div>
            ) : availableOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-6 text-center text-sm" style={{ borderColor: brand.border, color: brand.muted }}>
                No open jobs right now.
              </div>
            ) : (
              <div className="max-h-[360px] space-y-2 overflow-y-auto">
                {availableOrders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => assignOrder(order.id)}
                    disabled={workingId === assignTarget.id}
                    className="w-full rounded-2xl border px-4 py-3 text-left transition hover:bg-slate-50 disabled:opacity-60"
                    style={{ borderColor: brand.border }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: brand.text }}>{order.customer_name}</p>
                        <p className="mt-0.5 text-[11px]" style={{ color: brand.muted }}>
                          {titleize(order.service_type)} · {titleize(order.status)}
                        </p>
                      </div>
                      <span className="text-[11px]" style={{ color: brand.muted }}>
                        {formatDate(order.scheduled_date)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ModalShell>
      )}

      {contractTarget && (
        <ModalShell
          title={`Send contract to ${contractTarget.fullName}`}
          onClose={() => setContractTarget(null)}
        >
          <div className="space-y-4">
            <p className="text-sm leading-6" style={{ color: brand.muted }}>
              The contract will be emailed to <strong>{contractTarget.email}</strong> via DocuSign for electronic signature. A copy goes to admin@budsatwork.com once signed.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: brand.text }}>Contract type</label>
              <select
                value={contractForm.contractType}
                onChange={(e) => setContractForm((prev) => ({ ...prev, contractType: e.target.value as typeof contractForm.contractType }))}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: brand.border }}
              >
                <option value="pay_amendment">Pay Rate Amendment</option>
                <option value="employment_type_change">Change of Employment Type</option>
                <option value="role_change">Change of Role</option>
                <option value="general_amendment">General Employment Amendment</option>
              </select>
            </div>

            {contractForm.contractType === 'pay_amendment' && (
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: brand.text }}>New hourly rate ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={contractForm.newRate}
                  onChange={(e) => setContractForm((prev) => ({ ...prev, newRate: e.target.value }))}
                  placeholder="e.g. 32.50"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: brand.border }}
                />
                {contractTarget.hourlyRate != null && (
                  <p className="mt-1 text-xs" style={{ color: brand.muted }}>
                    Current rate: ${contractTarget.hourlyRate}/hr
                  </p>
                )}
              </div>
            )}

            {contractForm.contractType === 'employment_type_change' && (
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: brand.text }}>New employment type</label>
                <select
                  value={contractForm.newEmploymentType}
                  onChange={(e) => setContractForm((prev) => ({ ...prev, newEmploymentType: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: brand.border }}
                >
                  {EMPLOYMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {contractTarget.employmentType && (
                  <p className="mt-1 text-xs" style={{ color: brand.muted }}>
                    Current type: {formatEmploymentType(contractTarget.employmentType)}
                  </p>
                )}
              </div>
            )}

            {contractForm.contractType === 'role_change' && (
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: brand.text }}>New role title</label>
                <input
                  value={contractForm.newRole}
                  onChange={(e) => setContractForm((prev) => ({ ...prev, newRole: e.target.value }))}
                  placeholder="e.g. Senior Cleaner, Team Lead"
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: brand.border }}
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: brand.text }}>Effective date</label>
              <input
                type="date"
                value={contractForm.effectiveDate}
                onChange={(e) => setContractForm((prev) => ({ ...prev, effectiveDate: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: brand.border }}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" style={{ color: brand.text }}>Additional notes (optional)</label>
              <textarea
                value={contractForm.notes}
                onChange={(e) => setContractForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Any other terms, context, or conditions to include in the contract…"
                rows={3}
                className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: brand.border }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setContractTarget(null)}
                className="rounded-xl border px-3 py-2 text-sm font-medium"
                style={{ borderColor: brand.border, color: brand.muted }}
              >
                Cancel
              </button>
              <button
                onClick={submitContract}
                disabled={contractSending}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: '#4338CA' }}
              >
                {contractSending ? 'Sending…' : 'Send via DocuSign'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
