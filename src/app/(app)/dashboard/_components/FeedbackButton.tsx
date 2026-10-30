'use client';

import { useState } from 'react';
import { toast } from 'sonner';

/** Small "Feedback" button. Saves to site_feedback via /api/feedback. */
export function FeedbackButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const description = text.trim();
    if (description.length < 10) { toast.error('Write a little more (10+ letters)'); return; }
    setSaving(true);
    try {
      const form = new FormData();
      form.set('type', 'general');
      form.set('subject', `Admin: ${typeof window !== 'undefined' ? window.location.pathname : 'admin'}`.slice(0, 120));
      form.set('description', description);
      const res = await fetch('/api/feedback', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Could not save');
      toast.success('Thanks, saved');
      setText('');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`h-11 rounded-full bg-white px-5 text-sm font-bold text-[#0F3F33] shadow-sm ${className}`}
      >
        Feedback
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-3 sm:items-center" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-[24px] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-extrabold text-[#0F3F33]">What should change?</h2>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Tell us what's hard or what you'd like"
              className="mt-3 w-full rounded-[16px] border border-[#dbe7df] p-3 text-[15px] text-[#17392b] outline-none focus:border-[#3c8259]"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-full px-5 text-sm font-semibold text-[#7f9187]">Cancel</button>
              <button type="button" disabled={saving} onClick={save} className="h-11 rounded-full bg-[#3c8259] px-6 text-sm font-bold text-white disabled:opacity-60">
                {saving ? 'Saving…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
