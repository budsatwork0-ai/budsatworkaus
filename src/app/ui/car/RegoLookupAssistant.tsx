'use client';

import React, { useState } from 'react';
import type { CarCategory } from '@/lib/rego/classify';
import { classifyVehicle } from '@/lib/rego/classify';
import type { RegoState, VehicleDetails, VehicleSizeCategory } from '@/lib/rego/types';
import type { CarType } from './useCarModelSelector';

const STATES: RegoState[] = ['QLD'];

type DetectedVehicle = {
  make: string;
  model: string;
  year: number | null;
  bodyStyle: string;
  doors: number | null;
  seats: number | null;
} | null;

type Props = {
  selectedCategory: CarType;
  onSelectCategory: (category: CarType) => void;
  detectedVehicle: DetectedVehicle;
  onVehicleChange: (vehicle: DetectedVehicle) => void;
  onVehicleDetected?: (
    vehicle: VehicleDetails,
    classification: { category: CarCategory; sizeCategory: VehicleSizeCategory | null }
  ) => void;
};

function mapDetectedCategory(category: string | null | undefined): CarType | null {
  const key = String(category ?? '').trim().toLowerCase();
  switch (key) {
    case 'sedan': return 'sedan';
    case 'hatch': return 'hatch';
    case 'suv': return 'suv';
    case 'ute': return 'ute';
    case '4wd':
    case '4x4':
    case 'awd': return '4wd';
    case 'luxury': return 'luxury';
    case 'muscle': return 'muscle';
    default: return null;
  }
}

export default function RegoLookupAssistant({
  onSelectCategory,
  onVehicleDetected,
  detectedVehicle,
  onVehicleChange,
}: Props) {
  const [rego, setRego] = useState('');
  const [state, setState] = useState<RegoState>('QLD');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!rego.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ registrationNumber: rego.trim(), state });
      const res = await fetch(`/api/rego-lookup?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Lookup failed');
        onVehicleChange(null);
        return;
      }

      if (!data.make || !data.model) {
        setError('No vehicle found');
        onVehicleChange(null);
        return;
      }

      // Success!
      const vehicle: VehicleDetails = {
        make: data.make,
        model: data.model,
        year: data.year ?? null,
        bodyStyle: data.bodyStyle ?? '',
        doors: data.doors ?? null,
        seats: data.seats ?? null,
        category: data.category ?? 'unknown',
        sizeCategory: data.sizeCategory ?? null,
      };

      // Update parent state first (this is the lifted state that persists)
      onVehicleChange({
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        bodyStyle: vehicle.bodyStyle,
        doors: vehicle.doors,
        seats: vehicle.seats,
      });

      // Then trigger classification callbacks
      const classification = classifyVehicle({
        make: vehicle.make,
        model: vehicle.model,
        bodyStyle: vehicle.bodyStyle,
        seats: vehicle.seats,
      });
      onVehicleDetected?.(vehicle, classification);

      const inferred = mapDetectedCategory(vehicle.category) ??
        (classification.category !== 'unknown' ? classification.category : null);
      if (inferred) {
        onSelectCategory(inferred);
      }
    } catch (err) {
      setError('Network error');
      onVehicleChange(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    onVehicleChange(null);
    setRego('');
    setError(null);
  };

  return (
    <div className="space-y-3">
      {/* Show result if found */}
      {detectedVehicle ? (
        <div className="rounded-lg bg-emerald-500 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-emerald-100 mb-1">
                ✓ Vehicle Found
              </div>
              <div className="text-xl font-bold text-white">
                {detectedVehicle.make} {detectedVehicle.model}
              </div>
              <div className="mt-1 text-sm text-emerald-100">
                {[
                  detectedVehicle.year,
                  detectedVehicle.bodyStyle,
                  detectedVehicle.doors && `${detectedVehicle.doors} door`,
                  detectedVehicle.seats && `${detectedVehicle.seats} seats`,
                ].filter(Boolean).join(' • ')}
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30"
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">
            Find your vehicle
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-lg bg-white/10 px-3 py-2.5 text-white text-sm font-semibold tracking-wider uppercase placeholder:text-slate-500 placeholder:font-normal placeholder:tracking-normal outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Enter rego (e.g. ABC123)"
                value={rego}
                onChange={(e) => setRego(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLookup();
                  }
                }}
                disabled={isLoading}
              />
              <select
                className="rounded-lg bg-white/10 px-2 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500"
                value={state}
                onChange={(e) => setState(e.target.value as RegoState)}
                disabled={isLoading}
              >
                {STATES.map((s) => (
                  <option key={s} value={s} className="bg-slate-900">{s}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleLookup}
              disabled={isLoading || !rego.trim()}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Looking up...' : 'Look up vehicle'}
            </button>
            {error && (
              <div className="rounded-lg bg-red-500/20 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
