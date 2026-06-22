import { notFound } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { SERVICE_TYPE_LABELS, FREQUENCY_LABELS } from '@/types/orders';
import { brand } from '@/app/ui/theme';
import {
  RecordPage,
  RecordHeader,
  RecordMetaCard,
  RecordMetaRow,
  RecordBody,
  RecordMain,
  RecordSection,
  RecordContext,
  RecordTimeline,
  RelatedRecordCard,
  type RecordTone,
  type TimelineEvent,
} from '../../components/RecordFrame';
import { QuoteDetailActions } from './QuoteDetailActions';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ageString(iso: string): string {
  const hrs = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hrs < 1) return `${Math.max(1, Math.round(hrs * 60))}m ago`;
  if (hrs < 24) return `${Math.round(hrs)}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ─── Status / NDIS maps ───────────────────────────────────────────────────────

const QUOTE_STATUS_MAP: Record<string, { label: string; tone: RecordTone }> = {
  submitted:       { label: 'Submitted',        tone: 'default'  },
  in_review:       { label: 'In Review',        tone: 'warning'  },
  finalized:       { label: 'Quote Sent',       tone: 'warning'  },
  payment_pending: { label: 'Awaiting Payment', tone: 'warning'  },
  paid:            { label: 'Paid',             tone: 'success'  },
  cancelled:       { label: 'Cancelled',        tone: 'danger'   },
  denied:          { label: 'Denied',           tone: 'danger'   },
};

function quoteStatusDisplay(raw: string): { label: string; tone: RecordTone } {
  return QUOTE_STATUS_MAP[raw] ?? { label: cap(raw.replace(/_/g, ' ')), tone: 'default' };
}

function quoteTotal(q: {
  reviewed_total: number | null;
  submitted_total: number | null;
  total: number | null;
}): string {
  const n = q.reviewed_total ?? q.submitted_total ?? q.total ?? 0;
  return n > 0 ? `$${Number(n).toFixed(2)}` : '';
}

type NdisManagementType = 'plan_managed' | 'self_managed' | 'agency_managed';

const NDIS_MGMT_LABELS: Record<NdisManagementType, string> = {
  plan_managed:    'Plan-managed',
  self_managed:    'Self-managed',
  agency_managed:  'Agency-managed (NDIA)',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageProps = { params: Promise<{ id: string }> };

export default async function QuoteDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') notFound();

  const client = createServiceClientSafe();
  if (!client) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: quote, error } = await (client as any)
    .from('quotes')
    .select(
      'id, customer_name, customer_email, customer_phone,' +
      'service_type, context, scope, frequency,' +
      'total, submitted_total, reviewed_total,' +
      'status, payment_status, payment_requested_at, paid_at,' +
      'finalized_at, finalized_by, cancelled_at, cancelled_by, cancellation_reason,' +
      'stripe_checkout_url, notes, service_address, source,' +
      'created_at, updated_at, converted_order_id, customer_id,' +
      'ndis_management_type, ndis_forward_contact, ndis_forward_email,' +
      'ndis_estimated_hours, ndis_hourly_rate,' +
      'ndis_forwarded_at, ndis_accepted_at, ndis_booked_at',
    )
    .eq('id', id)
    .single();

  if (error || !quote) notFound();

  // Fetch related order if available
  let relatedOrder: { id: string; status: string; service_type: string | null } | null = null;
  if (quote.converted_order_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (client as any)
      .from('orders')
      .select('id, status, service_type')
      .eq('id', quote.converted_order_id)
      .maybeSingle();
    relatedOrder = data ?? null;
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const serviceSlug = (quote.service_type as string | null) ?? 'other';
  const serviceLabel =
    SERVICE_TYPE_LABELS[serviceSlug as keyof typeof SERVICE_TYPE_LABELS] ?? cap(serviceSlug);

  const rawStatus = String(quote.status ?? 'submitted');
  const status = quoteStatusDisplay(rawStatus);
  const total = quoteTotal(quote as {
    reviewed_total: number | null;
    submitted_total: number | null;
    total: number | null;
  });
  const name = (quote.customer_name as string | null) ?? 'Unnamed';
  const contextRaw = (quote.context as string | null) ?? 'home';
  const contextLabel =
    contextRaw === 'ndis' ? 'NDIS' :
    contextRaw === 'commercial' ? 'Commercial' : 'Residential';

  // ── Timeline (newest first) ───────────────────────────────────────────────

  const timelineEvents: TimelineEvent[] = [];

  if (quote.paid_at) {
    timelineEvents.push({ label: 'Payment received', timestamp: fmtDateTime(quote.paid_at as string) });
  }
  if (quote.cancelled_at) {
    timelineEvents.push({
      label: 'Quote cancelled',
      timestamp: fmtDateTime(quote.cancelled_at as string),
      actor: (quote.cancelled_by as string | null) ?? undefined,
    });
  }
  if (quote.payment_requested_at) {
    timelineEvents.push({ label: 'Payment link sent', timestamp: fmtDateTime(quote.payment_requested_at as string) });
  }
  if (quote.finalized_at) {
    timelineEvents.push({
      label: 'Approved',
      timestamp: fmtDateTime(quote.finalized_at as string),
      actor: (quote.finalized_by as string | null) ?? undefined,
    });
  }
  if (quote.ndis_booked_at) {
    timelineEvents.push({ label: 'NDIS booking confirmed', timestamp: fmtDateTime(quote.ndis_booked_at as string) });
  }
  if (quote.ndis_accepted_at) {
    timelineEvents.push({ label: 'NDIS accepted', timestamp: fmtDateTime(quote.ndis_accepted_at as string) });
  }
  if (quote.ndis_forwarded_at) {
    timelineEvents.push({ label: 'Forwarded to NDIS coordinator', timestamp: fmtDateTime(quote.ndis_forwarded_at as string) });
  }
  timelineEvents.push({
    label: 'Quote submitted',
    timestamp: fmtDateTime(quote.created_at as string),
    actor: (quote.source as string | null) ? cap(quote.source as string) : undefined,
  });

  const title = `${name} · ${serviceLabel}`;
  const description = `Submitted ${ageString(quote.created_at as string)} · ${total || 'no total'}`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <RecordPage>
      <RecordHeader
        eyebrow="Quote"
        title={title}
        description={description}
        backHref="/dashboard/quotes"
        backLabel="All Quotes"
        actions={
          <QuoteDetailActions
            quoteId={quote.id as string}
            status={rawStatus}
            stripeCheckoutUrl={(quote.stripe_checkout_url as string | null) ?? null}
            customerEmail={(quote.customer_email as string | null) ?? null}
          />
        }
      />

      <RecordMetaRow>
        <RecordMetaCard label="Status" value={status.label} tone={status.tone} />
        <RecordMetaCard label="Service" value={serviceLabel} />
        <RecordMetaCard label="Context" value={contextLabel} />
        <RecordMetaCard label="Total" value={total || '—'} />
      </RecordMetaRow>

      <RecordBody>
        <RecordMain>
          <RecordSection title="Customer Details">
            <div className="flex flex-col">
              <FieldRow label="Name" value={name} />
              <FieldRow label="Email" value={(quote.customer_email as string | null) ?? '—'} />
              <FieldRow label="Phone" value={(quote.customer_phone as string | null) ?? '—'} />
              {(quote.service_address as string | null) && (
                <FieldRow label="Address" value={quote.service_address as string} />
              )}
            </div>
          </RecordSection>

          <RecordSection title="Service Scope">
            <div className="flex flex-col">
              <FieldRow label="Service" value={serviceLabel} />
              <FieldRow label="Context" value={contextLabel} />
              {(quote.frequency as string | null) && quote.frequency !== 'none' && (
                <FieldRow
                  label="Frequency"
                  value={
                    FREQUENCY_LABELS[quote.frequency as keyof typeof FREQUENCY_LABELS] ??
                    cap(quote.frequency as string)
                  }
                />
              )}
              {(quote.scope as string | null) && (
                <FieldRow label="Scope" value={quote.scope as string} />
              )}
              {(quote.source as string | null) && (
                <FieldRow label="Source" value={cap(quote.source as string)} />
              )}
            </div>
          </RecordSection>

          <RecordSection title="Pricing">
            <div className="flex flex-col">
              <FieldRow
                label="Submitted Total"
                value={`$${Number(quote.submitted_total ?? quote.total ?? 0).toFixed(2)}`}
              />
              {(quote.reviewed_total as number | null) != null && (
                <FieldRow
                  label="Reviewed Total"
                  value={`$${Number(quote.reviewed_total).toFixed(2)}`}
                />
              )}
              <FieldRow label="Effective Total" value={total || '—'} />
              {(quote.payment_status as string | null) && (
                <FieldRow
                  label="Payment Status"
                  value={cap(String(quote.payment_status).replace(/_/g, ' '))}
                />
              )}
              {(quote.finalized_by as string | null) && (
                <FieldRow label="Approved By" value={quote.finalized_by as string} />
              )}
              {(quote.finalized_at as string | null) && (
                <FieldRow label="Approved At" value={fmtDateShort(quote.finalized_at as string)} />
              )}
            </div>
          </RecordSection>

          {contextRaw === 'ndis' && (
            <RecordSection title="NDIS Details">
              <div className="flex flex-col">
                {(quote.ndis_management_type as NdisManagementType | null) && (
                  <FieldRow
                    label="Management Type"
                    value={NDIS_MGMT_LABELS[quote.ndis_management_type as NdisManagementType]}
                  />
                )}
                {(quote.ndis_estimated_hours as number | null) != null && (
                  <FieldRow
                    label="Estimated Hours"
                    value={`${Number(quote.ndis_estimated_hours).toFixed(1)} hr`}
                  />
                )}
                {(quote.ndis_hourly_rate as number | null) != null && (
                  <FieldRow
                    label="Hourly Rate"
                    value={`$${Number(quote.ndis_hourly_rate).toFixed(2)}/hr`}
                  />
                )}
                {(quote.ndis_forward_contact as string | null) && (
                  <FieldRow label="Forward Contact" value={quote.ndis_forward_contact as string} />
                )}
                {(quote.ndis_forward_email as string | null) && (
                  <FieldRow label="Forward Email" value={quote.ndis_forward_email as string} />
                )}
                <FieldRow
                  label="Forwarded"
                  value={
                    (quote.ndis_forwarded_at as string | null)
                      ? `Yes · ${fmtDateShort(quote.ndis_forwarded_at as string)}`
                      : 'No'
                  }
                />
                <FieldRow
                  label="Accepted"
                  value={
                    (quote.ndis_accepted_at as string | null)
                      ? `Yes · ${fmtDateShort(quote.ndis_accepted_at as string)}`
                      : 'No'
                  }
                />
                <FieldRow
                  label="Booked"
                  value={
                    (quote.ndis_booked_at as string | null)
                      ? `Yes · ${fmtDateShort(quote.ndis_booked_at as string)}`
                      : 'No'
                  }
                />
              </div>
            </RecordSection>
          )}

          {(quote.notes as string | null) && (
            <RecordSection title="Notes">
              <p className="whitespace-pre-wrap text-sm" style={{ color: brand.text }}>
                {quote.notes as string}
              </p>
            </RecordSection>
          )}

          {rawStatus === 'cancelled' && (quote.cancellation_reason as string | null) && (
            <RecordSection title="Cancellation">
              <div className="flex flex-col">
                <FieldRow label="Reason" value={quote.cancellation_reason as string} />
                {(quote.cancelled_by as string | null) && (
                  <FieldRow label="Cancelled By" value={quote.cancelled_by as string} />
                )}
                {(quote.cancelled_at as string | null) && (
                  <FieldRow label="Cancelled At" value={fmtDateShort(quote.cancelled_at as string)} />
                )}
              </div>
            </RecordSection>
          )}
        </RecordMain>

        <RecordContext>
          {relatedOrder && (() => {
            const orderService =
              SERVICE_TYPE_LABELS[relatedOrder!.service_type as keyof typeof SERVICE_TYPE_LABELS] ??
              cap(relatedOrder!.service_type ?? 'Order');
            const orderTone: RecordTone =
              relatedOrder!.status === 'completed' ? 'success' :
              relatedOrder!.status === 'cancelled' ? 'danger' :
              'default';
            return (
              <RecordSection title="Related Order">
                <RelatedRecordCard
                  label="Order"
                  title={orderService}
                  href={`/dashboard/orders/${relatedOrder!.id}`}
                  status={cap(relatedOrder!.status)}
                  statusTone={orderTone}
                />
              </RecordSection>
            );
          })()}

          <RecordSection title="Timeline">
            <RecordTimeline events={timelineEvents} />
          </RecordSection>
        </RecordContext>
      </RecordBody>
    </RecordPage>
  );
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-black/5 py-2.5 last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </span>
      <span className="text-sm" style={{ color: brand.text }}>
        {value}
      </span>
    </div>
  );
}
