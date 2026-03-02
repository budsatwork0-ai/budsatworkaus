'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/app/ui/theme';
import { DOC_TYPE_LABELS, DOC_STATUS_COLORS, type DocType, type DocStatus } from '@/types/crew';

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

type Document = {
  id: string;
  doc_type: string;
  file_url: string;
  file_name: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
};

const ALL_DOC_TYPES: DocType[] = ['wwcc', 'police_check', 'first_aid', 'drivers_license', 'abn', 'insurance', 'ndis_screening'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending Review', approved: 'Approved', rejected: 'Rejected', expired: 'Expired',
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/crew/documents')
      .then((r) => r.json())
      .then((data) => setDocuments(data.documents || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const docMap = new Map<string, Document>();
  documents.forEach((d) => {
    if (!docMap.has(d.doc_type) || new Date(d.created_at) > new Date(docMap.get(d.doc_type)!.created_at)) {
      docMap.set(d.doc_type, d);
    }
  });

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const expiringDocs = ALL_DOC_TYPES.filter((type) => {
    const doc = docMap.get(type);
    return doc?.expires_at && new Date(doc.expires_at) <= thirtyDaysFromNow && doc.status !== 'expired';
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: brand.primary }}>My Documents</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>Upload and manage your compliance documents.</p>
      </div>

      {/* Expiry Alert */}
      {expiringDocs.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex items-start gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" className="shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#92400E' }}>
                {expiringDocs.length} document{expiringDocs.length > 1 ? 's' : ''} expiring soon
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#92400E' }}>
                {expiringDocs.map((t) => DOC_TYPE_LABELS[t]).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Document Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className={`${glass} p-5`}>
              <div className="h-5 w-32 rounded bg-slate-200 animate-pulse" />
              <div className="h-4 w-20 rounded bg-slate-100 animate-pulse mt-2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_DOC_TYPES.map((type) => {
            const doc = docMap.get(type);
            const status = (doc?.status || 'not_uploaded') as DocStatus | 'not_uploaded';
            const isExpiring = doc?.expires_at && new Date(doc.expires_at) <= thirtyDaysFromNow;
            const colorClass = status !== 'not_uploaded' ? DOC_STATUS_COLORS[status as DocStatus] : 'bg-slate-100 text-slate-600';

            return (
              <div key={type} className={`${glass} p-5 ${isExpiring ? 'ring-2 ring-amber-300' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: brand.text }}>
                      {DOC_TYPE_LABELS[type]}
                    </p>
                    <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
                      {status === 'not_uploaded' ? 'Not Uploaded' : STATUS_LABELS[status] || status}
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: doc ? 'rgba(15,61,46,0.08)' : '#F1F5F9' }}>
                    {doc ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={brand.primary} strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    )}
                  </div>
                </div>

                {doc?.expires_at && (
                  <p className="text-[11px] mt-2" style={{ color: isExpiring ? '#92400E' : brand.muted }}>
                    Expires: {new Date(doc.expires_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}

                <label className="mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors hover:bg-slate-50"
                  style={{ borderColor: brand.border }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={brand.muted} strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span className="text-xs font-medium" style={{ color: brand.muted }}>
                    {doc ? 'Replace' : 'Upload'}
                  </span>
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
