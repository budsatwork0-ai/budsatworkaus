'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';
import { type ContentLearningRecord } from '@/types/content-feedback';

// ── Types ─────────────────────────────────────────────────────────────────────

type LearningPoint = { title: string; detail: string; evidence: string; signalType: string };

// ── Outcome score chips ───────────────────────────────────────────────────────

function OutcomeChips({ score }: { score: Record<string, unknown> }) {
  const reach = Number(score?.reach ?? 0);
  const comments = Number(score?.comments ?? 0);
  const conversions = Number(score?.conversions ?? 0);

  if (!reach && !comments && !conversions) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {reach > 0 && (
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
          {reach} reach
        </span>
      )}
      {comments > 0 && (
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {comments} comments
        </span>
      )}
      {conversions > 0 && (
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          {conversions} conversions
        </span>
      )}
    </div>
  );
}

// ── Learning card ─────────────────────────────────────────────────────────────

function LearningCard({
  record,
  onApprove,
}: {
  record: ContentLearningRecord;
  onApprove: (id: string) => void;
}) {
  const [approving, setApproving] = useState(false);
  const isDraft = record.status === 'draft';

  const worked: LearningPoint[] = Array.isArray(record.what_worked)
    ? (record.what_worked as unknown as LearningPoint[])
    : [];
  const failed: LearningPoint[] = Array.isArray(record.what_failed)
    ? (record.what_failed as unknown as LearningPoint[])
    : [];

  async function handleApprove() {
    setApproving(true);
    try {
      const res = await fetch(`/api/content-feedback/${record.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? 'Failed to approve');
        return;
      }
      toast.success('Learning approved');
      onApprove(record.id);
    } catch {
      toast.error('Failed to approve');
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={
                record.status === 'approved'
                  ? { background: '#ECFDF5', color: '#047857' }
                  : record.status === 'rejected'
                  ? { background: '#FEF2F2', color: '#B91C1C' }
                  : { background: '#F8FAFC', color: '#64748B' }
              }
            >
              {record.status}
            </span>
            {record.goal && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {record.goal}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-950">{record.campaign_title}</p>
        </div>
        {isDraft && (
          <button
            type="button"
            onClick={handleApprove}
            disabled={approving}
            className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-60"
            style={{ background: brand.accent }}
          >
            {approving ? 'Approving...' : 'Approve'}
          </button>
        )}
      </div>

      {/* Outcome chips */}
      <div className="mt-3">
        <OutcomeChips score={record.outcome_score as Record<string, unknown>} />
      </div>

      {/* What worked */}
      {worked.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-600">
            What worked
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {worked.map((point, i) => (
              <li key={i} className="text-sm leading-5 text-slate-700">
                {point.title || point.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What failed */}
      {failed.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-600">
            What failed
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {failed.map((point, i) => (
              <li key={i} className="text-sm leading-5 text-slate-700">
                {point.title || point.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Log learning form ─────────────────────────────────────────────────────────

function LogLearningForm({
  prefillItemTitle,
  onLogged,
}: {
  prefillItemTitle: string;
  onLogged: (record: ContentLearningRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [itemTitle, setItemTitle] = useState(prefillItemTitle);
  const [platform, setPlatform] = useState('');
  const [hookType, setHookType] = useState('');
  const [format, setFormat] = useState('');
  const [reach, setReach] = useState('');
  const [comments, setComments] = useState('');
  const [conversions, setConversions] = useState('');
  const [whatWorked, setWhatWorked] = useState('');
  const [whatFailed, setWhatFailed] = useState('');
  const [lesson, setLesson] = useState('');
  const [approveImmediately, setApproveImmediately] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync pre-fill when prop updates (e.g. from URL param)
  useEffect(() => {
    if (prefillItemTitle) setItemTitle(prefillItemTitle);
  }, [prefillItemTitle]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/content-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_title: itemTitle.trim() || 'Manual',
          platform,
          hook_type: hookType,
          format,
          reach: reach ? Number(reach) : 0,
          comments: comments ? Number(comments) : 0,
          conversions: conversions ? Number(conversions) : 0,
          what_worked: whatWorked,
          what_failed: whatFailed,
          lesson,
          approve_immediately: approveImmediately,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to log learning');
        return;
      }
      toast.success('Learning logged');
      onLogged(data.learning_record as ContentLearningRecord);
      // Reset form
      setItemTitle('');
      setPlatform('');
      setHookType('');
      setFormat('');
      setReach('');
      setComments('');
      setConversions('');
      setWhatWorked('');
      setWhatFailed('');
      setLesson('');
      setApproveImmediately(false);
      setOpen(false);
    } catch {
      toast.error('Failed to log learning');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">Log a learning</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
        >
          {open ? 'Cancel' : 'Add learning'}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Linked content (optional)
              </label>
              <input
                type="text"
                placeholder="Content title"
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Select platform</option>
                <option value="Instagram">Instagram</option>
                <option value="TikTok">TikTok</option>
                <option value="Facebook">Facebook</option>
                <option value="Email">Email</option>
                <option value="All">All</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Hook type used
              </label>
              <input
                type="text"
                placeholder="e.g. Problem/solution"
                value={hookType}
                onChange={(e) => setHookType(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Format</label>
              <input
                type="text"
                placeholder="e.g. Reel, Carousel"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Reach</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={reach}
                onChange={(e) => setReach(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Comments</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Conversions
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={conversions}
                onChange={(e) => setConversions(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              What worked
            </label>
            <textarea
              placeholder="One item per line"
              value={whatWorked}
              onChange={(e) => setWhatWorked(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              What failed
            </label>
            <textarea
              placeholder="One item per line"
              value={whatFailed}
              onChange={(e) => setWhatFailed(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Lesson (feeds future Create recommendations)
            </label>
            <textarea
              placeholder="What should we do differently next time?"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={approveImmediately}
              onChange={(e) => setApproveImmediately(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm font-medium text-slate-700">Approve immediately</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: brand.accent }}
          >
            {loading ? 'Saving...' : 'Save learning'}
          </button>
        </form>
      )}
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────

export function LearnClient({
  initialRecords,
}: {
  initialRecords: ContentLearningRecord[];
}) {
  const searchParams = useSearchParams();
  const itemId = searchParams?.get('item_id') ?? null;

  const [records, setRecords] = useState(initialRecords);
  // We don't have the item title at load time from just an ID, so we pre-fill
  // the form with a placeholder that the user can override.
  const [prefillTitle, setPrefillTitle] = useState('');

  // When ?item_id= is present, try to fetch the library item title for pre-fill
  useEffect(() => {
    if (!itemId) return;
    fetch(`/api/content-library?q=`)
      .then((r) => r.json())
      .then((data) => {
        const item = (data?.items ?? []).find(
          (i: { id: string; title: string }) => i.id === itemId,
        );
        if (item?.title) setPrefillTitle(item.title);
      })
      .catch(() => {});
  }, [itemId]);

  function handleLogged(record: ContentLearningRecord) {
    setRecords((prev) => [record, ...prev]);
  }

  function handleApproved(id: string) {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'approved' as const } : r)),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <LogLearningForm prefillItemTitle={prefillTitle} onLogged={handleLogged} />

      {records.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 p-8 text-center">
          <p className="text-sm text-slate-500">
            No learnings logged yet. Add your first one above.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {records.map((record) => (
            <LearningCard key={record.id} record={record} onApprove={handleApproved} />
          ))}
        </div>
      )}
    </div>
  );
}
