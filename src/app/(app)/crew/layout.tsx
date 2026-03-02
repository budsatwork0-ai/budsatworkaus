'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useEmployee } from '@/app/hooks/useEmployee';
import { brand } from '@/app/ui/theme';
import { DevRoleSwitcher } from '@/components/DevRoleSwitcher';

const ALL_NAV = [
  { href: '/crew', label: 'Home', exact: true },
  { href: '/crew/my-jobs', label: 'My Jobs' },
  { href: '/crew/jobs', label: 'Find Jobs' },
  { href: '/crew/schedule', label: 'Schedule' },
  { href: '/crew/earnings', label: 'Earnings' },
  { href: '/crew/documents', label: 'Docs' },
  { href: '/crew/profile', label: 'Profile' },
];

const ONBOARDING_NAV = [
  { href: '/crew/onboarding', label: 'Onboarding', exact: false },
  { href: '/crew/profile', label: 'Profile' },
];

const ONBOARDING_ALLOWED = ['/crew/onboarding', '/crew/profile'];

export default function CrewLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { employee, isLoading, error: employeeError, needsSetup, refetch } = useEmployee();
  const [mobileOpen, setMobileOpen] = useState(false);

  const onboarded = employee?.onboarding_complete === true;
  const employeeIsActive = !employee || employee.status === 'active';
  const navItems = onboarded ? ALL_NAV : ONBOARDING_NAV;

  useEffect(() => {
    if (isLoading) return;
    // Suspended or inactive employees are blocked from the crew portal.
    if (employee && !employeeIsActive) {
      router.replace('/account/wrong-portal?from=crew&reason=suspended');
      return;
    }
    if (needsSetup || !onboarded) {
      const allowed = ONBOARDING_ALLOWED.some(
        (p) => pathname === p || pathname.startsWith(p + '/')
      );
      if (!allowed) router.replace('/crew/onboarding');
    }
  }, [isLoading, employeeIsActive, needsSetup, onboarded, pathname, router, employee]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  if (isLoading || employeeError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background:
            'radial-gradient(1200px 600px at 20% -10%, #dff3ea 0%, transparent 60%), #f6f8f7',
        }}
      >
        {employeeError ? (
          <div className="text-center px-4">
            <p className="text-sm font-medium mb-1" style={{ color: brand.text }}>
              Could not load your crew profile
            </p>
            <p className="text-xs mb-4" style={{ color: brand.muted }}>{employeeError}</p>
            <button
              onClick={refetch}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: brand.primary }}
            >
              Try again
            </button>
          </div>
        ) : (
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: brand.primary, borderTopColor: 'transparent' }}
          />
        )}
      </div>
    );
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(1200px 600px at 20% -10%, #dff3ea 0%, transparent 60%), radial-gradient(900px 500px at 120% 10%, #e8efe7 0%, transparent 50%), #f6f8f7',
      }}
    >
      {/* ── Top Navigation ── */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'rgba(0,0,0,0.06)',
        }}
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-4">

            {/* Brand */}
            <Link href="/crew" className="flex items-center gap-2.5 shrink-0">
              <div
                className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm"
                style={{ background: brand.primary }}
              >
                B
              </div>
              <div className="hidden sm:block leading-tight">
                <div className="font-bold text-sm tracking-tight" style={{ color: brand.primary }}>
                  Buds at Work
                </div>
                <div className="text-[10px]" style={{ color: brand.muted }}>Crew Hub</div>
              </div>
            </Link>

            {/* Divider */}
            <div className="hidden md:block h-5 w-px bg-black/10" />

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-0.5 flex-1">
              {navItems.map((item) => {
                const active = isActive(item.href, (item as {exact?: boolean}).exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-3 py-1.5 rounded-lg text-sm transition-all"
                    style={{
                      color: active ? brand.primary : brand.muted,
                      background: active ? 'rgba(15,61,46,0.08)' : 'transparent',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right */}
            <div className="ml-auto flex items-center gap-2">
              {!employeeIsActive && employee && (
                <span
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#991B1B' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {employee.status === 'suspended' ? 'Suspended' : 'Inactive'}
                </span>
              )}
              {employeeIsActive && !onboarded && (
                <span
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(251,191,36,0.15)', color: '#92400E' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Onboarding
                </span>
              )}

              <button
                onClick={handleSignOut}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-slate-100"
                style={{ color: brand.muted }}
              >
                Sign out
              </button>

              {/* Mobile hamburger */}
              <button
                className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Open menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {mobileOpen
                    ? <path d="M18 6L6 18M6 6l12 12" />
                    : <path d="M3 12h18M3 6h18M3 18h18" />}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Onboarding Progress Banner ── */}
      {!onboarded && (
        <div
          className="border-b"
          style={{
            background: 'rgba(251,191,36,0.08)',
            borderColor: 'rgba(251,191,36,0.25)',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
            <p className="text-xs font-medium flex-1" style={{ color: '#92400E' }}>
              Complete your onboarding to unlock jobs, schedule, and earnings.
            </p>
            <Link
              href="/crew/onboarding"
              className="text-xs font-semibold shrink-0 underline underline-offset-2"
              style={{ color: '#92400E' }}
            >
              Continue →
            </Link>
          </div>
        </div>
      )}

      {/* Mobile nav dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/20 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed top-14 left-0 right-0 z-30 border-b md:hidden"
              style={{
                background: 'rgba(255,255,255,0.97)',
                backdropFilter: 'blur(20px)',
                borderColor: 'rgba(0,0,0,0.06)',
              }}
            >
              <nav className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-0.5">
                {navItems.map((item) => {
                  const active = isActive(item.href, (item as {exact?: boolean}).exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        color: active ? brand.primary : brand.text,
                        background: active ? 'rgba(15,61,46,0.08)' : 'transparent',
                      }}
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
                <div className="border-t my-2" style={{ borderColor: 'rgba(0,0,0,0.08)' }} />
                <button
                  onClick={handleSignOut}
                  className="px-3 py-2.5 rounded-lg text-sm text-left"
                  style={{ color: brand.muted }}
                >
                  Sign out
                </button>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <DevRoleSwitcher />
    </div>
  );
}
