'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { brand, glass } from '@/app/ui/theme';
import {
  DOC_TYPE_LABELS,
  REQUIRED_DOCS,
  OPTIONAL_DOCS,
  NDIS_DOCS,
  RIGHT_TO_WORK_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  type DocType,
  type DocStatus,
  type EmploymentType,
  type RightToWorkType,
  type PayrollDetails,
} from '@/types/crew';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────

interface AdminDocument {
  id: string;
  doc_type: string;
  storage_path: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: DocStatus;
  expires_at: string | null;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  signed_url: string | null;
}

interface Employee {
  id: string;
  full_name: string;
  email: string;
  ndis_worker: boolean;
  crew_access_approved: boolean;
  onboarding_complete: boolean;
}

interface OnboardingSnapshot {
  requiredDocuments: { docType: DocType; label: string; submitted: boolean; status: string }[];
  requiredDocumentsSubmitted: boolean;
  awaitingApproval: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_OPTIONS: { value: DocStatus; label: string; bg: string; color: string }[] = [
  { value: 'pending',  label: 'Pending review', bg: '#FEF3C7', color: '#92400E' },
  { value: 'approved', label: 'Approved',        bg: '#D1FAE5', color: '#065F46' },
  { value: 'rejected', label: 'Rejected',        bg: '#FEE2E2', color: '#991B1B' },
  { value: 'expired',  label: 'Expired',         bg: '#F1F5F9', color: '#475569' },
];

function statusStyle(status: DocStatus) {
  return STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0];
}

// ─── Document review card ─────────────────────────────────────

interface DocReviewCardProps {
  docType: DocType;
  doc: AdminDocument | undefined;
  saving: boolean;
  onSave: (id: string, patch: { status?: DocStatus; notes?: string; expires_at?: string | null }) => void;
}

function DocReviewCard({ docType, doc, saving, onSave }: DocReviewCardProps) {
  const label = DOC_TYPE_LABELS[docType];
  const [localStatus, setLocalStatus] = useState<DocStatus>(doc?.status ?? 'pending');
  const [localNotes, setLocalNotes] = useState(doc?.notes ?? '');
  const [localExpiry, setLocalExpiry] = useState(
    doc?.expires_at ? doc.expires_at.substring(0, 10) : ''
  );
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setLocalStatus(doc?.status ?? 'pending');
    setLocalNotes(doc?.notes ?? '');
    setLocalExpiry(doc?.expires_at ? doc.expires_at.substring(0, 10) : '');
    setDirty(false);
  }, [doc]);

  const sc = statusStyle(localStatus);

  if (!doc) {
    return (
      <div className="rounded-2xl border border-dashed p-5 flex items-center gap-3" style={{ borderColor: brand.border }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: brand.surface }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={brand.muted} strokeWidth="1.75">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: brand.text }}>{label}</p>
          <p className="text-xs mt-0.5" style={{ color: brand.muted }}>Not submitted</p>
        </div>
        <span className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: '#F1F5F9', color: '#94A3B8' }}>Missing</span>
      </div>
    );
  }

  const hasFile = Boolean(doc.storage_path || doc.file_url);
  const isLegacy = Boolean(!doc.storage_path && doc.file_url);

  return (
    <div className={`${glass} rounded-2xl p-5 space-y-4`}>
      {/* File header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: sc.bg }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={sc.color} strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: brand.text }}>{label}</p>
          {hasFile ? (
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {doc.file_name && <span className="text-xs truncate" style={{ color: brand.muted }}>{doc.file_name}</span>}
              {doc.file_size && <span className="text-xs" style={{ color: brand.muted }}>· {formatBytes(doc.file_size)}</span>}
              <span className="text-xs" style={{ color: brand.muted }}>
                · Uploaded {new Date(doc.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              {isLegacy && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: '#FEF3C7', color: '#92400E' }}>Legacy Drive link</span>}
            </div>
          ) : (
            <p className="text-xs mt-0.5" style={{ color: brand.muted }}>No file uploaded</p>
          )}
        </div>
        {hasFile && (
          <a
            href={doc.signed_url || doc.file_url || '#'}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-sm font-semibold px-3 py-1.5 rounded-xl"
            style={{ background: brand.primary, color: '#fff' }}
          >
            View
          </a>
        )}
      </div>

      {/* Status + expiry row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: brand.muted }}>Status</label>
          <select
            value={localStatus}
            onChange={(e) => { setLocalStatus(e.target.value as DocStatus); setDirty(true); }}
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: brand.border, background: '#fff', color: brand.text }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: brand.muted }}>Expiry date</label>
          <input
            type="date"
            value={localExpiry}
            onChange={(e) => { setLocalExpiry(e.target.value); setDirty(true); }}
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
            style={{ borderColor: brand.border, background: '#fff', color: brand.text }}
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: brand.muted }}>Notes</label>
        <textarea
          value={localNotes}
          onChange={(e) => { setLocalNotes(e.target.value); setDirty(true); }}
          rows={2}
          placeholder="Add a review note…"
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none"
          style={{ borderColor: brand.border, background: '#fff', color: brand.text }}
        />
      </div>

      {/* Reviewed by */}
      {doc.reviewed_by && (
        <p className="text-xs" style={{ color: brand.muted }}>
          Reviewed by {doc.reviewed_by}
          {doc.reviewed_at ? ` on ${new Date(doc.reviewed_at).toLocaleDateString('en-AU')}` : ''}
        </p>
      )}

      {/* Save row */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: sc.bg, color: sc.color }}
        >
          {sc.label}
        </span>
        <button
          disabled={!dirty || saving}
          onClick={() =>
            onSave(doc.id, {
              status: localStatus,
              notes: localNotes || undefined,
              expires_at: localExpiry ? new Date(localExpiry).toISOString() : null,
            })
          }
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ background: brand.primary }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function AdminEmployeeDocumentsPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = use(params);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingSnapshot | null>(null);
  const [payroll, setPayroll] = useState<PayrollDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/crew/${employeeId}/documents`).then((r) => r.json()),
      fetch(`/api/admin/crew/${employeeId}/payroll`).then((r) => r.json()),
    ])
      .then(([docsData, payrollData]) => {
        setEmployee(docsData.employee || null);
        setDocuments(docsData.documents || []);
        setOnboarding(docsData.onboarding || null);
        setPayroll(payrollData.payroll || null);
      })
      .catch(() => toast.error('Unable to load documents'))
      .finally(() => setLoading(false));
  }, [employeeId]);

  const docsByType = new Map(documents.map((d) => [d.doc_type, d]));

  const requiredTypes: DocType[] = [
    ...REQUIRED_DOCS,
    ...(employee?.ndis_worker ? NDIS_DOCS : []),
  ];

  async function handleApprove() {
    setApproving(true);
    try {
      const res = await fetch(`/api/crew/employees/${employeeId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Approval failed');
      toast.success(`${employee?.full_name} approved for crew access`);
      setEmployee((prev) => prev ? { ...prev, crew_access_approved: true } : prev);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setApproving(false);
    }
  }

  async function handleSave(
    id: string,
    patch: { status?: DocStatus; notes?: string; expires_at?: string | null }
  ) {
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/documents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Save failed');
      const updated = (data as { document: AdminDocument }).document;
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
      toast.success('Document updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(null);
    }
  }

  // Summary counts
  const missingRequired = requiredTypes.filter((t) => !docsByType.get(t)?.storage_path && !docsByType.get(t)?.file_url).length;
  const pendingReview = documents.filter((d) => d.status === 'pending').length;
  const approved = documents.filter((d) => d.status === 'approved').length;

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-16">
      <div className="flex items-center gap-2">
        <Link href="/dashboard/crew" className="text-sm flex items-center gap-1" style={{ color: brand.muted }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Crew
        </Link>
        <span style={{ color: brand.border }}>·</span>
        {loading ? (
          <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
        ) : (
          <span className="text-sm font-medium" style={{ color: brand.text }}>{employee?.full_name}</span>
        )}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: brand.text }}>
          {loading ? 'Documents' : `${employee?.full_name ?? 'Employee'}'s Documents`}
        </h1>
        {employee?.email && (
          <p className="text-sm mt-0.5" style={{ color: brand.muted }}>{employee.email}</p>
        )}
      </div>

      {/* Summary chips */}
      {!loading && (
        <div className="flex flex-wrap gap-2">
          {missingRequired > 0 && (
            <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: '#FEE2E2', color: '#991B1B' }}>
              {missingRequired} required missing
            </span>
          )}
          {pendingReview > 0 && (
            <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: '#FEF3C7', color: '#92400E' }}>
              {pendingReview} pending review
            </span>
          )}
          {approved > 0 && (
            <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: '#D1FAE5', color: '#065F46' }}>
              {approved} approved
            </span>
          )}
          {missingRequired === 0 && onboarding?.requiredDocumentsSubmitted && (
            <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: '#D1FAE5', color: '#065F46' }}>
              All required submitted
            </span>
          )}
        </div>
      )}

      {!loading && employee && !employee.crew_access_approved && onboarding?.awaitingApproval && (
        <div
          className="rounded-2xl border px-5 py-4 flex items-center justify-between gap-4"
          style={{ background: '#ECFDF5', borderColor: '#A7F3D0' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: '#065F46' }}>Ready for approval</p>
            <p className="text-xs mt-0.5" style={{ color: '#047857' }}>
              All onboarding sections complete and required documents submitted. Approving will unlock the full crew portal.
            </p>
          </div>
          <button
            onClick={handleApprove}
            disabled={approving}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
            style={{ background: '#047857' }}
          >
            {approving ? 'Approving…' : 'Approve crew access'}
          </button>
        </div>
      )}

      {!loading && employee?.crew_access_approved && (
        <div
          className="rounded-2xl border px-5 py-3 flex items-center gap-3"
          style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p className="text-sm font-medium" style={{ color: '#15803D' }}>Crew access approved — portal unlocked</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`${glass} rounded-2xl h-24 animate-pulse`} style={{ opacity: 0.5 }} />
          ))}
        </div>
      ) : (
        <>
          {/* Compliance checks */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: brand.muted }}>
              Compliance checks
            </h2>
            {requiredTypes.map((dt) => (
              <DocReviewCard
                key={dt}
                docType={dt}
                doc={docsByType.get(dt)}
                saving={saving === docsByType.get(dt)?.id}
                onSave={handleSave}
              />
            ))}
          </div>

          {/* Supporting documents */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: brand.muted }}>
              Supporting documents
            </h2>
            {OPTIONAL_DOCS.map((dt) => (
              <DocReviewCard
                key={dt}
                docType={dt}
                doc={docsByType.get(dt)}
                saving={saving === docsByType.get(dt)?.id}
                onSave={handleSave}
              />
            ))}
          </div>

          {/* Payroll & sensitive details */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: brand.muted }}>
              Employment & payroll details
            </h2>
            {payroll ? (
              <div className={`${glass} rounded-2xl p-5`}>
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                  <AdminField label="Employment type" value={payroll.employment_type ? EMPLOYMENT_TYPE_LABELS[payroll.employment_type as EmploymentType] : null} />
                  <AdminField label="Right to work" value={payroll.right_to_work_type ? RIGHT_TO_WORK_LABELS[payroll.right_to_work_type as RightToWorkType] : null} />
                  {payroll.right_to_work_visa_subclass && (
                    <AdminField label="Visa subclass" value={payroll.right_to_work_visa_subclass} />
                  )}
                  {payroll.right_to_work_expiry && (
                    <AdminField label="Visa expiry" value={new Date(payroll.right_to_work_expiry).toLocaleDateString('en-AU')} />
                  )}

                  <div className="sm:col-span-2 h-px" style={{ background: '#E2E8F0' }} />

                  <AdminField label="Tax File Number (TFN)" value={payroll.tfn} sensitive />

                  <div className="sm:col-span-2 h-px" style={{ background: '#E2E8F0' }} />

                  <AdminField label="BSB" value={payroll.bank_bsb} />
                  <AdminField label="Account number" value={payroll.bank_account_number} />
                  <AdminField label="Account name" value={payroll.bank_account_name} />
                  <AdminField label="Bank / institution" value={payroll.bank_institution} />

                  <div className="sm:col-span-2 h-px" style={{ background: '#E2E8F0' }} />

                  <AdminField label="Super fund" value={payroll.super_fund_name} />
                  <AdminField label="USI" value={payroll.super_usi} />
                  <AdminField label="Member number" value={payroll.super_member_number} />
                </div>

                {payroll.updated_at && (
                  <p className="mt-4 text-xs" style={{ color: brand.muted }}>
                    Last updated {new Date(payroll.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed px-5 py-4" style={{ borderColor: brand.border }}>
                <p className="text-sm" style={{ color: brand.muted }}>No payroll details submitted yet.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Admin field display helper ───────────────────────────────

function AdminField({ label, value, sensitive = false }: { label: string; value: string | null | undefined; sensitive?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const isEmpty = !value;

  return (
    <div>
      <p className="text-xs font-medium" style={{ color: brand.muted }}>{label}</p>
      {isEmpty ? (
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>—</p>
      ) : sensitive ? (
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-sm font-mono" style={{ color: brand.text }}>
            {revealed ? value : '●●● ●●● ●●●'}
          </p>
          <button
            onClick={() => setRevealed((r) => !r)}
            className="text-xs font-medium"
            style={{ color: brand.accent }}
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        </div>
      ) : (
        <p className="text-sm mt-0.5 font-medium" style={{ color: brand.text }}>{value}</p>
      )}
    </div>
  );
}
