'use client';

import { useCallback, useEffect, useState } from 'react';
import { brand } from '@/app/ui/theme';
import { formatCurrency } from '@/lib/dashboard/utils';
import { SERVICE_LABELS } from '@/types/dashboard';

type UnassignedOrder = {
  id: string;
  customer_name: string;
  customer_email: string;
  service_type: string;
  context: string;
  scope: string | null;
  final_price: number;
  notes: string | null;
  created_at: string;
};

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  services: string[] | null;
  availability: string | null;
};

type AssignFormState = {
  orderId: string;
  employeeIds: string[];
  scheduledDate: string;
  scheduledTime: string;
};

const EMPTY_FORM: AssignFormState = {
  orderId: '',
  employeeIds: [],
  scheduledDate: '',
  scheduledTime: '',
};

export default function DispatchTab() {
  const [orders, setOrders] = useState<UnassignedOrder[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AssignFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [ordersRes, empRes] = await Promise.all([
        fetch('/api/orders?status=confirmed&unassigned=true'),
        fetch('/api/employees'),
      ]);
      if (ordersRes.ok) {
        const { orders: data } = await ordersRes.json();
        setOrders(data ?? []);
      }
      if (empRes.ok) {
        const { employees: data } = await empRes.json();
        setEmployees(data ?? []);
      }
    } catch {
      setError('Failed to load dispatch data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAssign = async () => {
    if (!form.orderId || form.employeeIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${form.orderId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_ids: form.employeeIds,
          scheduled_date: form.scheduledDate || undefined,
          scheduled_time: form.scheduledTime || undefined,
        }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        setError(msg ?? 'Assignment failed');
        return;
      }
      setSuccessId(form.orderId);
      setForm(EMPTY_FORM);
      // Remove the assigned order from the queue
      setOrders((prev) => prev.filter((o) => o.id !== form.orderId));
      setTimeout(() => setSuccessId(null), 4000);
    } catch {
      setError('Failed to assign job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleEmployee = (id: string) => {
    setForm((f) => ({
      ...f,
      employeeIds: f.employeeIds.includes(id)
        ? f.employeeIds.filter((e) => e !== id)
        : [...f.employeeIds, id],
    }));
  };

  const selectedOrder = orders.find((o) => o.id === form.orderId);

  // Extract service address from notes
  const extractAddress = (notes: string | null): string => {
    if (!notes) return '—';
    const match = notes.match(/^Address:\s*(.+)/m);
    return match?.[1]?.trim() ?? '—';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold" style={{ color: brand.primary }}>
            Dispatch Queue
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Confirmed orders waiting to be assigned to crew
          </p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Success banner */}
      {successId && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium">
          Job assigned — crew notified and scheduling email sent to customer.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button
            type="button"
            className="ml-3 underline text-red-600"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white/80 px-6 py-12 text-center">
          <div className="text-3xl mb-3">✅</div>
          <p className="text-sm font-medium text-slate-700">No jobs waiting to be dispatched</p>
          <p className="text-xs text-slate-400 mt-1">All confirmed orders have crew assigned.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Order queue */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {orders.length} unassigned order{orders.length !== 1 ? 's' : ''}
            </div>
            {orders.map((order) => {
              const isSelected = form.orderId === order.id;
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, orderId: isSelected ? '' : order.id, employeeIds: [] }))}
                  className={[
                    'w-full text-left rounded-2xl border px-4 py-3 transition-all',
                    isSelected
                      ? 'border-[color:var(--accent)] bg-emerald-50 shadow-sm'
                      : 'border-slate-200 bg-white/80 hover:border-slate-300',
                  ].join(' ')}
                  style={{ '--accent': brand.primary } as React.CSSProperties}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {order.customer_name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        {SERVICE_LABELS[order.service_type] ?? order.service_type}
                        {order.context === 'commercial' ? ' · Commercial' : ''}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {extractAddress(order.notes)}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-bold" style={{ color: brand.primary }}>
                        {formatCurrency(order.final_price)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Assignment form */}
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 space-y-5">
            <div className="text-sm font-semibold text-slate-800">
              {selectedOrder ? `Assign: ${selectedOrder.customer_name}` : 'Select a job to assign'}
            </div>

            {selectedOrder && (
              <>
                {/* Date & time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="dispatch-date">
                      Scheduled date
                    </label>
                    <input
                      id="dispatch-date"
                      type="date"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                      value={form.scheduledDate}
                      onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="dispatch-time">
                      Time window
                    </label>
                    <input
                      id="dispatch-time"
                      type="text"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30 focus:border-emerald-600"
                      placeholder="e.g. 9:00 AM – 11:00 AM"
                      value={form.scheduledTime}
                      onChange={(e) => setForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Crew selection */}
                <div>
                  <div className="text-xs font-medium text-slate-600 mb-2">Select crew member(s)</div>
                  {employees.length === 0 ? (
                    <p className="text-xs text-slate-400">No crew available. Add employees first.</p>
                  ) : (
                    <div className="space-y-2">
                      {employees.map((emp) => {
                        const selected = form.employeeIds.includes(emp.id);
                        return (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => toggleEmployee(emp.id)}
                            className={[
                              'w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all',
                              selected
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-slate-200 bg-white hover:border-slate-300',
                            ].join(' ')}
                          >
                            <div
                              className={[
                                'w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border',
                                selected ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300',
                              ].join(' ')}
                            >
                              {selected && (
                                <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                                  <polyline points="2 6 5 9 10 3" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900">
                                {emp.first_name} {emp.last_name}
                              </div>
                              {emp.services && emp.services.length > 0 && (
                                <div className="text-xs text-slate-400 truncate">
                                  {emp.services.map((s) => SERVICE_LABELS[s] ?? s).join(', ')}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="button"
                  disabled={form.employeeIds.length === 0 || isSubmitting}
                  onClick={handleAssign}
                  className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                  style={{ background: brand.primary }}
                >
                  {isSubmitting
                    ? 'Assigning…'
                    : `Assign to ${form.employeeIds.length === 0 ? 'crew' : `${form.employeeIds.length} crew member${form.employeeIds.length > 1 ? 's' : ''}`}${form.scheduledDate ? ' & send schedule' : ''}`}
                </button>

                {form.scheduledDate && (
                  <p className="text-[11px] text-slate-400 text-center -mt-2">
                    A scheduling confirmation email will be sent to {selectedOrder.customer_email}
                  </p>
                )}
              </>
            )}

            {!selectedOrder && (
              <p className="text-xs text-slate-400">
                Click a job from the queue to configure and assign it.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
