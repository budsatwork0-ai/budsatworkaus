import Link from 'next/link';
import { brand } from '@/app/ui/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecordTone = 'default' | 'success' | 'warning' | 'danger';

export type TimelineEvent = {
  label: string;
  timestamp: string;
  actor?: string;
  note?: string;
};

export type RelatedRecordProps = {
  label: string;
  title: string;
  href: string;
  status?: string;
  statusTone?: RecordTone;
};

const TONE: Record<RecordTone, { bg: string; text: string }> = {
  default: { bg: '#F8FAFC', text: '#475569' },
  success: { bg: '#ECFDF5', text: '#047857' },
  warning: { bg: '#FFFBEB', text: '#B45309' },
  danger:  { bg: '#FEF2F2', text: '#B91C1C' },
};

// ─── RecordPage ───────────────────────────────────────────────────────────────
// Outer wrapper. Drop this inside the dashboard page container.

export function RecordPage({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>;
}

// ─── RecordHeader ─────────────────────────────────────────────────────────────
// Eyebrow → Title → Description + optional back link + actions.
// Uses brand.accent for the eyebrow (not #10b981 like WorkbenchHeader).

export function RecordHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref,
  backLabel = 'Back',
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <section className="rounded-[28px] border border-black/5 bg-white/80 px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur">
      {backHref && (
        <div className="mb-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-700"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {backLabel}
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: brand.accent }}
          >
            {eyebrow}
          </p>
          <h1
            className="mt-2 text-2xl font-semibold tracking-[-0.025em]"
            style={{ color: brand.primary }}
          >
            {title}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm" style={{ color: brand.muted }}>
            {description}
          </p>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </section>
  );
}

// ─── RecordMetaCard ───────────────────────────────────────────────────────────
// Individual metadata cell. When tone is non-default the value renders as a
// colour-coded chip — use this for Status fields.

export function RecordMetaCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: RecordTone;
}) {
  const t = TONE[tone];
  return (
    <div className="rounded-2xl border border-black/5 bg-white/90 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      {tone === 'default' ? (
        <p className="mt-2 text-sm font-semibold" style={{ color: brand.text }}>
          {value}
        </p>
      ) : (
        <div className="mt-2">
          <span
            className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: t.bg, color: t.text }}
          >
            {value}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── RecordMetaRow ────────────────────────────────────────────────────────────
// 4-column metadata grid. Place 4 RecordMetaCards inside.

export function RecordMetaRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
  );
}

// ─── RecordBody ───────────────────────────────────────────────────────────────
// 2/3 + 1/3 layout. First child → main content. Second child → context sidebar.

export function RecordBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_300px]">{children}</div>
  );
}

// ─── RecordMain ───────────────────────────────────────────────────────────────
// Left content area inside RecordBody.

export function RecordMain({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>;
}

// ─── RecordSection ────────────────────────────────────────────────────────────
// Titled content section. Matches the CampaignFactoryClient section pattern.

export function RecordSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const base =
    'rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]';
  return (
    <section className={className ? `${base} ${className}` : base}>
      <h2 className="text-sm font-semibold" style={{ color: brand.text }}>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ─── RecordContext ────────────────────────────────────────────────────────────
// Right sidebar container inside RecordBody.

export function RecordContext({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>;
}

// ─── RecordTimeline ───────────────────────────────────────────────────────────
// Vertical timeline, newest event first. Renders inside a RecordSection.

export function RecordTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="flex flex-col">
      {events.map((event, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center pt-1.5">
            <div
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: i === 0 ? brand.accent : '#CBD5E1' }}
            />
            {i < events.length - 1 && (
              <div className="mt-1.5 w-px flex-1 bg-slate-100" style={{ minHeight: '20px' }} />
            )}
          </div>
          <div className={i < events.length - 1 ? 'min-h-[40px] pb-4' : ''}>
            <p className="text-sm font-medium" style={{ color: brand.text }}>
              {event.label}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {event.timestamp}
              {event.actor ? ` · ${event.actor}` : ''}
            </p>
            {event.note && (
              <p className="mt-1 text-xs" style={{ color: brand.muted }}>
                {event.note}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── RelatedRecordCard ────────────────────────────────────────────────────────
// Small linked card pointing to a related record. Always links — no modals.

export function RelatedRecordCard({
  label,
  title,
  href,
  status,
  statusTone = 'default',
}: RelatedRecordProps) {
  const t = TONE[statusTone];
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-black/5 bg-white p-3.5 transition hover:-translate-y-px hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: brand.muted }}
        >
          {label}
        </span>
        <span className="truncate text-sm font-semibold" style={{ color: brand.text }}>
          {title}
        </span>
      </div>
      <div className="ml-3 flex shrink-0 items-center gap-2">
        {status && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: t.bg, color: t.text }}
          >
            {status}
          </span>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-slate-300"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  );
}
