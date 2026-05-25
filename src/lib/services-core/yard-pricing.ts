export type LatLng = { lat: number; lng: number };

export type PolygonQuote = {
  polygon: LatLng[];
  rawArea: number;
  estimatedLow: number;
  estimatedHigh: number;
};

export type SavedQuote = {
  address: string;
  customerId: string;
  polygon: LatLng[];
  rawArea: number;
  estimatedLow: number;
  estimatedHigh: number;
};

export type YardPropertyType = 'residential' | 'commercial';
export type YardCommercialKind =
  | 'office'
  | 'event'
  | 'accommodation'
  | 'medical'
  | 'fitness'
  | 'hospitality'
  | 'education';
export type YardCondition = 'maintained' | 'overgrown' | 'heavy_neglected';
export type YardTerrain = 'flat' | 'sloped' | 'steep_obstacles';

export type YardPricingOptions = {
  propertyType?: YardPropertyType;
  commercialKind?: YardCommercialKind;
  condition?: YardCondition;
  terrain?: YardTerrain;
  serviceProfile?: 'lawn' | 'garden' | 'generic';
  scope?:
    | 'yard_mow'
    | 'yard_leaves'
    | 'blast_and_shine'
    | 'yard_hedge'
    | 'gutter_clean';
  flags?: {
    overgrown?: boolean;
    steepSlope?: boolean;
    tightAccess?: boolean;
    urgent?: boolean;
    twoStorey?: boolean;
  };
};

export type DifficultyFlags = {
  overgrown?: boolean;
  steepSlope?: boolean;
  tightAccess?: boolean;
  urgent?: boolean;
  twoStorey?: boolean;
};

export type PricingResult = {
  size: number;
  rate: number;
  basePrice: number;
  minimumApplied: boolean;
  difficultyMultiplier: number;
  finalPrice: number;
};

export type YardScope =
  | 'yard_mow'
  | 'yard_leaves'
  | 'blast_and_shine'
  | 'yard_hedge'
  | 'gutter_clean';

const EARTH_RADIUS_METERS = 6378137;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const projectToMercator = ({ lat, lng }: LatLng) => {
  const x = EARTH_RADIUS_METERS * toRadians(lng);
  const y = EARTH_RADIUS_METERS * Math.log(Math.tan(Math.PI / 4 + toRadians(lat) / 2));
  return { x, y };
};

const haversineDistance = (a: LatLng, b: LatLng) => {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aHarv = sinLat * sinLat + sinLng * sinLng * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv));
  return EARTH_RADIUS_METERS * c;
};

export function computeAreaFromPath(path: LatLng[]): number {
  if (!path || path.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < path.length; i += 1) {
    const current = projectToMercator(path[i]);
    const next = projectToMercator(path[(i + 1) % path.length]);
    area += current.x * next.y - next.x * current.y;
  }
  return Math.max(0, Math.round(Math.abs(area / 2)));
}

export function computePerimeterFromPath(path: LatLng[]): number {
  if (!path || path.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < path.length; i += 1) {
    const current = path[i];
    const next = path[(i + 1) % path.length];
    perimeter += haversineDistance(current, next);
  }
  return Math.max(0, Math.round(perimeter));
}

/** Minimum chargeable yard job — matches "Yard Care from $79" site copy. */
export const YARD_CALLOUT_FLOOR = 79;

type Tier = { limit?: number; rate: number };

// Lawn mowing — calibrated to ~$100 @ 500 m², ~$160 @ 1000 m², ~$260 @ 2000 m².
const LAWN_TIERS: Tier[] = [
  { limit: 200, rate: 0.3 },
  { limit: 800, rate: 0.14 },
  { limit: 2000, rate: 0.1 },
  { rate: 0.08 },
];

// Garden tidy — calibrated to ~$170 @ 200 m², ~$310 @ 400 m², ~$610 @ 1000 m².
const GARDEN_TIERS: Tier[] = [
  { limit: 100, rate: 1.0 },
  { limit: 400, rate: 0.7 },
  { limit: 1000, rate: 0.5 },
  { rate: 0.28 },
];

// Pressure washing — calibrated to ~$205 @ 40 m², ~$445 @ 100 m², ~$945 @ 300 m².
const PRESSURE_TIERS: Tier[] = [
  { limit: 30, rate: 5.5 },
  { limit: 100, rate: 4.0 },
  { limit: 300, rate: 2.5 },
  { rate: 2.2 },
];

// Hedge trim — metres of perimeter. ~$135 @ 15 m, ~$380 @ 50 m, ~$780 @ 150 m.
const HEDGE_TIERS: Tier[] = [
  { limit: 15, rate: 9.0 },
  { limit: 50, rate: 7.0 },
  { limit: 150, rate: 4.0 },
  { rate: 2.5 },
];

// Gutter clean — metres of perimeter. ~$160 @ 20 m, ~$360 @ 60 m, ~$630 @ 150 m.
const GUTTER_TIERS: Tier[] = [
  { limit: 20, rate: 8.0 },
  { limit: 60, rate: 5.0 },
  { limit: 150, rate: 3.0 },
  { rate: 2.5 },
];

const RES_CONDITION: Record<YardCondition, number> = {
  maintained: 1,
  overgrown: 1.25,
  heavy_neglected: 1.4,
};
const RES_TERRAIN: Record<YardTerrain, number> = {
  flat: 1,
  sloped: 1.15,
  steep_obstacles: 1.3,
};

const COMMERCIAL_MULT: Record<YardCommercialKind, number> = {
  office: 1.15,
  event: 1.2,
  accommodation: 1.15,
  medical: 1.35,
  fitness: 1.25,
  hospitality: 1.3,
  education: 1.25,
};

const DIFFICULTY_MULTIPLIERS: Record<keyof DifficultyFlags, number> = {
  overgrown: 1.3,
  steepSlope: 1.25,
  tightAccess: 1.15,
  urgent: 1.2,
  twoStorey: 1.6,
};

/** Maps engine.ts scope keys to their measurement mode + pricing function. */
export const YARD_MEASUREMENT_MODE: Record<YardScope, 'area' | 'perimeter'> = {
  yard_mow: 'area',
  yard_leaves: 'area',
  blast_and_shine: 'area',
  yard_hedge: 'perimeter',
  gutter_clean: 'perimeter',
};

const pickTierRate = (size: number, tiers: Tier[]): number => {
  for (const tier of tiers) {
    if (tier.limit == null || size <= tier.limit) return tier.rate;
  }
  return tiers[tiers.length - 1].rate;
};

function priceFromTiers(size: number, tiers: Tier[]): number {
  const safeSize = Math.max(0, size);
  let total = 0;
  let covered = 0;
  for (const tier of tiers) {
    const cap = tier.limit ?? Infinity;
    const segment = Math.min(safeSize, cap) - covered;
    if (segment <= 0) break;
    total += segment * tier.rate;
    covered = cap;
    if (safeSize <= cap) break;
  }
  return total;
}

function applyResidentialMultipliers(base: number, opts?: YardPricingOptions): number {
  const condition = RES_CONDITION[opts?.condition ?? 'maintained'] ?? 1;
  const terrain = RES_TERRAIN[opts?.terrain ?? 'flat'] ?? 1;
  return base * condition * terrain;
}

function applyPropertyTypeMultiplier(base: number, opts?: YardPricingOptions): number {
  if (opts?.propertyType !== 'commercial') return base;
  const kind = opts.commercialKind ?? 'office';
  return base * (COMMERCIAL_MULT[kind] ?? 1.15);
}

const applyDifficultyMultiplier = (
  flags: DifficultyFlags | undefined,
  allowed: (keyof DifficultyFlags)[],
): number => {
  if (!flags) return 1;
  return allowed.reduce((mult, flag) => {
    if (flags[flag]) return mult * (DIFFICULTY_MULTIPLIERS[flag] ?? 1);
    return mult;
  }, 1);
};

const buildPricingResult = (
  size: number,
  tiers: Tier[],
  flags: DifficultyFlags | undefined,
  allowed: (keyof DifficultyFlags)[],
  opts?: YardPricingOptions,
): PricingResult => {
  const safeSize = Math.max(0, size);
  const rate = pickTierRate(safeSize, tiers);
  const basePrice = priceFromTiers(safeSize, tiers);

  const difficultyMultiplier = applyDifficultyMultiplier(flags, allowed);
  const residentialMultiplier =
    applyResidentialMultipliers(1, opts) * (opts?.propertyType === 'commercial'
      ? (COMMERCIAL_MULT[opts.commercialKind ?? 'office'] ?? 1.15)
      : 1);

  const priceBeforeFloor = basePrice * difficultyMultiplier * residentialMultiplier;
  const minimumApplied = priceBeforeFloor < YARD_CALLOUT_FLOOR;
  const finalPrice = Math.max(YARD_CALLOUT_FLOOR, Math.round(priceBeforeFloor));

  return {
    size: safeSize,
    rate,
    basePrice,
    minimumApplied,
    difficultyMultiplier,
    finalPrice,
  };
};

export function priceLawn(
  areaM2: number,
  flags?: DifficultyFlags,
  opts?: YardPricingOptions,
): PricingResult {
  return buildPricingResult(areaM2, LAWN_TIERS, flags, ['overgrown', 'steepSlope', 'tightAccess', 'urgent'], opts);
}

export function priceGarden(
  areaM2: number,
  flags?: DifficultyFlags,
  opts?: YardPricingOptions,
): PricingResult {
  return buildPricingResult(areaM2, GARDEN_TIERS, flags, ['overgrown', 'steepSlope', 'tightAccess', 'urgent'], opts);
}

export function pricePressure(
  areaM2: number,
  flags?: DifficultyFlags,
  opts?: YardPricingOptions,
): PricingResult {
  return buildPricingResult(areaM2, PRESSURE_TIERS, flags, ['overgrown', 'tightAccess', 'urgent'], opts);
}

export function priceHedges(
  perimeterM: number,
  flags?: DifficultyFlags,
  opts?: YardPricingOptions,
): PricingResult {
  return buildPricingResult(perimeterM, HEDGE_TIERS, flags, ['overgrown', 'tightAccess', 'urgent'], opts);
}

export function priceGutters(
  perimeterM: number,
  flags?: DifficultyFlags,
  opts?: YardPricingOptions,
): PricingResult {
  return buildPricingResult(
    perimeterM,
    GUTTER_TIERS,
    flags,
    ['overgrown', 'tightAccess', 'urgent', 'twoStorey'],
    opts,
  );
}

/**
 * Back-compat entry point — delegates to priceYardJob when `scope` is set,
 * otherwise uses the legacy lawn/garden profile split. Prefer priceYardJob.
 */
export function priceFromArea(area: number, opts?: YardPricingOptions): number {
  if (opts?.scope) {
    return priceYardJob(opts.scope, area, opts.flags, opts).finalPrice;
  }
  const profile = opts?.serviceProfile ?? 'lawn';
  const tiers =
    profile === 'lawn' ? LAWN_TIERS : profile === 'garden' ? GARDEN_TIERS : LAWN_TIERS;
  let price = priceFromTiers(area, tiers);
  price = applyResidentialMultipliers(price, opts);
  price = applyPropertyTypeMultiplier(price, opts);
  return Math.max(YARD_CALLOUT_FLOOR, Math.round(price));
}

export function estimateRange(
  area: number,
  opts?: YardPricingOptions,
): { low: number; high: number } {
  const price = priceFromArea(area, opts);
  return {
    low: Math.max(YARD_CALLOUT_FLOOR, Math.round(price * 0.9)),
    high: Math.max(YARD_CALLOUT_FLOOR, Math.round(price * 1.15)),
  };
}

/**
 * Single source-of-truth for every yard quote in the app.
 * `size` is m² for mow/leaves/blast, metres for hedge/gutter.
 */
export function priceYardJob(
  scope: YardScope,
  size: number,
  flags?: DifficultyFlags,
  opts?: YardPricingOptions,
): PricingResult {
  switch (scope) {
    case 'yard_mow':
      return priceLawn(size, flags, opts);
    case 'yard_leaves':
      return priceGarden(size, flags, opts);
    case 'blast_and_shine':
      return pricePressure(size, flags, opts);
    case 'yard_hedge':
      return priceHedges(size, flags, opts);
    case 'gutter_clean':
      return priceGutters(size, flags, opts);
    default:
      return priceLawn(size, flags, opts);
  }
}
