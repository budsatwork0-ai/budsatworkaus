import type {
  WindowContextPrice,
  SneakerTurnaroundMeta,
  SneakerTurnaround,
  Context,
  ServiceType,
  LaundryPerLoadAddOn,
  LaundryPerOrderAddOn,
  IroningItemType,
} from '../../types';
import { brand } from '@/app/ui/theme';

// Theme and styling - use centralized brand color for consistency
export const ACCENT = brand.primary;
export const glass =
  'bg-white/75 backdrop-blur-2xl border border-black/10 shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

// Google Maps
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export const QLD_BOUNDS = { north: -9.1, south: -29.6, east: 153.8, west: 138.5 };

// Routing constants
export const ROUTE_BASE_FEE = 35;
export const ROUTE_PER_KM_RATE = 2.6;
export const ROUTE_PER_MIN_RATE = 0.45;
export const ROUTE_MIN_PRICE = 55;
export const ROUTE_AVG_SPEED_KMH = 40;
export const ROUTE_SCOPES = ['dump_delivery', 'dump_transport'] as const;

// Window pricing
export const WINDOW_PRICES: Record<'home' | 'commercial', WindowContextPrice> = {
  home: { pane: 8.0, track: 4.0, screen: 4.0 },
  commercial: { pane: 10.0, track: 8.0 }, // no screens for commercial
};

// Price overrides
export const PRICE_OVERRIDE: Record<string, number> = {
  'dump.bin': 20,
  // Laundry pricing (per load ~5kg, pickup & delivery included)
  'laundry.fold': 30,  // Wash & Fold $30/load
  // Sneaker care pricing (turnaround surcharges: Express +$5/pair, Priority +$10/pair)
  'sneaker.basic': 40,  // Refresh Clean $40/pair
  'sneaker.full': 60,   // Deep Restore $60/pair
  'auto.wash': 160,
  'auto.interior': 170,
  'auto.full': 290,
};

// Sneaker multi-pair fixed pricing tiers
export const SNEAKER_MULTI_PRICING: { pairs: number; price: number; popular?: boolean }[] = [
  { pairs: 1,  price: 40 },
  { pairs: 2,  price: 75 },
  { pairs: 3,  price: 95,  popular: true },
  { pairs: 5,  price: 145 },
  { pairs: 10, price: 270 },
];

// Laundry add-on pricing
export const LAUNDRY_PER_LOAD_ADDONS: Record<LaundryPerLoadAddOn, { label: string; price: number }> = {
  eco_detergent:      { label: 'Sensitive / eco detergent', price: 3  },
  extra_rinse:        { label: 'Extra rinse',               price: 4  },
  whites_brightening: { label: 'Whites / brightening',      price: 10 },
};

export const LAUNDRY_PER_ORDER_ADDONS: Record<LaundryPerOrderAddOn, { label: string; price: number }> = {
  hygiene_sanitise:   { label: 'Hygiene / sanitise',    price: 15 },
  express_turnaround: { label: 'Express turnaround',    price: 15 },
};

export const LAUNDRY_IRONING_PRICES: Record<IroningItemType, { label: string; price: number }> = {
  standard:       { label: 'Standard item',  price: 4 },
  business_shirt: { label: 'Business shirt', price: 5 },
  complex:        { label: 'Complex item',   price: 8 },
};

// Auto/Sneaker categories
export const AUTO_SIZE_CATEGORIES = ['hatch', 'sedan', 'suv', 'ute', 'van', '4wd'] as const;

export const SNEAKER_TURNAROUND: { key: SneakerTurnaround; label: string; multiplier: number }[] = [
  { key: 'standard', label: 'Standard', multiplier: 1 },
  { key: 'express', label: 'Express', multiplier: 1 },
  { key: 'priority', label: 'Priority', multiplier: 1 },
];

export const SNEAKER_TURNAROUND_META: SneakerTurnaroundMeta[] = [
  {
    key: 'standard',
    label: 'Standard',
    window: '3–5 business days',
    surcharge: 0,
    queuePriority: 0,
    capacity: Infinity,
  },
  { key: 'express', label: 'Express', window: '1–2 business days', surcharge: 5, queuePriority: 1, capacity: 5 },
  { key: 'priority', label: 'Priority', window: 'Same week', surcharge: 10, queuePriority: 2, capacity: 2 },
];

// Policy constants
export const POLICY = {
  paceFactor: 1.1,
  minBlock: { home: 75, commercial: 90 } as const,
  labourRate: { home: 85, commercial: 110 } as const,
  guard: 1.25,
  roundingTo: 10,
  travelBaseKm: 25,
  travelPerKm: 1.2,
  parkingMin: 10,
  disabilityExtraMins: 0,
};

// Service regions
export const SERVICE_REGIONS = [
  'Brisbane',
  'Ipswich',
  'Gold Coast',
  'Sunshine Coast',
  'Flagstone',
  'Jimboomba',
  'Greenbank',
  'Scenic Rim',
] as const;

// Allowed services by context
export const ALLOWED_SERVICES_BY_CONTEXT: Record<Context, ServiceType[]> = {
  home: ['windows', 'cleaning', 'yard', 'dump', 'auto', 'laundry_sneakers'],
  commercial: ['windows', 'cleaning', 'yard'],
};

// Default selections
export const DEFAULT_DUMP_RUN = { loadType: 'single_item', loads: 1 } as const;
export const DEFAULT_DUMP_DELIVERY = {
  itemType: null,
  distance: 'same_suburb',
  assist: 'no_help',
  extraStops: 0,
  priority: false,
  stairsAtDropoff: false,
} as const;
export const DEFAULT_DUMP_TRANSPORT = {
  moveType: 'house',
  stairs: 'none',
  loadSize: 'small_load',
  helpers: 1,
  urgent: false,
  afterHours: false,
} as const;

// Windows constants
export const WINDOWS_BASE_PER_STOREY_MIN = 150;

export const WIN_RULES = {
  WEIGHT: { INT: 4, EXT: 5, TRACK: 5, SCREEN: 5 } as const,
  TARGETS: {
    windows_full: 240,
    windows_interior: 120,
    windows_exterior: 120,
    windows_tracks: 90,
  },
} as const;

// Yard labour rate helper
export const yardLabourRate = (context?: Context) =>
  context === 'commercial' ? POLICY.labourRate.commercial : POLICY.labourRate.home;
