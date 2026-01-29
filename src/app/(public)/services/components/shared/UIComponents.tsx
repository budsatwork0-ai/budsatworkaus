import React from 'react';
import { M } from '../../utils/motion';
import { cls } from '../../utils/formatting';
import { IconWrap } from '../../utils/icons';
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

// Tile component for service selection
export function Tile({
  active,
  onClick,
  title,
  subtitle,
  icon,
  disabled,
}: {
  active?: boolean;
  onClick?: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <M.button
      onClick={() => !disabled && onClick?.()}
      className={cls(
        'relative w-full text-left rounded-2xl p-4 transition',
        glass,
        active ? 'ring-2 ring-[var(--accent)]' : 'ring-1 ring-black/10',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
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
      {active && !disabled && (
        <div
          className="absolute -top-2 -right-2 grid place-items-center w-7 h-7 rounded-full"
          style={{ background: 'var(--accent)' }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      )}
      <div className="flex items-center gap-4">
        <IconWrap>{icon}</IconWrap>
        <div>
          <div className="font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="text-xs text-slate-700">{subtitle}</div> : null}
          {disabled && <div className="text-[11px] text-slate-600 mt-1">Not covered in this context</div>}
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
