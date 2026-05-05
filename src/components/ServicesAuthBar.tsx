'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { brand } from '@/app/ui/theme';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface ServicesAuthBarProps {
  /** Called with user after sign-in so the parent can pre-fill contact fields */
  onSignIn?: (user: User) => void;
  /** Render inline (no fixed positioning) — for use inside a header/nav */
  inline?: boolean;
}

/**
 * Soft authentication for the quote flow.
 *
 * Design intent:
 *  - Feel like part of the quote, not a login wall.
 *  - One primary action (Google) — fastest path for ~80% of users.
 *  - Email / password is hidden behind a quiet "Use email instead" toggle.
 *  - Copy is benefit-led, friendly, Australian. No "Welcome back to your
 *    account" energy.
 *
 * The trigger pill in the header stays compact so it doesn't fight the
 * Step 1 → 2 → 3 hierarchy. The popover itself is a soft card on the brand
 * surface tint with no harsh borders.
 */
export function ServicesAuthBar({ onSignIn, inline }: ServicesAuthBarProps) {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load current session — block non-customer roles.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const applyUser = async (u: User | null) => {
      if (!u) { setUser(null); return; }
      const role = u.app_metadata?.role as string | undefined;
      if (role === 'admin' || role === 'employee') {
        await supabase.auth.signOut();
        setError('This sign-in is for customers only. Staff should use the crew portal.');
        setUser(null);
        return;
      }
      setUser(u);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      applyUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Close panel on outside click + reset email expansion when popover closes
  useEffect(() => {
    if (!open) {
      // give the close animation a beat before collapsing
      const t = setTimeout(() => setEmailExpanded(false), 200);
      return () => clearTimeout(t);
    }
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err || !data.user) {
      setError('Hmm, that email or password didn’t match.');
      setLoading(false);
      return;
    }
    const role = data.user.app_metadata?.role as string | undefined;
    if (role === 'admin' || role === 'employee') {
      await supabase.auth.signOut();
      setError('This sign-in is for customers only. Staff should use the crew portal.');
      setLoading(false);
      return;
    }
    setOpen(false);
    setEmail('');
    setPassword('');
    onSignIn?.(data.user);
    window.dispatchEvent(new CustomEvent('svc:auth-signin', { detail: data.user }));
    setLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
  };

  const firstName = (user?.user_metadata?.full_name as string)?.split(' ')[0];
  // Fall back to first letter of email if the user has no display name (e.g. email-only sign-up)
  const initials = firstName
    ? firstName.slice(0, 2).toUpperCase()
    : (user?.email ?? '').slice(0, 2).toUpperCase() || '?';

  return (
    <div ref={panelRef} className={inline ? 'relative' : 'fixed top-4 right-4 z-50'}>
      {user ? (
        /* ── Signed-in pill ── */
        <div className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-white/85 backdrop-blur shadow-[0_1px_2px_rgba(2,6,23,0.06)] ring-1 ring-black/5">
          <div
            className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
            style={{ background: brand.primary }}
          >
            {initials}
          </div>
          <span className="text-xs font-medium" style={{ color: brand.text }}>
            {firstName ? `Hey ${firstName}` : 'Account'}
          </span>
          <Link
            href="/portal"
            className="text-xs font-semibold ml-0.5 hover:underline"
            style={{ color: brand.primary }}
          >
            My portal →
          </Link>
        </div>
      ) : (
        /* ── Sign-in trigger + soft popover ── */
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="dialog"
            className="flex items-center gap-1.5 pl-4 pr-5 py-1.5 rounded-full bg-transparent ring-1 ring-current/40 text-sm font-semibold tracking-tight transition-all hover:ring-current/70"
            style={{ color: brand.primary }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Save progress
          </button>

          {open && (
            <div
              role="dialog"
              aria-label="Save your quote"
              className="absolute right-0 top-full mt-2 w-[19rem] rounded-2xl bg-[#F6FBF7] ring-1 ring-black/5 shadow-[0_10px_40px_-8px_rgba(2,6,23,0.18)] overflow-hidden"
              style={{
                animation: 'svc-auth-fade 180ms ease-out both',
              }}
            >
              <style jsx global>{`
                @keyframes svc-auth-fade {
                  from { opacity: 0; transform: translateY(-4px); }
                  to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes svc-auth-expand {
                  from { opacity: 0; max-height: 0; }
                  to   { opacity: 1; max-height: 320px; }
                }
                .svc-auth-expand-in { animation: svc-auth-expand 220ms ease-out both; }
              `}</style>

              <div className="px-5 pt-5 pb-4">
                {/* Hierarchy: title → subtext → primary action */}
                <p className="text-[15px] font-semibold leading-tight" style={{ color: brand.text }}>
                  Save your quote so you don’t lose it
                </p>
                <p className="mt-1 text-[12.5px] leading-snug text-slate-500">
                  We’ll keep your details handy so you can pick up where you left off.
                </p>

                {/* Primary action — single, prominent */}
                <button
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
                  {googleLoading ? 'Just a sec…' : 'Continue with Google'}
                </button>

                {/* Quiet escape hatch — no harsh divider */}
                {!emailExpanded && (
                  <button
                    type="button"
                    onClick={() => setEmailExpanded(true)}
                    className="mt-3 w-full text-center text-[12px] text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Use email instead
                  </button>
                )}

                {/* Collapsed email/password — only shown on demand */}
                {emailExpanded && (
                  <form onSubmit={handleSignIn} className="mt-4 space-y-2 svc-auth-expand-in">
                    <input
                      type="email"
                      placeholder="you@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="w-full rounded-xl bg-white px-3 py-2 text-[13px] ring-1 ring-black/5 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f3d2e]/30"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full rounded-xl bg-white px-3 py-2 text-[13px] ring-1 ring-black/5 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f3d2e]/30"
                    />
                    {error && <p className="text-[12px] text-red-600 px-0.5">{error}</p>}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
                      style={{ background: brand.primary }}
                    >
                      {loading ? 'Logging in…' : 'Log in'}
                    </button>
                  </form>
                )}

                {/* Footer — small, no shouting */}
                <p className="mt-4 text-center text-[11.5px] text-slate-400">
                  New here?{' '}
                  <Link
                    href="/account/sign-up"
                    className="font-medium hover:underline"
                    style={{ color: brand.primary }}
                  >
                    Create an account
                  </Link>
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
