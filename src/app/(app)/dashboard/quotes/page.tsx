'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';
import { FREQUENCY_LABELS, SERVICE_TYPE_LABELS } from '@/types/orders';

type QuoteStatus =
  | 'submitted'
  | 'in_review'
  | 'finalized'
  | 'payment_pending'
  | 'paid'
  | 'denied';

type Quote = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  service_type: string;
  context: string;
  scope: string | null;
  frequency: string;
  total: number;
  submitted_total: number;
  reviewed_total: number | null;
  status: QuoteStatus;
  payment_status: string;
  payment_requested_at: string | null;
  paid_at: string | null;
  finalized_at: string | null;
  notes: string | null;
  converted_order_id: string | null;
  created_at: string;
};

function normalizeStatus(rawStatus: string): QuoteStatus {
  if (rawStatus === 'pending') return 'submitted';
  if (rawStatus === 'approved') return 'finalized';
  if (rawStatus === 'adjusted') return 'in_review';
  if (rawStatus === 'converted') return 'paid';
  if (rawStatus === 'submitted' || rawStatus === 'in_review' || rawStatus === 'finalized' || rawStatus === 'payment_pending' || rawStatus === 'paid' || rawStatus === 'denied') {
    return rawStatus;
  }
  return 'submitted';
}

const STATUS_LABELS: Record<QuoteStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In review',
  finalized: 'Finalized',
  payment_pending: 'Payment pending',
  paid: 'Paid',
  denied: 'Denied',
};

const STATUS_CLASS: Record<QuoteStatus, string> = {
  submitted: 'bg-slate-100 text-slate-700',
  in_review: 'bg-amber-100 text-amber-800',
  finalized: 'bg-indigo-100 text-indigo-800',
  payment_pending: 'bg-blue-100 text-blue-800',
  paid: 'bg-emerald-100 text-emerald-800',
  denied: 'bg-rose-100 text-rose-700',
};

function toCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function toDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustModal, setAdjustModal] = useState<Quote | null>(null);
  const [adjustPrice, setAdjustPrice] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quotes?limit=200');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load quotes');
      setQuotes(
        (data.quotes || []).map((quote: Quote) => ({
          ...quote,
          status: normalizeStatus(quote.status),
        }))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const updateQuote = useCallback(async (id: string, updates: Record<string, unknown>) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update quote');
      const normalized = {
        ...(data.quote as Quote),
        status: normalizeStatus((data.quote as Quote).status),
      };
      setQuotes((prev) => prev.map((q) => (q.id === id ? normalized : q)));
      return normalized;
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const requestPayment = useCallback(async (quote: Quote) => {
    setActionLoadingId(quote.id);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/checkout`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create payment session');
      await fetchQuotes();
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create payment link');
    } finally {
      setActionLoadingId(null);
    }
  }, [fetchQuotes]);

  const handleAdjust = useCallback(async () => {
    if (!adjustModal) return;
    const reviewed = Number(adjustPrice);
    if (!Number.isFinite(reviewed) || reviewed <= 0) {
      toast.error('Please enter a valid adjusted total');
      return;
    }

    try {
      await updateQuote(adjustModal.id, {
        reviewed_total: reviewed,
        status: 'in_review',
      });
      toast.success('Quote adjusted');
      setAdjustModal(null);
      setAdjustPrice('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to adjust quote');
    }
  }, [adjustModal, adjustPrice, updateQuote]);

  const grouped = useMemo(() => {
    const review = quotes.filter((q) => q.status === 'submitted' || q.status === 'in_review');
    const ready = quotes.filter((q) => q.status === 'finalized' || q.status === 'payment_pending');
    const closed = quotes.filter((q) => q.status === 'paid' || q.status === 'denied');
    return { review, ready, closed };
  }, [quotes]);

  return (
    <main className="max-w-6xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: brand.primary }}>Quote Finalization</h1>
          <p className="text-sm text-slate-500">
            Submitted pricing is preserved. Finalize reviewed totals before requesting payment.
          </p>
        </div>
        <button
          onClick={fetchQuotes}
          className="px-3 py-2 rounded-lg text-xs border"
          style={{ borderColor: brand.border, color: brand.muted }}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => <div key={n} className="h-24 rounded-2xl bg-white/60 animate-pulse" />)}
        </div>
      ) : (
        <>
          <Section
            title={`Needs Review (${grouped.review.length})`}
            subtitle="Adjust totals as needed, then finalize."
            quotes={grouped.review}
            actionLoadingId={actionLoadingId}
            onAdjust={(quote) => {
              setAdjustModal(quote);
              setAdjustPrice(String(quote.reviewed_total ?? quote.submitted_total ?? quote.total));
            }}
            onStartReview={(quote) => updateQuote(quote.id, { status: 'in_review' })}
            onFinalize={(quote) =>
              updateQuote(quote.id, {
                status: 'finalized',
                reviewed_total: quote.reviewed_total ?? quote.submitted_total ?? quote.total,
              })
            }
            onDeny={(quote) => updateQuote(quote.id, { status: 'denied' })}
            onRequestPayment={requestPayment}
          />

          <Section
            title={`Ready For Payment (${grouped.ready.length})`}
            subtitle="Checkout links are created only after finalization."
            quotes={grouped.ready}
            actionLoadingId={actionLoadingId}
            onAdjust={(quote) => {
              setAdjustModal(quote);
              setAdjustPrice(String(quote.reviewed_total ?? quote.submitted_total ?? quote.total));
            }}
            onStartReview={(quote) => updateQuote(quote.id, { status: 'in_review' })}
            onFinalize={(quote) => updateQuote(quote.id, { status: 'finalized' })}
            onDeny={(quote) => updateQuote(quote.id, { status: 'denied' })}
            onRequestPayment={requestPayment}
          />

          <Section
            title={`Closed (${grouped.closed.length})`}
            subtitle="Paid and denied outcomes."
            quotes={grouped.closed}
            actionLoadingId={actionLoadingId}
            onAdjust={(quote) => {
              setAdjustModal(quote);
              setAdjustPrice(String(quote.reviewed_total ?? quote.submitted_total ?? quote.total));
            }}
            onStartReview={(quote) => updateQuote(quote.id, { status: 'in_review' })}
            onFinalize={(quote) => updateQuote(quote.id, { status: 'finalized' })}
            onDeny={(quote) => updateQuote(quote.id, { status: 'denied' })}
            onRequestPayment={requestPayment}
          />
        </>
      )}

      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/35" onClick={() => setAdjustModal(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6"
          >
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Adjust reviewed total</h2>
            <p className="text-sm text-slate-600 mb-3">
              Submitted total: {toCurrency(adjustModal.submitted_total)}
            </p>
            <input
              type="number"
              min="0"
              step="0.01"
              value={adjustPrice}
              onChange={(e) => setAdjustPrice(e.target.value)}
              className="w-full rounded-xl border px-4 py-2.5 text-sm mb-4"
              style={{ borderColor: brand.border }}
              placeholder="Reviewed total"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setAdjustModal(null)}
                className="flex-1 px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdjust}
                className="flex-1 px-4 py-2 text-sm rounded-lg text-white"
                style={{ background: brand.primary }}
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}

function Section({
  title,
  subtitle,
  quotes,
  actionLoadingId,
  onAdjust,
  onStartReview,
  onFinalize,
  onDeny,
  onRequestPayment,
}: {
  title: string;
  subtitle: string;
  quotes: Quote[];
  actionLoadingId: string | null;
  onAdjust: (quote: Quote) => void;
  onStartReview: (quote: Quote) => void;
  onFinalize: (quote: Quote) => void;
  onDeny: (quote: Quote) => void;
  onRequestPayment: (quote: Quote) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>

      {quotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 px-4 py-6 text-sm text-slate-500">
          No quotes in this stage.
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => {
            const effective = q.reviewed_total ?? q.submitted_total ?? q.total;
            const loading = actionLoadingId === q.id;
            return (
              <div
                key={q.id}
                className="rounded-2xl border border-black/10 bg-white/85 backdrop-blur p-4 shadow-sm"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{q.customer_name}</div>
                    <div className="text-sm text-slate-600">
                      {SERVICE_TYPE_LABELS[q.service_type as keyof typeof SERVICE_TYPE_LABELS] || q.service_type}
                      {' · '}
                      {q.context}
                      {q.frequency !== 'none' && (
                        <span className="ml-2 inline-flex text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {FREQUENCY_LABELS[q.frequency as keyof typeof FREQUENCY_LABELS] || q.frequency}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Submitted {toDate(q.created_at)}{q.customer_email ? ` · ${q.customer_email}` : ''}
                    </div>
                    {q.notes && <div className="text-xs text-slate-500 mt-1 italic">{q.notes}</div>}
                  </div>

                  <div className="flex flex-col md:items-end gap-1">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[q.status]}`}>
                      {STATUS_LABELS[q.status]}
                    </span>
                    <div className="text-xs text-slate-500">Submitted: {toCurrency(q.submitted_total)}</div>
                    <div className="text-sm font-semibold text-slate-900">
                      Final: {toCurrency(effective)}
                    </div>
                    {q.status === 'paid' && q.paid_at && (
                      <div className="text-xs text-emerald-700">Paid {toDate(q.paid_at)}</div>
                    )}
                    {q.status === 'payment_pending' && q.payment_requested_at && (
                      <div className="text-xs text-blue-700">Requested {toDate(q.payment_requested_at)}</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {(q.status === 'submitted' || q.status === 'in_review' || q.status === 'finalized') && (
                    <button
                      onClick={() => onAdjust(q)}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs rounded-lg bg-yellow-100 text-yellow-800 hover:bg-yellow-200 disabled:opacity-60"
                    >
                      Adjust
                    </button>
                  )}

                  {q.status === 'submitted' && (
                    <button
                      onClick={() => onStartReview(q)}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                    >
                      Start review
                    </button>
                  )}

                  {(q.status === 'submitted' || q.status === 'in_review') && (
                    <button
                      onClick={() => onFinalize(q)}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs rounded-lg bg-indigo-100 text-indigo-800 hover:bg-indigo-200 disabled:opacity-60"
                    >
                      Finalize
                    </button>
                  )}

                  {(q.status === 'finalized' || q.status === 'payment_pending') && (
                    <button
                      onClick={() => onRequestPayment(q)}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs rounded-lg text-white disabled:opacity-60"
                      style={{ background: brand.primary }}
                    >
                      {q.status === 'payment_pending' ? 'Resend payment link' : 'Request payment'}
                    </button>
                  )}

                  {(q.status === 'submitted' || q.status === 'in_review' || q.status === 'finalized') && (
                    <button
                      onClick={() => onDeny(q)}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-60"
                    >
                      Deny
                    </button>
                  )}

                  {q.status === 'paid' && q.converted_order_id && (
                    <span className="px-3 py-1.5 text-xs rounded-lg bg-emerald-50 text-emerald-700">
                      Order {q.converted_order_id.slice(0, 8).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
