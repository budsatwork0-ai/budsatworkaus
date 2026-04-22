// Crew / Employee types for Buds At Work

export type AssignmentStatus = 'available' | 'accepted' | 'declined' | 'in_progress' | 'completed';

export type EmployeeStatus = 'active' | 'inactive' | 'suspended';
export type EmploymentType = 'casual' | 'contractor' | 'part_time' | 'full_time';

export type DocType =
  | 'wwcc'
  | 'police_check'
  | 'first_aid'
  | 'drivers_license'
  | 'abn'
  | 'insurance'
  | 'ndis_screening'
  | 'other';

export type DocStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type OnboardingSection = 'personal' | 'emergency' | 'availability' | 'services' | 'documents' | 'ndis';

// Labels
export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  available: 'Available',
  accepted: 'Accepted',
  declined: 'Declined',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const ASSIGNMENT_STATUS_COLORS: Record<AssignmentStatus, string> = {
  available: 'bg-blue-100 text-blue-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-red-100 text-red-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
};

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  wwcc: 'Working With Children Check',
  police_check: 'Police Check',
  first_aid: 'First Aid Certificate',
  drivers_license: "Driver's License",
  abn: 'ABN Registration',
  insurance: 'Insurance',
  ndis_screening: 'NDIS Worker Screening',
  other: 'Other',
};

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
};

export const DOC_STATUS_COLORS: Record<DocStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-slate-100 text-slate-800',
};

export const ONBOARDING_SECTION_LABELS: Record<OnboardingSection, string> = {
  personal: 'Personal Details',
  emergency: 'Emergency Contact',
  availability: 'Availability',
  services: 'Services',
  documents: 'Documents',
  ndis: 'NDIS',
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  casual: 'Casual',
  contractor: 'Contractor',
  part_time: 'Part-time',
  full_time: 'Full-time',
};

export const REQUIRED_DOCS: DocType[] = ['wwcc', 'police_check', 'first_aid'];
export const NDIS_DOCS: DocType[] = ['ndis_screening'];

// Checklist item shape (stored as jsonb in checklist_templates.items)
export interface ChecklistItem {
  label: string;
  required: boolean;
  order: number;
}

// Checklist response shape (stored as jsonb in job_completions.checklist_responses)
export interface ChecklistResponse {
  label: string;
  checked: boolean;
  note?: string;
}
