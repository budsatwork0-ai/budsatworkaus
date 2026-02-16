'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

type OrderDetails = {
  id: string;
  customer_name: string;
  service_label: string;
  context: string;
  final_price: number;
  status: string;
};

function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function OrderSummaryCard({ order }: { order: OrderDetails }) {
  const contextLabel = order.context === 'commercial' ? 'Commercial' : 'Residential';
  return (
    <div className="bg-white/60 backdrop-blur rounded-2xl p-6 border border-slate-200/50 mb-6 text-left">
      <p className="text-sm font-medium text-slate-700 mb-3">Booking summary</p>
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

function OrderSummarySkeleton() {
  return (
    <div className="bg-white/60 backdrop-blur rounded-2xl p-6 border border-slate-200/50 mb-6 animate-pulse">
      <div className="h-4 w-28 bg-slate-200 rounded mb-4" />
      <div className="space-y-3">
        <div className="flex justify-between">
          <div className="h-3 w-20 bg-slate-100 rounded" />
          <div className="h-3 w-32 bg-slate-200 rounded" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-16 bg-slate-100 rounded" />
          <div className="h-3 w-40 bg-slate-200 rounded" />
        </div>
        <div className="flex justify-between pt-2 border-t border-slate-100">
          <div className="h-3 w-24 bg-slate-100 rounded" />
          <div className="h-3 w-20 bg-slate-200 rounded" />
        </div>
      </div>
    </div>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id') ?? null;
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(!!sessionId);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/orders/by-session?session_id=${encodeURIComponent(sessionId)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setOrder(data); })
      .catch(() => null)
      .finally(() => setLoadingOrder(false));
  }, [sessionId]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 6L9 17l-5-5"
              stroke="#059669"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-slate-800 mb-3">
          Booking confirmed!
        </h1>
        <p className="text-slate-600 mb-6">
          Your payment has been received. We&apos;ll be in touch shortly to
          confirm your service date and time.
        </p>

        {loadingOrder && <OrderSummarySkeleton />}
        {!loadingOrder && order && <OrderSummaryCard order={order} />}
        {!loadingOrder && !order && (
          <div className="bg-white/60 backdrop-blur rounded-2xl p-6 border border-slate-200/50 mb-6 text-left">
            <p className="text-sm font-medium text-slate-700 mb-3">What happens next?</p>
            <ul className="text-sm text-slate-600 space-y-2">
              <li className="flex gap-2">
                <span className="text-emerald-600 font-medium">1.</span>
                You&apos;ll receive a confirmation email with your receipt
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600 font-medium">2.</span>
                Our team will contact you within 24 hours to schedule
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600 font-medium">3.</span>
                A reminder will be sent before your service date
              </li>
            </ul>
          </div>
        )}

        {order && (
          <div className="bg-white/60 backdrop-blur rounded-2xl p-5 border border-slate-200/50 mb-6 text-left">
            <p className="text-sm font-medium text-slate-700 mb-2">What happens next?</p>
            <ul className="text-sm text-slate-600 space-y-2">
              <li className="flex gap-2">
                <span className="text-emerald-600 font-medium">1.</span>
                Check your email for a receipt confirmation
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600 font-medium">2.</span>
                Our team will contact you within 24 hours to schedule
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600 font-medium">3.</span>
                A reminder will be sent before your service date
              </li>
            </ul>
          </div>
        )}

        {order && (
          <p className="text-xs text-slate-400 mb-4">
            Reference: {order.id.slice(0, 8).toUpperCase()}
          </p>
        )}
        {!order && sessionId && (
          <p className="text-xs text-slate-400 mb-4">
            Reference: {sessionId.slice(0, 20)}...
          </p>
        )}

        <a
          href="/services"
          className="inline-block px-6 py-2.5 rounded-2xl text-sm text-white"
          style={{ background: 'var(--accent, #166534)' }}
        >
          Back to services
        </a>
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
