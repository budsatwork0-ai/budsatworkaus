'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Toaster } from 'sonner';
import { brand } from '@/app/ui/theme';
import SideNavItem from './_components/SideNavItem';
import CommandPalette from '@/components/CommandPalette';
import CreateOrderModal from '@/components/CreateOrderModal';
import CreateSubscriptionModal from '@/components/CreateSubscriptionModal';
import { DevRoleSwitcher } from '@/components/DevRoleSwitcher';
import { useAuth } from '@/app/hooks/useAuth';
import { useSessionManager } from '@/app/hooks/useSessionManager';
import { SessionWarningModal } from '@/components/SessionWarningModal';
import { SoftLockModal } from '@/components/SoftLockModal';

type NotificationItem = {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  time: string;
  href?: string;
};

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

type NavEntry = NavLinkItem;

const dashboardIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
const scheduleIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const quotesIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
const moneyIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 000 7H14.5a3.5 3.5 0 010 7H6" /></svg>;
const customersIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>;
const crewIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>;
const insightsIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
const settingsIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>;

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/schedule': 'Schedule',
  '/dashboard/quotes': 'Quotes',
  '/dashboard/customers': 'Customers',
  '/dashboard/invoices': 'Money',
  '/dashboard/crew': 'Crew',
  '/dashboard/insights': 'Insights',
  '/dashboard/settings': 'Settings',
};


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const { role, isAdmin } = useAuth();
  const { sessionState, user: sessionUser, extendSession, unlock } = useSessionManager();
  const handleSignOut = async () => { const supabase = getSupabaseBrowserClient(); await supabase.auth.signOut(); window.location.href = '/'; };
  const handleForceSignOut = async () => { const supabase = getSupabaseBrowserClient(); await supabase.auth.signOut(); window.location.href = '/account'; };
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [createSubscriptionOpen, setCreateSubscriptionOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
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
    { kind: 'link', href: '/dashboard/insights',  label: 'Insights',  icon: insightsIcon                         },
    { kind: 'link', href: '/dashboard/settings',  label: 'Settings',  icon: settingsIcon,  adminOnly: true       },
  ], []);

  const shortcutLinks = useMemo(
    () => navEntries.map((entry) => ({
      href: entry.href,
      label: entry.label,
      icon: entry.icon,
      badge: entry.badgeKey ? navBadges[entry.badgeKey] : 0,
      adminOnly: entry.adminOnly,
    })),
    [navBadges, navEntries]
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setCommandPaletteOpen(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);


  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const [ordersRes, appRes, crewRes, quotesRes, dashboardRes] = await Promise.all([
        fetch('/api/orders?status=pending&limit=50').then((r) => r.json()).catch(() => ({ orders: [] })),
        fetch('/api/applicants?stage=intake&limit=50').then((r) => r.json()).catch(() => ({ applicants: [] })),
        fetch('/api/crew/employees').then((r) => r.json()).catch(() => ({ employees: [] })),
        fetch('/api/quotes?status=submitted,in_review&limit=100').then((r) => r.json()).catch(() => ({ quotes: [] })),
        fetch('/api/dashboard').then((r) => r.json()).catch(() => ({ receivables: [], jobs: [] })),
      ]);

      const pendingOrders = ordersRes.orders || [];
      const allIntake: { role: string }[] = appRes.applicants || [];
      const communityRoles = new Set(['Quality partner', 'Sponsor', 'Innovation partner']);
      const crewApplicants = allIntake.filter((applicant) => !communityRoles.has(applicant.role));
      const activeEmployees = (crewRes.employees || []).length;
      const pendingQuotes = quotesRes.quotes || [];
      const overdueInvoices = (dashboardRes.receivables || []).filter((record: { status: string }) => record.status === 'Overdue').length;
      const unscheduledJobs = (dashboardRes.jobs || []).filter((job: { scheduledDate?: string }) => !job.scheduledDate).length;

      const items: NotificationItem[] = [];

      if (overdueInvoices > 0) {
        items.push({
          id: 'overdue-invoices',
          type: 'warning',
          title: `${overdueInvoices} overdue invoice${overdueInvoices > 1 ? 's' : ''}`,
          message: 'Receivables need follow-up',
          time: 'Now',
          href: '/dashboard/invoices',
        });
      }

      if (unscheduledJobs > 0) {
        items.push({
          id: 'unscheduled-jobs',
          type: 'warning',
          title: `${unscheduledJobs} unscheduled job${unscheduledJobs > 1 ? 's' : ''}`,
          message: 'Jobs need calendar placement',
          time: 'Now',
          href: '/dashboard/schedule',
        });
      }

      if (pendingQuotes.length > 0) {
        items.push({
          id: 'pending-quotes',
          type: 'warning',
          title: `${pendingQuotes.length} pending quote${pendingQuotes.length > 1 ? 's' : ''}`,
          message: 'Quotes awaiting review',
          time: 'Now',
          href: '/dashboard/quotes',
        });
      }

      if (crewApplicants.length > 0) {
        items.push({
          id: 'new-applicants',
          type: 'info',
          title: `${crewApplicants.length} new applicant${crewApplicants.length > 1 ? 's' : ''}`,
          message: 'Review the applicant pipeline',
          time: 'Today',
          href: '/dashboard/applicants',
        });
      }

      if (pendingOrders.length > 0) {
        items.push({
          id: 'pending-orders',
          type: 'info',
          title: `${pendingOrders.length} pending job${pendingOrders.length > 1 ? 's' : ''}`,
          message: 'Orders awaiting confirmation',
          time: 'Today',
          href: '/dashboard/jobs',
        });
      }

      if (activeEmployees > 0) {
        items.push({
          id: 'active-crew',
          type: 'success',
          title: `${activeEmployees} crew member${activeEmployees > 1 ? 's' : ''} active`,
          message: 'Crew roster is available',
          time: 'Today',
          href: '/dashboard/crew',
        });
      }

      setNotifications(items);
      setNavBadges({
        dashboard: overdueInvoices + crewApplicants.length + pendingQuotes.length + unscheduledJobs,
        schedule: unscheduledJobs + pendingOrders.length,
        quotes: pendingQuotes.length,
        invoices: overdueInvoices,
        applicants: crewApplicants.length,
      });
    } catch {
      // Silently handle
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => n.type === 'warning').length;

  const renderExpandedNav = () => {
    return navEntries.map((entry) => {
      if (entry.adminOnly && !isAdmin) return null;
      return (
        <SideNavItem
          key={entry.href}
          href={entry.href}
          label={entry.label}
          icon={entry.icon}
          badge={entry.badgeKey ? navBadges[entry.badgeKey] : null}
        />
      );
    });
  };

  const renderCompactNav = () => {
    return shortcutLinks.map((item) => {
      if (item.adminOnly && !isAdmin) return null;
      return (
        <SideNavItem
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          badge={item.badge}
          showLabel={false}
        />
      );
    });
  };

  const NOTIF_ICONS: Record<string, { bg: string; color: string }> = {
    warning: { bg: '#FEF3C7', color: '#92400E' },
    info: { bg: '#DBEAFE', color: '#1E40AF' },
    success: { bg: '#ECFDF5', color: '#065F46' },
  };

  const currentTitle = PAGE_TITLES[pathname] || pathname.split('/').slice(-1)[0].replace(/^\w/, (c) => c.toUpperCase());

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
        animate={{ width: sidebarOpen ? 292 : 88 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col gap-3 p-4 sticky top-0 h-svh overflow-y-auto"
        style={{
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          background: 'rgba(255,255,255,.72)',
          borderRight: '1px solid rgba(0,0,0,.06)',
        }}
      >
        <div
          className="flex items-center gap-3 px-2 py-3 cursor-pointer"
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
          {sidebarOpen ? renderExpandedNav() : renderCompactNav()}
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

              <div className="space-y-2">{renderExpandedNav()}</div>

            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <header className="sticky top-3 z-30 px-3 sm:px-4 md:px-6">
          <div
            className="w-full rounded-2xl border border-black/5 bg-white/80 backdrop-blur px-3 sm:px-4 md:px-6 py-3 shadow-[0_8px_30px_rgba(2,6,23,0.06)] flex items-center gap-2 sm:gap-3"
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
                className="hidden md:flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-xs">Search...</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 rounded">⌘K</kbd>
              </button>

              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen((value) => !value)}
                  className="relative p-2 rounded-xl border border-black/10 bg-white hover:bg-slate-50 transition-colors text-slate-700"
                  aria-label="Notifications"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1" style={{ background: '#EF4444' }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {notificationsOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-80 rounded-2xl border border-black/10 bg-white shadow-xl overflow-hidden z-50"
                      >
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                          <p className="text-sm font-semibold" style={{ color: brand.text }}>Notifications</p>
                          <button onClick={fetchNotifications} className="text-xs text-slate-400 hover:text-slate-600">Refresh</button>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notifLoading ? (
                            <div className="p-4 space-y-3">
                              {[1, 2].map((n) => <div key={n} className="h-12 rounded bg-slate-100 animate-pulse" />)}
                            </div>
                          ) : notifications.length === 0 ? (
                            <div className="p-6 text-center">
                              <p className="text-sm text-slate-400">All clear. No notifications.</p>
                            </div>
                          ) : (
                            notifications.map((notification) => {
                              const style = NOTIF_ICONS[notification.type] || NOTIF_ICONS.info;
                              return (
                                <a
                                  key={notification.id}
                                  href={notification.href || '#'}
                                  onClick={() => setNotificationsOpen(false)}
                                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50"
                                >
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: style.bg }}>
                                    {notification.type === 'warning' ? (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={style.color} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                    ) : notification.type === 'success' ? (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={style.color} strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                                    ) : (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={style.color} strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium" style={{ color: brand.text }}>{notification.title}</p>
                                    <p className="text-xs text-slate-500">{notification.message}</p>
                                  </div>
                                  <span className="text-[10px] text-slate-400 shrink-0">{notification.time}</span>
                                </a>
                              );
                            })
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setNewDropdownOpen((value) => !value)}
                  className="px-3 py-2 text-sm rounded-xl text-white"
                  style={{ background: brand.primary }}
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
                    <div className="h-8 w-8 rounded-full border border-black/10" style={{ background: brand.primary }} />
                  </summary>
                  <motion.div
                    className="absolute right-0 mt-2 w-40 rounded-xl border border-black/10 bg-white shadow-lg overflow-hidden"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button className="block w-full text-left text-sm px-4 py-2 hover:bg-slate-50 text-slate-800">
                      My Profile
                    </button>
                    <button className="block w-full text-left text-sm px-4 py-2 hover:bg-slate-50 text-slate-800">
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
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

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
