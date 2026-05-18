'use client';

import React, { useCallback, useEffect, memo, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Toaster } from 'sonner';
import { brand } from '@/app/ui/theme';
import SideNavItem from './_components/SideNavItem';
import { NotificationCenter } from './_components/NotificationCenter';
import CommandPalette from '@/components/CommandPalette';
import CreateOrderModal from '@/components/CreateOrderModal';
import CreateSubscriptionModal from '@/components/CreateSubscriptionModal';
import { DevRoleSwitcher } from '@/components/DevRoleSwitcher';
import { useAuth } from '@/app/hooks/useAuth';
import { useSessionManager } from '@/app/hooks/useSessionManager';
import { SessionWarningModal } from '@/components/SessionWarningModal';
import { SoftLockModal } from '@/components/SoftLockModal';

type NavBadgeKey =
  | 'dashboard'
  | 'schedule'
  | 'quotes'
  | 'invoices'
  | 'applicants';

type NavLinkItem = {
  kind: 'link';
  href: string;
  label: string;
  icon: React.ReactNode;
  badgeKey?: NavBadgeKey;
  adminOnly?: boolean;
};

const BADGE_HREFS: Partial<Record<NavBadgeKey, string>> = {
  schedule: '/dashboard/schedule?view=list&scheduleState=unscheduled',
  quotes: '/dashboard/quotes?workspace=review',
  invoices: '/dashboard/invoices?tab=invoices&status=Overdue',
  applicants: '/dashboard/crew?tab=onboarding&filter=awaiting_approval',
};

type NavEntry = NavLinkItem;

const dashboardIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
const scheduleIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const quotesIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
const moneyIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 000 7H14.5a3.5 3.5 0 010 7H6" /></svg>;
const customersIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>;
const crewIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>;
const insightsIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
const settingsIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>;
const ndisIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /><line x1="19" y1="11" x2="23" y2="11" /></svg>;
const agentsIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3" /><path d="M5 21a7 7 0 0114 0" /><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /></svg>;
const lobbyIcon  = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /><circle cx="7" cy="15" r="1" /><circle cx="12" cy="15" r="1" /><circle cx="17" cy="15" r="1" /></svg>;
const missionIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="8" /><line x1="12" y1="16" x2="12" y2="22" /><line x1="2" y1="12" x2="8" y2="12" /><line x1="16" y1="12" x2="22" y2="12" /></svg>;

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/schedule': 'Schedule',
  '/dashboard/quotes': 'Quotes',
  '/dashboard/customers': 'Customers',
  '/dashboard/invoices': 'Money',
  '/dashboard/crew': 'Crew',
  '/dashboard/insights': 'Insights',
  '/dashboard/settings': 'Settings',
  '/dashboard/ndis': 'NDIS Organisations',
  '/dashboard/mission-control': 'Mission Control',
};


type NavListProps = {
  entries: NavEntry[];
  isAdmin: boolean;
  navBadges: Record<NavBadgeKey, number>;
};

const ExpandedNav = memo(function ExpandedNav({ entries, isAdmin, navBadges }: NavListProps) {
  return (
    <>
      {entries.map((entry) => {
        if (entry.adminOnly && !isAdmin) return null;
        const badge = entry.badgeKey ? navBadges[entry.badgeKey] : null;
        const badgeHref = entry.badgeKey ? BADGE_HREFS[entry.badgeKey] : undefined;
        return (
          <SideNavItem
            key={entry.href}
            href={entry.href}
            label={entry.label}
            icon={entry.icon}
            badge={badge}
            badgeHref={badgeHref}
          />
        );
      })}
    </>
  );
});

const CompactNav = memo(function CompactNav({ entries, isAdmin, navBadges }: NavListProps) {
  return (
    <>
      {entries.map((entry) => {
        if (entry.adminOnly && !isAdmin) return null;
        return (
          <SideNavItem
            key={entry.href}
            href={entry.href}
            label={entry.label}
            icon={entry.icon}
            badge={entry.badgeKey ? navBadges[entry.badgeKey] : null}
            showLabel={false}
          />
        );
      })}
    </>
  );
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const { role, isAdmin } = useAuth();
  const { sessionState, user: sessionUser, extendSession, unlock } = useSessionManager();
  const handleSignOut = async () => { const supabase = getSupabaseBrowserClient(); await supabase.auth.signOut(); window.location.href = '/'; };
  const handleForceSignOut = async () => { const supabase = getSupabaseBrowserClient(); await supabase.auth.signOut(); window.location.href = '/account'; };
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [createSubscriptionOpen, setCreateSubscriptionOpen] = useState(false);
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [navBadges, setNavBadges] = useState<Record<NavBadgeKey, number>>({
    dashboard: 0,
    schedule: 0,
    quotes: 0,
    invoices: 0,
    applicants: 0,
  });

  const navEntries: NavEntry[] = useMemo(() => [
    { kind: 'link', href: '/dashboard',           label: 'Dashboard', icon: dashboardIcon, badgeKey: 'dashboard' },
    { kind: 'link', href: '/dashboard/schedule',  label: 'Schedule',  icon: scheduleIcon,  badgeKey: 'schedule'  },
    { kind: 'link', href: '/dashboard/quotes',    label: 'Quotes',    icon: quotesIcon,    badgeKey: 'quotes'    },
    { kind: 'link', href: '/dashboard/customers', label: 'Customers', icon: customersIcon                        },
    { kind: 'link', href: '/dashboard/invoices',  label: 'Money',     icon: moneyIcon,     badgeKey: 'invoices'  },
    { kind: 'link', href: '/dashboard/crew',      label: 'Crew',      icon: crewIcon,      badgeKey: 'applicants'},
    { kind: 'link', href: '/dashboard/insights',  label: 'Insights',  icon: insightsIcon,                        },
    { kind: 'link', href: '/dashboard/mission-control', label: 'Mission Control', icon: missionIcon, adminOnly: true },
    { kind: 'link', href: '/dashboard/agents',    label: 'Agents',    icon: agentsIcon,    adminOnly: true       },
    { kind: 'link', href: '/dashboard/agents/lobby', label: 'Lobby',  icon: lobbyIcon,     adminOnly: true       },
    { kind: 'link', href: '/dashboard/agents/intel', label: 'Intel',  icon: agentsIcon,    adminOnly: true       },
    { kind: 'link', href: '/dashboard/ndis',      label: 'NDIS',      icon: ndisIcon,      adminOnly: true       },
    { kind: 'link', href: '/dashboard/settings',  label: 'Settings',  icon: settingsIcon,  adminOnly: true       },
  ], []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setCommandPaletteOpen(true);
    }
    if (e.key === '?' && !e.metaKey && !e.ctrlKey && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
      setShortcutsOpen((v) => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);


  const handleBadgesUpdate = useCallback((badges: Record<NavBadgeKey, number>) => {
    setNavBadges(badges);
  }, []);

  const currentTitle = PAGE_TITLES[pathname] || pathname.split('/').slice(-1)[0].replace(/^\w/, (c) => c.toUpperCase());
  const userDisplayName = sessionUser?.user_metadata?.full_name || sessionUser?.email?.split('@')[0] || 'Admin user';
  const userInitials = userDisplayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? '')
    .join('') || 'BW';
  const roleLabel = role === 'admin' ? 'Admin' : role === 'employee' ? 'Employee' : 'Customer';

  return (
    <div
      className="min-h-screen flex"
      style={{
        background:
          'radial-gradient(1200px 600px at 20% -10%, #dff3ea 0%, transparent 60%), radial-gradient(900px 500px at 120% 10%, #e8efe7 0%, transparent 50%), #f6f8f7',
      }}
    >
      <Toaster position="top-right" />

      <motion.aside
        animate={{ width: sidebarOpen ? 268 : 88 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col gap-3 p-4 sticky top-0 h-svh overflow-y-auto"
        style={{
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          background: 'rgba(255,255,255,.74)',
          borderRight: '1px solid rgba(215,231,221,.92)',
        }}
      >
        <div
          className="flex items-center gap-3 rounded-2xl px-2 py-3 cursor-pointer"
          onClick={() => setSidebarOpen((value) => !value)}
        >
          <motion.div
            layout
            className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-semibold"
            style={{ background: brand.primary }}
          >
            B
          </motion.div>
          {sidebarOpen && (
            <motion.div layout className="leading-tight">
              <div className="font-semibold" style={{ color: brand.primary }}>
                Buds At Work
              </div>
              <div className="text-[11px] text-slate-500">Operations Console</div>
            </motion.div>
          )}
        </div>

        <div className="space-y-2">
          {sidebarOpen
            ? <ExpandedNav entries={navEntries} isAdmin={isAdmin} navBadges={navBadges} />
            : <CompactNav entries={navEntries} isAdmin={isAdmin} navBadges={navBadges} />
          }
        </div>

        <div className="mt-auto rounded-2xl border border-black/5 bg-[rgba(234,246,238,0.92)] px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: brand.primary }}>
              {userInitials}
            </div>
            {sidebarOpen ? (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{userDisplayName}</div>
                <div className="text-[11px] text-slate-500">{roleLabel}</div>
              </div>
            ) : null}
          </div>
        </div>

      </motion.aside>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-[292px] z-50 md:hidden flex flex-col gap-3 p-4"
              style={{
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                background: 'rgba(255,255,255,.95)',
                borderRight: '1px solid rgba(0,0,0,.06)',
              }}
            >
              <div className="flex items-center justify-between px-2 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-semibold" style={{ background: brand.primary }}>
                    B
                  </div>
                  <div className="leading-tight">
                    <div className="font-semibold" style={{ color: brand.primary }}>
                      Buds At Work
                    </div>
                    <div className="text-[11px] text-slate-500">Operations Console</div>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-100"
                  aria-label="Close menu"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-2">
                <ExpandedNav entries={navEntries} isAdmin={isAdmin} navBadges={navBadges} />
              </div>

              <div className="mt-auto rounded-2xl border border-black/5 bg-[rgba(234,246,238,0.92)] px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: brand.primary }}>
                    {userInitials}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{userDisplayName}</div>
                    <div className="text-[11px] text-slate-500">{roleLabel}</div>
                  </div>
                </div>
              </div>

            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <header className="sticky top-3 z-30 px-3 sm:px-4 md:px-6">
          <div
            className="w-full rounded-[20px] border border-black/5 bg-white/82 backdrop-blur px-3 sm:px-4 md:px-5 py-3 shadow-[0_12px_30px_rgba(2,6,23,0.06)] flex items-center gap-2 sm:gap-3"
            role="banner"
          >
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-1 rounded-lg hover:bg-slate-100"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>

            <h1 className="text-sm sm:text-base md:text-lg font-semibold truncate" style={{ color: brand.primary }}>
              {currentTitle}
            </h1>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden md:flex items-center gap-2 rounded-xl border border-black/10 bg-[#f1f7f3] px-3 py-2 text-sm text-slate-500 hover:bg-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-xs">Search jobs, quotes, customers...</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded">⌘K</kbd>
              </button>
              <button
                onClick={() => setShortcutsOpen(true)}
                title="Keyboard shortcuts (?)"
                className="hidden md:flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-white text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                ?
              </button>

              <NotificationCenter onBadgesUpdate={handleBadgesUpdate} />

              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setNewDropdownOpen((value) => !value)}
                  className="px-3.5 py-2 text-sm rounded-xl text-white shadow-[0_8px_24px_rgba(16,185,129,0.22)]"
                  style={{ background: '#10b981' }}
                >
                  + New
                </motion.button>
                <AnimatePresence>
                  {newDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setNewDropdownOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-48 rounded-xl border border-black/10 bg-white shadow-lg overflow-hidden z-50"
                      >
                        <button
                          onClick={() => { setNewDropdownOpen(false); setCreateOrderOpen(true); }}
                          className="block w-full text-left text-sm px-4 py-2.5 hover:bg-slate-50 transition-colors"
                        >
                          <div className="font-medium text-slate-900">New Job</div>
                          <div className="text-xs text-slate-500">One-time service</div>
                        </button>
                        <button
                          onClick={() => { setNewDropdownOpen(false); setCreateSubscriptionOpen(true); }}
                          className="block w-full text-left text-sm px-4 py-2.5 hover:bg-slate-50 transition-colors border-t border-slate-100"
                        >
                          <div className="font-medium text-slate-900">New Subscription</div>
                          <div className="text-xs text-slate-500">Recurring service</div>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <motion.div whileHover={{ scale: 1.05 }}>
                <details className="group">
                  <summary className="list-none cursor-pointer">
                    <div className="h-8 w-8 rounded-full border border-black/10 flex items-center justify-center text-[10px] font-semibold text-white" style={{ background: brand.primary }}>
                      {userInitials}
                    </div>
                  </summary>
                  <motion.div
                    className="absolute right-0 mt-2 w-40 rounded-xl border border-black/10 bg-white shadow-lg overflow-hidden"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button
                      onClick={() => router.push('/dashboard/settings?group=account&panel=profile')}
                      className="block w-full text-left text-sm px-4 py-2 hover:bg-slate-50 text-slate-800"
                    >
                      My Profile
                    </button>
                    <button
                      onClick={() => router.push('/dashboard/settings?group=workspace&panel=general')}
                      className="block w-full text-left text-sm px-4 py-2 hover:bg-slate-50 text-slate-800"
                    >
                      Settings
                    </button>
                    <div className="border-t border-slate-100 px-4 py-1.5">
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">Role: {role}</span>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left text-sm px-4 py-2 text-red-500 hover:bg-red-50"
                    >
                      Sign out
                    </button>
                  </motion.div>
                </details>
              </motion.div>
            </div>
          </div>
        </header>

        <main className="w-full px-2 sm:px-4 md:px-6 py-4 sm:py-6 flex-1 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="w-full min-w-0 overflow-x-hidden"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {shortcutsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
              onClick={() => setShortcutsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.18 }}
              className="fixed left-1/2 top-1/2 z-50 w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-black/10 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">Keyboard shortcuts</p>
                <button onClick={() => setShortcutsOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-5 space-y-2">
                {([
                  { keys: ['⌘', 'K'], label: 'Open command palette' },
                  { keys: ['?'], label: 'Toggle this overlay' },
                ] as const).map(({ keys, label }) => (
                  <div key={label} className="flex items-center justify-between rounded-xl border border-black/5 bg-slate-50 px-4 py-2.5">
                    <span className="text-sm text-slate-700">{label}</span>
                    <div className="flex items-center gap-1">
                      {keys.map((k) => (
                        <kbd key={k} className="inline-flex items-center justify-center rounded-md border border-black/10 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onCreateOrder={() => {
          setCommandPaletteOpen(false);
          setCreateOrderOpen(true);
        }}
        onCreateSubscription={() => {
          setCommandPaletteOpen(false);
          setCreateSubscriptionOpen(true);
        }}
      />

      <CreateOrderModal
        isOpen={createOrderOpen}
        onClose={() => setCreateOrderOpen(false)}
      />
      <CreateSubscriptionModal
        isOpen={createSubscriptionOpen}
        onClose={() => setCreateSubscriptionOpen(false)}
      />

      <DevRoleSwitcher />

      {sessionState === 'warning' && (
        <SessionWarningModal onStaySignedIn={extendSession} />
      )}
      {sessionState === 'soft_locked' && (
        <SoftLockModal user={sessionUser} onUnlock={unlock} onSignOut={handleForceSignOut} />
      )}
    </div>
  );
}
