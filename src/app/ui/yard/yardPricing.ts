export type LatLng = { lat: number; lng: number };

export type PolygonQuote = {
  polygon: LatLng[];
  rawArea: number; // m²
  estimatedLow: number; // $
  estimatedHigh: number; // $
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
};

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

// Residential yard pricing (per brief)
const RES_BASE_RATE = 2; // per m² (garden/reset default)
const RES_MIN_CHARGE = 120;
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

function priceFromAreaResidential(area: number, opts?: YardPricingOptions): number {
  const m2 = Math.max(0, area);
  const condition = opts?.condition ?? 'maintained';
  const terrain = opts?.terrain ?? 'flat';
  const conditionMult = RES_CONDITION[condition] ?? 1;
  const terrainMult = RES_TERRAIN[terrain] ?? 1;
  const profile = opts?.serviceProfile ?? 'garden';
  const baseRate = profile === 'lawn' ? 1 : RES_BASE_RATE;
  const minCharge = profile === 'lawn' ? 80 : RES_MIN_CHARGE;
  const price = m2 * baseRate * conditionMult * terrainMult;
  return Math.max(minCharge, Math.round(price));
}

function priceFromAreaCommercial(area: number, kind?: YardCommercialKind): number {
  const commercialRate: Record<YardCommercialKind, number> = {
    office: 2.4,
    event: 2.4,
    accommodation: 2.4,
    medical: 2.8,
    fitness: 2.6,
    hospitality: 2.8,
    education: 2.6,
  };
  const rate = kind ? commercialRate[kind] ?? 2.4 : 2.4;
  const price = Math.max(0, area) * rate;
  return Math.round(price);
}

export function priceFromArea(area: number, opts?: YardPricingOptions): number {
  const propertyType = opts?.propertyType ?? 'residential';
  if (propertyType === 'commercial') {
    return priceFromAreaCommercial(area, opts?.commercialKind);
  }
  return priceFromAreaResidential(area, opts);
}

export function estimateRange(area: number, opts?: YardPricingOptions): { low: number; high: number } {
  const price = priceFromArea(area, opts);
  return {
    low: price,
    high: price,
  };
}

export function polygonToArray(polygon: google.maps.Polygon): LatLng[] {
  const arr: LatLng[] = [];
  polygon.getPath().forEach((p) => arr.push({ lat: p.lat(), lng: p.lng() }));
  return arr;
}

export function arrayToPolygon(
  map: google.maps.Map,
  coords: LatLng[],
  opts: google.maps.PolygonOptions = {}
): google.maps.Polygon {
  return new google.maps.Polygon({
    paths: coords,
    editable: true,
    draggable: false,
    strokeColor: '#0f5132',
    strokeWeight: 2,
    fillColor: '#16a34a',
    fillOpacity: 0.25,
    ...opts,
    map,
  });
}

export type DifficultyFlags = {
  overgrown?: boolean;
  steepSlope?: boolean;
  tightAccess?: boolean;
  urgent?: boolean;
};

export type PricingResult = {
  size: number;
  rate: number;
  basePrice: number;
  minimumApplied: boolean;
  difficultyMultiplier: number;
  finalPrice: number;
};

const DIFFICULTY_MULTIPLIERS: Record<keyof DifficultyFlags, number> = {
  overgrown: 1.3,
  steepSlope: 1.25,
  tightAccess: 1.15,
  urgent: 1.2,
};

const applyDifficultyMultiplier = (flags?: DifficultyFlags) => {
  if (!flags) return 1;
  return (Object.keys(flags) as (keyof DifficultyFlags)[]).reduce((mult, flag) => {
    if (flags[flag]) {
      return mult * (DIFFICULTY_MULTIPLIERS[flag] ?? 1);
    }
    return mult;
  }, 1);
};

const pickRate = (size: number, tiers: { limit?: number; rate: number }[]): number => {
  for (const tier of tiers) {
    if (tier.limit == null || size <= tier.limit) {
      return tier.rate;
    }
  }
  return tiers[tiers.length - 1].rate;
};

const buildPricingResult = (
  size: number,
  tiers: { limit?: number; rate: number }[],
  minimum: number,
  flags?: DifficultyFlags
): PricingResult => {
  const rate = pickRate(size, tiers);
  const basePrice = size * rate;
  const minimumApplied = basePrice < minimum;
  const priceBeforeMultiplier = minimumApplied ? minimum : basePrice;
  const difficultyMultiplier = applyDifficultyMultiplier(flags);
  const finalPrice = Math.round(priceBeforeMultiplier * difficultyMultiplier);

  return {
    size,
    rate,
    basePrice,
    minimumApplied,
    difficultyMultiplier,
    finalPrice,
  };
};

export function priceLawn(areaM2: number, flags?: DifficultyFlags): PricingResult {
  return buildPricingResult(
    areaM2,
    [
      { limit: 300, rate: 0.14 },
      { limit: 800, rate: 0.1 },
      { limit: 2000, rate: 0.07 },
      { rate: 0.05 },
    ],
    60,
    flags
  );
}

export function priceGarden(areaM2: number, flags?: DifficultyFlags): PricingResult {
  return buildPricingResult(
    areaM2,
    [
      { limit: 300, rate: 0.22 },
      { limit: 800, rate: 0.18 },
      { rate: 0.14 },
    ],
    90,
    flags
  );
}

export function pricePressure(areaM2: number, flags?: DifficultyFlags): PricingResult {
  return buildPricingResult(
    areaM2,
    [
      { limit: 100, rate: 0.35 },
      { limit: 250, rate: 0.28 },
      { rate: 0.22 },
    ],
    120,
    flags
  );
}

export function priceHedges(perimeterM: number, flags?: DifficultyFlags): PricingResult {
  return buildPricingResult(
    perimeterM,
    [
      { limit: 40, rate: 4.5 },
      { limit: 120, rate: 3.6 },
      { rate: 3 },
    ],
    150,
    flags
  );
}

export function priceGutters(perimeterM: number, flags?: DifficultyFlags): PricingResult {
  return buildPricingResult(
    perimeterM,
    [
      { limit: 40, rate: 4 },
      { limit: 120, rate: 3.2 },
      { rate: 2.6 },
    ],
    140,
    flags
  );
}
