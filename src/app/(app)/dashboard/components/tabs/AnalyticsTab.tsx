'use client';

/**
 * AnalyticsTab
 * ------------
 * Consolidates Reports + Visitors into one "Analytics" tab:
 *   - Financial Reports  → CSV exports + monthly summary
 *   - Live Visitors      → real-time site visitor tracking
 *
 * The Visitors tab is rarely needed mid-workflow, so it lives here as a
 * second-level view rather than occupying a top-level tab slot.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import ReportsTab from './ReportsTab';
const VisitorsTab = dynamic(() => import('./VisitorsTab'), { ssr: false });
import type { DashboardMetrics, ReceivableRecord, PayableRecord } from '@/types/dashboard';

type AnalyticsView = 'reports' | 'visitors';

type AnalyticsTabProps = {
  metrics: DashboardMetrics | null;
  receivables: ReceivableRecord[];
  payables: PayableRecord[];
};

const SUB_TABS: { key: AnalyticsView; label: string; icon: string }[] = [
  { key: 'reports',  label: 'Financial Reports', icon: '📊' },
  { key: 'visitors', label: 'Live Visitors',      icon: '👁' },
];

export default function AnalyticsTab({ metrics, receivables, payables }: AnalyticsTabProps) {
  const [view, setView] = useState<AnalyticsView>('reports');

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-1 w-fit">
        {SUB_TABS.map((tab) => (
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
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
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
          {view === 'reports' ? (
            <ReportsTab
              metrics={metrics}
              receivables={receivables}
              payables={payables}
            />
          ) : (
            <VisitorsTab />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
