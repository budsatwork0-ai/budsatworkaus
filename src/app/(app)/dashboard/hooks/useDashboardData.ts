import { useCallback, useEffect, useState } from 'react';
import { formatCurrency, formatChange } from '@/lib/dashboard/utils';
import { DEFAULT_DASHBOARD_GOALS } from '@/lib/automations';
import type {
  DashboardData,
  DashboardMetrics,
  DashboardCrewMember,
  DashboardQuote,
  ReceivableRecord,
  PayableRecord,
  PayoutRecord,
  JobRecord,
  ActivityItem,
} from '@/types/dashboard';

export type { DashboardMetrics, DashboardCrewMember, DashboardQuote, ReceivableRecord, PayableRecord, PayoutRecord, JobRecord, ActivityItem };

type UseDashboardDataResult = {
  metrics: DashboardMetrics | null;
  receivables: ReceivableRecord[];
  payables: PayableRecord[];
  payouts: PayoutRecord[];
  jobs: JobRecord[];
  recentActivity: ActivityItem[];
  crew: DashboardCrewMember[];
  quotes: DashboardQuote[];
  applicantCount: number;
  lastUpdated: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

// Default metrics for loading state
const defaultMetrics: DashboardMetrics = {
  cashBalance: 0,
  outstandingReceivables: { total: 0, count: 0, change: 0 },
  upcomingPayables: { total: 0, count: 0, change: 0 },
  netProfit: { amount: 0, margin: 0, change: 0 },
  revenueByService: [],
  expensesByCategory: [],
  alerts: {
    overdueCount: 0,
    overdueAmount: 0,
    dueSoonCount: 0,
    dueSoonAmount: 0,
  },
  operationsSnapshot: {
    jobsCompleted: 0,
    averageJobValue: 0,
    labourPercent: 0,
    grossMargin: 0,
  },
  revenueTrend: [],
  goals: {
    monthlyRevenueTarget: DEFAULT_DASHBOARD_GOALS.monthlyRevenueTarget,
    currentRevenue: 0,
    revenueChange: 0,
    monthlyJobsTarget: DEFAULT_DASHBOARD_GOALS.monthlyJobsTarget,
    currentJobs: 0,
  },
};

const CACHE_KEY = 'dashboard_cache';
const CACHE_TTL_MS = 60_000; // 60 seconds

function readCache(): DashboardData | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: DashboardData; fetchedAt: number };
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data: DashboardData) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }));
  } catch {
    // sessionStorage may be unavailable (private browsing, storage quota)
  }
}

export function useDashboardData(): UseDashboardDataResult {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [receivables, setReceivables] = useState<ReceivableRecord[]>([]);
  const [payables, setPayables] = useState<PayableRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [crew, setCrew] = useState<DashboardCrewMember[]>([]);
  const [quotes, setQuotes] = useState<DashboardQuote[]>([]);
  const [applicantCount, setApplicantCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function applyData(data: DashboardData) {
    setMetrics(data.metrics);
    setReceivables(data.receivables);
    setPayables(data.payables);
    setPayouts(data.payouts || []);
    setJobs(data.jobs || []);
    setRecentActivity(data.recentActivity || []);
    setCrew(data.crew || []);
    setQuotes(data.quotes || []);
    setApplicantCount(data.applicantCount ?? 0);
    setLastUpdated(data.lastUpdated || null);
  }

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Serve from cache unless forcing refresh
    if (!forceRefresh) {
      const cached = readCache();
      if (cached) {
        applyData(cached);
        setIsLoading(false);
        setError(null);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dashboard');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: DashboardData = await response.json();
      writeCache(data);
      applyData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(message);
      console.error('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    metrics: metrics ?? defaultMetrics,
    receivables,
    payables,
    payouts,
    jobs,
    recentActivity,
    crew,
    quotes,
    applicantCount,
    lastUpdated,
    isLoading,
    error,
    refetch: () => fetchData(true),
  };
}

// Helper hook for formatted display values
export function useFormattedMetrics(metrics: DashboardMetrics | null) {
  if (!metrics) {
    return {
      cashBalance: '$0',
      outstandingReceivables: '$0',
      outstandingReceivablesHint: '0 invoices due',
      outstandingReceivablesChange: null,
      upcomingPayables: '$0',
      upcomingPayablesHint: '0 bills scheduled',
      upcomingPayablesChange: null,
      netProfit: '$0',
      netProfitHint: '0% margin',
      netProfitChange: null,
    };
  }

  return {
    cashBalance: formatCurrency(metrics.cashBalance),
    outstandingReceivables: formatCurrency(metrics.outstandingReceivables.total),
    outstandingReceivablesHint: `${metrics.outstandingReceivables.count} invoices due`,
    outstandingReceivablesChange: formatChange(metrics.outstandingReceivables.change),
    upcomingPayables: formatCurrency(metrics.upcomingPayables.total),
    upcomingPayablesHint: `${metrics.upcomingPayables.count} bills scheduled`,
    upcomingPayablesChange: formatChange(metrics.upcomingPayables.change),
    netProfit: formatCurrency(metrics.netProfit.amount),
    netProfitHint: `${metrics.netProfit.margin}% margin`,
    netProfitChange: formatChange(metrics.netProfit.change),
  };
}
