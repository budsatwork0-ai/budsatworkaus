'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { brand } from '../../../ui/theme';
import { AuthSplitLayout } from '../_components/AuthSplitLayout';
import { BriefcaseIcon, Spinner, AlertCircleIcon } from '../_components/AuthIcons';
import { PasswordField } from '../_components/PasswordField';
import { Turnstile } from '@marsidev/react-turnstile';

export default function JoinPage() {
  const nameRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

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
      body: JSON.stringify({ full_name: form.full_name, email: form.email, password: form.password, role: 'employee', turnstileToken }),
    });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      const msg = (data as { error?: string }).error;
      if (msg?.toLowerCase().includes('already registered') || msg?.toLowerCase().includes('already exists')) {
        setError('An account with this email already exists. Try signing in instead.');
      } else {
        setError(msg || 'Could not create account. Please try again or contact support.');
      }
      return;
    }

    setRegistered(true);
  }

  if (registered) {
    return (
      <AuthSplitLayout variant="staff">
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/25 mb-5">
            <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Check your inbox</h1>
          <p className="text-slate-400 text-sm mb-1">We sent a verification link to</p>
          <p className="text-emerald-400 font-medium text-sm mb-6">{form.email}</p>
          <p className="text-slate-500 text-xs">Click the link in the email to activate your account, then sign in to complete onboarding.</p>
          <div className="mt-8 pt-6 border-t border-white/8">
            <Link href="/account/crew" className="text-sm font-semibold text-emerald-400 hover:underline">
              Go to staff sign in
            </Link>
          </div>
        </div>
      </AuthSplitLayout>
    );
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

        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <Turnstile
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
            onSuccess={setTurnstileToken}
            options={{ theme: 'dark' }}
          />
        )}

        <button
          type="submit"
          disabled={loading || (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken)}
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
