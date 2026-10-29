'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { dashboardTheme } from '@/lib/design-system/themes';
import { formatCurrency } from '@/lib/dashboard/utils';

export type InvoiceFields = {
  stripe_invoice_id?: string | null;
  stripe_invoice_status?: string | null;
  stripe_invoice_url?: string | null;
  stripe_invoice_number?: string | null;
  stripe_invoice_sent_at?: string | null;
};

export type InvoiceOrder = InvoiceFields & {
  id: string;
  customer_email?: string | null;
  final_price: number;
};

/**
 * Invoice status + "Send invoice" button for one order.
 * Pass `order` when the caller already has it; otherwise it is loaded by `orderId`.
 */
export default function OrderInvoice({
  orderId,
  order: initialOrder,
  onChange,
}: {
  orderId: string;
  order?: InvoiceOrder | null;
  onChange?: (patch: InvoiceFields) => void;
}) {
  const [order, setOrder] = useState<InvoiceOrder | null>(initialOrder ?? null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (initialOrder) { setOrder(initialOrder); return; }
    let cancelled = false;
    setOrder(null);
    fetch(`/api/orders/${orderId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data) setOrder(data as InvoiceOrder); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [orderId, initialOrder]);

  if (!order) return null;

  const send = async () => {
    if (!order.customer_email) { toast.error('Add a customer email before sending an invoice'); return; }
    if (!window.confirm(`Email a Stripe invoice for ${formatCurrency(order.final_price)} to ${order.customer_email}?`)) return;
    setSending(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/send-invoice`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to send invoice');
      const patch: InvoiceFields = {
        stripe_invoice_id: data.stripe_invoice_id ?? null,
        stripe_invoice_status: data.stripe_invoice_status ?? 'open',
        stripe_invoice_url: data.stripe_invoice_url ?? null,
        stripe_invoice_number: data.stripe_invoice_number ?? null,
        stripe_invoice_sent_at: data.stripe_invoice_sent_at ?? null,
      };
      setOrder((prev) => (prev ? { ...prev, ...patch } : prev));
      onChange?.(patch);
      toast.success(`Invoice sent to ${order.customer_email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-slate-100 pt-4 space-y-2">
      <p className="text-xs text-slate-500 uppercase tracking-wide">Invoice</p>
      {order.stripe_invoice_id || order.stripe_invoice_status === 'sending' ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-700">
            {order.stripe_invoice_number ? `${order.stripe_invoice_number} · ` : ''}
            <span className="font-semibold capitalize">{(order.stripe_invoice_status || 'open').replace('_', ' ')}</span>
          </span>
          {order.stripe_invoice_url && (
            <a href={order.stripe_invoice_url} target="_blank" rel="noreferrer" className="text-xs font-semibold underline" style={{ color: dashboardTheme.color.primary }}>
              View invoice
            </a>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={send}
          disabled={sending || !order.customer_email}
          title={order.customer_email ? undefined : 'Add a customer email first'}
          className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          style={{ background: dashboardTheme.color.primary }}
        >
          {sending ? 'Sending…' : 'Send invoice'}
        </button>
      )}
    </div>
  );
}
