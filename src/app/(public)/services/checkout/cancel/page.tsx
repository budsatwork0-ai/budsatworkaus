'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function CancelContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams?.get('order_id') ?? null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 9v4m0 4h.01"
              stroke="#d97706"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="10" stroke="#d97706" strokeWidth="2" fill="none" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-slate-800 mb-3">
          Payment cancelled
        </h1>
        <p className="text-slate-600 mb-6">
          No worries &mdash; your booking has not been charged. You can return to
          the quote builder anytime to complete your booking.
        </p>

        {orderId && (
          <div className="bg-white/60 backdrop-blur rounded-2xl p-4 border border-slate-200/50 mb-6 text-left">
            <p className="text-sm text-slate-600">
              If you&apos;d like to follow up or complete your booking by phone, quote reference:
            </p>
            <p className="font-mono text-sm font-semibold text-slate-800 mt-1">
              {orderId.slice(0, 8).toUpperCase()}
            </p>
          </div>
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

export default function CheckoutCancelPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-slate-500">Loading...</div>}>
      <CancelContent />
    </Suspense>
  );
}
