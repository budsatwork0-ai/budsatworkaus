'use client';

import type { Dispatch, SetStateAction } from 'react';
import type {
  IroningItem,
  IroningItemType,
  LaundryPerLoadAddOn,
  LaundryPerOrderAddOn,
  WizardState,
} from '../../types';
import {
  LAUNDRY_IRONING_PRICES,
  LAUNDRY_PER_LOAD_ADDONS,
  LAUNDRY_PER_ORDER_ADDONS,
} from '../../lib/pricing/constants';
import { cls } from '../../utils/formatting';

interface LaundryPanelProps {
  laundryLoads: number;
  laundryPerLoadAddOns: LaundryPerLoadAddOn[];
  laundryPerOrderAddOns: LaundryPerOrderAddOn[];
  laundryIroningItems: IroningItem[];
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  ironingOpen: boolean;
  setIroningOpen: Dispatch<SetStateAction<boolean>>;
  addOnTotal: number;
  priceLabel: string;
}

export function LaundryPanel({
  laundryLoads,
  laundryPerLoadAddOns,
  laundryPerOrderAddOns,
  laundryIroningItems,
  set,
  ironingOpen,
  setIroningOpen,
  addOnTotal,
  priceLabel,
}: LaundryPanelProps) {
  return (
    <div
      data-card-interactive="true"
      className="rounded-xl border border-black/5 bg-white/80 p-3 space-y-3"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Service type — single pre-selected pill */}
      <div>
        <div className="text-xs text-slate-500 mb-1.5">Service type</div>
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-3 py-1.5 text-sm">
          <span>Wash &amp; Fold</span>
          <span className="text-emerald-100 text-xs">$30/load</span>
        </span>
      </div>

      {/* Load counter */}
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-700">How many loads? <span className="text-xs text-slate-500">(~5kg each)</span></span>
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
          <button
            type="button"
            className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
            onClick={(e) => { e.stopPropagation(); set('laundryLoads', Math.max(1, laundryLoads - 1)); }}
            aria-label="Decrease loads"
          >–</button>
          <span className="min-w-[24px] text-center font-semibold">{laundryLoads}</span>
          <button
            type="button"
            className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
            onClick={(e) => { e.stopPropagation(); set('laundryLoads', Math.min(10, laundryLoads + 1)); }}
            aria-label="Increase loads"
          >+</button>
        </div>
      </div>

      {/* Add-ons */}
      <div>
        <div className="text-xs text-slate-500 mb-1.5">Add-ons <span className="text-slate-400">(optional)</span></div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(LAUNDRY_PER_LOAD_ADDONS) as [LaundryPerLoadAddOn, { label: string; price: number }][]).map(([key, meta]) => {
            const active = laundryPerLoadAddOns.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  set('laundryPerLoadAddOns', active ? laundryPerLoadAddOns.filter((k) => k !== key) : [...laundryPerLoadAddOns, key]);
                }}
                className={cls(
                  'rounded-full border px-2.5 py-1 text-xs flex items-center gap-1',
                  active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10 hover:border-emerald-300',
                )}
              >
                {meta.label}
                <span className={active ? 'text-emerald-100' : 'text-slate-400'}>+${meta.price}/load</span>
              </button>
            );
          })}
          {(Object.entries(LAUNDRY_PER_ORDER_ADDONS) as [LaundryPerOrderAddOn, { label: string; price: number }][]).map(([key, meta]) => {
            const active = laundryPerOrderAddOns.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  set('laundryPerOrderAddOns', active ? laundryPerOrderAddOns.filter((k) => k !== key) : [...laundryPerOrderAddOns, key]);
                }}
                className={cls(
                  'rounded-full border px-2.5 py-1 text-xs flex items-center gap-1',
                  active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10 hover:border-emerald-300',
                )}
              >
                {meta.label}
                <span className={active ? 'text-emerald-100' : 'text-slate-400'}>+${meta.price}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ironing toggle */}
      <div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIroningOpen((v) => !v); }}
          className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
        >
          <span>{ironingOpen ? '▼' : '▶'}</span>
          <span>Add ironing items</span>
        </button>
        {ironingOpen && (
          <div className="mt-2 space-y-2">
            {(Object.entries(LAUNDRY_IRONING_PRICES) as [IroningItemType, { label: string; price: number }][]).map(([type, meta]) => {
              const item = laundryIroningItems.find((i) => i.type === type);
              const count = item?.count ?? 0;
              const setCount = (n: number) => {
                const items: IroningItem[] = laundryIroningItems.filter((i) => i.type !== type);
                if (n > 0) items.push({ type, count: n });
                set('laundryIroningItems', items);
              };
              return (
                <div key={type} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-700">{meta.label} <span className="text-slate-400">${meta.price}/item</span></span>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-1.5 py-0.5">
                    <button
                      type="button"
                      className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10 hover:bg-slate-50 text-[11px]"
                      onClick={(e) => { e.stopPropagation(); setCount(Math.max(0, count - 1)); }}
                      aria-label={`Decrease ${meta.label}`}
                    >–</button>
                    <span className="min-w-[20px] text-center font-semibold">{count}</span>
                    <button
                      type="button"
                      className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10 hover:bg-slate-50 text-[11px]"
                      onClick={(e) => { e.stopPropagation(); setCount(count + 1); }}
                      aria-label={`Increase ${meta.label}`}
                    >+</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live estimated total */}
      {addOnTotal > 0 && (
        <div className="text-xs text-slate-600 font-medium">
          Estimated: {priceLabel} <span className="text-slate-400">(excl. fees)</span>
        </div>
      )}

      {/* Footer notes */}
      <div className="text-[11px] text-slate-500 space-y-0.5">
        <div>Minimum service $60 (pickup &amp; delivery for up to 2 loads) · fees shown at checkout</div>
        <div>Loads are ~5kg each. Overweight or bulky items may count as an extra load — we&apos;ll confirm any changes before washing.</div>
      </div>
    </div>
  );
}
