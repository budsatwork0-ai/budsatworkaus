'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { brand, glass } from '@/app/ui/theme';
import { DOC_TYPE_LABELS, DOC_STATUS_LABELS, DOC_STATUS_COLORS, NDIS_DOCS, REQUIRED_DOCS } from '@/types/crew';
import type { DocType, DocStatus } from '@/types/crew';
import { toast } from 'sonner';

interface Document {
  id: string;
  doc_type: string;
  file_url: string;
  file_name: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
}

interface OnboardingSnapshot {
  ndisWorker: boolean;
  requiredDocumentsSubmitted: boolean;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [draftUrls, setDraftUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingSnapshot | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/crew/documents');
        if (res.ok) {
          const data = await res.json();
          const nextDocuments = data.documents || [];
          setDocuments(nextDocuments);
          setOnboarding(data.onboarding || null);
          setDraftUrls(
            Object.fromEntries(
              nextDocuments.map((doc: Document) => [doc.doc_type, doc.file_url])
            )
          );
        }
      } catch {
        toast.error('Unable to load your documents');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const docsByType = useMemo(
    () => new Map(documents.map((document) => [document.doc_type, document])),
    [documents],
  );
  const allDocTypes = useMemo(
    () => [...REQUIRED_DOCS, 'drivers_license', 'abn', 'insurance', ...(onboarding?.ndisWorker ? NDIS_DOCS : [])] as DocType[],
    [onboarding?.ndisWorker],
  );

  async function handleSave(docType: DocType) {
    const value = draftUrls[docType]?.trim();
    if (!value) {
      toast.error('Add a Google Drive link first');
      return;
    }

    setSaving(docType);
    try {
      const res = await fetch('/api/crew/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: docType,
          file_url: value,
          file_name: DOC_TYPE_LABELS[docType],
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Unable to save document');
      }

      const nextDocument = (data as { document: Document }).document;
      setDocuments((prev) => [nextDocument, ...prev.filter((document) => document.doc_type !== docType)]);
      setOnboarding((data as { onboarding?: OnboardingSnapshot }).onboarding || null);
      toast.success(`${DOC_TYPE_LABELS[docType]} saved`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save document';
      toast.error(message);
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/crew/onboarding" className="text-sm" style={{ color: brand.muted }}>
        &larr; Back to Onboarding
      </Link>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: brand.text }}>Documents</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>
          Paste a Google Drive share link for each document. Make sure the link is viewable by anyone with the link so admin can review it.
        </p>
      </div>

      <div
        className={`${glass} rounded-2xl p-4 text-sm`}
        style={{ background: 'rgba(15,61,46,0.04)' }}
      >
        Required items are marked with <span className="text-red-500 font-semibold">*</span>. The documents step completes automatically once every required Google Drive link has been submitted.
      </div>

      <div className="space-y-3">
        {allDocTypes.map((docType) => {
          const existing = docsByType.get(docType);
          const isRequired = REQUIRED_DOCS.includes(docType) || (onboarding?.ndisWorker ? NDIS_DOCS.includes(docType) : false);
          const label = DOC_TYPE_LABELS[docType];

          return (
            <div key={docType} className={`${glass} rounded-2xl p-5 space-y-4`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium" style={{ color: brand.text }}>
                    {label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                  </p>
                  {existing ? (
                    <div className="mt-1.5 space-y-1">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${DOC_STATUS_COLORS[existing.status as DocStatus] || ''}`}
                      >
                        {DOC_STATUS_LABELS[existing.status as DocStatus] || existing.status}
                      </span>
                      <p className="text-xs" style={{ color: brand.muted }}>
                        Submitted {new Date(existing.created_at).toLocaleDateString('en-AU')}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs mt-1" style={{ color: brand.muted }}>Not submitted yet</p>
                  )}
                </div>

                {existing?.file_url && (
                  <a
                    href={existing.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium underline underline-offset-2 shrink-0"
                    style={{ color: brand.primary }}
                  >
                    Open Drive link
                  </a>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium" style={{ color: brand.muted }}>
                  Google Drive share link
                </label>
                <input
                  type="url"
                  value={draftUrls[docType] || ''}
                  onChange={(event) => setDraftUrls((prev) => ({ ...prev, [docType]: event.target.value }))}
                  placeholder="https://drive.google.com/..."
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: brand.border, color: brand.text, background: '#fff' }}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs" style={{ color: brand.muted }}>
                  {isRequired ? 'Required for onboarding approval.' : 'Optional supporting document.'}
                </p>
                <button
                  onClick={() => handleSave(docType)}
                  disabled={saving === docType}
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: brand.primary }}
                >
                  {saving === docType ? 'Saving...' : existing ? 'Update link' : 'Save link'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {onboarding?.requiredDocumentsSubmitted && (
        <div
          className={`${glass} rounded-2xl p-5`}
          style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.15)' }}
        >
          <p className="font-semibold" style={{ color: '#047857' }}>Required documents submitted</p>
          <p className="text-sm mt-1" style={{ color: '#065F46' }}>
            This step is complete. Admin can now review your documents as part of the final crew approval.
          </p>
        </div>
      )}
    </div>
  );
}
