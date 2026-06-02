'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { dashboardTheme } from '@/lib/design-system/themes';
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
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import LoadingSkeleton, { SummaryCardsSkeleton } from '@/components/LoadingSkeleton';
import CreateOrderModal from '@/components/CreateOrderModal';
import { formatCurrency, formatDate } from '@/lib/dashboard/utils';
import { SummaryCard } from '../components/shared';

type TabKey = 'all' | 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
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


const StatusChip = ({ status }: { status: OrderStatus }) => {
  const colorClass = ORDER_STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-700';
  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${colorClass}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
};


export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<OrderFilters>({
    status: 'all',
    service_type: 'all',
    search: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [employees, setEmployees] = useState<Array<{ id: string; full_name: string; services: string[] | null }>>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  // Variation order state
  const [variationModal, setVariationModal] = useState(false);
  const [variationForm, setVariationForm] = useState({ description: '', additionalCost: '', reason: '' });
  const [variationSending, setVariationSending] = useState(false);

  // Service agreement state
  const [agreementModal, setAgreementModal] = useState(false);
  const [agreementForm, setAgreementForm] = useState({ filmingOps: true, filmingMarketing: false });
  const [agreementSending, setAgreementSending] = useState(false);

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

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);
      if (filters.service_type && filters.service_type !== 'all') params.set('service_type', filters.service_type);
      if (filters.search) params.set('search', filters.search);

      const res = await fetch(`/api/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      } else {
        // If API fails (e.g., no database), use empty array
        setOrders([]);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    const searchTerm = filters.search?.trim().toLowerCase() || '';
    return orders.filter((order) => {
      // Tab filter
      if (activeTab !== 'all' && order.status !== activeTab) {
        return false;
      }
      // Search filter (client-side for local search)
      if (searchTerm) {
        const haystack = `${order.customer_name} ${order.customer_email} ${order.id}`.toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }
      return true;
    });
  }, [orders, activeTab, filters.search]);

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
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update order');
      }

      // Update local state
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
    } catch (error) {
      console.error('Failed to update order:', error);
      toast.error('Failed to update order status');
    }
  }, [selectedOrder]);

  const handleCancelOrder = (orderId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cancel Order',
      message: 'Are you sure you want to cancel this order? You can restore it from the Cancelled tab if needed.',
      variant: 'danger',
      onConfirm: () => {
        updateOrderStatus(orderId, 'cancelled');
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  // Assign to crew
  const openAssignModal = async () => {
    setAssignModalOpen(true);
    try {
      const res = await fetch('/api/crew/employees');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
      }
    } catch {
      // employees list may be empty
    }
  };

  const assignToCrew = async (employeeId: string) => {
    if (!selectedOrder) return;
    setAssignLoading(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_ids: [employeeId] }),
      });
      if (res.ok) {
        toast.success('Job assigned to crew member');
        setAssignModalOpen(false);
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to assign');
      }
    } catch {
      toast.error('Failed to assign job');
    } finally {
      setAssignLoading(false);
    }
  };

  const sendVariation = async () => {
    if (!selectedOrder) return;
    const cost = Number(variationForm.additionalCost);
    if (!variationForm.description.trim()) { toast.error('Describe the additional work'); return; }
    if (!Number.isFinite(cost) || cost < 0) { toast.error('Enter a valid additional cost'); return; }
    setVariationSending(true);
    try {
      const res = await fetch('/api/admin/docusign/send-variation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          variation_description: variationForm.description.trim(),
          additional_cost: cost,
          reason: variationForm.reason.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to send');
      toast.success(`Variation order sent to ${selectedOrder.customer_name} via DocuSign`);
      setVariationModal(false);
      setVariationForm({ description: '', additionalCost: '', reason: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send variation');
    } finally {
      setVariationSending(false);
    }
  };

  const sendAgreement = async () => {
    if (!selectedOrder) return;
    setAgreementSending(true);
    try {
      const res = await fetch('/api/admin/docusign/send-agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedOrder.id,
          filming_consent_ops: agreementForm.filmingOps,
          filming_consent_marketing: agreementForm.filmingMarketing,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to send');
      toast.success(`Service agreement sent to ${selectedOrder.customer_name} via DocuSign`);
      setAgreementModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send agreement');
    } finally {
      setAgreementSending(false);
    }
  };

  // Bulk actions
  const handleBulkStatusUpdate = (newStatus: OrderStatus) => {
    if (selectedOrderIds.size === 0) {
      toast.error('No orders selected');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: `Update ${selectedOrderIds.size} Orders`,
      message: `Are you sure you want to mark ${selectedOrderIds.size} orders as ${ORDER_STATUS_LABELS[newStatus].toLowerCase()}?`,
      variant: newStatus === 'cancelled' ? 'danger' : 'default',
      onConfirm: async () => {
        for (const orderId of selectedOrderIds) {
          await updateOrderStatus(orderId, newStatus);
        }
        setSelectedOrderIds(new Set());
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        toast.success(`Updated ${selectedOrderIds.size} orders`);
      },
    });
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Order ID', 'Customer', 'Email', 'Phone', 'Service', 'Context', 'Scheduled', 'Price', 'Status'];
    const rows = filteredOrders.map((order) => [
      order.id,
      order.customer_name,
      order.customer_email || '',
      order.customer_phone || '',
      SERVICE_TYPE_LABELS[order.service_type],
      order.context,
      order.scheduled_date || '',
      order.final_price.toString(),
      ORDER_STATUS_LABELS[order.status],
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Orders exported to CSV');
  };

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
                    style={{ background: dashboardTheme.color.primary }}
                  >
                    Confirm Order
                  </button>
                )}
                {selectedOrder.status === 'confirmed' && (
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'scheduled')}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
                    style={{ background: dashboardTheme.color.primary }}
                  >
                    Mark Scheduled
                  </button>
                )}
                {selectedOrder.status === 'scheduled' && (
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'in_progress')}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
                    style={{ background: dashboardTheme.color.primary }}
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
                    onClick={openAssignModal}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.primary }}
                  >
                    Assign to Crew
                  </button>
                )}
                {selectedOrder.customer_email && selectedOrder.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      setAgreementForm({ filmingOps: true, filmingMarketing: false });
                      setAgreementModal(true);
                    }}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: '#C7D2FE', background: '#EEF2FF', color: '#4338CA' }}
                  >
                    Send service agreement
                  </button>
                )}
                {selectedOrder.customer_email && ['scheduled', 'in_progress', 'completed'].includes(selectedOrder.status) && (
                  <button
                    type="button"
                    onClick={() => {
                      setVariationForm({ description: '', additionalCost: '', reason: '' });
                      setVariationModal(true);
                    }}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: '#FDE68A', background: '#FFFBEB', color: '#92400E' }}
                  >
                    Request variation sign-off
                  </button>
                )}
                {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => handleCancelOrder(selectedOrder.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
                  >
                    Cancel
                  </button>
                )}
                {selectedOrder.status === 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(selectedOrder.id, 'pending')}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700"
                  >
                    Restore to Pending
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Mobile card view for orders
  const renderMobileCard = (order: Order) => (
    <div
      key={order.id}
      className="rounded-xl border border-black/5 bg-white/90 p-4 shadow-sm md:hidden"
      onClick={() => setSelectedOrder(order)}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold text-slate-900">{order.customer_name}</div>
          <div className="text-xs text-slate-500">{order.id}</div>
        </div>
        <StatusChip status={order.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div>
          <span className="text-slate-400">Service: </span>
          {SERVICE_TYPE_LABELS[order.service_type]}
        </div>
        <div>
          <span className="text-slate-400">Price: </span>
          {formatCurrency(order.final_price)}
        </div>
        <div>
          <span className="text-slate-400">Scheduled: </span>
          {formatDate(order.scheduled_date)}
        </div>
        <div>
          <span className="text-slate-400">Context: </span>
          <span className="capitalize">{order.context}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 w-full px-4 md:px-10 lg:px-12 pb-14">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold" style={{ color: dashboardTheme.color.primary }}>
            Orders
          </h1>
          <p className="text-sm text-slate-500">
            Track and manage one-time service orders. View order status, schedule jobs, and mark completions.
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
            style={{ background: dashboardTheme.color.primary }}
          >
            + New Order
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <SummaryCardsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Total Orders" value={String(summaryStats.total)} hint="All time" />
          <SummaryCard label="Pending" value={String(summaryStats.pending)} hint="Awaiting confirmation" />
          <SummaryCard label="Revenue (MTD)" value={formatCurrency(summaryStats.revenueMTD)} hint="From completed orders" />
          <SummaryCard label="Completed Today" value={String(summaryStats.completedToday)} hint="Jobs done" />
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
              style={activeTab === tab.key ? { background: dashboardTheme.color.primary } : undefined}
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

        {/* Bulk Actions */}
        {selectedOrderIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-500">{selectedOrderIds.size} selected</span>
            <button
              onClick={() => handleBulkStatusUpdate('completed')}
              className="px-2 py-1 text-xs rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
            >
              Complete
            </button>
            <button
              onClick={() => handleBulkStatusUpdate('cancelled')}
              className="px-2 py-1 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
            >
              Cancel
            </button>
            {activeTab === 'cancelled' && (
              <button
                onClick={() => handleBulkStatusUpdate('pending')}
                className="px-2 py-1 text-xs rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200"
              >
                Restore
              </button>
            )}
            <button
              onClick={() => setSelectedOrderIds(new Set())}
              className="px-2 py-1 text-xs rounded-lg border border-slate-200 text-slate-600"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Orders Table (Desktop) */}
      {isLoading ? (
        <LoadingSkeleton rows={5} columns={7} />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title="No orders found"
          description={orders.length === 0
            ? "You haven't created any orders yet. Create your first order to get started."
            : "No orders match your current filters. Try adjusting your search criteria."
          }
          action={orders.length === 0 ? {
            label: 'Create First Order',
            onClick: () => setIsCreateModalOpen(true),
          } : undefined}
        />
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {filteredOrders.map(renderMobileCard)}
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
                        checked={selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
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
                      className={`cursor-pointer border-b border-slate-100 text-sm transition-colors hover:bg-slate-50 ${
                        selectedOrderIds.has(order.id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.has(order.id)}
                          onChange={() => toggleOrderSelection(order.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900" onClick={() => setSelectedOrder(order)}>
                        {order.id}
                      </td>
                      <td className="px-3 py-2" onClick={() => setSelectedOrder(order)}>
                        <div className="font-medium">{order.customer_name}</div>
                        {order.customer_email && (
                          <div className="text-[11px] text-slate-500">{order.customer_email}</div>
                        )}
                      </td>
                      <td className="px-3 py-2" onClick={() => setSelectedOrder(order)}>
                        <div>{SERVICE_TYPE_LABELS[order.service_type]}</div>
                        <div className="text-[11px] text-slate-500 capitalize">{order.context}</div>
                      </td>
                      <td className="px-3 py-2" onClick={() => setSelectedOrder(order)}>
                        {formatDate(order.scheduled_date)}
                        {order.scheduled_time && (
                          <div className="text-[11px] text-slate-500">{order.scheduled_time}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold" onClick={() => setSelectedOrder(order)}>
                        {formatCurrency(order.final_price)}
                      </td>
                      <td className="px-3 py-2" onClick={() => setSelectedOrder(order)}>
                        <StatusChip status={order.status} />
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

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchOrders}
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

      {/* Assign to Crew Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAssignModalOpen(false)} aria-hidden />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: dashboardTheme.color.text }}>
              Assign to Crew
            </h2>
            {employees.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No crew members found. Employees need to create their crew profile first.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {employees
                  .filter((e) => {
                    if (!selectedOrder) return true;
                    // Show employees who can do this service type
                    return !e.services || e.services.length === 0 || e.services.includes(selectedOrder.service_type);
                  })
                  .map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => assignToCrew(emp.id)}
                    disabled={assignLoading}
                    className="w-full text-left px-4 py-3 rounded-lg border transition-colors hover:bg-slate-50"
                    style={{ borderColor: dashboardTheme.color.border }}
                  >
                    <p className="text-sm font-medium" style={{ color: dashboardTheme.color.text }}>{emp.full_name}</p>
                    {emp.services && emp.services.length > 0 && (
                      <p className="text-xs mt-0.5" style={{ color: dashboardTheme.color.muted }}>
                        {emp.services.map((s) => SERVICE_TYPE_LABELS[s as ServiceType] || s).join(', ')}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setAssignModalOpen(false)}
              className="mt-4 w-full py-2 rounded-lg border text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.muted }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Service Agreement Modal */}
      {agreementModal && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAgreementModal(false)} aria-hidden />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: dashboardTheme.color.text }}>Send service agreement</h2>
                <p className="text-xs mt-0.5" style={{ color: dashboardTheme.color.muted }}>
                  Sent to <strong>{selectedOrder.customer_email}</strong> via DocuSign. Covers booking details, payment terms, cancellation policy, liability, and filming consent.
                </p>
              </div>
              <button onClick={() => setAgreementModal(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: dashboardTheme.color.text }}>Filming consent to include</p>
              <label className="flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer" style={{ borderColor: dashboardTheme.color.border }}>
                <input
                  type="checkbox"
                  checked={agreementForm.filmingOps}
                  onChange={(e) => setAgreementForm((p) => ({ ...p, filmingOps: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 accent-emerald-700"
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: dashboardTheme.color.text }}>Quality control &amp; training</p>
                  <p className="text-xs mt-0.5" style={{ color: dashboardTheme.color.muted }}>
                    Internal use only — quality assurance, staff training, record-keeping. Not shared publicly.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer" style={{ borderColor: dashboardTheme.color.border }}>
                <input
                  type="checkbox"
                  checked={agreementForm.filmingMarketing}
                  onChange={(e) => setAgreementForm((p) => ({ ...p, filmingMarketing: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 accent-emerald-700"
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: dashboardTheme.color.text }}>Marketing &amp; promotional use</p>
                  <p className="text-xs mt-0.5" style={{ color: dashboardTheme.color.muted }}>
                    Before/after photos or clips (not identifying the customer personally) for website, social media, or ads.
                  </p>
                </div>
              </label>
              {(selectedOrder.context as string) === 'ndis' && (
                <div className="rounded-xl border px-4 py-3 text-xs" style={{ background: '#FFF5F5', borderColor: '#FECACA', color: '#7F1D1D' }}>
                  ⚠️ NDIS participant — filming consent clause will include mandatory NDIS privacy and participant rights obligations.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setAgreementModal(false)}
                className="rounded-xl border px-4 py-2 text-sm font-medium"
                style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.muted }}
              >
                Cancel
              </button>
              <button
                onClick={sendAgreement}
                disabled={agreementSending}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: '#4338CA' }}
              >
                {agreementSending ? 'Sending…' : 'Send via DocuSign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variation Order Modal */}
      {variationModal && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setVariationModal(false)} aria-hidden />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: dashboardTheme.color.text }}>Request variation sign-off</h2>
                <p className="text-xs mt-0.5" style={{ color: dashboardTheme.color.muted }}>
                  Sent to <strong>{selectedOrder.customer_email}</strong> via DocuSign. Gets the customer&apos;s written approval before you carry out additional work.
                </p>
              </div>
              <button onClick={() => setVariationModal(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: dashboardTheme.color.text }}>
                  Description of additional work <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={variationForm.description}
                  onChange={(e) => setVariationForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Customer requested we clean the oven interior and wipe down the laundry room walls in addition to the standard clean."
                  rows={3}
                  className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: dashboardTheme.color.border }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: dashboardTheme.color.text }}>Original price</label>
                  <div className="rounded-xl border px-3 py-2 text-sm bg-slate-50" style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.muted }}>
                    ${Number(selectedOrder.final_price).toFixed(2)}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium" style={{ color: dashboardTheme.color.text }}>
                    Additional cost ($) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={variationForm.additionalCost}
                    onChange={(e) => setVariationForm((p) => ({ ...p, additionalCost: e.target.value }))}
                    placeholder="e.g. 45.00"
                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: dashboardTheme.color.border }}
                  />
                </div>
              </div>
              {variationForm.additionalCost && Number(variationForm.additionalCost) >= 0 && (
                <div className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: '#ECFDF5', color: '#065F46' }}>
                  New total: ${(Number(selectedOrder.final_price) + Number(variationForm.additionalCost)).toFixed(2)}
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: dashboardTheme.color.text }}>Reason / context (optional)</label>
                <input
                  value={variationForm.reason}
                  onChange={(e) => setVariationForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g. Customer pointed out the area during the job walkthrough."
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: dashboardTheme.color.border }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setVariationModal(false)}
                className="rounded-xl border px-4 py-2 text-sm font-medium"
                style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.muted }}
              >
                Cancel
              </button>
              <button
                onClick={sendVariation}
                disabled={variationSending}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: '#92400E' }}
              >
                {variationSending ? 'Sending…' : 'Send variation for sign-off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
