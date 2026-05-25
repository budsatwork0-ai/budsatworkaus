import type {
  ServiceType, ScopeKey, Context,
  CommercialCleaningType, CleaningWizardChecklistState,
  WizardState, YardJob,
} from '../types';
import type { ParamDef } from '../types';
import { clamp, toSafeInt } from '../utils/formatting';
import { WIN_RULES } from './pricing/constants';
import { PARAMS_FULL, COMM_PARAM_DEFS } from './service-data';
import { v4 as uuidv4 } from 'uuid';

/* =========================
   PARAM HELPERS
   ========================= */

export function getCleaningParamDefs(ctx: Context, kind?: CommercialCleaningType | null): ParamDef[] {
  if (ctx === 'commercial') {
    const t = kind ?? 'office';
    return COMM_PARAM_DEFS[t];
  }
  return PARAMS_FULL.cleaning;
}

export const clampParam = (def: ParamDef, v: number) => clamp(v, def.min ?? 0, def.max ?? Number.POSITIVE_INFINITY);

export const fromDefs = (defs: ParamDef[]): Record<string, number> =>
  Object.fromEntries(defs.map((p) => [p.key, p.defaultValue])) as Record<string, number>;

export const defaultParamsByService = () => ({
  cleaning: fromDefs(PARAMS_FULL.cleaning),
  windows: fromDefs(PARAMS_FULL.windows),
  yard: fromDefs(PARAMS_FULL.yard),
  dump: fromDefs(PARAMS_FULL.dump),
  auto: fromDefs(PARAMS_FULL.auto),
  laundry_sneakers: {}, // laundry & sneakers use tiers only
});

/* =========================
   WINDOWS HELPERS
   ========================= */

export function getScopeFlags(scope: ScopeKey) {
  const isIntOnly = scope === 'windows_interior';
  const isExtOnly = scope === 'windows_exterior';
  const isTracksOnly = scope === 'windows_tracks';
  const isFull = scope === 'windows_full' || (!isIntOnly && !isExtOnly && !isTracksOnly);
  return { isIntOnly, isExtOnly, isTracksOnly, isFull };
}

export function computeWindowsMinutes(
  scope: ScopeKey,
  rows: WizardState['winRows'],
  context: Context,
  _paramsWindows?: Record<string, unknown>
): number {
  const { isIntOnly, isExtOnly, isTracksOnly, isFull } = getScopeFlags(scope);
  const seg = {
    int: isFull || isIntOnly,
    ext: isFull || isExtOnly,
    tracks: isFull || isTracksOnly,
  };

  const totals = rows.reduce(
    (a, r) => {
      a.int += toSafeInt(r.int);
      a.ext += toSafeInt(r.ext);
      a.tracks += toSafeInt(r.tracks);
      a.screens += context === 'commercial' ? 0 : toSafeInt(r.screens);
      return a;
    },
    { int: 0, ext: 0, tracks: 0, screens: 0 }
  );

  const W = WIN_RULES.WEIGHT;
  let minutes =
    (seg.int ? totals.int * W.INT : 0) +
    (seg.ext ? totals.ext * W.EXT : 0) +
    (seg.tracks ? totals.tracks * W.TRACK : 0) +
    (seg.ext ? totals.screens * W.SCREEN : 0);

  const round15 = (n: number) => Math.round(n / 15) * 15;
  minutes = round15(minutes);

  const minTarget = (WIN_RULES.TARGETS as Record<string, number>)[scope] || 0;
  if (minTarget > 0 && minutes < minTarget) minutes = minTarget;

  return Math.max(0, minutes);
}

/* =========================
   PRESETS FROM SCOPES → PARAMS
   ========================= */
export function scopePresetFor(
  service: ServiceType,
  scope: ScopeKey,
  ctx?: Context
): Partial<Record<string, number>> {
  const zero = fromDefs(PARAMS_FULL[service]);
  Object.keys(zero).forEach((k) => (zero[k] = 0));

  if (service === 'windows') {
    const isCommercial = ctx === 'commercial';
    if (scope === 'windows_full')
      return { ...zero, panes_int: 12, panes_ext: 12, tracks: 12, screens: isCommercial ? 0 : 12, storeys: 1 };
    if (scope === 'windows_interior')
      return { ...zero, panes_int: 12, tracks: 12, screens: 0, storeys: 1 };
    if (scope === 'windows_exterior')
      return { ...zero, panes_ext: 12, tracks: 0, screens: 12, storeys: 1 };
    if (scope === 'windows_tracks') return { ...zero, tracks: 12, screens: 0, storeys: 1 };
  }

  if (service === 'cleaning') {
    const std = { bedrooms: 4, bathrooms: 2, kitchens: 1, laundry: 1, living: 2, storeys: 1 } as any;
    const weekly = { bedrooms: 4, bathrooms: 2, kitchens: 1, laundry: 1, living: 1, storeys: 1 } as any;
    const deep = { bedrooms: 4, bathrooms: 3, kitchens: 1, laundry: 1, living: 2, storeys: 1 } as any;
    const move = { bedrooms: 4, bathrooms: 3, kitchens: 1, laundry: 1, living: 2, storeys: 1 } as any;
    if (scope === 'weekly') return { ...weekly };
    if (scope === 'general') return { ...std };
    if (scope === 'deep') return { ...deep };
    if (scope === 'endoflease') return { ...move };
    return scope === 'hourly' ? { ...std, hours: 3 } : { ...std };
  }

  if (service === 'yard') {
    if (scope === 'yard_mow') return { ...zero, lawn_m2: 300 };
    if (scope === 'yard_hedge') return { ...zero, hedge_m: 30 };
    if (scope === 'yard_leaves') return { ...zero, leaves_area: 150 };
    if (scope === 'blast_and_shine') return { ...zero, blast_m2: 80 };
    if (scope === 'gutter_clean') return { ...zero, gutter_m: 120 };
  }

  if (service === 'dump') {
    if (scope === 'dump_runs') return { ...zero, items: 4, stops: 1, bins: 0 };
    if (scope === 'bin_cleans') return { ...zero, redBins: 0, yellowBins: 0, greenBins: 0, kitchenBins: 0, binPlan: 0, items: 0, stops: 0 };
    if (scope === 'dump_delivery') return { ...zero, items: 2, stops: 2, bins: 0 };
    if (scope === 'dump_transport') return { ...zero, items: 3, stops: 2, bins: 0 };
  }

  if (service === 'auto') {
    if (scope === 'auto_express') return { ...zero, vehicle_size: 2, rows: 0, child_seats: 0 };
    if (scope === 'auto_interior') return { ...zero, vehicle_size: 2, rows: 2, child_seats: 0 };
    if (scope === 'auto_full') return { ...zero, vehicle_size: 2, rows: 2, child_seats: 0 };
  }

  return zero;
}

/* =========================
   CLEANING CHECKLIST (wizard-driven)
   ========================= */
export const CLEANING_TASK_LIBRARY = {
  base: [
    'Surfaces dusted & wiped',
    'Floors vacuumed and mopped',
    'Bathrooms cleaned (toilets, showers, vanities)',
    'Kitchen benches & stove wipe',
    'Bins emptied',
    'Mirrors and glass spot-clean',
  ],
  mess: {
    tidy: ['Light clutter tidy and reset'],
    'lived-in': ['Extra wipe-down of kitchen & bathrooms', 'High-touch points refreshed'],
    reset: ['Detail skirting/frames & fronts', 'Degrease heavier kitchen/bath areas'],
  },
  addOns: {
    oven: ['Oven interior cleaned'],
    fridge: ['Fridge interior wipe/clean'],
    windows: ['Windows/Glass quick pass (inside)'],
    cupboards: ['Inside cupboards (shelves wiped)'],
    walls: ['Spot clean walls/marks'],
  },
  deep: ['Detail kitchen & bathrooms', 'Edge vacuum & dusting in corners'],
  move: ['Inside appliances included', 'Inside cupboards/drawers wiped', 'Detail skirting/frames'],
  bathrooms: ['Additional bathroom focus for multiple bathrooms'],
  size: {
    '5+': ['Larger-home pass to keep pacing on-track'],
  },
};

export function buildCleaningChecklistFromWizard(state: CleaningWizardChecklistState): string[] {
  const tasks: string[] = [];
  const push = (xs?: string[]) => {
    if (!xs) return;
    for (const t of xs) tasks.push(t);
  };

  push(CLEANING_TASK_LIBRARY.base);

  if (state.messLevel === 'tidy') push(CLEANING_TASK_LIBRARY.mess.tidy);
  if (state.messLevel === 'lived-in') push(CLEANING_TASK_LIBRARY.mess['lived-in']);
  if (state.messLevel === 'reset') push(CLEANING_TASK_LIBRARY.mess.reset);

  if (state.bathrooms >= 2) push(CLEANING_TASK_LIBRARY.bathrooms);
  if (state.propertySize === '5+') push(CLEANING_TASK_LIBRARY.size['5+']);

  if (state.scope === 'deep') push(CLEANING_TASK_LIBRARY.deep);
  if (state.scope === 'endoflease') push(CLEANING_TASK_LIBRARY.move);

  if (state.addOns.oven) push(CLEANING_TASK_LIBRARY.addOns.oven);
  if (state.addOns.fridge) push(CLEANING_TASK_LIBRARY.addOns.fridge);
  if (state.addOns.windows) push(CLEANING_TASK_LIBRARY.addOns.windows);
  if (state.addOns.cupboards) push(CLEANING_TASK_LIBRARY.addOns.cupboards);
  if (state.addOns.walls) push(CLEANING_TASK_LIBRARY.addOns.walls);

  // Deduplicate while preserving order
  const seen = new Set<string>();
  return tasks.filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

/* =========================
   CLEANING SIZE PRESETS + DERIVED STATE
   ========================= */
export const CLEANING_SIZE_PRESETS = {
  studio: { bedrooms: 1, bathrooms: 1, kitchens: 1, living: 0, laundry: 0, storeys: 1 },
  small:  { bedrooms: 2, bathrooms: 1, kitchens: 1, living: 1, laundry: 0, storeys: 1 },
  medium: { bedrooms: 4, bathrooms: 2, kitchens: 1, living: 2, laundry: 1, storeys: 1 },
  large:  { bedrooms: 5, bathrooms: 3, kitchens: 1, living: 2, laundry: 1, storeys: 2 },
} as const;

export type CleaningSizeKey = keyof typeof CLEANING_SIZE_PRESETS;

export interface CleaningState {
  cleaningParams: Record<string, number>;
  cleaningSizeKey: CleaningSizeKey;
  sizePreset: (typeof CLEANING_SIZE_PRESETS)[CleaningSizeKey];
  bathroomsChoice: 1 | 2 | 3;
  cupboardsSelected: boolean;
  wallsSelected: boolean;
  messLevel: string;
}

export function deriveCleaningState(S: WizardState, scopeKey: string): CleaningState {
  const cleaningParams = (
    S.paramsByService.cleaning && Object.keys(S.paramsByService.cleaning).length > 0
      ? S.paramsByService.cleaning
      : (scopePresetFor('cleaning', scopeKey, S.context) || {})
  ) as Record<string, number>;

  const deriveSizeKey = (): CleaningSizeKey => {
    const beds = cleaningParams.bedrooms ?? 1;
    if (beds <= 1) return 'studio';
    if (beds <= 2) return 'small';
    if (beds <= 4) return 'medium';
    return 'large';
  };
  const cleaningSizeKey = deriveSizeKey();
  const sizePreset = CLEANING_SIZE_PRESETS[cleaningSizeKey];

  const bathroomsChoice = (() => {
    const b = cleaningParams.bathrooms ?? sizePreset.bathrooms ?? 1;
    if (b <= 1) return 1;
    if (b <= 2) return 2;
    return 3;
  })() as 1 | 2 | 3;

  const cupboardsSelected = (cleaningParams.kitchens ?? sizePreset.kitchens) > sizePreset.kitchens;
  const wallsSelected = (cleaningParams.living ?? sizePreset.living) > sizePreset.living;
  const messLevel = S.conditionLevel;

  return { cleaningParams, cleaningSizeKey, sizePreset, bathroomsChoice, cupboardsSelected, wallsSelected, messLevel };
}

/* =========================
   YARD JOB FACTORY
   ========================= */
export function createYardJob(): YardJob {
  return {
    job_id: uuidv4(),
    address: '',
    area_m2: null,
    polygon_geojson: [],
    condition: 'maintained',
    terrain: 'flat',
    price: 0,
    status: 'draft',
    created_at: new Date().toISOString(),
  };
}
