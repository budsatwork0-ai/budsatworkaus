/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { buildEmployeeOnboardingSnapshot } from '@/lib/crew-onboarding';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { createCrewRepository } from '@/lib/crew/repository';
import { SERVICE_TYPE_LABELS, type ServiceType } from '@/types/orders';

type PipelineStage = 'intake' | 'verify' | 'paperwork' | 'induct' | 'ready';
type ReadinessStatus = 'ready' | 'waiting' | 'blocked' | 'inactive';
type CrewScore = 'good' | 'neutral' | 'risk';

const CREW_ROLES = ['Casual crew', 'Support worker'] as const;
const PIPELINE_STAGES: PipelineStage[] = ['intake', 'verify', 'paperwork', 'induct', 'ready'];
function normalizeStage(value: string | null | undefined): PipelineStage {
  return PIPELINE_STAGES.includes(value as PipelineStage) ? (value as PipelineStage) : 'intake';
}

function titleize(value: string) {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function uniq(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())).map((value) => value.trim()))];
}

function formatCapability(service: string) {
  return SERVICE_TYPE_LABELS[service as ServiceType] || titleize(service);
}

function toStageAgeLabel(input: string | null | undefined) {
  const date = input ? new Date(input) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return { days: 0, label: 'Updated recently' };
  }

  const diff = Date.now() - date.getTime();
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  if (days <= 0) return { days: 0, label: 'Today' };
  if (days === 1) return { days: 1, label: '1 day' };
  return { days, label: `${days} days` };
}

function availabilityLabel(slots: string[], status: string | null | undefined) {
  if (status === 'suspended') return 'Unavailable';
  if (slots.length === 0) return 'Unavailable';
  const days = slots.map((s) => {
    const m = s.match(/^(\w{3}):/);
    if (!m) { const lm = s.match(/^(\w{3})_/); return lm ? lm[1] : null; }
    return m[1];
  }).filter(Boolean);
  const unique = [...new Set(days)];
  const labels: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  return unique.map((d) => labels[d!] || d).join(', ');
}

function extractNoteFlags(note: string | null | undefined) {
  if (!note) return [];
  return note
    .split(/\n|,|;/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function buildCapabilityTags({
  services,
  defaultRole,
  hasDriverCapability,
  ndisCleared,
}: {
  services: string[];
  defaultRole: string | null | undefined;
  hasDriverCapability: boolean;
  ndisCleared: boolean;
}) {
  const tags = [
    ...services.map(formatCapability),
    defaultRole && !services.some((service) => formatCapability(service) === defaultRole) ? defaultRole : null,
    hasDriverCapability ? 'Driver' : null,
    ndisCleared ? 'NDIS Cleared' : null,
  ];

  return uniq(tags).slice(0, 6);
}

function buildFlags({
  note,
  availability,
  needsTransport,
  hasOwnTransport,
  rosterActive,
}: {
  note: string | null | undefined;
  availability: string[];
  needsTransport: boolean;
  hasOwnTransport: boolean;
  rosterActive: boolean;
}) {
  const prefersWeekends = availability.some((slot) => slot.startsWith('sat') || slot.startsWith('sun'));

  return uniq([
    hasOwnTransport ? 'Has own transport' : null,
    needsTransport ? 'Needs transport' : null,
    prefersWeekends ? 'Prefers weekends' : null,
    !rosterActive ? 'Off roster' : null,
    ...extractNoteFlags(note),
  ]).slice(0, 3);
}

function buildReadinessMeta({
  stage,
  employee,
  onboarding,
  applicantMissingDocs,
}: {
  stage: PipelineStage;
  employee: any | null;
  onboarding: ReturnType<typeof buildEmployeeOnboardingSnapshot> | null;
  applicantMissingDocs: string[];
}) {
  const missingRequiredDocs = onboarding?.requiredDocuments.filter((document) => !document.submitted).length || 0;
  const blockedDocs = onboarding?.requiredDocuments.filter((document) => document.status === 'rejected' || document.status === 'expired').length || 0;
  const totalBlockers = applicantMissingDocs.length + missingRequiredDocs + blockedDocs;

  if (employee?.status === 'suspended' || (employee?.crew_access_approved && employee?.roster_active === false)) {
    return {
      status: 'inactive' as ReadinessStatus,
      label: 'Inactive',
      detail: employee?.roster_active === false ? 'Not in scheduling pool' : 'Suspended',
    };
  }

  if (stage === 'ready' && employee?.crew_access_approved && employee?.status === 'active') {
    return {
      status: 'ready' as ReadinessStatus,
      label: 'Ready to work',
      detail: employee?.default_role ? `${employee.default_role} in active roster` : 'In active roster',
    };
  }

  if (totalBlockers > 0) {
    return {
      status: 'blocked' as ReadinessStatus,
      label: 'Blocked',
      detail:
        blockedDocs > 0
          ? `${blockedDocs} document ${blockedDocs === 1 ? 'issue' : 'issues'}`
          : `${totalBlockers} item${totalBlockers === 1 ? '' : 's'} blocking progress`,
    };
  }

  if (onboarding?.awaitingApproval) {
    return {
      status: 'waiting' as ReadinessStatus,
      label: 'Waiting',
      detail: 'Awaiting final approval',
    };
  }

  if (employee && !onboarding?.onboardingComplete) {
    return {
      status: 'waiting' as ReadinessStatus,
      label: 'Waiting',
      detail: onboarding?.currentSection ? `Needs ${titleize(onboarding.currentSection)}` : 'Onboarding in progress',
    };
  }

  if (stage === 'ready' && !employee) {
    return {
      status: 'waiting' as ReadinessStatus,
      label: 'Waiting',
      detail: 'Invite pending',
    };
  }

  return {
    status: 'waiting' as ReadinessStatus,
    label: 'Waiting',
    detail: `In ${titleize(stage)}`,
  };
}

function buildCrewScore(readiness: ReadinessStatus, stageDays: number, availability: string[]) {
  if (readiness === 'blocked' || readiness === 'inactive' || stageDays >= 7) return 'risk' as CrewScore;
  if (readiness === 'ready' && availability.length > 0 && stageDays <= 3) return 'good' as CrewScore;
  return 'neutral' as CrewScore;
}

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser || (authUser.role !== 'admin' && authUser.role !== 'employee')) {
    return NextResponse.json({ error: 'Admin or employee access required' }, { status: 403 });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  const { data: applicants, error: applicantError } = await (client as any)
    .from('applicants')
    .select('id, full_name, email, phone, role, stage, suburb, availability, services, needs_transport, car_compliant, missing_docs, notes, user_id, created_at, updated_at')
    .in('role', CREW_ROLES)
    .order('created_at', { ascending: false });

  if (applicantError) {
    return NextResponse.json({ error: applicantError.message }, { status: 500 });
  }

  const { data: employees, error: employeeError } = await (client as any)
    .from('employees')
    .select('id, user_id, full_name, email, phone, suburb, availability, services, ndis_worker, onboarding_complete, crew_access_approved, hourly_rate, default_role, employment_type, roster_active, status, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (employeeError) {
    return NextResponse.json({ error: employeeError.message }, { status: 500 });
  }

  const employeeIds = (employees || []).map((employee: any) => employee.id);
  const userIdsWithApplicants = new Set(
    (applicants || [])
      .map((applicant: any) => applicant.user_id)
      .filter((value: string | null): value is string => Boolean(value)),
  );

  const crewRepository = createCrewRepository({ client });
  const [sectionsRes, documentsRes, assignmentsRes] = await Promise.all([
    employeeIds.length > 0
      ? (client as any)
          .from('employee_onboarding')
          .select('employee_id, section, completed')
          .in('employee_id', employeeIds)
      : Promise.resolve({ data: [] }),
    employeeIds.length > 0
      ? (client as any)
          .from('employee_documents')
          .select('employee_id, doc_type, storage_path, file_url, file_name, status, created_at, expires_at')
          .in('employee_id', employeeIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    crewRepository.listForPipeline(employeeIds),
  ]);

  const sectionsByEmployee = new Map<string, Array<{ section: string; completed: boolean }>>();
  const documentsByEmployee = new Map<string, Array<any>>();
  const assignmentsByEmployee = new Map<string, Array<any>>();

  for (const section of sectionsRes.data || []) {
    const list = sectionsByEmployee.get(section.employee_id) || [];
    list.push(section);
    sectionsByEmployee.set(section.employee_id, list);
  }

  for (const document of documentsRes.data || []) {
    const list = documentsByEmployee.get(document.employee_id) || [];
    list.push(document);
    documentsByEmployee.set(document.employee_id, list);
  }

  for (const assignment of assignmentsRes.data || []) {
    const list = assignmentsByEmployee.get(assignment.employee_id) || [];
    list.push({
      ...assignment,
      order: assignment.orders || null,
    });
    assignmentsByEmployee.set(assignment.employee_id, list);
  }

  const employeesByUserId = new Map<string, any>(
    (employees || [])
      .filter((employee: any) => employee.user_id)
      .map((employee: any) => [employee.user_id, employee]),
  );

  const items = (applicants || []).map((applicant: any) => {
    const employee = applicant.user_id ? employeesByUserId.get(applicant.user_id) || null : null;
    const onboarding = employee
      ? buildEmployeeOnboardingSnapshot({
          employee,
          sections: sectionsByEmployee.get(employee.id) || [],
          documents: documentsByEmployee.get(employee.id) || [],
        })
      : null;
    const availability = (employee?.availability || applicant.availability || []) as string[];
    const services = (employee?.services || applicant.services || []) as string[];
    const applicantMissingDocs = (applicant.missing_docs || []) as string[];
    const stage = normalizeStage(applicant.stage);
    const stageAge = toStageAgeLabel(applicant.updated_at || applicant.created_at);
    const docs = onboarding?.requiredDocuments || [];
    const hasDriverCapability = Boolean(applicant.car_compliant) || docs.some((document) => document.docType === 'drivers_license' && document.approved);
    const ndisCleared = docs.some((document) => document.docType === 'ndis_screening' && document.approved);
    const readiness = buildReadinessMeta({ stage, employee, onboarding, applicantMissingDocs });
    const score = buildCrewScore(readiness.status, stageAge.days, availability);
    const assignments = employee ? assignmentsByEmployee.get(employee.id) || [] : [];
    const nextJob = assignments
      .map((assignment) => assignment.order)
      .filter((order: any) => order?.scheduled_date)
      .sort((left: any, right: any) => new Date(left.scheduled_date).getTime() - new Date(right.scheduled_date).getTime())[0] || null;

    return {
      id: `applicant:${applicant.id}`,
      applicantId: applicant.id,
      employeeId: employee?.id || null,
      fullName: applicant.full_name,
      email: applicant.email,
      phone: applicant.phone,
      suburb: employee?.suburb || applicant.suburb || null,
      pipelineRole: applicant.role,
      defaultRole: employee?.default_role || null,
      employmentType: employee?.employment_type || null,
      hourlyRate: typeof employee?.hourly_rate === 'number' ? employee.hourly_rate : null,
      rosterActive: employee?.roster_active ?? false,
      stage,
      readiness,
      score,
      availability: availabilityLabel(availability, employee?.status),
      availabilitySlots: availability,
      capabilityTags: buildCapabilityTags({
        services,
        defaultRole: employee?.default_role,
        hasDriverCapability,
        ndisCleared,
      }),
      flags: buildFlags({
        note: applicant.notes,
        availability,
        needsTransport: Boolean(applicant.needs_transport),
        hasOwnTransport: hasDriverCapability && !applicant.needs_transport,
        rosterActive: employee?.roster_active ?? false,
      }),
      note: applicant.notes || null,
      stageAgeDays: stageAge.days,
      timeInStage: `In ${titleize(stage)} for ${stageAge.label}`,
      onboarding: onboarding
        ? {
            currentSectionLabel: onboarding.currentSection ? titleize(onboarding.currentSection) : null,
            progress: onboarding.progress,
            missingRequiredDocs: docs.filter((document) => !document.submitted).length,
            missingRequiredDocLabels: docs.filter((document) => !document.submitted).map((document) => document.label),
          }
        : null,
      staffing: {
        assignable: readiness.status === 'ready' && Boolean(employee?.crew_access_approved) && employee?.status === 'active' && employee?.roster_active !== false,
        assignedJobs: assignments.length,
        inProgressJobs: assignments.filter((assignment) => assignment.status === 'in_progress').length,
        nextJobDate: nextJob?.scheduled_date || null,
      },
      canAdvanceStage: PIPELINE_STAGES.indexOf(stage) < PIPELINE_STAGES.length - 1,
      canRewindStage: PIPELINE_STAGES.indexOf(stage) > 0,
      canRequestDocs: stage === 'verify' || stage === 'paperwork' || applicantMissingDocs.length > 0
        || Boolean(onboarding?.requiredDocuments.some((document) => !document.submitted))
        || Boolean(onboarding?.requiredDocuments.some((document) => document.status === 'rejected' || document.status === 'expired')),
      canScheduleInduction: stage === 'paperwork' || stage === 'induct',
      canConvertToStaff: !employee?.crew_access_approved && (stage === 'ready' || Boolean(onboarding?.awaitingApproval)),
      isApprovalAction: Boolean(employee && !employee.crew_access_approved),
      status: employee?.status || null,
    };
  });

  const standaloneEmployees = (employees || [])
    .filter((employee: any) => !employee.user_id || !userIdsWithApplicants.has(employee.user_id))
    .map((employee: any) => {
      const onboarding = buildEmployeeOnboardingSnapshot({
        employee,
        sections: sectionsByEmployee.get(employee.id) || [],
        documents: documentsByEmployee.get(employee.id) || [],
      });
      const availability = (employee.availability || []) as string[];
      const stageAge = toStageAgeLabel(employee.updated_at || employee.created_at);
      const docs = onboarding.requiredDocuments;
      const hasDriverCapability = docs.some((document) => document.docType === 'drivers_license' && document.approved);
      const ndisCleared = docs.some((document) => document.docType === 'ndis_screening' && document.approved);
      const readiness = buildReadinessMeta({
        stage: 'ready',
        employee,
        onboarding,
        applicantMissingDocs: [],
      });
      const score = buildCrewScore(readiness.status, stageAge.days, availability);
      const assignments = assignmentsByEmployee.get(employee.id) || [];
      const nextJob = assignments
        .map((assignment) => assignment.order)
        .filter((order: any) => order?.scheduled_date)
        .sort((left: any, right: any) => new Date(left.scheduled_date).getTime() - new Date(right.scheduled_date).getTime())[0] || null;

      return {
        id: `employee:${employee.id}`,
        applicantId: null,
        employeeId: employee.id,
        fullName: employee.full_name,
        email: employee.email,
        phone: employee.phone,
        suburb: employee.suburb || null,
        pipelineRole: 'Crew',
        defaultRole: employee.default_role || null,
        employmentType: employee.employment_type || null,
        hourlyRate: typeof employee.hourly_rate === 'number' ? employee.hourly_rate : null,
        rosterActive: employee.roster_active ?? false,
        stage: 'ready' as PipelineStage,
        readiness,
        score,
        availability: availabilityLabel(availability, employee.status),
        availabilitySlots: availability,
        capabilityTags: buildCapabilityTags({
          services: (employee.services || []) as string[],
          defaultRole: employee.default_role,
          hasDriverCapability,
          ndisCleared,
        }),
        flags: buildFlags({
          note: null,
          availability,
          needsTransport: false,
          hasOwnTransport: hasDriverCapability,
          rosterActive: employee.roster_active ?? false,
        }),
        note: null,
        stageAgeDays: stageAge.days,
        timeInStage: `In Ready for ${stageAge.label}`,
        onboarding: {
          currentSectionLabel: onboarding.currentSection ? titleize(onboarding.currentSection) : null,
          progress: onboarding.progress,
          missingRequiredDocs: docs.filter((document) => !document.submitted).length,
          missingRequiredDocLabels: docs.filter((document) => !document.submitted).map((document) => document.label),
        },
        staffing: {
          assignable: readiness.status === 'ready' && Boolean(employee.crew_access_approved) && employee.status === 'active' && employee.roster_active !== false,
          assignedJobs: assignments.length,
          inProgressJobs: assignments.filter((assignment) => assignment.status === 'in_progress').length,
          nextJobDate: nextJob?.scheduled_date || null,
        },
        canAdvanceStage: false,
        canRewindStage: false,
        canRequestDocs: Boolean(onboarding.requiredDocuments.some((document) => !document.submitted))
          || Boolean(onboarding.requiredDocuments.some((document) => document.status === 'rejected' || document.status === 'expired')),
        canScheduleInduction: false,
        canConvertToStaff: !employee.crew_access_approved,
        isApprovalAction: !employee.crew_access_approved,
        status: employee.status || null,
      };
    });

  const pipeline = [...items, ...standaloneEmployees].sort((left, right) => {
    const stageDiff = PIPELINE_STAGES.indexOf(left.stage) - PIPELINE_STAGES.indexOf(right.stage);
    if (stageDiff !== 0) return stageDiff;
    return left.stageAgeDays - right.stageAgeDays;
  });

  return NextResponse.json({ pipeline });
}
