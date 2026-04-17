import React from 'react';
import { M } from '../../utils/motion';
import { cls } from '../../utils/formatting';
import { glass } from '../../lib/pricing/constants';

// Helper for glass card styling
export const glassCard = (active: boolean = false) =>
  cls(
    'rounded-2xl p-4 cursor-pointer select-none',
    glass,
    active ? 'ring-2 ring-[var(--accent)]' : 'ring-1 ring-black/10'
  );

// Disclaimer component
const TERMS_SNIPPET =
  'Quoted prices are estimates based on typical conditions. Final pricing may vary after on-site inspection. We reserve the right to adjust quotes for exceptional circumstances.';

export function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl p-4 ${glass} text-xs leading-relaxed text-slate-700 ${className}`}>
      <span className="font-medium text-slate-900">Disclaimer:</span> {TERMS_SNIPPET}
    </div>
  );
}

// Tile component for service selection — Apple-style vertical card
export function Tile({
  active,
  onClick,
  title,
  subtitle,
  icon,
  disabled,
  popular,
  from,
}: {
  active?: boolean;
  onClick?: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  disabled?: boolean;
  popular?: boolean;
  from?: string;
}) {
  return (
    <M.button
      onClick={() => !disabled && onClick?.()}
      className={cls(
        'relative w-full min-w-0 text-left rounded-3xl py-6 px-5 transition-all duration-200',
        'bg-white border',
        active
          ? 'border-[color:var(--accent)] shadow-[0_4px_24px_rgba(15,61,46,0.14)]'
          : 'border-black/[0.07] shadow-[0_2px_8px_rgba(2,6,23,0.05)] hover:shadow-[0_4px_20px_rgba(2,6,23,0.10)] hover:border-black/[0.12]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      )}
      aria-label={`Select ${title}`}
      title={disabled ? 'Not available in this context' : `Select ${title}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-disabled={disabled || undefined}
    >
      {/* Popular badge */}
      {popular && !disabled && !active && (
        <div
          className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          Popular
        </div>
      )}
      {/* Active checkmark */}
      {active && !disabled && (
        <div
          className="absolute top-3 right-3 grid place-items-center w-6 h-6 rounded-full"
          style={{ background: 'var(--accent)' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      )}
      {/* Vertical layout: icon → title → subtitle → price */}
      <div className="flex flex-col items-start gap-3">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
          style={{
            background: active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : '#f4f6f8',
          }}
        >
          {icon}
        </div>
        <div className="space-y-0.5">
          <div className="font-semibold text-[15px] text-slate-900 leading-snug">{title}</div>
          {subtitle && <div className="text-[12px] text-slate-500 leading-snug">{subtitle}</div>}
          {from && !disabled && (
            <div className="text-[12px] font-medium pt-1" style={{ color: 'var(--accent)' }}>from {from}</div>
          )}
        </div>
      </div>
    </M.button>
  );
}

// Numeric input component
export function NumCell({
  label,
  value,
  onChange,
  short,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  short?: boolean;
}) {
  return (
    <div className="col-span-2 flex items-center gap-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <span className={cls(short ? 'w-14' : 'w-16', 'text-xs text-slate-600')}>{label}</span>
        <span title={label} className="text-[10px] px-1.5 py-0.5 rounded bg-black/5">
          i
        </span>
      </label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-16 text-sm px-2 py-1 rounded-xl border border-black/10 bg-white/80 text-center"
      />
    </div>
  );
}

// Quantity chip selector
export function QtyChips({
  label,
  value,
  onChange,
  options = [0, 6, 12, 18, 24, 30],
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  options?: number[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-20 text-slate-700">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((n) => (
          <button
            key={n}
            className={cls(
              'px-2 py-1 rounded-lg border text-xs',
              value === n ? 'border-[color:var(--accent)] bg-white' : 'border-black/10 bg-white/70'
            )}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// Generic picker card
export function PickerCard<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: string) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <div className={glassCard()}>
      <div className="text-sm font-medium mb-2 text-slate-900">{label}</div>
      <select
        className="rounded border px-2 py-1 text-sm"
        value={value as any}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={`${o.v}`} value={o.v as any}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
