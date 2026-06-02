'use client';

import Link from 'next/link';
import { dashboardTheme } from '@/lib/design-system/themes';

export type WorkbenchTone = 'emerald' | 'blue' | 'amber' | 'red' | 'slate';

export type WorkbenchStat = {
  label: string;
  value: string;
  detail?: string;
  tone?: WorkbenchTone;
};

export type WorkbenchTab<T extends string> = {
  key: T;
  label: string;
  count?: number;
};

export type WorkbenchQueueItem = {
  key: string;
  title: string;
  detail: string;
  tone?: WorkbenchTone;
  actionLabel?: string;
  href?: string;
  onAction?: () => void;
};

const TONE_STYLES: Record<WorkbenchTone, { bg: string; fg: string; ring: string }> = {
  emerald: { bg: '#ECFDF5', fg: '#047857', ring: 'rgba(16,185,129,0.18)' },
  blue: { bg: '#EFF6FF', fg: '#1D4ED8', ring: 'rgba(59,130,246,0.18)' },
  amber: { bg: '#FFFBEB', fg: '#B45309', ring: 'rgba(245,158,11,0.18)' },
  red: { bg: '#FEF2F2', fg: '#B91C1C', ring: 'rgba(239,68,68,0.18)' },
  slate: { bg: '#F8FAFC', fg: '#475569', ring: 'rgba(100,116,139,0.14)' },
};

export function WorkbenchHeader({
  eyebrow = 'Workspace',
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-black/5 bg-white/80 px-5 py-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#10b981' }}>
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]" style={{ color: dashboardTheme.color.primary }}>
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function WorkbenchStatGrid({ stats }: { stats: WorkbenchStat[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const tone = TONE_STYLES[stat.tone ?? 'slate'];
        return (
          <div
            key={stat.label}
            className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-slate-900">{stat.value}</p>
            {stat.detail ? (
              <div className="mt-3">
                <span
                  className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ background: tone.bg, color: tone.fg }}
                >
                  {stat.detail}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function WorkbenchTabs<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: Array<WorkbenchTab<T>>;
  activeTab: T;
  onTabChange: (next: T) => void;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/85 p-1">
      <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-none xl:auto-cols-fr xl:grid-flow-col">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className="rounded-xl px-4 py-3 text-left transition"
              style={isActive ? { background: dashboardTheme.color.primary, color: '#fff' } : { color: dashboardTheme.color.muted }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{tab.label}</span>
                {typeof tab.count === 'number' ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={isActive ? { background: 'rgba(255,255,255,0.18)', color: '#fff' } : { background: '#F1F5F9', color: '#475569' }}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorkbenchQueue({
  title = 'Focus Queue',
  subtitle,
  items,
}: {
  title?: string;
  subtitle?: string;
  items: WorkbenchQueueItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-[24px] border border-black/5 bg-white/90 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {items.map((item) => {
          const tone = TONE_STYLES[item.tone ?? 'slate'];
          const content = (
            <>
              <span
                className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: tone.bg, color: tone.fg, boxShadow: `inset 0 0 0 1px ${tone.ring}` }}
              >
                Focus
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{item.detail}</p>
              {item.actionLabel ? (
                <span className="mt-3 inline-flex text-xs font-semibold" style={{ color: tone.fg }}>
                  {item.actionLabel} →
                </span>
              ) : null}
            </>
          );

          const className = 'rounded-[20px] border border-black/5 bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(15,61,46,0.08)]';

          if (item.href) {
            return (
              <Link key={item.key} href={item.href} className={className}>
                {content}
              </Link>
            );
          }

          return (
            <button key={item.key} type="button" onClick={item.onAction} className={className}>
              {content}
            </button>
          );
        })}
      </div>
    </section>
  );
}
