'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { brand, glass } from '@/app/ui/theme';
import { DOC_TYPE_LABELS, DOC_STATUS_LABELS, DOC_STATUS_COLORS, REQUIRED_DOCS, NDIS_DOCS } from '@/types/crew';
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

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/crew/documents');
        if (res.ok) {
          const data = await res.json();
          setDocuments(data.documents || []);
        }
      } catch {
        // handle silently
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleUpload(docType: string) {
    // For now, prompt for a URL. In production this would be a file picker + Supabase Storage upload.
    const url = window.prompt('Enter the document URL:');
    if (!url) return;

    setUploading(docType);
    try {
      const res = await fetch('/api/crew/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: docType,
          file_url: url,
          file_name: `${docType}_document`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments((prev) => [data.document, ...prev]);
      }
    } catch {
      // handle silently
    } finally {
      setUploading(null);
    }
  }

  // Mark documents section as complete when all required docs are uploaded
  async function markComplete() {
    try {
      const res = await fetch('/api/crew/onboarding/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: { uploaded: true }, completed: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Unable to complete documents section');
      }
      toast.success('Documents section marked complete');
    } catch {
      toast.error('Please upload all required documents before completing this step');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const docsByType = new Map(documents.map((d) => [d.doc_type, d]));
  const allDocTypes = [...REQUIRED_DOCS, 'drivers_license', 'abn', 'insurance', ...NDIS_DOCS] as DocType[];
  const allRequiredUploaded = REQUIRED_DOCS.every((dt) => docsByType.has(dt));

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/crew/onboarding" className="text-sm" style={{ color: brand.muted }}>
        &larr; Back to Onboarding
      </Link>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: brand.text }}>Documents</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>
          Upload your required documents. Items marked with * are mandatory.
        </p>
      </div>

      <div className="space-y-3">
        {allDocTypes.map((docType) => {
          const existing = docsByType.get(docType);
          const isRequired = REQUIRED_DOCS.includes(docType) || NDIS_DOCS.includes(docType);
          const label = DOC_TYPE_LABELS[docType];

          return (
            <div key={docType} className={`${glass} rounded-2xl p-5`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium" style={{ color: brand.text }}>
                    {label}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                  </p>
                  {existing ? (
                    <div className="mt-1.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${DOC_STATUS_COLORS[existing.status as DocStatus] || ''}`}
                      >
                        {DOC_STATUS_LABELS[existing.status as DocStatus] || existing.status}
                      </span>
                      {existing.expires_at && (
                        <span className="text-xs ml-2" style={{ color: brand.muted }}>
                          Expires: {new Date(existing.expires_at).toLocaleDateString('en-AU')}
                        </span>
                      )}
                      <p className="text-xs mt-1" style={{ color: brand.muted }}>
                        Uploaded {new Date(existing.created_at).toLocaleDateString('en-AU')}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs mt-1" style={{ color: brand.muted }}>Not uploaded</p>
                  )}
                </div>

                <button
                  onClick={() => handleUpload(docType)}
                  disabled={uploading === docType}
                  className="px-3 py-1.5 rounded-lg text-sm border transition-colors hover:bg-slate-50 shrink-0"
                  style={{ borderColor: brand.border, color: brand.primary }}
                >
                  {existing ? 'Re-upload' : 'Upload'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {allRequiredUploaded && (
        <button
          onClick={markComplete}
          className="w-full py-3 rounded-xl text-white font-medium transition-opacity hover:opacity-90"
          style={{ background: brand.primary }}
        >
          Mark Documents Complete
        </button>
      )}
    </div>
  );
}
