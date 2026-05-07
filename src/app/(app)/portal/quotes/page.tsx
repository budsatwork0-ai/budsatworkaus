'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { brand } from '@/app/ui/theme';

type Quote = {
  id: string;
  service_type: string;
  context: string;
  submitted_total: number;
  reviewed_total: number | null;
  status: string;
  payment_status: string;
  notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  finalized_at: string | null;
  stripe_checkout_session_id: string | null;
};

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/[0.08] shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  submitted: {
    label: 'Submitted',
    color: '#4F46E5',
    bg: '#EEF2FF',
    desc: "We've received your quote request and will review it shortly.",
  },
  in_review: {
    label: 'Under Review',
    color: '#D97706',
    bg: '#FFFBEB',
    desc: "Our team is reviewing your quote. We'll confirm the final price soon.",
  },
  finalized: {
    label: 'Ready to Pay',
    color: brand.primary,
    bg: '#ECFDF5',
    desc: 'Your quote has been confirmed. Review the details below and proceed to payment.',
  },
  payment_pending: {
    label: 'Payment Pending',
    color: '#D97706',
    bg: '#FFFBEB',
    desc: 'Your payment is being processed.',
  },
  paid: {
    label: 'Paid',
    color: '#059669',
    bg: '#ECFDF5',
    desc: 'Payment received. Your service is confirmed!',
  },
  denied: {
    label: 'Declined',
    color: '#DC2626',
    bg: '#FEF2F2',
    desc: "We couldn't proceed with this quote. Contact us for alternatives.",
  },
  cancelled: {
    label: 'Cancelled',
    color: '#C2410C',
    bg: '#FFF7ED',
    desc: 'This approved quote was cancelled and is no longer available for payment.',
  },
};

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home Cleaning',
  yard: 'Yard Care',
  dump: 'Dump Run',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneakers',
};

const SERVICE_ICONS: Record<string, string> = {
  windows: '🪟',
  cleaning: '🧹',
  yard: '🌿',
  dump: '🚛',
  auto: '🚗',
  laundry_sneakers: '👟',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Confirmation modal ──────────────────────────────────────────────────────

function PayConfirmModal({
  quote,
  onConfirm,
  onClose,
  loading,
}: {
  quote: Quote;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const finalAmount = quote.reviewed_total!;
  const priceChanged = Math.abs(finalAmount - quote.submitted_total) > 0.01;
  const priceUp = finalAmount > quote.submitted_total;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-modal-title"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-black/[0.06]">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{ background: 'rgba(15,61,46,0.07)' }}
            >
              {SERVICE_ICONS[quote.service_type] || '📋'}
            </div>
            <div>
              <h2 id="pay-modal-title" className="text-lg font-bold" style={{ color: brand.text }}>
                Confirm your payment
              </h2>
              <p className="text-sm mt-0.5" style={{ color: brand.muted }}>
                {SERVICE_LABELS[quote.service_type] || quote.service_type} ·{' '}
                {quote.context === 'commercial' ? 'Commercial' : 'Home'}
              </p>
            </div>
          </div>
        </div>

        {/* Price comparison */}
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
              <p className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: brand.muted }}>
                Your Estimate
              </p>
              <p className="text-xl font-bold" style={{ color: brand.text }}>
                {fmt(quote.submitted_total)}
              </p>
            </div>
            <div
              className="p-4 rounded-xl border"
              style={{
                borderColor: priceChanged ? (priceUp ? 'rgba(251,191,36,0.5)' : 'rgba(16,185,129,0.4)') : 'rgba(0,0,0,0.07)',
                background: priceChanged ? (priceUp ? 'rgba(251,191,36,0.05)' : 'rgba(16,185,129,0.05)') : '#F0FDF9',
              }}
            >
              <p className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: brand.muted }}>
                Final Price
              </p>
              <p className="text-xl font-bold" style={{ color: brand.primary }}>
                {fmt(finalAmount)}
              </p>
            </div>
          </div>

          {/* Price change callout */}
          {priceChanged && (
            <div
              className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
              style={{
                background: priceUp ? '#FFFBEB' : '#ECFDF5',
                color: priceUp ? '#92400E' : '#065F46',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
              </svg>
              <span>
                {priceUp
                  ? `Our team adjusted the price up by ${fmt(finalAmount - quote.submitted_total)} based on the scope of your job.`
                  : `Great news — our team reduced the price by ${fmt(quote.submitted_total - finalAmount)}.`}
              </span>
            </div>
          )}

          {/* Team notes */}
          {quote.notes && (
            <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(0,0,0,0.03)', color: brand.muted }}>
              <span className="text-[11px] uppercase tracking-wider font-semibold block mb-1" style={{ color: brand.text }}>
                Note from team
              </span>
              {quote.notes}
            </div>
          )}

          {/* Stripe trust line */}
          <div className="flex items-center gap-2 text-[11px]" style={{ color: brand.muted }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            Powered by Stripe. Your card details are never stored on our servers.
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col gap-3">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background: brand.primary }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin border-white" />
                Taking you to payment…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" />
                </svg>
                Confirm & Pay {fmt(finalAmount)}
              </>
            )}
          </button>
          <div className="flex items-center justify-between text-xs" style={{ color: brand.muted }}>
            <button onClick={onClose} className="hover:underline">
              Cancel
            </button>
            <Link href="/contact" className="hover:underline">
              Something&apos;s not right? Contact us
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function PortalQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingQuote, setConfirmingQuote] = useState<Quote | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newBanner, setNewBanner] = useState(false);
  const bannerCleared = useRef(false);

  useEffect(() => {
    if (bannerCleared.current) return;
    if (new URLSearchParams(window.location.search).get('new')) {
      bannerCleared.current = true;
      setNewBanner(true);
      const t = setTimeout(() => setNewBanner(false), 8000);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    fetch('/api/quotes')
      .then((r) => r.json())
      .then((d) => setQuotes(d.quotes || []))
      .catch(() => setError('Could not load quotes.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleConfirmPay() {
    if (!confirmingQuote) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/quotes/${confirmingQuote.id}/checkout`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.checkoutUrl || data.url) {
        window.location.href = data.checkoutUrl ?? data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setConfirmingQuote(null);
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Confirmation modal */}
      <AnimatePresence>
        {confirmingQuote && (
          <PayConfirmModal
            quote={confirmingQuote}
            onConfirm={handleConfirmPay}
            onClose={() => !paying && setConfirmingQuote(null)}
            loading={paying}
          />
        )}
      </AnimatePresence>

      {/* New quote success banner */}
      <AnimatePresence>
        {newBanner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex items-start gap-3 rounded-2xl px-5 py-4 text-sm"
            style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46' }}
            role="status"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold">Quote submitted — nice one!</p>
              <p className="text-xs mt-0.5 opacity-80">We'll review the details and email you a payment link within 2–4 business hours. You can track progress right here.</p>
            </div>
            <button
              type="button"
              onClick={() => setNewBanner(false)}
              className="text-emerald-600 hover:text-emerald-800 transition-colors ml-1 shrink-0"
              aria-label="Dismiss"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: brand.primary }}>
            My Quotes
          </h1>
          <p className="text-sm mt-1" style={{ color: brand.muted }}>
            Track your service requests from submission to payment.
          </p>
        </div>
        <Link
          href="/services"
          className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all active:scale-95"
          style={{ background: brand.primary }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Quote
        </Link>
      </div>

      {/* How it works */}
      <div className={`${glass} p-5`}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: brand.muted }}>
          How it works
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { step: '1', label: 'You submit', desc: 'Your estimated cost is locked in at submission.' },
            { step: '2', label: 'We review', desc: 'Our team confirms the scope and final price.' },
            { step: '3', label: 'You approve', desc: 'Review the final quote and confirm before paying.' },
            { step: '4', label: 'Job booked', desc: 'Secure Stripe payment confirms your booking.' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: brand.primary }}
              >
                {item.step}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: brand.text }}>{item.label}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: brand.muted }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`${glass} p-6`}>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-5 w-40 bg-slate-100 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-8 w-24 bg-slate-100 rounded-lg animate-pulse" />
              </div>
              <div className="mt-4 h-12 bg-slate-50 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && quotes.length === 0 && (
        <div className={`${glass} p-12 text-center`}>
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(15,61,46,0.08)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={brand.primary} strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 12h6M9 16h4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: brand.text }}>No quotes yet</h3>
          <p className="text-sm mb-6" style={{ color: brand.muted }}>
            Request your first service and get an estimate instantly.
          </p>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
            style={{ background: brand.primary }}
          >
            Book a Service
          </Link>
        </div>
      )}

      {/* Quote cards */}
      {!loading && quotes.length > 0 && (
        <div className="space-y-4">
          {quotes.map((quote, i) => {
            const cfg = STATUS_CONFIG[quote.status] || STATUS_CONFIG.submitted;
            const isFinalized = quote.status === 'finalized';
            const isPaid = quote.status === 'paid' || quote.payment_status === 'paid';
            const isPending = quote.status === 'payment_pending';
            const isCancelled = quote.status === 'cancelled';
            const priceChanged =
              quote.reviewed_total !== null &&
              Math.abs(quote.reviewed_total - quote.submitted_total) > 0.01;

            return (
              <motion.div
                key={quote.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={glass}
              >
                <div className="p-5 sm:p-6">
                  {/* Header row */}
                  <div className="flex items-start gap-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                      style={{ background: 'rgba(15,61,46,0.06)' }}
                    >
                      {SERVICE_ICONS[quote.service_type] || '📋'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold" style={{ color: brand.text }}>
                            {SERVICE_LABELS[quote.service_type] || quote.service_type}
                          </h3>
                          <p className="text-xs mt-0.5" style={{ color: brand.muted }}>
                            {quote.context === 'commercial' ? 'Commercial' : 'Home'} · Submitted {fmtDate(quote.created_at)}
                          </p>
                        </div>
                        <span
                          className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ color: cfg.color, background: cfg.bg }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status message */}
                  <div
                    className="mt-4 px-4 py-3 rounded-xl text-sm"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {cfg.desc}
                  </div>

                  {/* Pricing breakdown */}
                  <div className="mt-4 grid sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                      <p className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: brand.muted }}>
                        Your Estimate
                      </p>
                      <p className="text-xl font-bold" style={{ color: brand.text }}>
                        {fmt(quote.submitted_total)}
                      </p>
                      <p className="text-[11px] mt-0.5" style={{ color: brand.muted }}>Locked at submission</p>
                    </div>

                    {quote.reviewed_total !== null && (
                      <div
                        className="p-3 rounded-xl border"
                        style={{
                          borderColor: priceChanged ? 'rgba(251,191,36,0.4)' : 'rgba(0,0,0,0.06)',
                          background: priceChanged ? 'rgba(251,191,36,0.05)' : 'transparent',
                        }}
                      >
                        <p className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: brand.muted }}>
                          Confirmed Price
                        </p>
                        <p
                          className="text-xl font-bold"
                          style={{ color: isFinalized || isPaid ? brand.primary : brand.text }}
                        >
                          {fmt(quote.reviewed_total)}
                        </p>
                        {priceChanged && (
                          <p className="text-[11px] mt-0.5 font-medium" style={{ color: '#92400E' }}>
                            Adjusted by team
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {quote.notes && (
                    <div className="mt-3 p-3 rounded-xl text-sm" style={{ background: 'rgba(0,0,0,0.03)', color: brand.muted }}>
                      <span className="font-medium text-xs uppercase tracking-wider">Note from team: </span>
                      {quote.notes}
                    </div>
                  )}

                  {isCancelled && quote.cancellation_reason && (
                    <div className="mt-3 p-3 rounded-xl text-sm" style={{ background: '#FFF7ED', color: '#9A3412' }}>
                      <span className="font-medium text-xs uppercase tracking-wider">Cancellation reason: </span>
                      {quote.cancellation_reason}
                      {quote.cancelled_at ? ` · ${fmtDate(quote.cancelled_at)}` : ''}
                    </div>
                  )}

                  {/* Actions */}
                  {isFinalized && (
                    <div className="mt-4">
                      <button
                        onClick={() => setConfirmingQuote(quote)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                        style={{ background: brand.primary }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" />
                        </svg>
                        Review & Pay {fmt(quote.reviewed_total!)}
                      </button>
                      <p className="text-[11px] mt-2" style={{ color: brand.muted }}>
                        You&apos;ll confirm the details before any payment is taken.
                      </p>
                    </div>
                  )}

                  {isPaid && (
                    <div className="mt-4 flex items-center gap-2 text-sm font-medium" style={{ color: '#059669' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      Payment confirmed · Service booked
                    </div>
                  )}

                  {isPending && (
                    <div className="mt-4 flex items-center gap-2 text-sm" style={{ color: '#D97706' }}>
                      <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#D97706', borderTopColor: 'transparent' }} />
                      Payment in progress…
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Bottom CTA */}
      {!loading && quotes.length > 0 && (
        <div className={`${glass} p-5 flex items-center gap-4`}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: brand.text }}>Need another service?</p>
            <p className="text-xs mt-0.5" style={{ color: brand.muted }}>
              Get an instant estimate with our booking wizard.
            </p>
          </div>
          <Link
            href="/services"
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
            style={{ background: brand.primary }}
          >
            + New Quote
          </Link>
        </div>
      )}
    </div>
  );
}
