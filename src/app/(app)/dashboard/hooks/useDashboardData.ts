import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_DASHBOARD_GOALS } from '@/lib/automations';
import type {
  DashboardData,
  DashboardMetrics,
  DashboardAlert,
  DashboardCrewMember,
  PartnerReferralSnapshot,
  DashboardQuote,
  DashboardLead,
  MoneyFlowData,
  ReceivableRecord,
  PayableRecord,
  PayoutRecord,
  JobRecord,
  ActivityItem,
} from '@/types/dashboard';

type UseDashboardDataResult = {
  metrics: DashboardMetrics;
  moneyFlow: MoneyFlowData;
  receivables: ReceivableRecord[];
  payables: PayableRecord[];
  payouts: PayoutRecord[];
  jobs: JobRecord[];
  recentActivity: ActivityItem[];
  alertsFeed: DashboardAlert[];
  dismissedAlertCount: number;
  crew: DashboardCrewMember[];
  quotes: DashboardQuote[];
  channelLeads: DashboardLead[];
  partnerReferrals: PartnerReferralSnapshot[];
  applicantCount: number;
  lastUpdated: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  orderIdToQuoteId: Map<string, string>;
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

const defaultMoneyFlow: MoneyFlowData = {
  overview: {
    revenueThisMonth: 0,
    expensesThisMonth: 0,
    payrollOwed: 0,
    outstandingInvoices: 0,
    grossMargin: 0,
    labourCostPercent: 0,
    incomingReceived: 0,
    outgoingPaid: 0,
  },
  series: [],
  incoming: {
    expected: 0,
    received: 0,
    overdue: 0,
    depositsCollected: 0,
    quotesAccepted: 0,
    invoicesIssued: 0,
    invoicesPaid: 0,
    revenueByService: [],
    revenueByCustomer: [],
  },
  outgoing: {
    due: 0,
    paid: 0,
    payrollOwed: 0,
    supplierCosts: 0,
    subscriptionCosts: 0,
    reimbursementCosts: 0,
    settlementClearing: 0,
    expenseByCategory: [],
  },
  crewPay: {
    totalHours: 0,
    approvedHours: 0,
    pendingHours: 0,
    payrollOwed: 0,
    readyCount: 0,
    needsReviewCount: 0,
    missingAcceptanceCount: 0,
    workers: [],
  },
  alerts: [],
  transactions: [],
  jobMargins: [],
};

const CACHE_KEY = 'dashboard_cache';
const CACHE_KEY_FULL = 'dashboard_cache_full';
const CACHE_TTL_MS = 300_000; // 5 minutes

export function readCache(full = false): DashboardData | null {
  try {
    const key = full ? CACHE_KEY_FULL : CACHE_KEY;
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: DashboardData; fetchedAt: number };
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data: DashboardData, full = false) {
  try {
    const key = full ? CACHE_KEY_FULL : CACHE_KEY;
    sessionStorage.setItem(key, JSON.stringify({ data, fetchedAt: Date.now() }));
  } catch {
    // sessionStorage may be unavailable (private browsing, storage quota)
  }
}

export function useDashboardData(scope: 'summary' | 'full' = 'summary'): UseDashboardDataResult {
  const isFull = scope === 'full';
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [moneyFlow, setMoneyFlow] = useState<MoneyFlowData>(defaultMoneyFlow);
  const [receivables, setReceivables] = useState<ReceivableRecord[]>([]);
  const [payables, setPayables] = useState<PayableRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [alertsFeed, setAlertsFeed] = useState<DashboardAlert[]>([]);
  const [dismissedAlertCount, setDismissedAlertCount] = useState(0);
  const [crew, setCrew] = useState<DashboardCrewMember[]>([]);
  const [quotes, setQuotes] = useState<DashboardQuote[]>([]);
  const [channelLeads, setChannelLeads] = useState<DashboardLead[]>([]);
  const [partnerReferrals, setPartnerReferrals] = useState<PartnerReferralSnapshot[]>([]);
  const [applicantCount, setApplicantCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function applyData(data: DashboardData) {
    setMetrics(data.metrics);
    setMoneyFlow(data.moneyFlow || defaultMoneyFlow);
    setReceivables(data.receivables);
    setPayables(data.payables);
    setPayouts(data.payouts || []);
    setJobs(data.jobs || []);
    setRecentActivity(data.recentActivity || []);
    setAlertsFeed(data.alertsFeed || []);
    setDismissedAlertCount(data.dismissedAlertCount ?? 0);
    setCrew(data.crew || []);
    setQuotes(data.quotes || []);
    setChannelLeads((data.leads as DashboardLead[] | undefined) || []);
    setPartnerReferrals(data.partnerReferrals || []);
    setApplicantCount(data.applicantCount ?? 0);
    setLastUpdated(data.lastUpdated || null);
  }

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Serve from cache unless forcing refresh
    if (!forceRefresh) {
      const cached = readCache(isFull);
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
      const url = isFull ? '/api/dashboard' : '/api/dashboard?scope=summary';
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: DashboardData = await response.json();
      writeCache(data, isFull);
      applyData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(message);
      console.error('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isFull]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const orderIdToQuoteId = useMemo(
    () => new Map<string, string>(
      quotes
        .filter((q) => q.converted_order_id)
        .map((q) => [q.converted_order_id as string, q.id])
    ),
    [quotes]
  );

  return {
    metrics: metrics ?? defaultMetrics,
    moneyFlow,
    receivables,
    payables,
    payouts,
    jobs,
    recentActivity,
    alertsFeed,
    dismissedAlertCount,
    crew,
    quotes,
    channelLeads,
    partnerReferrals,
    applicantCount,
    lastUpdated,
    isLoading,
    error,
    refetch: () => fetchData(true),
    orderIdToQuoteId,
  };
}
