/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  DOC_TYPE_LABELS,
  NDIS_DOCS,
  ONBOARDING_SECTION_LABELS,
  REQUIRED_DOCS,
  type DocStatus,
  type DocType,
  type OnboardingSection,
} from '@/types/crew';

type EmployeeProgressSection = {
  section: string;
  completed: boolean;
};

type EmployeeProgressDocument = {
  id?: string;
  doc_type: string;
  storage_path?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  status?: string | null;
  created_at?: string;
  expires_at?: string | null;
};

type EmployeeProgressEmployee = {
  id: string;
  user_id?: string | null;
  ndis_worker?: boolean | null;
  onboarding_complete?: boolean | null;
  crew_access_approved?: boolean | null;
  roster_active?: boolean | null;
  status?: string | null;
};

export type RequiredDocumentStatus = {
  docType: DocType;
  label: string;
  submitted: boolean;
  approved: boolean;
  status: DocStatus | 'missing';
  fileUrl: string | null;
  fileName: string | null;
  uploadedAt: string | null;
  expiresAt: string | null;
};

export type OnboardingSnapshot = {
  sections: Array<{
    section: OnboardingSection;
    label: string;
    completed: boolean;
  }>;
  progress: {
    completed: number;
    total: number;
    currentStep: number;
  };
  currentSection: OnboardingSection | null;
  ndisWorker: boolean;
  onboardingComplete: boolean;
  crewAccessApproved: boolean;
  awaitingApproval: boolean;
  readyForCrewApproval: boolean;
  requiredDocuments: RequiredDocumentStatus[];
  requiredDocumentsSubmitted: boolean;
  requiredDocumentsApproved: boolean;
};

const BASE_SECTIONS: OnboardingSection[] = [
  'personal',
  'emergency',
  'availability',
  'services',
  'documents',
];

export function getRequiredOnboardingSections(ndisWorker: boolean): OnboardingSection[] {
  return ndisWorker ? [...BASE_SECTIONS, 'ndis'] : [...BASE_SECTIONS];
}

export function getRequiredDocumentTypes(ndisWorker: boolean): DocType[] {
  return ndisWorker ? [...REQUIRED_DOCS, ...NDIS_DOCS] : [...REQUIRED_DOCS];
}

export function isGoogleDriveUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, '');
    return hostname === 'drive.google.com' || hostname === 'docs.google.com';
  } catch {
    return false;
  }
}

export function buildEmployeeOnboardingSnapshot({
  employee,
  sections,
  documents,
}: {
  employee: EmployeeProgressEmployee;
  sections: EmployeeProgressSection[];
  documents: EmployeeProgressDocument[];
}): OnboardingSnapshot {
  const ndisWorker = Boolean(employee.ndis_worker);
  const requiredSections = getRequiredOnboardingSections(ndisWorker);
  const requiredDocs = getRequiredDocumentTypes(ndisWorker);
  const sectionMap = new Map(sections.map((section) => [section.section, Boolean(section.completed)]));

  const requiredDocuments = requiredDocs.map((docType) => {
    const doc = documents.find((item) => item.doc_type === docType) || null;
    const submitted = Boolean(doc?.file_url || doc?.storage_path);
    const approved = doc?.status === 'approved';
    const status: RequiredDocumentStatus['status'] =
      doc?.status === 'pending' ||
      doc?.status === 'approved' ||
      doc?.status === 'rejected' ||
      doc?.status === 'expired'
        ? doc.status
        : 'missing';
    return {
      docType,
      label: DOC_TYPE_LABELS[docType],
      submitted,
      approved,
      status,
      fileUrl: doc?.file_url || null,
      fileName: doc?.file_name || null,
      uploadedAt: doc?.created_at || null,
      expiresAt: doc?.expires_at || null,
    };
  });

  const requiredDocumentsSubmitted = requiredDocuments.every((doc) => doc.submitted);
  const requiredDocumentsApproved = requiredDocuments.every((doc) => doc.approved);

  const normalizedSections = requiredSections.map((section) => ({
    section,
    label: ONBOARDING_SECTION_LABELS[section],
    completed: section === 'documents'
      ? requiredDocumentsSubmitted
      : Boolean(sectionMap.get(section)),
  }));

  const completed = normalizedSections.filter((section) => section.completed).length;
  const currentSection = normalizedSections.find((section) => !section.completed)?.section || null;
  const crewAccessApproved = Boolean(employee.crew_access_approved);
  const onboardingComplete = normalizedSections.every((section) => section.completed);

  return {
    sections: normalizedSections,
    progress: {
      completed,
      total: normalizedSections.length,
      currentStep: currentSection ? normalizedSections.findIndex((section) => section.section === currentSection) + 1 : normalizedSections.length,
    },
    currentSection,
    ndisWorker,
    onboardingComplete,
    crewAccessApproved,
    awaitingApproval: onboardingComplete && !crewAccessApproved,
    readyForCrewApproval: onboardingComplete && requiredDocumentsSubmitted && !crewAccessApproved,
    requiredDocuments,
    requiredDocumentsSubmitted,
    requiredDocumentsApproved,
  };
}

export async function syncEmployeeOnboardingState(
  client: any,
  employeeId: string
) {
  const { data: employee } = await (client as any)
    .from('employees')
    .select('id, user_id, ndis_worker, onboarding_complete, crew_access_approved, roster_active, status')
    .eq('id', employeeId)
    .single();

  if (!employee) return null;

  const [{ data: sections }, { data: documents }] = await Promise.all([
    (client as any)
      .from('employee_onboarding')
      .select('section, completed')
      .eq('employee_id', employeeId),
    (client as any)
      .from('employee_documents')
      .select('id, doc_type, storage_path, file_url, file_name, status, created_at, expires_at')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false }),
  ]);

  const snapshot = buildEmployeeOnboardingSnapshot({
    employee,
    sections: sections || [],
    documents: documents || [],
  });

  // Keep the documents section synced with actual submitted files.
  await (client as any)
    .from('employee_onboarding')
    .upsert(
      {
        employee_id: employeeId,
        section: 'documents',
        responses: { uploaded: snapshot.requiredDocumentsSubmitted },
        completed: snapshot.requiredDocumentsSubmitted,
      },
      { onConflict: 'employee_id,section' }
    );

  const nextStatus =
    employee.status === 'suspended'
      ? 'suspended'
      : snapshot.crewAccessApproved && employee.roster_active !== false
      ? 'active'
      : 'inactive';

  await (client as any)
    .from('employees')
    .update({
      onboarding_complete: snapshot.onboardingComplete,
      status: nextStatus,
    })
    .eq('id', employeeId);

  return snapshot;
}
