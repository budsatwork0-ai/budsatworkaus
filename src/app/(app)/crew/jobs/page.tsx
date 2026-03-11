'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { brand, glass } from '@/app/ui/theme';
import { useEmployee } from '@/app/hooks/useEmployee';
import { SERVICE_TYPE_LABELS } from '@/types/orders';
import type { ServiceType } from '@/types/orders';

const SERVICE_HOURS: Record<string, number> = {
  windows: 2, cleaning: 3, yard: 2, dump: 2, auto: 3, laundry_sneakers: 1.5,
};

interface JobAssignment {
  id: string;
  order_id: string;
  status: string;
  created_at: string;
  orders: {
    id: string;
    customer_name: string;
    service_type: string;
    context: string;
    scheduled_date: string | null;
    scheduled_time: string | null;
    final_price: number;
    notes: string | null;
    scope: string | null;
  } | null;
}

const SERVICE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Services' },
  ...Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

export default function AvailableJobsPage() {
  const { employee, isLoading: empLoading } = useEmployee();
  const [assignments, setAssignments] = useState<JobAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [confirmDecline, setConfirmDecline] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('service_type', filter);
      const res = await fetch(`/api/crew/jobs?${params}`);
      if (!res.ok) throw new Error('Failed to load jobs');
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (employee) fetchJobs();
  }, [employee, fetchJobs]);

  async function handleAction(assignmentId: string, action: 'accepted' | 'declined') {
    setConfirmDecline(null);
    setActionLoading(assignmentId);
    setActionError((prev) => { const next = { ...prev }; delete next[assignmentId]; return next; });
    try {
      const res = await fetch(`/api/crew/jobs/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      });
      if (res.ok) {
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      } else {
        const body = await res.json().catch(() => ({}));
        setActionError((prev) => ({ ...prev, [assignmentId]: body.error ?? 'Action failed. Try again.' }));
      }
    } catch {
      setActionError((prev) => ({ ...prev, [assignmentId]: 'Network error. Try again.' }));
    } finally {
      setActionLoading(null);
    }
  }

  if (empLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: brand.text }}>Available Jobs</h1>
          <p className="text-sm mt-1" style={{ color: brand.muted }}>Browse and accept jobs assigned to you.</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {SERVICE_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{
              color: filter === opt.value ? brand.primary : brand.muted,
              background: filter === opt.value ? 'rgba(15,61,46,0.08)' : 'transparent',
              fontWeight: filter === opt.value ? 600 : 400,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Jobs list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${glass} rounded-2xl p-5 animate-pulse`}>
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className={`${glass} rounded-2xl p-10 text-center`}>
          <p className="font-medium mb-1" style={{ color: brand.text }}>Failed to load jobs</p>
          <p className="text-sm mb-4" style={{ color: brand.muted }}>{error}</p>
          <button
            onClick={fetchJobs}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: brand.primary }}
          >
            Try again
          </button>
        </div>
      ) : assignments.length === 0 ? (
        <div className={`${glass} rounded-2xl p-10 text-center`}>
          <p className="font-medium" style={{ color: brand.text }}>No available jobs right now</p>
          <p className="text-sm mt-1" style={{ color: brand.muted }}>Check back later for new assignments.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => {
            const order = assignment.orders;
            if (!order) return null;
            const serviceLabel = SERVICE_TYPE_LABELS[order.service_type as ServiceType] || order.service_type;

            return (
              <div key={assignment.id} className={`${glass} rounded-2xl p-5`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(15,61,46,0.1)', color: brand.primary }}
                      >
                        {serviceLabel}
                      </span>
                      <span className="text-xs" style={{ color: brand.muted }}>
                        {order.context === 'commercial' ? 'Commercial' : 'Home'}
                      </span>
                    </div>
                    <p className="font-medium" style={{ color: brand.text }}>
                      {order.customer_name}
                    </p>
                    {order.scheduled_date && (
                      <p className="text-sm mt-1" style={{ color: brand.muted }}>
                        {new Date(order.scheduled_date).toLocaleDateString('en-AU', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                        {order.scheduled_time && ` at ${order.scheduled_time}`}
                      </p>
                    )}
                    {order.notes && (
                      <p className="text-sm mt-2 line-clamp-2" style={{ color: brand.muted }}>
                        {order.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <p className="text-lg font-bold" style={{ color: brand.primary }}>
                      ${order.final_price.toFixed(2)}
                    </p>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}>
                      ~{SERVICE_HOURS[order.service_type] ?? 2}h est.
                    </span>
                    {confirmDecline === assignment.id ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <p className="text-xs font-medium text-red-600">Decline this job?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmDecline(null)}
                            className="px-3 py-1.5 rounded-lg text-sm border transition-colors"
                            style={{ borderColor: brand.border, color: brand.muted }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleAction(assignment.id, 'declined')}
                            disabled={actionLoading === assignment.id}
                            className="px-3 py-1.5 rounded-lg text-sm text-white transition-colors hover:opacity-90 disabled:opacity-50"
                            style={{ background: '#DC2626' }}
                          >
                            {actionLoading === assignment.id ? (
                              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : 'Yes, decline'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDecline(assignment.id)}
                          disabled={actionLoading === assignment.id}
                          className="px-3 py-1.5 rounded-lg text-sm border transition-colors hover:bg-red-50 disabled:opacity-50"
                          style={{ borderColor: brand.border, color: '#DC2626' }}
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleAction(assignment.id, 'accepted')}
                          disabled={actionLoading === assignment.id}
                          className="px-3 py-1.5 rounded-lg text-sm text-white transition-colors hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                          style={{ background: brand.primary }}
                        >
                          {actionLoading === assignment.id ? (
                            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : 'Accept'}
                        </button>
                      </div>
                    )}
                    {actionError[assignment.id] && (
                      <p className="text-xs text-red-600 mt-1">{actionError[assignment.id]}</p>
                    )}
                    <Link
                      href={`/crew/jobs/${assignment.id}`}
                      className="text-xs underline"
                      style={{ color: brand.muted }}
                    >
                      View details
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
