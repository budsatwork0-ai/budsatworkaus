'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { dashboardTheme } from '@/lib/design-system/themes';

const MAX_CHARS             = 2000;
const DRAFT_SCORE_THRESHOLD = 60;

type MediaItem = { label: string; icon: string };

type DraftSuggestState =
  | { phase: 'idle' }
  | { phase: 'generating' }
  | { phase: 'done'; count: number; opportunityId: string }
  | { phase: 'error' };

type Props = {
  /** Called after a successful save so the list can refresh. */
  onSaved?: () => void;
};

export default function QuickCaptureWidget({ onSaved }: Props) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [draftSuggest, setDraftSuggest] = useState<DraftSuggestState>({ phase: 'idle' });

  // Voice recording state
  const [recording, setRecording] = useState(false);
  const recorderRef   = useRef<MediaRecorder | null>(null);
  const recStartRef   = useRef<number>(0);
  const recTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recSeconds, setRecSeconds] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const remaining = MAX_CHARS - text.length;
  const trimmed   = text.trim();

  // ── Voice recording ──────────────────────────────────────────────────────────

  function fmtSecs(s: number) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  async function toggleRecording() {
    if (recording) {
      // Stop
      recorderRef.current?.stop();
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderRef.current = mr;
      recStartRef.current = Date.now();
      setRecSeconds(0);

      recTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recStartRef.current) / 1000);
        setRecSeconds(elapsed);
        if (elapsed >= 60) mr.stop(); // 60-second cap
      }, 1000);

      mr.addEventListener('stop', () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        const secs = Math.floor((Date.now() - recStartRef.current) / 1000);
        setMediaItems((prev) => [...prev, { icon: '🎤', label: `Voice note (${fmtSecs(secs)})` }]);
        setRecording(false);
      });

      mr.start();
      setRecording(true);
    } catch {
      setFeedback({ kind: 'error', message: 'Microphone access denied.' });
    }
  }

  // ── File attachment ──────────────────────────────────────────────────────────

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaItems((prev) => [...prev, { icon: '📷', label: file.name }]);
    e.target.value = '';
  }

  function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaItems((prev) => [...prev, { icon: '🎬', label: file.name }]);
    e.target.value = '';
  }

  function removeMedia(index: number) {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trimmed || saving) return;

    setSaving(true);
    setFeedback(null);

    const mediaNote = mediaItems.length > 0
      ? mediaItems.map((m) => `${m.icon} ${m.label}`).join(' · ')
      : undefined;

    try {
      const res = await fetch('/api/journal/quick-capture', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: trimmed, ...(mediaNote ? { media_note: mediaNote } : {}) }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const json = await res.json() as {
        created:        boolean;
        opportunity_id: string | null;
        story_score:    number | null;
      };
      setText('');
      setMediaItems([]);
      textareaRef.current?.focus();
      setFeedback({
        kind:    'success',
        message: json.created
          ? "Captured — today's entry created."
          : "Appended to today's entry.",
      });
      onSaved?.();

      // If the capture produced a scored opportunity, generate draft suggestions in the background.
      if (json.opportunity_id && json.story_score !== null && json.story_score >= DRAFT_SCORE_THRESHOLD) {
        setDraftSuggest({ phase: 'generating' });
        void (async () => {
          try {
            const suggestRes = await fetch('/api/story-drafts/suggest', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ opportunity_id: json.opportunity_id }),
            });
            const suggestJson = await suggestRes.json() as { created: { id: string }[]; skipped: string[] };
            const count = suggestJson.created?.length ?? 0;
            setDraftSuggest({
              phase:         'done',
              count,
              opportunityId: json.opportunity_id!,
            });
          } catch {
            setDraftSuggest({ phase: 'error' });
          }
        })();
      }
    } catch (err) {
      setFeedback({
        kind:    'error',
        message: err instanceof Error ? err.message : 'Failed to save — please try again.',
      });
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-[20px] border border-black/5 bg-white/90 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <p
        className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: dashboardTheme.color.muted }}
      >
        Quick Capture
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value.slice(0, MAX_CHARS));
            setFeedback(null);
          }}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="What happened today?"
          className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-5 placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{
            borderColor: dashboardTheme.color.border,
            color:       dashboardTheme.color.text,
            background:  'rgba(15,61,46,0.015)',
          }}
          disabled={saving}
          aria-label="Quick journal capture text"
        />

        {/* Media attachment chips */}
        {mediaItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mediaItems.map((item, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ background: 'rgba(15,61,46,0.06)', color: dashboardTheme.color.primary }}
              >
                {item.icon} {item.label}
                <button
                  type="button"
                  onClick={() => removeMedia(i)}
                  className="ml-0.5 opacity-50 hover:opacity-100"
                  aria-label={`Remove ${item.label}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center justify-between gap-2">

          {/* Left: media buttons */}
          <div className="flex items-center gap-1.5">
            {/* Voice */}
            <button
              type="button"
              onClick={toggleRecording}
              disabled={saving}
              title={recording ? `Recording… ${fmtSecs(recSeconds)}` : 'Record voice note'}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
              style={{
                background: recording ? '#FEF2F2' : 'rgba(15,61,46,0.06)',
                color:      recording ? '#DC2626' : dashboardTheme.color.muted,
              }}
            >
              {recording ? `⏹ ${fmtSecs(recSeconds)}` : '🎤'}
            </button>

            {/* Image */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={saving}
              title="Attach image"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
              style={{ background: 'rgba(15,61,46,0.06)', color: dashboardTheme.color.muted }}
            >
              📷
            </button>

            {/* Video */}
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={saving}
              title="Attach video"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition"
              style={{ background: 'rgba(15,61,46,0.06)', color: dashboardTheme.color.muted }}
            >
              🎬
            </button>

            <span className="text-[11px]" style={{ color: remaining < 100 ? '#B45309' : dashboardTheme.color.muted }}>
              {remaining < MAX_CHARS ? `${remaining} left` : ''}
            </span>
          </div>

          {/* Right: save */}
          <button
            type="submit"
            disabled={!trimmed || saving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ background: dashboardTheme.color.primary }}
          >
            {saving ? 'Saving…' : 'Capture'}
          </button>
        </div>

        {feedback && (
          <p
            className="text-xs"
            style={{ color: feedback.kind === 'success' ? '#047857' : '#B91C1C' }}
            role="status"
            aria-live="polite"
          >
            {feedback.message}
            {feedback.kind === 'success' && (
              <Link
                href="/dashboard/story-engine/journal"
                className="ml-1.5 underline"
                style={{ color: dashboardTheme.color.muted }}
              >
                View entry →
              </Link>
            )}
          </p>
        )}
      </form>

      {/* Draft suggestion status — shown below feedback when score >= 60 */}
      {draftSuggest.phase === 'generating' && (
        <p className="mt-1 text-[11px] animate-pulse" style={{ color: dashboardTheme.color.muted }}>
          ✦ Generating draft suggestions…
        </p>
      )}
      {draftSuggest.phase === 'done' && (
        <p className="mt-1 text-[11px]" style={{ color: '#047857' }}>
          ✦ {draftSuggest.count === 0 ? 'Drafts already exist' : `${draftSuggest.count} draft${draftSuggest.count !== 1 ? 's' : ''} generated`}
          {' · '}
          <Link
            href="/dashboard/story-engine/opportunities"
            className="underline"
            style={{ color: dashboardTheme.color.primary }}
          >
            Review in Opportunities →
          </Link>
        </p>
      )}
      {draftSuggest.phase === 'error' && (
        <p className="mt-1 text-[11px]" style={{ color: dashboardTheme.color.muted }}>
          ✦ Draft suggestions failed — open Opportunities to generate manually.
        </p>
      )}

      <p className="mt-2 text-[10px]" style={{ color: dashboardTheme.color.muted }}>
        Cmd+Enter to save · Voice, image, and video notes stored as metadata pending media storage wiring
      </p>

      {/* Hidden file inputs */}
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoChange} />
    </div>
  );
}
