'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClientSafe } from '@/lib/supabase/client';

const ASKED_KEY = 'bud-shake-asked';
type MotionPerm = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * Mounted in the root layout. Only active for signed-in users (admin, crew,
 * customer); signed-out visitors get nothing — no listener, no prompt.
 */
export function ShakeFeedback() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const sb = getSupabaseBrowserClientSafe();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!signedIn) return null;
  return <ShakeFeedbackInner />;
}

/** Shake the phone (or long-press the admin page title) to send feedback with a screenshot. */
function ShakeFeedbackInner() {
  const [open, setOpen] = useState(false);
  const [shot, setShot] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [showPrompt, setShowPrompt] = useState(false);
  const [motionOn, setMotionOn] = useState(false);
  // Refs so the single motion listener never goes stale or gets re-added.
  const openRef = useRef(false);
  const lockRef = useRef(false);
  const cooldownUntil = useRef(0);

  const close = useCallback(() => {
    openRef.current = false;
    cooldownUntil.current = Date.now() + 3000;
    setOpen(false);
  }, []);

  const trigger = useCallback(async () => {
    // Ignore while capturing, while the form is open, or within 3s of closing.
    if (lockRef.current || openRef.current || Date.now() < cooldownUntil.current) return;
    lockRef.current = true;
    try {
      const { domToBlob } = await import('modern-screenshot');
      const blob = await domToBlob(document.body, {
        type: 'image/png', scale: Math.min(window.devicePixelRatio || 1, 2),
        width: window.innerWidth, height: window.innerHeight,
        style: { transform: `translateY(-${window.scrollY}px)` },
        // Keep the feedback prompt/form out of the screenshot.
        filter: (node) => !(node instanceof Element && node.hasAttribute('data-shake-ui')),
      });
      setShot(blob); setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
    } catch { setShot(null); setPreview(null); }
    setText(''); setStatus('idle');
    openRef.current = true; setOpen(true);
    lockRef.current = false;
  }, []);

  // Decide once whether motion can be used (iOS needs a tap first).
  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return;
    const DM = window.DeviceMotionEvent as unknown as MotionPerm;
    if (typeof DM.requestPermission !== 'function') { setMotionOn(true); return; }
    const asked = localStorage.getItem(ASKED_KEY);
    if (asked === 'granted') {
      DM.requestPermission().then((r) => { if (r === 'granted') setMotionOn(true); }).catch(() => {});
    } else if (!asked) setShowPrompt(true);
  }, []);

  // Exactly one devicemotion listener, removed on cleanup.
  useEffect(() => {
    if (!motionOn) return;
    let hits = 0; let lastHit = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity; if (!a) return;
      const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
      const now = Date.now();
      if (mag > 25) { hits = now - lastHit < 600 ? hits + 1 : 1; lastHit = now; }
      if (hits >= 3) { hits = 0; void trigger(); }
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [motionOn, trigger]);

  useEffect(() => {
    const h = () => void trigger();
    window.addEventListener('bud:feedback', h);
    return () => window.removeEventListener('bud:feedback', h);
  }, [trigger]);

  async function enableIos() {
    const DM = window.DeviceMotionEvent as unknown as MotionPerm;
    try {
      const r = await DM.requestPermission!();
      localStorage.setItem(ASKED_KEY, r);
      if (r === 'granted') setMotionOn(true);
    } catch { localStorage.setItem(ASKED_KEY, 'denied'); }
    setShowPrompt(false);
  }

  async function send() {
    setStatus('sending');
    const fd = new FormData();
    fd.set('text', text); fd.set('url', window.location.href);
    if (shot) fd.set('screenshot', shot, 'screenshot.png');
    const res = await fetch('/api/feedback/shake', { method: 'POST', body: fd }).catch(() => null);
    if (res?.ok) { setStatus('sent'); setTimeout(close, 1200); } else setStatus('error');
  }

  return (
    <>
      {showPrompt && (
        <div data-shake-ui className="fixed inset-x-3 bottom-3 z-[60] flex items-center gap-2 rounded-2xl bg-white p-3 shadow-lg md:hidden">
          <span className="flex-1 text-sm text-[#0F3F33]">Shake your phone to send feedback.</span>
          <button onClick={enableIos} className="rounded-full bg-[#0F3F33] px-3 py-2 text-sm font-semibold text-white">Turn on shake feedback</button>
          <button onClick={() => { localStorage.setItem(ASKED_KEY, 'dismissed'); setShowPrompt(false); }} aria-label="Not now" className="px-2 text-lg text-[#0F3F33]/60">×</button>
        </div>
      )}
      {open && (
        <div data-shake-ui className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={close}>
          <div className="flex max-h-[90vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#0F3F33]">Send feedback</h2>
            {preview && <img src={preview} alt="Screenshot" className="max-h-60 w-full rounded-xl border object-contain object-top" />}
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} autoFocus placeholder="What's wrong or what would help?" className="w-full rounded-xl border border-[#0F3F33]/20 p-3 text-base" />
            {status === 'error' && <p className="text-sm text-red-600">Couldn&apos;t send. Try again.</p>}
            <div className="flex gap-2">
              <button onClick={close} className="flex-1 rounded-full border border-[#0F3F33]/20 py-3 font-semibold text-[#0F3F33]">Cancel</button>
              <button onClick={send} disabled={status === 'sending' || status === 'sent'} className="flex-1 rounded-full bg-[#0F3F33] py-3 font-semibold text-white">
                {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Sent ✓' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
