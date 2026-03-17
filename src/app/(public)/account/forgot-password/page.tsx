'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { brand } from '../../../ui/theme';
import { AuthSplitLayout } from '../_components/AuthSplitLayout';
import { Spinner, MailIcon, AlertCircleIcon } from '../_components/AuthIcons';

export default function ForgotPasswordPage() {
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = getSupabaseBrowserClient();
    // Use canonical origin (strips www) so the redirectTo always matches the Supabase allowlist.
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin.replace(/^https?:\/\/www\./, 'https://');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?redirect=/account/update-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSubmitted(true);
  }

  return (
    <AuthSplitLayout>
      <h1 className="text-2xl font-bold text-white mb-1">Reset your password</h1>
      <p className="text-slate-400 text-sm mb-7">
        {submitted ? 'Check your email for a reset link.' : "Enter your email and we'll send you a link."}
      </p>

      {submitted ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center space-y-3">
          <div className="mx-auto w-11 h-11 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <MailIcon className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-sm font-medium text-emerald-300">
            Email sent to <span className="font-semibold">{email}</span>
          </p>
          <p className="text-xs text-emerald-400/70">
            If an account exists, you&apos;ll receive a reset link shortly. Check your spam folder if it doesn&apos;t arrive.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
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
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}

      <div className="mt-7 pt-6 border-t border-white/8 text-center">
        <p className="text-sm text-slate-400">
          Remembered it?{' '}
          <Link href="/account" className="font-semibold text-emerald-400 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
