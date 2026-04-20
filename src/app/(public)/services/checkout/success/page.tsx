'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { trackPaymentCompleted } from '@/lib/analytics/conversions';

type OrderDetails = {
  id: string;
  customer_name: string;
  service_label: string;
  context: string;
  final_price: number;
  status: string;
};

function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function OrderSummaryCard({ order }: { order: OrderDetails }) {
  const contextLabel = order.context === 'commercial' ? 'Commercial' : 'Residential';
  return (
    <div className="bg-white/60 backdrop-blur rounded-2xl p-6 border border-slate-200/50 mb-6 text-left">
      <p className="text-sm font-medium text-slate-700 mb-3">Payment summary</p>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Customer</span>
          <span className="font-medium text-slate-800">{order.customer_name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Service</span>
          <span className="font-medium text-slate-800">{contextLabel} {order.service_label}</span>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-2 mt-2">
          <span className="text-slate-500">Amount paid</span>
          <span className="font-semibold text-emerald-700">{formatAUD(order.final_price)}</span>
        </div>
      </div>
    </div>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id') ?? null;
  const quoteId = searchParams?.get('quote_id') ?? null;

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(!!sessionId);
  const conversionFiredRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/orders/by-session?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setOrder(data);
          if (!conversionFiredRef.current) {
            conversionFiredRef.current = true;
            trackPaymentCompleted(data.final_price ?? 0);
          }
        }
      })
      .catch(() => null)
      .finally(() => setLoadingOrder(false));
  }, [sessionId]);

  const paymentCompleted = !!sessionId;
  const quoteSubmitted = !!quoteId && !paymentCompleted;
  const reference = order?.id || quoteId || sessionId;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div
          className={`w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center ${
            paymentCompleted ? 'bg-emerald-100' : 'bg-blue-100'
          }`}
        >
          {paymentCompleted ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 8v5m0 4h.01" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="9" stroke="#1d4ed8" strokeWidth="2" />
            </svg>
          )}
        </div>

        <h1 className="text-2xl font-semibold text-slate-800 mb-3">
          {paymentCompleted ? 'Payment confirmed' : "We've got your quote — nice one!"}
        </h1>

        <p className="text-slate-600 mb-6">
          {paymentCompleted
            ? 'Your payment has been received. Our team will confirm schedule details shortly.'
            : "We'll review your details and email you a payment link within 2–4 business hours on weekdays. Check the inbox you provided."}
        </p>

        {loadingOrder && (
          <div className="bg-white/60 backdrop-blur rounded-2xl p-6 border border-slate-200/50 mb-6 animate-pulse text-left">
            <div className="h-4 w-28 bg-slate-200 rounded mb-4" />
            <div className="space-y-3">
              <div className="h-3 w-40 bg-slate-200 rounded" />
              <div className="h-3 w-36 bg-slate-200 rounded" />
              <div className="h-3 w-28 bg-slate-200 rounded" />
            </div>
          </div>
        )}

        {!loadingOrder && paymentCompleted && order && <OrderSummaryCard order={order} />}

        {quoteSubmitted && (
          <div className="bg-white/60 backdrop-blur rounded-2xl p-6 border border-slate-200/50 mb-4 text-left">
            <p className="text-sm font-medium text-slate-700 mb-2">What happens next</p>
            <ul className="text-sm text-slate-600 space-y-2">
              <li>1. Our team reviews your scope and submitted total.</li>
              <li>2. Any adjustments are finalized in your dashboard.</li>
              <li>3. You receive a payment-ready quote once approved.</li>
            </ul>
          </div>
        )}

        {quoteSubmitted && (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-4">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Check your inbox — confirmation is on its way
          </div>
        )}

        {reference && (
          <p className="text-xs text-slate-400 mb-4">
            Reference: {reference.slice(0, 8).toUpperCase()}
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <a
            href="/services"
            className="inline-block px-6 py-2.5 rounded-2xl text-sm text-white"
            style={{ background: 'var(--accent, #166534)' }}
          >
            Back to services
          </a>
          {quoteSubmitted && (
            <a
              href="/portal/payments"
              className="inline-block px-6 py-2.5 rounded-2xl text-sm border border-slate-300 text-slate-700 bg-white/80"
            >
              View payment status
            </a>
          )}
        </div>

        {paymentCompleted && (
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-5 text-center">
            <p className="text-sm font-semibold text-amber-900 mb-1">Loving Buds At Work?</p>
            <p className="text-xs text-amber-700 mb-3">
              A quick Google review helps us reach more locals — it only takes 30 seconds.
            </p>
            <a
              href="https://g.page/r/CYTORrk6H3xmEAI/review"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: '#0f3d2e' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Leave a Google review
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-slate-500">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
