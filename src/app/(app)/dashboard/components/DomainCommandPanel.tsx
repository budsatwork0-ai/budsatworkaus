'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { brand } from '@/app/ui/theme';
import { formatCurrency } from '@/lib/dashboard/utils';
import type { DashboardMetrics, JobRecord, ReceivableRecord } from '@/types/dashboard';

// ─── Icons ───────────────────────────────────────────────────────────────────

function Icon({ d, viewBox = '0 0 24 24', className = 'w-4 h-4' }: { d: string | string[]; viewBox?: string; className?: string }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const ICONS = {
  legal:      <Icon d={['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z']} />,
  finance:    <Icon d={['M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6']} />,
  operations: <Icon d={['M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z']} />,
  sales:      <Icon d={['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6']} />,
  hr:         <Icon d={['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', 'M23 21v-2a4 4 0 00-3-3.87', 'M16 3.13a4 4 0 010 7.75']} className="w-4 h-4" />,
  support:    <Icon d={['M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z']} />,
  engineering:<Icon d={['M16 18l6-6-6-6', 'M8 6l-6 6 6 6']} />,
  product:    <Icon d={['M12 2L2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5']} />,
  data:       <Icon d={['M18 20V10', 'M12 20V4', 'M6 20v-6']} />,
  design:     <Icon d={['M12 19l7-7 3 3-7 7-3-3z', 'M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z', 'M2 2l7.586 7.586', 'M11 11a2 2 0 102.83 2.83']} className="w-4 h-4" />,
  search:     <Icon d={['M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0']} />,
  productivity:<Icon d={['M9 11l3 3L22 4', 'M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11']} />,
};

// ─── Domain card type ────────────────────────────────────────────────────────

type DomainCard = {
  key: string;
  domain: string;
  icon: React.ReactNode;
  color: string;         // accent colour (bg tint + icon)
  primary: string;       // headline metric or status
  secondary: string;     // sub-label
  badge?: string;        // optional alert badge text
  badgeColor?: string;
  href?: string;
  // onTab uses legacy key strings — the parent maps these to the new TabKey groupings
  onTab?: string;
  onClick?: () => void;
};

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  metrics: DashboardMetrics | null;
  jobs: JobRecord[];
  receivables: ReceivableRecord[];
  onTabChange: (tab: string) => void;
  onSearchOpen: () => void;
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function DomainCommandPanel({ metrics, jobs, receivables, onTabChange, onSearchOpen }: Props) {
  const todayStr = new Date().toISOString().split('T')[0];

  const cards: DomainCard[] = useMemo(() => {
    const jobsToday       = jobs.filter(j => j.scheduledDate === todayStr && j.status !== 'cancelled').length;
    const scheduledJobs   = jobs.filter(j => j.status === 'scheduled').length;
    const openReceivables = receivables.filter(r => r.status !== 'Paid').length;
    const overdueCount    = metrics?.alerts.overdueCount ?? 0;
    const overdueAmount   = metrics?.alerts.overdueAmount ?? 0;
    const grossMargin     = metrics?.operationsSnapshot.grossMargin ?? 0;
    const jobsCompleted   = metrics?.operationsSnapshot.jobsCompleted ?? 0;
    const revenueGoalPct  = metrics
      ? Math.min(100, Math.round((metrics.goals.currentRevenue / metrics.goals.monthlyRevenueTarget) * 100))
      : 0;

    return [
      // ── Finance ──────────────────────────────────────────────────────────
      {
        key: 'finance',
        domain: 'Finance',
        icon: ICONS.finance,
        color: brand.primary,
        primary: formatCurrency(metrics?.cashBalance ?? 0),
        secondary: `${revenueGoalPct}% of monthly target · ${grossMargin}% margin`,
        badge: overdueAmount > 0 ? `${overdueCount} overdue` : undefined,
        badgeColor: '#ef4444',
        onTab: 'overview',
      },
      // ── Operations ───────────────────────────────────────────────────────
      {
        key: 'operations',
        domain: 'Operations',
        icon: ICONS.operations,
        color: '#6366f1',
        primary: `${jobsToday} today · ${scheduledJobs} queued`,
        secondary: `${jobsCompleted} jobs completed MTD`,
        badge: jobsToday > 0 ? `${jobsToday} active` : undefined,
        badgeColor: '#6366f1',
        onTab: 'dispatch',
      },
      // ── Sales Pipeline ───────────────────────────────────────────────────
      {
        key: 'sales',
        domain: 'Sales Pipeline',
        icon: ICONS.sales,
        color: '#f59e0b',
        primary: `${openReceivables} open invoices`,
        secondary: `${formatCurrency(metrics?.outstandingReceivables.total ?? 0)} receivable`,
        badge: openReceivables > 0 ? 'Chase →' : undefined,
        badgeColor: '#f59e0b',
        onTab: 'receivables',
      },
      // ── HR & Crew ────────────────────────────────────────────────────────
      {
        key: 'hr',
        domain: 'HR & Crew',
        icon: ICONS.hr,
        color: '#8b5cf6',
        primary: 'Crew management',
        secondary: 'Manage, onboard & induct crew',
        href: '/dashboard/crew',
      },
      // ── Customer Support ─────────────────────────────────────────────────
      {
        key: 'support',
        domain: 'Customer Support',
        icon: ICONS.support,
        color: '#0ea5e9',
        primary: overdueCount > 0
          ? `${overdueCount} overdue · ${formatCurrency(overdueAmount)}`
          : 'No overdue issues',
        secondary: `${metrics?.alerts.dueSoonCount ?? 0} due this week`,
        badge: overdueCount > 0 ? `${overdueCount} urgent` : undefined,
        badgeColor: '#ef4444',
        href: '/dashboard/orders',
      },
      // ── Data & Analytics ─────────────────────────────────────────────────
      {
        key: 'data',
        domain: 'Data & Analytics',
        icon: ICONS.data,
        color: '#14b8a6',
        primary: `${grossMargin}% gross margin`,
        secondary: `Avg job value ${formatCurrency(metrics?.operationsSnapshot.averageJobValue ?? 0)}`,
        onTab: 'reports',
      },
      // ── Engineering ──────────────────────────────────────────────────────
      {
        key: 'engineering',
        domain: 'Engineering',
        icon: ICONS.engineering,
        color: '#64748b',
        primary: 'System healthy',
        secondary: 'Audit log · Webhooks · Supabase',
        href: '/dashboard/audit-log',
      },
      // ── Product Management ───────────────────────────────────────────────
      {
        key: 'product',
        domain: 'Product Mgmt',
        icon: ICONS.product,
        color: '#f43f5e',
        primary: 'Roadmap & workflows',
        secondary: 'Manage pipelines & automations',
        href: '/dashboard/pipelines',
      },
      // ── Legal & Compliance ───────────────────────────────────────────────
      {
        key: 'legal',
        domain: 'Legal',
        icon: ICONS.legal,
        color: '#22c55e',
        primary: 'Compliance active',
        secondary: 'ABN · Privacy · ACL · T&Cs',
        href: '/dashboard/settings',
      },
      // ── Design System ────────────────────────────────────────────────────
      {
        key: 'design',
        domain: 'Design System',
        icon: ICONS.design,
        color: '#ec4899',
        primary: 'Brand system live',
        secondary: 'Components · Tokens · Accessibility',
        href: '/dashboard/settings',
      },
      // ── Enterprise Search ────────────────────────────────────────────────
      {
        key: 'search',
        domain: 'Enterprise Search',
        icon: ICONS.search,
        color: '#334155',
        primary: '⌘K — search everything',
        secondary: 'Customers · Invoices · Jobs · Quotes',
        onClick: onSearchOpen,
      },
      // ── Productivity & Automation ────────────────────────────────────────
      {
        key: 'productivity',
        domain: 'Productivity',
        icon: ICONS.productivity,
        color: '#f97316',
        primary: 'Automations dashboard',
        secondary: 'Recipes · Triggers · Workflows',
        href: '/dashboard/automations',
      },
    ];
  }, [metrics, jobs, receivables, todayStr, onSearchOpen]);

  const handleCardClick = (card: DomainCard) => {
    if (card.onClick) { card.onClick(); return; }
    if (card.onTab)   { onTabChange(card.onTab); return; }
    if (card.href)    { window.location.href = card.href; }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
      {cards.map((card, i) => (
        <motion.button
          key={card.key}
          type="button"
          onClick={() => handleCardClick(card)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 + i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}
          whileTap={{ scale: 0.97 }}
          className="relative text-left rounded-2xl border border-black/[0.06] bg-white/90 p-3.5 shadow-sm transition-all cursor-pointer group overflow-hidden"
        >
          {/* Subtle colour wash behind icon */}
          <div
            className="absolute inset-0 opacity-[0.04] rounded-2xl"
            style={{ background: card.color }}
          />

          {/* Icon + optional badge row */}
          <div className="relative flex items-start justify-between mb-2.5">
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ background: card.color + '18', color: card.color }}
            >
              {card.icon}
            </span>
            {card.badge && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white leading-none"
                style={{ background: card.badgeColor ?? card.color }}
              >
                {card.badge}
              </span>
            )}
          </div>

          {/* Domain label */}
          <p className="relative text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5 truncate">
            {card.domain}
          </p>

          {/* Primary metric */}
          <p className="relative text-[13px] font-semibold leading-snug truncate" style={{ color: '#0f172a' }}>
            {card.primary}
          </p>

          {/* Secondary label */}
          <p className="relative text-[11px] text-slate-400 mt-0.5 leading-snug line-clamp-2">
            {card.secondary}
          </p>

          {/* Hover arrow indicator */}
          <span className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </motion.button>
      ))}
    </div>
  );
}
