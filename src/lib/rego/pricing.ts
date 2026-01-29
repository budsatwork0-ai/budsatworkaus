import type { VehicleCategory, VehicleSizeCategory } from './types';

const SIZE_ADJUSTMENTS: Record<VehicleSizeCategory, number> = {
  hatch: 0,
  sedan: 0,
  suv: 20,
  ute: 25,
  van: 40,
  '4wd': 30,
};

const roundToNearest = (value: number, step: number) =>
  Math.round(value / step) * step;

function ageMultiplier(year?: number | null) {
  if (!year || !Number.isFinite(year)) return 1;
  const nowYear = new Date().getFullYear();
  const age = Math.max(0, nowYear - year);
  if (age <= 8) return 1;
  if (age <= 15) return 1 - ((age - 8) / 7) * 0.08; // down to ~0.92
  if (age <= 25) return 0.92 - ((age - 15) / 10) * 0.07; // down to ~0.85
  return 0.8;
}

export function calculatePrice(
  basePrice: number,
  category: VehicleCategory | 'unknown',
  sizeCategory?: VehicleSizeCategory | null,
  vehicleYear?: number | null
): number {
  const safeBase = Number.isFinite(basePrice) ? basePrice : 0;
  const resolvedSize =
    sizeCategory && SIZE_ADJUSTMENTS[sizeCategory] != null
      ? sizeCategory
      : (SIZE_ADJUSTMENTS as Record<string, number>)[category] != null
      ? (category as VehicleSizeCategory)
      : null;

  const afterSize = safeBase + (resolvedSize ? SIZE_ADJUSTMENTS[resolvedSize] : 0);
  const classMultiplier = category === 'muscle' ? 1.2 : category === 'luxury' ? 1.15 : 1;
  const aged = afterSize * classMultiplier * ageMultiplier(vehicleYear);
  const final = aged;

  return roundToNearest(final, 5);
}
