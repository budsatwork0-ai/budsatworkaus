import React from 'react';
import type {
  ServiceType, ScopeKey, ScopeDef, ImpactLevel, MicroPreset,
  Task, CommercialCleaningType, CommMeta, CommParamDef,
  ParamTable, YardMeasurementConfig, YardMeasurementMode,
  StoreyRow,
} from '../types';
import { WindowIcon, CleanIcon, LawnIcon, TruckIcon, CarIcon, ShoeIcon } from '../utils/icons';

/* =========================
   SERVICES
   ========================= */
export const SERVICES = [
  { key: 'windows',  label: 'Window Cleaning',      icon: <WindowIcon />, subtitle: 'Panes · Tracks' },
  { key: 'cleaning', label: 'Cleaning',             icon: <CleanIcon />,  subtitle: 'Weekly · Deep · EoL', popular: true },
  { key: 'yard',     label: 'Yard Care',            icon: <LawnIcon />,   subtitle: 'Mow · Hedge · Tidy', popular: true },
  { key: 'dump',     label: 'Removal & Delivery',   icon: <TruckIcon />,  subtitle: 'Dump · Delivery' },
  { key: 'auto',     label: 'Car Detailing',        icon: <CarIcon />,    subtitle: 'Express · Full' },
  { key: 'laundry_sneakers', label: 'Laundry & Sneaker Care', icon: <ShoeIcon />, subtitle: 'Wash · Fold · Sneakers' },
] as const;

/* =========================
   DISCLAIMERS
   ========================= */
export const TERMS_SNIPPET =
  'Pricing shown is indicative only. Final pricing may vary based on property size, access, onsite conditions (e.g. parking, height), level of build-up/soiling, scope changes, waste/tip fees, extra time requested, and safety considerations. Any adjustments will be discussed with you before work proceeds.';

export const PRICE_SCOPE_DISCLAIMER =
  'Price reflects the selected scope. Changes are confirmed before work begins.';

export const FAIRNESS_PROMISE_COPY =
  'Found a cheaper local quote for the same scope? Let us know and we\'ll do our best to match or improve it.';

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

// Local storage key for persisting wizard state; bump if shape changes.
export const STORAGE_KEY = 'budsatwork.quote.v2';
// Optional dev helper: flip to true to reset stored session on mount.
export const RESET_ON_MOUNT = false;

/* =========================
   SCOPES
   ========================= */

/** Cleaning scopes (aligned to pricing/selection logic: clean_std / clean_deep / clean_move) */
export const CLEAN_SCOPES: ScopeDef[] = [
  {
    key: 'clean_std',
    label: 'Standard Clean',
    inclusions: [
      'Dust all surfaces (furniture, shelves, sills)',
      'Vacuum carpets & rugs',
      'Sweep & mop hard floors',
      'Kitchen counters, sink & appliance exteriors',
      'Bathroom surfaces (sinks, counters, toilets, mirrors)',
      'Empty trash & replace liners',
      'Make beds / change linens (if provided)',
      'Wipe cabinets & doorknobs',
      'Clean mirrors & glass',
      'Tidy & straighten (light organizing)',
    ],
    desc: 'Regular maintenance clean for homes or light commercial.',
  },
  {
    key: 'clean_deep',
    label: 'Deep Clean',
    inclusions: [
      'Inside refrigerator',
      'Inside oven',
      'Inside microwave',
      'Stove hood & filters',
      'Cabinet exteriors & interiors',
      'Backsplash, counters, sink (polish)',
      '— Bathrooms —',
      'Tiles & grout (scrub)',
      'Toilet (inside/outside)',
      'Inside cabinets & drawers',
      'Fixtures & drains (descale)',
      'Mirrors & exhaust fan',
      '— Living areas —',
      'Baseboards & door frames',
      'Ceiling fans & light fixtures',
      'Under beds & furniture',
      'Interior windows, tracks, sills',
      'Blinds or curtains',
      'Air vents',
      '— Floors —',
      'Deep vacuum carpets',
      'Scrub hard floors & grout',
      'Stair railings',
      '— Final —',
      'Doors & knobs',
      'Light switches & outlets',
      'Trash cans (clean & reline)',
      'Spot-clean walls',
    ],
    desc: 'One-off intensive clean before guests or seasonal reset.',
  },
  {
    key: 'clean_move',
    label: 'Move-in/out',
    inclusions: [
      'Inside refrigerator (shelves, drawers, seals, defrost)',
      'Inside freezer (remove ice)',
      'Inside oven (racks, door, walls, broiler)',
      'Stove hood, filters & vent (degrease)',
      'Inside cabinets, drawers & shelves',
      'Dishwasher interior (filter, seal, racks)',
      'Sink, faucet, drain & disposal (polish)',
      'Countertops, backsplash & kickplates',
      '— Bathrooms —',
      'Tiles, grout & caulking (deep scrub)',
      'Toilet (tank, base, bowl, lid)',
      'Inside vanity, medicine cabinet & drawers',
      'Showerhead, faucet & drains (descale)',
      'Fixtures & mirrors (polish)',
      'Exhaust fan cover',
      'Floors & baseboards (sanitize)',
      '— Living areas —',
      'Baseboards, crown molding, trim',
      'Ceiling fans & light fixtures',
      'Interior windows, tracks, sills, blinds',
      'Air vents & returns',
      'Closet shelves, rods & floors',
      'Doors, frames & knobs',
      'Light switches, outlets & walls (spot-wash)',
      'Under movable furniture (vacuum/sweep)',
      '— Floors —',
      'Deep vacuum carpets (edges)',
      'Scrub/steam hard floors (grout)',
      'Stair railings & balusters',
      'Floor vents & grates',
      '— Final —',
      'Trash cans (empty, clean, reline)',
      'Laundry room (appliances, sink, cabinets)',
      'Entryway & mudroom',
      'Patio door glass & track',
      'Final walk-through & touch-ups',
    ],
    desc: 'Bond-style clean for empty or near-empty properties.',
  },
];

/* ===== Cleaning impact dots + micro-presets ===== */

// Very lightweight rules to colour the little impact dot per task line
export const CLEANING_IMPACTS: { match: RegExp; impact: ImpactLevel }[] = [
  // Light
  { match: /dust|wipe|tidy|straighten|mirrors|glass|visible surfaces/i, impact: 'light' },
  { match: /benches|sills|frames|doorknobs|handles/i, impact: 'light' },

  // Medium
  { match: /vacuum|mop|floors|baseboards|door frames|skirting/i, impact: 'medium' },
  { match: /inside cabinets|drawers|cupboards|fridge/i, impact: 'medium' },

  // Heavy
  { match: /grout|deep scrub|stove|oven|rangehood|hood|filters|defrost/i, impact: 'heavy' },
  { match: /steam|descale|caulking|balusters/i, impact: 'heavy' },

  // Detail
  { match: /polish|tracks|sills|crown molding|vents|returns|touch-ups/i, impact: 'detail' },

  // Organising / misc
  { match: /laundry room|entryway|mudroom|final walk-through/i, impact: 'organising' },
];

export function impactForCleaningItem(label: string): ImpactLevel {
  for (const rule of CLEANING_IMPACTS) {
    if (rule.match.test(label)) return rule.impact;
  }
  return 'light';
}

export function impactDotClass(impact: ImpactLevel): string {
  switch (impact) {
    case 'light':
      return 'bg-emerald-400';
    case 'medium':
      return 'bg-amber-400';
    case 'heavy':
      return 'bg-rose-500';
    case 'detail':
      return 'bg-sky-400';
    case 'organising':
      return 'bg-violet-400';
    default:
      return 'bg-slate-400';
  }
}

// Micro-presets used to quickly select groups of tasks
export const CLEANING_MICRO_PRESETS: MicroPreset[] = [
  {
    id: 'bathroom_reset',
    label: 'Bathroom reset',
    description: 'Tiles, toilet, mirrors, fixtures refreshed',
    matchers: [/bathroom/i, /tile/i, /grout/i, /toilet/i, /shower/i, /vanity/i, /fixtures/i],
  },
  {
    id: 'kitchen_detail',
    label: 'Kitchen detail',
    description: 'Benches, sink, appliances & oven/microwave',
    matchers: [/kitchen/i, /stove|oven|rangehood|hood/i, /microwave/i, /backsplash/i, /sink/i, /appliance/i],
  },
  {
    id: 'floors_polish',
    label: 'Floors polish',
    description: 'Deep vacuum & mop including edges',
    matchers: [/vacuum/i, /mop/i, /floors?/i, /edges?/i],
  },
  {
    id: 'dusting_pass',
    label: 'Dusting pass',
    description: 'Surfaces, skirtings, frames, fans & lights',
    matchers: [/dust/i, /skirting|baseboards?/i, /door frames?/i, /ceiling fans?/i, /light fixtures?/i],
  },
  {
    id: 'linen_refresh',
    label: 'Linen refresh',
    description: 'Beds made and linen changed (if provided)',
    matchers: [/make beds?/i, /linens?/i],
  },
];

export function itemsForPreset(all: string[], preset: MicroPreset): string[] {
  return all.filter((label) => preset.matchers.some((rx) => rx.test(label)));
}

/* =========================
   TASKS
   ========================= */
export const TASKS: Task[] = [
  // ===== WINDOWS =====
  // Time per pane/track/screen is only used to compare against labour-floor.
  // Actual per-pane dollar pricing still comes from WINDOW_PRICES.
  {
    code: 'window.full',
    service: 'windows',
    name: 'Inside & outside pane',
    unit: 'pane',
    minutes: 5,
  },
  {
    code: 'window.pane_int_solo',
    service: 'windows',
    name: 'Interior-only pane',
    unit: 'pane',
    minutes: 3,
  },
  {
    code: 'window.pane_ext_solo',
    service: 'windows',
    name: 'Exterior-only pane',
    unit: 'pane',
    minutes: 4,
  },
  {
    code: 'window.track',
    service: 'windows',
    name: 'Window track',
    unit: 'track',
    minutes: 3,
  },
  {
    code: 'window.screen',
    service: 'windows',
    name: 'Flyscreen',
    unit: 'screen',
    minutes: 2,
  },

  // ===== CLEANING =====
  { code: 'clean.ss.weekly', service: 'cleaning', name: 'Weekly / maintenance', unit: 'min', minutes: 1 },
  { code: 'clean.ss.general', service: 'cleaning', name: 'Standard / general clean', unit: 'min', minutes: 1 },
  { code: 'clean.ss.inspection', service: 'cleaning', name: 'Inspection / tidy-up', unit: 'min', minutes: 1 },
  { code: 'clean.ss.deep', service: 'cleaning', name: 'Deep / spring clean', unit: 'min', minutes: 1 },
  { code: 'clean.ss.endoflease', service: 'cleaning', name: 'Move-in / bond clean', unit: 'min', minutes: 1 },
  { code: 'clean.ss.office', service: 'cleaning', name: 'Office / workspace', unit: 'min', minutes: 1 },
  { code: 'clean.ss.medical', service: 'cleaning', name: 'Clinic / medical', unit: 'min', minutes: 1 },
  { code: 'clean.ss.fitness', service: 'cleaning', name: 'Gym / fitness', unit: 'min', minutes: 1 },
  { code: 'clean.ss.hospitality', service: 'cleaning', name: 'Hospitality / venue', unit: 'min', minutes: 1 },
  { code: 'clean.ss.education', service: 'cleaning', name: 'Education', unit: 'min', minutes: 1 },
  { code: 'clean.ss.event', service: 'cleaning', name: 'Event / function', unit: 'min', minutes: 1 },
  { code: 'clean.hourly', service: 'cleaning', name: 'Directed cleaning hour', unit: 'hr', minutes: 60 },

  // ===== YARD CARE =====
  { code: 'lawn.mow', service: 'yard', name: 'Lawn mow / edging block (~50–75 m²)', unit: 'block', minutes: 35, p10: 130, median: 145, p90: 180 },
  { code: 'lawn.edge', service: 'yard', name: 'Edging (per 5 m)', unit: '5m', minutes: 10, p10: 30, median: 40, p90: 60 },
  { code: 'hedge.trim', service: 'yard', name: 'Hedge shaping & trim time block', unit: 'effort block', minutes: 18, p10: 140, median: 150, p90: 190 },
  { code: 'garden.blow', service: 'yard', name: 'Garden reset / wash effort block', unit: 'zone', minutes: 18, p10: 110, median: 125, p90: 160 },
  { code: 'gutter_clean', service: 'yard', name: 'Gutter clean access & safety block', unit: 'access block', minutes: 20, p10: 150, median: 165, p90: 210 },

  // ===== RUBBISH & BIN CARE =====
  { code: 'dump.pack', service: 'dump', name: 'Packed load (ute / small trailer)', unit: 'load', minutes: 30, p10: 120, median: 135, p90: 180 },
  { code: 'dump.drive', service: 'dump', name: 'Extra pickup stop', unit: 'stop', minutes: 20, p10: 40, median: 55, p90: 90 },
  { code: 'dump.load', service: 'dump', name: 'Bulky item', unit: 'item', minutes: 8, p10: 15, median: 25, p90: 45 },
  { code: 'dump.sweep', service: 'dump', name: 'Sweep & tidy area', unit: 'area', minutes: 10, p10: 25, median: 35, p90: 55 },
  { code: 'dump.bin', service: 'dump', name: 'Wheelie bin clean', unit: 'bin', minutes: 8 },

  // ===== CAR DETAILING =====
  { code: 'auto.wash', service: 'auto', name: 'Express Detail', unit: 'vehicle', minutes: 120, p10: 160, median: 160, p90: 160 },
  { code: 'auto.interior', service: 'auto', name: 'Interior Reset Detail', unit: 'vehicle', minutes: 120, p10: 170, median: 170, p90: 170 },
  { code: 'auto.full', service: 'auto', name: 'Signature Full Detail', unit: 'vehicle', minutes: 240, p10: 290, median: 290, p90: 290 },

  // ===== LAUNDRY & SNEAKER CARE =====
  { code: 'laundry.fold', service: 'laundry_sneakers', name: 'Wash & Fold (per load)', unit: 'load', minutes: 0 },
  { code: 'sneaker.basic', service: 'laundry_sneakers', name: 'Refresh Clean (per pair)', unit: 'pair', minutes: 0 },
  { code: 'sneaker.full', service: 'laundry_sneakers', name: 'Deep Restore (per pair)', unit: 'pair', minutes: 0 },
];

export const TASK_MAP = new Map(TASKS.map((t) => [t.code, t]));

/* =========================
   SCOPES BY SERVICE
   ========================= */
export const SCOPES_BY_SERVICE: Record<ServiceType, ScopeDef[]> = {
  windows: [
    { key: 'windows_full', label: 'Full window clean', inclusions: ['Inside & outside panes', 'Tracks', 'Screens'], desc: 'Complete inside and outside window cleaning.' },
    { key: 'windows_interior', label: 'Interior only', inclusions: ['Interior panes', 'Frames & sills'], desc: 'Interior panes, frames and sills only.' },
    { key: 'windows_exterior', label: 'Exterior only', inclusions: ['Exterior panes', 'Screens'], desc: 'Exterior panes and screens only.' },
    { key: 'windows_tracks', label: 'Tracks only', inclusions: ['Tracks vacuum & wipe'], desc: 'Track cleaning and light detail.' },
  ],
  cleaning: CLEAN_SCOPES,
  yard: [
    {
      key: 'yard_mow', label: 'Lawn mow',
      inclusions: ['Lawn mowed to an even height', 'Edges trimmed for a clean finish', 'Clippings collected or mulched', 'Hard surfaces blown clean'],
      desc: 'Mow and tidy grass areas.',
    },
    {
      key: 'yard_hedge', label: 'Hedge trim',
      inclusions: ['Hedges trimmed and shaped', 'Height/length checked for safe access', 'Cuttings collected with time to tidy', 'Garden areas left tidy'],
      desc: 'Priced on hedge length, height, and trimming effort — longer or taller hedges simply need more shaping time, access, and cleanup.',
    },
    {
      key: 'yard_leaves', label: 'Garden Services',
      inclusions: ['Lawn edges trimmed', 'Weeds removed based on density', 'Plants & shrubs lightly pruned', 'Leaves and green waste collected, paths blown clean'],
      desc: 'Priced on time and effort to restore the area — heavily overgrown or dense weeds take longer, and pricing adjusts to match the effort.',
    },
    {
      key: 'blast_and_shine', label: 'Pressure wash',
      inclusions: ['Surface assessed for material and runoff', 'Built-up dirt, mould, and grime removed', 'Paths, driveways, or patios washed', 'Setup and rinse-down time included'],
      desc: 'Priced based on surface type, condition, and cleaning time — stubborn grime and larger areas take longer, with setup and rinse included.',
    },
    {
      key: 'gutter_clean', label: 'Gutter clean',
      inclusions: ['Gutters cleared of leaves and debris', 'Downpipes checked for blockages', 'Ladder moves and debris handling included', 'Flow visually checked'],
      desc: 'Priced on roof size, height, and access — larger or multi-storey homes take more time, covering ladder moves, debris volume, and safety.',
    },
  ],
  dump: [
    { key: 'dump_runs', label: 'Dump runs', inclusions: ['Pickup & dispose', 'Load assistance'], desc: 'Pickup runs to disposal facility.' },
    { key: 'bin_cleans', label: 'Bin cleans', inclusions: ['Wash & deodorise bins'], desc: 'Bin cleaning and deodorising.' },
    { key: 'dump_delivery', label: 'Delivery services', inclusions: ['Pickup items', 'Deliver to location', 'Load/unload help'], desc: 'Small deliveries or drop-offs with load assistance.' },
    { key: 'dump_transport', label: 'Transport / move assistance', inclusions: ['Move goods between sites', 'Load / unload help', 'Protect items in transit'], desc: 'Helping transport or move items from A to B.' },
  ],
  auto: [
    {
      key: 'auto_express', label: 'Express Detail',
      inclusions: ['Exterior hand wash', 'Tyre shine', 'Quick spray wax', 'Vacuum seats, mats & boot', 'Interior plastics wiped', 'Windows inside/out', 'Door jambs cleaned'],
      desc: 'Quick polish, vacuum, and windows with stain spot removal included.',
    },
    {
      key: 'auto_interior', label: 'Interior Reset Detail',
      inclusions: ['Full interior vacuum (mats + seats + boot)', 'Interior plastics deep clean', 'Dashboard rejuvenation', 'Stain spot removal (1–3 areas)', 'Carpet & fabric deodorising', 'Door jambs cleaned', 'Windows inside', 'Light pet hair removal (included)'],
      desc: 'Deep interior reset with deodorise and light pet hair included.',
    },
    {
      key: 'auto_full', label: 'Signature Full Detail',
      inclusions: ['Full exterior wash', 'Clay bar (quick clay)', 'Hand polish', 'Tyre shine', 'Spray sealant / wax', 'Complete vacuum', 'Interior plastics deep clean', 'Stain removal (multiple areas)', 'Interior deodorising', 'Windows inside/out', 'Door jambs', 'Light pet hair removal'],
      desc: 'Full inside/out transformation with clay bar and hand polish.',
    },
  ],
  laundry_sneakers: [
    {
      key: 'laundry',
      label: 'Laundry',
      inclusions: ['Wash, dry & fold', 'Ironing available as add-on', 'Pickup & delivery included', 'Eco, brightening & express options'],
      desc: 'Fresh laundry returned clean and ready to wear. Add-ons available at checkout.',
    },
    {
      key: 'sneaker_care',
      label: 'Sneaker Care',
      inclusions: ['Refresh Clean ($40)', 'Deep Restore ($60)', 'Multi-Pair (from $40)'],
      desc: 'Professional sneaker cleaning with turnaround options.',
    },
  ],
};

export const YARD_SCOPE_MEASUREMENTS: Record<ScopeKey, YardMeasurementConfig> = {
  yard_mow: { mode: 'area', field: 'lawn_m2', label: 'Area' },
  yard_hedge: { mode: 'perimeter', field: 'hedge_m', label: 'Perimeter' },
  yard_leaves: { mode: 'area', field: 'leaves_area', label: 'Area' },
  blast_and_shine: { mode: 'area', field: 'blast_m2', label: 'Area' },
  gutter_clean: { mode: 'perimeter', field: 'gutter_m', label: 'Perimeter' },
};

export const DEFAULT_YARD_MEASUREMENT: YardMeasurementConfig = {
  mode: 'area',
  field: 'lawn_m2',
  label: 'Area',
};

export const YARD_MEASUREMENT_UNITS: Record<YardMeasurementMode, string> = {
  area: 'm²',
  perimeter: 'm',
};

export const getYardMeasurementConfig = (scope: ScopeKey): YardMeasurementConfig =>
  YARD_SCOPE_MEASUREMENTS[scope] ?? DEFAULT_YARD_MEASUREMENT;

/* =========================
   PARAM CONTROLS
   ========================= */
export const PARAMS_FULL: ParamTable = {
  cleaning: [
    { key: 'bedrooms', label: 'Bedrooms', min: 1, max: 8, defaultValue: 1 },
    { key: 'bathrooms', label: 'Bathrooms', min: 1, max: 6, defaultValue: 1 },
    { key: 'kitchens', label: 'Kitchens', min: 1, max: 2, defaultValue: 1 },
    { key: 'living', label: 'Living rooms', min: 0, max: 4, defaultValue: 1 },
    { key: 'laundry', label: 'Laundry rooms', min: 0, max: 2, defaultValue: 0 },
    { key: 'storeys', label: 'Storeys (max 5+)', min: 1, max: 5, defaultValue: 1 },
    { key: 'hours', label: 'Hours (directed)', min: 3, max: 24, step: 1, defaultValue: 3 },
  ],
  windows: [
    { key: 'panes_int', label: 'Interior panes', min: 0, max: 120, step: 1, defaultValue: 12 },
    { key: 'panes_ext', label: 'Exterior panes', min: 0, max: 120, step: 1, defaultValue: 12 },
    { key: 'tracks', label: 'Tracks (qty)', min: 0, max: 120, step: 1, defaultValue: 12 },
    { key: 'screens', label: 'Screens (qty)', min: 0, max: 120, step: 1, defaultValue: 12 },
    { key: 'storeys', label: 'Storeys (max 5+)', min: 1, max: 5, step: 1, defaultValue: 1 },
  ],
  yard: [
    { key: 'lawn_m2', label: 'Lawn area', min: 0, max: 1500, step: 50, defaultValue: 250, suffix: 'm²' },
    { key: 'hedge_m', label: 'Hedge length & height (estimate)', min: 0, max: 200, step: 5, defaultValue: 20 },
    { key: 'leaves_area', label: 'Garden reset size (estimate)', min: 0, max: 2000, step: 25, defaultValue: 150 },
    { key: 'blast_m2', label: 'Pressure-wash surfaces (estimate)', min: 0, max: 500, step: 10, defaultValue: 80 },
    { key: 'gutter_m', label: 'Roof size & access (estimate)', min: 0, max: 400, step: 10, defaultValue: 120 },
  ],
  dump: [
    { key: 'items', label: 'Items / bulky pieces', min: 0, max: 40, defaultValue: 0 },
    { key: 'stops', label: 'Pickup stops', min: 0, max: 3, defaultValue: 0 },
    { key: 'redBins', label: 'General waste bins (red)', min: 0, max: 10, defaultValue: 0 },
    { key: 'redBinFreq', label: 'Red bin frequency', min: 0, max: 2, defaultValue: 0 },
    { key: 'yellowBins', label: 'Recycling bins (yellow)', min: 0, max: 10, defaultValue: 0 },
    { key: 'yellowBinFreq', label: 'Yellow bin frequency', min: 0, max: 1, defaultValue: 0 },
    { key: 'greenBins', label: 'Green waste bins', min: 0, max: 10, defaultValue: 0 },
    { key: 'greenBinFreq', label: 'Green bin frequency', min: 0, max: 1, defaultValue: 0 },
    { key: 'kitchenBins', label: 'Kitchen bins / caddies', min: 0, max: 5, defaultValue: 0 },
    { key: 'binPlan', label: 'Subscription plan', min: 0, max: 2, defaultValue: 0 },
  ],
  auto: [
    { key: 'vehicle_size', label: 'Car size', min: 0, max: 5, defaultValue: 0 },
    { key: 'rows', label: 'Seats / rows', min: 0, max: 3, defaultValue: 0 },
    { key: 'child_seats', label: 'Child seats', min: 0, max: 3, defaultValue: 0 },
  ],
  laundry_sneakers: [],
};

// Per-niche ParamDef sets for commercial cleaning
export const COMM_PARAM_DEFS: Record<CommercialCleaningType, CommParamDef[]> = {
  office: [
    { key: 'sqm', label: 'Area (sqm) – Office Space', min: 0, max: 10000, step: 50, defaultValue: 600, suffix: 'sqm' },
    { key: 'workstations', label: 'Workstations – Desks', min: 0, max: 500, step: 5, defaultValue: 20 },
    { key: 'restrooms', label: 'Restrooms – Toilet Blocks', min: 0, max: 50, step: 1, defaultValue: 2 },
    { key: 'break_rooms', label: 'Break Rooms – Tea Rooms', min: 0, max: 20, step: 1, defaultValue: 1 },
    { key: 'floors', label: 'Floors – Levels', min: 1, max: 10, step: 1, defaultValue: 1 },
    { key: 'high_traffic', label: 'High-Touch – Handles/Phones', min: 0, max: 50, step: 1, defaultValue: 3 },
  ],
  medical: [
    { key: 'sqm', label: 'Area (sqm) – Clinic Space', min: 0, max: 10000, step: 50, defaultValue: 350, suffix: 'sqm' },
    { key: 'workstations', label: 'Consult Rooms – Treatment', min: 0, max: 100, step: 1, defaultValue: 6 },
    { key: 'restrooms', label: 'Restrooms – Patient Toilets', min: 0, max: 50, step: 1, defaultValue: 2 },
    { key: 'break_rooms', label: 'Waiting Area – Seats', min: 0, max: 500, step: 5, defaultValue: 10 },
    { key: 'floors', label: 'Floors – Levels', min: 1, max: 10, step: 1, defaultValue: 1 },
    { key: 'high_traffic', label: 'High-Touch – Medical Handles', min: 0, max: 50, step: 1, defaultValue: 5 },
  ],
  fitness: [
    { key: 'sqm', label: 'Area (sqm) – Gym Floor', min: 0, max: 15000, step: 50, defaultValue: 450, suffix: 'sqm' },
    { key: 'workstations', label: 'Machines – Equipment', min: 0, max: 500, step: 5, defaultValue: 20 },
    { key: 'restrooms', label: 'Locker Rooms – Change', min: 0, max: 50, step: 1, defaultValue: 2 },
    { key: 'break_rooms', label: 'Showers – Shower Blocks', min: 0, max: 50, step: 1, defaultValue: 3 },
    { key: 'floors', label: 'Mats – Floor Mats (zones)', min: 0, max: 1000, step: 50, defaultValue: 100 },
    { key: 'high_traffic', label: 'High-Touch – Handles/Mirrors', min: 0, max: 50, step: 1, defaultValue: 6 },
  ],
  hospitality: [
    { key: 'sqm', label: 'Area (sqm) – Dining/Bar', min: 0, max: 10000, step: 50, defaultValue: 550, suffix: 'sqm' },
    { key: 'workstations', label: 'Tables – Dining Tables', min: 0, max: 500, step: 5, defaultValue: 15 },
    { key: 'restrooms', label: 'Restrooms – Customer', min: 0, max: 50, step: 1, defaultValue: 2 },
    { key: 'break_rooms', label: 'Kitchen – Prep Areas', min: 0, max: 10, step: 1, defaultValue: 1 },
    { key: 'floors', label: 'Bar Area – Serving Stations', min: 0, max: 10, step: 1, defaultValue: 1 },
    { key: 'high_traffic', label: 'High-Touch – Door Handles', min: 0, max: 50, step: 1, defaultValue: 4 },
  ],
  education: [
    { key: 'sqm', label: 'Area (sqm) – Classroom Space', min: 0, max: 15000, step: 50, defaultValue: 550, suffix: 'sqm' },
    { key: 'workstations', label: 'Classrooms – Learning Rooms', min: 0, max: 100, step: 1, defaultValue: 4 },
    { key: 'restrooms', label: 'Restrooms – Child Toilets', min: 0, max: 50, step: 1, defaultValue: 3 },
    { key: 'break_rooms', label: 'Play Areas – Activity Zones', min: 0, max: 50, step: 1, defaultValue: 2 },
    { key: 'floors', label: 'Kitchen – Staff Room', min: 0, max: 10, step: 1, defaultValue: 1 },
    { key: 'high_traffic', label: 'High-Touch – Toy Handles', min: 0, max: 50, step: 1, defaultValue: 5 },
  ],
  event: [
    { key: 'sqm', label: 'Area (sqm) – Venue Space', min: 0, max: 20000, step: 50, defaultValue: 700, suffix: 'sqm' },
    { key: 'workstations', label: 'Tables – Dining Tables', min: 0, max: 1000, step: 5, defaultValue: 20 },
    { key: 'restrooms', label: 'Restrooms – Event Toilets', min: 0, max: 100, step: 1, defaultValue: 4 },
    { key: 'break_rooms', label: 'Chairs – Seating', min: 0, max: 5000, step: 10, defaultValue: 50 },
    { key: 'floors', label: 'Stage Area – Performance Zone', min: 0, max: 10, step: 1, defaultValue: 1 },
    { key: 'high_traffic', label: 'High-Touch – Door/Bar Handles', min: 0, max: 50, step: 1, defaultValue: 6 },
  ],
  accommodation: [
    { key: 'sqm', label: 'Area (sqm) – Rooms & common', min: 0, max: 20000, step: 50, defaultValue: 700, suffix: 'sqm' },
    { key: 'workstations', label: 'Rooms/Units', min: 0, max: 500, step: 5, defaultValue: 40 },
    { key: 'restrooms', label: 'Restrooms/Blocks', min: 0, max: 50, step: 1, defaultValue: 6 },
    { key: 'break_rooms', label: 'Kitchens/Tea Rooms', min: 0, max: 20, step: 1, defaultValue: 3 },
    { key: 'floors', label: 'Floors – Levels', min: 1, max: 20, step: 1, defaultValue: 4 },
    { key: 'high_traffic', label: 'High-Touch – Lifts/Handrails', min: 0, max: 50, step: 1, defaultValue: 8 },
  ],
};

// Descriptive labels for commercial cleaning niches (used by Step 2 cards)
export const COMM_LABELS: Record<CommercialCleaningType, CommMeta> = {
  office: { title: 'Office & Corporate', covers: 'Offices · Co-Working · Banks · Call Centres', avg: '$120 / 2h · $60/hr', reason: '80% of market – weekly repeat' },
  medical: { title: 'Medical & Hygiene', covers: 'Clinics · Dentists · Physios · Vets', avg: '$140 / 2h · $70/hr', reason: 'Higher rate, compliance-driven' },
  fitness: { title: 'Fitness & Leisure', covers: 'Gyms · Yoga · Pools · Sports Clubs', avg: '$140 / 2h · $70/hr', reason: 'Equipment & mats attention' },
  hospitality: { title: 'Hospitality', covers: 'Cafés · Restaurants · Bars · Venues', avg: '$140 / 2h · $70/hr', reason: 'Grease & spill intensive' },
  education: { title: 'Education & Care', covers: 'Schools · Childcare · Tutoring · OSHC', avg: '$140 / 2h · $70/hr', reason: 'Child-safe, high-touch focus' },
  event: { title: 'Event & Venue', covers: 'Conferences · Stadiums · Halls', avg: '$120 / 2h · $60/hr', reason: 'Pre/post-event turnaround' },
  accommodation: { title: 'Accommodation', covers: 'Hotels · Airbnb · Strata · Serviced Apartments', avg: '$120 / 2h · $60/hr', reason: 'Room turnover + common areas' },
};

/* =========================
   WINDOWS HELPERS
   ========================= */
export const HOUSE_SNAPS: { name: string; rows: StoreyRow[] }[] = [
  { name: 'Unit (1)', rows: [{ int: 12, ext: 12, tracks: 12, screens: 12, label: 'Level' }] },
  { name: 'Small home', rows: [{ int: 10, ext: 10, tracks: 10, screens: 10, label: 'Level' }] },
  { name: 'Large home', rows: [{ int: 16, ext: 16, tracks: 16, screens: 16, label: 'Level' }] },
];
