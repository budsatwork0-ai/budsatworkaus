'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';
import { brand } from '@/app/ui/theme';
import {
  useDashboardData,
  useFormattedMetrics,
} from './hooks/useDashboardData';
import QuickActions from './components/QuickActions';
import SearchBar from './components/SearchBar';
import { SummaryCardsSkeleton } from './components/Skeletons';
import {
  SummaryCard,
  RefreshIcon,
  ErrorMessage,
  DetailDrawer,
} from './components/shared';
import {
  ScheduleTab,
  DispatchTab,
  OverviewTab,
  ReceivablesTab,
  PayablesTab,
  JobsTab,
  ReportsTab,
  VisitorsTab,
} from './components/tabs';
import { tabs, type TabKey, type RecordDetail } from '@/types/dashboard';
import { formatRelativeTime } from '@/lib/dashboard/utils';

// --- Animated count-up for metric values ---
function AnimatedValue({ value, prefix = '', suffix = '' }: { value: string; prefix?: string; suffix?: string }) {
  // Extract a numeric value from formatted string like "$1,234" or "3"
  const numMatch = value.replace(/,/g, '').match(/[\d.]+/);
  const num = numMatch ? parseFloat(numMatch[0]) : null;
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { damping: 35, stiffness: 100 });
  const [display, setDisplay] = useState(value);
  const prevValue = useRef<string | null>(null);

  useEffect(() => {
    if (num === null || prevValue.current === value) return;
    prevValue.current = value;
    // Animate from 0 to target
    motionVal.set(0);
    setTimeout(() => motionVal.set(num), 30);
  }, [value, num, motionVal]);

  useEffect(() => {
    if (num === null) { setDisplay(value); return; }
    const unsub = spring.on('change', (v) => {
      // Reconstruct the formatted string
      const rounded = Math.round(v * 100) / 100;
      const formatted = value.includes('$')
        ? '$' + rounded.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
        : rounded.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      setDisplay(prefix + formatted + suffix);
    });
    return unsub;
  }, [spring, value, num, prefix, suffix]);

  return <span>{display}</span>;
}

// --- Smart greeting based on time of day ---
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardHome() {
  const { metrics, receivables, payables, jobs, recentActivity, lastUpdated, isLoading, error, refetch } = useDashboardData();
  const formattedMetrics = useFormattedMetrics(metrics);

  const [activeTab, setActiveTab] = useState<TabKey>('schedule');
  const [selectedDetail, setSelectedDetail] = useState<RecordDetail | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [greeting] = useState(getGreeting);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  const handleRefreshRef = useRef(handleRefresh);
  useEffect(() => { handleRefreshRef.current = handleRefresh; }, [handleRefresh]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.key === 'Escape') { setSelectedDetail(null); return; }
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex >= 0 && tabIndex < tabs.length) setActiveTab(tabs[tabIndex].key);
        if (e.key === 'r' || e.key === 'R') handleRefreshRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const summaryCards = useMemo(() => [
    {
      label: 'Cash / bank balance',
      value: formattedMetrics.cashBalance,
      hint: 'As of today',
      change: null,
      viewLabel: 'account',
      onClick: () => {},
    },
    {
      label: 'Outstanding receivables',
      value: formattedMetrics.outstandingReceivables,
      hint: formattedMetrics.outstandingReceivablesHint,
      change: formattedMetrics.outstandingReceivablesChange,
      viewLabel: 'receivables',
      onClick: () => setActiveTab('receivables'),
    },
    {
      label: 'Upcoming payables (30d)',
      value: formattedMetrics.upcomingPayables,
      hint: formattedMetrics.upcomingPayablesHint,
      change: formattedMetrics.upcomingPayablesChange,
      viewLabel: 'payables',
      onClick: () => setActiveTab('payables'),
    },
    {
      label: 'Net profit (MTD)',
      value: formattedMetrics.netProfit,
      hint: formattedMetrics.netProfitHint,
      change: formattedMetrics.netProfitChange,
      viewLabel: 'reports',
      onClick: () => setActiveTab('reports'),
    },
  ], [formattedMetrics]);

  const handleRowClick = (detail: RecordDetail) => setSelectedDetail(detail);

  if (error) {
    return (
      <div className="grid gap-6 sm:gap-10 w-full px-3 sm:px-4 md:px-10 lg:px-12 pb-14">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold" style={{ color: brand.primary }}>Dashboard</h1>
        </div>
        <ErrorMessage message={error} onRetry={refetch} />
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'schedule':    return <ScheduleTab />;
      case 'dispatch':   return <DispatchTab />;
      case 'overview':   return <OverviewTab metrics={metrics} recentActivity={recentActivity} isLoading={isLoading} />;
      case 'receivables': return <ReceivablesTab receivables={receivables} isLoading={isLoading} onRowClick={handleRowClick} />;
      case 'payables':   return <PayablesTab payables={payables} isLoading={isLoading} onRowClick={handleRowClick} />;
      case 'jobs':       return <JobsTab jobs={jobs} isLoading={isLoading} onRowClick={handleRowClick} />;
      case 'reports':    return <ReportsTab metrics={metrics} receivables={receivables} payables={payables} />;
      case 'visitors':   return <VisitorsTab />;
      default:           return null;
    }
  };

  return (
    <div className="grid gap-6 sm:gap-8 w-full px-3 sm:px-4 md:px-10 lg:px-12 pb-14 overflow-x-hidden">

      {/* Header with greeting */}
      <motion.div
        className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs text-slate-500 font-medium">{greeting}</p>
              <h1 className="text-xl font-semibold" style={{ color: brand.primary }}>
                Dashboard
              </h1>
            </div>
            <motion.button
              onClick={handleRefresh}
              disabled={isRefreshing}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={isRefreshing ? { repeat: Infinity, duration: 0.7, ease: 'linear' } : { duration: 0.2 }}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
              title="Refresh (R)"
            >
              <RefreshIcon />
            </motion.button>
          </div>
          <p className="text-sm text-slate-500">
            Financial command centre for Buds At Work
          </p>
          {lastUpdated && (
            <p className="text-xs text-slate-400">
              Last updated: {formatRelativeTime(lastUpdated)}
            </p>
          )}
        </div>

        <div className="flex flex-col items-start gap-3 md:items-end">
          <SearchBar
            receivables={receivables}
            payables={payables}
            jobs={jobs}
            onResultClick={(result) => {
              if (result.type === 'invoice') setActiveTab('receivables');
              else if (result.type === 'bill') setActiveTab('payables');
              else if (result.type === 'job') setActiveTab('jobs');
            }}
          />
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.4 }}
      >
        <QuickActions />
      </motion.div>

      {/* Summary Cards — with staggered entrance */}
      {isLoading ? (
        <SummaryCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-4 gap-3">
          {summaryCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <SummaryCard {...card} isLoading={isLoading} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Tabs — with active pill indicator */}
      <motion.div
        className="rounded-2xl border border-black/5 bg-white/90 p-1 text-xs text-slate-600 shadow-sm overflow-hidden"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.35 }}
      >
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative rounded-xl px-2 sm:px-4 py-2 text-center font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 truncate transition-colors ${
                activeTab === tab.key
                  ? 'text-white'
                  : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              style={activeTab === tab.key ? { background: brand.primary } : undefined}
              title={`Press ${tab.shortcut} for ${tab.label}`}
            >
              {activeTab === tab.key && (
                <motion.span
                  layoutId="active-tab-bg"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: brand.primary }}
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                />
              )}
              <span className="relative z-10">
                {tab.label}
                <span className="hidden lg:inline text-[10px] opacity-60 ml-1">({tab.shortcut})</span>
              </span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Tab Content — animated transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {renderTabContent()}
        </motion.div>
      </AnimatePresence>

      {/* Detail Drawer */}
      <DetailDrawer
        detail={selectedDetail}
        onClose={() => setSelectedDetail(null)}
        operationsSnapshot={metrics?.operationsSnapshot ?? { jobsCompleted: 0, averageJobValue: 0, labourPercent: 0, grossMargin: 0 }}
      />

      {/* Keyboard Shortcuts Hint */}
      <motion.div
        className="fixed bottom-4 right-4 hidden lg:flex items-center gap-2 text-[10px] text-slate-400 bg-white/80 backdrop-blur rounded-lg px-3 py-1.5 border border-slate-200"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <span>⌘K search</span>
        <span>•</span>
        <span>1-8 tabs</span>
        <span>•</span>
        <span>R refresh</span>
        <span>•</span>
        <span>Esc close</span>
      </motion.div>
    </div>
  );
}
