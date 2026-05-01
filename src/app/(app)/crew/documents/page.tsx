'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { brand, glass } from '@/app/ui/theme';
import {
  DOC_TYPE_LABELS,
  REQUIRED_DOCS,
  OPTIONAL_DOCS,
  NDIS_DOCS,
  type DocType,
  type DocStatus,
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

// ─── Helpers ──────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusConfig(status: DocStatus): { label: string; bg: string; color: string } {
  return {
    pending:  { label: 'Pending review', bg: '#FEF3C7', color: '#92400E' },
    approved: { label: 'Approved',        bg: '#D1FAE5', color: '#065F46' },
    rejected: { label: 'Rejected',        bg: '#FEE2E2', color: '#991B1B' },
    expired:  { label: 'Expired',         bg: '#F1F5F9', color: '#475569' },
  }[status] ?? { label: status, bg: '#F1F5F9', color: '#475569' };
}

// ─── Document row ─────────────────────────────────────────────

interface DocRowProps {
  docType: DocType;
  doc: UploadedDocument | undefined;
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
}

function DocRow({ docType, doc, uploading, onUpload, onDelete }: DocRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const label = DOC_TYPE_LABELS[docType];
  const hasStorage = Boolean(doc?.storage_path);
  const hasLegacy = Boolean(!hasStorage && doc?.file_url);
  const sc = doc ? statusConfig(doc.status) : null;

  const daysUntilExpiry = doc?.expires_at
    ? Math.ceil((new Date(doc.expires_at).getTime() - Date.now()) / 86400000)
    : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0;

  return (
    <div
      className={`${glass} rounded-2xl p-4 flex items-start gap-4 ${isExpiringSoon ? 'ring-2 ring-amber-300' : ''}`}
    >
      {/* Status dot / upload icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: doc ? sc!.bg : brand.surface }}
      >
        {doc ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={sc!.color} strokeWidth="2.5">
            {doc.status === 'approved' ? (
              <polyline points="20 6 9 17 4 12" />
            ) : doc.status === 'rejected' ? (
              <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            ) : (
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            )}
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={brand.muted} strokeWidth="1.75">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: brand.text }}>{label}</p>

        {uploading ? (
          <div className="flex items-center gap-2 mt-1">
            <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand.primary, borderTopColor: 'transparent' }} />
            <span className="text-xs" style={{ color: brand.muted }}>Uploading…</span>
          </div>
        ) : hasStorage || hasLegacy ? (
          <div className="mt-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: sc!.bg, color: sc!.color }}>{sc!.label}</span>
              {doc!.file_name && <span className="text-xs truncate" style={{ color: brand.muted }}>{doc!.file_name}</span>}
              {doc!.file_size && <span className="text-xs" style={{ color: brand.muted }}>· {formatBytes(doc!.file_size)}</span>}
            </div>
            {(isExpiringSoon || isExpired) && (
              <p className="text-xs mt-1 font-medium" style={{ color: isExpired ? '#991B1B' : '#B45309' }}>
                {isExpired ? `Expired ${Math.abs(daysUntilExpiry!)} day${Math.abs(daysUntilExpiry!) === 1 ? '' : 's'} ago` : `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs mt-0.5" style={{ color: brand.muted }}>Not uploaded</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {hasStorage && doc!.signed_url && (
          <a href={doc!.signed_url} target="_blank" rel="noreferrer"
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border"
            style={{ borderColor: brand.border, color: brand.accent }}>
            View
          </a>
        )}
        {hasLegacy && (
          <a href={doc!.file_url!} target="_blank" rel="noreferrer"
            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border"
            style={{ borderColor: '#FCD34D', color: '#B45309', background: '#FFFBEB' }}>
            Drive link
          </a>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-50"
          style={{ background: brand.primary }}
        >
          {doc ? 'Replace' : 'Upload'}
        </button>
        {doc && (
          <button onClick={onDelete} className="text-xs font-medium px-2 py-1.5 rounded-lg border" style={{ borderColor: '#FCA5A5', color: '#DC2626' }}>
            ✕
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function CrewDocumentsPage() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [ndisWorker, setNdisWorker] = useState(false);

  useEffect(() => {
    fetch('/api/crew/documents')
      .then((r) => r.json())
      .then((data) => {
        setDocuments(data.documents || []);
        setNdisWorker(data.onboarding?.ndisWorker ?? false);
      })
      .catch(() => toast.error('Unable to load documents'))
      .finally(() => setLoading(false));
  }, []);

  const docsByType = useMemo(
    () => new Map(documents.map((d) => [d.doc_type, d])),
    [documents],
  );

  const requiredTypes = useMemo(
    () => [...REQUIRED_DOCS, ...(ndisWorker ? NDIS_DOCS : [])] as DocType[],
    [ndisWorker],
  );

  const thirtyDaysFromNow = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; }, []);
  const expiringCount = useMemo(
    () => [...requiredTypes, ...OPTIONAL_DOCS].filter((t) => {
      const d = docsByType.get(t);
      return d?.expires_at && new Date(d.expires_at) <= thirtyDaysFromNow && d.status !== 'expired';
    }).length,
    [docsByType, requiredTypes, thirtyDaysFromNow],
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
      if (!res.ok) throw new Error('Delete failed');
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success(`${DOC_TYPE_LABELS[docType as DocType] || docType} removed`);
    } catch {
      toast.error('Unable to remove document');
    }
  }

  const requiredComplete = requiredTypes.every((t) => {
    const d = docsByType.get(t);
    return d?.storage_path || d?.file_url;
  });

  return (
    <div className="space-y-8 max-w-2xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: brand.text }}>Documents</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>
          Manage your compliance documents. Files are stored securely — only Buds At Work admin can access them.
        </p>
      </div>

      {/* Alerts */}
      {expiringCount > 0 && (
        <div className="rounded-2xl border px-5 py-4 flex items-start gap-3" style={{ background: '#FFFBEB', borderColor: '#FCD34D' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" className="shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#78350F' }}>
              {expiringCount} document{expiringCount > 1 ? 's' : ''} expiring soon
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#92400E' }}>Replace them before they expire to stay active on the roster.</p>
          </div>
        </div>
      )}

      {!loading && requiredComplete && (
        <div className="rounded-2xl border px-5 py-4 flex items-center gap-3" style={{ background: '#ECFDF5', borderColor: '#6EE7B7' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" className="shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
          <p className="text-sm font-semibold" style={{ color: '#065F46' }}>All required compliance checks are on file.</p>
        </div>
      )}

      {/* Compliance checks */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: brand.muted }}>Compliance checks</h2>
          <p className="text-xs mt-0.5" style={{ color: brand.muted }}>Required to work on the roster</p>
        </div>
        {loading
          ? Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={`${glass} rounded-2xl h-16 animate-pulse`} style={{ opacity: 0.5 }} />
            ))
          : requiredTypes.map((dt) => (
              <DocRow
                key={dt}
                docType={dt}
                doc={docsByType.get(dt)}
                uploading={Boolean(uploading[dt])}
                onUpload={(f) => handleUpload(dt, f)}
                onDelete={() => { const d = docsByType.get(dt); if (d) handleDelete(d.id, dt); }}
              />
            ))}
      </div>

      {/* Supporting documents */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: brand.muted }}>Supporting documents</h2>
          <p className="text-xs mt-0.5" style={{ color: brand.muted }}>Optional — upload if relevant to your role</p>
        </div>
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={`${glass} rounded-2xl h-16 animate-pulse`} style={{ opacity: 0.3 }} />
            ))
          : OPTIONAL_DOCS.map((dt) => (
              <DocRow
                key={dt}
                docType={dt}
                doc={docsByType.get(dt)}
                uploading={Boolean(uploading[dt])}
                onUpload={(f) => handleUpload(dt, f)}
                onDelete={() => { const d = docsByType.get(dt); if (d) handleDelete(d.id, dt); }}
              />
            ))}
      </div>

      <div className="pt-2">
        <Link href="/crew/onboarding/documents" className="text-sm font-medium underline underline-offset-2" style={{ color: brand.accent }}>
          Update employment details →
        </Link>
      </div>
    </div>
  );
}
