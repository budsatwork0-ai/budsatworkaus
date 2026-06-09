'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Toaster } from 'sonner';
import CommandPalette from '@/components/CommandPalette';
import CreateOrderModal from '@/components/CreateOrderModal';
import CreateSubscriptionModal from '@/components/CreateSubscriptionModal';
import { DevRoleSwitcher } from '@/components/DevRoleSwitcher';
import { useAuth } from '@/app/hooks/useAuth';
import { useSessionManager } from '@/app/hooks/useSessionManager';
import { SessionWarningModal } from '@/components/SessionWarningModal';
import { SoftLockModal } from '@/components/SoftLockModal';
import { DashboardShell } from './_components/DashboardShell';
import { MobileSidebarNav, SidebarNav, type NavBadgeKey, type NavGroup } from './_components/SidebarNav';
import { TopBar } from './_components/TopBar';
import { MessagingHub } from './_components/MessagingHub';
import { useMessagingHubListener } from './hooks/useMessagingHub';
import type { EntityContext } from '@/types/messaging';

const dashboardIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
const scheduleIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
const quotesIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
const moneyIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 000 7H14.5a3.5 3.5 0 010 7H6" /></svg>;
const customersIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>;
const crewIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>;
const growthHqIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
const storyEngineIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>;
const contentStudioIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>;
const researchLabIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11l-4 7h14l-4-7V3" /></svg>;
const contentVaultIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>;
const settingsIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>;
const ndisIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /><line x1="19" y1="11" x2="23" y2="11" /></svg>;
const missionIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="8" /><line x1="12" y1="16" x2="12" y2="22" /><line x1="2" y1="12" x2="8" y2="12" /><line x1="16" y1="12" x2="22" y2="12" /></svg>;
const executiveIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>;
const alertsIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>;
const leadsIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 002.5 2.5z" /></svg>;
const marketingIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 11-5.8-1.6" /></svg>;
const reportsIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
const quoteFunnelIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="3" y1="20" x2="21" y2="20"/></svg>;
const jobsIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></svg>;
const pipelinesIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="6" height="14" rx="1" /><rect x="15" y="3" width="6" height="9" rx="1" /></svg>;
const paymentsIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>;
const subscriptionsIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" /></svg>;
const expensesIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a2 2 0 000 4h4v-4z" /></svg>;
const applicantsIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>;
const feedbackIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>;
const automationsIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
const auditIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 106 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>;
const designIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></svg>;
const ndisMatchIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1" /><path d="M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" /></svg>;
const messagesIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;

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
  '/dashboard/mission-control': 'Bud OS',
  '/dashboard/executive': 'Executive HQ',
  '/dashboard/design': 'Design System',
  '/dashboard/growth-hq': 'Growth HQ',
  '/dashboard/story-engine': 'Story Engine',
  '/dashboard/content-studio': 'Content Studio',
  '/dashboard/content-studio/ideas': 'Content Ideas',
  '/dashboard/content-studio/scripts': 'Content Scripts',
  '/dashboard/content-studio/production': 'Production Board',
  '/dashboard/content-studio/assets': 'Asset Library',
  '/dashboard/research-lab': 'Research Lab',
  '/dashboard/marketing': 'Marketing Studio',
  '/dashboard/marketing/publishing': 'Publishing Queue',
  '/dashboard/marketing/campaigns': 'Campaign Manager',
  '/dashboard/marketing/playbooks':       'Distribution Playbooks',
  '/dashboard/marketing/social-channels': 'Social Channels',
  '/dashboard/leads': 'Bud Leads',
  '/dashboard/messages': 'Messages',
  '/dashboard/reports': 'Reports',
  '/dashboard/analytics/quote-funnel': 'Quote Funnel',
  '/dashboard/content-vault': 'Content Vault',
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
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [createSubscriptionOpen, setCreateSubscriptionOpen] = useState(false);
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [messagingEntity, setMessagingEntity] = useState<EntityContext | undefined>(undefined);

  const handleOpenMessaging = useCallback((entityContext?: EntityContext) => {
    setMessagingEntity(entityContext);
    setMessagingOpen(true);
  }, []);

  useMessagingHubListener(handleOpenMessaging);
  const [navBadges, setNavBadges] = useState<Record<NavBadgeKey, number>>({
    dashboard: 0,
    schedule: 0,
    quotes: 0,
    invoices: 0,
    applicants: 0,
  });

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = useCallback((id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const navGroups: NavGroup[] = useMemo(() => [
    { id: 'overview', label: 'Overview', items: [
      { href: '/dashboard',            label: 'Dashboard', icon: dashboardIcon, badgeKey: 'dashboard' },
      { href: '/dashboard/alerts',     label: 'Alerts',    icon: alertsIcon },
    ] },
    { id: 'growth', label: 'Growth & marketing', items: [
      { href: '/dashboard/growth-hq',       label: 'Growth HQ',        icon: growthHqIcon },
      { href: '/dashboard/story-engine',    label: 'Story Engine',     icon: storyEngineIcon },
      { href: '/dashboard/content-studio',  label: 'Content Studio',   icon: contentStudioIcon },
      { href: '/dashboard/research-lab',    label: 'Research Lab',     icon: researchLabIcon },
      { href: '/dashboard/marketing',       label: 'Marketing Studio', icon: marketingIcon },
      { href: '/dashboard/leads',           label: 'Bud Leads',        icon: leadsIcon },
      { href: '/dashboard/reports',                    label: 'Reports',      icon: reportsIcon },
      { href: '/dashboard/analytics/quote-funnel', label: 'Quote Funnel', icon: quoteFunnelIcon },
      { href: '/dashboard/content-vault',   label: 'Content Vault',    icon: contentVaultIcon },
    ] },
    { id: 'work', label: 'Work', items: [
      { href: '/dashboard/schedule',  label: 'Schedule',     icon: scheduleIcon,  badgeKey: 'schedule' },
      { href: '/dashboard/orders',    label: 'Jobs & orders', icon: jobsIcon },
      { href: '/dashboard/quotes',    label: 'Quotes',       icon: quotesIcon,    badgeKey: 'quotes' },
      { href: '/dashboard/pipelines', label: 'Pipelines',    icon: pipelinesIcon },
    ] },
    { id: 'money', label: 'Money', items: [
      { href: '/dashboard/invoices',      label: 'Invoices',      icon: moneyIcon,          badgeKey: 'invoices' },
      { href: '/dashboard/payments',      label: 'Payments',      icon: paymentsIcon },
      { href: '/dashboard/subscriptions', label: 'Subscriptions', icon: subscriptionsIcon },
      { href: '/dashboard/expenses',      label: 'Expenses',      icon: expensesIcon },
    ] },
    { id: 'people', label: 'People', items: [
      { href: '/dashboard/customers',  label: 'Customers',  icon: customersIcon },
      { href: '/dashboard/crew',       label: 'Crew',       icon: crewIcon },
      { href: '/dashboard/applicants', label: 'Applicants', icon: applicantsIcon, badgeKey: 'applicants' },
      { href: '/dashboard/messages',   label: 'Messages',   icon: messagesIcon },
      { href: '/dashboard/feedback',   label: 'Feedback',   icon: feedbackIcon },
    ] },
    { id: 'ndis', label: 'NDIS', adminOnly: true, items: [
      { href: '/dashboard/ndis',       label: 'Organisations', icon: ndisIcon },
      { href: '/dashboard/ndis/match', label: 'Plan matching', icon: ndisMatchIcon },
    ] },
    { id: 'automation', label: 'Automation', adminOnly: true, items: [
      { href: '/dashboard/mission-control', label: 'Bud OS',         icon: missionIcon },
      { href: '/dashboard/executive',       label: 'Executive HQ',   icon: executiveIcon },
      { href: '/dashboard/automations',     label: 'Automations',    icon: automationsIcon },
      { href: '/dashboard/design',          label: 'Design System',  icon: designIcon },
      { href: '/dashboard/audit-log',       label: 'Audit log',      icon: auditIcon },
    ] },
    { id: 'settings', label: 'Settings', adminOnly: true, items: [
      { href: '/dashboard/settings', label: 'Settings', icon: settingsIcon },
    ] },
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
    <>
      <Toaster position="top-right" />

      <DashboardShell
        pathname={pathname}
        sidebar={(
          <SidebarNav
            groups={navGroups}
            isAdmin={isAdmin}
            navBadges={navBadges}
            collapsed={collapsedGroups}
            sidebarOpen={sidebarOpen}
            userInitials={userInitials}
            userDisplayName={userDisplayName}
            roleLabel={roleLabel}
            onToggleGroup={toggleGroup}
            onToggleSidebar={() => setSidebarOpen((value) => !value)}
          />
        )}
        mobileSidebar={(
          <AnimatePresence>
            <MobileSidebarNav
              open={mobileMenuOpen}
              groups={navGroups}
              isAdmin={isAdmin}
              navBadges={navBadges}
              collapsed={collapsedGroups}
              userInitials={userInitials}
              userDisplayName={userDisplayName}
              roleLabel={roleLabel}
              onClose={() => setMobileMenuOpen(false)}
              onToggleGroup={toggleGroup}
            />
          </AnimatePresence>
        )}
        topBar={(
          <TopBar
            title={currentTitle}
            userInitials={userInitials}
            role={role}
            newDropdownOpen={newDropdownOpen}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onToggleNewDropdown={() => setNewDropdownOpen((value) => !value)}
            onCreateOrder={() => {
              setNewDropdownOpen(false);
              setCreateOrderOpen(true);
            }}
            onCreateSubscription={() => {
              setNewDropdownOpen(false);
              setCreateSubscriptionOpen(true);
            }}
            onOpenMessaging={() => handleOpenMessaging()}
            onSignOut={handleSignOut}
            onBadgesUpdate={handleBadgesUpdate}
          />
        )}
      >
        {children}
      </DashboardShell>

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

      <MessagingHub
        open={messagingOpen}
        onClose={() => {
          setMessagingOpen(false);
          setMessagingEntity(undefined);
        }}
        entityContext={messagingEntity}
      />

      <DevRoleSwitcher />

      {sessionState === 'warning' && (
        <SessionWarningModal onStaySignedIn={extendSession} />
      )}
      {sessionState === 'soft_locked' && (
        <SoftLockModal user={sessionUser} onUnlock={unlock} onSignOut={handleForceSignOut} />
      )}
    </>
  );
}
