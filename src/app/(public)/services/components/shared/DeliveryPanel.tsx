'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { DeliverySelection, WizardState } from '../../types';
import { DEFAULT_DUMP_DELIVERY } from '../../lib/pricing/constants';
import { calcDeliveryQuote } from '../../lib/pricing/transport';
import { cls, fmtAUD } from '../../utils/formatting';
import type { RouteSlot } from './ScopeCard.types';

const DistanceRouteConfigurator = dynamic(
  () => import('../dump/DistanceRouteConfigurator').then(m => ({ default: m.DistanceRouteConfigurator })),
  { ssr: false }
);

interface DeliveryPanelProps {
  S: WizardState;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  routeSlot: RouteSlot;
}

export function DeliveryPanel({ S, set, routeSlot }: DeliveryPanelProps) {
  const {
    expanded: routeExpanded, setExpanded: setRouteExpanded,
    lookup: routeLookup, loading: routeLookupLoading,
    message: routeLookupMessage, distanceLabel: routeDistanceLabel,
    onFocusChange: handleDistanceInputFocusChange,
    onPlaceSelected: handleDistancePlaceSelected,
  } = routeSlot;

  const deliveryState = S.dumpDelivery || DEFAULT_DUMP_DELIVERY;
  const deliveryType  = deliveryState.itemType;
  const deliveryAssist = deliveryState.assist;
  const updateDelivery = (next: Partial<DeliverySelection>) =>
    set('dumpDelivery', { ...deliveryState, ...next });

  const [deliveryItemQty, setDeliveryItemQty] = React.useState(1);

  return (
    <div
      data-card-interactive="true"
      className="rounded-xl border border-black/5 bg-white/90 p-4 shadow-sm space-y-4"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div>
        <div className="font-semibold text-slate-900">Delivery Details</div>
        <div className="text-[11px] text-slate-500 mt-0.5">Tell us what you need delivered</div>
      </div>

      {/* Step 1: What + how many */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">1</span>
          What are you delivering?
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { key: 'parcel', label: 'Small box / parcel', desc: 'Fits in a car', icon: '📦' },
            { key: 'household', label: 'Household item', desc: 'Chair, table, etc.', icon: '🪑' },
            { key: 'mattress', label: 'Mattress / bed', desc: 'Weather protected', icon: '🛏️' },
            { key: 'groceries', label: 'Groceries', desc: 'Kept shaded', icon: '🛒' },
            { key: 'tools', label: 'Tools / equipment', desc: 'Secured transport', icon: '🔧' },
          ].map((c) => (
            <button
              key={c.key}
              type="button"
              className={cls(
                'p-3 rounded-lg border text-left transition-all',
                deliveryType === c.key
                  ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400'
                  : 'border-black/10 bg-white hover:bg-slate-50'
              )}
              onClick={(e) => {
                e.stopPropagation();
                updateDelivery({ itemType: c.key as DeliverySelection['itemType'] });
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{c.icon}</span>
                <div>
                  <div className="text-xs font-medium text-slate-800">{c.label}</div>
                  <div className="text-[10px] text-slate-500">{c.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
        {/* Quantity */}
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-[11px] text-slate-700">How many items?</span>
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
            <button
              type="button"
              className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
              onClick={(e) => { e.stopPropagation(); setDeliveryItemQty((n) => Math.max(1, n - 1)); }}
              aria-label="Decrease quantity"
            >–</button>
            <span className="min-w-[24px] text-center font-semibold text-sm">{deliveryItemQty}</span>
            <button
              type="button"
              className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
              onClick={(e) => { e.stopPropagation(); setDeliveryItemQty((n) => Math.min(20, n + 1)); }}
              aria-label="Increase quantity"
            >+</button>
          </div>
        </div>
        {/* Lifting help */}
        <div className="grid grid-cols-2 gap-2 mt-1">
          {[
            { key: 'no_help', label: 'No help needed', desc: 'I can load/unload myself', icon: '👤' },
            { key: 'need_help', label: 'Need help', desc: 'Extra hands for lifting', icon: '👥', extra: '+$25–50' },
          ].map((c) => (
            <button
              key={c.key}
              type="button"
              className={cls(
                'p-2.5 rounded-lg border text-left transition-all',
                deliveryAssist === c.key
                  ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400'
                  : 'border-black/10 bg-white hover:bg-slate-50'
              )}
              onClick={(e) => {
                e.stopPropagation();
                updateDelivery({ assist: c.key as DeliverySelection['assist'] });
              }}
            >
              <div className="flex items-center gap-2">
                <span>{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-800">{c.label}</div>
                  <div className="text-[10px] text-slate-500">{c.desc}</div>
                </div>
                {c.extra && (
                  <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1 py-0.5 rounded shrink-0">{c.extra}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Extra stops + optional extras */}
      <div className="space-y-3">
        <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">2</span>
          Any extra stops?
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-[11px] text-slate-700">Extra drop-off stops <span className="text-slate-400">(+$8 each)</span></span>
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
            <button
              type="button"
              className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
              onClick={(e) => { e.stopPropagation(); updateDelivery({ extraStops: Math.max(0, (deliveryState.extraStops ?? 0) - 1) }); }}
              aria-label="Decrease stops"
            >–</button>
            <span className="min-w-[24px] text-center font-semibold text-sm">{deliveryState.extraStops ?? 0}</span>
            <button
              type="button"
              className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
              onClick={(e) => { e.stopPropagation(); updateDelivery({ extraStops: Math.min(5, (deliveryState.extraStops ?? 0) + 1) }); }}
              aria-label="Increase stops"
            >+</button>
          </div>
        </div>
        <div className="space-y-1.5">
          {[
            { key: 'priority', label: 'Priority / same-day delivery', price: '+$15', value: deliveryState.priority ?? false },
            { key: 'stairsAtDropoff', label: 'Stairs at drop-off', price: '+$20', value: deliveryState.stairsAtDropoff ?? false },
          ].map((opt) => (
            <label
              key={opt.key}
              className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-black/10 bg-white cursor-pointer hover:bg-slate-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={opt.value}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateDelivery({ [opt.key]: !opt.value } as any);
                  }}
                  className="rounded border-slate-300 accent-emerald-600"
                />
                <span className="text-xs text-slate-800">{opt.label}</span>
              </div>
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">{opt.price}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Live delivery price preview */}
      {deliveryType && (() => {
        const dResult = calcDeliveryQuote(deliveryState, S.distanceKm);
        if (dResult.isCustomQuote) {
          return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="font-semibold mb-0.5">Custom quote may be required</div>
              <div className="text-[11px]">{dResult.customQuoteReason ?? 'This job may require a custom quote based on distance or item size.'}</div>
            </div>
          );
        }
        return (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 space-y-1">
            <div className="text-[11px] font-semibold text-emerald-900 mb-1.5">Price breakdown</div>
            {dResult.lineItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-700">{item.label}</span>
                <span className="font-medium text-slate-900 tabular-nums">
                  {item.note === 'Included' ? <span className="text-slate-400">Included</span> : `$${item.amount}`}
                </span>
              </div>
            ))}
            <div className="h-px bg-emerald-200 my-1" />
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-slate-900">Total</span>
              <span className="text-emerald-700">{fmtAUD(dResult.total)}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Transparent pricing — no hidden fees</div>
          </div>
        );
      })()}

      {/* Step 3: Where to deliver */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">3</span>
          Where would you like it delivered?
        </div>
        <div className="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-3 border border-dashed border-slate-200">
          {S.dumpRouteDropoff?.address
            ? <span className="text-emerald-700 font-medium">{S.dumpRouteDropoff.address}</span>
            : <span>Add addresses in the route calculator to refine the distance price</span>}
        </div>
      </div>

      {/* Step 4: Route Calculator (collapsible) */}
      <div className="space-y-2">
        <button
          type="button"
          className="w-full text-left"
          onClick={(e) => { e.stopPropagation(); setRouteExpanded((v) => !v); }}
        >
          <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">4</span>
            Route Calculator
            {S.distanceKm > 0 && (
              <span className="ml-1 text-emerald-600 font-semibold">{Math.round(S.distanceKm)} km</span>
            )}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className={cls('ml-auto text-slate-400 transition-transform duration-200', routeExpanded ? 'rotate-180' : '')}
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>
        {routeExpanded && (
          <DistanceRouteConfigurator
            S={S}
            set={set}
            routeLookup={routeLookup}
            routeLookupLoading={routeLookupLoading}
            routeLookupMessage={routeLookupMessage}
            routeDistanceLabel={routeDistanceLabel}
            onFocusChange={handleDistanceInputFocusChange}
            onPlaceSelected={handleDistancePlaceSelected}
          />
        )}
      </div>
    </div>
  );
}
