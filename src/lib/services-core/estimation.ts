import type { TravelBand } from '@/app/(public)/services/types';

export const ESTIMATE_DISCLAIMER = 'Final timing and cost are confirmed before work begins.';
export const BASE_CALLOUT_PRICE = 79;
export const EFFORT_BLOCK_RANGE = { min: 20, max: 35, minutes: 20 };
export const PHYSICAL_BLOCK_RANGE = { min: 25, max: 50 };
export const TRAVEL_RANGES: Record<TravelBand, { min: number; max: number }> = {
  same_suburb: { min: 0, max: 0 },
  drive_30: { min: 30, max: 45 },
  drive_60: { min: 50, max: 70 },
  long: { min: 70, max: 110 },
};

export const INCLUSION_MINUTES: Record<string, number> = {
  'Inside & Outside Windows': 0,
  'Inside Windows Only': 0,
  'Outside Windows Only': 0,
  'Tracks Vacuum & Wipe': 10,
  'Frames & Sills Wipe': 6,
  'Fly Screens': 8,
  'Mirrors / Glass Doors': 8,
  'High Access (ladder/safety)': 15,
  'Hard Water Spot Treatment': 15,
  'Sticker/Residue Removal': 10,
  'Detail Edges / Silicone': 6,
};

export function travelRange(key?: TravelBand | null, km?: number) {
  if (key && TRAVEL_RANGES[key]) return TRAVEL_RANGES[key];
  if (typeof km === 'number' && Number.isFinite(km)) {
    if (km <= 10) return TRAVEL_RANGES.same_suburb;
    if (km <= 30) return TRAVEL_RANGES.drive_30;
    if (km <= 60) return TRAVEL_RANGES.drive_60;
    return TRAVEL_RANGES.long;
  }
  return TRAVEL_RANGES.same_suburb;
}

export function combinePricing(effortBlocks: number, physicalBlocks: number, travel: { min: number; max: number }) {
  const min =
    BASE_CALLOUT_PRICE +
    effortBlocks * EFFORT_BLOCK_RANGE.min +
    physicalBlocks * PHYSICAL_BLOCK_RANGE.min +
    travel.min;
  const max =
    BASE_CALLOUT_PRICE +
    effortBlocks * EFFORT_BLOCK_RANGE.max +
    physicalBlocks * PHYSICAL_BLOCK_RANGE.max +
    travel.max;
  const safeMin = Math.max(0, Math.round(min));
  const safeMax = Math.max(safeMin, Math.round(max));
  return { min: safeMin, max: safeMax };
}
