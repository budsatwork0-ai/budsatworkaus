'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { brand } from '../../../ui/theme';
import { homePathForRole, resolveUserRole } from '@/types/roles';
import { AuthSplitLayout } from './AuthSplitLayout';
import { Spinner, AlertCircleIcon } from './AuthIcons';
import { PasswordField } from './PasswordField';
import { GoogleButton, OrDivider } from './GoogleButton';

function UserRoundIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function BriefcaseSmIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
}

const VARIANT_CONFIG = {
  customer: {
    heading: 'Welcome back',
    subheading: 'Sign in to your account',
    footer: (
      <div className="mt-7 pt-6 border-t border-white/8 text-center">
        <p className="text-sm text-slate-400">
          New customer?{' '}
          <Link href="/account/sign-up" className="font-semibold text-emerald-400 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    ),
  },
  staff: {
    heading: 'Welcome back, crew',
    subheading: 'Sign in to your crew account',
    footer: (
      <div className="mt-7 pt-6 border-t border-white/8 text-center">
        <p className="text-sm text-slate-400">
          No account yet?{' '}
          <Link href="/account/join" className="font-semibold text-emerald-400 hover:underline">
            Apply to join
          </Link>
        </p>
      </div>
    ),
  },
} as const;

interface SignInFormProps {
  variant?: 'customer' | 'staff';
}

export default function SignInForm({ variant = 'customer' }: SignInFormProps) {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const config = VARIANT_CONFIG[variant];

  // If the OAuth callback bounced us back here because the email already
  // belongs to another account, surface a friendly hint and pre-fill the
  // address so they can sign in with their original method.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    const hintEmail = params.get('email');
    if (reason === 'existing_account' && hintEmail) {
      setEmail(hintEmail);
      setInfo(
        `Looks like ${hintEmail} is already registered with a password. Sign in below — or use “Forgot password?” if you need a reset.`
      );
    }
    emailRef.current?.focus();
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = getSupabaseBrowserClient();
    const { error: signInError, data } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(
        signInError.message.includes('Invalid login credentials')
          ? 'Incorrect email or password. Please try again.'
          : signInError.message
      );
      setLoading(false);
      return;
    }

    // Await audit log so failures are visible (logged server-side as 500), but never block UX.
    try {
      const auditRes = await fetch('/api/auth/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign_in', method: 'password' }),
      });
      if (!auditRes.ok) console.error('[auth] Audit log failed for sign_in event');
    } catch {
      console.error('[auth] Audit log request failed');
    }

    const params = new URLSearchParams(window.location.search);
    const redirectParam = params.get('redirect');
    if (redirectParam) {
      router.push(redirectParam);
    } else {
      const role = resolveUserRole(data.session?.user?.app_metadata?.role);
      router.push(homePathForRole(role));
    }
    router.refresh();
  }

  return (
    <AuthSplitLayout variant={variant}>
      {/* Portal switcher */}
      <div className="flex rounded-xl border border-white/10 bg-white/5 p-1 mb-8">
        <Link
          href="/account"
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
            variant === 'customer'
              ? 'bg-emerald-600/90 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <UserRoundIcon />
          Customer
        </Link>
        <Link
          href="/account/crew"
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
            variant === 'staff'
              ? 'bg-indigo-600/90 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BriefcaseSmIcon />
          Staff
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-white mb-1">{config.heading}</h1>
      <p className="text-slate-400 text-sm mb-7">{config.subheading}</p>

      <GoogleButton label="Sign in with Google" dark />
      <OrDivider dark />

      <form onSubmit={handleSignIn} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-1.5">
            Email address
          </label>
          <input
            ref={emailRef}
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-all focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="sign-in-password" className="block text-sm font-medium text-white/70">
              Password
            </label>
            <Link href="/account/forgot-password" className="text-xs font-medium text-emerald-400 hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordField
            id="sign-in-password"
            label=""
            value={password}
            onChange={setPassword}
            placeholder="Your password"
            autoComplete="current-password"
            dark
          />
        </div>

        {info && !error && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-300 flex items-start gap-2">
            <AlertCircleIcon className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{info}</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-start gap-2">
            <AlertCircleIcon className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-md hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: brand.primary }}
        >
          {loading && <Spinner />}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {config.footer}
    </AuthSplitLayout>
  );
}
