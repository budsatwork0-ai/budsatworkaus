'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { brand } from '../../../ui/theme';
import { AuthSplitLayout } from '../_components/AuthSplitLayout';
import { AuthCard } from '../_components/AuthCard';
import { LeafIcon, Spinner, AlertCircleIcon } from '../_components/AuthIcons';
import { PasswordField } from '../_components/PasswordField';

type Status = 'checking' | 'ready' | 'done' | 'already-setup';

export default function SetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('checking');
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/setup')
      .then((r) => r.json())
      .then((data) => setStatus(data.setupComplete ? 'already-setup' : 'ready'))
      .catch(() => setStatus('ready'));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');

    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: form.full_name, email: form.email, password: form.password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Setup failed.');
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
      setError('Account created but sign-in failed — go to /account to log in.');
      return;
    }

    setStatus('done');
    setTimeout(() => router.push('/dashboard'), 1500);
  }

  if (status === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="h-8 w-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (status === 'already-setup') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] py-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md">
          <AuthCard>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ background: `${brand.primary}15`, color: brand.primary }}>
                <LeafIcon className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: brand.text }}>Already set up</h1>
              <p className="text-sm mb-6" style={{ color: brand.muted }}>
                An admin account already exists. Sign in to continue.
              </p>
              <Link
                href="/account"
                className="inline-block w-full rounded-xl py-3 text-sm font-semibold text-white text-center shadow-md hover:shadow-lg transition-all"
                style={{ background: brand.primary }}
              >
                Sign in
              </Link>
            </div>
          </AuthCard>
        </motion.div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] py-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8 text-emerald-600">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: brand.text }}>You&apos;re all set!</h1>
          <p className="text-sm" style={{ color: brand.muted }}>Taking you to your dashboard…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <AuthSplitLayout>
      <h1 className="text-2xl font-bold text-white mb-1">Create admin account</h1>
      <p className="text-slate-400 text-sm mb-7">This form only works once — subsequent admins are invited by you</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1.5">Full name</label>
          <input
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
            placeholder="you@budsatwork.com"
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
          className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-md hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: brand.primary }}
        >
          {loading && <Spinner />}
          {loading ? 'Setting up…' : 'Create admin account'}
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
