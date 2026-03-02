'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { brand } from '../../../ui/theme';
import { AuthSplitLayout } from '../_components/AuthSplitLayout';
import { Spinner, AlertCircleIcon } from '../_components/AuthIcons';
import { PasswordField } from '../_components/PasswordField';
import { GoogleButton, OrDivider } from '../_components/GoogleButton';

export default function SignUpPage() {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, email, password, role: 'customer' }),
    });
    const data = await res.json();

    if (!res.ok) {
      const msg = (data as { error?: string }).error;
      if (msg?.toLowerCase().includes('already registered') || msg?.toLowerCase().includes('already exists')) {
        setError('An account with this email already exists. Try signing in instead.');
      } else {
        setError(msg || 'Could not create account. Please try again.');
      }
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError('Account created! Go to the sign-in page to log in.');
      return;
    }

    router.push('/portal');
    router.refresh();
  }

  return (
    <AuthSplitLayout>
      <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
      <p className="text-slate-400 text-sm mb-7">Book services and manage your orders</p>

      <GoogleButton label="Sign up with Google" dark />
      <OrDivider dark />

      <form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-white/70 mb-1.5">
            Full name
          </label>
          <input
            ref={nameRef}
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-all focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10"
            placeholder="Your full name"
            autoComplete="name"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-1.5">
            Email address
          </label>
          <input
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

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          showStrength
          dark
        />

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
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="mt-7 pt-6 border-t border-white/8 text-center">
        <p className="text-sm text-slate-400">
          Already have an account?{' '}
          <Link href="/account" className="font-semibold text-emerald-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
