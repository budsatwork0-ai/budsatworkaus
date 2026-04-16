'use client';

/**
 * TriageStrip
 * -----------
 * A compact, always-visible strip that surfaces items needing immediate admin
 * attention — sourced from live API calls + already-fetched dashboard metrics.
 * Each pill is clickable and jumps to the relevant tab.
 *
 * Obsidian Operations note — Morning Admin Checklist maps directly to these:
 *   - Open Dispatch tab → confirm all jobs have crew assigned (pendingOrders)
 *   - Review notification bell — pending quotes or new applicants (newApplicants)
 *   - Overdue invoices / due this week (from metrics.alerts)
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/dashboard/utils';
import type { DashboardMetrics, TabKey } from '@/types/dashboard';

type TriageStripProps = {
  metrics: DashboardMetrics | null;
  isLoading: boolean;
  onTabChange: (tab: TabKey) => void;
};

type TriagePill = {
  key: string;
  label: string;
  count: number | null;
  amount?: number;
  tab: TabKey;
  urgency: 'high' | 'medium' | 'low' | 'clear';
};

const URGENCY_STYLES: Record<TriagePill['urgency'], { pill: string; dot: string }> = {
  high:   { pill: 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100',    dot: 'bg-red-400 animate-pulse' },
  medium: { pill: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100', dot: 'bg-amber-400 animate-pulse' },
  low:    { pill: 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100',    dot: 'bg-sky-400' },
  clear:  { pill: 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100', dot: 'bg-slate-300' },
};

export default function TriageStrip({ metrics, isLoading, onTabChange }: TriageStripProps) {
  const [pendingOrders, setPendingOrders] = useState<number | null>(null);
  const [newApplicants, setNewApplicants] = useState<number | null>(null);

  useEffect(() => {
    // Pending orders awaiting dispatch
    fetch('/api/orders?status=pending&limit=50')
      .then((r) => r.json())
      .then((data) => setPendingOrders((data.orders ?? []).length))
      .catch(() => setPendingOrders(0));

    // New crew applicants (exclude community roles)
    fetch('/api/applicants?stage=intake&limit=50')
      .then((r) => r.json())
      .then((data) => {
        const communityRoles = new Set(['Quality partner', 'Sponsor', 'Innovation partner']);
        const crew = (data.applicants ?? []).filter(
          (a: { role: string }) => !communityRoles.has(a.role)
        );
        setNewApplicants(crew.length);
      })
      .catch(() => setNewApplicants(0));
  }, []);

  const overdueCount = metrics?.alerts.overdueCount ?? null;
  const overdueAmount = metrics?.alerts.overdueAmount ?? 0;
  const dueSoonCount = metrics?.alerts.dueSoonCount ?? null;
  const dueSoonAmount = metrics?.alerts.dueSoonAmount ?? 0;

  const pills: TriagePill[] = [
    {
      key: 'dispatch',
      label: 'pending dispatch',
      count: pendingOrders,
      tab: 'today',
      urgency: (pendingOrders ?? 0) > 0 ? 'medium' : 'clear',
    },
    {
      key: 'overdue',
      label: 'overdue invoice',
      count: overdueCount,
      amount: overdueAmount,
      tab: 'money',
      urgency: (overdueCount ?? 0) > 0 ? 'high' : 'clear',
    },
    {
      key: 'due-soon',
      label: 'due this week',
      count: dueSoonCount,
      amount: dueSoonAmount,
      tab: 'money',
      urgency: (dueSoonCount ?? 0) > 0 ? 'low' : 'clear',
    },
    {
      key: 'applicants',
      label: 'new applicant',
      count: newApplicants,
      tab: 'today',
      urgency: (newApplicants ?? 0) > 0 ? 'low' : 'clear',
    },
  ];

  const urgentPills = pills.filter((p) => p.urgency !== 'clear');

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Triage</span>
        {[28, 36, 32, 30].map((w) => (
          <div key={w} className={`h-6 w-${w} rounded-full bg-slate-100 animate-pulse`} style={{ width: `${w * 4}px` }} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
        {urgentPills.length > 0 ? 'Needs attention' : 'All clear'}
      </span>

      {pills.map((pill, i) => {
        const style = URGENCY_STYLES[pill.urgency];
        const count = pill.count;
        const label = count === 1 ? pill.label : `${pill.label}s`;

        return (
          <motion.button
            key={pill.key}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => onTabChange(pill.tab)}
            title={`Jump to ${pill.tab} tab`}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-all cursor-pointer select-none ${style.pill}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
            <span>
              {count !== null ? <strong>{count}</strong> : '…'}{' '}
              {label}
            </span>
            {pill.amount !== undefined && pill.amount > 0 && (
              <span className="opacity-60">· {formatCurrency(pill.amount)}</span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
