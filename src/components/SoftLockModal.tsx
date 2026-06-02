'use client';

import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { dashboardTheme } from '@/lib/design-system/themes';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface SoftLockModalProps {
  user: User | null;
  onUnlock: (password: string) => Promise<{ error: string | null }>;
  onSignOut: () => void;
}

export function SoftLockModal({ user, onUnlock, onSignOut }: SoftLockModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const firstName = (user?.user_metadata?.full_name as string)?.split(' ')[0] ?? 'you';

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(null);
    const { error: err } = await onUnlock(password);
    if (err) setError(err);
    setLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
    if (err) {
      setError('Could not start Google sign-in. Please try again.');
      setGoogleLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
    >
      {/* Underlying content is visually locked via the overlay above */}
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-black/10 overflow-hidden"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="soft-lock-title"
      >
        <div className="px-6 py-5">
          {/* Icon */}
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(15,61,46,0.08)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dashboardTheme.color.primary} strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>

          <h2 id="soft-lock-title" className="text-base font-semibold text-slate-900 mb-1">
            Session paused
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            Welcome back{firstName !== 'you' ? `, ${firstName}` : ''}. Your progress is saved — verify
            it&apos;s you to continue.
          </p>

          {/* Password unlock */}
          <form onSubmit={handleUnlock} className="space-y-3 mb-4">
            <div>
              <input
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3d2e]/30"
                autoFocus
                autoComplete="current-password"
              />
              {error && (
                <p className="text-xs text-red-600 mt-1.5">{error}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{ background: dashboardTheme.color.primary }}
            >
              {loading ? 'Verifying…' : 'Unlock'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-px bg-black/8" />
            <span className="text-xs text-slate-400">or</span>
            <div className="flex-1 h-px bg-black/8" />
          </div>

          {/* Google re-auth */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-black/10 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            {/* Google logo */}
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {/* Sign out link */}
          <button
            onClick={onSignOut}
            className="w-full mt-4 text-xs text-slate-400 hover:text-slate-600 transition-colors text-center"
          >
            Sign out and lose progress
          </button>
        </div>
      </div>
    </div>
  );
}
