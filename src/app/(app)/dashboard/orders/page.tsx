'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';
import type {
  Order,
  OrderStatus,
  OrderFilters,
  ServiceType,
} from '@/types/orders';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  SERVICE_TYPE_LABELS,
  FREQUENCY_LABELS,
} from '@/types/orders';

type TabKey = 'all' | 'pending' | 'scheduled' | 'in_progress' | 'completed';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
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

const StatusChip = ({ status }: { status: OrderStatus }) => {
  const colorClass = ORDER_STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-700';
  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${colorClass}`}>
      {ORDER_STATUS_LABELS[status]}
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
const mockOrders: Order[] = [
  {
    id: 'ORD-001',
    customer_name: 'John Smith',
    customer_email: 'john@example.com',
    customer_phone: '0412345678',
    service_type: 'cleaning',
    context: 'home',
    scope: 'standard',
    frequency: 'none',
    base_price: 180,
    discount_percent: 0,
    final_price: 180,
    scheduled_date: '2026-02-03',
    scheduled_time: '9:00 AM',
    status: 'pending',
    notes: 'Standard home clean - 3 bedrooms',
    created_at: '2026-01-25T10:00:00Z',
    updated_at: '2026-01-25T10:00:00Z',
  },
  {
    id: 'ORD-002',
    customer_name: 'ABC Corporation',
    customer_email: 'facilities@abccorp.com',
    customer_phone: '0798765432',
    service_type: 'windows',
    context: 'commercial',
    scope: 'full',
    frequency: 'none',
    base_price: 450,
    discount_percent: 0,
    final_price: 450,
    scheduled_date: '2026-02-05',
    scheduled_time: '7:00 AM',
    status: 'confirmed',
    notes: 'Full window clean - 3 storey office',
    created_at: '2026-01-24T14:30:00Z',
    updated_at: '2026-01-26T09:00:00Z',
  },
  {
    id: 'ORD-003',
    customer_name: 'Sarah Johnson',
    customer_email: 'sarah.j@email.com',
    customer_phone: '0423456789',
    service_type: 'yard',
    context: 'home',
    scope: 'lawn',
    frequency: 'none',
    base_price: 120,
    discount_percent: 0,
    final_price: 120,
    scheduled_date: '2026-01-28',
    scheduled_time: '8:00 AM',
    status: 'in_progress',
    notes: 'Lawn mowing and edging',
    created_at: '2026-01-20T16:00:00Z',
    updated_at: '2026-01-28T08:15:00Z',
  },
  {
    id: 'ORD-004',
    customer_name: 'Mike Wilson',
    customer_email: 'mike.w@email.com',
    customer_phone: '0434567890',
    service_type: 'dump',
    context: 'home',
    scope: 'bin',
    frequency: 'none',
    base_price: 20,
    discount_percent: 0,
    final_price: 20,
    scheduled_date: '2026-01-27',
    status: 'completed',
    notes: 'Bin clean',
    created_at: '2026-01-22T11:00:00Z',
    updated_at: '2026-01-27T15:30:00Z',
    completed_at: '2026-01-27T15:30:00Z',
  },
  {
    id: 'ORD-005',
    customer_name: 'Emma Davis',
    customer_email: 'emma.d@email.com',
    customer_phone: '0445678901',
    service_type: 'auto',
    context: 'home',
    scope: 'full',
    frequency: 'none',
    base_price: 290,
    discount_percent: 0,
    final_price: 290,
    scheduled_date: '2026-02-01',
    scheduled_time: '10:00 AM',
    status: 'scheduled',
    notes: 'Signature Full Detail - SUV',
    created_at: '2026-01-26T09:00:00Z',
    updated_at: '2026-01-26T14:00:00Z',
  },
];

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filters, setFilters] = useState<OrderFilters>({
    status: 'all',
    service_type: 'all',
    search: '',
  });
  const [isLoading] = useState(false);

  // Fetch orders from API (uncomment when Supabase is set up)
  // useEffect(() => {
  //   const fetchOrders = async () => {
  //     setIsLoading(true);
  //     try {
  //       const params = new URLSearchParams();
  //       if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  //       if (filters.service_type && filters.service_type !== 'all') params.set('service_type', filters.service_type);
  //       if (filters.search) params.set('search', filters.search);
  //
  //       const res = await fetch(`/api/orders?${params.toString()}`);
  //       if (res.ok) {
  //         const data = await res.json();
  //         setOrders(data.orders);
  //       }
  //     } catch (error) {
  //       toast.error('Failed to fetch orders');
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };
  //   fetchOrders();
  // }, [filters]);

  const filteredOrders = useMemo(() => {
    const searchTerm = filters.search?.trim().toLowerCase() || '';
    return orders.filter((order) => {
      // Tab filter
      if (activeTab !== 'all' && order.status !== activeTab) {
        return false;
      }
      // Service type filter
      if (filters.service_type && filters.service_type !== 'all' && order.service_type !== filters.service_type) {
        return false;
      }
      // Search filter
      if (searchTerm) {
        const haystack = `${order.customer_name} ${order.customer_email} ${order.id}`.toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }
      return true;
    });
  }, [orders, activeTab, filters]);

  // Summary calculations
  const summaryStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const pendingCount = orders.filter((o) => o.status === 'pending').length;
    const completedThisMonth = orders.filter(
      (o) => o.status === 'completed' && o.completed_at && new Date(o.completed_at) >= startOfMonth
    );
    const revenueThisMonth = completedThisMonth.reduce((sum, o) => sum + o.final_price, 0);
    const completedTodayCount = orders.filter(
      (o) => o.status === 'completed' && o.completed_at &&
        new Date(o.completed_at).toDateString() === now.toDateString()
    ).length;

    return {
      total: orders.length,
      pending: pendingCount,
      revenueMTD: revenueThisMonth,
      completedToday: completedTodayCount,
    };
  }, [orders]);

  const updateOrderStatus = useCallback(async (orderId: string, newStatus: OrderStatus) => {
    // For now, update locally. Replace with API call when Supabase is set up
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: newStatus,
              updated_at: new Date().toISOString(),
              completed_at: newStatus === 'completed' ? new Date().toISOString() : order.completed_at,
            }
          : order
      )
    );

    if (selectedOrder?.id === orderId) {
      setSelectedOrder((prev) =>
        prev ? { ...prev, status: newStatus, updated_at: new Date().toISOString() } : null
      );
    }

    toast.success(`Order ${ORDER_STATUS_LABELS[newStatus].toLowerCase()}`);

    // Uncomment when Supabase is set up
    // try {
    //   const res = await fetch(`/api/orders/${orderId}`, {
    //     method: 'PATCH',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ status: newStatus }),
    //   });
    //   if (!res.ok) throw new Error('Failed to update');
    //   toast.success(`Order ${ORDER_STATUS_LABELS[newStatus].toLowerCase()}`);
    // } catch (error) {
    //   toast.error('Failed to update order status');
    // }
  }, [selectedOrder]);

  const renderDetailDrawer = () => {
    if (!selectedOrder) return null;

    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedOrder(null)} aria-hidden />
        <div className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-black/5 bg-white/95 shadow-2xl">
          <div className="flex items-start justify-between px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Order Details</p>
              <h2 className="text-lg font-semibold text-slate-900">{selectedOrder.id}</h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm text-slate-500"
            >
              Close
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 pb-6 text-sm text-slate-700">
            <div className="flex items-center gap-3">
              <StatusChip status={selectedOrder.status} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Customer</span>
                <span className="font-semibold text-slate-900">{selectedOrder.customer_name}</span>
              </div>
              {selectedOrder.customer_email && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Email</span>
                  <span className="text-slate-700">{selectedOrder.customer_email}</span>
                </div>
              )}
              {selectedOrder.customer_phone && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Phone</span>
                  <span className="text-slate-700">{selectedOrder.customer_phone}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Service</span>
                <span className="font-semibold text-slate-900">
                  {SERVICE_TYPE_LABELS[selectedOrder.service_type]}
                  {selectedOrder.scope && ` - ${selectedOrder.scope}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Context</span>
                <span className="text-slate-700 capitalize">{selectedOrder.context}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Frequency</span>
                <span className="text-slate-700">{FREQUENCY_LABELS[selectedOrder.frequency]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Scheduled</span>
                <span className="font-semibold text-slate-900">
                  {formatDate(selectedOrder.scheduled_date)}
                  {selectedOrder.scheduled_time && ` at ${selectedOrder.scheduled_time}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Price</span>
                <span className="font-semibold text-slate-900">{formatCurrency(selectedOrder.final_price)}</span>
              </div>
              {selectedOrder.discount_percent > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Discount</span>
                  <span className="text-green-600">{selectedOrder.discount_percent}% off</span>
                </div>
              )}
            </div>

            {selectedOrder.notes && (
              <div className="space-y-1">
                <div className="text-xs text-slate-500">Notes</div>
                <p className="rounded-xl border border-black/5 bg-white/80 px-3 py-2 text-sm text-slate-700">
                  {selectedOrder.notes}
                </p>
              </div>
            )}

            <div className="space-y-1 text-xs text-slate-500">
              <div>Created: {formatDate(selectedOrder.created_at)}</div>
              <div>Updated: {formatDate(selectedOrder.updated_at)}</div>
              {selectedOrder.completed_at && <div>Completed: {formatDate(selectedOrder.completed_at)}</div>}
            </div>

            {/* Actions */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Actions</p>
              <div className="flex flex-wrap gap-2">
                {selectedOrder.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'confirmed')}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
                    style={{ background: brand.primary }}
                  >
                    Confirm Order
                  </button>
                )}
                {selectedOrder.status === 'confirmed' && (
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'scheduled')}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
                    style={{ background: brand.primary }}
                  >
                    Mark Scheduled
                  </button>
                )}
                {selectedOrder.status === 'scheduled' && (
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'in_progress')}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
                    style={{ background: brand.primary }}
                  >
                    Start Job
                  </button>
                )}
                {selectedOrder.status === 'in_progress' && (
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                    className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white"
                  >
                    Mark Complete
                  </button>
                )}
                {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'cancelled')}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
                  >
                    Cancel
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
            Orders
          </h1>
          <p className="text-sm text-slate-500">
            Track and manage one-time service orders. View order status, schedule jobs, and mark completions.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total Orders" value={String(summaryStats.total)} hint="All time" />
        <SummaryCard label="Pending" value={String(summaryStats.pending)} hint="Awaiting confirmation" />
        <SummaryCard label="Revenue (MTD)" value={formatCurrency(summaryStats.revenueMTD)} hint="From completed orders" />
        <SummaryCard label="Completed Today" value={String(summaryStats.completedToday)} hint="Jobs done" />
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
        <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-[11px] text-slate-500">
          Search
          <input
            type="text"
            placeholder="Search customer or order ID"
            value={filters.search || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            className="rounded-lg border border-black/10 bg-white/90 px-3 py-1 text-xs text-slate-700"
          />
        </label>
      </div>

      {/* Orders Table */}
      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/90">
        <div className="overflow-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-white/95 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-100 px-3 py-2">Order ID</th>
                <th className="border-b border-slate-100 px-3 py-2">Customer</th>
                <th className="border-b border-slate-100 px-3 py-2">Service</th>
                <th className="border-b border-slate-100 px-3 py-2">Scheduled</th>
                <th className="border-b border-slate-100 px-3 py-2 text-right">Price</th>
                <th className="border-b border-slate-100 px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="cursor-pointer border-b border-slate-100 text-sm transition-colors hover:bg-slate-50"
                >
                  <td className="px-3 py-2 font-semibold text-slate-900">{order.id}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{order.customer_name}</div>
                    {order.customer_email && (
                      <div className="text-[11px] text-slate-500">{order.customer_email}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div>{SERVICE_TYPE_LABELS[order.service_type]}</div>
                    <div className="text-[11px] text-slate-500 capitalize">{order.context}</div>
                  </td>
                  <td className="px-3 py-2">
                    {formatDate(order.scheduled_date)}
                    {order.scheduled_time && (
                      <div className="text-[11px] text-slate-500">{order.scheduled_time}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(order.final_price)}</td>
                  <td className="px-3 py-2">
                    <StatusChip status={order.status} />
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                    {isLoading ? 'Loading orders...' : 'No orders match the filters.'}
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
