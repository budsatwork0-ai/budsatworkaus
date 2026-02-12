'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';
import type {
  Subscription,
  SubscriptionStatus,
  SubscriptionFrequency,
  SubscriptionFilters,
} from '@/types/subscriptions';
import {
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_COLORS,
  SUBSCRIPTION_FREQUENCY_LABELS,
  calculateMonthlyRevenue,
} from '@/types/subscriptions';
import { SERVICE_TYPE_LABELS } from '@/types/orders';
import type { ServiceType } from '@/types/orders';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import LoadingSkeleton, { SummaryCardsSkeleton } from '@/components/LoadingSkeleton';
import CreateSubscriptionModal from '@/components/CreateSubscriptionModal';

type TabKey = 'all' | 'active' | 'paused' | 'cancelled';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'cancelled', label: 'Cancelled' },
];

const serviceTypeOptions: Array<ServiceType | 'all'> = [
  'all',
  'windows',
  'cleaning',
  'yard',
  'dump',
  'auto',
  'laundry_sneakers',
];

const frequencyOptions: Array<SubscriptionFrequency | 'all'> = [
  'all',
  'daily',
  '3x_weekly',
  'weekly',
  'fortnightly',
  'monthly',
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-AU', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const StatusChip = ({ status }: { status: SubscriptionStatus }) => {
  const colorClass = SUBSCRIPTION_STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-700';
  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${colorClass}`}>
      {SUBSCRIPTION_STATUS_LABELS[status]}
    </span>
  );
};

const SummaryCard = ({
  label,
  value,
  hint,
  isLoading,
}: {
  label: string;
  value: string;
  hint?: string;
  isLoading?: boolean;
}) => (
  <div className="rounded-2xl border border-black/5 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
    {isLoading ? (
      <div className="animate-pulse">
        <div className="h-3 bg-slate-200 rounded w-20 mb-2" />
        <div className="h-6 bg-slate-200 rounded w-12 mb-1" />
        <div className="h-3 bg-slate-200 rounded w-16" />
      </div>
    ) : (
      <>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
        {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
      </>
    )}
  </div>
);

export default function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<SubscriptionFilters>({
    status: 'all',
    service_type: 'all',
    frequency: 'all',
    search: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'default';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'default',
    onConfirm: () => {},
  });

  // Fetch subscriptions from API
  const fetchSubscriptions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters.service_type && filters.service_type !== 'all') params.set('service_type', filters.service_type);
      if (filters.frequency && filters.frequency !== 'all') params.set('frequency', filters.frequency);
      if (filters.search) params.set('search', filters.search);

      const res = await fetch(`/api/subscriptions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions || []);
      } else {
        setSubscriptions([]);
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
      setSubscriptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const filteredSubscriptions = useMemo(() => {
    const searchTerm = filters.search?.trim().toLowerCase() || '';
    return subscriptions.filter((sub) => {
      if (activeTab !== 'all' && sub.status !== activeTab) {
        return false;
      }
      if (searchTerm) {
        const haystack = `${sub.customer_name} ${sub.customer_email} ${sub.id}`.toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }
      return true;
    });
  }, [subscriptions, activeTab, filters.search]);

  // Summary calculations
  const summaryStats = useMemo(() => {
    const activeSubscriptions = subscriptions.filter((s) => s.status === 'active');
    const monthlyRecurring = activeSubscriptions.reduce((sum, s) => sum + calculateMonthlyRevenue(s), 0);

    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueThisWeek = activeSubscriptions.filter((s) => {
      if (!s.next_service_date) return false;
      const nextDate = new Date(s.next_service_date);
      return nextDate >= now && nextDate <= weekFromNow;
    }).length;

    return {
      total: subscriptions.length,
      active: activeSubscriptions.length,
      monthlyRecurring,
      dueThisWeek,
    };
  }, [subscriptions]);

  const updateSubscriptionStatus = useCallback(async (subscriptionId: string, newStatus: SubscriptionStatus) => {
    try {
      const res = await fetch(`/api/subscriptions/${subscriptionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          end_date: newStatus === 'cancelled' ? new Date().toISOString().split('T')[0] : undefined,
          next_service_date: newStatus === 'paused' || newStatus === 'cancelled' ? null : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update subscription');
      }

      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub.id === subscriptionId
            ? {
                ...sub,
                status: newStatus,
                updated_at: new Date().toISOString(),
                end_date: newStatus === 'cancelled' ? new Date().toISOString().split('T')[0] : sub.end_date,
                next_service_date: newStatus === 'paused' || newStatus === 'cancelled' ? null : sub.next_service_date,
              }
            : sub
        )
      );

      if (selectedSubscription?.id === subscriptionId) {
        setSelectedSubscription((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus,
                updated_at: new Date().toISOString(),
                end_date: newStatus === 'cancelled' ? new Date().toISOString().split('T')[0] : prev.end_date,
              }
            : null
        );
      }

      toast.success(`Subscription ${SUBSCRIPTION_STATUS_LABELS[newStatus].toLowerCase()}`);
    } catch (error) {
      console.error('Failed to update subscription:', error);
      toast.error('Failed to update subscription status');
    }
  }, [selectedSubscription]);

  const handleCancelSubscription = (subscriptionId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cancel Subscription',
      message: 'Are you sure you want to cancel this subscription? The customer will no longer receive recurring services.',
      variant: 'danger',
      onConfirm: () => {
        updateSubscriptionStatus(subscriptionId, 'cancelled');
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Bulk actions
  const handleBulkStatusUpdate = (newStatus: SubscriptionStatus) => {
    if (selectedIds.size === 0) {
      toast.error('No subscriptions selected');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: `Update ${selectedIds.size} Subscriptions`,
      message: `Are you sure you want to mark ${selectedIds.size} subscriptions as ${SUBSCRIPTION_STATUS_LABELS[newStatus].toLowerCase()}?`,
      variant: newStatus === 'cancelled' ? 'danger' : 'default',
      onConfirm: async () => {
        for (const id of selectedIds) {
          await updateSubscriptionStatus(id, newStatus);
        }
        setSelectedIds(new Set());
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        toast.success(`Updated ${selectedIds.size} subscriptions`);
      },
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSubscriptions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSubscriptions.map((s) => s.id)));
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Subscription ID', 'Customer', 'Email', 'Service', 'Frequency', 'Price/Cycle', 'Monthly Value', 'Status', 'Next Service'];
    const rows = filteredSubscriptions.map((sub) => [
      sub.id,
      sub.customer_name,
      sub.customer_email || '',
      SERVICE_TYPE_LABELS[sub.service_type],
      SUBSCRIPTION_FREQUENCY_LABELS[sub.frequency],
      sub.price_per_cycle.toString(),
      calculateMonthlyRevenue(sub).toString(),
      SUBSCRIPTION_STATUS_LABELS[sub.status],
      sub.next_service_date || '',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `subscriptions-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Subscriptions exported to CSV');
  };

  const renderDetailDrawer = () => {
    if (!selectedSubscription) return null;

    const monthlyRevenue = calculateMonthlyRevenue(selectedSubscription);
    const annualRevenue = monthlyRevenue * 12;

    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedSubscription(null)} aria-hidden />
        <div className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-black/5 bg-white/95 shadow-2xl">
          <div className="flex items-start justify-between px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Subscription Details</p>
              <h2 className="text-lg font-semibold text-slate-900">{selectedSubscription.id}</h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSubscription(null)}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm text-slate-500"
            >
              Close
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6 text-sm text-slate-700">
            <div className="flex items-center gap-3">
              <StatusChip status={selectedSubscription.status} />
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                {SUBSCRIPTION_FREQUENCY_LABELS[selectedSubscription.frequency]}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Customer</span>
                <span className="font-semibold text-slate-900">{selectedSubscription.customer_name}</span>
              </div>
              {selectedSubscription.customer_email && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Email</span>
                  <span className="text-slate-700">{selectedSubscription.customer_email}</span>
                </div>
              )}
              {selectedSubscription.customer_phone && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Phone</span>
                  <span className="text-slate-700">{selectedSubscription.customer_phone}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Service</span>
                <span className="font-semibold text-slate-900">
                  {SERVICE_TYPE_LABELS[selectedSubscription.service_type]}
                  {selectedSubscription.scope && ` - ${selectedSubscription.scope}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Context</span>
                <span className="text-slate-700 capitalize">{selectedSubscription.context}</span>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="rounded-xl border border-black/5 bg-slate-50/50 p-3 space-y-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Pricing</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Base Price</span>
                <span className="text-slate-700">{formatCurrency(selectedSubscription.base_price)}</span>
              </div>
              {selectedSubscription.discount_percent > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Frequency Discount</span>
                  <span className="text-green-600">{selectedSubscription.discount_percent}% off</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Price per Cycle</span>
                <span className="font-semibold text-slate-900">{formatCurrency(selectedSubscription.price_per_cycle)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Monthly Value</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(monthlyRevenue)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Annual Value</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(annualRevenue)}</span>
                </div>
              </div>
            </div>

            {/* Schedule Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Start Date</span>
                <span className="font-semibold text-slate-900">{formatDate(selectedSubscription.start_date)}</span>
              </div>
              {selectedSubscription.next_service_date && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Next Service</span>
                  <span className="font-semibold text-slate-900">{formatDate(selectedSubscription.next_service_date)}</span>
                </div>
              )}
              {selectedSubscription.last_service_date && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Last Service</span>
                  <span className="text-slate-700">{formatDate(selectedSubscription.last_service_date)}</span>
                </div>
              )}
              {selectedSubscription.end_date && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">End Date</span>
                  <span className="text-red-600">{formatDate(selectedSubscription.end_date)}</span>
                </div>
              )}
            </div>

            {selectedSubscription.notes && (
              <div className="space-y-1">
                <div className="text-xs text-slate-500">Notes</div>
                <p className="rounded-xl border border-black/5 bg-white/80 px-3 py-2 text-sm text-slate-700">
                  {selectedSubscription.notes}
                </p>
              </div>
            )}

            <div className="space-y-1 text-xs text-slate-500">
              <div>Created: {formatDate(selectedSubscription.created_at)}</div>
              <div>Updated: {formatDate(selectedSubscription.updated_at)}</div>
            </div>

            {/* Actions */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Actions</p>
              <div className="flex flex-wrap gap-2">
                {selectedSubscription.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => updateSubscriptionStatus(selectedSubscription.id, 'paused')}
                    className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-semibold text-yellow-700"
                  >
                    Pause Subscription
                  </button>
                )}
                {selectedSubscription.status === 'paused' && (
                  <button
                    type="button"
                    onClick={() => updateSubscriptionStatus(selectedSubscription.id, 'active')}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
                    style={{ background: brand.primary }}
                  >
                    Resume Subscription
                  </button>
                )}
                {selectedSubscription.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => handleCancelSubscription(selectedSubscription.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
                  >
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Mobile card view
  const renderMobileCard = (sub: Subscription) => (
    <div
      key={sub.id}
      className="rounded-xl border border-black/5 bg-white/90 p-4 shadow-sm md:hidden"
      onClick={() => setSelectedSubscription(sub)}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold text-slate-900">{sub.customer_name}</div>
          <div className="text-xs text-slate-500">{sub.id}</div>
        </div>
        <StatusChip status={sub.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>
          <span className="text-slate-400">Service: </span>
          {SERVICE_TYPE_LABELS[sub.service_type]}
        </div>
        <div>
          <span className="text-slate-400">Per Cycle: </span>
          {formatCurrency(sub.price_per_cycle)}
        </div>
        <div>
          <span className="text-slate-400">Frequency: </span>
          {SUBSCRIPTION_FREQUENCY_LABELS[sub.frequency]}
        </div>
        <div>
          <span className="text-slate-400">Next: </span>
          {formatDate(sub.next_service_date)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 w-full px-4 md:px-10 lg:px-12 pb-14">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold" style={{ color: brand.primary }}>
            Subscriptions
          </h1>
          <p className="text-sm text-slate-500">
            Manage recurring service subscriptions. Track weekly cleans, bin services, and other recurring arrangements.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3 py-2 text-xs rounded-lg text-white"
            style={{ background: brand.primary }}
          >
            + New Subscription
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <SummaryCardsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Total Subscriptions" value={String(summaryStats.total)} hint="All time" />
          <SummaryCard label="Active" value={String(summaryStats.active)} hint="Currently running" />
          <SummaryCard label="Monthly Recurring" value={formatCurrency(summaryStats.monthlyRecurring)} hint="From active subscriptions" />
          <SummaryCard label="Due This Week" value={String(summaryStats.dueThisWeek)} hint="Services scheduled" />
        </div>
      )}

      {/* Tabs */}
      <div className="rounded-2xl border border-black/5 bg-white/90 p-1 text-xs text-slate-600 shadow-sm">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-xl px-4 py-2 text-center font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                activeTab === tab.key
                  ? 'text-white'
                  : 'bg-transparent text-slate-600 hover:text-slate-900'
              }`}
              style={activeTab === tab.key ? { background: brand.primary } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters & Bulk Actions */}
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          Service Type
          <select
            value={filters.service_type || 'all'}
            onChange={(e) => setFilters((prev) => ({ ...prev, service_type: e.target.value as ServiceType | 'all' }))}
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1 text-xs text-slate-700"
          >
            {serviceTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All services' : SERVICE_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-500">
          Frequency
          <select
            value={filters.frequency || 'all'}
            onChange={(e) => setFilters((prev) => ({ ...prev, frequency: e.target.value as SubscriptionFrequency | 'all' }))}
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1 text-xs text-slate-700"
          >
            {frequencyOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All frequencies' : SUBSCRIPTION_FREQUENCY_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-[11px] text-slate-500">
          Search
          <input
            type="text"
            placeholder="Search customer or subscription ID"
            value={filters.search || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1 text-xs text-slate-700"
          />
        </label>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500">{selectedIds.size} selected</span>
            <button
              onClick={() => handleBulkStatusUpdate('paused')}
              className="px-2 py-1 text-xs rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
            >
              Pause
            </button>
            <button
              onClick={() => handleBulkStatusUpdate('cancelled')}
              className="px-2 py-1 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
            >
              Cancel
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2 py-1 text-xs rounded-lg border border-slate-200 text-slate-600"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Subscriptions Table */}
      {isLoading ? (
        <LoadingSkeleton rows={5} columns={8} />
      ) : filteredSubscriptions.length === 0 ? (
        <EmptyState
          title="No subscriptions found"
          description={subscriptions.length === 0
            ? "You haven't created any subscriptions yet. Create your first subscription to start managing recurring services."
            : "No subscriptions match your current filters. Try adjusting your search criteria."
          }
          action={subscriptions.length === 0 ? {
            label: 'Create First Subscription',
            onClick: () => setIsCreateModalOpen(true),
          } : undefined}
        />
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {filteredSubscriptions.map(renderMobileCard)}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-black/5 bg-white/90">
            <div className="overflow-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-white/95 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="border-b border-slate-100 px-3 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredSubscriptions.length && filteredSubscriptions.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="border-b border-slate-100 px-3 py-2">Subscription ID</th>
                    <th className="border-b border-slate-100 px-3 py-2">Customer</th>
                    <th className="border-b border-slate-100 px-3 py-2">Service</th>
                    <th className="border-b border-slate-100 px-3 py-2">Frequency</th>
                    <th className="border-b border-slate-100 px-3 py-2">Next Service</th>
                    <th className="border-b border-slate-100 px-3 py-2 text-right">Per Cycle</th>
                    <th className="border-b border-slate-100 px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscriptions.map((sub) => (
                    <tr
                      key={sub.id}
                      className={`cursor-pointer border-b border-slate-100 text-sm transition-colors hover:bg-slate-50 ${
                        selectedIds.has(sub.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(sub.id)}
                          onChange={() => toggleSelection(sub.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900" onClick={() => setSelectedSubscription(sub)}>
                        {sub.id}
                      </td>
                      <td className="px-3 py-2" onClick={() => setSelectedSubscription(sub)}>
                        <div className="font-medium">{sub.customer_name}</div>
                        {sub.customer_email && (
                          <div className="text-[11px] text-slate-500">{sub.customer_email}</div>
                        )}
                      </td>
                      <td className="px-3 py-2" onClick={() => setSelectedSubscription(sub)}>
                        <div>{SERVICE_TYPE_LABELS[sub.service_type]}</div>
                        <div className="text-[11px] text-slate-500 capitalize">{sub.context}</div>
                      </td>
                      <td className="px-3 py-2" onClick={() => setSelectedSubscription(sub)}>
                        {SUBSCRIPTION_FREQUENCY_LABELS[sub.frequency]}
                      </td>
                      <td className="px-3 py-2" onClick={() => setSelectedSubscription(sub)}>
                        {formatDate(sub.next_service_date)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold" onClick={() => setSelectedSubscription(sub)}>
                        {formatCurrency(sub.price_per_cycle)}
                      </td>
                      <td className="px-3 py-2" onClick={() => setSelectedSubscription(sub)}>
                        <StatusChip status={sub.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Detail Drawer */}
      {renderDetailDrawer()}

      {/* Create Subscription Modal */}
      <CreateSubscriptionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchSubscriptions}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.variant === 'danger' ? 'Yes, Cancel' : 'Confirm'}
      />
    </div>
  );
}
