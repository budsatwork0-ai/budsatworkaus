import type {
  Context,
  ServiceType,
  ScopeKey,
  NumericParams,
  Selected,
  QuoteParams,
  Task,
  SSKind,
  CommercialCleaningType,
  CleanScopeKind,
  CleanScopeKindV2,
  ExtraRule,
  ExtraRules,
  DumpTier,
  DumpRunSelection,
  SneakerTurnaround,
  SneakerTurnaroundMeta,
  LaundryTier,
  SneakerTier,
} from '../../types';

import { toNumber, clamp, fmtAUD, roundTo, roundToHalfHour, roundTo5 } from '../../utils/formatting';
import {
  WINDOW_PRICES,
  PRICE_OVERRIDE,
  AUTO_SIZE_CATEGORIES,
  SNEAKER_TURNAROUND,
  SNEAKER_TURNAROUND_META,
  POLICY,
} from './constants';
import { TASK_MAP } from '../service-data';
import type { CarType } from '@/app/ui/car/useCarModelSelector';
import type { VehicleSizeCategory } from '@/lib/rego/types';
import { calculatePrice } from '@/lib/rego/pricing';
import {
  priceYardJob,
  YARD_CALLOUT_FLOOR,
  type DifficultyFlags as YardDifficultyFlags,
  type YardScope,
} from '@/app/ui/yard/yardPricing';

/* ===== SS Cleaning (scope-style minutes) ===== */

const SS_BASE: Record<SSKind, number> = {
  general: Math.round(2.4 * 60),
  deep: Math.round(3.38 * 60),
  endoflease: Math.round(5.43 * 60),
};
const SS_BEDROOMS: Record<SSKind, number[]> = {
  general: [9, 16, 24, 32, 40, 40, 40],
  deep: [12, 20, 28, 36, 44, 52, 60],
  endoflease: [37, 65, 93, 120, 146, 146, 146],
};
const SS_STOREY: Record<SSKind, number> = { general: 31, deep: 32, endoflease: 32 };
const SS_BATHROOM: Record<SSKind, number> = { general: 22, deep: 23, endoflease: 23 };
const SS_LAUNDRY: Record<SSKind, number> = { general: 26, deep: 27, endoflease: 27 };

export function ssMinutes(kind: SSKind, bedrooms: number, storeys: number, bathrooms: number, laundry: number): number {
  let minutes = SS_BASE[kind];
  const extras = Math.max(0, Math.round(bedrooms) - 1);
  for (let i = 0; i < extras; i++) {
    const inc =
      SS_BEDROOMS[kind][i] ?? SS_BEDROOMS[kind][SS_BEDROOMS[kind].length - 1];
    minutes += inc;
  }
  minutes += Math.max(0, Math.round(storeys) - 1) * SS_STOREY[kind];
  minutes += Math.max(0, Math.round(bathrooms) - 1) * SS_BATHROOM[kind];
  minutes += Math.max(0, Math.round(laundry) - 0) * SS_LAUNDRY[kind];
  return Math.max(0, Math.round(minutes));
}

/* ===== Commercial Cleaning (formula-based) ===== */

export const COMM_CLEAN_MULTIPLIER: Record<CommercialCleaningType, number> = {
  office: 1.0,
  medical: 1.5,
  fitness: 1.3,
  hospitality: 1.4,
  education: 1.2,
  event: 1.1,
  accommodation: 1.2,
};

export const COMM_CLEAN_MIN_HOURS: Record<CommercialCleaningType, number> = {
  office: 2.0,
  medical: 2.0,
  fitness: 2.0,
  hospitality: 2.0,
  education: 2.0,
  event: 2.0,
  accommodation: 2.0,
};

export const COMM_CLEAN_RATES: Record<CommercialCleaningType, number> = {
  office: 60,
  medical: 70,
  fitness: 70,
  hospitality: 70,
  education: 70,
  event: 60,
  accommodation: 60,
};

export const COMM_PRESET_PRICING: Record<
  CommercialCleaningType,
  Record<'essential' | 'standard' | 'intensive', { hours: number; price: number; sqm: number }>
> = {
  office: {
    essential: { hours: 2, price: 120, sqm: 600 },
    standard: { hours: 3, price: 180, sqm: 900 },
    intensive: { hours: 6, price: 360, sqm: 1800 },
  },
  medical: {
    essential: { hours: 2, price: 140, sqm: 350 },
    standard: { hours: 3, price: 210, sqm: 550 },
    intensive: { hours: 6, price: 420, sqm: 1200 },
  },
  fitness: {
    essential: { hours: 2, price: 140, sqm: 450 },
    standard: { hours: 3, price: 210, sqm: 750 },
    intensive: { hours: 6, price: 420, sqm: 1600 },
  },
  hospitality: {
    essential: { hours: 2, price: 140, sqm: 550 },
    standard: { hours: 3, price: 210, sqm: 850 },
    intensive: { hours: 6, price: 420, sqm: 1800 },
  },
  education: {
    essential: { hours: 2, price: 140, sqm: 550 },
    standard: { hours: 3, price: 210, sqm: 850 },
    intensive: { hours: 6, price: 420, sqm: 1700 },
  },
  event: {
    essential: { hours: 2, price: 120, sqm: 700 },
    standard: { hours: 3, price: 180, sqm: 1200 },
    intensive: { hours: 6, price: 360, sqm: 2800 },
  },
  accommodation: {
    essential: { hours: 2, price: 120, sqm: 700 },
    standard: { hours: 3, price: 180, sqm: 1100 },
    intensive: { hours: 6, price: 360, sqm: 2400 },
  },
};

export function cleaningCommercialMinutes(_kind: CommercialCleaningType, _p: unknown): number {
  // Fixed 4-hour baseline for all commercial cleaning niches
  return 240;
}

/* ===== Home Cleaning – legacy V1 (kept for future use) ===== */

export const CLEANING_HOME_MULTIPLIER: Record<CleanScopeKind, number> = {
  weekly: 1.0,
  general: 1.15,
  inspection: 1.4,
  deep: 1.6,
  endoflease: 1.85,
  hourly: 1.0,
};

export const CLEANING_HOME_MIN_HOURS: Record<CleanScopeKind, number> = {
  weekly: 2.0,
  general: 2.5,
  inspection: 3.0,
  deep: 3.5,
  endoflease: 4.5,
  hourly: 1.0,
};

export const CLEANING_HOME_RATES: Record<CleanScopeKind, number> = {
  weekly: 55,
  general: 60,
  inspection: 60,
  deep: 65,
  endoflease: 90,
  hourly: 60,
};

export function cleaningHomeMinutes(kind: CleanScopeKind, p: any): number {
  const bedrooms = p.bedrooms ?? 1;
  const bathrooms = p.bathrooms ?? 1;
  const kitchens = p.kitchens ?? 1;
  const living = p.living ?? 1;
  const laundry = p.laundry ?? 0;
  const storeys = p.storeys ?? 1;

  const baseHours =
    bedrooms * 0.15 +
    bathrooms * 0.45 +
    kitchens * 0.6 +
    living * 0.25 +
    laundry * 0.2 +
    storeys * 0.1;

  const hours = baseHours * (CLEANING_HOME_MULTIPLIER[kind] ?? 1);
  const minHours = CLEANING_HOME_MIN_HOURS[kind] ?? 0;
  const finalHours = Math.max(hours, minHours);

  return Math.round(finalHours * 60);
}

/* ===== Home Cleaning – Calibrated V2 (Brisbane) ===== */

export const CLEANING_HOME_RATES_V2: Record<CleanScopeKindV2, number> = {
  weekly: 55,      // discounted from base
  general: 60,     // base rate
  inspection: 60,
  deep: 65,
  endoflease: 90,
  hourly: 60,
};

// 2025 Brisbane home cleaning matrix (GST incl.)
// format: pricing[bedrooms][bathrooms][storeys] = { standard: [low, high], deep: [low, high], move: [low, high] }
export const CLEANING_HOME_BRISBANE_2025: Record<
  string,
  Record<string, Record<string, { standard: [number, number]; deep: [number, number]; move: [number, number] }>>
> = {
  '1': { '1': { '1': { standard: [165, 190], deep: [250, 290], move: [320, 380] } } },
  '2': {
    '1': { '1': { standard: [190, 230], deep: [290, 350], move: [380, 480] } },
    '2': { '1': { standard: [220, 270], deep: [340, 400], move: [450, 550] } },
  },
  '3': {
    '1': { '1': { standard: [250, 300], deep: [380, 460], move: [500, 620] } },
    '2': {
      '1': { standard: [290, 350], deep: [440, 520], move: [580, 720] },
      '2': { standard: [340, 410], deep: [500, 600], move: [680, 850] },
    },
  },
  '4': {
    '2': {
      '1': { standard: [350, 420], deep: [520, 620], move: [720, 900] },
      '2': { standard: [410, 490], deep: [600, 720], move: [850, 1100] },
    },
    '3': { '2': { standard: [460, 550], deep: [680, 820], move: [950, 1250] } },
  },
  // 5+ bedrooms or 3+ storeys -> custom quote
};

export const CLEANING_HOME_RECURRING_DISCOUNT: Record<string, number> = {
  weekly: 0.2,
  fortnightly: 0.1,
};

// Home cleaning presets (base counts) and incremental rules for extras
export const HOME_CLEAN_PRESETS: Record<
  CleanScopeKindV2,
  { bedrooms: number; bathrooms: number; kitchens: number; laundry: number; living: number; storeys: number }
> = {
  weekly: { bedrooms: 4, bathrooms: 2, kitchens: 1, laundry: 1, living: 1, storeys: 1 },
  general: { bedrooms: 4, bathrooms: 2, kitchens: 1, laundry: 1, living: 2, storeys: 1 }, // standard
  inspection: { bedrooms: 1, bathrooms: 1, kitchens: 1, laundry: 0, living: 1, storeys: 1 }, // unused for extras
  deep: { bedrooms: 4, bathrooms: 3, kitchens: 1, laundry: 1, living: 2, storeys: 1 },
  endoflease: { bedrooms: 4, bathrooms: 3, kitchens: 1, laundry: 1, living: 2, storeys: 1 },
  hourly: { bedrooms: 0, bathrooms: 0, kitchens: 0, laundry: 0, living: 0, storeys: 1 },
};

export const HOME_EXTRA_RULES: Record<CleanScopeKindV2, ExtraRules> = {
  weekly: {
    bedrooms: { minutes: 30, cost: 15 },
    bathrooms: { minutes: 45, cost: 25 },
    kitchens: { minutes: 60, cost: 30 },
    laundry: { minutes: 25, cost: 15 },
    living: { minutes: 35, cost: 20 },
    storeys: { minutes: 20, cost: 10 },
  },
  general: {
    bedrooms: { minutes: 30, cost: 30 },
    bathrooms: { minutes: 45, cost: 45 },
    kitchens: { minutes: 60, cost: 60 },
    laundry: { minutes: 30, cost: 30 },
    living: { minutes: 40, cost: 40 },
    storeys: { minutes: 25, cost: 20 },
  },
  inspection: {}, // no extras defined
  deep: {
    bedrooms: { minutes: 40, cost: 40 },
    bathrooms: { minutes: 60, cost: 60 },
    kitchens: { minutes: 90, cost: 80 },
    laundry: { minutes: 40, cost: 60 },
    living: { minutes: 55, cost: 55 },
    storeys: { minutes: 30, cost: 25 },
  },
  endoflease: {
    bedrooms: { minutes: 45, cost: 60 },
    bathrooms: { minutes: 70, cost: 90 },
    kitchens: { minutes: 90, cost: 120 },
    laundry: { minutes: 45, cost: 60 },
    living: { minutes: 60, cost: 80 },
    storeys: { minutes: 45, cost: 40 },
  },
  hourly: {},
};

export function computeCleaningAddons(scope: ScopeKey, params: NumericParams) {
  // Only for home cleaning
  const hasFridge = !!(params as any).addon_fridge;
  const hasOven = !!(params as any).addon_oven;
  const hasWindows = !!(params as any).addon_windows;

  let minutes = 0;
  let cost = 0;

  // Fridge/Oven bundle: $70, 45 + 60 minutes; heavy carbon adds $20 (not captured here)
  if (hasFridge && hasOven) {
    minutes += 45 + 60;
    cost += 70; // bundle saves $10
  } else {
    if (hasFridge) {
      minutes += 45;
      cost += 40;
    }
    if (hasOven) {
      minutes += 60;
      cost += 60;
    }
  }

  if (hasWindows) {
    minutes += 45; // first 10 windows
    cost += 50;
    // If you later add counts, every extra 5 windows: +20 mins, +$20
    const extraWindows = Math.max(0, Math.floor(((params as any).addon_windows_extra || 0) / 5));
    if (extraWindows > 0) {
      minutes += extraWindows * 20;
      cost += extraWindows * 20;
    }
  }

  return { minutes, cost };
}

export function computeHomeExtras(scope: ScopeKey, params: NumericParams) {
  const map: Partial<Record<ScopeKey, CleanScopeKindV2>> = {
    weekly: 'weekly',
    general: 'general',
    deep: 'deep',
    endoflease: 'endoflease',
    inspection: 'inspection',
    hourly: 'hourly',
  };
  const kind = map[scope] ?? null;
  if (!kind || kind === 'hourly' || kind === 'inspection') return { baseMinutes: 0, extraMinutes: 0, extraCost: 0 };

  const preset = HOME_CLEAN_PRESETS[kind];
  const rules = HOME_EXTRA_RULES[kind] || {};

  const diff = (key: keyof typeof preset) => Math.max(0, (params[key] ?? preset[key]) - preset[key]);

  const extras: Array<{ key: keyof typeof preset; count: number; rule?: ExtraRule }> = [
    { key: 'bedrooms', count: diff('bedrooms'), rule: rules.bedrooms },
    { key: 'bathrooms', count: diff('bathrooms'), rule: rules.bathrooms },
    { key: 'kitchens', count: diff('kitchens'), rule: rules.kitchens },
    { key: 'laundry', count: diff('laundry'), rule: rules.laundry },
    { key: 'living', count: diff('living'), rule: rules.living },
    { key: 'storeys', count: diff('storeys'), rule: rules.storeys },
  ];

  let extraMinutes = 0;
  let extraCost = 0;
  for (const e of extras) {
    if (!e.rule || e.count <= 0) continue;
    extraMinutes += e.rule.minutes * e.count;
    extraCost += e.rule.cost * e.count;
  }

  const baseMinutes = (CLEANING_HOME_MIN_HOURS_V2[kind] ?? 0) * 60;
  return { baseMinutes, extraMinutes, extraCost };
}

/* ===== Yard care overrides (flat + increments) ===== */

type YardQuoteOpts = {
  scope?: ScopeKey;
  isTwoStoreyGutter?: boolean;
  conditionMultiplier?: number;
  accessTight?: boolean;
  conditionLevel?: 'light' | 'standard' | 'heavy';
  context?: Context;
};

// ─── Yard quote — delegates to the single source of truth in yardPricing.ts ──

const YARD_SCOPE_KEYS = ['yard_mow', 'yard_hedge', 'yard_leaves', 'blast_and_shine', 'gutter_clean'] as const;
type YardScopeKey = (typeof YARD_SCOPE_KEYS)[number];
const YARD_SCOPE_SET = new Set<YardScopeKey>(YARD_SCOPE_KEYS);

/**
 * Hour estimates are informational only (scheduling / "about X hours" UI).
 * The cost is determined by priceYardJob, not by hours × hourly rate.
 */
const YARD_HOUR_RULES: Record<
  YardScopeKey,
  { denominator: number; minHours: number; maxHours: number }
> = {
  yard_mow: { denominator: 500, minHours: 0.75, maxHours: 7 },
  yard_hedge: { denominator: 35, minHours: 0.75, maxHours: 7 },
  yard_leaves: { denominator: 300, minHours: 0.75, maxHours: 7 },
  blast_and_shine: { denominator: 140, minHours: 0.75, maxHours: 6 },
  gutter_clean: { denominator: 30, minHours: 0.75, maxHours: 6 },
};

const resolveYardScope = (scope?: ScopeKey): YardScopeKey =>
  scope && YARD_SCOPE_SET.has(scope as YardScopeKey) ? (scope as YardScopeKey) : 'yard_mow';

/**
 * Translate useYardMapping's condition level + access flag into the
 * difficulty-flag shape that priceYardJob expects.
 */
function flagsFromOpts(opts: YardQuoteOpts, scope: YardScopeKey): YardDifficultyFlags {
  const flags: YardDifficultyFlags = {};
  // Condition level: 'heavy' triggers the overgrown multiplier.
  // 'light' and 'standard' do not — they're meant to *reduce* price, and
  // that's now handled by the tier rates themselves.
  if (opts.conditionLevel === 'heavy') flags.overgrown = true;
  if (opts.accessTight) flags.tightAccess = true;
  if (scope === 'gutter_clean' && opts.isTwoStoreyGutter) flags.twoStorey = true;
  return flags;
}

export function computeYardQuote(params: NumericParams, opts: YardQuoteOpts = {}) {
  const scope = resolveYardScope(opts.scope);
  const areaOverride = toNumber((params as any).yard_area ?? (params as any).area_m2, 0);

  // Pull per-service measurement. Only the scope-relevant field matters;
  // yard_area is accepted as a fallback from the polygon map.
  const measurement = (() => {
    switch (scope) {
      case 'yard_mow':
        return areaOverride > 0 ? areaOverride : toNumber(params.lawn_m2 ?? 0, 0);
      case 'yard_leaves':
        return areaOverride > 0 ? areaOverride : toNumber(params.leaves_area ?? 0, 0);
      case 'blast_and_shine':
        return areaOverride > 0 ? areaOverride : toNumber(params.blast_m2 ?? 0, 0);
      case 'yard_hedge':
        return areaOverride > 0 ? areaOverride : toNumber(params.hedge_m ?? 0, 0);
      case 'gutter_clean':
        return areaOverride > 0 ? areaOverride : toNumber(params.gutter_m ?? 0, 0);
    }
  })();

  const units = Math.max(0, measurement);

  // ── Price: delegate to the single source of truth ──
  const flags = flagsFromOpts(opts, scope);
  const result = priceYardJob(scope as YardScope, units, flags);
  const price = result.finalPrice;

  // ── Hours: independent rough estimate, used only for UI ──
  const rule = YARD_HOUR_RULES[scope];
  const rawHours = units / rule.denominator;
  // A light "difficulty stretches the clock" factor — doesn't affect price.
  const hourMultiplier =
    (flags.overgrown ? 1.2 : 1) *
    (flags.tightAccess ? 1.1 : 1) *
    (flags.twoStorey ? 1.3 : 1);
  const clampedHours = clamp(rawHours * hourMultiplier, rule.minHours, rule.maxHours);
  const minutes = Math.round(clampedHours * 60);

  return {
    hours: clampedHours,
    minutes,
    cost: price,
    // labourFloor is the $79 callout when the tier math came in under it.
    labourFloor: result.minimumApplied ? YARD_CALLOUT_FLOOR : price,
  };
}

export function computeHomeMatrixPrice({
  bedrooms,
  bathrooms,
  storeys,
  scope,
}: {
  bedrooms: number;
  bathrooms: number;
  storeys: number;
  scope: ScopeKey;
}):
  | { kind: 'custom' }
  | { kind: 'range'; low: number; high: number }
  | { kind: 'exact'; value: number } {
  if (bedrooms >= 5 || storeys >= 3) return { kind: 'custom' };

  const svc =
    scope === 'deep'
      ? 'deep'
      : scope === 'endoflease'
      ? 'move'
      : 'standard';

  const matrix =
    CLEANING_HOME_BRISBANE_2025[String(bedrooms)]?.[String(bathrooms)]?.[
      String(storeys)
    ];
  if (!matrix || !matrix[svc]) return { kind: 'custom' };

  let [low, high] = matrix[svc];

  // Apply recurring discount only for standard weekly/fortnightly
  const recurKey =
    scope === 'weekly' ? 'weekly' : scope === 'inspection' ? 'fortnightly' : null;
  const disc = svc === 'standard' && recurKey ? CLEANING_HOME_RECURRING_DISCOUNT[recurKey] || 0 : 0;
  if (disc > 0) {
    low *= 1 - disc;
    high *= 1 - disc;
  }

  low = roundTo5(low);
  high = roundTo5(high);

  if (low === high) return { kind: 'exact', value: low };
  return { kind: 'range', low, high };
}

export const CLEANING_HOME_MULTIPLIER_V2: Record<CleanScopeKindV2, number> = {
  weekly: 1.2,
  general: 1.2,
  inspection: 1.6,
  deep: 2.4,
  endoflease: 2.8,
  hourly: 1.0,
};

export const CLEANING_HOME_MIN_HOURS_V2: Record<CleanScopeKindV2, number> = {
  weekly: 2.0,       // weekly clean preset
  general: 4.0,      // standard clean preset
  inspection: 3.0,
  deep: 5.0,         // deep clean preset
  endoflease: 6.0,   // move in/out preset
  hourly: 3.0,       // directed clean preset
};

export function cleaningHomeMinutesV2(kind: CleanScopeKindV2, p: any): number {
  const bedrooms = p.bedrooms ?? 1;
  const bathrooms = p.bathrooms ?? 1;
  const kitchens = p.kitchens ?? 1;
  const living = p.living ?? 1;
  const laundry = p.laundry ?? 0;
  const storeys = p.storeys ?? 1;

  const baseHours =
    bedrooms * 0.15 +
    bathrooms * 0.45 +
    kitchens * 0.6 +
    living * 0.25 +
    laundry * 0.2 +
    storeys * 0.1;

  const hours = baseHours * (CLEANING_HOME_MULTIPLIER_V2[kind] ?? 1);
  const minHours = CLEANING_HOME_MIN_HOURS_V2[kind] ?? 0;
  const finalHours = Math.max(hours, minHours);

  return Math.round(finalHours * 60);
}

/* =========================
   SELECTION (params → line items)
   ========================= */
export function selectedFromParams(
  service: ServiceType,
  scope: ScopeKey,
  p: NumericParams,
  _flags: { secondStorey: boolean },
  overrideWindows?: { panes_int: number; panes_ext: number; tracks: number; screens: number },
  ctx?: Context,
  commercialType?: CommercialCleaningType
) {
  const sel: Selected = {};

  if (service === 'cleaning') {
    const bedrooms = p.bedrooms ?? 1;
    const bathrooms = p.bathrooms ?? 1;
    const laundry = p.laundry ?? 0;

    // Hourly preset → special hourly unit (kept)
    if (scope === 'hourly') {
      const hours = Math.max(3, Math.round(p.hours ?? 3)); // min 3h
      sel['clean.hourly'] = hours;
      return sel;
    }

    // COMMERCIAL cleaning: use formula → minutes bucket
    if (ctx === 'commercial') {
      const kind: CommercialCleaningType = commercialType ?? 'office';
      const mins = cleaningCommercialMinutes(kind, p);
      sel[`clean.ss.${kind}`] = mins;
      return sel;
    }

    // HOME context V2
    if (ctx === 'home') {
      const map: Partial<Record<ScopeKey, CleanScopeKindV2>> = {
        weekly: 'weekly',
        general: 'general',
        inspection: 'inspection',
        deep: 'deep',
        endoflease: 'endoflease',
      };
      const kind = map[scope];
      if (kind) {
        const mins = cleaningHomeMinutesV2(kind, p);
        sel[`clean.ss.${kind}`] = mins;
        return sel;
      }
    }

    // Fallback (atomised cleaning) – rarely used
    const floorRooms = Math.max(0, (bedrooms || 0) + (p.living || 0) + (laundry || 0));
    if (floorRooms > 0) {
      sel['clean.vac'] = floorRooms;
      sel['clean.mop'] = floorRooms;
    }
    if ((bathrooms || 0) > 0) sel['clean.bath'] = bathrooms || 0;
    if ((p.kitchens || 0) > 0) sel['clean.kit'] = p.kitchens || 0;
  }

  if (service === 'windows') {
    const inP = overrideWindows ? overrideWindows.panes_int : p.panes_int || 0;
    const exP = overrideWindows ? overrideWindows.panes_ext : p.panes_ext || 0;
    const tracks = overrideWindows ? overrideWindows.tracks : p.tracks || 0;
    const screens = overrideWindows ? overrideWindows.screens : p.screens || 0;

    if (scope === 'windows_full') {
      if (inP > 0) sel['window.pane_int_solo'] = inP;
      if (exP > 0) sel['window.pane_ext_solo'] = exP;
      if (tracks > 0) sel['window.track'] = tracks;
      if (screens > 0) sel['window.screen'] = screens;
    } else if (scope === 'windows_interior') {
      if (inP > 0) sel['window.pane_int_solo'] = inP;
      if (tracks > 0) sel['window.track'] = tracks;
    } else if (scope === 'windows_exterior') {
      if (exP > 0) sel['window.pane_ext_solo'] = exP;
      if (tracks > 0) sel['window.track'] = tracks;
      if (screens > 0) sel['window.screen'] = screens;
    } else if (scope === 'windows_tracks') {
      if (tracks > 0) sel['window.track'] = tracks;
    }
  }

  if (service === 'yard') {
    const yardArea = toNumber((p as any).yard_area ?? (p as any).area_m2, 0);
    const lawn =
      scope === 'yard_mow' && yardArea > 0 ? yardArea : toNumber(p.lawn_m2 ?? 0, 0);
    const hedge = toNumber(p.hedge_m ?? 0, 0);
    const leaves =
      scope === 'yard_leaves' && yardArea > 0 ? yardArea : toNumber(p.leaves_area ?? 0, 0);
    const blast =
      scope === 'blast_and_shine' && yardArea > 0 ? yardArea : toNumber(p.blast_m2 ?? 0, 0);
    const gutter =
      scope === 'gutter_clean' && yardArea > 0 ? yardArea : toNumber(p.gutter_m ?? 0, 0);

    // Lawn: per 100 m² block
    if (lawn > 0) {
      const blocks = Math.max(1, Math.ceil(lawn / 100));
      sel['lawn.mow'] = blocks;
    }
    // Hedge trim (per 10m)
    if (hedge > 0) {
      const units = Math.max(1, Math.ceil(hedge / 10));
      sel['hedge.trim'] = units;
    }
    // Garden tidy (per ~80 m²)
    if (leaves > 0) {
      const units = Math.max(1, Math.ceil(leaves / 80));
      sel['garden.blow'] = units;
    }
    // Pressure wash (50 m² chunks)
    if (blast > 0) {
      const units = Math.max(1, Math.ceil(blast / 50));
      sel['garden.blow'] = (sel['garden.blow'] || 0) + units;
    }
    // Gutter clean (per ~25 m² roof)
    if (gutter > 0) {
      const units = Math.max(1, Math.ceil(gutter / 25));
      sel['gutter_clean'] = units;
    }
  }

  if (service === 'dump') {
    const items = p.items || 0;
    const stops = p.stops || 0;
    const _bins = p.bins || 0;
    const packs = items > 0 ? Math.ceil(items / 4) : 0;

    if (scope === 'dump_runs' || scope === 'dump_delivery' || scope === 'dump_transport') {
      if (packs > 0) sel['dump.pack'] = packs;
      if (stops > 1) sel['dump.drive'] = stops - 1;
      if (items > 0) sel['dump.load'] = Math.max(0, items - Math.min(items, packs * 4));
      if (items > 0) sel['dump.sweep'] = Math.max(1, Math.ceil(items / 6));
    }
    if (scope === 'bin_cleans') {
      // Bin cleans uses flat per-bin pricing calculated in calculateEstimatedPrice
      // The selection map just tracks total bins for task generation
      const totalBins = (p.redBins || 0) + (p.yellowBins || 0) + (p.greenBins || 0) + (p.kitchenBins || 0);
      if (totalBins > 0) sel['dump.bin'] = totalBins;
    }
  }

  if (service === 'auto') {
    const size = p.vehicle_size || 0;
    const rows = p.rows || 0;
    const child = p.child_seats || 0;

    if (scope === 'auto_express' && size > 0) {
      // More granular pricing: hatch(1), sedan(1.2), suv(1.4), ute(1.6), van(1.8), 4wd(2)
      const multipliers = [1, 1.2, 1.4, 1.6, 1.8, 2];
      sel['auto.wash'] = multipliers[size - 1] || 1;
    }
    if (scope === 'auto_interior' && rows > 0) {
      // Increased child seat value from 0.5 to 0.75 per seat
      sel['auto.interior'] = 1 + Math.max(0, rows - 2) + (child * 0.75);
    }
    if (scope === 'auto_full' && rows > 0) {
      // Added vehicle size multiplier for consistency
      const sizeMultipliers = [1, 1.1, 1.2, 1.3, 1.4, 1.5];
      const sizeMultiplier = size > 0 ? (sizeMultipliers[size - 1] || 1) : 1;
      sel['auto.full'] = (1 + Math.max(0, rows - 2)) * sizeMultiplier;
    }
  }

  if (service === 'laundry_sneakers') {
    // Laundry scope — wash_fold only; add-ons are computed in the UI layer
    if (scope === 'laundry') {
      const loads = Math.max(1, (p as any).laundryLoads || 1);
      sel['laundry.fold'] = loads;
      return sel;
    }
    // Sneaker care scope — multi-pair price is overridden in the UI layer
    if (scope === 'sneaker_care') {
      const tier: SneakerTier = (p as any).sneakerTier || 'deep';
      if (tier === 'refresh') sel['sneaker.basic'] = 1;
      else if (tier === 'multi') sel['sneaker.basic'] = 1; // placeholder; price overridden in UI
      else sel['sneaker.full'] = 1;
      return sel;
    }
    // Legacy scope support (backward compatibility)
    if (scope === 'sneaker_basic') sel['sneaker.basic'] = 1;
    if (scope === 'sneaker_full') sel['sneaker.full'] = 1;
    if (scope === 'sneaker_lot') sel['sneaker.lot'] = 1;
    return sel;
  }

  return sel;
}

/* =========================
   PRICING ENGINE
   ========================= */
export function clampUnitPrice(
  t: Task,
  context: Context,
  opts?: { autoCategory?: CarType; autoSizeCategory?: VehicleSizeCategory | null; autoYear?: number | null }
): number {
  if (t.service === 'windows') {
    const wp = context === 'commercial' ? WINDOW_PRICES.commercial : WINDOW_PRICES.home;
    if (t.code === 'window.track') return wp.track;
    if (t.code === 'window.screen') return wp.screen ?? 0;
    return wp.pane;
  }

  if (t.service === 'auto') {
    const base = PRICE_OVERRIDE[t.code] != null ? PRICE_OVERRIDE[t.code] : t.median || 0;
    const category = opts?.autoCategory ?? 'sedan';
    const sizeCategory =
      opts?.autoSizeCategory ??
      (AUTO_SIZE_CATEGORIES.includes(category as VehicleSizeCategory)
        ? (category as VehicleSizeCategory)
        : null);
    return calculatePrice(base, category, sizeCategory, opts?.autoYear);
  }

  if (PRICE_OVERRIDE[t.code] != null) return PRICE_OVERRIDE[t.code];

  if (!t.median) return 0;
  const target = 1.1 * (t.median || 0);
  return t.p90 != null ? Math.min(target, t.p90) : target;
}

export function storeyMinutesMult(extraStoreys: number) {
  return 1 + Math.max(0, extraStoreys) * 0.08;
}
export function halfExteriorBlend(mult: number) {
  return 1 + (mult - 1) * 0.5;
}
export function taskConditionMult(code: string, flags: { petHair: boolean; greaseSoap: boolean; secondStorey: boolean }) {
  let m = 1;
  if (flags.petHair && (code === 'clean.vac' || code === 'auto.interior')) m *= 1.12;
  if (flags.greaseSoap && (code === 'clean.bath' || code === 'clean.kit' || code === 'window.track')) m *= 1.18;
  if (flags.secondStorey && code === 'window.pane_ext_solo') m *= 1.05;
  return m;
}

export function hourlyRate(
  context: Context,
  service: ServiceType,
  scope?: ScopeKey,
  commercialType?: CommercialCleaningType | null
) {
  if (service === 'cleaning') {
    if (context === 'home') {
      const map: Partial<Record<ScopeKey, number>> = {
        weekly: CLEANING_HOME_RATES_V2.weekly,
        general: CLEANING_HOME_RATES_V2.general,
        inspection: CLEANING_HOME_RATES_V2.inspection,
        deep: CLEANING_HOME_RATES_V2.deep,
        endoflease: CLEANING_HOME_RATES_V2.endoflease,
        hourly: CLEANING_HOME_RATES_V2.hourly,
      };
      return map[scope as ScopeKey] ?? CLEANING_HOME_RATES_V2.general;
    }
    const kind = commercialType ?? 'office';
    return COMM_CLEAN_RATES[kind] ?? COMM_CLEAN_RATES.office;
  }

  return context === 'commercial'
    ? POLICY.labourRate.commercial
    : POLICY.labourRate.home;
}

export function sneakerTurnaroundMeta(speed: SneakerTurnaround): SneakerTurnaroundMeta {
  return (
    SNEAKER_TURNAROUND_META.find((m) => m.key === speed) || SNEAKER_TURNAROUND_META[0]
  );
}

export function sneakerPairsForTask(code: string): number {
  if (code === 'sneaker.lot') return 4; // average pairs per lot
  return 1;
}

export function sneakerSurchargePerTask(code: string, speed: SneakerTurnaround): number {
  const meta = sneakerTurnaroundMeta(speed);
  const pairs = sneakerPairsForTask(code);
  return meta.surcharge * pairs;
}

export function sneakerTurnaroundMultiplier(speed: SneakerTurnaround) {
  const found = SNEAKER_TURNAROUND.find((t) => t.key === speed);
  return found ? found.multiplier : 1;
}

/* ===== Laundry pricing ===== */

export function laundryPriceForTier(_tier: LaundryTier, loads: number): number {
  const pricePerLoad = PRICE_OVERRIDE['laundry.fold'] ?? 30;
  return pricePerLoad * Math.max(1, loads);
}

export function sneakerPriceForTier(tier: SneakerTier, turnaround: SneakerTurnaround): number {
  const meta = sneakerTurnaroundMeta(turnaround);
  // Multi-pair is priced via SNEAKER_MULTI_PRICING in the UI layer
  const base = tier === 'refresh' ? PRICE_OVERRIDE['sneaker.basic'] : PRICE_OVERRIDE['sneaker.full'];
  return (base || 40) + meta.surcharge;
}

/* ===== Dump disposal ===== */

export const DUMP_LOAD_META: Record<NonNullable<DumpRunSelection['loadType']>, { tier: DumpTier; volume: number }> = {
  ute: { tier: 'small', volume: 1.5 },
  trailer: { tier: 'medium', volume: 2.5 },
  bulky: { tier: 'large', volume: 2.0 },
};

export const DUMP_DISPOSAL_FEES: Record<DumpTier, number> = {
  small: 15,
  medium: 34,
  large: 55,
};

export const DUMP_WEIGHT_PRICING = {
  resident: { perTonne: 166, minimum: 55 },
  nonResident: { perTonne: 312, minimum: 197 },
} as const;

// Thresholds to fall back to weight-based pricing when the volume is clearly beyond typical loads.
const DUMP_WEIGHT_VOLUME_THRESHOLD_M3 = 6;
const DUMP_WEIGHT_LOAD_THRESHOLD = 4;
// Rough density assumption to convert cubic metres into tonnes for mixed household waste.
const DUMP_WEIGHT_DENSITY_T_PER_M3 = 0.18;

export function computeDumpDisposalFee(
  selection?: DumpRunSelection | null,
  opts?: { nonResident?: boolean }
) {
  if (!selection) return { fee: 0, volume: 0, basis: 'tier' as const };
  const loads = clamp(Math.round(selection.loads ?? 1), 1, 20);
  const meta = selection.loadType ? DUMP_LOAD_META[selection.loadType] : null;
  const tier: DumpTier = meta?.tier ?? 'small';
  const perLoad = DUMP_DISPOSAL_FEES[tier];
  const volumePerLoad = meta?.volume ?? 1.5;
  const totalVolume = loads * volumePerLoad;

  const shouldUseWeight =
    totalVolume >= DUMP_WEIGHT_VOLUME_THRESHOLD_M3 || loads >= DUMP_WEIGHT_LOAD_THRESHOLD;

  if (!shouldUseWeight) {
    return { fee: perLoad * loads, volume: totalVolume, basis: 'tier' as const };
  }

  const rate = opts?.nonResident ? DUMP_WEIGHT_PRICING.nonResident : DUMP_WEIGHT_PRICING.resident;
  const estTonnes = totalVolume * DUMP_WEIGHT_DENSITY_T_PER_M3;
  const weightFee = Math.max(rate.minimum * loads, estTonnes * rate.perTonne);
  return { fee: weightFee, volume: totalVolume, basis: 'weight' as const };
}

/* =========================
   MAIN PRICE QUOTE
   ========================= */
export function priceQuote(params: QuoteParams) {
  const {
    context,
    currentService,
    currentScope,
  selected,
  distanceKm,
  paidParking,
  tipFee,
  conditionMult,
  conditionLevel = 'standard',
  flags,
  windowsStoreys = 1,
  windowsStoreysOverride,
  commercialUplift,
  sizeAdjust,
  conditionFlat,
  contractDiscount,
  commercialType,
  autoCategory,
  autoSizeCategory,
  autoYear,
  sneakerTurnaround: _sneakerTurnaround = 'standard',
  afterHours,
  bottleCount: _bottleCount = 0,
  dumpRunSelection,
  dumpIsNonResident,
  cleaningParams,
  yardParams,
  windowsMinutesOverride,
  commFrequency,
  commPreset = 'essential',
  } = params;

  const isDumpRunScope = currentService === 'dump' && currentScope === 'dump_runs';
  const disposalMeta = isDumpRunScope
    ? computeDumpDisposalFee(dumpRunSelection, { nonResident: dumpIsNonResident })
    : { fee: 0, volume: 0, basis: 'tier' as const };
  const disposalFee = Math.round(disposalMeta.fee || 0);

  const totalQty = Object.values(selected).reduce((a, b) => a + (b || 0), 0);
  if (totalQty === 0 && disposalFee === 0) {
    return {
      total: 0,
      minutes: 0,
      billableMinutes: 0,
      unitSum: 0,
      labourFloor: 0,
      travel: 0,
      parking: 0,
      tip: 0,
      hourlyUsed: 0,
      billingMode: 'Per-unit' as const,
      confidence: 'High' as const,
      baseBeforeFees: 0,
      disposalFee: 0,
    };
  }

  const SETUP_OVERHEAD = currentService === 'laundry_sneakers' ? 0 : 15;
  const WINDOW_DISCOUNT_1 = { qty: 40, mult: 0.95 };
  const WINDOW_DISCOUNT_2 = { qty: 80, mult: 0.92 };

  let minutes = windowsMinutesOverride != null ? windowsMinutesOverride : SETUP_OVERHEAD;
  let unitSum = 0;
  let windowUnitSum = 0;
  let labourFloor = 0;
  let extraCost = 0;
  let addonMinutes = 0;
  let addonCost = 0;

  const allCodes = Object.keys(selected).filter((k) => (selected[k] || 0) > 0);
  const isWindowsOnly = allCodes.every((k) => TASK_MAP.get(k)?.service === 'windows');
  const isBinCleansOnly = allCodes.every((k) => k === 'dump.bin');
  const isAutoOnly = allCodes.every((k) => TASK_MAP.get(k)?.service === 'auto');
  const hourlyQty = selected['clean.hourly'] || 0;

  // Hard override for commercial cleaning: fixed preset block (hours/price) with optional frequency
  if (currentService === 'cleaning' && context === 'commercial') {
    const niche: CommercialCleaningType = commercialType ?? 'office';
    const preset =
      COMM_PRESET_PRICING[niche]?.[commPreset] ??
      COMM_PRESET_PRICING[niche]?.essential ??
      { hours: 2, price: 120, sqm: 0 };
    const minutesFixed = Math.round(preset.hours * 60);
    const baseFixed = preset.price;
    const sqm = Number(cleaningParams?.sqm ?? preset.sqm ?? 0);
    const extraSqm = Math.max(0, sqm - (preset.sqm ?? 0));
    const per100 =
      niche === 'office' || niche === 'accommodation' || niche === 'event'
        ? 18
        : 22;
    const extraBlocks = Math.ceil(extraSqm / 100);
    const areaSurcharge = extraBlocks > 0 ? extraBlocks * per100 : 0;
    const freqDisc: Record<string, number> = {
      daily: 0.28,
      '3x_weekly': 0.18,
      weekly: 0.12,
      fortnightly: 0,
      none: 0,
    };
    const discount = freqDisc[commFrequency || 'none'] ?? 0;
    const baseAfterDisc = (baseFixed + areaSurcharge) * (1 - discount);
    const baseWithDisposal = baseAfterDisc + disposalFee;

    const travel = Math.max(0, distanceKm - POLICY.travelBaseKm) * POLICY.travelPerKm;
    const parking = paidParking ? POLICY.parkingMin : 0;
    const totalFixed = baseWithDisposal + travel + parking + (tipFee || 0);
    return {
      total: Math.round(totalFixed),
      minutes: minutesFixed,
      billableMinutes: minutesFixed,
      unitSum: Math.round(baseAfterDisc),
      labourFloor: 0,
      travel: Math.round(travel),
      parking,
      tip: tipFee || 0,
      hourlyUsed: Math.round(baseFixed / (preset.hours || 1)),
      confidence: 'High',
      baseBeforeFees: Math.round(baseWithDisposal),
      bottleCredit: 0,
      disposalFee: Math.round(disposalFee),
      displayPrice: fmtAUD(totalFixed),
    };
  }

  // Auto detailing: keep time purely package-based (no generic setup overhead)
  if (currentService === 'auto' && windowsMinutesOverride == null) {
    minutes = 0;
  }

  // Synthetic SS minutes (home/commercial cleaning)
  const ssMin = allCodes
    .filter((c) => c.startsWith('clean.ss.'))
    .reduce((acc, c) => acc + (selected[c] || 0), 0);
  minutes += ssMin;

  const winStoreys = windowsStoreysOverride ?? windowsStoreys ?? 1;
  const extraStoreys = Math.max(0, winStoreys - 1);
  const heightMult = storeyMinutesMult(extraStoreys);

  for (const [code, qty] of Object.entries(selected)) {
    if (!qty || qty <= 0) continue;
    if (code.startsWith('clean.ss.')) continue;
    // When a windows override is supplied, skip adding per-task window minutes so we don't double count.
    const task = TASK_MAP.get(code);
    if (!task) continue;
    const isWindowTask = task.service === 'windows';
    if (windowsMinutesOverride != null && isWindowTask) {
      // still allow pricing for windows tasks
    } else {
      let perMin = task.minutes * taskConditionMult(code, flags);
      if (code === 'window.pane_ext_solo') perMin *= heightMult;
      if (code === 'window.full') perMin *= halfExteriorBlend(heightMult);

      minutes += perMin * qty;
    }

    let pricePer = clampUnitPrice(task, context, { autoCategory: autoCategory as CarType | undefined, autoSizeCategory: autoSizeCategory as VehicleSizeCategory | null | undefined, autoYear });
    // Add sneaker turnaround surcharge for sneaker tasks
    if (task.service === 'laundry_sneakers' && code.startsWith('sneaker.')) {
      const surcharge = sneakerSurchargePerTask(code, params.sneakerTurnaround ?? 'standard');
      pricePer += surcharge;
    }
    unitSum += pricePer * qty;
    if (task.service === 'windows') windowUnitSum += pricePer * qty;
  }

  // Window discount when NOT pure windows
  if (!isWindowsOnly && windowUnitSum > 0) {
    const totalWindowQty =
      (selected['window.full'] || 0) +
      (selected['window.pane_int_solo'] || 0) +
      (selected['window.pane_ext_solo'] || 0) +
      (selected['window.screen'] || 0) +
      (selected['window.track'] || 0);

    let mult = 1;
    if (totalWindowQty >= WINDOW_DISCOUNT_2.qty) mult = WINDOW_DISCOUNT_2.mult;
    else if (totalWindowQty >= WINDOW_DISCOUNT_1.qty) mult = WINDOW_DISCOUNT_1.mult;

    if (mult !== 1) {
      const nonWindow = unitSum - windowUnitSum;
      unitSum = nonWindow + Math.round(windowUnitSum * mult);
    }
  }

  const paceMult =
    currentService === 'auto'
      ? 1
      : currentService === 'cleaning' && context === 'commercial'
      ? 1
      : POLICY.paceFactor *
        (context === 'commercial' ? commercialUplift : 1) *
        (context === 'commercial' ? 1.1 : 1) *
        conditionMult;
  minutes *= paceMult;

  let billable = minutes;
  let base = 0;
  let hourlyUsed = 0;

  if (currentService === 'yard' && yardParams) {
    const yard = computeYardQuote(yardParams, {
      scope: currentScope,
      isTwoStoreyGutter: flags.secondStorey,
      conditionMultiplier: conditionMult,
      accessTight: flags.clutterAccess,
      conditionLevel,
      context,
    });
    minutes = yard.minutes;
    billable = yard.minutes;
    labourFloor = Math.round(yard.labourFloor);
    base = yard.cost;
    unitSum = 0;
    windowUnitSum = 0;
  } else if (currentService === 'laundry_sneakers') {
    // Laundry & Sneakers: outcome-based; no labour/time billing. Use unitSum only.
    minutes = 0;
    billable = 0;
    labourFloor = 0;
    base = unitSum;
  } else if (hourlyQty > 0 && currentService === 'cleaning') {
    hourlyUsed = hourlyRate(context, currentService, currentScope, commercialType);
    minutes = hourlyQty * 60;
    billable = minutes;
    base = hourlyQty * hourlyUsed;
  } else if (isWindowsOnly || isBinCleansOnly) {
    base = unitSum;
  } else if (isAutoOnly) {
    billable = minutes;
    base = unitSum;
    labourFloor = 0;
  } else if (currentService === 'cleaning' && context === 'commercial') {
    // Fixed 4h block for commercial cleaning cards
    minutes = 240;
    billable = 240;
    const hrRate = hourlyRate(context, currentService, currentScope, commercialType);
    base = (billable / 60) * hrRate;
    unitSum = base;
    labourFloor = 0;
  } else if (currentService === 'cleaning' && context === 'home') {
    // Home cleaning: use preset base minutes and extras (time for display, cost from base + extras cost only)
    let minBlock: number = POLICY.minBlock[context];
    const kindMap: Partial<Record<ScopeKey, CleanScopeKindV2>> = {
      weekly: 'weekly',
      general: 'general',
      inspection: 'inspection',
      deep: 'deep',
      endoflease: 'endoflease',
      hourly: 'hourly',
    };
    const kind = kindMap[currentScope];
    if (kind) minBlock = Math.round(CLEANING_HOME_MIN_HOURS_V2[kind] * 60);

    const extras = computeHomeExtras(currentScope, cleaningParams || {});
    extraCost = extras.extraCost;
    const addOns = computeCleaningAddons(currentScope, cleaningParams || {});
    addonMinutes = addOns.minutes;
    addonCost = addOns.cost;
    // display minutes include extras + add-ons
    minutes = extras.baseMinutes + extras.extraMinutes + addonMinutes;
    // billable minutes for labour based on base preset only (respect minBlock)
    const baseMinutes = Math.max(minBlock, extras.baseMinutes);
    billable = Math.max(minBlock, roundToHalfHour(baseMinutes / 60) * 60);

    const hrRate = hourlyRate(context, currentService, currentScope, commercialType);
    labourFloor = (billable / 60) * hrRate;
    base = labourFloor + extraCost + addonCost;
  } else {
    // Other services / commercial cleaning
    const minBlock = POLICY.minBlock[context];
    billable = Math.max(minutes, minBlock);

    // Round to nearest half hour
    const rounded = roundToHalfHour(billable / 60) * 60;
    billable = Math.max(minBlock, rounded);

    const hrRate =
      hourlyRate(context, currentService, currentScope, commercialType) *
      (currentService === 'cleaning'
        ? 1
        : context === 'commercial'
        ? commercialUplift
        : 1);

    labourFloor = (billable / 60) * hrRate * POLICY.guard;
    base = Math.max(unitSum, labourFloor);
  }

  // After-hours commercial cleaning uplift
  if (currentService === 'cleaning' && context === 'commercial' && afterHours) {
    base *= 1.15;
  }

  let sizeMult = sizeAdjust === 'small' ? 0.8 : sizeAdjust === 'large' ? 1.5 : 1;
  let flatAdjust = conditionFlat;
  let discount = contractDiscount;
  let materials =
    currentService === 'cleaning' ? (context === 'commercial' ? 12 : 8) : 0;

  // Home cleaning: keep totals aligned to base hours/rate without size/condition/contract tweaks
  if (currentService === 'cleaning' && context === 'home') {
    sizeMult = 1;
    flatAdjust = 0;
    discount = 0;
    materials = 0;
  }
  const afterSize = base * sizeMult + flatAdjust;
  const afterDiscount = Math.max(0, afterSize * (1 - discount));
  const afterDisposal = afterDiscount + disposalFee;

  const travel = Math.max(0, distanceKm - POLICY.travelBaseKm) * POLICY.travelPerKm;
  const parking = paidParking ? POLICY.parkingMin : 0;

  // Bottle credit deprecated - recycling bins now have lower base price instead
  const bottleCredit = 0;
  const baseAfterCredit = Math.max(0, afterDisposal - bottleCredit);

  let total = baseAfterCredit + travel + parking + (tipFee || 0) + materials;
  if (currentService === 'auto') {
    total = roundTo(total, 5);
  } else if (
    !(
      isWindowsOnly ||
      isBinCleansOnly ||
      isAutoOnly ||
      (hourlyQty > 0 && currentService === 'cleaning')
    )
  ) {
    total = roundTo(total, POLICY.roundingTo);
  }

  // Display minutes snapped to nearest 0.5h so UI always shows clean blocks
  let displayMinutes = minutes;
  if (
    !isWindowsOnly &&
    !isBinCleansOnly &&
    !isAutoOnly &&
    !(hourlyQty > 0 && currentService === 'cleaning')
  ) {
    displayMinutes = billable;
  }
  if (isAutoOnly) {
    displayMinutes = Math.round(displayMinutes);
  } else {
    const displayHours = roundToHalfHour(displayMinutes / 60);
    displayMinutes = Math.round(displayHours * 60);
  }

  // Force commercial cleaning to display the fixed 4h block and flat price
  if (currentService === 'cleaning' && context === 'commercial') {
    const hrRate = hourlyRate(context, currentService, currentScope, commercialType);
    const baseFixed = 4 * hrRate;
    const baseFixedWithDisposal = baseFixed + disposalFee;
    const totalFixed = baseFixedWithDisposal + travel + parking + (tipFee || 0);
    return {
      total: Math.round(totalFixed),
      minutes: 240,
      billableMinutes: 240,
      unitSum: Math.round(baseFixed),
      labourFloor: 0,
      travel: Math.round(travel),
      parking,
      tip: tipFee || 0,
      hourlyUsed: Math.round(hrRate),
      confidence: 'High',
      baseBeforeFees: Math.round(baseFixedWithDisposal),
      bottleCredit: Math.round(bottleCredit),
      disposalFee: Math.round(disposalFee),
      displayPrice: fmtAUD(totalFixed),
    };
  }

  return {
    total,
    minutes: displayMinutes,
    billableMinutes: Math.round(billable),
    unitSum: Math.round(unitSum),
    labourFloor: Math.round(
      isWindowsOnly ||
      isBinCleansOnly ||
      isAutoOnly ||
      (hourlyQty > 0 && currentService === 'cleaning')
        ? 0
        : labourFloor
    ),
    travel: Math.round(travel),
    parking,
    tip: tipFee || 0,
    hourlyUsed: Math.round(hourlyUsed),
    confidence: 'High',
    baseBeforeFees: Math.round(baseAfterCredit),
    disposalFee: Math.round(disposalFee),
    bottleCredit: Math.round(bottleCredit),
    displayPrice: fmtAUD(total),
  };
}
