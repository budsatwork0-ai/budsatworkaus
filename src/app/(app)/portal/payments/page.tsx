'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';

type Order = {
  id: string;
  service_type: string;
  final_price: number;
  status: string;
  completed_at: string | null;
  created_at: string;
};

type Quote = {
  id: string;
  service_type: string;
  status: string;
  submitted_total: number;
  reviewed_total: number | null;
  payment_status: string;
  payment_requested_at: string | null;
  created_at: string;
};

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning',
  cleaning: 'Home Cleaning',
  yard: 'Yard Care',
  dump: 'Dump Run',
  auto: 'Auto Detailing',
  laundry_sneakers: 'Laundry & Sneakers',
};

export default function PaymentsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingQuoteId, setPayingQuoteId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/orders?status=completed&limit=100').then((r) => r.json()).catch(() => ({ orders: [] })),
      fetch('/api/quotes?status=finalized,payment_pending&limit=100').then((r) => r.json()).catch(() => ({ quotes: [] })),
    ])
      .then(([orderData, quoteData]) => {
        setOrders(orderData.orders || []);
        setQuotes((quoteData.quotes || []).filter((q: Quote) => q.status !== 'paid' && q.status !== 'denied'));
      })
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const totalPaid = orders.reduce((s, o) => s + o.final_price, 0);
  const thisMonth = orders
    .filter((o) => o.completed_at && new Date(o.completed_at) >= startOfMonth)
    .reduce((s, o) => s + o.final_price, 0);
  const lastMonth = orders
    .filter((o) => o.completed_at && new Date(o.completed_at) >= startOfLastMonth && new Date(o.completed_at) < startOfMonth)
    .reduce((s, o) => s + o.final_price, 0);

  const outstanding = useMemo(
    () =>
      quotes.reduce(
        (sum, q) => sum + Number(q.reviewed_total ?? q.submitted_total ?? 0),
        0
      ),
    [quotes]
  );

  const summaryCards = [
    { label: 'Outstanding Quotes', value: `$${outstanding.toFixed(0)}`, color: '#1D4ED8' },
    { label: 'Total Paid', value: `$${totalPaid.toFixed(0)}`, color: brand.primary },
    { label: 'This Month', value: `$${thisMonth.toFixed(0)}`, color: '#3B82F6' },
    { label: 'Last Month', value: `$${lastMonth.toFixed(0)}`, color: '#8B5CF6' },
  ];

  async function handlePayQuote(quoteId: string) {
    setPayingQuoteId(quoteId);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/checkout`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open checkout');
      if (!data.url) throw new Error('No checkout URL returned');
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to continue to payment');
      setPayingQuoteId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: brand.primary }}>Payments</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>
          Pay finalized quotes and review completed payments.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className={`${glass} p-4`}>
            <p className="text-[11px] uppercase tracking-wider" style={{ color: brand.muted }}>{card.label}</p>
            {loading ? (
              <div className="h-7 w-16 rounded bg-slate-100 animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold mt-1" style={{ color: card.color }}>{card.value}</p>
            )}
          </div>
        ))}
      </div>

      <div className={`${glass} overflow-hidden`}>
        <div className="p-4 border-b border-black/5">
          <h2 className="text-sm font-semibold" style={{ color: brand.text }}>Pending Payments</h2>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2].map((n) => <div key={n} className="h-16 rounded bg-slate-100 animate-pulse" />)}
          </div>
        ) : quotes.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm" style={{ color: brand.muted }}>No finalized quotes waiting for payment.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {quotes.map((quote) => {
              const payable = Number(quote.reviewed_total ?? quote.submitted_total);
              return (
                <div key={quote.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium" style={{ color: brand.text }}>
                      {SERVICE_LABELS[quote.service_type] || quote.service_type}
                    </p>
                    <p className="text-[11px]" style={{ color: brand.muted }}>
                      Submitted ${quote.submitted_total.toFixed(2)}
                      {quote.reviewed_total !== null ? ` · Final ${quote.reviewed_total.toFixed(2)}` : ''}
                      {' · '}
                      {new Date(quote.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: brand.text }}>${payable.toFixed(2)}</p>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          background: quote.status === 'payment_pending' ? '#DBEAFE' : '#E0E7FF',
                          color: quote.status === 'payment_pending' ? '#1E40AF' : '#3730A3',
                        }}
                      >
                        {quote.status === 'payment_pending' ? 'Payment link active' : 'Finalized'}
                      </span>
                    </div>
                    <button
                      onClick={() => handlePayQuote(quote.id)}
                      disabled={payingQuoteId === quote.id}
                      className="px-3 py-2 rounded-lg text-xs text-white disabled:opacity-60"
                      style={{ background: brand.primary }}
                    >
                      {payingQuoteId === quote.id ? 'Opening...' : 'Pay now'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={`${glass} overflow-hidden`}>
        <div className="p-4 border-b border-black/5">
          <h2 className="text-sm font-semibold" style={{ color: brand.text }}>Completed Payments</h2>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((n) => <div key={n} className="h-12 rounded bg-slate-100 animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm" style={{ color: brand.muted }}>No payments yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(15,61,46,0.08)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={brand.primary} strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: brand.text }}>
                      {SERVICE_LABELS[order.service_type] || order.service_type}
                    </p>
                    <p className="text-[11px]" style={{ color: brand.muted }}>
                      {order.completed_at
                        ? new Date(order.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                        : new Date(order.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold" style={{ color: brand.text }}>${order.final_price.toFixed(2)}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#ECFDF5', color: '#065F46' }}>
                    Paid
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
