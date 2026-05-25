'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { TransportSelection, WizardState } from '../../types';
import { DEFAULT_DUMP_TRANSPORT } from '../../lib/pricing/constants';
import { calcTransportQuote } from '../../lib/pricing/transport';
import { cls, fmtAUD } from '../../utils/formatting';
import type { RouteSlot } from './ScopeCard.types';

const DistanceRouteConfigurator = dynamic(
  () => import('../dump/DistanceRouteConfigurator').then(m => ({ default: m.DistanceRouteConfigurator })),
  { ssr: false }
);

interface TransportPanelProps {
  S: WizardState;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  routeSlot: RouteSlot;
}

export function TransportPanel({ S, set, routeSlot }: TransportPanelProps) {
  const {
    transportExpanded: transportRouteExpanded, setTransportExpanded: setTransportRouteExpanded,
    lookup: routeLookup, loading: routeLookupLoading,
    message: routeLookupMessage, distanceLabel: routeDistanceLabel,
    onFocusChange: handleDistanceInputFocusChange,
    onPlaceSelected: handleDistancePlaceSelected,
  } = routeSlot;

  const transportState = S.dumpTransport || DEFAULT_DUMP_TRANSPORT;
  const transportType = transportState.moveType;
  const transportStairs = transportState.stairs;
  const transportSize = transportState.loadSize;
  const updateTransport = (next: Partial<TransportSelection>) =>
    set('dumpTransport', { ...transportState, ...next });

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
        <div className="font-semibold text-slate-900">Transport &amp; Haul Details</div>
        <div className="text-[11px] text-slate-500 mt-0.5">Tell us about the move</div>
      </div>

      {/* Step 1: Type of move */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">1</span>
          What type of move?
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { key: 'house', label: 'House move', desc: 'Full home relocation', icon: '🏠', note: 'Multiple loads likely' },
            { key: 'bedroom', label: 'Bedroom move', desc: 'Single room items', icon: '🛏️', note: '1–2 techs' },
            { key: 'student', label: 'Student move', desc: 'Dorm/share house', icon: '🎓', note: 'Usually 1 trip' },
            { key: 'office', label: 'Office move', desc: 'Desks & equipment', icon: '💼', note: 'Equipment protected' },
            { key: 'event', label: 'Event pack-up', desc: 'Staging & gear', icon: '🎪', note: 'Organised staging' },
          ].map((c) => (
            <button
              key={c.key}
              type="button"
              className={cls(
                'p-3 rounded-lg border text-left transition-all',
                transportType === c.key
                  ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                  : 'border-black/10 bg-white hover:bg-slate-50'
              )}
              onClick={(e) => {
                e.stopPropagation();
                updateTransport({ moveType: c.key as TransportSelection['moveType'] });
              }}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">{c.icon}</span>
                <div>
                  <div className="text-xs font-medium text-slate-800">{c.label}</div>
                  <div className="text-[10px] text-slate-500">{c.desc}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">{c.note}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Load size */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">2</span>
          How much are you moving?
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'bags', label: 'A few bags', desc: 'Small items only', icon: '🎒', price: 'From $104' },
            { key: 'boot', label: 'Car boot load', desc: 'Boxes & small furniture', icon: '🚗', price: 'From $124' },
            { key: 'small_load', label: 'Small load', desc: 'Bed, desk, boxes', icon: '📦', price: 'From $158' },
            { key: 'full_move', label: 'Full move', desc: 'Complete household', icon: '🚚', price: 'From $228' },
          ].map((c) => (
            <button
              key={c.key}
              type="button"
              className={cls(
                'p-3 rounded-lg border text-left transition-all',
                transportSize === c.key
                  ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                  : 'border-black/10 bg-white hover:bg-slate-50'
              )}
              onClick={(e) => {
                e.stopPropagation();
                updateTransport({ loadSize: c.key as TransportSelection['loadSize'] });
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{c.icon}</span>
                <div className="flex-1">
                  <div className="text-xs font-medium text-slate-800">{c.label}</div>
                  <div className="text-[10px] text-slate-500">{c.desc}</div>
                </div>
                <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  {c.price}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: Stair access */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">3</span>
          Stair access at pickup or drop-off?
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'none', label: 'No stairs', desc: 'Ground level access', icon: '✓', extra: null },
            { key: 'one', label: 'One flight', desc: 'Single staircase', icon: '🔼', extra: '+$20' },
            { key: 'multi', label: 'Multiple flights', desc: '2+ floors of stairs', icon: '🔼🔼', extra: '+$40' },
            { key: 'no_lift', label: 'No lift access', desc: 'Apartment without lift', icon: '🏢', extra: '+$30' },
          ].map((c) => (
            <button
              key={c.key}
              type="button"
              className={cls(
                'p-3 rounded-lg border text-left transition-all',
                transportStairs === c.key
                  ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                  : 'border-black/10 bg-white hover:bg-slate-50'
              )}
              onClick={(e) => {
                e.stopPropagation();
                updateTransport({ stairs: c.key as TransportSelection['stairs'] });
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm w-6 text-center">{c.icon}</span>
                <div className="flex-1">
                  <div className="text-xs font-medium text-slate-800">{c.label}</div>
                  <div className="text-[10px] text-slate-500">{c.desc}</div>
                </div>
                {c.extra && (
                  <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    {c.extra}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 4: How many helpers? */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">4</span>
          How many helpers do you need?
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 1, label: '1 helper', desc: 'Included', extra: null },
            { key: 2, label: '2 helpers', desc: 'Extra hands', extra: '+$60' },
            { key: 3, label: '3 helpers', desc: 'Heavy loads', extra: '+$120' },
          ].map((c) => (
            <button
              key={c.key}
              type="button"
              className={cls(
                'p-3 rounded-lg border text-left transition-all',
                (transportState.helpers ?? 1) === c.key
                  ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                  : 'border-black/10 bg-white hover:bg-slate-50'
              )}
              onClick={(e) => {
                e.stopPropagation();
                updateTransport({ helpers: c.key as 1 | 2 | 3 });
              }}
            >
              <div className="text-xs font-medium text-slate-800">{c.label}</div>
              <div className="text-[10px] text-slate-500">{c.desc}</div>
              {c.extra && (
                <div className="text-[10px] font-medium text-amber-600 mt-0.5">{c.extra}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Optional extras */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
          Optional extras
        </div>
        <div className="space-y-1.5">
          {[
            { key: 'urgent', label: 'Priority / urgent booking', price: '+$15', value: transportState.urgent ?? false },
            { key: 'afterHours', label: 'After-hours or weekend loading', price: '+$40', value: transportState.afterHours ?? false },
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
                    updateTransport({ [opt.key]: !opt.value } as any);
                  }}
                  className="rounded border-slate-300 accent-blue-600"
                />
                <span className="text-xs text-slate-800">{opt.label}</span>
              </div>
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">{opt.price}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Live price preview */}
      {(() => {
        const tResult = calcTransportQuote(transportState, S.distanceKm);
        if (tResult.isCustomQuote) {
          return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <div className="font-semibold mb-0.5">Custom quote may be required</div>
              <div className="text-[11px]">{tResult.customQuoteReason ?? 'This job may require a custom quote based on distance, access, or item size.'}</div>
            </div>
          );
        }
        return (
          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 space-y-1">
            <div className="text-[11px] font-semibold text-blue-900 mb-1.5">Price breakdown</div>
            {tResult.lineItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-700">{item.label}</span>
                <span className="font-medium text-slate-900 tabular-nums">
                  {item.note === 'Included' ? <span className="text-slate-400">Included</span> : `$${item.amount}`}
                </span>
              </div>
            ))}
            <div className="h-px bg-blue-200 my-1" />
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <span className="text-slate-900">Total</span>
              <span className="text-blue-700">{fmtAUD(tResult.total)}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Transparent pricing — no hidden fees</div>
          </div>
        );
      })()}

      {/* Step 5: Origin & destination display */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">5</span>
          Origin &amp; destination
        </div>
        <div className="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-3 border border-dashed border-slate-200">
          {S.distanceKm > 0
            ? <span className="text-blue-700 font-medium">{Math.round(S.distanceKm)} km between locations</span>
            : <span>Add addresses in the route calculator to refine the distance price</span>}
        </div>
      </div>

      {/* Step 6: Route Calculator (collapsible) */}
      <div className="space-y-2">
        <button
          type="button"
          className="w-full text-left"
          onClick={(e) => { e.stopPropagation(); setTransportRouteExpanded((v) => !v); }}
        >
          <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">6</span>
            Route Calculator
            {S.distanceKm > 0 && (
              <span className="ml-1 text-blue-600 font-semibold">{Math.round(S.distanceKm)} km</span>
            )}
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className={cls('ml-auto text-slate-400 transition-transform duration-200', transportRouteExpanded ? 'rotate-180' : '')}
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>
        {transportRouteExpanded && (
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
