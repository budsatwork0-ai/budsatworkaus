import { useState, useMemo, useCallback } from 'react';
import type { VehicleCategory } from '@/lib/rego/types';

export type CarType = VehicleCategory;
export type CarZone = 'hood' | 'roof' | 'wheels' | 'glass' | 'boot' | 'interior';

export interface CarSelectionPayload {
  carType: CarType;
  zones: CarZone[];
  dirtLevel: number; // 0..1
  priceImpact: number;
}

export interface PriceConfig {
  base: number;
  perZone: Record<CarZone, number>;
  dirtMultiplier: number; // applied on top of total
}

export const defaultPriceConfig: PriceConfig = {
  base: 0,
  perZone: {
    hood: 20,
    roof: 15,
    wheels: 25,
    glass: 10,
    boot: 15,
    interior: 40,
  },
  dirtMultiplier: 0.4,
};

export function useCarModelSelector(config: PriceConfig = defaultPriceConfig) {
  const [carType, setCarType] = useState<CarType>('sedan');
  const [zones, setZones] = useState<Set<CarZone>>(new Set());
  const [dirtLevel, setDirtLevel] = useState<number>(0);

  const toggleZone = useCallback((zone: CarZone) => {
    setZones((prev) => {
      const next = new Set(prev);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  }, []);

  const derived = useMemo<CarSelectionPayload>(() => {
    let total = config.base;
    zones.forEach((z) => {
      total += config.perZone[z] ?? 0;
    });
    total *= 1 + dirtLevel * config.dirtMultiplier;
    return {
      carType,
      zones: Array.from(zones),
      dirtLevel,
      priceImpact: Math.round(total),
    };
  }, [carType, zones, dirtLevel, config]);

  return {
    carType,
    setCarType,
    zones,
    toggleZone,
    dirtLevel,
    setDirtLevel,
    derived,
  };
}
