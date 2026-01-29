'use client';

import { useCallback, useMemo, useState } from 'react';
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
  'sneakers',
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
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="rounded-2xl border border-black/5 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
    <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
    {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
  </div>
);

// Mock data for initial development - replace with API calls when Supabase is set up
const mockSubscriptions: Subscription[] = [
  {
    id: 'SUB-001',
    customer_name: 'ABC Corporation',
    customer_email: 'facilities@abccorp.com',
    customer_phone: '0798765432',
    service_type: 'cleaning',
    context: 'commercial',
    scope: 'standard',
    frequency: 'weekly',
    base_price: 500,
    discount_percent: 12,
    price_per_cycle: 440,
    status: 'active',
    start_date: '2025-11-01',
    next_service_date: '2026-02-03',
    last_service_date: '2026-01-27',
    notes: 'Weekly office clean - 3 floors',
    created_at: '2025-11-01T09:00:00Z',
    updated_at: '2026-01-27T16:00:00Z',
  },
  {
    id: 'SUB-002',
    customer_name: 'Greenfield Medical',
    customer_email: 'admin@greenfieldmed.com',
    customer_phone: '0712345678',
    service_type: 'cleaning',
    context: 'commercial',
    scope: 'intensive',
    frequency: 'daily',
    base_price: 200,
    discount_percent: 28,
    price_per_cycle: 144,
    status: 'active',
    start_date: '2025-09-15',
    next_service_date: '2026-01-29',
    last_service_date: '2026-01-28',
    notes: 'Daily medical facility sanitization',
    created_at: '2025-09-15T08:00:00Z',
    updated_at: '2026-01-28T18:00:00Z',
  },
  {
    id: 'SUB-003',
    customer_name: 'Smith Family',
    customer_email: 'smiths@email.com',
    customer_phone: '0423456789',
    service_type: 'cleaning',
    context: 'home',
    scope: 'standard',
    frequency: 'fortnightly',
    base_price: 180,
    discount_percent: 10,
    price_per_cycle: 162,
    status: 'active',
    start_date: '2025-12-01',
    next_service_date: '2026-02-05',
    last_service_date: '2026-01-22',
    notes: 'Fortnightly home clean - 4 bedrooms',
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2026-01-22T14:00:00Z',
  },
  {
    id: 'SUB-004',
    customer_name: 'Johnson Residence',
    customer_email: 'johnson@email.com',
    customer_phone: '0434567890',
    service_type: 'dump',
    context: 'home',
    scope: 'bin',
    frequency: 'weekly',
    base_price: 20,
    discount_percent: 0,
    price_per_cycle: 20,
    status: 'paused',
    start_date: '2025-10-01',
    next_service_date: null,
    last_service_date: '2026-01-15',
    notes: 'Weekly bin clean - paused for holidays',
    created_at: '2025-10-01T11:00:00Z',
    updated_at: '2026-01-15T09:00:00Z',
  },
  {
    id: 'SUB-005',
    customer_name: 'Old Client Co',
    customer_email: 'cancelled@oldclient.com',
    customer_phone: '0445678901',
    service_type: 'windows',
    context: 'commercial',
    scope: 'full',
    frequency: 'monthly',
    base_price: 800,
    discount_percent: 0,
    price_per_cycle: 800,
    status: 'cancelled',
    start_date: '2025-06-01',
    next_service_date: null,
    last_service_date: '2025-12-01',
    end_date: '2025-12-15',
    notes: 'Monthly window clean - contract ended',
    created_at: '2025-06-01T09:00:00Z',
    updated_at: '2025-12-15T10:00:00Z',
  },
];

export default function SubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(mockSubscriptions);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [filters, setFilters] = useState<SubscriptionFilters>({
    status: 'all',
    service_type: 'all',
    frequency: 'all',
    search: '',
  });
  const [isLoading] = useState(false);

  const filteredSubscriptions = useMemo(() => {
    const searchTerm = filters.search?.trim().toLowerCase() || '';
    return subscriptions.filter((sub) => {
      // Tab filter
      if (activeTab !== 'all' && sub.status !== activeTab) {
        return false;
      }
      // Service type filter
      if (filters.service_type && filters.service_type !== 'all' && sub.service_type !== filters.service_type) {
        return false;
      }
      // Frequency filter
      if (filters.frequency && filters.frequency !== 'all' && sub.frequency !== filters.frequency) {
        return false;
      }
      // Search filter
      if (searchTerm) {
        const haystack = `${sub.customer_name} ${sub.customer_email} ${sub.id}`.toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }
      return true;
    });
  }, [subscriptions, activeTab, filters]);

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

    // Uncomment when Supabase is set up
    // try {
    //   const res = await fetch(`/api/subscriptions/${subscriptionId}`, {
    //     method: 'PATCH',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ status: newStatus }),
    //   });
    //   if (!res.ok) throw new Error('Failed to update');
    //   toast.success(`Subscription ${SUBSCRIPTION_STATUS_LABELS[newStatus].toLowerCase()}`);
    // } catch (error) {
    //   toast.error('Failed to update subscription status');
    // }
  }, [selectedSubscription]);

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
                    onClick={() => updateSubscriptionStatus(selectedSubscription.id, 'cancelled')}
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

  return (
    <div className="grid gap-10 w-full px-4 md:px-10 lg:px-12 pb-14">
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total Subscriptions" value={String(summaryStats.total)} hint="All time" />
        <SummaryCard label="Active" value={String(summaryStats.active)} hint="Currently running" />
        <SummaryCard label="Monthly Recurring" value={formatCurrency(summaryStats.monthlyRecurring)} hint="From active subscriptions" />
        <SummaryCard label="Due This Week" value={String(summaryStats.dueThisWeek)} hint="Services scheduled" />
      </div>

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

      {/* Filters */}
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
      </div>

      {/* Subscriptions Table */}
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/90">
        <div className="overflow-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-white/95 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
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
                  onClick={() => setSelectedSubscription(sub)}
                  className="cursor-pointer border-b border-slate-100 text-sm transition-colors hover:bg-slate-50"
                >
                  <td className="px-3 py-2 font-semibold text-slate-900">{sub.id}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{sub.customer_name}</div>
                    {sub.customer_email && (
                      <div className="text-[11px] text-slate-500">{sub.customer_email}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div>{SERVICE_TYPE_LABELS[sub.service_type]}</div>
                    <div className="text-[11px] text-slate-500 capitalize">{sub.context}</div>
                  </td>
                  <td className="px-3 py-2">{SUBSCRIPTION_FREQUENCY_LABELS[sub.frequency]}</td>
                  <td className="px-3 py-2">{formatDate(sub.next_service_date)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(sub.price_per_cycle)}</td>
                  <td className="px-3 py-2">
                    <StatusChip status={sub.status} />
                  </td>
                </tr>
              ))}
              {filteredSubscriptions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                    {isLoading ? 'Loading subscriptions...' : 'No subscriptions match the filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      {renderDetailDrawer()}
    </div>
  );
}
