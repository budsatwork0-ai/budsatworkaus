'use client';

import { useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { brand } from '@/app/ui/theme';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Props {
  prefillEmail: string;
  onGuestContinue?: (token: string) => void;
  className?: string;
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

const GOOGLE_ICON = (
  <svg width="15" height="15" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

export function QuoteAuthGate({ prefillEmail, onGuestContinue, className = '' }: Props) {
  const [turnstileToken, setTurnstileToken] = useState('');
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guestBlocked = !!SITE_KEY && !turnstileToken;

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({ email: prefillEmail, password });
    if (err || !data.user) {
      setError(err?.message ?? 'Sign-in failed. Check your email and password.');
      setLoading(false);
      return;
    }
    const role = data.user.app_metadata?.role as string | undefined;
    if (role === 'admin' || role === 'employee') {
      await supabase.auth.signOut();
      setError('This sign-in is for customers only.');
      setLoading(false);
      return;
    }
    window.dispatchEvent(new CustomEvent('svc:auth-signin', { detail: data.user }));
    setLoading(false);
  };

  return (
    <div className={`rounded-2xl bg-white ring-1 ring-black/6 px-4 pt-3 pb-4 ${className}`}>

      <p className="text-[14.5px] font-semibold leading-snug" style={{ color: brand.text }}>
        Track your quote anytime
      </p>
      <p className="mt-0.5 text-[11.5px] leading-snug text-slate-400">
        We&apos;ll send updates by SMS or email. No password needed.
      </p>

      {/* Turnstile — loads quietly, auto-verifies in managed mode */}
      {SITE_KEY && (
        <div className="mt-3">
          <Turnstile
            siteKey={SITE_KEY}
            onSuccess={setTurnstileToken}
            onExpire={() => setTurnstileToken('')}
            options={{ theme: 'light', size: 'flexible' }}
          />
        </div>
      )}

      {/* Primary — guest */}
      <button
        type="button"
        onClick={() => onGuestContinue?.(turnstileToken)}
        disabled={guestBlocked}
        className="mt-3 w-full py-2.5 rounded-xl text-[13.5px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: brand.primary }}
      >
        {guestBlocked ? 'Verifying…' : 'Submit as guest'}
      </button>

      {/* Secondary — Google */}
      <p className="mt-3 mb-1 text-center text-[10.5px] text-slate-400">
        Use Google for faster repeat bookings
      </p>
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[12.5px] font-medium text-slate-600 bg-[#F5F8F6] ring-1 ring-black/6 transition-all hover:bg-[#ECF2EE] active:scale-[0.99] disabled:opacity-60"
      >
        {GOOGLE_ICON}
        {googleLoading ? 'Just a sec…' : 'Continue with Google'}
      </button>

      {/* Tertiary — existing email account */}
      {!emailExpanded ? (
        <button
          type="button"
          onClick={() => setEmailExpanded(true)}
          className="mt-2.5 w-full text-center text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          Already booked with us? Sign in
        </button>
      ) : (
        <form onSubmit={handleSignIn} className="mt-2.5 space-y-1.5">
          <div className="w-full rounded-xl bg-[#F5F8F6] px-3 py-2 text-[12.5px] ring-1 ring-black/6 text-slate-500 select-none">
            {prefillEmail || <span className="text-slate-400 italic">fill in your email above first</span>}
          </div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            className="w-full rounded-xl bg-white px-3 py-2 text-[12.5px] ring-1 ring-black/8 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f3d2e]/25"
          />
          {error && <p className="text-[11.5px] text-red-500 px-0.5">{error}</p>}
          <button
            type="submit"
            disabled={loading || !prefillEmail}
            className="w-full py-2 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
            style={{ background: brand.primary }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      )}
    </div>
  );
}
