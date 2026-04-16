'use client';

/**
 * MoneyTab
 * --------
 * Consolidates the three financial views into one tab with sub-navigation:
 *   - Financial Overview  → charts + KPIs + goals (was OverviewTab)
 *   - Receivables         → invoice table with filters
 *   - Payables            → bills table with filters
 *
 * Surfaces live counts in the sub-nav labels so the admin always knows
 * how many outstanding items exist without switching views.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import OverviewTab from './OverviewTab';
import ReceivablesTab from './ReceivablesTab';
import PayablesTab from './PayablesTab';
import SettlementsTab from './SettlementsTab';
import type {
  DashboardMetrics,
  ReceivableRecord,
  PayableRecord,
  PayoutRecord,
  ActivityItem,
  RecordDetail,
} from '@/types/dashboard';

type MoneyView = 'overview' | 'receivables' | 'payables' | 'settlements';

type MoneyTabProps = {
  metrics: DashboardMetrics | null;
  receivables: ReceivableRecord[];
  payables: PayableRecord[];
  payouts: PayoutRecord[];
  recentActivity: ActivityItem[];
  isLoading: boolean;
  onRowClick: (detail: RecordDetail) => void;
  initialView?: MoneyView;
};

export default function MoneyTab({
  metrics,
  receivables,
  payables,
  payouts,
  recentActivity,
  isLoading,
  onRowClick,
  initialView = 'overview',
}: MoneyTabProps) {
  const [view, setView] = useState<MoneyView>(initialView);

  // Live counts for receivables and payables
  const overdueCount    = receivables.filter((r) => r.status === 'Overdue').length;
  const unpaidCount     = payables.filter((p) => p.status === 'Upcoming' || p.status === 'Overdue').length;
  const pendingPayouts  = payouts.filter((p) => p.status === 'pending').length;

  const subTabs: { key: MoneyView; label: string; badge?: number; badgeStyle?: string }[] = [
    {
      key: 'overview',
      label: 'Overview',
    },
    {
      key: 'receivables',
      label: 'Receivables',
      badge: receivables.length,
      badgeStyle: overdueCount > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600',
    },
    {
      key: 'payables',
      label: 'Payables',
      badge: payables.length,
      badgeStyle: unpaidCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600',
    },
    {
      key: 'settlements',
      label: 'NAB Settlements',
      badge: pendingPayouts > 0 ? pendingPayouts : undefined,
      badgeStyle: 'bg-amber-100 text-amber-700',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-1 w-fit">
        {subTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setView(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              view === tab.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && !isLoading && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${tab.badgeStyle}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {view === 'overview' && (
            <OverviewTab
              metrics={metrics}
              recentActivity={recentActivity}
              isLoading={isLoading}
            />
          )}
          {view === 'receivables' && (
            <ReceivablesTab
              receivables={receivables}
              isLoading={isLoading}
              onRowClick={onRowClick}
            />
          )}
          {view === 'payables' && (
            <PayablesTab
              payables={payables}
              isLoading={isLoading}
              onRowClick={onRowClick}
            />
          )}
          {view === 'settlements' && (
            <SettlementsTab
              payouts={payouts}
              isLoading={isLoading}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
