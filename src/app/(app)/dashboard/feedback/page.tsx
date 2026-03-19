'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

type FeedbackItem = {
  id: string;
  type: 'bug_report' | 'feature_idea' | 'general';
  subject: string;
  description: string;
  photo_url: string | null;
  status: 'new' | 'reviewed' | 'closed';
  admin_notes: string | null;
  created_at: string;
};

const TYPE_LABELS: Record<FeedbackItem['type'], string> = {
  bug_report: 'Bug report',
  feature_idea: 'Feature idea',
  general: 'General',
};

const TYPE_COLORS: Record<FeedbackItem['type'], { bg: string; fg: string }> = {
  bug_report: { bg: '#FEE2E2', fg: '#991B1B' },
  feature_idea: { bg: '#EEF2FF', fg: '#3730A3' },
  general: { bg: '#F1F5F9', fg: '#475569' },
};

const STATUS_COLORS: Record<FeedbackItem['status'], { bg: string; fg: string }> = {
  new: { bg: '#DCFCE7', fg: '#166534' },
  reviewed: { bg: '#DBEAFE', fg: '#1E40AF' },
  closed: { bg: '#F1F5F9', fg: '#64748B' },
};

type StatusFilter = 'all' | FeedbackItem['status'];

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/feedback')
      .then((r) => r.json())
      .then((data) => {
        const list = data.feedback || [];
        setItems(list);
        const initial: Record<string, string> = {};
        list.forEach((i: FeedbackItem) => { initial[i.id] = i.admin_notes ?? ''; });
        setNotes(initial);
      })
      .catch(() => toast.error('Failed to load feedback'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((i) => filter === 'all' || i.status === filter);

  async function updateStatus(id: string, status: FeedbackItem['status']) {
    setSaving(id);
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    } finally {
      setSaving(null);
    }
  }

  async function saveNotes(id: string) {
    setSaving(id);
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_notes: notes[id] ?? '' }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, admin_notes: notes[id] ?? '' } : i));
      setExpandedNotes(null);
      toast.success('Notes saved');
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSaving(null);
    }
  }

  const newCount = items.filter((i) => i.status === 'new').length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: brand.text }}>Feedback & Ideas</h1>
          <p className="text-sm mt-0.5" style={{ color: brand.muted }}>
            Submissions from the website — bugs, feature ideas, and general thoughts.
          </p>
        </div>
        {newCount > 0 && (
          <div
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
          >
            {newCount} new
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'new', 'reviewed', 'closed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="px-4 py-1.5 rounded-full text-sm font-medium border transition-all"
            style={{
              borderColor: filter === s ? brand.primary : brand.border,
              backgroundColor: filter === s ? `${brand.primary}12` : 'transparent',
              color: filter === s ? brand.primary : brand.muted,
            }}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && (
              <span className="ml-1.5 opacity-60">
                {items.filter((i) => i.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-sm" style={{ color: brand.muted }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className={glass + ' p-8 text-center'}>
          <p className="text-sm" style={{ color: brand.muted }}>
            {filter === 'all' ? 'No feedback submitted yet.' : `No ${filter} feedback.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const typeColor = TYPE_COLORS[item.type];
            const statusColor = STATUS_COLORS[item.status];
            const isEditingNotes = expandedNotes === item.id;

            return (
              <div key={item.id} className={glass + ' p-5 space-y-4'}>
                {/* Top row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: typeColor.bg, color: typeColor.fg }}
                    >
                      {TYPE_LABELS[item.type]}
                    </span>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: statusColor.bg, color: statusColor.fg }}
                    >
                      {item.status}
                    </span>
                    <span className="text-xs" style={{ color: brand.muted }}>
                      {new Date(item.created_at).toLocaleDateString('en-AU', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.status !== 'reviewed' && (
                      <button
                        onClick={() => updateStatus(item.id, 'reviewed')}
                        disabled={saving === item.id}
                        className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors hover:bg-slate-50 disabled:opacity-50"
                        style={{ borderColor: brand.border, color: brand.text }}
                      >
                        Mark reviewed
                      </button>
                    )}
                    {item.status !== 'closed' && (
                      <button
                        onClick={() => updateStatus(item.id, 'closed')}
                        disabled={saving === item.id}
                        className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors hover:bg-slate-50 disabled:opacity-50"
                        style={{ borderColor: brand.border, color: brand.muted }}
                      >
                        Close
                      </button>
                    )}
                    {item.status === 'closed' && (
                      <button
                        onClick={() => updateStatus(item.id, 'new')}
                        disabled={saving === item.id}
                        className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors hover:bg-slate-50 disabled:opacity-50"
                        style={{ borderColor: brand.border, color: brand.muted }}
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <h3 className="font-semibold text-base" style={{ color: brand.text }}>{item.subject}</h3>
                  <p className="mt-1 text-sm whitespace-pre-wrap leading-relaxed" style={{ color: brand.muted }}>
                    {item.description}
                  </p>
                </div>

                {/* Photo */}
                {item.photo_url && (
                  <button
                    onClick={() => setLightbox(item.photo_url!)}
                    className="block overflow-hidden rounded-xl border hover:opacity-90 transition-opacity"
                    style={{ borderColor: brand.border }}
                    aria-label="View full photo"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.photo_url}
                      alt="Attached photo"
                      className="h-40 w-auto max-w-full object-cover"
                    />
                  </button>
                )}

                {/* Admin notes */}
                <div>
                  {item.admin_notes && !isEditingNotes && (
                    <div
                      className="mb-2 rounded-xl px-3 py-2 text-sm"
                      style={{ backgroundColor: `${brand.primary}08`, color: brand.muted }}
                    >
                      <span className="font-medium" style={{ color: brand.text }}>Notes: </span>
                      {item.admin_notes}
                    </div>
                  )}
                  {isEditingNotes ? (
                    <div className="space-y-2">
                      <textarea
                        value={notes[item.id] ?? ''}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        rows={3}
                        placeholder="Add internal notes..."
                        className="w-full rounded-xl border bg-white/80 px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1 resize-none"
                        style={{ borderColor: brand.border }}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveNotes(item.id)}
                          disabled={saving === item.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                          style={{ backgroundColor: brand.primary }}
                        >
                          {saving === item.id ? 'Saving...' : 'Save notes'}
                        </button>
                        <button
                          onClick={() => {
                            setExpandedNotes(null);
                            setNotes((prev) => ({ ...prev, [item.id]: item.admin_notes ?? '' }));
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                          style={{ borderColor: brand.border, color: brand.muted }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setExpandedNotes(item.id)}
                      className="text-xs underline underline-offset-2"
                      style={{ color: brand.muted }}
                    >
                      {item.admin_notes ? 'Edit notes' : 'Add notes'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(2,6,23,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 rounded-full p-2 bg-white/20 hover:bg-white/30 transition-colors text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
