'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/hooks/useAuth';
import { brand } from '@/app/ui/theme';

type PendingQuote = {
  id: string;
  service_type: string;
  submitted_total: number;
  status: string;
};

type FinalizedQuote = {
  id: string;
  service_type: string;
  reviewed_total: number | null;
  submitted_total: number;
  stripe_checkout_url?: string | null;
};

type OrderSummary = {
  id: string;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  final_price: number;
  created_at: string;
};

type SubSummary = {
  id: string;
  service_type: string;
  status: string;
  frequency: string;
  next_service_date: string | null;
  price_per_cycle: number;
};

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

const SERVICE_ICONS: Record<string, string> = {
  windows: '\u{1F6BF}', cleaning: '\u{1F9F9}', yard: '\u{1F33F}',
  dump: '\u{1F69A}', auto: '\u{1F697}', laundry_sneakers: '\u{1F45F}',
};

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window Cleaning', cleaning: 'Home Cleaning', yard: 'Yard Care',
  dump: 'Dump Run', auto: 'Auto Detailing', laundry_sneakers: 'Laundry & Sneakers',
};

const STATUS_STEPS = ['confirmed', 'scheduled', 'in_progress', 'completed'];

function StatusTimeline({ status }: { status: string }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1">
      {STATUS_STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          <div
            className="w-2 h-2 rounded-full transition-colors"
            style={{ background: i <= currentIdx ? brand.primary : '#E2E8F0' }}
          />
          {i < STATUS_STEPS.length - 1 && (
            <div
              className="w-4 h-0.5 transition-colors"
              style={{ background: i < currentIdx ? brand.primary : '#E2E8F0' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function PortalHome() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [subs, setSubs] = useState<SubSummary[]>([]);
  const [finalizedQuotes, setFinalizedQuotes] = useState<FinalizedQuote[]>([]);
  const [pendingQuotes, setPendingQuotes] = useState<PendingQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // null = still loading, '' = loaded but empty, value = phone is set
  const [profilePhone, setProfilePhone] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setFetchError(null);

    // Fetch each endpoint independently so a single failure doesn't blank the
    // whole dashboard. Critical sections (orders, subs) set the error banner;
    // quote endpoints degrade silently with empty arrays.
    const safe = <T,>(promise: Promise<T>, fallback: T): Promise<T> =>
      promise.catch(() => fallback);

    const fetchOrders = fetch('/api/orders?limit=20')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .catch(() => { setFetchError('Some data failed to load. Your dashboard may be incomplete.'); return { orders: [] }; });

    const fetchSubs = fetch('/api/subscriptions?limit=10')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .catch(() => { setFetchError('Some data failed to load. Your dashboard may be incomplete.'); return { subscriptions: [] }; });

    Promise.all([
      fetchOrders,
      fetchSubs,
      // Fetch both finalized (awaiting checkout creation) and payment_pending (checkout exists, direct pay link available)
      safe(fetch('/api/quotes?status=finalized&limit=5').then((r) => r.json()), { quotes: [] }),
      safe(fetch('/api/quotes?status=payment_pending&limit=5').then((r) => r.json()), { quotes: [] }),
      safe(fetch('/api/quotes?status=submitted,in_review&limit=10').then((r) => r.json()), { quotes: [] }),
      safe(fetch('/api/portal/profile').then((r) => r.ok ? r.json() : null), null),
    ]).then(([orderData, subData, finalizedData, paymentPendingData, pendingData, profileData]) => {
      setOrders(orderData.orders || []);
      setSubs(subData.subscriptions || []);
      // Merge finalized + payment_pending; payment_pending ones carry stripe_checkout_url for direct Pay Now
      setFinalizedQuotes([...(finalizedData.quotes || []), ...(paymentPendingData.quotes || [])]);
      setPendingQuotes(pendingData.quotes || []);
      setProfilePhone((profileData?.profile?.phone as string | null | undefined) ?? null);
    }).finally(() => setLoading(false));
  }, []);

  // Prefer display name; fall back to the local part of the email; last resort 'there'.
  const firstName = (user?.user_metadata?.full_name as string)?.split(' ')[0]
    || user?.email?.split('@')[0]
    || 'there';
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  const activeOrders = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const activeSubs = subs.filter((s) => s.status === 'active');
  const totalSpent = orders.filter((o) => o.status === 'completed').reduce((s, o) => s + o.final_price, 0);
  const nextService = activeOrders
    .filter((o) => o.scheduled_date)
    .sort((a, b) => new Date(a.scheduled_date!).getTime() - new Date(b.scheduled_date!).getTime())[0];

  const attentionOrders = orders.filter((o) => ['in_progress', 'scheduled', 'confirmed'].includes(o.status));

  const stats = [
    { label: 'Active Orders', value: String(activeOrders.length), color: '#3B82F6' },
    {
      label: 'Next Service',
      value: nextService?.scheduled_date
        ? new Date(nextService.scheduled_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
        : 'None',
      color: brand.primary,
    },
    { label: 'Subscriptions', value: String(activeSubs.length), color: '#8B5CF6' },
    { label: 'Total Spent', value: `$${totalSpent.toFixed(0)}`, color: '#10B981' },
  ];

  const quickActions = [
    { href: '/services', label: 'Book a Service', desc: 'Request a new service quote', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={brand.primary} strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
    ) },
    { href: '/portal/subscriptions', label: 'My Subscriptions', desc: 'Manage recurring services', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={brand.primary} strokeWidth="2"><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" /></svg>
    ) },
    { href: '/portal/property', label: 'Property Details', desc: 'Update address & instructions', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={brand.primary} strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
    ) },
    { href: '/portal/payments', label: 'Payment History', desc: 'View invoices and receipts', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={brand.primary} strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" /></svg>
    ) },
  ];

  return (
    <div className="space-y-6">
      {fetchError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          {fetchError}
        </div>
      )}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>
          Welcome back, {firstName}
        </h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>{today}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`${glass} p-4`}
          >
            <p className="text-[11px] uppercase tracking-wider" style={{ color: brand.muted }}>{stat.label}</p>
            {loading ? (
              <div className="h-8 w-16 rounded bg-slate-100 animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-bold mt-1" style={{ color: stat.color }}>{stat.value}</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Pending quotes under review */}
      {!loading && pendingQuotes.length > 0 && (
        <Link
          href="/portal/quotes"
          className={`${glass} p-4 flex items-center gap-4 hover:shadow-lg transition-shadow border-l-4`}
          style={{ borderLeftColor: '#F59E0B' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(245,158,11,0.10)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: brand.text }}>
              {pendingQuotes.length === 1
                ? `Your ${SERVICE_LABELS[pendingQuotes[0].service_type] || 'quote'} request is being reviewed`
                : `${pendingQuotes.length} quote requests are being reviewed`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: brand.muted }}>
              We'll confirm pricing and reach out shortly
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1 text-sm font-semibold" style={{ color: '#F59E0B' }}>
            View
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </Link>
      )}

      {/* Finalized quotes awaiting payment */}
      {!loading && finalizedQuotes.length > 0 && (() => {
        // Prefer a quote that already has a Stripe checkout URL (payment_pending status) for direct Pay Now
        const directPayQuote = finalizedQuotes.find((q) => q.stripe_checkout_url);
        const label = finalizedQuotes.length === 1
          ? `${SERVICE_LABELS[finalizedQuotes[0].service_type] || 'A quote'} is ready for payment`
          : `${finalizedQuotes.length} quotes are ready for payment`;
        const amount = directPayQuote
          ? (directPayQuote.reviewed_total ?? directPayQuote.submitted_total)
          : null;
        if (directPayQuote?.stripe_checkout_url) {
          return (
            <a
              href={directPayQuote.stripe_checkout_url}
              className={`${glass} p-4 flex items-center gap-4 hover:shadow-lg transition-shadow border-l-4`}
              style={{ borderLeftColor: brand.primary }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(15,61,46,0.10)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={brand.primary} strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: brand.text }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: brand.muted }}>
                  {amount ? `$${amount.toFixed(0)} — tap to pay now and confirm your booking` : 'Tap to pay and confirm your booking'}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1 text-sm font-semibold" style={{ color: brand.primary }}>
                Pay Now
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
              </div>
            </a>
          );
        }
        return (
          <Link
            href="/portal/quotes"
            className={`${glass} p-4 flex items-center gap-4 hover:shadow-lg transition-shadow border-l-4`}
            style={{ borderLeftColor: brand.primary }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(15,61,46,0.10)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={brand.primary} strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: brand.text }}>{label}</p>
              <p className="text-xs mt-0.5" style={{ color: brand.muted }}>Review and confirm before your spot is booked</p>
            </div>
            <div className="shrink-0 flex items-center gap-1 text-sm font-semibold" style={{ color: brand.primary }}>
              Review
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
            </div>
          </Link>
        );
      })()}

      {/* Profile completeness nudge — only shown after profile loads and phone is missing */}
      {profilePhone === null && !loading && (
        <Link
          href="/portal/profile"
          className={`${glass} p-4 flex items-center gap-4 hover:shadow-lg transition-shadow border-l-4`}
          style={{ borderLeftColor: '#F59E0B' }}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(245,158,11,0.10)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: brand.text }}>Add your phone number</p>
            <p className="text-xs mt-0.5" style={{ color: brand.muted }}>Speeds up future bookings — pre-fills Step 3 automatically</p>
          </div>
          <div className="shrink-0 flex items-center gap-1 text-sm font-semibold" style={{ color: '#F59E0B' }}>
            Update
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6" /></svg>
          </div>
        </Link>
      )}

      {!loading && attentionOrders.length > 0 && (
        <div className={`${glass} p-5`}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: brand.text }}>Needs Your Attention</h2>
          <div className="space-y-3">
            {attentionOrders.slice(0, 4).map((order) => (
              <Link
                key={order.id}
                href="/portal/orders"
                className="flex items-center justify-between p-3 rounded-xl border transition-colors hover:bg-slate-50/50"
                style={{ borderColor: 'rgba(0,0,0,0.05)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{SERVICE_ICONS[order.service_type] || '\u{1F4CB}'}</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: brand.text }}>
                      {SERVICE_LABELS[order.service_type] || order.service_type}
                    </p>
                    <p className="text-xs" style={{ color: brand.muted }}>
                      {order.scheduled_date
                        ? new Date(order.scheduled_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                        : 'Pending schedule'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusTimeline status={order.status} />
                  <span className="text-sm font-semibold" style={{ color: brand.text }}>${order.final_price.toFixed(0)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {quickActions.map((action) => (
          <Link key={action.href} href={action.href} className={`${glass} p-4 flex items-center gap-4 hover:shadow-lg transition-shadow`}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(15,61,46,0.08)' }}>
              {action.icon}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: brand.text }}>{action.label}</p>
              <p className="text-xs" style={{ color: brand.muted }}>{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className={`${glass} p-5`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: brand.text }}>Recent Orders</h2>
          <Link href="/portal/orders" className="text-xs font-medium" style={{ color: brand.primary }}>View all</Link>
        </div>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="h-10 rounded-lg bg-slate-100 animate-pulse" />)}</div>
        ) : orders.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm font-medium" style={{ color: brand.text }}>No orders yet</p>
            <p className="text-xs" style={{ color: brand.muted }}>
              Most popular this week: Window cleaning &amp; Home cleaning
            </p>
            <Link
              href="/services"
              className="inline-block mt-1 rounded-full px-5 py-2 text-sm font-semibold text-white"
              style={{ background: brand.primary }}
            >
              Book your first service
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-base">{SERVICE_ICONS[order.service_type] || '\u{1F4CB}'}</span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: brand.text }}>{SERVICE_LABELS[order.service_type] || order.service_type}</p>
                    <p className="text-[11px]" style={{ color: brand.muted }}>{new Date(order.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold" style={{ color: brand.text }}>${order.final_price.toFixed(2)}</p>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{
                      background: order.status === 'completed' ? '#ECFDF5' : order.status === 'cancelled' ? '#FEE2E2' : '#F1F5F9',
                      color: order.status === 'completed' ? '#065F46' : order.status === 'cancelled' ? '#991B1B' : brand.muted,
                    }}
                  >{order.status.replace('_', ' ')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
