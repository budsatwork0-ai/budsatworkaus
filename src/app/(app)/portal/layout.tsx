'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/app/hooks/useAuth';
import { brand } from '@/app/ui/theme';
import { DevRoleSwitcher } from '@/components/DevRoleSwitcher';
import { Toaster } from 'sonner';

const NAV = [
  { href: '/portal', label: 'Home', exact: true },
  { href: '/portal/schedule', label: 'Schedule' },
  { href: '/portal/quotes', label: 'My Quotes' },
  { href: '/portal/orders', label: 'Orders' },
  { href: '/portal/subscriptions', label: 'Subscriptions' },
  { href: '/portal/payments', label: 'Payments' },
  { href: '/portal/property', label: 'Property' },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const firstName = (user?.user_metadata?.full_name as string)?.split(' ')[0] || 'Account';
  const initials = firstName.slice(0, 2).toUpperCase();

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
      <Toaster position="top-right" />

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
            <Link href="/portal" className="flex items-center gap-2.5 shrink-0">
              <div
                className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm"
                style={{ background: brand.primary }}
              >
                B
              </div>
              <span className="hidden sm:block font-bold text-sm tracking-tight" style={{ color: brand.primary }}>
                Buds At Work
              </span>
            </Link>

            {/* Divider */}
            <div className="hidden md:block h-5 w-px bg-black/10" />

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-0.5 flex-1">
              {NAV.map((item) => {
                const active = isActive(item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
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

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/services"
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-95"
                style={{ background: brand.primary }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Book Service
              </Link>

              <button
                onClick={handleSignOut}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-slate-100"
                style={{ color: brand.muted }}
              >
                Sign out
              </button>

              {/* Avatar */}
              <div
                className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm"
                style={{ background: brand.primary }}
              >
                {initials}
              </div>

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
                {NAV.map((item) => {
                  const active = isActive(item.href, item.exact);
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
                <Link
                  href="/services"
                  className="px-3 py-2.5 rounded-xl text-sm font-semibold text-white text-center"
                  style={{ background: brand.primary }}
                  onClick={() => setMobileOpen(false)}
                >
                  + Book Service
                </Link>
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
