'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { dashboardTheme } from '@/lib/design-system/themes';
import { FREQUENCY_LABELS, SERVICE_TYPE_LABELS } from '@/types/orders';
import { normalizeQuoteStatus as _normalizeQuoteStatus } from '@/types/dashboard';

type QuoteStatus =
  | 'submitted'
  | 'in_review'
  | 'finalized'
  | 'payment_pending'
  | 'paid'
  | 'denied'
  | 'cancelled';

type NdisManagementType = 'plan_managed' | 'self_managed' | 'agency_managed';

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
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  stripe_checkout_url: string | null;
  notes: string | null;
  converted_order_id: string | null;
  created_at: string;
  // NDIS routing (nullable for non-NDIS quotes)
  ndis_management_type: NdisManagementType | null;
  ndis_forward_contact: string | null;
  ndis_forward_email: string | null;
  ndis_estimated_hours: number | null;
  ndis_hourly_rate: number | null;
  ndis_forwarded_at: string | null;
  ndis_accepted_at: string | null;
  ndis_booked_at: string | null;
};

const NDIS_MGMT_LABELS: Record<NdisManagementType, string> = {
  plan_managed: 'Plan-managed',
  self_managed: 'Self-managed',
  agency_managed: 'Agency-managed (NDIA)',
};

const NDIS_MGMT_CLASS: Record<NdisManagementType, string> = {
  plan_managed: 'bg-violet-100 text-violet-800',
  self_managed: 'bg-indigo-100 text-indigo-800',
  agency_managed: 'bg-purple-100 text-purple-800',
};

type WorkspaceTab = 'review' | 'approved' | 'archive';

function sanitizeWorkspaceTab(value: string | null): WorkspaceTab {
  if (value === 'approved' || value === 'archive') return value;
  return 'review';
}

function sanitizeStatus(value: string | null): QuoteStatus | null {
  if (
    value === 'submitted' ||
    value === 'in_review' ||
    value === 'finalized' ||
    value === 'payment_pending' ||
    value === 'paid' ||
    value === 'denied' ||
    value === 'cancelled'
  ) {
    return value;
  }
  return null;
}

function normalizeStatus(rawStatus: string): QuoteStatus {
  const normalized = _normalizeQuoteStatus(rawStatus);
  if (
    normalized === 'submitted' ||
    normalized === 'in_review' ||
    normalized === 'finalized' ||
    normalized === 'payment_pending' ||
    normalized === 'paid' ||
    normalized === 'denied' ||
    normalized === 'cancelled'
  ) {
    return normalized;
  }
  return 'submitted';
}

const STATUS_LABELS: Record<QuoteStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In review',
  finalized: 'Approved',
  payment_pending: 'Payment pending',
  paid: 'Paid',
  denied: 'Denied',
  cancelled: 'Cancelled',
};

const STATUS_CLASS: Record<QuoteStatus, string> = {
  submitted: 'bg-slate-100 text-slate-700',
  in_review: 'bg-amber-100 text-amber-800',
  finalized: 'bg-indigo-100 text-indigo-800',
  payment_pending: 'bg-blue-100 text-blue-800',
  paid: 'bg-emerald-100 text-emerald-800',
  denied: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-orange-100 text-orange-800',
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

function quoteMatchesSearch(quote: Quote, search: string) {
  const term = search.trim().toLowerCase();
  if (!term) return true;

  return [
    quote.id,
    quote.customer_name,
    quote.customer_email,
    quote.customer_phone,
    quote.service_type,
    quote.context,
    quote.notes,
    quote.scope,
    quote.cancellation_reason,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(term));
}

function QuotesPageContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>(() => sanitizeWorkspaceTab(searchParams?.get('workspace') ?? null));
  const [search, setSearch] = useState(() => searchParams?.get('search') || '');
  const [ndisOnly, setNdisOnly] = useState(() => (searchParams?.get('ndis') ?? '') === '1');
  const [adjustModal, setAdjustModal] = useState<Quote | null>(null);
  const [adjustPrice, setAdjustPrice] = useState('');
  const [cancelModal, setCancelModal] = useState<Quote | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const statusFilter = sanitizeStatus(searchParams?.get('status') ?? null);

  useEffect(() => {
    setWorkspaceTab(sanitizeWorkspaceTab(searchParams?.get('workspace') ?? null));
    setSearch(searchParams?.get('search') || '');
  }, [searchParams]);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quotes?limit=400');
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
      setQuotes((prev) => prev.map((quote) => (quote.id === id ? normalized : quote)));
      return normalized;
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const requestPayment = useCallback(async (
    quote: Quote,
    options?: {
      openCheckout?: boolean;
      successMessage?: string;
    }
  ) => {
    setActionLoadingId(quote.id);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/checkout`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create payment session');
      await fetchQuotes();
      if (data.url && options?.openCheckout) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      } else if (!data.url) {
        throw new Error('No checkout URL returned');
      }
      if (data.email_error) {
        const sentTo = data.email_to ? ` (${data.email_to})` : '';
        let copiedLink = false;
        if (data.url && navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(data.url);
            copiedLink = true;
          } catch {
            copiedLink = false;
          }
        }
        const copyNote = copiedLink ? ' Checkout link copied.' : ' Use Copy payment link.';
        toast.warning(`Payment link created, but email failed${sentTo}: ${data.email_error}.${copyNote}`);
      } else {
        const baseMessage = options?.successMessage ?? 'Payment link sent to customer';
        const sentTo = data.email_to ? ` to ${data.email_to}` : '';
        const emailId = data.email_id ? ` · Resend ID: ${data.email_id}` : '';
        toast.success(`${baseMessage}${sentTo}${emailId}`);
      }
      return data as {
        url?: string;
        email_to?: string | null;
        email_id?: string | null;
        email_error?: string | null;
      };
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create payment link');
      return null;
    } finally {
      setActionLoadingId(null);
    }
  }, [fetchQuotes]);

  const sendReminder = useCallback(async (quote: Quote) => {
    setActionLoadingId(quote.id);
    try {
      const res = await fetch(`/api/quotes/${quote.id}/remind`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reminder');
      toast.success(`Reminder sent to ${data.sent_to ?? quote.customer_email ?? quote.customer_name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reminder');
    } finally {
      setActionLoadingId(null);
    }
  }, []);

  const copyPaymentLink = useCallback(async (quote: Quote) => {
    setActionLoadingId(quote.id);
    try {
      const paymentUrl =
        quote.stripe_checkout_url ||
        (await requestPayment(quote, { successMessage: 'Payment link refreshed for manual sharing' }))?.url;

      if (!paymentUrl) {
        throw new Error('No payment link available to copy');
      }

      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is unavailable in this browser');
      }

      await navigator.clipboard.writeText(paymentUrl);
      toast.success(`Payment link copied for ${quote.customer_email ?? quote.customer_name}`);
      await fetchQuotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to copy payment link');
    } finally {
      setActionLoadingId(null);
    }
  }, [fetchQuotes, requestPayment]);

  const finalizeQuote = useCallback(async (quote: Quote) => {
    try {
      const finalized = await updateQuote(quote.id, {
        status: 'finalized',
        reviewed_total: quote.reviewed_total ?? quote.submitted_total ?? quote.total,
      });

      await requestPayment(finalized, {
        successMessage: 'Quote approved and payment link sent to customer',
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to finalize quote');
    }
  }, [requestPayment, updateQuote]);

  const handleNdisStamp = useCallback(
    async (quote: Quote, field: 'ndis_forwarded_at' | 'ndis_accepted_at' | 'ndis_booked_at') => {
      try {
        await updateQuote(quote.id, { [field]: true });
        const label =
          field === 'ndis_forwarded_at'
            ? 'forwarded'
            : field === 'ndis_accepted_at'
            ? 'accepted'
            : 'booked';
        toast.success(`Quote marked ${label}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update NDIS status');
      }
    },
    [updateQuote],
  );

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

  const updateWorkspaceTab = useCallback((nextTab: WorkspaceTab) => {
    setWorkspaceTab(nextTab);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('workspace', nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const handleCancelQuote = useCallback(async () => {
    if (!cancelModal) return;
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error('Add a cancellation reason before cancelling the quote');
      return;
    }

    try {
      await updateQuote(cancelModal.id, {
        status: 'cancelled',
        cancellation_reason: reason,
      });
      toast.success('Approved quote cancelled and moved to archive');
      setCancelModal(null);
      setCancelReason('');
      updateWorkspaceTab('archive');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel quote');
    }
  }, [cancelModal, cancelReason, updateQuote, updateWorkspaceTab]);

  const filteredQuotes = useMemo(
    () => quotes.filter((quote) => {
      if (!quoteMatchesSearch(quote, search)) return false;
      if (statusFilter && quote.status !== statusFilter) return false;
      if (ndisOnly && quote.context !== 'ndis') return false;
      return true;
    }),
    [quotes, search, statusFilter, ndisOnly]
  );

  const ndisQuoteCount = useMemo(
    () => quotes.filter((q) => q.context === 'ndis').length,
    [quotes],
  );

  const grouped = useMemo(() => {
    const review = filteredQuotes.filter((quote) => quote.status === 'submitted' || quote.status === 'in_review');
    const approved = filteredQuotes.filter((quote) => quote.status === 'finalized' || quote.status === 'payment_pending');
    const archive = filteredQuotes.filter((quote) => quote.status === 'paid' || quote.status === 'denied' || quote.status === 'cancelled');

    return {
      review: {
        submitted: review.filter((quote) => quote.status === 'submitted'),
        inReview: review.filter((quote) => quote.status === 'in_review'),
      },
      approved: {
        ready: approved.filter((quote) => quote.status === 'finalized'),
        paymentPending: approved.filter((quote) => quote.status === 'payment_pending'),
      },
      archive: {
        cancelled: archive.filter((quote) => quote.status === 'cancelled'),
        closed: archive.filter((quote) => quote.status === 'paid' || quote.status === 'denied'),
      },
    };
  }, [filteredQuotes]);

  const counts = useMemo(() => ({
    review: quotes.filter((quote) => quote.status === 'submitted' || quote.status === 'in_review').length,
    approved: quotes.filter((quote) => quote.status === 'finalized' || quote.status === 'payment_pending').length,
    archive: quotes.filter((quote) => quote.status === 'paid' || quote.status === 'denied' || quote.status === 'cancelled').length,
    paymentPending: quotes.filter((quote) => quote.status === 'payment_pending').length,
  }), [quotes]);

  const tabConfig: Array<{ key: WorkspaceTab; label: string; description: string; count: number }> = [
    {
      key: 'review',
      label: 'Needs Review',
      description: 'Incoming quotes to review and price.',
      count: counts.review,
    },
    {
      key: 'approved',
      label: 'Approved',
      description: 'Approved quotes waiting on payment or follow-up.',
      count: counts.approved,
    },
    {
      key: 'archive',
      label: 'Archive',
      description: 'Paid, denied, and cancelled history.',
      count: counts.archive,
    },
  ];

  return (
    <main className="max-w-7xl mx-auto py-8 px-4 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: dashboardTheme.color.primary }}>Quote Console</h1>
          <p className="text-sm text-slate-500">
            Review, approve, cancel, and archive quotes without letting historical items clog the active queue.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={fetchQuotes}
            className="px-3 py-2 rounded-lg text-xs border"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.muted }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Needs review" value={String(counts.review)} tone="slate" />
        <MetricCard label="Approved" value={String(counts.approved)} tone="indigo" />
        <MetricCard label="Payment pending" value={String(counts.paymentPending)} tone="blue" />
        <MetricCard label="Archive" value={String(counts.archive)} tone="emerald" />
      </div>

      <div className="rounded-3xl border border-black/8 bg-white/80 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-2 sm:grid-cols-3">
            {tabConfig.map((tab) => {
              const isActive = workspaceTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => updateWorkspaceTab(tab.key)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${isActive ? 'shadow-sm' : 'hover:bg-slate-50/80'}`}
                  style={{
                    borderColor: isActive ? 'rgba(15,61,46,0.18)' : 'rgba(15,23,42,0.08)',
                    background: isActive ? 'rgba(15,61,46,0.06)' : 'rgba(255,255,255,0.8)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">{tab.label}</span>
                    <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {tab.count}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{tab.description}</p>
                </button>
              );
            })}
          </div>

          <div className="w-full lg:w-80">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Search quotes
            </label>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, service, reason, ID"
              className="w-full rounded-2xl border bg-white px-4 py-2.5 text-sm text-slate-900 outline-none"
              style={{ borderColor: dashboardTheme.color.border }}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {statusFilter ? (
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Status filter: {STATUS_LABELS[statusFilter]}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setNdisOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
              ndisOnly
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-violet-50 text-violet-800 hover:bg-violet-100'
            }`}
            title="Filter to NDIS quotes only"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            NDIS only{ndisQuoteCount > 0 ? ` · ${ndisQuoteCount}` : ''}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => <div key={n} className="h-24 rounded-2xl bg-white/60 animate-pulse" />)}
        </div>
      ) : (
        <>
          {workspaceTab === 'review' && (
            <div className="space-y-6">
              <Section
                title={`Submitted (${grouped.review.submitted.length})`}
                subtitle="Fresh quote requests waiting for triage."
                emptyLabel="No newly submitted quotes."
                quotes={grouped.review.submitted}
                actionLoadingId={actionLoadingId}
                onAdjust={(quote) => {
                  setAdjustModal(quote);
                  setAdjustPrice(String(quote.reviewed_total ?? quote.submitted_total ?? quote.total));
                }}
                onStartReview={(quote) => updateQuote(quote.id, { status: 'in_review' })}
                onFinalize={finalizeQuote}
                onDeny={(quote) => updateQuote(quote.id, { status: 'denied' })}
                onRequestPayment={requestPayment}
                onCopyPaymentLink={copyPaymentLink}
                onCancelApproved={(quote) => {
                  setCancelModal(quote);
                  setCancelReason('');
                }}
                onNdisStamp={handleNdisStamp}
                onSendReminder={sendReminder}
              />

              <Section
                title={`In Review (${grouped.review.inReview.length})`}
                subtitle="Quotes with adjusted pricing still waiting for final approval."
                emptyLabel="No quotes currently in review."
                quotes={grouped.review.inReview}
                actionLoadingId={actionLoadingId}
                onAdjust={(quote) => {
                  setAdjustModal(quote);
                  setAdjustPrice(String(quote.reviewed_total ?? quote.submitted_total ?? quote.total));
                }}
                onStartReview={(quote) => updateQuote(quote.id, { status: 'in_review' })}
                onFinalize={finalizeQuote}
                onDeny={(quote) => updateQuote(quote.id, { status: 'denied' })}
                onRequestPayment={requestPayment}
                onCopyPaymentLink={copyPaymentLink}
                onCancelApproved={(quote) => {
                  setCancelModal(quote);
                  setCancelReason('');
                }}
                onNdisStamp={handleNdisStamp}
                onSendReminder={sendReminder}
              />
            </div>
          )}

          {workspaceTab === 'approved' && (
            <div className="space-y-6">
              <Section
                title={`Ready To Send (${grouped.approved.ready.length})`}
                subtitle="Approved quotes that still need the payment link sent."
                emptyLabel="No approved quotes waiting for payment."
                quotes={grouped.approved.ready}
                actionLoadingId={actionLoadingId}
                onAdjust={(quote) => {
                  setAdjustModal(quote);
                  setAdjustPrice(String(quote.reviewed_total ?? quote.submitted_total ?? quote.total));
                }}
                onStartReview={(quote) => updateQuote(quote.id, { status: 'in_review' })}
                onFinalize={(quote) => updateQuote(quote.id, { status: 'finalized' })}
                onDeny={(quote) => updateQuote(quote.id, { status: 'denied' })}
                onRequestPayment={requestPayment}
                onCopyPaymentLink={copyPaymentLink}
                onCancelApproved={(quote) => {
                  setCancelModal(quote);
                  setCancelReason('');
                }}
                onNdisStamp={handleNdisStamp}
                onSendReminder={sendReminder}
              />

              <Section
                title={`Payment Requested (${grouped.approved.paymentPending.length})`}
                subtitle="Payment links are already active for these approved quotes."
                emptyLabel="No quotes currently waiting on customer payment."
                quotes={grouped.approved.paymentPending}
                actionLoadingId={actionLoadingId}
                onAdjust={(quote) => {
                  setAdjustModal(quote);
                  setAdjustPrice(String(quote.reviewed_total ?? quote.submitted_total ?? quote.total));
                }}
                onStartReview={(quote) => updateQuote(quote.id, { status: 'in_review' })}
                onFinalize={(quote) => updateQuote(quote.id, { status: 'finalized' })}
                onDeny={(quote) => updateQuote(quote.id, { status: 'denied' })}
                onRequestPayment={requestPayment}
                onCopyPaymentLink={copyPaymentLink}
                onCancelApproved={(quote) => {
                  setCancelModal(quote);
                  setCancelReason('');
                }}
                onNdisStamp={handleNdisStamp}
                onSendReminder={sendReminder}
              />
            </div>
          )}

          {workspaceTab === 'archive' && (
            <div className="space-y-6">
              <Section
                title={`Cancelled (${grouped.archive.cancelled.length})`}
                subtitle="Approved quotes that were cancelled and moved out of the active queue."
                emptyLabel="No cancelled approved quotes."
                quotes={grouped.archive.cancelled}
                actionLoadingId={actionLoadingId}
                onAdjust={(quote) => {
                  setAdjustModal(quote);
                  setAdjustPrice(String(quote.reviewed_total ?? quote.submitted_total ?? quote.total));
                }}
                onStartReview={(quote) => updateQuote(quote.id, { status: 'in_review' })}
                onFinalize={(quote) => updateQuote(quote.id, { status: 'finalized' })}
                onDeny={(quote) => updateQuote(quote.id, { status: 'denied' })}
                onRequestPayment={requestPayment}
                onCopyPaymentLink={copyPaymentLink}
                onCancelApproved={(quote) => {
                  setCancelModal(quote);
                  setCancelReason('');
                }}
                onNdisStamp={handleNdisStamp}
                onSendReminder={sendReminder}
              />

              <Section
                title={`Closed (${grouped.archive.closed.length})`}
                subtitle="Paid and denied history kept separate from the working queue."
                emptyLabel="No closed quote history."
                quotes={grouped.archive.closed}
                actionLoadingId={actionLoadingId}
                onAdjust={(quote) => {
                  setAdjustModal(quote);
                  setAdjustPrice(String(quote.reviewed_total ?? quote.submitted_total ?? quote.total));
                }}
                onStartReview={(quote) => updateQuote(quote.id, { status: 'in_review' })}
                onFinalize={(quote) => updateQuote(quote.id, { status: 'finalized' })}
                onDeny={(quote) => updateQuote(quote.id, { status: 'denied' })}
                onRequestPayment={requestPayment}
                onCopyPaymentLink={copyPaymentLink}
                onCancelApproved={(quote) => {
                  setCancelModal(quote);
                  setCancelReason('');
                }}
                onNdisStamp={handleNdisStamp}
                onSendReminder={sendReminder}
              />
            </div>
          )}
        </>
      )}

      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/35" onClick={() => setAdjustModal(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
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
              onChange={(event) => setAdjustPrice(event.target.value)}
              className="w-full rounded-xl border px-4 py-2.5 text-sm mb-4"
              style={{ borderColor: dashboardTheme.color.border }}
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
                style={{ background: dashboardTheme.color.primary }}
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCancelModal(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2 className="text-lg font-semibold text-slate-900">Cancel approved quote</h2>
            <p className="mt-1 text-sm text-slate-500">
              {cancelModal.customer_name} · {SERVICE_TYPE_LABELS[cancelModal.service_type as keyof typeof SERVICE_TYPE_LABELS] || cancelModal.service_type}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              This will cancel the approved quote, close any linked pending order, and move it into the archive.
            </p>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cancellation reason
            </label>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={5}
              className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 outline-none"
              style={{ borderColor: dashboardTheme.color.border }}
              placeholder="Customer withdrew, scope changed, duplicate quote, unable to service address..."
            />

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  setCancelModal(null);
                  setCancelReason('');
                }}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600"
              >
                Keep quote
              </button>
              <button
                onClick={handleCancelQuote}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white"
                style={{ background: '#C2410C' }}
              >
                Cancel and archive
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}

function QuotesSkeleton() {
  return (
    <div className="grid gap-6 w-full px-4 md:px-10 lg:px-12 pb-14 animate-pulse">
      {/* Metric row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/70 border border-black/5" />
        ))}
      </div>
      {/* Quote cards */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-white/70 border border-black/5" />
        ))}
      </div>
    </div>
  );
}

export default function QuotesPage() {
  return (
    <Suspense fallback={<QuotesSkeleton />}>
      <QuotesPageContent />
    </Suspense>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'slate' | 'indigo' | 'blue' | 'emerald';
}) {
  const tones = {
    slate: { bg: 'rgba(148,163,184,0.12)', fg: '#334155' },
    indigo: { bg: 'rgba(99,102,241,0.12)', fg: '#4338CA' },
    blue: { bg: 'rgba(59,130,246,0.12)', fg: '#1D4ED8' },
    emerald: { bg: 'rgba(16,185,129,0.12)', fg: '#047857' },
  } as const;

  return (
    <div className="rounded-3xl border border-black/8 bg-white/85 p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div
        className="mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold"
        style={{ background: tones[tone].bg, color: tones[tone].fg }}
      >
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  emptyLabel,
  quotes,
  actionLoadingId,
  onAdjust,
  onStartReview,
  onFinalize,
  onDeny,
  onRequestPayment,
  onCopyPaymentLink,
  onCancelApproved,
  onNdisStamp,
  onSendReminder,
}: {
  title: string;
  subtitle: string;
  emptyLabel: string;
  quotes: Quote[];
  actionLoadingId: string | null;
  onAdjust: (quote: Quote) => void;
  onStartReview: (quote: Quote) => void;
  onFinalize: (quote: Quote) => void;
  onDeny: (quote: Quote) => void;
  onRequestPayment: (quote: Quote) => void;
  onCopyPaymentLink: (quote: Quote) => void;
  onCancelApproved: (quote: Quote) => void;
  onNdisStamp: (quote: Quote, field: 'ndis_forwarded_at' | 'ndis_accepted_at' | 'ndis_booked_at') => void;
  onSendReminder: (quote: Quote) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>

      {quotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/50 px-4 py-6 text-sm text-slate-500">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => {
            const effective = quote.reviewed_total ?? quote.submitted_total ?? quote.total;
            const loading = actionLoadingId === quote.id;

            return (
              <div
                key={quote.id}
                className="rounded-2xl border border-black/10 bg-white/85 p-4 shadow-sm backdrop-blur"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900">{quote.customer_name}</div>
                    <div className="text-sm text-slate-600">
                      {SERVICE_TYPE_LABELS[quote.service_type as keyof typeof SERVICE_TYPE_LABELS] || quote.service_type}
                      {' · '}
                      {quote.context}
                      {quote.frequency !== 'none' && (
                        <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                          {FREQUENCY_LABELS[quote.frequency as keyof typeof FREQUENCY_LABELS] || quote.frequency}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      Submitted {toDate(quote.created_at)}
                      {quote.customer_email ? ` · ${quote.customer_email}` : ''}
                    </div>
                    {quote.scope && (
                      <div className="text-xs text-slate-500">Scope: {quote.scope}</div>
                    )}
                    {quote.notes && (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        {quote.notes}
                      </div>
                    )}
                    {quote.context === 'ndis' && (
                      <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2 text-xs text-violet-900">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            NDIS
                          </span>
                          {quote.ndis_management_type && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${NDIS_MGMT_CLASS[quote.ndis_management_type]}`}>
                              {NDIS_MGMT_LABELS[quote.ndis_management_type]}
                            </span>
                          )}
                          {quote.ndis_estimated_hours != null && (
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-violet-900 border border-violet-200">
                              {Number(quote.ndis_estimated_hours).toFixed(
                                Number.isInteger(Number(quote.ndis_estimated_hours)) ? 0 : 1
                              )} hr
                              {quote.ndis_hourly_rate != null
                                ? ` × $${Number(quote.ndis_hourly_rate).toFixed(2)}/hr`
                                : ''}
                            </span>
                          )}
                        </div>
                        {(quote.ndis_forward_contact || quote.ndis_forward_email) && (
                          <div className="mt-1.5 text-[11px] text-violet-900/90">
                            Forward: {quote.ndis_forward_contact || '—'}
                            {quote.ndis_forward_email ? ` · ${quote.ndis_forward_email}` : ''}
                          </div>
                        )}
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-violet-900/80">
                          <span className={`rounded px-1.5 py-0.5 ${quote.ndis_forwarded_at ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                            {quote.ndis_forwarded_at ? `✓ Forwarded ${toDate(quote.ndis_forwarded_at)}` : 'Not forwarded'}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 ${quote.ndis_accepted_at ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                            {quote.ndis_accepted_at ? `✓ Accepted ${toDate(quote.ndis_accepted_at)}` : 'Pending approval'}
                          </span>
                          <span className={`rounded px-1.5 py-0.5 ${quote.ndis_booked_at ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                            {quote.ndis_booked_at ? `✓ Booked ${toDate(quote.ndis_booked_at)}` : 'Not booked'}
                          </span>
                        </div>
                      </div>
                    )}
                    {quote.status === 'cancelled' && quote.cancellation_reason && (
                      <div className="rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-900">
                        <span className="font-semibold">Reason:</span> {quote.cancellation_reason}
                        {quote.cancelled_at ? ` · ${toDate(quote.cancelled_at)}` : ''}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 lg:items-end">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLASS[quote.status]}`}>
                      {STATUS_LABELS[quote.status]}
                    </span>
                    <div className="text-xs text-slate-500">Submitted: {toCurrency(quote.submitted_total)}</div>
                    <div className="text-sm font-semibold text-slate-900">
                      Final: {toCurrency(effective)}
                    </div>
                    {quote.status === 'payment_pending' && quote.payment_requested_at && (
                      <div className="text-xs text-blue-700">Link sent {toDate(quote.payment_requested_at)}</div>
                    )}
                    {quote.status === 'paid' && quote.paid_at && (
                      <div className="text-xs text-emerald-700">Paid {toDate(quote.paid_at)}</div>
                    )}
                    {quote.status === 'cancelled' && quote.cancelled_by && (
                      <div className="text-xs text-orange-700">Cancelled by {quote.cancelled_by}</div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(quote.status === 'submitted' || quote.status === 'in_review' || quote.status === 'finalized') && (
                    <button
                      onClick={() => onAdjust(quote)}
                      disabled={loading}
                      className="rounded-lg bg-yellow-100 px-3 py-1.5 text-xs text-yellow-800 hover:bg-yellow-200 disabled:opacity-60"
                    >
                      Adjust
                    </button>
                  )}

                  {quote.status === 'submitted' && (
                    <button
                      onClick={() => onStartReview(quote)}
                      disabled={loading}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                    >
                      Start review
                    </button>
                  )}

                  {(quote.status === 'submitted' || quote.status === 'in_review') && (
                    <button
                      onClick={() => onFinalize(quote)}
                      disabled={loading}
                      className="rounded-lg bg-indigo-100 px-3 py-1.5 text-xs text-indigo-800 hover:bg-indigo-200 disabled:opacity-60"
                    >
                      Approve & send payment
                    </button>
                  )}

                  {(quote.status === 'finalized' || quote.status === 'payment_pending') && (
                    <button
                      onClick={() => onRequestPayment(quote)}
                      disabled={loading}
                      className="rounded-lg px-3 py-1.5 text-xs text-white disabled:opacity-60"
                      style={{ background: dashboardTheme.color.primary }}
                    >
                      {quote.status === 'payment_pending' ? 'Resend payment link' : 'Send payment link'}
                    </button>
                  )}

                  {(quote.status === 'finalized' || quote.status === 'payment_pending') && (
                    <button
                      onClick={() => onCopyPaymentLink(quote)}
                      disabled={loading}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                    >
                      Copy payment link
                    </button>
                  )}

                  {quote.status === 'payment_pending' && quote.customer_email && (
                    <button
                      onClick={() => onSendReminder(quote)}
                      disabled={loading}
                      className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs text-amber-800 hover:bg-amber-200 disabled:opacity-60"
                    >
                      Send reminder
                    </button>
                  )}

                  {(quote.status === 'submitted' || quote.status === 'in_review') && (
                    <button
                      onClick={() => onDeny(quote)}
                      disabled={loading}
                      className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-200 disabled:opacity-60"
                    >
                      Deny
                    </button>
                  )}

                  {(quote.status === 'finalized' || quote.status === 'payment_pending') && (
                    <button
                      onClick={() => onCancelApproved(quote)}
                      disabled={loading}
                      className="rounded-lg bg-orange-100 px-3 py-1.5 text-xs text-orange-800 hover:bg-orange-200 disabled:opacity-60"
                    >
                      Cancel quote
                    </button>
                  )}

                  {quote.status === 'paid' && quote.converted_order_id && (
                    <span className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
                      Order {quote.converted_order_id.slice(0, 8).toUpperCase()}
                    </span>
                  )}

                  {quote.context === 'ndis' && (
                    <>
                      {!quote.ndis_forwarded_at && (
                        <button
                          onClick={() => onNdisStamp(quote, 'ndis_forwarded_at')}
                          disabled={loading}
                          className="rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-200 disabled:opacity-60"
                        >
                          Mark forwarded
                        </button>
                      )}
                      {quote.ndis_forwarded_at && !quote.ndis_accepted_at && (
                        <button
                          onClick={() => onNdisStamp(quote, 'ndis_accepted_at')}
                          disabled={loading}
                          className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 disabled:opacity-60"
                        >
                          Mark accepted
                        </button>
                      )}
                      {quote.ndis_accepted_at && !quote.ndis_booked_at && (
                        <button
                          onClick={() => onNdisStamp(quote, 'ndis_booked_at')}
                          disabled={loading}
                          className="rounded-lg bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-200 disabled:opacity-60"
                        >
                          Mark booked
                        </button>
                      )}
                    </>
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
