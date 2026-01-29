'use client';

import React, { useState } from 'react';
import type { CarCategory } from '@/lib/rego/classify';
import { classifyVehicle } from '@/lib/rego/classify';
import type { RegoState, VehicleDetails, VehicleSizeCategory } from '@/lib/rego/types';
import type { CarType } from './useCarModelSelector';
import { useRegoLookup } from './useRegoLookup';

const STATES: RegoState[] = ['QLD'];

type Props = {
  selectedCategory: CarType;
  onSelectCategory: (category: CarType) => void;
  onVehicleDetected?: (
    vehicle: VehicleDetails,
    classification: { category: CarCategory; sizeCategory: VehicleSizeCategory | null }
  ) => void;
};

function mapDetectedCategory(category: string | null | undefined): CarType | null {
  const key = String(category ?? '').trim().toLowerCase();
  switch (key) {
    case 'sedan':
      return 'sedan';
    case 'hatch':
      return 'hatch';
    case 'suv':
      return 'suv';
    case 'ute':
      return 'ute';
    case '4wd':
    case '4x4':
    case 'awd':
      return '4wd';
    case 'luxury':
      return 'luxury';
    case 'muscle':
      return 'muscle';
    default:
      return null;
  }
}

export default function RegoLookupAssistant({ onSelectCategory, onVehicleDetected }: Props) {
  const [rego, setRego] = useState('');
  const [state, setState] = useState<RegoState>('QLD');
  const [showDetectedHint, setShowDetectedHint] = useState(false);
  const regoLookup = useRegoLookup();

  const detectedLabel = (() => {
    const v = regoLookup.vehicle;
    if (!v) return null;
    const year = v.year ? ` ${v.year}` : '';
    return `${v.make} ${v.model}${year}`;
  })();

  return (
    <div className="space-y-2">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setShowDetectedHint(false);
          const next = await regoLookup.lookup({ registrationNumber: rego, state });
          if (!next) return;

          const classification = classifyVehicle({
            make: next.make,
            model: next.model,
            bodyStyle: next.bodyStyle,
            seats: next.seats,
          });
          onVehicleDetected?.(next, classification);

          // Prefer the API-provided category, but fall back to deterministic local rules.
          const inferred =
            mapDetectedCategory(next.category) ??
            (classification.category !== 'unknown' ? classification.category : null);

          if (inferred) {
            onSelectCategory(inferred);
            setShowDetectedHint(true);
          }
        }}
      >
        <div className="text-sm text-slate-700">Rego lookup</div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="relative flex items-center rounded-xl border border-black/10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-3 py-2 shadow-lg"
            style={{ minWidth: 220 }}
          >
            <div className="absolute inset-1 rounded-lg border border-white/15 pointer-events-none" />
            <span className="mr-2 text-[11px] uppercase tracking-widest text-slate-200 opacity-80">
              Plate
            </span>
            <input
              className="flex-1 bg-transparent text-white placeholder:text-slate-400 outline-none text-sm font-semibold tracking-widest uppercase"
              placeholder="ABC123"
              value={rego}
              onChange={(e) => setRego(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              inputMode="text"
              aria-label="Registration number"
            />
          </div>

          <select
            className="rounded-lg border border-black/10 px-2 py-2 text-sm bg-white shadow-sm"
            value={state}
            onChange={(e) => setState(e.target.value as RegoState)}
            aria-label="Registration state"
          >
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg border border-black/10 px-4 py-2 text-sm bg-white hover:bg-slate-50 shadow-sm"
            disabled={regoLookup.loading}
          >
            {regoLookup.loading ? 'Looking up…' : 'Look up'}
          </button>
        </div>

        {regoLookup.error && (
          <span className="text-[11px] text-red-700">{regoLookup.error}</span>
        )}
      </form>

      {detectedLabel && (
        <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 shadow-sm">
          <div className="text-xs font-semibold text-emerald-800 tracking-tight">
            Vehicle detected
          </div>
          <div className="text-sm text-emerald-900 font-semibold">{detectedLabel}</div>
          {showDetectedHint && (
            <div className="text-[11px] text-emerald-700">
              Detected from rego — you can change this
            </div>
          )}
        </div>
      )}
    </div>
  );
}
