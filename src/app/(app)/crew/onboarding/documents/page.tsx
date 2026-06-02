'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { crewTheme } from '@/lib/design-system/themes';
import {
  DOC_TYPE_LABELS,
  NDIS_DOCS,
  REQUIRED_DOCS,
  OPTIONAL_DOCS,
  EMPLOYMENT_TYPE_LABELS,
  RIGHT_TO_WORK_LABELS,
  type DocType,
  type DocStatus,
  type EmploymentType,
  type PayrollDetails,
  type RightToWorkType,
} from '@/types/crew';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────

interface UploadedDocument {
  id: string;
  doc_type: string;
  storage_path: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: DocStatus;
  expires_at: string | null;
  created_at: string;
  signed_url: string | null;
}

interface OnboardingSnapshot {
  ndisWorker: boolean;
  requiredDocumentsSubmitted: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: DocStatus): string {
  return { pending: 'Pending review', approved: 'Approved', rejected: 'Rejected', expired: 'Expired' }[status] ?? status;
}

function statusStyle(status: DocStatus): { bg: string; color: string } {
  const map: Record<DocStatus, { bg: string; color: string }> = {
    pending:  { bg: '#FEF3C7', color: '#92400E' },
    approved: { bg: '#D1FAE5', color: '#065F46' },
    rejected: { bg: '#FEE2E2', color: '#991B1B' },
    expired:  { bg: '#F1F5F9', color: '#475569' },
  };
  return map[status] ?? { bg: '#F1F5F9', color: '#475569' };
}

// ─── Upload card ─────────────────────────────────────────────

interface DocCardProps {
  docType: DocType;
  isRequired: boolean;
  doc: UploadedDocument | undefined;
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
}

function DocCard({ docType, isRequired, doc, uploading, onUpload, onDelete }: DocCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = DOC_TYPE_LABELS[docType];
  const hasStorage = Boolean(doc?.storage_path);
  const hasLegacy = Boolean(!hasStorage && doc?.file_url);

  return (
    <div className={`${crewTheme.glass} rounded-2xl p-5`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: crewTheme.color.text }}>{label}</span>
            {isRequired && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                Required
              </span>
            )}
          </div>
        </div>
        {doc && (
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold shrink-0"
            style={statusStyle(doc.status)}
          >
            {statusLabel(doc.status)}
          </span>
        )}
      </div>

      {/* File info / upload zone */}
      {uploading ? (
        <div className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: crewTheme.color.border }}>
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin shrink-0" style={{ borderColor: crewTheme.color.primary, borderTopColor: 'transparent' }} />
          <span className="text-sm" style={{ color: crewTheme.color.muted }}>Uploading…</span>
        </div>
      ) : hasStorage ? (
        <div className="rounded-xl border px-4 py-3 flex items-center gap-3" style={{ borderColor: crewTheme.color.border, background: 'rgba(15,61,46,0.03)' }}>
          <FileIcon mime={doc!.mime_type} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: crewTheme.color.text }}>{doc!.file_name}</p>
            <p className="text-xs mt-0.5" style={{ color: crewTheme.color.muted }}>
              {doc!.file_size ? formatBytes(doc!.file_size) : ''}
              {doc!.file_size && doc!.created_at ? ' · ' : ''}
              {doc!.created_at ? new Date(doc!.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {doc!.signed_url && (
              <a
                href={doc!.signed_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold underline underline-offset-2"
                style={{ color: crewTheme.color.accent }}
              >
                View
              </a>
            )}
            <button
              onClick={() => inputRef.current?.click()}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border"
              style={{ borderColor: crewTheme.color.border, color: crewTheme.color.muted }}
            >
              Replace
            </button>
            <button
              onClick={onDelete}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border"
              style={{ borderColor: '#FCA5A5', color: '#DC2626', background: '#FEF2F2' }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : hasLegacy ? (
        <div className="rounded-xl border border-dashed px-4 py-3 flex items-center justify-between gap-3" style={{ borderColor: '#FCD34D', background: '#FFFBEB' }}>
          <div>
            <p className="text-xs font-medium" style={{ color: '#92400E' }}>Legacy Drive link</p>
            <p className="text-[11px] mt-0.5" style={{ color: '#B45309' }}>Upload a file to replace this link</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={doc!.file_url!} target="_blank" rel="noreferrer" className="text-xs font-semibold underline underline-offset-2" style={{ color: crewTheme.color.accent }}>
              Open
            </a>
            <button onClick={() => inputRef.current?.click()} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background: crewTheme.color.primary }}>
              Upload file
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors hover:border-opacity-60 group"
          style={{ borderColor: crewTheme.color.border }}
        >
          <UploadIcon />
          <p className="text-sm font-medium mt-2" style={{ color: crewTheme.color.text }}>Click to upload</p>
          <p className="text-xs mt-0.5" style={{ color: crewTheme.color.muted }}>PDF, JPG or PNG · Max 10 MB</p>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ─── Icon helpers ─────────────────────────────────────────────

function FileIcon({ mime }: { mime: string | null }) {
  const isPdf = mime === 'application/pdf';
  return (
    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: isPdf ? '#FEE2E2' : '#DBEAFE' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isPdf ? '#DC2626' : '#2563EB'} strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    </div>
  );
}

function UploadIcon() {
  return (
    <div className="mx-auto w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: crewTheme.color.surface }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={crewTheme.color.muted} strokeWidth="1.5">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    </div>
  );
}

// ─── Section divider ─────────────────────────────────────────

function Section({ title, subtitle, tag, children }: { title: string; subtitle: string; tag?: string; tagColor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 pt-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold" style={{ color: crewTheme.color.text, fontSize: '0.9375rem' }}>{title}</h2>
            {tag && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                {tag}
              </span>
            )}
          </div>
          <p className="text-sm mt-0.5" style={{ color: crewTheme.color.muted }}>{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [onboarding, setOnboarding] = useState<OnboardingSnapshot | null>(null);

  const [payroll, setPayroll] = useState<PayrollDetails>({
    employment_type: null,
    right_to_work_type: null,
    right_to_work_visa_subclass: null,
    right_to_work_expiry: null,
    tfn: null,
    bank_bsb: null,
    bank_account_number: null,
    bank_account_name: null,
    bank_institution: null,
    super_fund_name: null,
    super_usi: null,
    super_member_number: null,
  });
  const [showTfn, setShowTfn] = useState(false);
  const [savingPayroll, setSavingPayroll] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [docsRes, payrollRes] = await Promise.all([
          fetch('/api/crew/documents'),
          fetch('/api/crew/payroll'),
        ]);
        if (docsRes.ok) {
          const data = await docsRes.json();
          setDocuments(data.documents || []);
          setOnboarding(data.onboarding || null);
        }
        if (payrollRes.ok) {
          const data = await payrollRes.json();
          if (data.payroll) setPayroll({ ...data.payroll });
        }
      } catch {
        toast.error('Unable to load documents');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const docsByType = useMemo(
    () => new Map(documents.map((d) => [d.doc_type, d])),
    [documents],
  );

  const requiredDocTypes = useMemo(
    () => [...REQUIRED_DOCS, ...(onboarding?.ndisWorker ? NDIS_DOCS : [])] as DocType[],
    [onboarding?.ndisWorker],
  );

  async function handleUpload(docType: DocType, file: File) {
    setUploading((prev) => ({ ...prev, [docType]: true }));
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('doc_type', docType);

      const res = await fetch('/api/crew/documents/upload', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Upload failed');

      const next = (data as { document: UploadedDocument }).document;
      setDocuments((prev) => [next, ...prev.filter((d) => d.doc_type !== docType)]);
      setOnboarding((data as { onboarding?: OnboardingSnapshot }).onboarding || null);
      toast.success(`${DOC_TYPE_LABELS[docType]} uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading((prev) => ({ ...prev, [docType]: false }));
    }
  }

  async function handleDelete(docId: string, docType: string) {
    try {
      const res = await fetch(`/api/crew/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Delete failed');
      }
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success(`${DOC_TYPE_LABELS[docType as DocType] || docType} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function handleSavePayroll() {
    setSavingPayroll(true);
    try {
      const res = await fetch('/api/crew/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payroll),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Save failed');
      }
      toast.success('Employment details saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingPayroll(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: crewTheme.color.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-2xl mx-auto pb-12">
      <Link href="/crew/onboarding" className="inline-flex items-center gap-1 text-sm" style={{ color: crewTheme.color.muted }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        Onboarding
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: crewTheme.color.text }}>Documents</h1>
        <p className="mt-1 text-sm" style={{ color: crewTheme.color.muted }}>
          Upload your compliance and work documents. Files are stored securely and only accessible to Buds At Work admin.
        </p>
      </div>

      {/* Progress indicator */}
      {onboarding && (
        <div className={`${crewTheme.glass} rounded-2xl px-5 py-4 flex items-center justify-between gap-4`}>
          <div>
            <p className="text-sm font-semibold" style={{ color: onboarding.requiredDocumentsSubmitted ? '#047857' : crewTheme.color.text }}>
              {onboarding.requiredDocumentsSubmitted ? 'Required checks complete' : 'Compliance checks required'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: crewTheme.color.muted }}>
              {onboarding.requiredDocumentsSubmitted
                ? 'All required documents submitted. Admin will review them before your approval.'
                : `Upload all required documents to complete this step.`}
            </p>
          </div>
          <div
            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
            style={{ background: onboarding.requiredDocumentsSubmitted ? '#D1FAE5' : crewTheme.color.surface }}
          >
            {onboarding.requiredDocumentsSubmitted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={crewTheme.color.muted} strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            )}
          </div>
        </div>
      )}

      <div className="h-px" style={{ background: crewTheme.color.border }} />

      {/* Section 1 — Compliance checks */}
      <Section
        title="Compliance checks"
        subtitle="Required before you can start work. Upload a clear photo or PDF of each certificate."
        tag="Required"
      >
        {requiredDocTypes.map((dt) => (
          <DocCard
            key={dt}
            docType={dt}
            isRequired
            doc={docsByType.get(dt)}
            uploading={Boolean(uploading[dt])}
            onUpload={(f) => handleUpload(dt, f)}
            onDelete={() => { const d = docsByType.get(dt); if (d) handleDelete(d.id, dt); }}
          />
        ))}
      </Section>

      <div className="h-px" style={{ background: crewTheme.color.border }} />

      {/* Section 2 — Supporting documents */}
      <Section
        title="Supporting documents"
        subtitle="Upload these if they apply to the work you do. They won't hold up your onboarding."
      >
        {OPTIONAL_DOCS.map((dt) => (
          <DocCard
            key={dt}
            docType={dt}
            isRequired={false}
            doc={docsByType.get(dt)}
            uploading={Boolean(uploading[dt])}
            onUpload={(f) => handleUpload(dt, f)}
            onDelete={() => { const d = docsByType.get(dt); if (d) handleDelete(d.id, dt); }}
          />
        ))}
      </Section>

      <div className="h-px" style={{ background: crewTheme.color.border }} />

      {/* Section 3 — Employment details */}
      <Section
        title="Employment details"
        subtitle="Stored securely and only accessible to Buds At Work admin staff."
      >
        {/* Security notice */}
        <div className="rounded-2xl border px-4 py-3 flex items-center gap-3" style={{ background: '#F0FDF4', borderColor: '#86EFAC' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2" className="shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <p className="text-sm" style={{ color: '#14532D' }}>
            <span className="font-semibold">Stored securely</span> — details are saved in a private, access-controlled database. Only admin staff can view them.
          </p>
        </div>

        {/* Work arrangement */}
        <div className={`${crewTheme.glass} rounded-2xl p-5 space-y-4`}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: crewTheme.color.muted }}>Work arrangement</p>

          <PayrollField label="Employment type">
            <select
              value={payroll.employment_type || ''}
              onChange={(e) => setPayroll((p) => ({ ...p, employment_type: (e.target.value as EmploymentType) || null }))}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text, background: '#fff' }}
            >
              <option value="">Select…</option>
              {(Object.entries(EMPLOYMENT_TYPE_LABELS) as [EmploymentType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </PayrollField>

          <div className="h-px" style={{ background: crewTheme.color.border }} />
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: crewTheme.color.muted }}>Right to work in Australia</p>

          <PayrollField label="Work status">
            <select
              value={payroll.right_to_work_type || ''}
              onChange={(e) => setPayroll((p) => ({ ...p, right_to_work_type: (e.target.value as RightToWorkType) || null }))}
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text, background: '#fff' }}
            >
              <option value="">Select…</option>
              {(Object.entries(RIGHT_TO_WORK_LABELS) as [RightToWorkType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </PayrollField>

          {payroll.right_to_work_type === 'work_visa' && (
            <div className="grid grid-cols-2 gap-3">
              <PayrollField label="Visa subclass">
                <TextInput
                  value={payroll.right_to_work_visa_subclass || ''}
                  onChange={(v) => setPayroll((p) => ({ ...p, right_to_work_visa_subclass: v || null }))}
                  placeholder="e.g. 482"
                />
              </PayrollField>
              <PayrollField label="Visa expiry">
                <DateInput
                  value={payroll.right_to_work_expiry || ''}
                  onChange={(v) => setPayroll((p) => ({ ...p, right_to_work_expiry: v || null }))}
                />
              </PayrollField>
            </div>
          )}
        </div>

        {/* Tax File Number */}
        <div className={`${crewTheme.glass} rounded-2xl p-5 space-y-4`}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: crewTheme.color.muted }}>Tax file number</p>
          <PayrollField label="TFN" hint="9-digit number shown on your tax return or Notice of Assessment. Never share this publicly.">
            <div className="relative">
              <input
                type={showTfn ? 'text' : 'password'}
                value={payroll.tfn || ''}
                onChange={(e) => setPayroll((p) => ({ ...p, tfn: e.target.value || null }))}
                placeholder="000 000 000"
                autoComplete="off"
                className="w-full rounded-xl border px-3 py-2.5 pr-16 text-sm outline-none"
                style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text, background: '#fff' }}
              />
              <button
                type="button"
                onClick={() => setShowTfn((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
                style={{ color: crewTheme.color.muted }}
              >
                {showTfn ? 'Hide' : 'Show'}
              </button>
            </div>
          </PayrollField>
        </div>

        {/* Bank account */}
        <div className={`${crewTheme.glass} rounded-2xl p-5 space-y-4`}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: crewTheme.color.muted }}>Bank account</p>
          <div className="grid grid-cols-2 gap-3">
            <PayrollField label="BSB">
              <TextInput
                value={payroll.bank_bsb || ''}
                onChange={(v) => setPayroll((p) => ({ ...p, bank_bsb: v || null }))}
                placeholder="000-000"
              />
            </PayrollField>
            <PayrollField label="Account number">
              <TextInput
                value={payroll.bank_account_number || ''}
                onChange={(v) => setPayroll((p) => ({ ...p, bank_account_number: v || null }))}
                placeholder="00000000"
              />
            </PayrollField>
          </div>
          <PayrollField label="Account name">
            <TextInput
              value={payroll.bank_account_name || ''}
              onChange={(v) => setPayroll((p) => ({ ...p, bank_account_name: v || null }))}
              placeholder="Name on account"
            />
          </PayrollField>
          <PayrollField label="Bank / institution">
            <TextInput
              value={payroll.bank_institution || ''}
              onChange={(v) => setPayroll((p) => ({ ...p, bank_institution: v || null }))}
              placeholder="e.g. Commonwealth Bank"
            />
          </PayrollField>
        </div>

        {/* Superannuation */}
        <div className={`${crewTheme.glass} rounded-2xl p-5 space-y-4`}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: crewTheme.color.muted }}>Superannuation</p>
          <PayrollField label="Fund name">
            <TextInput
              value={payroll.super_fund_name || ''}
              onChange={(v) => setPayroll((p) => ({ ...p, super_fund_name: v || null }))}
              placeholder="e.g. AustralianSuper"
            />
          </PayrollField>
          <div className="grid grid-cols-2 gap-3">
            <PayrollField label="USI" hint="Unique Superannuation Identifier">
              <TextInput
                value={payroll.super_usi || ''}
                onChange={(v) => setPayroll((p) => ({ ...p, super_usi: v || null }))}
                placeholder="STA0100AU"
              />
            </PayrollField>
            <PayrollField label="Member number">
              <TextInput
                value={payroll.super_member_number || ''}
                onChange={(v) => setPayroll((p) => ({ ...p, super_member_number: v || null }))}
                placeholder="Your member ID"
              />
            </PayrollField>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSavePayroll}
            disabled={savingPayroll}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
            style={{ background: crewTheme.color.primary }}
          >
            {savingPayroll ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </Section>
    </div>
  );
}

// ─── Shared payroll field helpers ─────────────────────────────

function PayrollField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium" style={{ color: crewTheme.color.text }}>{label}</label>
      {children}
      {hint && <p className="text-xs" style={{ color: crewTheme.color.muted }}>{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
      style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text, background: '#fff' }}
    />
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
      style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text, background: '#fff' }}
    />
  );
}
