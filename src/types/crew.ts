// Crew / Employee types for Buds At Work

export type AssignmentStatus = 'available' | 'accepted' | 'declined' | 'in_progress' | 'completed';

export type EmployeeStatus = 'active' | 'inactive' | 'suspended';
export type EmploymentType = 'casual' | 'contractor' | 'volunteer' | 'trainee' | 'part_time' | 'full_time';

export type DocType =
  // Required compliance checks
  | 'wwcc'
  | 'police_check'
  | 'first_aid'
  | 'cpr_certificate'
  | 'ndis_orientation'
  // NDIS conditional (required when ndis_worker = true)
  | 'ndis_screening'
  // Role-based optional
  | 'drivers_license'
  | 'vehicle_registration'
  | 'vehicle_insurance'
  | 'abn'
  | 'insurance'
  | 'public_liability'
  | 'resume'
  | 'references'
  | 'other';

export type DocStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type OnboardingSection = 'personal' | 'emergency' | 'availability' | 'services' | 'documents' | 'ndis';

// Sensitive payroll details are stored as boolean status flags only.
export type RightToWorkType = 'citizen' | 'permanent_resident' | 'work_visa' | 'other';

// Stored in employee_payroll_details, protected by RLS (employee-own + admin).
// Never expose these fields in public API routes or client logs.
export interface PayrollDetails {
  id?: string;
  employee_id?: string;

  // Employment
  employment_type: EmploymentType | null;

  // Right to work
  right_to_work_type: RightToWorkType | null;
  right_to_work_visa_subclass: string | null;
  right_to_work_expiry: string | null; // ISO date

  // Tax — displayed masked after save
  tfn: string | null;

  // Bank account
  bank_bsb: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_institution: string | null;

  // Superannuation
  super_fund_name: string | null;
  super_usi: string | null;
  super_member_number: string | null;

  // Legacy boolean flags (auto-derived from real data on save)
  tfn_declaration_received?: boolean;
  bank_details_received?: boolean;
  super_details_received?: boolean;
  right_to_work_confirmed?: boolean;

  created_at?: string;
  updated_at?: string;
}

export const RIGHT_TO_WORK_LABELS: Record<RightToWorkType, string> = {
  citizen: 'Australian citizen',
  permanent_resident: 'Permanent resident',
  work_visa: 'Work visa',
  other: 'Other',
};

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
  police_check: 'National Police Check',
  first_aid: 'First Aid Certificate',
  cpr_certificate: 'CPR Certificate',
  ndis_orientation: 'NDIS Worker Orientation Module',
  ndis_screening: 'NDIS Worker Screening Check',
  drivers_license: "Driver's Licence",
  vehicle_registration: 'Vehicle Registration',
  vehicle_insurance: 'Vehicle Insurance',
  abn: 'ABN Registration',
  insurance: 'Insurance',
  public_liability: 'Public Liability Insurance',
  resume: 'Resume / Work History',
  references: 'References',
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
  volunteer: 'Volunteer',
  trainee: 'Trainee',
  part_time: 'Part-time',
  full_time: 'Full-time',
};

// Compliance docs required for all crew members
export const REQUIRED_DOCS: DocType[] = [
  'wwcc',
  'police_check',
  'first_aid',
  'cpr_certificate',
  'ndis_orientation',
];

// Additional required when ndis_worker = true
export const NDIS_DOCS: DocType[] = ['ndis_screening'];

// Optional role-based documents (do not block onboarding completion)
export const OPTIONAL_DOCS: DocType[] = [
  'drivers_license',
  'vehicle_registration',
  'vehicle_insurance',
  'abn',
  'insurance',
  'public_liability',
  'resume',
  'references',
];

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
