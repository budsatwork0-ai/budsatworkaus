'use client';

// -----------------------------------------------------------------------------
// Bud Leads — dark cinematic primitives
// -----------------------------------------------------------------------------
// Small, composable building blocks shared by every Bud Leads module.
// Pure presentational — no business logic. They consume tokens from
// `@/app/ui/theme` and stay class-string based per the CLAUDE.md contract.
// -----------------------------------------------------------------------------

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { dashboardTheme } from '@/lib/design-system/themes';
import { cx } from '@/app/ui/theme';
import type { LeadSource, LeadTemperature } from '../lib/types';

// ---- Panel --------------------------------------------------------------

export function NightPanel({
  title,
  subtitle,
  right,
  children,
  className = '',
  pad = 'md',
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: 'sm' | 'md' | 'lg';
}) {
  const padCls = pad === 'sm' ? 'p-4' : pad === 'lg' ? 'p-7' : 'p-5';
  return (
    <section className={cx(dashboardTheme.night!.panel, padCls, className)}>
      {(title || right) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? <h3 className="text-sm font-semibold tracking-tight text-white">{title}</h3> : null}
            {subtitle ? <p className="mt-0.5 text-xs leading-5 text-[color:var(--night-muted)]" style={{ color: dashboardTheme.night!.color.muted }}>{subtitle}</p> : null}
          </div>
          {right ? <div className="text-[11px] font-medium text-[color:var(--night-muted)]" style={{ color: dashboardTheme.night!.color.muted }}>{right}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}

// ---- Divider ------------------------------------------------------------

export function NightDivider({ className = '' }: { className?: string }) {
  return <div className={cx(dashboardTheme.night!.divider, className)} />;
}

// ---- Chip ---------------------------------------------------------------

export function NightChip({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'hot' | 'warm' | 'cold' | 'lost';
  className?: string;
}) {
  if (tone === 'neutral') {
    return <span className={cx(dashboardTheme.night!.chip, className)}>{children}</span>;
  }

  if (tone === 'accent') {
    return (
      <span
        className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', className)}
        style={{
          background: 'rgba(28,124,84,0.15)',
          color: '#7CE0B0',
          borderColor: 'rgba(28,124,84,0.35)',
        }}
      >
        {children}
      </span>
    );
  }

  const upper = tone.toUpperCase() as LeadTemperature;
  const t = dashboardTheme.night!.tempTone[upper];
  return (
    <span
      className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', className)}
      style={{ background: t.bg, color: t.text, borderColor: t.ring }}
    >
      {children}
    </span>
  );
}

// ---- Temperature badge --------------------------------------------------

export function TemperatureBadge({
  temperature,
  pulse,
  size = 'md',
}: {
  temperature: LeadTemperature;
  pulse?: boolean;
  size?: 'sm' | 'md';
}) {
  const t = dashboardTheme.night!.tempTone[temperature];
  const dim = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  const textCls = size === 'sm' ? 'text-[10px]' : 'text-[11px]';
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold tracking-[0.06em]',
        textCls
      )}
      style={{ background: t.bg, color: t.text, borderColor: t.ring }}
    >
      <span className="relative inline-flex">
        <span className={cx('inline-block rounded-full', dim)} style={{ background: t.text }} />
        {pulse && temperature === 'HOT' ? (
          <motion.span
            aria-hidden
            className={cx('absolute inset-0 rounded-full', dim)}
            style={{ background: t.text }}
            initial={{ opacity: 0.7, scale: 1 }}
            animate={{ opacity: 0, scale: 2.6 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />
        ) : null}
      </span>
      {temperature}
    </span>
  );
}

// ---- Source glyph -------------------------------------------------------

const SOURCE_GLYPH: Record<LeadSource, string> = {
  website: '◐',
  messenger: '⌬',
  sms: '✦',
  instagram: '◇',
  email: '✉',
  phone: '☏',
  referral: '⇄',
  unknown: '·',
};

const SOURCE_LABEL: Record<LeadSource, string> = {
  website: 'Website',
  messenger: 'Messenger',
  sms: 'SMS',
  instagram: 'Instagram',
  email: 'Email',
  phone: 'Phone',
  referral: 'Referral',
  unknown: 'Unknown',
};

export function SourceTag({ source, className = '' }: { source: LeadSource; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium',
        className
      )}
      style={{ color: dashboardTheme.night!.color.muted }}
    >
      <span aria-hidden style={{ color: dashboardTheme.night!.color.accent }}>{SOURCE_GLYPH[source]}</span>
      {SOURCE_LABEL[source]}
    </span>
  );
}

// ---- Stat -----------------------------------------------------------------

export function NightStat({
  label,
  value,
  hint,
  tone = 'neutral',
  size = 'md',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'accent' | 'warning' | 'critical';
  size?: 'sm' | 'md' | 'lg';
}) {
  const toneColor =
    tone === 'accent' ? '#7CE0B0' : tone === 'warning' ? '#FFD089' : tone === 'critical' ? '#FF8A78' : dashboardTheme.night!.color.text;
  const valueSize = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-2xl';
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.18em]" style={{ color: dashboardTheme.night!.color.subtle }}>{label}</p>
      <p className={cx('mt-2 font-semibold tracking-tight', valueSize)} style={{ color: toneColor }}>{value}</p>
      {hint ? <p className="mt-1 text-[11px]" style={{ color: dashboardTheme.night!.color.muted }}>{hint}</p> : null}
    </div>
  );
}

// ---- Empty state --------------------------------------------------------

export function NightEmpty({
  title,
  detail,
  icon,
}: {
  title: string;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center"
      style={{ borderColor: dashboardTheme.night!.color.border, background: 'rgba(255,255,255,0.015)' }}
    >
      {icon ? <div className="mb-3" style={{ color: dashboardTheme.night!.color.subtle }}>{icon}</div> : null}
      <p className="text-sm font-semibold" style={{ color: dashboardTheme.night!.color.text }}>{title}</p>
      {detail ? <p className="mt-1.5 max-w-sm text-xs leading-5" style={{ color: dashboardTheme.night!.color.muted }}>{detail}</p> : null}
    </div>
  );
}

// ---- Pulse dot (for HOT rows) -------------------------------------------

export function PulseDot({ tone = 'hot' as 'hot' | 'warm' }: { tone?: 'hot' | 'warm' }) {
  const color = tone === 'hot' ? dashboardTheme.night!.color.hot : dashboardTheme.night!.color.warm;
  return (
    <span className="relative inline-flex h-2 w-2">
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{ background: color }}
        initial={{ opacity: 0.6, scale: 1 }}
        animate={{ opacity: 0, scale: 3 }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
      />
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}
