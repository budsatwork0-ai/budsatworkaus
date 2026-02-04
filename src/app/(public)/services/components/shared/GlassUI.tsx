// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { CommFrequency } from '../../types';
import { cls } from '../../utils/formatting';

/* ===== a11y / keyboard helper ===== */

export const asButtonProps = (onActivate: () => void, ariaLabel: string) => ({
  role: 'button' as const,
  tabIndex: 0,
  'aria-label': ariaLabel,
  onClick: onActivate,
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onActivate();
    }
  },
});

/* ===== Glass primitives ===== */

export const GlassCard = ({ className = '', children }: { className?: string; children: React.ReactNode }) => (
  <div
    className={cls(
      'rounded-2xl p-5 border border-white/40 bg-white/60 backdrop-blur-2xl shadow-[0_10px_30px_rgba(2,6,23,0.10)]',
      className
    )}
  >
    {children}
  </div>
);

export const KPI = ({ label, value, foot }: { label: string; value: string; foot?: string }) => (
  <div className="rounded-xl border border-white/50 bg-white/70 px-4 py-3 text-slate-900">
    <div className="text-[11px] uppercase tracking-wide text-slate-600">{label}</div>
    <div className="text-xl font-semibold mt-0.5">{value}</div>
    {foot ? <div className="text-[11px] text-slate-600 mt-0.5">{foot}</div> : null}
  </div>
);

export const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-white/70 border border-white/50 text-slate-800">
    {children}
  </span>
);

export const Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <div className="flex items-center justify-between">
    <div className={cls('text-sm', bold ? 'font-medium text-slate-900' : 'text-slate-600')}>{k}</div>
    <div className={cls('text-sm', bold ? 'font-semibold text-slate-900' : 'text-slate-800')}>{v}</div>
  </div>
);

export const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm font-medium text-slate-900">{children}</div>
);

export const Caret = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" className="opacity-70">
    <path
      d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ===== Minimal S3_* components (Step 3 sidebar/form) ===== */

export const S3_Card = ({ className = '', children }: { className?: string; children: React.ReactNode }) => (
  <div className={cls('rounded-2xl p-4 border border-black/10 bg-white/80', className)}>{children}</div>
);

export const S3_Title = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm font-medium text-slate-900">{children}</div>
);

export const S3_Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <div className="flex items-center justify-between py-1">
    <div className={cls('text-sm', bold ? 'font-medium text-slate-900' : 'text-slate-600')}>{k}</div>
    <div className={cls('text-sm', bold ? 'font-semibold text-slate-900' : 'text-slate-800')}>{v}</div>
  </div>
);

export const S3_Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-white/80 border border-white/40 text-slate-800">
    {children}
  </span>
);

/* ===== Frequency labels for display ===== */

export const FREQ_LABELS: Record<CommFrequency, string> = {
  none: 'One-off',
  daily: 'Daily',
  '3x_weekly': '3× Weekly',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
};

export const getFrequencyLabel = (freq: CommFrequency | undefined): string => {
  if (!freq || freq === 'none') return 'One-off';
  return FREQ_LABELS[freq] ?? 'One-off';
};
