'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { brand, glass } from '@/app/ui/theme';
import { useEmployee } from '@/app/hooks/useEmployee';
import { SERVICE_TYPE_LABELS } from '@/types/orders';
import { ASSIGNMENT_STATUS_LABELS, ASSIGNMENT_STATUS_COLORS } from '@/types/crew';
import type { ServiceType } from '@/types/orders';
import type { AssignmentStatus } from '@/types/crew';

interface JobAssignment {
  id: string;
  order_id: string;
  status: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  orders: {
    id: string;
    customer_name: string;
    service_type: string;
    context: string;
    scheduled_date: string | null;
    scheduled_time: string | null;
    final_price: number;
    notes: string | null;
  } | null;
}

type Tab = 'active' | 'completed';

export default function MyJobsPage() {
  const { employee, isLoading: empLoading } = useEmployee();
  const [assignments, setAssignments] = useState<JobAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crew/my-jobs');
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (employee) fetchJobs();
  }, [employee, fetchJobs]);

  if (empLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const activeJobs = assignments.filter((a) => a.status === 'accepted' || a.status === 'in_progress');
  const completedJobs = assignments.filter((a) => a.status === 'completed');
  const todayJobs = activeJobs.filter((a) => a.orders?.scheduled_date === today);
  const upcomingJobs = activeJobs.filter((a) => a.orders?.scheduled_date !== today);

  const displayJobs = tab === 'active' ? activeJobs : completedJobs;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: brand.text }}>My Jobs</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>Track your accepted and completed jobs.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: brand.border }}>
        {[
          { key: 'active' as Tab, label: `Active (${activeJobs.length})` },
          { key: 'completed' as Tab, label: `Completed (${completedJobs.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
            style={{
              borderBottomColor: tab === t.key ? brand.primary : 'transparent',
              color: tab === t.key ? brand.primary : brand.muted,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${glass} rounded-2xl p-5 animate-pulse`}>
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : displayJobs.length === 0 ? (
        <div className={`${glass} rounded-2xl p-10 text-center`}>
          <p className="font-medium" style={{ color: brand.text }}>
            {tab === 'active' ? 'No active jobs' : 'No completed jobs yet'}
          </p>
          <p className="text-sm mt-1" style={{ color: brand.muted }}>
            {tab === 'active' ? 'Accept jobs from the Available Jobs page to get started.' : 'Complete your first job to see it here.'}
          </p>
          {tab === 'active' && (
            <Link
              href="/crew/jobs"
              className="inline-block mt-4 px-4 py-2 rounded-lg text-sm text-white"
              style={{ background: brand.primary }}
            >
              Browse Available Jobs
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {tab === 'active' && todayJobs.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: brand.muted }}>
                Today
              </h2>
              <div className="space-y-3">
                {todayJobs.map((a) => (
                  <JobCard key={a.id} assignment={a} />
                ))}
              </div>
            </div>
          )}

          {tab === 'active' && upcomingJobs.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: brand.muted }}>
                Upcoming
              </h2>
              <div className="space-y-3">
                {upcomingJobs.map((a) => (
                  <JobCard key={a.id} assignment={a} />
                ))}
              </div>
            </div>
          )}

          {tab === 'completed' && (
            <div className="space-y-3">
              {completedJobs.map((a) => (
                <JobCard key={a.id} assignment={a} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function JobCard({ assignment }: { assignment: JobAssignment }) {
  const order = assignment.orders;
  if (!order) return null;
  const serviceLabel = SERVICE_TYPE_LABELS[order.service_type as ServiceType] || order.service_type;
  const statusLabel = ASSIGNMENT_STATUS_LABELS[assignment.status as AssignmentStatus] || assignment.status;
  const statusColor = ASSIGNMENT_STATUS_COLORS[assignment.status as AssignmentStatus] || 'bg-slate-100 text-slate-800';

  return (
    <Link
      href={`/crew/jobs/${assignment.id}`}
      className={`block ${glass} rounded-2xl p-5 transition-transform hover:scale-[1.005]`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ background: 'rgba(15,61,46,0.1)', color: brand.primary }}
            >
              {serviceLabel}
            </span>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
              {statusLabel}
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
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold" style={{ color: brand.primary }}>
            ${order.final_price.toFixed(2)}
          </p>
        </div>
      </div>
    </Link>
  );
}
