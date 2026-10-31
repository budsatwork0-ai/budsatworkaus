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
  // New key per opening = brand-new textarea, so no old iOS undo history.
  const [formKey, setFormKey] = useState(0);
  // Refs so the single motion listener never goes stale or gets re-added.
  const openRef = useRef(false);
  const lockRef = useRef(false);
  const cooldownUntil = useRef(0);

  const close = useCallback(() => {
    openRef.current = false;
    cooldownUntil.current = Date.now() + 3000;
    (document.activeElement as HTMLElement | null)?.blur?.();
    // Unmount the form (textarea goes away) rather than clearing its value.
    setOpen(false);
    setText('');
  }, []);

  const trigger = useCallback(async () => {
    // Ignore while capturing, while the form is open, or within 3s of closing.
    if (lockRef.current || openRef.current || Date.now() < cooldownUntil.current) return;
    lockRef.current = true;
    // Safety: the lock can never stay stuck longer than 10s.
    const safety = window.setTimeout(() => { lockRef.current = false; }, 10000);
    (document.activeElement as HTMLElement | null)?.blur?.();
    try {
      const { domToBlob } = await import('modern-screenshot');
      const capture = domToBlob(document.body, {
        type: 'image/png', scale: Math.min(window.devicePixelRatio || 1, 2),
        width: window.innerWidth, height: window.innerHeight,
        style: { transform: `translateY(-${window.scrollY}px)` },
        // Keep the feedback prompt/form out of the screenshot.
        filter: (node) => !(node instanceof Element && node.hasAttribute('data-shake-ui')),
      });
      // Don't wait forever for the screenshot; open the form without one.
      const blob = await Promise.race([capture, new Promise<null>((r) => setTimeout(() => r(null), 6000))]);
      if (blob) { setShot(blob); setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); }); }
      else { setShot(null); setPreview(null); }
    } catch { setShot(null); setPreview(null); }
    finally {
      window.clearTimeout(safety);
      setText(''); setStatus('idle');
      setFormKey((k) => k + 1);
      openRef.current = true; setOpen(true);
      lockRef.current = false;
    }
  }, []);

  // iOS: permission must be asked synchronously inside a real tap, and Safari
  // often forgets it on reload. So: always listen; on the first tap anywhere ask
  // again (no await before the call); show a persistent pill until motion
  // events actually arrive. Old "dismissed"/"denied" flags no longer hide it.
  const askingRef = useRef(false);
  const ask = useCallback(() => {
    const DM = window.DeviceMotionEvent as unknown as MotionPerm;
    if (typeof DM?.requestPermission !== 'function' || askingRef.current) return;
    askingRef.current = true;
    DM.requestPermission().then((r) => {
      if (r === 'granted') { sessionStorage.setItem(ASKED_KEY, 'granted'); setMotionOn(true); }
    }).catch(() => {}).finally(() => { askingRef.current = false; });
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return;
    setMotionOn(true); // listener on; on iOS events only flow once granted
    const DM = window.DeviceMotionEvent as unknown as MotionPerm;
    if (typeof DM.requestPermission !== 'function') return;
    let got = false;
    const seen = (e: DeviceMotionEvent) => {
      if (!e.accelerationIncludingGravity) return;
      got = true; sessionStorage.setItem(ASKED_KEY, 'granted'); setShowPrompt(false); detach();
    };
    const tap = () => { if (!got) ask(); };
    const detach = () => {
      window.removeEventListener('devicemotion', seen);
      window.removeEventListener('touchend', tap, true);
      window.removeEventListener('click', tap, true);
    };
    window.addEventListener('devicemotion', seen);
    window.addEventListener('touchend', tap, true);
    window.addEventListener('click', tap, true);
    const t = window.setTimeout(() => {
      if (!got && sessionStorage.getItem(ASKED_KEY + '-hide') !== '1') setShowPrompt(true);
    }, 1500);
    return () => { window.clearTimeout(t); detach(); };
  }, [ask]);

  // Exactly one devicemotion listener, removed on cleanup.
  useEffect(() => {
    if (!motionOn) return;
    let hits = 0; let lastHit = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity; if (!a) return;
      const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
      const now = Date.now();
      if (mag > 20) { hits = now - lastHit < 600 ? hits + 1 : 1; lastHit = now; }
      if (hits >= 2) { hits = 0; void trigger(); }
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [motionOn, trigger]);

  // Long-press (~0.6s) on a page title (h1) anywhere on the site opens the form.
  // Alternative to shaking, which iOS can hijack for "Undo Typing".
  useEffect(() => {
    let timer: number | undefined; let sx = 0; let sy = 0;
    const cancel = () => { if (timer) window.clearTimeout(timer); timer = undefined; };
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest?.('h1') || t.closest('[data-shake-ui]')) return;
      sx = e.clientX; sy = e.clientY; cancel();
      timer = window.setTimeout(() => { timer = undefined; void trigger(); }, 600);
    };
    const move = (e: PointerEvent) => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', cancel);
    window.addEventListener('pointercancel', cancel);
    return () => { cancel(); window.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', cancel); window.removeEventListener('pointercancel', cancel); };
  }, [trigger]);

  useEffect(() => {
    const h = () => void trigger();
    window.addEventListener('bud:feedback', h);
    return () => window.removeEventListener('bud:feedback', h);
  }, [trigger]);

  function enableIos() { ask(); }

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
          <span className="flex-1 text-sm text-[#0F3F33]">Shake, or hold a page title, to send feedback.</span>
          <button onClick={enableIos} className="rounded-full bg-[#0F3F33] px-3 py-2 text-sm font-semibold text-white">Enable shake feedback</button>
          <button onClick={() => { sessionStorage.setItem(ASKED_KEY + '-hide', '1'); setShowPrompt(false); }} aria-label="Not now" className="px-2 text-lg text-[#0F3F33]/60">×</button>
        </div>
      )}
      {open && (
        <div data-shake-ui className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={close}>
          <div className="flex max-h-[90vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#0F3F33]">Send feedback</h2>
            {preview && <img src={preview} alt="Screenshot" className="max-h-60 w-full rounded-xl border object-contain object-top" />}
            <textarea key={formKey} value={text} onChange={(e) => setText(e.target.value)} rows={4} autoFocus placeholder="What's wrong or what would help?" className="w-full rounded-xl border border-[#0F3F33]/20 p-3 text-base" />
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
