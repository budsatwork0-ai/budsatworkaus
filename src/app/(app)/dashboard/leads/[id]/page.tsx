import { notFound } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { SERVICE_LABELS } from '@/types/dashboard';
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
import { LeadDetailActions } from './LeadDetailActions';

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

const STATUS_MAP: Record<string, { label: string; tone: RecordTone }> = {
  awaiting_response: { label: 'Awaiting Response', tone: 'warning' },
  in_conversation:   { label: 'In Conversation',   tone: 'warning' },
  no_response:       { label: 'No Response',        tone: 'danger'  },
  quoted:            { label: 'Quoted',             tone: 'default' },
  booked:            { label: 'Booked',             tone: 'success' },
  completed:         { label: 'Completed',          tone: 'success' },
  lost:              { label: 'Lost',               tone: 'danger'  },
};

function statusDisplay(raw: string): { label: string; tone: RecordTone } {
  return STATUS_MAP[raw] ?? { label: cap(raw.replace(/_/g, ' ')), tone: 'default' };
}

const QUOTE_STATUS_MAP: Record<string, { label: string; tone: RecordTone }> = {
  submitted:       { label: 'Submitted',        tone: 'default'  },
  in_review:       { label: 'In Review',        tone: 'warning'  },
  finalized:       { label: 'Quote Sent',       tone: 'warning'  },
  payment_pending: { label: 'Awaiting Payment', tone: 'warning'  },
  paid:            { label: 'Paid',             tone: 'success'  },
  cancelled:       { label: 'Cancelled',        tone: 'danger'   },
  declined:        { label: 'Declined',         tone: 'danger'   },
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageProps = { params: Promise<{ id: string }> };

export default async function LeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') notFound();

  const client = createServiceClientSafe();
  if (!client) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lead, error } = await (client as any)
    .from('leads')
    .select(
      'id, customer_name, customer_email, customer_phone,' +
      'service_type, suburb, service_address, source,' +
      'response_status, temperature, quote_id,' +
      'first_response_at, booked_at, completed_at, lost_at,' +
      'created_at, updated_at',
    )
    .eq('id', id)
    .single();

  if (error || !lead) notFound();

  // Fetch related quote only when a quote_id exists.
  let relatedQuote: {
    id: string;
    status: string;
    customer_name: string | null;
    reviewed_total: number | null;
    submitted_total: number | null;
    total: number | null;
  } | null = null;

  if (lead.quote_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (client as any)
      .from('quotes')
      .select('id, status, customer_name, reviewed_total, submitted_total, total')
      .eq('id', lead.quote_id)
      .maybeSingle();
    relatedQuote = data ?? null;
  }

  // ── Derived values ───────────────────────────────────────────────────────

  const serviceSlug = (lead.service_type as string | null) ?? 'other';
  const serviceLabel = SERVICE_LABELS[serviceSlug] ?? cap(serviceSlug);
  const sourceName = cap(String(lead.source ?? 'unknown'));
  const responseStatus = String(lead.response_status ?? 'awaiting_response');
  const status = statusDisplay(responseStatus);

  const name = (lead.customer_name as string | null) ?? 'Unnamed';
  const email = (lead.customer_email as string | null) ?? null;
  const phone = (lead.customer_phone as string | null) ?? null;
  const suburb = (lead.suburb as string | null) ?? null;
  const address = (lead.service_address as string | null) ?? null;
  const createdAt = lead.created_at as string;

  // ── Timeline (newest event first) ────────────────────────────────────────

  const timelineEvents: TimelineEvent[] = [];

  if (lead.lost_at) {
    timelineEvents.push({ label: 'Marked as lost', timestamp: fmtDateTime(lead.lost_at as string) });
  }
  if (lead.completed_at) {
    timelineEvents.push({ label: 'Job completed', timestamp: fmtDateTime(lead.completed_at as string) });
  }
  if (lead.booked_at) {
    timelineEvents.push({ label: 'Booked', timestamp: fmtDateTime(lead.booked_at as string) });
  }
  if (lead.first_response_at) {
    timelineEvents.push({
      label: 'First response sent',
      timestamp: fmtDateTime(lead.first_response_at as string),
      actor: 'Admin',
    });
  }
  timelineEvents.push({
    label: 'Enquiry received',
    timestamp: fmtDateTime(createdAt),
    actor: sourceName,
  });

  const title = `${name} · ${serviceLabel}`;
  const description = `Received ${ageString(createdAt)} · via ${sourceName}`;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <RecordPage>
      <RecordHeader
        eyebrow="Enquiry"
        title={title}
        description={description}
        backHref="/dashboard/leads"
        backLabel="All Enquiries"
        actions={
          <LeadDetailActions
            leadId={lead.id as string}
            responseStatus={responseStatus}
            hasQuote={!!lead.quote_id}
          />
        }
      />

      <RecordMetaRow>
        <RecordMetaCard label="Status" value={status.label} tone={status.tone} />
        <RecordMetaCard label="Service" value={serviceLabel} />
        <RecordMetaCard label="Source" value={sourceName} />
        <RecordMetaCard label="Received" value={fmtDateShort(createdAt)} />
      </RecordMetaRow>

      <RecordBody>
        <RecordMain>
          <RecordSection title="Contact Details">
            <div className="flex flex-col">
              <FieldRow label="Name" value={name} />
              <FieldRow label="Email" value={email ?? '—'} />
              <FieldRow label="Phone" value={phone ?? '—'} />
            </div>
          </RecordSection>

          <RecordSection title="Enquiry Details">
            <div className="flex flex-col">
              <FieldRow label="Service" value={serviceLabel} />
              {suburb && <FieldRow label="Suburb" value={suburb} />}
              {address && <FieldRow label="Address" value={address} />}
              {!suburb && !address && (
                <p className="py-2 text-sm text-slate-400">No location provided.</p>
              )}
            </div>
          </RecordSection>
        </RecordMain>

        <RecordContext>
          {relatedQuote && (() => {
            const qs = quoteStatusDisplay(relatedQuote!.status);
            const total = quoteTotal(relatedQuote!);
            return (
              <RecordSection title="Related Quote">
                <RelatedRecordCard
                  label={total ? `Quote · ${total}` : 'Quote'}
                  title={relatedQuote!.customer_name ?? name}
                  href={`/dashboard/quotes/${relatedQuote!.id}`}
                  status={qs.label}
                  statusTone={qs.tone}
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
