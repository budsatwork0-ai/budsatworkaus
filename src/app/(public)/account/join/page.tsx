'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { brand } from '../../../ui/theme';
import { AuthSplitLayout } from '../_components/AuthSplitLayout';
import { BriefcaseIcon, Spinner, AlertCircleIcon } from '../_components/AuthIcons';
import { PasswordField } from '../_components/PasswordField';

export default function JoinPage() {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Passwords don't match. Please re-enter them.");
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: form.full_name, email: form.email, password: form.password, role: 'employee' }),
    });
    const data = await res.json();

    if (!res.ok) {
      const msg = (data as { error?: string }).error;
      if (msg?.toLowerCase().includes('already registered') || msg?.toLowerCase().includes('already exists')) {
        setError('An account with this email already exists. Try signing in instead.');
      } else {
        setError(msg || 'Could not create account. Please try again or contact support.');
      }
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    setLoading(false);

    if (signInError) {
      setError('Account created! Please sign in to continue.');
      return;
    }

    router.push('/crew/onboarding');
    router.refresh();
  }

  return (
    <AuthSplitLayout variant="staff">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-5 border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
        <BriefcaseIcon className="h-3.5 w-3.5" />
        Staff &amp; Contractors
      </div>

      <h1 className="text-2xl font-bold text-white mb-1">Create your staff account</h1>
      <p className="text-slate-400 text-sm mb-1">Takes 2 minutes — finish the rest during onboarding.</p>
      <p className="text-emerald-400 text-sm font-medium mb-6">Complete your profile to unlock paid jobs.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Full name</label>
          <input
            ref={nameRef}
            type="text"
            required
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-all focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10"
            placeholder="Jane Smith"
            autoComplete="name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Email address</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-all focus:outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10"
            placeholder="jane@example.com"
            autoComplete="email"
          />
        </div>

        <PasswordField
          label="Password"
          value={form.password}
          onChange={(v) => setForm((f) => ({ ...f, password: v }))}
          autoComplete="new-password"
          showStrength
          dark
        />

        <PasswordField
          label="Confirm password"
          value={form.confirm}
          onChange={(v) => setForm((f) => ({ ...f, confirm: v }))}
          placeholder="Repeat your password"
          autoComplete="new-password"
          matchAgainst={form.password}
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
          className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-md hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
          style={{ background: brand.primary }}
        >
          {loading && <Spinner />}
          {loading ? 'Creating account…' : 'Create staff account'}
        </button>

        <p className="text-center text-xs text-slate-500">
          <svg className="inline h-3 w-3 mr-1 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Your details are encrypted and kept private
        </p>
      </form>

      <div className="mt-7 pt-6 border-t border-white/8 space-y-2.5 text-center">
        <p className="text-sm text-slate-400">
          Already have an account?{' '}
          <Link href="/account" className="font-semibold text-emerald-400 hover:underline">
            Sign in
          </Link>
        </p>
        <p className="text-sm text-slate-400">
          Need help?{' '}
          <a href="mailto:admin@budsatwork.com" className="font-semibold text-emerald-400 hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
