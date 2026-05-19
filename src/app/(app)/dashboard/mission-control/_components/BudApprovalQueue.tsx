'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { BudApprovalItem } from '@/lib/bud/types';

const RISK_BADGE: Record<string, string> = {
  low:      'text-emerald-600 bg-emerald-50 border-emerald-100',
  medium:   'text-amber-600 bg-amber-50 border-amber-100',
  high:     'text-orange-600 bg-orange-50 border-orange-100',
  critical: 'text-red-600 bg-red-50 border-red-100',
};

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

interface ApprovalWithTask extends BudApprovalItem {
  bud_tasks?: {
    description: string;
    source_agent: string | null;
    risk_level: string | null;
    confidence: number | null;
  } | null;
}

interface Props {
  initial: ApprovalWithTask[];
}

export function BudApprovalQueue({ initial }: Props) {
  const [items, setItems] = useState<ApprovalWithTask[]>(initial);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [confirmCritical, setConfirmCritical] = useState<string | null>(null);

  async function decide(item: ApprovalWithTask, decision: 'approved' | 'rejected') {
    const riskLevel = item.bud_tasks?.risk_level ?? 'low';

    // Extra confirmation for critical risk
    if (decision === 'approved' && riskLevel === 'critical') {
      if (confirmCritical !== item.id) {
        setConfirmCritical(item.id);
        return;
      }
    }
    setConfirmCritical(null);

    setBusy((prev) => new Set([...prev, item.id]));
    try {
      const res = await fetch('/api/bud/approval', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: item.id, decision }),
      });
      if (!res.ok) throw new Error('Failed');
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      toast.success(decision === 'approved' ? 'Bud approved — executing plan.' : 'Rejected.');
    } catch {
      toast.error('Could not update approval.');
    } finally {
      setBusy((prev) => { const n = new Set(prev); n.delete(item.id); return n; });
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-[11px] text-slate-400 px-4 py-3 italic">
        No pending approvals. Bud is operating autonomously.
      </p>
    );
  }

  return (
    <AnimatePresence>
      {items.map((item) => {
        const isBusy = busy.has(item.id);
        const task = item.bud_tasks;
        const riskLevel = task?.risk_level ?? 'low';
        const confidence = task?.confidence;
        const isCriticalPending = confirmCritical === item.id;

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
            className={`px-4 py-3.5 border-b border-black/[0.04] last:border-0 ${riskLevel === 'critical' ? 'bg-red-50/50' : ''}`}
          >
            <div className="flex items-start gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0 mt-1.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-900">
                  {task?.description ?? item.action_type}
                </p>
                {task?.source_agent && (
                  <p className="text-[10px] text-slate-500 mt-0.5">via {task.source_agent}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {riskLevel && (
                  <span className={`text-[9px] font-semibold border rounded-full px-1.5 py-0.5 ${RISK_BADGE[riskLevel] ?? RISK_BADGE.low}`}>
                    {riskLevel}
                  </span>
                )}
                {confidence !== null && confidence !== undefined && (
                  <span className="text-[9px] text-slate-400">{Math.round(confidence * 100)}% conf</span>
                )}
              </div>
            </div>

            <p className="text-[10px] text-slate-500 mb-2 pl-3.5 font-mono">{item.action_type}</p>
            <p className="text-[10px] text-slate-400 mb-2.5 pl-3.5">{relTime(item.created_at)}</p>

            {isCriticalPending && (
              <p className="text-[10px] text-red-600 font-medium mb-2 pl-3.5">
                This is a critical-risk action. Click Approve again to confirm.
              </p>
            )}

            <div className="flex items-center gap-1.5 pl-3.5">
              <button
                disabled={isBusy}
                onClick={() => decide(item, 'approved')}
                className="text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 disabled:opacity-40 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                {isBusy ? '…' : isCriticalPending ? 'Confirm approve' : 'Approve'}
              </button>
              <button
                disabled={isBusy}
                onClick={() => decide(item, 'rejected')}
                className="text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 disabled:opacity-40 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                {isBusy ? '…' : 'Reject'}
              </button>
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}
