'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { brand } from '@/app/ui/theme';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface AccountButtonProps {
  onSignIn?: (user: User) => void;
  inline?: boolean;
}

const GOOGLE_ICON = (
  <svg width="16" height="16" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

export function AccountButton({ onSignIn, inline }: AccountButtonProps) {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const applyUser = async (u: User | null) => {
      if (!u) { setUser(null); return; }
      const role = u.app_metadata?.role as string | undefined;
      if (role === 'admin' || role === 'employee') {
        await supabase.auth.signOut();
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

  useEffect(() => {
    if (!open) {
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
      setError('That email or password didn\'t match.');
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

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setOpen(false);
  };

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? '';
  const firstName = fullName.split(' ')[0] || '';
  const initials = firstName
    ? firstName.slice(0, 2).toUpperCase()
    : (user?.email ?? '').slice(0, 2).toUpperCase() || '?';

  return (
    <div ref={panelRef} className={inline ? 'relative' : 'fixed top-4 right-4 z-50'}>
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

      {/* ── Trigger button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 pl-2.5 pr-3.5 py-1.5 rounded-full bg-white/85 backdrop-blur shadow-[0_1px_2px_rgba(2,6,23,0.06)] ring-1 ring-black/8 transition-all hover:shadow-[0_2px_8px_rgba(2,6,23,0.10)]"
      >
        {user ? (
          <>
            <div
              className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
              style={{ background: brand.primary }}
            >
              {initials}
            </div>
            <span className="text-xs font-medium" style={{ color: brand.text }}>
              {firstName || 'Account'}
            </span>
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: brand.primary }}>
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="text-xs font-semibold" style={{ color: brand.primary }}>Sign in</span>
          </>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          role="dialog"
          aria-label={user ? 'Account menu' : 'Sign in to Buds at Work'}
          className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-white ring-1 ring-black/8 shadow-[0_10px_40px_-8px_rgba(2,6,23,0.18)] overflow-hidden"
          style={{ animation: 'svc-auth-fade 180ms ease-out both' }}
        >
          {user ? (
            /* ── Signed-in dropdown ── */
            <div className="py-1">
              {/* Profile header */}
              <div className="px-4 py-3 border-b border-black/6">
                <p className="text-[13px] font-semibold leading-tight" style={{ color: brand.text }}>
                  {fullName || firstName || 'My account'}
                </p>
                <p className="text-[11.5px] text-slate-400 mt-0.5 truncate">{user.email}</p>
              </div>

              {/* Nav links */}
              <div className="py-1">
                {[
                  { label: 'Saved quotes', href: '/portal/quotes' },
                  { label: 'My bookings', href: '/portal' },
                  { label: 'Account details', href: '/portal/account' },
                ].map(({ label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="flex items-center px-4 py-2.5 text-[13px] font-medium transition-colors hover:bg-black/4"
                    style={{ color: brand.text }}
                  >
                    {label}
                  </Link>
                ))}
              </div>

              {/* Sign out */}
              <div className="border-t border-black/6 py-1">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center px-4 py-2.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-black/4 hover:text-slate-700"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            /* ── Sign-in dropdown ── */
            <div className="px-5 pt-5 pb-4">
              <p className="text-[15px] font-semibold leading-tight" style={{ color: brand.text }}>
                Sign in to Buds at Work
              </p>
              <p className="mt-1 text-[12.5px] leading-snug text-slate-500">
                Save your quote, skip re-entering details, and finish bookings faster.
              </p>

              <button
                onClick={handleGoogle}
                disabled={googleLoading}
                className="mt-4 w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl bg-white text-[13.5px] font-medium text-slate-800 shadow-[0_1px_2px_rgba(2,6,23,0.06)] ring-1 ring-black/8 transition-all hover:shadow-[0_4px_14px_rgba(2,6,23,0.08)] active:scale-[0.99] disabled:opacity-60"
              >
                {GOOGLE_ICON}
                {googleLoading ? 'Just a sec…' : 'Continue with Google'}
              </button>

              {!emailExpanded && (
                <button
                  type="button"
                  onClick={() => setEmailExpanded(true)}
                  className="mt-3 w-full text-center text-[12px] text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Use email instead
                </button>
              )}

              {emailExpanded && (
                <form onSubmit={handleSignIn} className="mt-4 space-y-2 svc-auth-expand-in">
                  <input
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="w-full rounded-xl bg-white px-3 py-2 text-[13px] ring-1 ring-black/8 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f3d2e]/30"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-xl bg-white px-3 py-2 text-[13px] ring-1 ring-black/8 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f3d2e]/30"
                  />
                  {error && <p className="text-[12px] text-red-600 px-0.5">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 rounded-xl text-[13px] font-semibold text-white transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50"
                    style={{ background: brand.primary }}
                  >
                    {loading ? 'Signing in…' : 'Sign in'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
