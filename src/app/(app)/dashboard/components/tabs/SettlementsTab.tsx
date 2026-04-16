'use client';

/**
 * SettlementsTab
 * --------------
 * Shows Stripe payouts to the NAB business bank account.
 * Populated by payout.created / payout.paid / payout.failed webhook events.
 * Stripe settles on a T+2 rolling basis (business days).
 */

import type { PayoutRecord } from '@/types/dashboard';

type Props = {
  payouts: PayoutRecord[];
  isLoading: boolean;
};

const STATUS_STYLES: Record<PayoutRecord['status'], { bg: string; text: string; label: string }> = {
  pending:  { bg: 'bg-amber-100',   text: 'text-amber-700',   label: 'Pending' },
  paid:     { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Paid to NAB' },
  failed:   { bg: 'bg-red-100',     text: 'text-red-700',     label: 'Failed' },
  canceled: { bg: 'bg-slate-100',   text: 'text-slate-600',   label: 'Cancelled' },
};

function formatAUD(amount: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SettlementsTab({ payouts, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const pendingTotal = payouts
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      {pendingTotal > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <span className="text-amber-600 text-sm font-medium">
            {formatAUD(pendingTotal)} in transit to NAB
          </span>
          <span className="text-amber-500 text-xs">
            · Stripe settles on a T+2 rolling schedule (business days)
          </span>
        </div>
      )}

      {/* Payout list */}
      {payouts.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">No payouts recorded yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Stripe payouts to your NAB account will appear here once your first settlement is
            initiated. Stripe typically settles on a T+2 rolling basis (business days).
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden">
          {payouts.map(payout => {
            const style = STATUS_STYLES[payout.status] ?? STATUS_STYLES.pending;
            return (
              <div key={payout.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {formatAUD(payout.amount)}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold leading-none ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 truncate">
                    {payout.status === 'paid'
                      ? `Arrived in NAB · ${formatDate(payout.arrival_date)}`
                      : payout.status === 'pending'
                        ? `Expected · ${formatDate(payout.arrival_date)}`
                        : payout.status === 'failed'
                          ? `Failed · ${payout.failure_message ?? 'Contact Stripe support'}`
                          : `Cancelled · ${formatDate(payout.created_at)}`}
                  </span>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap ml-4">
                  {formatDate(payout.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Payouts are automatically created by Stripe and tracked via webhooks.
        To add <code className="font-mono">payout.*</code> events, go to Stripe → Developers → Webhooks and enable them on your endpoint.
      </p>
    </div>
  );
}
