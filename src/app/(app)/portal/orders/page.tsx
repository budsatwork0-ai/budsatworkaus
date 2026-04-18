'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';

type Order = {
  id: string;
  service_type: string;
  context: string;
  scope: string | null;
  status: string;
  scheduled_date: string | null;
  final_price: number;
  created_at: string;
  notes: string | null;
};

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning', cleaning: 'Home Cleaning', yard: 'Yard Care',
  dump: 'Dump Run', auto: 'Auto Detailing', laundry_sneakers: 'Laundry & Sneakers',
};
const SERVICE_ICONS: Record<string, string> = {
  windows: '\u{1F6BF}', cleaning: '\u{1F9F9}', yard: '\u{1F33F}',
  dump: '\u{1F69A}', auto: '\u{1F697}', laundry_sneakers: '\u{1F45F}',
};

const STATUS_STEPS = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

type TabKey = 'all' | 'active' | 'completed';

function StatusTimeline({ status }: { status: string }) {
  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === status);
  if (status === 'cancelled' || status === 'pending') {
    const colors: Record<string, { bg: string; fg: string }> = {
      pending: { bg: '#FEF3C7', fg: '#92400E' },
      cancelled: { bg: '#FEE2E2', fg: '#991B1B' },
    };
    const c = colors[status] || colors.pending;
    return <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: c.bg, color: c.fg }}>{status}</span>;
  }
  return (
    <div className="flex items-center gap-0.5">
      {STATUS_STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className="w-3 h-3 rounded-full border-2"
              style={{
                borderColor: i <= currentIdx ? brand.primary : '#CBD5E1',
                background: i <= currentIdx ? brand.primary : 'white',
              }}
            />
            <span className="text-[9px] mt-0.5 hidden sm:block" style={{ color: i <= currentIdx ? brand.primary : '#94A3B8' }}>
              {step.label}
            </span>
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div className="w-6 sm:w-8 h-0.5 -mt-3 sm:-mt-3" style={{ background: i < currentIdx ? brand.primary : '#E2E8F0' }} />
          )}
        </div>
      ))}
    </div>
  );
}

function RatingStars({ orderId, existingRating }: { orderId: string; existingRating: number | null }) {
  const [rating, setRating] = useState(existingRating || 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [submitted, setSubmitted] = useState(!!existingRating);

  const submitRating = async () => {
    try {
      const res = await fetch('/api/portal/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, rating, comment: comment.trim() || null }),
      });
      if (res.ok) {
        setSubmitted(true);
        setShowComment(false);
        toast.success('Thanks for your feedback!');
      }
    } catch {
      toast.error('Failed to submit rating');
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-1 mt-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg key={star} width="16" height="16" viewBox="0 0 24 24" fill={star <= rating ? '#FBBF24' : 'none'} stroke={star <= rating ? '#FBBF24' : '#CBD5E1'} strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ))}
        <span className="text-xs text-slate-400 ml-1">Rated</span>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <p className="text-xs mb-1" style={{ color: brand.muted }}>Rate this service:</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => { setRating(star); setShowComment(true); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={star <= (hover || rating) ? '#FBBF24' : 'none'} stroke={star <= (hover || rating) ? '#FBBF24' : '#CBD5E1'} strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        ))}
      </div>
      {showComment && (
        <div className="mt-2 space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Leave a comment (optional)..."
            rows={2}
            className="w-full rounded-lg border px-3 py-2 text-xs resize-none"
            style={{ borderColor: brand.border }}
          />
          <button onClick={submitRating} className="px-3 py-1.5 rounded-lg text-xs text-white" style={{ background: brand.primary }}>
            Submit Rating
          </button>
        </div>
      )}
    </div>
  );
}

export default function PortalOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/orders?limit=50').then((r) => r.json()).catch(() => ({ orders: [] })),
      fetch('/api/portal/ratings').then((r) => r.json()).catch(() => ({ ratings: [] })),
    ]).then(([orderData, ratingData]) => {
      setOrders(orderData.orders || []);
      const rMap: Record<string, number> = {};
      (ratingData.ratings || []).forEach((r: { order_id: string; rating: number }) => {
        rMap[r.order_id] = r.rating;
      });
      setRatings(rMap);
    }).finally(() => setLoading(false));
  }, []);

  const handleCancel = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (res.ok) {
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: 'cancelled' } : o));
        toast.success('Order cancelled');
        setCancelConfirm(null);
      }
    } catch {
      toast.error('Failed to cancel order');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReschedule = async (orderId: string) => {
    if (!newDate) { toast.error('Please select a date'); return; }
    const selectedDate = new Date(newDate);
    const now = new Date();
    const diffHours = (selectedDate.getTime() - now.getTime()) / (1000 * 3600);
    if (diffHours < 24) {
      toast.error('Must reschedule at least 24 hours in advance');
      return;
    }
    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_date: newDate }),
      });
      if (res.ok) {
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, scheduled_date: newDate } : o));
        toast.success('Order rescheduled');
        setRescheduleId(null);
        setNewDate('');
      }
    } catch {
      toast.error('Failed to reschedule');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = orders.filter((o) => {
    if (activeTab === 'active') return !['completed', 'cancelled'].includes(o.status);
    if (activeTab === 'completed') return o.status === 'completed';
    return true;
  });

  const canModify = (order: Order) => {
    if (['completed', 'cancelled', 'in_progress'].includes(order.status)) return false;
    if (!order.scheduled_date) return true;
    const diffHours = (new Date(order.scheduled_date).getTime() - Date.now()) / (1000 * 3600);
    return diffHours >= 24;
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: `All (${orders.length})` },
    { key: 'active', label: `Active (${orders.filter((o) => !['completed', 'cancelled'].includes(o.status)).length})` },
    { key: 'completed', label: `Completed (${orders.filter((o) => o.status === 'completed').length})` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: brand.primary }}>My Orders</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>Track your service orders and their progress.</p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-white/60 border border-black/5 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={activeTab === tab.key ? { background: brand.primary, color: 'white' } : { color: brand.muted }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`${glass} p-5`}>
              <div className="h-5 w-40 rounded bg-slate-200 animate-pulse" />
              <div className="h-4 w-24 rounded bg-slate-100 animate-pulse mt-2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${glass} p-10 text-center`}>
          <p className="font-medium" style={{ color: brand.text }}>No orders found</p>
          <p className="text-sm mt-1" style={{ color: brand.muted }}>
            {activeTab === 'all' ? "You haven't placed any orders yet." : `No ${activeTab} orders.`}
          </p>
          <Link href="/services" className="inline-block mt-4 px-5 py-2 rounded-xl text-sm text-white font-medium" style={{ background: brand.primary }}>
            Book a Service
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <div key={order.id} className={`${glass} overflow-hidden transition-shadow hover:shadow-lg`}>
              <button className="w-full p-4 sm:p-5 text-left" onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{SERVICE_ICONS[order.service_type] || '\u{1F4CB}'}</span>
                    <div>
                      <p className="font-semibold" style={{ color: brand.text }}>
                        {SERVICE_LABELS[order.service_type] || order.service_type}
                        {order.scope ? ` — ${order.scope}` : ''}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: brand.muted }}>
                        {order.context} · {order.scheduled_date
                          ? new Date(order.scheduled_date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
                          : 'Not scheduled'}
                      </p>
                    </div>
                  </div>
                  <p className="text-lg font-bold shrink-0" style={{ color: brand.text }}>${order.final_price.toFixed(2)}</p>
                </div>
                <div className="mt-3"><StatusTimeline status={order.status} /></div>
              </button>
              {expandedId === order.id && (
                <div className="px-5 pb-5 border-t border-black/5 pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide" style={{ color: brand.muted }}>Order ID</p>
                      <p className="font-mono text-xs mt-0.5">{order.id.slice(0, 8)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide" style={{ color: brand.muted }}>Created</p>
                      <p className="text-xs mt-0.5">{new Date(order.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>

                  {/* Self-service actions */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {canModify(order) && (
                      <>
                        {rescheduleId === order.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={newDate}
                              onChange={(e) => setNewDate(e.target.value)}
                              min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                              className="rounded-lg border px-3 py-1.5 text-xs"
                              style={{ borderColor: brand.border }}
                            />
                            <button
                              onClick={() => handleReschedule(order.id)}
                              disabled={actionLoading === order.id}
                              className="px-3 py-1.5 rounded-lg text-xs text-white"
                              style={{ background: brand.primary }}
                            >
                              {actionLoading === order.id ? 'Saving...' : 'Confirm'}
                            </button>
                            <button onClick={() => { setRescheduleId(null); setNewDate(''); }} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: brand.border }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setRescheduleId(order.id)}
                            className="px-3 py-1.5 rounded-lg text-xs border transition-colors hover:bg-blue-50"
                            style={{ borderColor: '#93C5FD', color: '#1E40AF' }}
                          >
                            Reschedule
                          </button>
                        )}

                        {cancelConfirm === order.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-600">Cancel this order?</span>
                            <button
                              onClick={() => handleCancel(order.id)}
                              disabled={actionLoading === order.id}
                              className="px-3 py-1.5 rounded-lg text-xs bg-red-600 text-white"
                            >
                              Yes
                            </button>
                            <button onClick={() => setCancelConfirm(null)} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: brand.border }}>
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setCancelConfirm(order.id)}
                            className="px-3 py-1.5 rounded-lg text-xs border transition-colors hover:bg-red-50"
                            style={{ borderColor: '#FCA5A5', color: '#991B1B' }}
                          >
                            Cancel Order
                          </button>
                        )}
                      </>
                    )}

                    {order.status === 'completed' && (
                      <Link
                        href={`/services?rebook=${order.service_type}&context=${order.context}${order.scope ? `&scope=${encodeURIComponent(order.scope)}` : ''}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                        style={{ background: brand.primary }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" />
                          <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
                        </svg>
                        Book Again
                      </Link>
                    )}
                  </div>

                  {/* Rating for completed orders */}
                  {order.status === 'completed' && (
                    <RatingStars orderId={order.id} existingRating={ratings[order.id] || null} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
