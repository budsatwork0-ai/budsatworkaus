'use client';

import { useState } from 'react';
import { brand } from '@/app/ui/theme';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface Props {
  prefillEmail: string;
  prefillName: string;
  className?: string;
}

type Mode = 'signup' | 'signin';

export function QuoteAuthGate({ prefillEmail, prefillName, className = '' }: Props) {
  const [mode, setMode] = useState<Mode>('signup');
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyPrompt, setVerifyPrompt] = useState(false);

  const signInAndDispatch = async (email: string, pw: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (err || !data.user) return err?.message ?? 'Sign-in failed.';
    const role = data.user.app_metadata?.role as string | undefined;
    if (role === 'admin' || role === 'employee') {
      await supabase.auth.signOut();
      return 'This sign-in is for customers only. Staff should use the crew portal.';
    }
    window.dispatchEvent(new CustomEvent('svc:auth-signin', { detail: data.user }));
    return null;
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError(null);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: prefillName || prefillEmail.split('@')[0], email: prefillEmail, password, role: 'customer' }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) {
      const msg = data.error ?? 'Could not create account. Please try again.';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists')) {
        setError('An account with this email already exists.');
        setMode('signin');
      } else {
        setError(msg);
      }
      setLoading(false);
      return;
    }

    // Account created — try immediate sign-in (works if email confirmation is disabled).
    const signInErr = await signInAndDispatch(prefillEmail, password);
    if (!signInErr) {
      // Success — ServicesPageContent will pick up the event and hide this gate.
      setLoading(false);
      return;
    }

    // Email confirmation required — prompt the user to verify then sign in.
    setVerifyPrompt(true);
    setMode('signin');
    setPassword('');
    setError(null);
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const msg = await signInAndDispatch(prefillEmail, password);
    if (msg) {
      setError(msg);
    }
    setLoading(false);
  };

  return (
    <div className={`rounded-2xl bg-[#F6FBF7] ring-1 ring-black/8 shadow-[0_4px_16px_rgba(2,6,23,0.07)] px-5 pt-5 pb-4 ${className}`}>
      {/* Header */}
      <p className="text-[15px] font-semibold leading-tight" style={{ color: brand.text }}>
        {mode === 'signup' ? 'Create a free account to submit' : 'Sign in to submit your quote'}
      </p>
      <p className="mt-1 text-[12.5px] leading-snug text-slate-500">
        {verifyPrompt
          ? `Account created! Check your inbox at ${prefillEmail} to verify, then sign in below.`
          : mode === 'signup'
          ? "Your quote will be saved so you can track it anytime."
          : "Welcome back — sign in to link your quote to your account."}
      </p>

      {/* Google OAuth — primary action */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading}
        className="mt-4 w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl bg-white text-[13.5px] font-medium text-slate-800 shadow-[0_1px_2px_rgba(2,6,23,0.06)] ring-1 ring-black/5 transition-all hover:bg-white hover:shadow-[0_4px_14px_rgba(2,6,23,0.08)] active:scale-[0.99] disabled:opacity-60"
      >
        <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        {googleLoading ? 'Just a sec…' : mode === 'signup' ? 'Continue with Google' : 'Sign in with Google'}
      </button>

      {/* Email/password — revealed on demand in sign-up, always shown in sign-in */}
      {(mode === 'signin' || emailExpanded) ? (
        <form onSubmit={mode === 'signup' ? handleSignUp : handleSignIn} className="mt-4 space-y-2">
          {/* Read-only email — locked to what they typed in the contact form */}
          <div className="w-full rounded-xl bg-white/60 px-3 py-2 text-[13px] ring-1 ring-black/5 text-slate-500 select-none">
            {prefillEmail || <span className="text-slate-400 italic">fill in your email above first</span>}
          </div>
          <input
            type="password"
            placeholder={mode === 'signup' ? 'Choose a password (min 8 chars)' : 'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            className="w-full rounded-xl bg-white px-3 py-2 text-[13px] ring-1 ring-black/5 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f3d2e]/30"
          />
          {error && <p className="text-[12px] text-red-600 px-0.5">{error}</p>}
          <button
            type="submit"
            disabled={loading || !prefillEmail}
            className="w-full py-2 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
            style={{ background: brand.primary }}
          >
            {loading
              ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
              : (mode === 'signup' ? 'Create account & submit' : 'Sign in')}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEmailExpanded(true)}
          className="mt-3 w-full text-center text-[12px] text-slate-500 hover:text-slate-700 transition-colors"
        >
          Use email instead
        </button>
      )}

      {/* Mode toggle */}
      <p className="mt-4 text-center text-[11.5px] text-slate-400">
        {mode === 'signup' ? (
          <>Already have an account?{' '}
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); setPassword(''); }}
              className="font-medium hover:underline"
              style={{ color: brand.primary }}
            >Sign in</button>
          </>
        ) : (
          <>New here?{' '}
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); setPassword(''); setVerifyPrompt(false); setEmailExpanded(false); }}
              className="font-medium hover:underline"
              style={{ color: brand.primary }}
            >Create an account</button>
          </>
        )}
      </p>
    </div>
  );
}
