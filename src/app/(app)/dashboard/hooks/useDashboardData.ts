import { useCallback, useEffect, useState } from 'react';
import type {
  DashboardData,
  DashboardMetrics,
  ReceivableRecord,
  PayableRecord,
} from '@/app/api/dashboard/route';

export type { DashboardMetrics, ReceivableRecord, PayableRecord };

type UseDashboardDataResult = {
  metrics: DashboardMetrics | null;
  receivables: ReceivableRecord[];
  payables: PayableRecord[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

// Default metrics for loading state
const defaultMetrics: DashboardMetrics = {
  cashBalance: 0,
  outstandingReceivables: { total: 0, count: 0 },
  upcomingPayables: { total: 0, count: 0 },
  netProfit: { amount: 0, margin: 0 },
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
};

export function useDashboardData(): UseDashboardDataResult {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [receivables, setReceivables] = useState<ReceivableRecord[]>([]);
  const [payables, setPayables] = useState<PayableRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dashboard');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data: DashboardData = await response.json();

      setMetrics(data.metrics);
      setReceivables(data.receivables);
      setPayables(data.payables);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(message);
      console.error('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    metrics: metrics ?? defaultMetrics,
    receivables,
    payables,
    isLoading,
    error,
    refetch: fetchData,
  };
}

// Helper hook for formatted display values
export function useFormattedMetrics(metrics: DashboardMetrics | null) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(value);

  if (!metrics) {
    return {
      cashBalance: '$0',
      outstandingReceivables: '$0',
      outstandingReceivablesHint: '0 invoices due',
      upcomingPayables: '$0',
      upcomingPayablesHint: '0 bills scheduled',
      netProfit: '$0',
      netProfitHint: '0% margin',
    };
  }

  return {
    cashBalance: formatCurrency(metrics.cashBalance),
    outstandingReceivables: formatCurrency(metrics.outstandingReceivables.total),
    outstandingReceivablesHint: `${metrics.outstandingReceivables.count} invoices due`,
    upcomingPayables: formatCurrency(metrics.upcomingPayables.total),
    upcomingPayablesHint: `${metrics.upcomingPayables.count} bills scheduled`,
    netProfit: formatCurrency(metrics.netProfit.amount),
    netProfitHint: `${metrics.netProfit.margin}% margin`,
  };
}
