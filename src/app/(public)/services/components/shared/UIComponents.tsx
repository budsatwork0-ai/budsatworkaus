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
  variant = 'default',
  tapHint = false,
}: {
  active?: boolean;
  onClick?: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  disabled?: boolean;
  popular?: boolean;
  from?: string;
  variant?: 'default' | 'feature';
  tapHint?: boolean;
}) {
  const isFeature = variant === 'feature';
  return (
    <M.button
      onClick={() => !disabled && onClick?.()}
      className={cls(
        'relative w-full min-w-0 text-left border',
        isFeature ? 'rounded-[30px] px-7 py-8 min-h-[220px]' : 'rounded-3xl py-6 px-5',
        active
          ? 'border-[color:var(--accent)] shadow-[0_4px_20px_rgba(15,61,46,0.12)]'
          : 'border-black/[0.07] shadow-[0_2px_8px_rgba(2,6,23,0.04)] hover:shadow-[0_6px_22px_rgba(2,6,23,0.09)] hover:border-black/[0.11]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      )}
      style={{
        background: active ? 'color-mix(in srgb, var(--accent) 5%, #fff)' : '#fff',
        transition: 'box-shadow 180ms cubic-bezier(0.25,0.46,0.45,0.94), border-color 180ms cubic-bezier(0.25,0.46,0.45,0.94), background 180ms cubic-bezier(0.25,0.46,0.45,0.94)',
      }}
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
      <div className={cls('flex flex-col items-start', isFeature ? 'gap-5' : 'gap-3')}>
        <div
          className={cls(
            'flex items-center justify-center shrink-0',
            isFeature ? 'h-16 w-16 rounded-[22px] text-[28px]' : 'w-11 h-11 rounded-2xl text-xl'
          )}
          style={{
            background: active ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : '#f3f4f6',
            transition: 'background 180ms ease-in-out',
          }}
        >
          {icon}
        </div>
        <div className={cls(isFeature ? 'space-y-1.5' : 'space-y-0.5')}>
          <div className={cls('font-semibold text-slate-900 leading-snug', isFeature ? 'text-[22px]' : 'text-[15px]')}>
            {title}
          </div>
          {subtitle && (
            <div
              className={cls('leading-snug', isFeature ? 'text-[14px] max-w-[24ch]' : 'text-[12px]')}
              style={{ color: 'rgba(100,116,139,0.75)' }}
            >
              {subtitle}
            </div>
          )}
          {from && !disabled && (
            <div className={cls('font-semibold pt-1', isFeature ? 'text-[15px]' : 'text-[12px]')} style={{ color: 'var(--accent)' }}>
              {/^\$/.test(from) ? `from ${from}` : from}
            </div>
          )}
        </div>
      </div>
      {/* Tap affordance indicator — visible on mobile when no card has been selected yet */}
      {tapHint && !active && !disabled && (
        <div
          className="absolute bottom-3 right-3 flex items-center gap-0.5 text-[10px] font-medium opacity-50"
          style={{ color: 'var(--accent)' }}
          aria-hidden="true"
        >
          Select
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      )}
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
