'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/app/hooks/useAuth';
import { homePathForRole, ROLE_LABELS } from '@/types/roles';

const PORTAL_LABELS: Record<string, string> = {
  dashboard: 'the Admin Dashboard',
  crew: 'the Crew Hub',
  portal: 'the Customer Portal',
};

function WrongPortalContent() {
  const { role, isLoaded } = useAuth();
  const searchParams = useSearchParams();
  const from = searchParams?.get('from') ?? '';

  const triedTo = PORTAL_LABELS[from] ?? 'that page';
  const roleLabel = isLoaded ? ROLE_LABELS[role] : null;
  const homePath = isLoaded ? homePathForRole(role) : '/account';

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">

        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 mb-6">
          <svg className="w-8 h-8 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">Wrong portal</h1>

        <p className="text-slate-500 text-sm mb-1">
          You tried to access <span className="font-medium text-slate-700">{triedTo}</span>
          {roleLabel && (
            <>, but you&apos;re signed in as a <span className="font-medium text-slate-700">{roleLabel}</span>.</>
          )}
        </p>

        {isLoaded && (
          <p className="text-slate-400 text-sm mb-8">
            Your workspace is at{' '}
            <span className="font-medium text-slate-600">{homePath}</span>.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {isLoaded ? (
            <Link
              href={homePath}
              className="w-full inline-flex items-center justify-center rounded-xl py-3 px-6 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ background: '#0F3D2E' }}
            >
              Go to my workspace
            </Link>
          ) : (
            <div className="w-full h-11 rounded-xl bg-slate-100 animate-pulse" />
          )}

          <Link
            href="/account"
            className="w-full inline-flex items-center justify-center rounded-xl py-3 px-6 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Sign in with a different account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function WrongPortalPage() {
  return (
    <Suspense>
      <WrongPortalContent />
    </Suspense>
  );
}
