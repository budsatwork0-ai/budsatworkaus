'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  OverviewTab,
  ReceivablesTab,
  PayablesTab,
  JobsTab,
  ReportsTab,
  VisitorsTab,
} from './components/tabs';
import { tabs, type TabKey, type RecordDetail } from '@/types/dashboard';
import { formatRelativeTime } from '@/lib/dashboard/utils';

export default function DashboardHome() {
  const { metrics, receivables, payables, jobs, recentActivity, lastUpdated, isLoading, error, refetch } = useDashboardData();
  const formattedMetrics = useFormattedMetrics(metrics);

  const [activeTab, setActiveTab] = useState<TabKey>('schedule');
  const [selectedDetail, setSelectedDetail] = useState<RecordDetail | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  }, [refetch]);

  // Use a ref so the keyboard handler always calls the latest handleRefresh without
  // needing to re-attach the listener on every render.
  const handleRefreshRef = useRef(handleRefresh);
  useEffect(() => { handleRefreshRef.current = handleRefresh; }, [handleRefresh]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Escape closes detail drawer
      if (e.key === 'Escape') {
        setSelectedDetail(null);
        return;
      }

      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        // Tab shortcuts (1-5)
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex >= 0 && tabIndex < tabs.length) {
          setActiveTab(tabs[tabIndex].key);
        }

        // R to refresh
        if (e.key === 'r' || e.key === 'R') {
          handleRefreshRef.current();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Summary cards with navigation
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

  const handleRowClick = (detail: RecordDetail) => {
    setSelectedDetail(detail);
  };

  if (error) {
    return (
      <div className="grid gap-6 sm:gap-10 w-full px-3 sm:px-4 md:px-10 lg:px-12 pb-14">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold" style={{ color: brand.primary }}>
            Dashboard
          </h1>
        </div>
        <ErrorMessage message={error} onRetry={refetch} />
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'schedule':
        return <ScheduleTab />;
      case 'overview':
        return <OverviewTab metrics={metrics} recentActivity={recentActivity} isLoading={isLoading} />;
      case 'receivables':
        return <ReceivablesTab receivables={receivables} isLoading={isLoading} onRowClick={handleRowClick} />;
      case 'payables':
        return <PayablesTab payables={payables} isLoading={isLoading} onRowClick={handleRowClick} />;
      case 'jobs':
        return <JobsTab jobs={jobs} isLoading={isLoading} onRowClick={handleRowClick} />;
      case 'reports':
        return <ReportsTab metrics={metrics} receivables={receivables} payables={payables} />;
      case 'visitors':
        return <VisitorsTab />;
      default:
        return null;
    }
  };

  return (
    <div className="grid gap-6 sm:gap-8 w-full px-3 sm:px-4 md:px-10 lg:px-12 pb-14 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold" style={{ color: brand.primary }}>
              Dashboard
            </h1>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all ${isRefreshing ? 'animate-spin' : ''}`}
              title="Refresh (R)"
            >
              <RefreshIcon />
            </button>
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
          {/* Search Bar */}
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
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Summary Cards */}
      {isLoading ? (
        <SummaryCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-4 gap-3">
          {summaryCards.map((card) => (
            <SummaryCard key={card.label} {...card} isLoading={isLoading} />
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="rounded-2xl border border-black/5 bg-white/90 p-1 text-xs text-slate-600 shadow-sm overflow-hidden">
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-2 sm:px-4 py-2 text-center font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 truncate transition-colors ${
                activeTab === tab.key
                  ? 'text-white'
                  : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
              style={activeTab === tab.key ? { background: brand.primary } : undefined}
              title={`Press ${tab.shortcut} for ${tab.label}`}
            >
              {tab.label}
              <span className="hidden lg:inline text-[10px] opacity-60 ml-1">({tab.shortcut})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      {/* Detail Drawer */}
      <DetailDrawer
        detail={selectedDetail}
        onClose={() => setSelectedDetail(null)}
        operationsSnapshot={metrics?.operationsSnapshot ?? { jobsCompleted: 0, averageJobValue: 0, labourPercent: 0, grossMargin: 0 }}
      />

      {/* Keyboard Shortcuts Hint */}
      <div className="fixed bottom-4 right-4 hidden lg:flex items-center gap-2 text-[10px] text-slate-400 bg-white/80 backdrop-blur rounded-lg px-3 py-1.5 border border-slate-200">
        <span>⌘K search</span>
        <span>•</span>
        <span>1-7 tabs</span>
        <span>•</span>
        <span>R refresh</span>
        <span>•</span>
        <span>Esc close</span>
      </div>
    </div>
  );
}
