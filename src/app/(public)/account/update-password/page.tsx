'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { brand } from '../../../ui/theme';
import { homePathForRole, resolveUserRole } from '@/types/roles';
import { AuthSplitLayout } from '../_components/AuthSplitLayout';
import { Spinner, AlertCircleIcon } from '../_components/AuthIcons';
import { PasswordField } from '../_components/PasswordField';

const INVITE_STEPS = [
  { icon: '📋', label: 'Complete your profile', detail: '~5 min' },
  { icon: '✅', label: 'Team review & approval', detail: '1–2 days' },
  { icon: '💰', label: 'Start accepting paid jobs', detail: "You're in!" },
];

export default function UpdatePasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInvite = searchParams?.get('type') === 'invite';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match. Please re-enter them.");
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');
    const supabase = getSupabaseBrowserClient();
    const { data, error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    const role = resolveUserRole(data.user?.app_metadata?.role);
    if (isInvite && role === 'employee') {
      router.push('/crew/onboarding');
    } else {
      router.push(homePathForRole(role));
    }
    router.refresh();
  }

  return (
    <AuthSplitLayout>
      <h1 className="text-2xl font-bold text-white mb-1">
        {isInvite ? 'Welcome to Buds at Work!' : 'Set a new password'}
      </h1>
      <p className="text-slate-400 text-sm mb-7">
        {isInvite
          ? 'Set a password to activate your staff account.'
          : 'Choose a strong password for your account.'}
      </p>

      {isInvite && (
        <div className="rounded-xl p-4 mb-6 border border-emerald-500/20 bg-emerald-500/8">
          <p className="text-xs font-semibold text-emerald-400 mb-3">What happens after you activate</p>
          <div className="space-y-2.5">
            {INVITE_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-base leading-none">{step.icon}</span>
                <div className="flex-1">
                  <span className="text-xs font-medium text-white/80">{step.label}</span>
                </div>
                <span className="text-xs text-slate-500">{step.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <PasswordField
          id="password"
          label={isInvite ? 'Create a password' : 'New password'}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          showStrength
          dark
        />

        <PasswordField
          id="confirm"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Repeat your password"
          autoComplete="new-password"
          matchAgainst={password}
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
          {loading
            ? 'Saving…'
            : isInvite
            ? 'Activate account & start onboarding'
            : 'Update password'}
        </button>

        <p className="text-center text-xs text-slate-500">
          <svg className="inline h-3 w-3 mr-1 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Your details are encrypted and kept private
        </p>
      </form>
    </AuthSplitLayout>
  );
}
