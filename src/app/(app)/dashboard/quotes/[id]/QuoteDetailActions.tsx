'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';

type Props = {
  quoteId: string;
  status: string;
  customerEmail: string | null;
};

export function QuoteDetailActions({
  quoteId,
  status: initialStatus,
  customerEmail,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [localStatus, setLocalStatus] = useState(initialStatus);

  // Adjust price modal
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustPrice, setAdjustPrice] = useState('');

  // Cancel modal
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  async function patchQuote(body: Record<string, unknown>): Promise<{ quote: { status: string } }> {
    const res = await fetch(`/api/quotes/${quoteId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json() as { error?: string; quote?: { status: string } };
    if (!res.ok) throw new Error(data.error ?? 'Action failed');
    return data as { quote: { status: string } };
  }

  async function postCheckout(): Promise<{
    url?: string;
    email_to?: string | null;
    email_id?: string | null;
    email_error?: string | null;
  }> {
    const res = await fetch(`/api/quotes/${quoteId}/checkout`, { method: 'POST' });
    const data = await res.json() as { error?: string; url?: string; email_to?: string | null; email_id?: string | null; email_error?: string | null };
    if (!res.ok) throw new Error(data.error ?? 'Failed to create payment link');
    return data;
  }

  function handleCheckoutResult(data: {
    url?: string;
    email_to?: string | null;
    email_error?: string | null;
  }, baseMessage: string) {
    if (data.email_error) {
      const sentTo = data.email_to ? ` (${data.email_to})` : '';
      toast.warning(`${baseMessage} but email failed${sentTo}: ${data.email_error}`);
    } else {
      const sentTo = data.email_to ? ` to ${data.email_to}` : '';
      toast.success(`${baseMessage}${sentTo}`);
    }
  }

  async function handleApproveAndSend() {
    setPending(true);
    let approved = false;
    try {
      await patchQuote({ status: 'finalized' });
      approved = true;
      setLocalStatus('finalized');

      const data = await postCheckout();
      setLocalStatus('payment_pending');
      handleCheckoutResult(data, 'Quote approved and payment link sent');
      router.refresh();
    } catch (err) {
      if (approved) {
        toast.error('Quote approved — payment link failed. Click Send Payment Link to retry.');
        router.refresh();
      } else {
        toast.error(err instanceof Error ? err.message : 'Action failed');
      }
    } finally {
      setPending(false);
    }
  }

  async function handleSendPaymentLink() {
    setPending(true);
    try {
      const data = await postCheckout();
      setLocalStatus('payment_pending');
      handleCheckoutResult(data, 'Payment link sent');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPending(false);
    }
  }

  async function handleAdjust() {
    const reviewed = Number(adjustPrice);
    if (!Number.isFinite(reviewed) || reviewed <= 0) {
      toast.error('Enter a valid price greater than $0');
      return;
    }
    setPending(true);
    try {
      await patchQuote({ reviewed_total: reviewed, status: 'in_review' });
      setLocalStatus('in_review');
      toast.success('Price adjusted');
      setShowAdjust(false);
      setAdjustPrice('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPending(false);
    }
  }

  async function handleDeny() {
    setPending(true);
    try {
      await patchQuote({ status: 'denied' });
      setLocalStatus('denied');
      toast.success('Quote denied');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPending(false);
    }
  }

  async function handleCancel() {
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error('Add a cancellation reason first');
      return;
    }
    setPending(true);
    try {
      await patchQuote({ status: 'cancelled', cancellation_reason: reason });
      setLocalStatus('cancelled');
      toast.success('Quote cancelled and archived');
      setShowCancel(false);
      setCancelReason('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPending(false);
    }
  }

  const canApprove = localStatus === 'submitted' || localStatus === 'in_review';
  const canSendPayment = localStatus === 'finalized' || localStatus === 'payment_pending';
  const canAdjust = localStatus === 'submitted' || localStatus === 'in_review' || localStatus === 'finalized';
  const canDeny = localStatus === 'submitted' || localStatus === 'in_review';
  const canCancel = localStatus === 'finalized' || localStatus === 'payment_pending';
  const canRemind = localStatus === 'payment_pending' && !!customerEmail;

  async function handleRemind() {
    setPending(true);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/remind`, { method: 'POST' });
      const data = await res.json() as { error?: string; sent_to?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to send reminder');
      toast.success(`Reminder sent to ${data.sent_to ?? customerEmail ?? 'customer'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reminder');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {canApprove && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void handleApproveAndSend()}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: brand.accent }}
        >
          {pending ? 'Working…' : 'Approve & Send Payment'}
        </button>
      )}

      {canSendPayment && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void handleSendPaymentLink()}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: brand.accent }}
        >
          {pending ? 'Sending…' : localStatus === 'payment_pending' ? 'Resend Payment Link' : 'Send Payment Link'}
        </button>
      )}

      {canAdjust && (
        <button
          type="button"
          disabled={pending}
          onClick={() => setShowAdjust(true)}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-50"
          style={{ color: brand.text }}
        >
          Adjust Price
        </button>
      )}

      {canRemind && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void handleRemind()}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-amber-50 disabled:opacity-50"
          style={{ color: brand.text }}
        >
          Send Reminder
        </button>
      )}

      {canDeny && (
        <button
          type="button"
          disabled={pending}
          onClick={() => void handleDeny()}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        >
          Deny
        </button>
      )}

      {canCancel && (
        <button
          type="button"
          disabled={pending}
          onClick={() => setShowCancel(true)}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-orange-700 transition hover:bg-orange-50 disabled:opacity-50"
        >
          Cancel Quote
        </button>
      )}

      {/* Adjust Price modal */}
      {showAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/35" onClick={() => setShowAdjust(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Adjust reviewed total</h2>
            <p className="mt-1 text-sm text-slate-500">Enter the corrected price for this quote.</p>
            <input
              type="number"
              min="0"
              step="0.01"
              value={adjustPrice}
              onChange={(e) => setAdjustPrice(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdjust(); }}
              className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
              placeholder="e.g. 150.00"
              autoFocus
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowAdjust(false); setAdjustPrice(''); }}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAdjust()}
                disabled={pending}
                className="flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: brand.accent }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Quote modal */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCancel(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Cancel approved quote</h2>
            <p className="mt-1 text-sm text-slate-500">
              This will expire the Stripe session, cancel any linked order, and archive the quote.
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cancellation reason
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400"
              placeholder="Customer withdrew, scope changed, duplicate quote…"
              autoFocus
            />
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowCancel(false); setCancelReason(''); }}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Keep quote
              </button>
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={pending}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#C2410C' }}
              >
                {pending ? 'Cancelling…' : 'Cancel and archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
