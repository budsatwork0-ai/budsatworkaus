'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/rules-of-hooks */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Toaster, toast } from 'sonner';
import StableMapSlot from '@/components/StableMapSlot';
import {
  usePolygonQuote,
  computeAreaFromPath,
  computePerimeterFromPath,
  LatLng,
  YardCondition,
  YardTerrain,
  YardPricingOptions,
} from '@/app/ui/yard/usePolygonQuote';
import { loadGoogleMapsOnce } from '@/map/yardMapLoader';
import FloorPlanBuilder from '@/app/ui/floor/FloorPlanBuilder';
import { serializeLayout, deserializeLayout } from '@/app/ui/floor/utils';
import { computeFloorPricing, FloorPlanPricing } from '@/app/ui/floor/useFloorPricing';
const CarModelViewer = dynamic(() => import('@/app/ui/car/CarModelViewer'), {
  ssr: false,
  loading: () => <div className="text-xs text-slate-600">Loading 3D viewer…</div>,
});
import { useCarModelSelector, CarType, CarZone } from '@/app/ui/car/useCarModelSelector';
import RegoLookupAssistant from '@/app/ui/car/RegoLookupAssistant';
import type { VehicleSizeCategory } from '@/lib/rego/types';
import { calculatePrice } from '@/lib/rego/pricing';
import { v4 as uuidv4 } from 'uuid';

/* =========================
   THEME / UTILS
   ========================= */
const ACCENT = '#14532d';
const glass =
  'bg-white/75 backdrop-blur-2xl border border-black/10 shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

const cls = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(' ');
const titleCase = (s: string) =>
  s.replace(/\b([a-z])/gi, (m) => m.toUpperCase()).replace(/\s{2,}/g, ' ').trim();

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const QLD_BOUNDS = { north: -9.1, south: -29.6, east: 153.8, west: 138.5 };
const ROUTE_BASE_FEE = 35;
const ROUTE_PER_KM_RATE = 2.6;
const ROUTE_PER_MIN_RATE = 0.45;
const ROUTE_MIN_PRICE = 55;
const ROUTE_AVG_SPEED_KMH = 40;
const MotionContext = React.createContext(true);

// SSR-safe motion toggle
const WITH_MOTION = (() => {
  try {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
})();

const M = {
  button: ({ children, ...props }: any) => {
    const motionAllowed = React.useContext(MotionContext) && WITH_MOTION;
    return motionAllowed ? (
      <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} {...props}>
        {children}
      </motion.button>
    ) : (
      <button {...props}>{children}</button>
    );
  },
  div: ({ children, ...props }: any) => {
    const motionAllowed = React.useContext(MotionContext) && WITH_MOTION;
    return motionAllowed ? <motion.div {...props}>{children}</motion.div> : <div {...props}>{children}</div>;
  },
};

const glassCard = (active: boolean = false) =>
  cls(
    'rounded-2xl p-4 cursor-pointer select-none',
    glass,
    active ? 'ring-2 ring-[var(--accent)]' : 'ring-1 ring-black/10'
  );

/* =========================
   ICONS
   ========================= */
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const IconWrap = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 22, height: 22 }} className="shrink-0 text-black">
    {children}
  </div>
);

const WindowIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M12 3v18M3 9h18" />
  </svg>
);
const CleanIcon = () => (
  <svg {...iconProps}>
    <path d="M4 20h16M7 20l2-10h6l2 10" />
    <path d="M9 6h6M10 4h4" />
  </svg>
);
const LawnIcon = () => (
  <svg {...iconProps}>
    <path d="M3 20h18" />
    <path d="M6 20v-5m3 5v-3m3 3v-6m3 6v-4m3 4v-5" />
  </svg>
);
const TruckIcon = () => (
  <svg {...iconProps}>
    <path d="M10 17h7v-7H3v7h2" />
    <path d="M17 10h3l2 2v5h-5M6 20a2 2 0 110-4 2 2 0 010 4zm10 0a2 2 0 110-4 2 2 0 010 4z" />
  </svg>
);
const CarIcon = () => (
  <svg {...iconProps}>
    <path d="M3 13l2-5a3 3 0 012.8-2h8.4A3 3 0 0119 8l2 5" />
    <path d="M5 13h14" />
    <circle cx="7.5" cy="17.5" r="1.5" />
    <circle cx="16.5" cy="17.5" r="1.5" />
    <path d="M3 13v4M21 13v4" />
  </svg>
);
const ShoeIcon = () => (
  <svg {...iconProps}>
    <path d="M3 16c4 0 6-2 7-4l5 3c2 1 3 1 6 1v2H3z" />
    <path d="M10 12l1-2" />
  </svg>
);

/* =========================
   TYPES
   ========================= */
type Context = 'home' | 'commercial';
type ServiceType = 'windows' | 'cleaning' | 'yard' | 'dump' | 'auto' | 'sneakers';
type ScopeKey = string;
type CommFrequency = 'none' | 'daily' | '3x_weekly' | 'weekly' | 'fortnightly';
type NumericParams = Record<string, number | undefined>;
type SneakerTurnaround = 'standard' | 'express' | 'priority';
type YardJobStatus = 'draft' | 'completed';
type YardJob = {
  job_id: string;
  address: string;
  area_m2: number | null;
  polygon_geojson: LatLng[][]; // stored as arrays for now
  condition: YardCondition;
  terrain: YardTerrain;
  price: number;
  status: YardJobStatus;
  created_at: string;
};

type Task = {
  code: string;
  service: ServiceType;
  name: string;
  unit: string;
  minutes: number;
  p10?: number;
  median?: number;
  p90?: number;
};
type DeliverySelection = {
  itemType: 'parcel' | 'household' | 'mattress' | 'groceries' | 'tools' | null;
  distance: 'same_suburb' | 'drive_30' | 'drive_60' | 'long';
  assist: 'no_help' | 'need_help';
};
type TransportSelection = {
  moveType: 'house' | 'bedroom' | 'student' | 'office' | 'event';
  stairs: 'none' | 'one' | 'multi' | 'no_lift';
  loadSize: 'bags' | 'boot' | 'small_load' | 'full_move';
};
type DumpRunSelection = { loadType: 'ute' | 'trailer' | 'bulky' | null; loads: number };
const DEFAULT_DUMP_RUN: DumpRunSelection = { loadType: null, loads: 1 };
const DEFAULT_DUMP_DELIVERY: DeliverySelection = {
  itemType: null,
  distance: 'same_suburb',
  assist: 'no_help',
};
const DEFAULT_DUMP_TRANSPORT: TransportSelection = {
  moveType: 'house',
  stairs: 'none',
  loadSize: 'small_load',
};
type RouteLocation = {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
};
type RouteLookupResult = {
  distanceKm: number;
  durationMinutes: number;
};
const ROUTE_SCOPES = ['dump_delivery', 'dump_transport'] as const;
type RouteScopeKey = (typeof ROUTE_SCOPES)[number];

const roundToHalfKm = (value: number) => Math.round(value * 2) / 2;
const toRadians = (value: number) => (value * Math.PI) / 180;
const haversineDistanceKm = (a: RouteLocation, b: RouteLocation) => {
  const R = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aVal = sinLat * sinLat + sinLng * sinLng * Math.cos(latA) * Math.cos(latB);
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
};
const fallbackRoute = (pickup: RouteLocation, dropoff: RouteLocation): RouteLookupResult => {
  const distanceKm = haversineDistanceKm(pickup, dropoff);
  const durationMinutes = Math.max(1, (distanceKm / ROUTE_AVG_SPEED_KMH) * 60);
  return { distanceKm, durationMinutes };
};
const formatRouteKey = (pickup: RouteLocation, dropoff: RouteLocation) =>
  `${pickup.lat.toFixed(5)},${pickup.lng.toFixed(5)}|${dropoff.lat.toFixed(5)},${dropoff.lng.toFixed(5)}`;
const isQueenslandPlace = (place?: google.maps.places.PlaceResult | null) =>
  Boolean(
    place?.address_components?.some(
      (comp) =>
        comp.types?.includes('administrative_area_level_1') &&
        (comp.short_name === 'QLD' || comp.long_name?.toLowerCase().includes('queensland'))
    )
  );

async function fetchDrivingDistance(pickup: RouteLocation, dropoff: RouteLocation): Promise<RouteLookupResult> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key is not configured.');
  }
  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
  url.searchParams.set('origins', `${pickup.lat},${pickup.lng}`);
  url.searchParams.set('destinations', `${dropoff.lat},${dropoff.lng}`);
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('units', 'metric');
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
  const response = await fetch(url.toString());
  if (!response.ok) {
    const text = (await response.text().catch(() => '')).slice(0, 256);
    throw new Error(`Distance lookup failed (${response.status}): ${text}`);
  }
  const payload = await response.json().catch(() => null);
  if (!payload || payload.status !== 'OK') {
    throw new Error(payload?.error_message || payload?.status || 'No distance data');
  }
  const element = payload.rows?.[0]?.elements?.[0];
  if (!element || element.status !== 'OK') {
    throw new Error(element?.status || 'No element data');
  }
  const distanceMeters = Number(element.distance?.value);
  const durationSeconds = Number(element.duration?.value);
  if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds)) {
    throw new Error('Invalid distance data');
  }
  return {
    distanceKm: distanceMeters / 1000,
    durationMinutes: durationSeconds / 60,
  };
}
type Selected = Record<string, number>;
type QuoteParams = {
  context: Context;
  currentService: ServiceType;
  currentScope: ScopeKey;
  selected: Selected;
  distanceKm: number;
  paidParking: boolean;
  tipFee: number;
  conditionMult: number;
  conditionLevel?: 'light' | 'standard' | 'heavy';
  flags: { petHair: boolean; greaseSoap: boolean; clutterAccess: boolean; secondStorey: boolean };
  windowsStoreys?: number;
  commercialUplift: number;
  sizeAdjust: 'small' | 'standard' | 'large';
  conditionFlat: number;
  contractDiscount: number;
  commercialType: CommercialCleaningType | null;
  commPreset?: 'essential' | 'standard' | 'intensive';
  autoCategory?: CarType;
  autoSizeCategory?: VehicleSizeCategory | null;
  autoYear?: number | null;
  sneakerTurnaround?: SneakerTurnaround;
  afterHours: boolean;
  bottleCount?: number;
  dumpRunSelection?: DumpRunSelection;
  dumpIsNonResident?: boolean;
  cleaningParams?: NumericParams;
  yardParams?: NumericParams;
  windowsMinutesOverride?: number;
  windowsStoreysOverride?: number;
  commFrequency?: CommFrequency;
};

/* =========================
   PRICING INPUTS
   ========================= */
type WindowContextPrice = { pane: number; track: number; screen?: number };

const WINDOW_PRICES: Record<'home' | 'commercial', WindowContextPrice> = {
  home: { pane: 8.0, track: 4.0, screen: 4.0 },
  commercial: { pane: 10.0, track: 8.0 }, // no screens for commercial
};

// PRICE OVERRIDES
const PRICE_OVERRIDE: Record<string, number> = {
  // Dump runs & bin cleans
  // Bin cleans: $15 per bin (labour only, tip fees added separately)
  'dump.bin': 20,

  // Sneaker care (aligned with Quick / Deep / Premium tiers)
  // Basic: $35 (2h) · Full: $40 (3h) · Bulk lot: $20 per pair (~1h each)
  'sneaker.basic': 35,
  'sneaker.full': 40,
  'sneaker.lot': 20,

  // Car detailing packages (home)
  'auto.wash': 160,      // Express Detail
  'auto.interior': 170,  // Interior Reset Detail
  'auto.full': 290,      // Signature Full Detail (base)
};

const AUTO_SIZE_CATEGORIES: VehicleSizeCategory[] = ['hatch', 'sedan', 'suv', 'ute', 'van', '4wd'];
const SNEAKER_TURNAROUND: { key: SneakerTurnaround; label: string; multiplier: number }[] = [
  { key: 'standard', label: 'Standard', multiplier: 1 },
  { key: 'express', label: 'Express', multiplier: 1 },
  { key: 'priority', label: 'Priority', multiplier: 1 },
];
type SneakerTurnaroundMeta = {
  key: SneakerTurnaround;
  label: string;
  window: string;
  surcharge: number;
  queuePriority: number;
  capacity: number; // per-quote soft cap
};
const SNEAKER_TURNAROUND_META: SneakerTurnaroundMeta[] = [
  { key: 'standard', label: 'Standard', window: '3–5 business days', surcharge: 0, queuePriority: 0, capacity: Infinity },
  { key: 'express', label: 'Express', window: '1–2 business days', surcharge: 30, queuePriority: 1, capacity: 5 },
  { key: 'priority', label: 'Priority', window: 'Same week', surcharge: 60, queuePriority: 2, capacity: 2 },
];

const POLICY = {
  paceFactor: 1.1,
  minBlock: { home: 75, commercial: 90 } as const,
  labourRate: { home: 85, commercial: 110 } as const, // (kept for non-cleaning services)
  guard: 1.25,
  roundingTo: 10,
  travelBaseKm: 25,
  travelPerKm: 1.2,
  parkingMin: 10,
  disabilityExtraMins: 0,
};

// region allowlist
const SERVICE_REGIONS = [
  'Brisbane',
  'Ipswich',
  'Gold Coast',
  'Sunshine Coast',
  'Flagstone',
  'Jimboomba',
  'Greenbank',
  'Scenic Rim',
] as const;

const canonicalServiceRegion = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const exact = SERVICE_REGIONS.find((region) => region.toLowerCase() === lower);
  if (exact) return exact;
  const containsMatch = SERVICE_REGIONS.find((region) => lower.includes(region.toLowerCase()));
  return containsMatch ?? trimmed;
};

/* =========================
   SAFE NUMBER / CURRENCY
   ========================= */
const toNumber = (v: unknown, fallback = 0): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  const n = Number((v as any)?.valueOf?.() ?? v);
  return Number.isFinite(n) ? n : fallback;
};

// Safe currency formatter; tolerates undefined/null/NaN
const fmtAUD = (v: unknown) =>
  toNumber(v, 0).toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  });

const roundTo = (n: number, mult = 10) => Math.round(n / mult) * mult;

/* =========================
   SERVICES
   ========================= */
const SERVICES = [
  { key: 'windows',  label: 'Window Cleaning',      icon: <WindowIcon />, subtitle: 'Panes · tracks' },
  { key: 'cleaning', label: 'Cleaning',             icon: <CleanIcon />,  subtitle: 'Weekly · deep · EoL' },
  { key: 'yard',     label: 'Yard Care',            icon: <LawnIcon />,   subtitle: 'Mow · hedge · tidy' },
  { key: 'dump',     label: 'Removal & Delivery',   icon: <TruckIcon />,  subtitle: 'Dump · delivery' },
  { key: 'auto',     label: 'Car Detailing',        icon: <CarIcon />,    subtitle: 'Express → full' },
  { key: 'sneakers', label: 'Sneaker Care',         icon: <ShoeIcon />,   subtitle: 'Basic · full · the lot' },
] as const;

/* =========================
   DISCLAIMERS
   ========================= */
const TERMS_SNIPPET =
  'Pricing shown is indicative only. Final pricing may vary based on property size, access, onsite conditions (e.g. parking, height), level of build-up/soiling, scope changes, waste/tip fees, extra time requested, and safety considerations. Any adjustments will be discussed with you before work proceeds.';

const PRICE_SCOPE_DISCLAIMER =
  'Price reflects the selected scope. Changes are confirmed before work begins.';

const FAIRNESS_PROMISE_COPY =
  'Found a cheaper local quote for the same scope? Let us know and we’ll do our best to match or improve it.';

function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl p-4 ${glass} text-xs leading-relaxed text-slate-700 ${className}`}>
      <span className="font-medium text-slate-900">Disclaimer:</span> {TERMS_SNIPPET}
    </div>
  );
}

// Local storage key for persisting wizard state; bump if shape changes.
const STORAGE_KEY = 'budsatwork.quote.v1';
// Optional dev helper: flip to true to reset stored session on mount.
const RESET_ON_MOUNT = false;

function Tile({
  active,
  onClick,
  title,
  subtitle,
  icon,
  disabled,
}: {
  active?: boolean;
  onClick?: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <M.button
      onClick={() => !disabled && onClick?.()}
      className={cls(
        'relative w-full text-left rounded-2xl p-4 transition',
        glass,
        active ? 'ring-2 ring-[var(--accent)]' : 'ring-1 ring-black/10',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      )}
      aria-label={`Select ${title}`}
      title={disabled ? 'Not available in this context' : `Select ${title}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-disabled={disabled || undefined}
    >
      {active && !disabled && (
        <div
          className="absolute -top-2 -right-2 grid place-items-center w-7 h-7 rounded-full"
          style={{ background: 'var(--accent)' }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      )}
      <div className="flex items-center gap-4">
        <IconWrap>{icon}</IconWrap>
        <div>
          <div className="font-semibold text-slate-900">{title}</div>
          {subtitle ? <div className="text-xs text-slate-700">{subtitle}</div> : null}
          {disabled && <div className="text-[11px] text-slate-600 mt-1">Not covered in this context</div>}
        </div>
      </div>
    </M.button>
  );
}

function NumCell({
  label,
  value,
  onChange,
  short,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  short?: boolean;
}) {
  return (
    <div className="col-span-2 flex items-center gap-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <span className={cls(short ? 'w-14' : 'w-16', 'text-xs text-slate-600')}>{label}</span>
        <span title={label} className="text-[10px] px-1.5 py-0.5 rounded bg-black/5">
          i
        </span>
      </label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-16 text-sm px-2 py-1 rounded-xl border border-black/10 bg-white/80 text-center"
      />
    </div>
  );
}

function QtyChips({
  label,
  value,
  onChange,
  options = [0, 6, 12, 18, 24, 30],
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  options?: number[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm w-20 text-slate-700">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((n) => (
          <button
            key={n}
            className={cls(
              'px-2 py-1 rounded-lg border text-xs',
              value === n ? 'border-[color:var(--accent)] bg-white' : 'border-black/10 bg-white/70'
            )}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function PickerCard<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: string) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <div className={glassCard()}>
      <div className="text-sm font-medium mb-2 text-slate-900">{label}</div>
      <select
        className="rounded border px-2 py-1 text-sm"
        value={value as any}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={`${o.v}`} value={o.v as any}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* =========================
   CONTEXT RULES
   ========================= */
const ALLOWED_SERVICES_BY_CONTEXT: Record<Context, ServiceType[]> = {
  home: ['windows', 'cleaning', 'yard', 'dump', 'auto', 'sneakers'],
  commercial: ['windows', 'cleaning', 'yard', 'dump', 'auto', 'sneakers'],
};

/* =========================
   SCOPES
   ========================= */
type ScopeDef = { key: ScopeKey; label: string; inclusions: string[]; desc?: string; helper?: boolean };

/** Cleaning scopes (aligned to pricing/selection logic: clean_std / clean_deep / clean_move) */
const CLEAN_SCOPES: ScopeDef[] = [
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

type ImpactLevel = 'light' | 'medium' | 'heavy' | 'detail' | 'organising';

// Very lightweight rules to colour the little impact dot per task line
const CLEANING_IMPACTS: { match: RegExp; impact: ImpactLevel }[] = [
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

function impactForCleaningItem(label: string): ImpactLevel {
  for (const rule of CLEANING_IMPACTS) {
    if (rule.match.test(label)) return rule.impact;
  }
  return 'light';
}

function impactDotClass(impact: ImpactLevel): string {
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
type MicroPreset = {
  id: string;
  label: string;
  description: string;
  matchers: RegExp[]; // we match against inclusion labels
};

const CLEANING_MICRO_PRESETS: MicroPreset[] = [
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

function itemsForPreset(all: string[], preset: MicroPreset): string[] {
  return all.filter((label) => preset.matchers.some((rx) => rx.test(label)));
}

/* =========================
   TASKS
   ========================= */
const TASKS: Task[] = [
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
  // Synthetic "SS" buckets – the V2 formulas already give us minutes, so
  // each unit here *is one minute* of work.
  {
    code: 'clean.ss.weekly',
    service: 'cleaning',
    name: 'Weekly / maintenance',
    unit: 'min',
    minutes: 1,
  },
  {
    code: 'clean.ss.general',
    service: 'cleaning',
    name: 'Standard / general clean',
    unit: 'min',
    minutes: 1,
  },
  {
    code: 'clean.ss.inspection',
    service: 'cleaning',
    name: 'Inspection / tidy-up',
    unit: 'min',
    minutes: 1,
  },
  {
    code: 'clean.ss.deep',
    service: 'cleaning',
    name: 'Deep / spring clean',
    unit: 'min',
    minutes: 1,
  },
  {
    code: 'clean.ss.endoflease',
    service: 'cleaning',
    name: 'Move-in / bond clean',
    unit: 'min',
    minutes: 1,
  },
  // Commercial niches (office, medical, gym, etc.)
  {
    code: 'clean.ss.office',
    service: 'cleaning',
    name: 'Office / workspace',
    unit: 'min',
    minutes: 1,
  },
  {
    code: 'clean.ss.medical',
    service: 'cleaning',
    name: 'Clinic / medical',
    unit: 'min',
    minutes: 1,
  },
  {
    code: 'clean.ss.fitness',
    service: 'cleaning',
    name: 'Gym / fitness',
    unit: 'min',
    minutes: 1,
  },
  {
    code: 'clean.ss.hospitality',
    service: 'cleaning',
    name: 'Hospitality / venue',
    unit: 'min',
    minutes: 1,
  },
  {
    code: 'clean.ss.education',
    service: 'cleaning',
    name: 'Education',
    unit: 'min',
    minutes: 1,
  },
  {
    code: 'clean.ss.event',
    service: 'cleaning',
    name: 'Event / function',
    unit: 'min',
    minutes: 1,
  },
  // Directed hourly cleaning (used when you pick "hours" instead of formula)
  {
    code: 'clean.hourly',
    service: 'cleaning',
    name: 'Directed cleaning hour',
    unit: 'hr',
    minutes: 60,
  },

  // ===== YARD CARE =====
  // Medians tuned so small jobs beat the min-block, so each sub-service
  // shows its own “from” instead of collapsing to the same callout.
  {
    code: 'lawn.mow',
    service: 'yard',
    name: 'Lawn mow / edging block (~50–75 m²)',
    unit: 'block',
    minutes: 35,
    p10: 130,
    median: 145,
    p90: 180,
  },
  {
    code: 'lawn.edge',
    service: 'yard',
    name: 'Edging (per 5 m)',
    unit: '5m',
    minutes: 10,
    p10: 30,
    median: 40,
    p90: 60,
  },
  {
    code: 'hedge.trim',
    service: 'yard',
    name: 'Hedge shaping & trim time block',
    unit: 'effort block',
    minutes: 18,
    p10: 140,
    median: 150,
    p90: 190,
  },
  {
    code: 'garden.blow',
    service: 'yard',
    name: 'Garden reset / wash effort block',
    unit: 'zone',
    minutes: 18,
    p10: 110,
    median: 125,
    p90: 160,
  },
  {
    code: 'gutter_clean',
    service: 'yard',
    name: 'Gutter clean access & safety block',
    unit: 'access block',
    minutes: 20,
    p10: 150,
    median: 165,
    p90: 210,
  },

  // ===== RUBBISH & BIN CARE =====
  {
    code: 'dump.pack',
    service: 'dump',
    name: 'Packed load (ute / small trailer)',
    unit: 'load',
    minutes: 30,
    p10: 120,
    median: 135,
    p90: 180,
  },
  {
    code: 'dump.drive',
    service: 'dump',
    name: 'Extra pickup stop',
    unit: 'stop',
    minutes: 20,
    p10: 40,
    median: 55,
    p90: 90,
  },
  {
    code: 'dump.load',
    service: 'dump',
    name: 'Bulky item',
    unit: 'item',
    minutes: 8,
    p10: 15,
    median: 25,
    p90: 45,
  },
  {
    code: 'dump.sweep',
    service: 'dump',
    name: 'Sweep & tidy area',
    unit: 'area',
    minutes: 10,
    p10: 25,
    median: 35,
    p90: 55,
  },
  {
    code: 'dump.bin',
    service: 'dump',
    name: 'Wheelie bin clean',
    unit: 'bin',
    minutes: 8,
    // $40/bin handled via PRICE_OVERRIDE, minutes drive time estimate only
  },

  // ===== CAR DETAILING =====
  {
    code: 'auto.wash',
    service: 'auto',
    name: 'Express Detail',
    unit: 'vehicle',
    minutes: 120,
    p10: 160,
    median: 160,
    p90: 160,
  },
  {
    code: 'auto.interior',
    service: 'auto',
    name: 'Interior Reset Detail',
    unit: 'vehicle',
    minutes: 120,
    p10: 170,
    median: 170,
    p90: 170,
  },
  {
    code: 'auto.full',
    service: 'auto',
    name: 'Signature Full Detail',
    unit: 'vehicle',
    minutes: 240,
    p10: 290,
    median: 290,
    p90: 290,
  },

  // ===== SNEAKER CARE =====
  // Dollar amounts come from PRICE_OVERRIDE; minutes here just drive time/estimate.
  {
    code: 'sneaker.basic',
    service: 'sneakers',
    name: 'Refresh Clean (per pair)',
    unit: 'pair',
    minutes: 0,
  },
  {
    code: 'sneaker.full',
    service: 'sneakers',
    name: 'Deep Restore (per pair)',
    unit: 'pair',
    minutes: 0,
  },
  {
    code: 'sneaker.lot',
    service: 'sneakers',
    name: 'Multi-Pair Care (3–5 pairs)',
    unit: 'lot',
    minutes: 0,
  },
];

const TASK_MAP = new Map(TASKS.map((t) => [t.code, t]));

/* =========================
   SCOPES BY SERVICE
   ========================= */
const SCOPES_BY_SERVICE: Record<ServiceType, ScopeDef[]> = {
  windows: [
    {
      key: 'windows_full',
      label: 'Full window clean',
      inclusions: ['Inside & outside panes', 'Tracks', 'Screens'],
      desc: 'Complete inside and outside window cleaning.',
    },
    {
      key: 'windows_interior',
      label: 'Interior only',
      inclusions: ['Interior panes', 'Frames & sills'],
      desc: 'Interior panes, frames and sills only.',
    },
    {
      key: 'windows_exterior',
      label: 'Exterior only',
      inclusions: ['Exterior panes', 'Screens'],
      desc: 'Exterior panes and screens only.',
    },
    {
      key: 'windows_tracks',
      label: 'Tracks only',
      inclusions: ['Tracks vacuum & wipe'],
      desc: 'Track cleaning and light detail.',
    },
  ],
  cleaning: CLEAN_SCOPES,
  yard: [
    {
      key: 'yard_mow',
      label: 'Lawn mow',
      inclusions: [
        'Lawn mowed to an even height',
        'Edges trimmed for a clean finish',
        'Clippings collected or mulched',
        'Hard surfaces blown clean',
      ],
      desc: 'Mow and tidy grass areas.',
    },
    {
      key: 'yard_hedge',
      label: 'Hedge trim',
      inclusions: [
        'Hedges trimmed and shaped',
        'Height/length checked for safe access',
        'Cuttings collected with time to tidy',
        'Garden areas left tidy',
      ],
      desc: 'Priced on hedge length, height, and trimming effort — longer or taller hedges simply need more shaping time, access, and cleanup.',
    },
    {
      key: 'yard_leaves',
      label: 'Garden Services',
      inclusions: [
        'Lawn edges trimmed',
        'Weeds removed based on density',
        'Plants & shrubs lightly pruned',
        'Leaves and green waste collected, paths blown clean',
      ],
      desc: 'Priced on time and effort to restore the area — heavily overgrown or dense weeds take longer, and pricing adjusts to match the effort.',
    },
    {
      key: 'blast_and_shine',
      label: 'Pressure wash',
      inclusions: [
        'Surface assessed for material and runoff',
        'Built-up dirt, mould, and grime removed',
        'Paths, driveways, or patios washed',
        'Setup and rinse-down time included',
      ],
      desc: 'Priced based on surface type, condition, and cleaning time — stubborn grime and larger areas take longer, with setup and rinse included.',
    },
    {
      key: 'gutter_clean',
      label: 'Gutter clean',
      inclusions: [
        'Gutters cleared of leaves and debris',
        'Downpipes checked for blockages',
        'Ladder moves and debris handling included',
        'Flow visually checked',
      ],
      desc: 'Priced on roof size, height, and access — larger or multi-storey homes take more time, covering ladder moves, debris volume, and safety.',
    },
  ],
  dump: [
    {
      key: 'dump_runs',
      label: 'Dump runs',
      inclusions: ['Pickup & dispose', 'Load assistance'],
      desc: 'Pickup runs to disposal facility.',
    },
    {
      key: 'bin_cleans',
      label: 'Bin cleans',
      inclusions: ['Wash & deodorise bins'],
      desc: 'Bin cleaning and deodorising.',
    },
    {
      key: 'dump_delivery',
      label: 'Delivery services',
      inclusions: ['Pickup items', 'Deliver to location', 'Load/unload help'],
      desc: 'Small deliveries or drop-offs with load assistance.',
    },
    {
      key: 'dump_transport',
      label: 'Transport / move assistance',
      inclusions: ['Move goods between sites', 'Load / unload help', 'Protect items in transit'],
      desc: 'Helping transport or move items from A to B.',
    },
  ],
  auto: [
    {
      key: 'auto_express',
      label: 'Express Detail',
      inclusions: [
        'Exterior hand wash',
        'Tyre shine',
        'Quick spray wax',
        'Vacuum seats, mats & boot',
        'Interior plastics wiped',
        'Windows inside/out',
        'Door jambs cleaned',
      ],
      desc: 'Quick polish, vacuum, and windows with stain spot removal included.',
    },
    {
      key: 'auto_interior',
      label: 'Interior Reset Detail',
      inclusions: [
        'Full interior vacuum (mats + seats + boot)',
        'Interior plastics deep clean',
        'Dashboard rejuvenation',
        'Stain spot removal (1–3 areas)',
        'Carpet & fabric deodorising',
        'Door jambs cleaned',
        'Windows inside',
        'Light pet hair removal (included)',
      ],
      desc: 'Deep interior reset with deodorise and light pet hair included.',
    },
    {
      key: 'auto_full',
      label: 'Signature Full Detail',
      inclusions: [
        'Full exterior wash',
        'Clay bar (quick clay)',
        'Hand polish',
        'Tyre shine',
        'Spray sealant / wax',
        'Complete vacuum',
        'Interior plastics deep clean',
        'Stain removal (multiple areas)',
        'Interior deodorising',
        'Windows inside/out',
        'Door jambs',
        'Light pet hair removal',
      ],
      desc: 'Full inside/out transformation with clay bar and hand polish.',
    },
  ],
  sneakers: [
    {
      key: 'sneaker_basic',
      label: 'Refresh Clean',
      inclusions: ['Exterior clean', 'Midsole/outsole scrub', 'Lace clean', 'Odour neutralise'],
      desc: 'Routine uplift for lightly worn pairs; cosmetic refresh only.',
    },
    {
      key: 'sneaker_full',
      label: 'Deep Restore',
      inclusions: ['Full hand clean', 'Material-safe treatment', 'Insole & lace wash', 'Protective finish'],
      desc: 'Revival for noticeably dirty or heavily worn pairs.',
    },
    {
      key: 'sneaker_lot',
      label: 'Multi-Pair Care',
      inclusions: ['Batch-friendly', 'Mixed care levels allowed', 'Tiered per-pair pricing'],
      desc: 'For households, collections, or teams; consolidated turnaround.',
    },
  ],
};

type YardMeasurementMode = 'area' | 'perimeter';
type YardMeasurementConfig = {
  mode: YardMeasurementMode;
  field: string;
  label: string;
};

const YARD_SCOPE_MEASUREMENTS: Record<ScopeKey, YardMeasurementConfig> = {
  yard_mow: { mode: 'area', field: 'lawn_m2', label: 'Area' },
  yard_hedge: { mode: 'perimeter', field: 'hedge_m', label: 'Perimeter' },
  yard_leaves: { mode: 'area', field: 'leaves_area', label: 'Area' },
  blast_and_shine: { mode: 'area', field: 'blast_m2', label: 'Area' },
  gutter_clean: { mode: 'perimeter', field: 'gutter_m', label: 'Perimeter' },
};

const DEFAULT_YARD_MEASUREMENT: YardMeasurementConfig = {
  mode: 'area',
  field: 'lawn_m2',
  label: 'Area',
};

const YARD_MEASUREMENT_UNITS: Record<YardMeasurementMode, string> = {
  area: 'm²',
  perimeter: 'm',
};

const getYardMeasurementConfig = (scope: ScopeKey): YardMeasurementConfig =>
  YARD_SCOPE_MEASUREMENTS[scope] ?? DEFAULT_YARD_MEASUREMENT;

/* =========================
   PARAM CONTROLS
   ========================= */
type ParamDef = {
  key: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number;
  suffix?: string;
};
type ParamTable = Record<ServiceType, ParamDef[]>;

const PARAMS_FULL: ParamTable = {
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
    // Lawn Glow-Up
    { key: 'lawn_m2', label: 'Lawn area', min: 0, max: 1500, step: 50, defaultValue: 250, suffix: 'm²' },

    // Hedge Hero
    { key: 'hedge_m', label: 'Hedge length & height (estimate)', min: 0, max: 200, step: 5, defaultValue: 20 },

    // Leaf Vanish
    {
      key: 'leaves_area',
      label: 'Garden reset size (estimate)',
      min: 0,
      max: 2000,
      step: 25,
      defaultValue: 150,
    },

    // Blast & Shine (pressure wash)
    { key: 'blast_m2', label: 'Pressure-wash surfaces (estimate)', min: 0, max: 500, step: 10, defaultValue: 80 },

    // Gutter Guard
    {
      key: 'gutter_m',
      label: 'Roof size & access (estimate)',
      min: 0,
      max: 400,
      step: 10,
      defaultValue: 120,
    },
  ],
  dump: [
    { key: 'items', label: 'Items / bulky pieces', min: 0, max: 40, defaultValue: 0 },
    { key: 'stops', label: 'Pickup stops', min: 0, max: 3, defaultValue: 0 },
    { key: 'bins', label: 'Bins to clean', min: 0, max: 20, defaultValue: 0 },
    { key: 'bottles', label: '10c bottles (credit)', min: 0, max: 500, step: 10, defaultValue: 0 },
  ],
  auto: [
    { key: 'vehicle_size', label: 'Car size', min: 0, max: 5, defaultValue: 0 },
    { key: 'rows', label: 'Seats / rows', min: 0, max: 3, defaultValue: 0 },
    { key: 'child_seats', label: 'Child seats', min: 0, max: 3, defaultValue: 0 },
  ],
  sneakers: [], // no sliders, just tiers
};

// Per-niche ParamDef sets. Keys MUST be one of: sqm, workstations, restrooms, break_rooms, floors, high_traffic.
type CommParamDef = {
  key: 'sqm' | 'workstations' | 'restrooms' | 'break_rooms' | 'floors' | 'high_traffic';
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  suffix?: string;
};

// Descriptive labels for commercial cleaning niches (used by Step 2 cards)
type CommercialCleaningType =
  | 'office'
  | 'medical'
  | 'fitness'
  | 'hospitality'
  | 'education'
  | 'event'
  | 'accommodation';

const COMM_PARAM_DEFS: Record<CommercialCleaningType, CommParamDef[]> = {
  office: [
    {
      key: 'sqm',
      label: 'Area (sqm) – Office Space',
      min: 0,
      max: 10000,
      step: 50,
      defaultValue: 600,
      suffix: 'sqm',
    },
    { key: 'workstations', label: 'Workstations – Desks', min: 0, max: 500, step: 5, defaultValue: 20 },
    { key: 'restrooms', label: 'Restrooms – Toilet Blocks', min: 0, max: 50, step: 1, defaultValue: 2 },
    { key: 'break_rooms', label: 'Break Rooms – Tea Rooms', min: 0, max: 20, step: 1, defaultValue: 1 },
    { key: 'floors', label: 'Floors – Levels', min: 1, max: 10, step: 1, defaultValue: 1 },
    {
      key: 'high_traffic',
      label: 'High-Touch – Handles/Phones',
      min: 0,
      max: 50,
      step: 1,
      defaultValue: 3,
    },
  ],
  medical: [
    {
      key: 'sqm',
      label: 'Area (sqm) – Clinic Space',
      min: 0,
      max: 10000,
      step: 50,
      defaultValue: 350,
      suffix: 'sqm',
    },
    { key: 'workstations', label: 'Consult Rooms – Treatment', min: 0, max: 100, step: 1, defaultValue: 6 },
    {
      key: 'restrooms',
      label: 'Restrooms – Patient Toilets',
      min: 0,
      max: 50,
      step: 1,
      defaultValue: 2,
    },
    {
      key: 'break_rooms',
      label: 'Waiting Area – Seats',
      min: 0,
      max: 500,
      step: 5,
      defaultValue: 10,
    },
    { key: 'floors', label: 'Floors – Levels', min: 1, max: 10, step: 1, defaultValue: 1 },
    {
      key: 'high_traffic',
      label: 'High-Touch – Medical Handles',
      min: 0,
      max: 50,
      step: 1,
      defaultValue: 5,
    },
  ],
  fitness: [
    {
      key: 'sqm',
      label: 'Area (sqm) – Gym Floor',
      min: 0,
      max: 15000,
      step: 50,
      defaultValue: 450,
      suffix: 'sqm',
    },
    { key: 'workstations', label: 'Machines – Equipment', min: 0, max: 500, step: 5, defaultValue: 20 },
    {
      key: 'restrooms',
      label: 'Locker Rooms – Change',
      min: 0,
      max: 50,
      step: 1,
      defaultValue: 2,
    },
    {
      key: 'break_rooms',
      label: 'Showers – Shower Blocks',
      min: 0,
      max: 50,
      step: 1,
      defaultValue: 3,
    },
    {
      key: 'floors',
      label: 'Mats – Floor Mats (zones)',
      min: 0,
      max: 1000,
      step: 50,
      defaultValue: 100,
    },
    {
      key: 'high_traffic',
      label: 'High-Touch – Handles/Mirrors',
      min: 0,
      max: 50,
      step: 1,
      defaultValue: 6,
    },
  ],
  hospitality: [
    {
      key: 'sqm',
      label: 'Area (sqm) – Dining/Bar',
      min: 0,
      max: 10000,
      step: 50,
      defaultValue: 550,
      suffix: 'sqm',
    },
    { key: 'workstations', label: 'Tables – Dining Tables', min: 0, max: 500, step: 5, defaultValue: 15 },
    {
      key: 'restrooms',
      label: 'Restrooms – Customer',
      min: 0,
      max: 50,
      step: 1,
      defaultValue: 2,
    },
    {
      key: 'break_rooms',
      label: 'Kitchen – Prep Areas',
      min: 0,
      max: 10,
      step: 1,
      defaultValue: 1,
    },
    {
      key: 'floors',
      label: 'Bar Area – Serving Stations',
      min: 0,
      max: 10,
      step: 1,
      defaultValue: 1,
    },
    {
      key: 'high_traffic',
      label: 'High-Touch – Door Handles',
      min: 0,
      max: 50,
      step: 1,
      defaultValue: 4,
    },
  ],
  education: [
    {
      key: 'sqm',
      label: 'Area (sqm) – Classroom Space',
      min: 0,
      max: 15000,
      step: 50,
      defaultValue: 550,
      suffix: 'sqm',
    },
    { key: 'workstations', label: 'Classrooms – Learning Rooms', min: 0, max: 100, step: 1, defaultValue: 4 },
    {
      key: 'restrooms',
      label: 'Restrooms – Child Toilets',
      min: 0,
      max: 50,
      step: 1,
      defaultValue: 3,
    },
    {
      key: 'break_rooms',
      label: 'Play Areas – Activity Zones',
      min: 0,
      max: 50,
      step: 1,
      defaultValue: 2,
    },
    {
      key: 'floors',
      label: 'Kitchen – Staff Room',
      min: 0,
      max: 10,
      step: 1,
      defaultValue: 1,
    },
    {
      key: 'high_traffic',
      label: 'High-Touch – Toy Handles',
      min: 0,
      max: 50,
      step: 1,
      defaultValue: 5,
    },
  ],
  event: [
    {
      key: 'sqm',
      label: 'Area (sqm) – Venue Space',
      min: 0,
      max: 20000,
      step: 50,
      defaultValue: 700,
      suffix: 'sqm',
    },
    { key: 'workstations', label: 'Tables – Dining Tables', min: 0, max: 1000, step: 5, defaultValue: 20 },
    {
      key: 'restrooms',
      label: 'Restrooms – Event Toilets',
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 4,
    },
    {
      key: 'break_rooms',
      label: 'Chairs – Seating',
      min: 0,
      max: 5000,
      step: 10,
      defaultValue: 50,
    },
    {
      key: 'floors',
      label: 'Stage Area – Performance Zone',
      min: 0,
      max: 10,
      step: 1,
      defaultValue: 1,
    },
    {
      key: 'high_traffic',
      label: 'High-Touch – Door/Bar Handles',
      min: 0,
      max: 50,
      step: 1,
      defaultValue: 6,
    },
  ],
  accommodation: [
    {
      key: 'sqm',
      label: 'Area (sqm) – Rooms & common',
      min: 0,
      max: 20000,
      step: 50,
      defaultValue: 700,
      suffix: 'sqm',
    },
    { key: 'workstations', label: 'Rooms/Units', min: 0, max: 500, step: 5, defaultValue: 40 },
    { key: 'restrooms', label: 'Restrooms/Blocks', min: 0, max: 50, step: 1, defaultValue: 6 },
    { key: 'break_rooms', label: 'Kitchens/Tea Rooms', min: 0, max: 20, step: 1, defaultValue: 3 },
    { key: 'floors', label: 'Floors – Levels', min: 1, max: 20, step: 1, defaultValue: 4 },
    {
      key: 'high_traffic',
      label: 'High-Touch – Lifts/Handrails',
      min: 0,
      max: 50,
      step: 1,
      defaultValue: 8,
    },
  ],
};

// Descriptive labels for commercial cleaning niches (used by Step 2 cards)
type CommMeta = { title: string; covers: string; avg: string; reason: string };

const COMM_LABELS: Record<CommercialCleaningType, CommMeta> = {
  office: {
    title: 'Office & Corporate',
    covers: 'Offices · Co-Working · Banks · Call Centres',
    avg: '$120 / 2h · $60/hr',
    reason: '80% of market – weekly repeat',
  },
  medical: {
    title: 'Medical & Hygiene',
    covers: 'Clinics · Dentists · Physios · Vets',
    avg: '$140 / 2h · $70/hr',
    reason: 'Higher rate, compliance-driven',
  },
  fitness: {
    title: 'Fitness & Leisure',
    covers: 'Gyms · Yoga · Pools · Sports Clubs',
    avg: '$140 / 2h · $70/hr',
    reason: 'Equipment & mats attention',
  },
  hospitality: {
    title: 'Hospitality',
    covers: 'Cafés · Restaurants · Bars · Venues',
    avg: '$140 / 2h · $70/hr',
    reason: 'Grease & spill intensive',
  },
  education: {
    title: 'Education & Care',
    covers: 'Schools · Childcare · Tutoring · OSHC',
    avg: '$140 / 2h · $70/hr',
    reason: 'Child-safe, high-touch focus',
  },
  event: {
    title: 'Event & Venue',
    covers: 'Conferences · Stadiums · Halls',
    avg: '$120 / 2h · $60/hr',
    reason: 'Pre/post-event turnaround',
  },
  accommodation: {
    title: 'Accommodation',
    covers: 'Hotels · Airbnb · Strata · Serviced Apartments',
    avg: '$120 / 2h · $60/hr',
    reason: 'Room turnover + common areas',
  },
};

function getCleaningParamDefs(ctx: Context, kind?: CommercialCleaningType | null): ParamDef[] {
  if (ctx === 'commercial') {
    const t = kind ?? 'office';
    return COMM_PARAM_DEFS[t];
  }
  return PARAMS_FULL.cleaning;
}

const num = (v: any, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const clamp = (v: number, min = 0, max = Infinity) => Math.max(min, Math.min(max, v));
const clampParam = (def: ParamDef, v: number) => clamp(v, def.min ?? 0, def.max ?? Number.POSITIVE_INFINITY);
const fromDefs = (defs: ParamDef[]): Record<string, number> =>
  Object.fromEntries(defs.map((p) => [p.key, p.defaultValue])) as Record<string, number>;

const defaultParamsByService = () => ({
  cleaning: fromDefs(PARAMS_FULL.cleaning),
  windows: fromDefs(PARAMS_FULL.windows),
  yard: fromDefs(PARAMS_FULL.yard),
  dump: fromDefs(PARAMS_FULL.dump),
  auto: fromDefs(PARAMS_FULL.auto),
  sneakers: {}, // sneakers use tiers only
});

/* =========================
   WINDOWS HELPERS
   ========================= */
const WINDOWS_BASE_PER_STOREY_MIN = 150; // ~12 windows/storey ≈ 2.5h
type StoreyRow = { int: number; ext: number; tracks: number; screens: number; label?: string };

const HOUSE_SNAPS: { name: string; rows: StoreyRow[] }[] = [
  { name: 'Unit (1)', rows: [{ int: 12, ext: 12, tracks: 12, screens: 12, label: 'Level' }] },
  { name: 'Small home', rows: [{ int: 10, ext: 10, tracks: 10, screens: 10, label: 'Level' }] },
  { name: 'Large home', rows: [{ int: 16, ext: 16, tracks: 16, screens: 16, label: 'Level' }] },
];

// =========================
// Windows time calculator (shared)
// =========================
const WIN_RULES = {
  WEIGHT: { INT: 4, EXT: 5, TRACK: 5, SCREEN: 5 } as const,
  TARGETS: {
    windows_full: 240,
    windows_interior: 120,
    windows_exterior: 120,
    windows_tracks: 90,
  },
} as const;

function getScopeFlags(scope: ScopeKey) {
  const isIntOnly = scope === 'windows_interior';
  const isExtOnly = scope === 'windows_exterior';
  const isTracksOnly = scope === 'windows_tracks';
  const isFull = scope === 'windows_full' || (!isIntOnly && !isExtOnly && !isTracksOnly);
  return { isIntOnly, isExtOnly, isTracksOnly, isFull };
}

function toSafeInt(n: unknown): number {
  const v = Number.isFinite(n as number) ? (n as number) : 0;
  return Math.max(0, Math.floor(v));
}

function computeWindowsMinutes(
  scope: ScopeKey,
  rows: WizardState['winRows'],
  context: Context,
  paramsWindows?: Record<string, unknown>
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
function scopePresetFor(
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
    if (scope === 'bin_cleans') return { ...zero, bins: 2, items: 0, stops: 0 };
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
const CLEANING_TASK_LIBRARY = {
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

function buildCleaningChecklistFromWizard(state: CleaningWizardChecklistState): string[] {
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
   SIMPLY SPOTLESS–STYLE (HOME ONLY) @ $60/hr (legacy)
   ========================= */
type SSKind = 'general' | 'deep' | 'endoflease';

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

function ssMinutes(kind: SSKind, bedrooms: number, storeys: number, bathrooms: number, laundry: number): number {
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

const COMM_CLEAN_MULTIPLIER: Record<CommercialCleaningType, number> = {
  office: 1.0,
  medical: 1.5,
  fitness: 1.3,
  hospitality: 1.4,
  education: 1.2,
  event: 1.1,
  accommodation: 1.2,
};

const COMM_CLEAN_MIN_HOURS: Record<CommercialCleaningType, number> = {
  office: 2.0,
  medical: 2.0,
  fitness: 2.0,
  hospitality: 2.0,
  education: 2.0,
  event: 2.0,
  accommodation: 2.0,
};

const COMM_CLEAN_RATES: Record<CommercialCleaningType, number> = {
  office: 60,
  medical: 70,
  fitness: 70,
  hospitality: 70,
  education: 70,
  event: 60,
  accommodation: 60,
};

const COMM_PRESET_PRICING: Record<
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

// Round to nearest half-hour (e.g., 6.24h -> 6.5h)
function roundToHalfHour(hours: number) {
  return Math.round(hours * 2) / 2;
}

function cleaningCommercialMinutes(kind: CommercialCleaningType, p: any): number {
  // Fixed 4-hour baseline for all commercial cleaning niches
  return 240;
}

/* ===== Home Cleaning – legacy V1 (kept for future use) ===== */
type CleanScopeKind = 'weekly' | 'general' | 'inspection' | 'deep' | 'endoflease' | 'hourly';

const CLEANING_HOME_MULTIPLIER: Record<CleanScopeKind, number> = {
  weekly: 1.0,
  general: 1.15,
  inspection: 1.4,
  deep: 1.6,
  endoflease: 1.85,
  hourly: 1.0,
};

const CLEANING_HOME_MIN_HOURS: Record<CleanScopeKind, number> = {
  weekly: 2.0,
  general: 2.5,
  inspection: 3.0,
  deep: 3.5,
  endoflease: 4.5,
  hourly: 1.0,
};

const CLEANING_HOME_RATES: Record<CleanScopeKind, number> = {
  weekly: 55,
  general: 60,
  inspection: 60,
  deep: 65,
  endoflease: 90,
  hourly: 60,
};

function cleaningHomeMinutes(kind: CleanScopeKind, p: any): number {
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

type CleanScopeKindV2 = CleanScopeKind;

const CLEANING_HOME_RATES_V2: Record<CleanScopeKindV2, number> = {
  weekly: 55,      // discounted from base
  general: 60,     // base rate
  inspection: 60,
  deep: 65,
  endoflease: 90,
  hourly: 60,
};

// 2025 Brisbane home cleaning matrix (GST incl.)
// format: pricing[bedrooms][bathrooms][storeys] = { standard: [low, high], deep: [low, high], move: [low, high] }
const CLEANING_HOME_BRISBANE_2025: Record<
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

const CLEANING_HOME_RECURRING_DISCOUNT: Record<string, number> = {
  weekly: 0.2,
  fortnightly: 0.1,
};

// Home cleaning presets (base counts) and incremental rules for extras
const HOME_CLEAN_PRESETS: Record<
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

type ExtraRule = { minutes: number; cost: number };
type ExtraRules = Partial<Record<'bedrooms' | 'bathrooms' | 'kitchens' | 'laundry' | 'living' | 'storeys', ExtraRule>>;

const HOME_EXTRA_RULES: Record<CleanScopeKindV2, ExtraRules> = {
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

function computeCleaningAddons(scope: ScopeKey, params: NumericParams) {
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

function computeHomeExtras(scope: ScopeKey, params: NumericParams) {
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

// Yard care overrides (flat + increments)
type YardQuoteOptions = {
  scope?: ScopeKey;
  isTwoStoreyGutter?: boolean;
  conditionMultiplier?: number;
  accessTight?: boolean;
  conditionLevel?: 'light' | 'standard' | 'heavy';
  context?: Context;
};

const YARD_LABOUR_MIN_HOURS = 1.5;
const YARD_LABOUR_RATE_HOME = 60;
const YARD_LABOUR_RATE_COMMERCIAL = 75;

const yardLabourRate = (context?: Context) =>
  context === 'commercial' ? YARD_LABOUR_RATE_COMMERCIAL : YARD_LABOUR_RATE_HOME;

function computeYardQuote(params: NumericParams, opts: YardQuoteOptions = {}) {
  const scope = opts.scope;
  const areaOverride = toNumber((params as any).yard_area ?? (params as any).area_m2, 0);

  const lawn =
    scope === 'yard_mow' && areaOverride > 0 ? areaOverride : toNumber(params.lawn_m2 ?? 0, 0);
  const hedge = toNumber(params.hedge_m ?? 0, 0);
  const gardenArea =
    scope === 'yard_leaves' && areaOverride > 0
      ? areaOverride
      : toNumber(params.leaves_area ?? 0, 0);
  const blast =
    scope === 'blast_and_shine' && areaOverride > 0 ? areaOverride : toNumber(params.blast_m2 ?? 0, 0);
  const gutter =
    scope === 'gutter_clean' && areaOverride > 0 ? areaOverride : toNumber(params.gutter_m ?? 0, 0);

  // Guard: only one area-based service per polygon unless explicitly split.
  const areaBuckets: Record<string, number> = {
    lawn,
    garden: gardenArea,
    blast,
    gutter,
  };
  const areaKeyByScope: Partial<Record<ScopeKey, keyof typeof areaBuckets>> = {
    yard_mow: 'lawn',
    yard_leaves: 'garden',
    blast_and_shine: 'blast',
    gutter_clean: 'gutter',
  };
  const primaryAreaKey = areaKeyByScope[scope as ScopeKey];
  const nonZeroAreaKeys = Object.entries(areaBuckets)
    .filter(([, v]) => v > 0)
    .map(([k]) => k as keyof typeof areaBuckets);

  if (primaryAreaKey) {
    Object.keys(areaBuckets).forEach((k) => {
      if (k !== primaryAreaKey) areaBuckets[k] = 0;
    });
  } else if (nonZeroAreaKeys.length > 1) {
    const keep = nonZeroAreaKeys[0];
    Object.keys(areaBuckets).forEach((k) => {
      if (k !== keep) areaBuckets[k] = 0;
    });
  }

  const lawnArea = areaBuckets.lawn;
  const gardenTidyArea = areaBuckets.garden;
  const blastArea = areaBuckets.blast;
  const gutterArea = areaBuckets.gutter;

  let minutes = 0;
  let cost = 0;

  const conditionLevel = opts.conditionLevel ?? 'standard';
  const conditionFromLevel = conditionLevel === 'heavy' ? 1.3 : conditionLevel === 'light' ? 0.9 : 1;
  const conditionMult = clamp(
    opts.conditionMultiplier != null
      ? Math.max(opts.conditionMultiplier, conditionFromLevel)
      : conditionFromLevel,
    0.7,
    1.6
  );
  const accessSurcharge = opts.accessTight ? 35 : 0;
  const twoStoreyCost = opts.isTwoStoreyGutter ? 1.5 : 1;
  const twoStoreyMinutes = opts.isTwoStoreyGutter ? 1.6 : 1;

  const addUnitJob = (
    units: number,
    rate: number,
    minCharge: number,
    minutesPerUnit: number,
    baseMinutes: number,
    extra?: { costMult?: number; minuteMult?: number }
  ) => {
    if (units <= 0) return;
    const costMult = extra?.costMult ?? 1;
    const minuteMult = extra?.minuteMult ?? 1;
    const rawCost = units * rate * conditionMult * costMult;
    cost += Math.max(minCharge, rawCost);
    minutes += Math.max(0, (baseMinutes + units * minutesPerUnit) * conditionMult * minuteMult);
  };

  // Garden tidy / reset
  addUnitJob(gardenTidyArea, 2, 120, 0.35, 25);
  // Lawn mowing (minimum internal callout enforced)
  addUnitJob(lawnArea, 1, 80, 0.18, 20);
  // Hedge trim (assumes ≤2.5m height)
  addUnitJob(hedge, 10, 120, 2.5, 20);
  // Pressure washing (default surface: concrete)
  addUnitJob(blastArea, 5, 150, 0.45, 25);
  // Gutter clean (priced off roof area footprint)
  addUnitJob(gutterArea, 2, 150, 0.35, 30, {
    costMult: twoStoreyCost,
    minuteMult: twoStoreyMinutes,
  });

  if (accessSurcharge > 0) {
    cost += accessSurcharge;
    minutes += 10;
  }

  const roundedMinutes = Math.max(0, Math.round(minutes));
  const polygonCost = Math.max(0, Math.round(cost));
  const minMinutes = Math.round(YARD_LABOUR_MIN_HOURS * 60);
  const labourMinutes = Math.max(roundedMinutes, minMinutes);
  const labourFloor = Math.round((labourMinutes / 60) * yardLabourRate(opts.context));
  const finalCost = Math.max(polygonCost, labourFloor);
  return {
    minutes: roundedMinutes,
    cost: finalCost,
    labourFloor,
    polygonCost,
  };
}

function roundTo5(n: number) {
  return Math.round(n / 5) * 5;
}

function computeHomeMatrixPrice({
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

const CLEANING_HOME_MULTIPLIER_V2: Record<CleanScopeKindV2, number> = {
  weekly: 1.2,
  general: 1.2,
  inspection: 1.6,
  deep: 2.4,
  endoflease: 2.8,
  hourly: 1.0,
};

const CLEANING_HOME_MIN_HOURS_V2: Record<CleanScopeKindV2, number> = {
  weekly: 2.0,       // weekly clean preset
  general: 4.0,      // standard clean preset
  inspection: 3.0,
  deep: 5.0,         // deep clean preset
  endoflease: 6.0,   // move in/out preset
  hourly: 3.0,       // directed clean preset
};

function cleaningHomeMinutesV2(kind: CleanScopeKindV2, p: any): number {
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
function selectedFromParams(
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
    const bins = p.bins || 0;
    const packs = items > 0 ? Math.ceil(items / 4) : 0;

    if (scope === 'dump_runs' || scope === 'dump_delivery' || scope === 'dump_transport') {
      if (packs > 0) sel['dump.pack'] = packs;
      if (stops > 1) sel['dump.drive'] = stops - 1;
      if (items > 0) sel['dump.load'] = Math.max(0, items - Math.min(items, packs * 4));
      if (items > 0) sel['dump.sweep'] = Math.max(1, Math.ceil(items / 6));
    }
    if (scope === 'bin_cleans') {
      if (bins > 0) sel['dump.bin'] = bins;
    }
  }

  if (service === 'auto') {
    const size = p.vehicle_size || 0;
    const rows = p.rows || 0;
    const child = p.child_seats || 0;

    if (scope === 'auto_express' && size > 0) {
      sel['auto.wash'] = 1 + ([0, 0, 0, 1, 1][size - 1] || 0);
    }
    if (scope === 'auto_interior' && rows > 0) {
      sel['auto.interior'] = 1 + Math.max(0, rows - 2) + Math.max(0, Math.round(child * 0.5));
    }
    if (scope === 'auto_full' && rows > 0) {
      sel['auto.full'] = 1 + Math.max(0, rows - 2);
    }
  }

  if (service === 'sneakers') {
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
function clampUnitPrice(
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

function storeyMinutesMult(extraStoreys: number) {
  return 1 + Math.max(0, extraStoreys) * 0.08;
}
function halfExteriorBlend(mult: number) {
  return 1 + (mult - 1) * 0.5;
}
function taskConditionMult(code: string, flags: { petHair: boolean; greaseSoap: boolean; secondStorey: boolean }) {
  let m = 1;
  if (flags.petHair && (code === 'clean.vac' || code === 'auto.interior')) m *= 1.12;
  if (flags.greaseSoap && (code === 'clean.bath' || code === 'clean.kit' || code === 'window.track')) m *= 1.18;
  if (flags.secondStorey && code === 'window.pane_ext_solo') m *= 1.05;
  return m;
}

function hourlyRate(
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

function sneakerTurnaroundMeta(speed: SneakerTurnaround): SneakerTurnaroundMeta {
  return (
    SNEAKER_TURNAROUND_META.find((m) => m.key === speed) || SNEAKER_TURNAROUND_META[0]
  );
}

function sneakerPairsForTask(code: string): number {
  if (code === 'sneaker.lot') return 4; // average pairs per lot
  return 1;
}

function sneakerSurchargePerTask(code: string, speed: SneakerTurnaround): number {
  const meta = sneakerTurnaroundMeta(speed);
  const pairs = sneakerPairsForTask(code);
  return meta.surcharge * pairs;
}

function sneakerTurnaroundMultiplier(speed: SneakerTurnaround) {
  const found = SNEAKER_TURNAROUND.find((t) => t.key === speed);
  return found ? found.multiplier : 1;
}

type DumpTier = 'small' | 'medium' | 'large';

const DUMP_LOAD_META: Record<NonNullable<DumpRunSelection['loadType']>, { tier: DumpTier; volume: number }> = {
  ute: { tier: 'small', volume: 1.5 },
  trailer: { tier: 'medium', volume: 2.5 },
  bulky: { tier: 'large', volume: 2.0 },
};

const DUMP_DISPOSAL_FEES: Record<DumpTier, number> = {
  small: 15,
  medium: 34,
  large: 55,
};

const DUMP_WEIGHT_PRICING = {
  resident: { perTonne: 166, minimum: 55 },
  nonResident: { perTonne: 312, minimum: 197 },
} as const;

// Thresholds to fall back to weight-based pricing when the volume is clearly beyond typical loads.
const DUMP_WEIGHT_VOLUME_THRESHOLD_M3 = 6;
const DUMP_WEIGHT_LOAD_THRESHOLD = 4;
// Rough density assumption to convert cubic metres into tonnes for mixed household waste.
const DUMP_WEIGHT_DENSITY_T_PER_M3 = 0.18;

function computeDumpDisposalFee(
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

function priceQuote(params: QuoteParams) {
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
  sneakerTurnaround = 'standard',
  afterHours,
  bottleCount = 0,
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

  const SETUP_OVERHEAD = currentService === 'sneakers' ? 0 : 15;
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
  const ssMinutes = allCodes
    .filter((c) => c.startsWith('clean.ss.'))
    .reduce((acc, c) => acc + (selected[c] || 0), 0);
  minutes += ssMinutes;

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

    let pricePer = clampUnitPrice(task, context, { autoCategory, autoSizeCategory, autoYear });
    if (task.service === 'sneakers') {
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
  } else if (currentService === 'sneakers') {
    // Sneakers: outcome-based; no labour/time billing. Use unitSum only.
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

  const bottleCredit =
    currentService === 'dump' ? Math.min(afterDiscount, Math.max(0, bottleCount * 0.1)) : 0;
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

/* =========================
   STATE / REDUCER
   ========================= */

type WizardState = {
  step: 1 | 2 | 3;
  context: Context;
  service: ServiceType;
  scope: ScopeKey;
  paramsByService: Record<string, NumericParams>;
  cleaningAddons: Record<string, Record<string, number>>;
  distanceKm: number;
  paidParking: boolean;
  tipFee: number;
  dumpRun: DumpRunSelection;
  dumpDelivery: DeliverySelection;
  dumpTransport: TransportSelection;
  dumpRoutePickupQuery: string;
  dumpRouteDropoffQuery: string;
  dumpRoutePickup: RouteLocation | null;
  dumpRouteDropoff: RouteLocation | null;
  // --- Cleaning optimisers ---
  conditionLevel: 'light' | 'standard' | 'heavy';
  afterHours: boolean;

  // Adjustments
  sizeAdjust: 'small' | 'standard' | 'large';
  conditionFlat: 0 | 20 | 35 | 50;
  contractDiscount: 0 | 0.1 | 0.15;

  // Flags
  petHair: boolean;
  greaseSoap: boolean;
  clutterAccess: boolean;
  secondStorey: boolean;
  photosOK: boolean;
  yardMeasureRequested: boolean;
  // Commercial cleaning site flags
  commSecurityInduction: boolean;
  commClientConsumables: boolean;
  commPriorityNotes: string;
  commFrequency: CommFrequency;
  commPriorityZones: string[];
  commAccessNotes: string;
  commPreset: 'essential' | 'standard' | 'intensive';

  // Selected inclusions per scope (Step 2 badges/checklist)
  selectedInclusions: Record<string, string[]>;

  // Windows editor
  winStoreys: number;
  winRows: { int: number; ext: number; tracks: number; screens: number; label?: string }[];
  winSessionSeg: { int: boolean; ext: boolean; tracks: boolean } | null;

  // Context params
  commercialUplift: number;

  // Commercial cleaning type
  commercialCleaningType: CommercialCleaningType | null;

  // Customer details (Step 3 digital quote)
  fullName: string;
  email: string;
  phone: string;
  region: string;
  companyName: string;
  abn: string;
  isBusinessExpense: boolean;
  notes: string;

  // Yard polygon estimate
  yardPolygon: { lat: number; lng: number }[][];
  yardArea: number | null;
  yardPerimeter: number | null;
  yardJobs: YardJob[];
  yardActiveJobId: string | null;

  // Floor plan (home cleaning)
  floorPlanLayout: string; // serialized JSON
  floorPlanEstimate: FloorPlanPricing | null;

  // Car detailing 3D selector
  carModelType: CarType;
  carModelZones: CarZone[];
  carDirtLevel: number;
  carModelPriceImpact: number;
  carDetectedSizeCategory: VehicleSizeCategory | null;
  carDetectedYear: number | null;
  sneakerTurnaround: SneakerTurnaround;
};

type CleaningWizardChecklistState = {
  propertySize: 'studio' | '1-2' | '3-4' | '5+';
  bathrooms: 1 | 2 | 3;
  messLevel: 'tidy' | 'lived-in' | 'reset';
  addOns: { oven: boolean; fridge: boolean; windows: boolean; cupboards: boolean; walls: boolean };
  scope: ScopeKey;
};

function createYardJob(): YardJob {
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

type Action =
  | { type: 'set'; key: keyof WizardState; value: WizardState[keyof WizardState] }
  | { type: 'merge'; value: Partial<WizardState> }
  | { type: 'reset' };

function getInitialState(): WizardState {
  return {
    step: 1,
    context: 'home',
    service: 'windows',
    scope: 'windows_full',
    paramsByService: defaultParamsByService(),
    cleaningAddons: {},
    distanceKm: 0,
    paidParking: false,
    tipFee: 0,
    dumpRun: { ...DEFAULT_DUMP_RUN },
    dumpDelivery: { ...DEFAULT_DUMP_DELIVERY },
    dumpTransport: { ...DEFAULT_DUMP_TRANSPORT },
    dumpRoutePickupQuery: '',
    dumpRouteDropoffQuery: '',
    dumpRoutePickup: null,
    dumpRouteDropoff: null,
    conditionLevel: 'standard',
    afterHours: false,

    sizeAdjust: 'standard',
    conditionFlat: 0,
    contractDiscount: 0,

    petHair: false,
    greaseSoap: false,
    clutterAccess: false,
    secondStorey: false,
    photosOK: false,
  yardMeasureRequested: false,
  commSecurityInduction: false,
  commClientConsumables: false,
  commPriorityNotes: '',
  commFrequency: 'none',
  commPriorityZones: [],
  commAccessNotes: '',
  commPreset: 'essential',

  selectedInclusions: {},

  winStoreys: 1,
  winRows: [{ int: 12, ext: 12, tracks: 12, screens: 12, label: 'Ground' }],
  winSessionSeg: null,

  commercialUplift: 1,
  commercialCleaningType: null,

  fullName: '',
  email: '',
  phone: '',
  region: '',
  companyName: '',
  abn: '',
  isBusinessExpense: false,
  notes: '',

  // Yard polygon estimate
  yardPolygon: [],
  yardArea: null,
  yardPerimeter: null,
  yardJobs: [createYardJob()],
  yardActiveJobId: null,

  // Floor plan (home cleaning)
  floorPlanLayout: '',
  floorPlanEstimate: null,

  // Car detailing 3D selector
  carModelType: 'sedan',
  carModelZones: [],
  carDirtLevel: 0,
  carModelPriceImpact: 0,
  carDetectedSizeCategory: null,
  carDetectedYear: null,
  sneakerTurnaround: 'standard',
};
}

function wizardReducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'set':
      return { ...state, [action.key]: action.value } as WizardState;
    case 'merge':
      return { ...state, ...action.value };
    case 'reset':
      return getInitialState();
    default:
      return state;
  }
}

function useLocalStorageReducer<T>(key: string, reducer: React.Reducer<T, any>, init: () => T) {
  const [state, dispatch] = React.useReducer(reducer, undefined as any, init);
  useEffect(() => {
    if (RESET_ON_MOUNT) {
      try {
        localStorage.removeItem(key);
      } catch {}
      return;
    }
    try {
      const raw = localStorage.getItem(key);
      if (raw) dispatch({ type: 'merge', value: JSON.parse(raw) });
    } catch {}
  }, [key]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {}
    }, 200);
    return () => clearTimeout(id);
  }, [state, key]);
  return [state, dispatch] as const;
}

/* =========================
   HELPERS
   ========================= */

// ---- math / format ----
const sumSelected = (...bags: Selected[]) => {
  const out: Selected = {};
  for (const bag of bags)
    for (const [k, v] of Object.entries(bag)) out[k] = (out[k] || 0) + (v as number);
  return out;
};

function fmtHrMin(mins: number) {
  const m = Math.max(0, Math.round(Number.isFinite(mins) ? mins : 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h} hr${h > 1 ? 's' : ''} ${r} min${r > 1 ? 's' : ''}`;
  if (h) return `${h} hr${h > 1 ? 's' : ''}`;
  return `${r} min${r > 1 ? 's' : ''}`;
}

function fmtHrMinPretty(mins: number) {
  const m = Math.max(0, Math.round(Number.isFinite(mins) ? mins : 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  const hLabel = h === 1 ? 'hr' : 'hrs';
  const rLabel = r === 1 ? 'min' : 'mins';
  if (h && r) return `${h} ${hLabel} & ${r} ${rLabel}`;
  if (h) return `${h} ${hLabel}`;
  return `${r} ${rLabel}`;
}

// Compact version for inline UI (“~2h15m”)
function fmtHrMinCompact(mins: number) {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h}h${r ? `${r}m` : ''}` : `${r}m`;
}

const ESTIMATE_DISCLAIMER = 'Final timing and cost are confirmed before work begins.';
const BASE_CALLOUT_PRICE = 79;
const EFFORT_BLOCK_RANGE = { min: 20, max: 35, minutes: 20 };
const PHYSICAL_BLOCK_RANGE = { min: 25, max: 50 };
type TravelBand = DeliverySelection['distance'];
const TRAVEL_RANGES: Record<TravelBand, { min: number; max: number }> = {
  same_suburb: { min: 0, max: 0 },
  drive_30: { min: 30, max: 45 },
  drive_60: { min: 50, max: 70 },
  long: { min: 70, max: 110 },
};

type ServiceEstimate = {
  estimatedPrice: { min: number; max: number };
  estimatedTime: string;
  disclaimer: string;
};

function travelRange(key?: TravelBand | null, km?: number) {
  if (key && TRAVEL_RANGES[key]) return TRAVEL_RANGES[key];
  if (typeof km === 'number' && Number.isFinite(km)) {
    if (km <= 10) return TRAVEL_RANGES.same_suburb;
    if (km <= 30) return TRAVEL_RANGES.drive_30;
    if (km <= 60) return TRAVEL_RANGES.drive_60;
    return TRAVEL_RANGES.long;
  }
  return TRAVEL_RANGES.same_suburb;
}

function combinePricing(effortBlocks: number, physicalBlocks: number, travel: { min: number; max: number }) {
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

function calculateEstimatedPrice(serviceId: ScopeKey | string, wizardState: WizardState) {
  const scope = (serviceId || wizardState.scope) as ScopeKey;
  if (scope === 'dump_delivery') {
    const delivery = wizardState.dumpDelivery || DEFAULT_DUMP_DELIVERY;
    const effortMap: Record<NonNullable<DeliverySelection['itemType']>, number> = {
      parcel: 0,
      household: 1,
      mattress: 2,
      groceries: 1,
      tools: 1,
    };
    const effortBlocks = effortMap[delivery.itemType || 'parcel'] ?? 0;
    const physicalBlocks = delivery.assist === 'need_help' ? 1 : 0;
    const travel = travelRange(delivery.distance, wizardState.distanceKm);
    return combinePricing(effortBlocks, physicalBlocks, travel);
  }

  if (scope === 'dump_transport') {
    const transport = wizardState.dumpTransport || DEFAULT_DUMP_TRANSPORT;
    const sizeEffort: Record<TransportSelection['loadSize'], number> = {
      bags: 1,
      boot: 2,
      small_load: 3,
      full_move: 4,
    };
    const effortBlocks = sizeEffort[transport.loadSize] ?? 1;
    const physicalBlocks =
      transport.stairs === 'one'
        ? 1
        : transport.stairs === 'multi' || transport.stairs === 'no_lift'
        ? 2
        : 0;
    const travel = travelRange(null, wizardState.distanceKm);
    return combinePricing(effortBlocks, physicalBlocks, travel);
  }

  if (scope === 'dump_runs') {
    const dump = wizardState.dumpRun || DEFAULT_DUMP_RUN;
    const loads = clamp(Number.isFinite(dump.loads) ? dump.loads : 1, 1, 20);
    let effortBlocks = loads * 1.5;
    if (dump.loadType === 'trailer') effortBlocks += 1;
    const physicalBlocks = dump.loadType === 'bulky' ? 1 : 0;
    const travel = travelRange(null, wizardState.distanceKm);
    return combinePricing(effortBlocks, physicalBlocks, travel);
  }

  if (scope === 'bin_cleans') {
    const binsRaw = wizardState.paramsByService?.dump?.bins ?? 0;
    const bins = clamp(Math.round(binsRaw || 0), 1, 4);
    const bottleRaw = wizardState.paramsByService?.dump?.bottles ?? 0;
    const bottles = clamp(Math.round(bottleRaw || 0), 0, bins * 200);
    const perBinMin = bins * 25;
    const perBinMax = bins * 30;
    const bottleCredit = bottles * 0.1;
    const min = Math.max(0, Math.round(BASE_CALLOUT_PRICE + perBinMin - bottleCredit));
    const max = Math.max(min, Math.round(BASE_CALLOUT_PRICE + perBinMax - bottleCredit));
    return { min, max };
  }

  return null;
}

function calculateEstimatedTime(serviceId: ScopeKey | string, wizardState: WizardState): string | null {
  const scope = (serviceId || wizardState.scope) as ScopeKey;
  if (scope === 'dump_delivery') return '~1–1.5 hrs';
  if (scope === 'dump_transport') {
    const transport = wizardState.dumpTransport || DEFAULT_DUMP_TRANSPORT;
    if (transport.loadSize === 'full_move') return '~1–2 hrs (multiple loads likely)';
    return '~1.5 hrs';
  }
  if (scope === 'dump_runs') return '~40–80 mins onsite';
  if (scope === 'bin_cleans') return '~30 mins';
  return null;
}

function buildServiceEstimate(serviceId: ScopeKey | string, wizardState: WizardState): ServiceEstimate | null {
  const estimatedPrice = calculateEstimatedPrice(serviceId, wizardState);
  const estimatedTime = calculateEstimatedTime(serviceId, wizardState);
  if (!estimatedPrice || !estimatedTime) return null;
  return { estimatedPrice, estimatedTime, disclaimer: ESTIMATE_DISCLAIMER };
}

// ---- badge-based time adjustments ----
const INCLUSION_MINUTES: Record<string, number> = {
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

type SelMap = Record<string, string[]>;

function badgeMinutesForScope(S: WizardState, scopeKey: string): number {
  const selected = (S as any).selectedInclusions as SelMap | undefined;
  const picked = selected?.[scopeKey] ?? [];
  return picked.reduce((sum, label) => sum + (INCLUSION_MINUTES[label] ?? 0), 0);
}

/**
 * Internal helper: build a full priceQuote for a given service/scope
 * using the *current wizard state*.
 *
 * - For the active card (S.service + S.scope) we use the live sliders
 *   from S.paramsByService.
 * - For other cards we fall back to the scope preset so they still show
 *   a sensible "typical" time.
 */
function estimateForScope(
  S: WizardState,
  service: ServiceType,
  scopeKey: ScopeKey
): ReturnType<typeof priceQuote> | null {
  const context = S.context;

  // Base params for this service from state
  const paramsFromState = (S.paramsByService as any)[service] ?? {};

  // When this card is the active selection, use real sliders;
  // otherwise seed from default+scope preset so it still has a value.
  let params: Record<string, number>;
  if (service === 'windows') {
    // Keep window cards stable by always using their presets here
    const defaults = defaultParamsByService() as any;
    const base = defaults[service] ?? {};
    const preset = scopePresetFor(service, scopeKey, context) || {};
    params = { ...base, ...preset };
  } else if (service === S.service && scopeKey === S.scope) {
    params = { ...paramsFromState };
  } else {
    const defaults = defaultParamsByService() as any;
    const base = defaults[service] ?? {};
    const preset = scopePresetFor(service, scopeKey, context) || {};
    params = { ...base, ...preset };
  }

  // Selected line items for this scope
  let windowsOverrideTotals: { panes_int: number; panes_ext: number; tracks: number; screens: number } | undefined;
  let windowsStoreys = 1;
  let windowsRowsForScope: WizardState['winRows'] | undefined;

  if (service === 'windows') {
    // Always use live rows so cards, editor, and totals share the same inputs
    windowsRowsForScope = S.winRows;

    const totals = (windowsRowsForScope || []).reduce(
      (acc, r) => {
        acc.panes_int += Math.max(0, r.int || 0);
        acc.panes_ext += Math.max(0, r.ext || 0);
        acc.tracks += Math.max(0, r.tracks || 0);
        acc.screens += context === 'commercial' ? 0 : Math.max(0, r.screens || 0);
        return acc;
      },
      { panes_int: 0, panes_ext: 0, tracks: 0, screens: 0 }
    );
    windowsOverrideTotals = totals;
    windowsStoreys = windowsRowsForScope?.length || 1;
  }

  if (service === 'yard') {
    params = { ...params, yard_area: S.yardArea ?? (params as any).yard_area };
  }

  const mergedParams =
    service === 'cleaning'
      ? { ...params, ...(S.cleaningAddons[scopeKey] || {}) }
      : params;

  const selected = selectedFromParams(
    service,
    scopeKey,
    mergedParams,
    { secondStorey: S.secondStorey },
    windowsOverrideTotals,
    context,
    S.commercialCleaningType ?? undefined
  );

  const hasSelected = Object.values(selected).some((v) => (v || 0) > 0);
  const allowDumpDisposalOnly = service === 'dump' && scopeKey === 'dump_runs';
  if (!hasSelected && !allowDumpDisposalOnly) return null;

  // Windows storeys – prefer live state if present
  const windowsStoreysParam = service === 'windows' ? windowsStoreys : 1;

  // Condition multiplier from S.conditionLevel
  const conditionMult =
    S.conditionLevel === 'light' ? 0.9 : S.conditionLevel === 'heavy' ? 1.18 : 1;

  const autoSizeCategory =
    AUTO_SIZE_CATEGORIES.includes(S.carModelType as VehicleSizeCategory)
      ? (S.carModelType as VehicleSizeCategory)
      : S.carDetectedSizeCategory ?? null;

  const estimate = priceQuote({
    context,
    currentService: service,
    currentScope: scopeKey,
    selected,
    distanceKm: S.distanceKm,
    paidParking: S.paidParking,
    tipFee: S.tipFee,
    conditionMult,
    conditionLevel: S.conditionLevel,
    flags: {
      petHair: S.petHair,
      greaseSoap: S.greaseSoap,
      clutterAccess: S.clutterAccess,
      secondStorey: S.secondStorey,
    },
    windowsStoreys: windowsStoreysParam,
    commercialUplift: S.commercialUplift,
    sizeAdjust: S.sizeAdjust,
    conditionFlat: S.conditionFlat,
    contractDiscount: S.contractDiscount,
    commercialType: S.commercialCleaningType ?? null,
    afterHours: S.afterHours,
    bottleCount: service === 'dump' ? Number((params as any).bottles ?? 0) : 0,
    dumpRunSelection: service === 'dump' ? S.dumpRun : undefined,
    cleaningParams:
      service === 'cleaning'
        ? { ...params, ...(S.cleaningAddons[scopeKey] || {}) }
        : undefined,
    yardParams: service === 'yard' ? params : undefined,
    windowsMinutesOverride:
      service === 'windows' && windowsRowsForScope
        ? computeWindowsMinutes(scopeKey, windowsRowsForScope, context, S.paramsByService.windows)
        : undefined,
    windowsStoreysOverride: service === 'windows' ? windowsStoreysParam : undefined,
    autoCategory: S.carModelType,
    autoSizeCategory,
    autoYear: S.carDetectedYear,
    sneakerTurnaround: S.sneakerTurnaround,
  } as QuoteParams);

  return estimate;
}

function findServiceForScope(scopeKey: ScopeKey): ServiceType | null {
  for (const [svc, scopes] of Object.entries(SCOPES_BY_SERVICE) as [ServiceType, ScopeDef[]][]) {
    if (scopes.some((s) => s.key === scopeKey)) return svc;
  }
  return null;
}

function calculateServicePrice(serviceId: ScopeKey | string, wizardState: WizardState) {
  const scopeKey = (serviceId || wizardState.scope) as ScopeKey;
  const targetService = (findServiceForScope(scopeKey) ?? wizardState.service) as ServiceType;
  const estimate = estimateForScope(wizardState, targetService, scopeKey);
  const price = estimate ? Math.max(0, Math.round(estimate.total || 0)) : 0;
  return {
    price,
    disclaimer: PRICE_SCOPE_DISCLAIMER,
  };
}

function computeScopeMinutes(S: WizardState, service: ServiceType, scopeKey: ScopeKey): number {
  // Windows: always use live rows
  if (service === 'windows') {
    return computeWindowsMinutes(scopeKey, S.winRows, S.context, S.paramsByService.windows);
  }
  if (service === 'sneakers') return 0;

  // Cleaning – commercial
  if (service === 'cleaning' && S.context === 'commercial') {
    const kind = S.commercialCleaningType ?? 'office';
    return Math.round((COMM_CLEAN_MIN_HOURS[kind] ?? 1) * 60);
  }

  // Cleaning – home
  if (service === 'cleaning' && S.context === 'home') {
    if (scopeKey === 'hourly') {
      const params =
        scopeKey === S.scope
          ? { ...(S.paramsByService.cleaning || {}), ...(S.cleaningAddons[S.scope] || {}) }
          : { ...(defaultParamsByService().cleaning || {}), ...(scopePresetFor('cleaning', scopeKey, S.context) || {}), ...(S.cleaningAddons[scopeKey] || {}) };
      return (params.hours || 3) * 60;
    }
    const params =
      scopeKey === S.scope
        ? { ...(S.paramsByService.cleaning || {}), ...(S.cleaningAddons[S.scope] || {}) }
        : { ...(defaultParamsByService().cleaning || {}), ...(scopePresetFor('cleaning', scopeKey, S.context) || {}), ...(S.cleaningAddons[scopeKey] || {}) };
    const extras = computeHomeExtras(scopeKey, params);
    const addOns = computeCleaningAddons(scopeKey, params);
    return extras.baseMinutes + extras.extraMinutes + addOns.minutes;
  }

  // Yard
  if (service === 'yard') {
    const params =
      scopeKey === S.scope
        ? S.paramsByService.yard || {}
        : {
            ...(defaultParamsByService().yard || {}),
            ...(scopePresetFor('yard', scopeKey, S.context) || {}),
          };
    const paramsWithArea = {
      ...params,
      yard_area: S.yardArea ?? (params as any).yard_area,
    };
    const yardCondMap: Record<'light' | 'standard' | 'heavy', number> = {
      light: 0.9,
      standard: 1,
      heavy: 1.18,
    };
    const yard = computeYardQuote(paramsWithArea, {
      scope: scopeKey,
      isTwoStoreyGutter: S.secondStorey,
      conditionMultiplier: yardCondMap[S.conditionLevel] ?? 1,
      accessTight: S.clutterAccess,
      conditionLevel: S.conditionLevel,
    });
    return yard.minutes;
  }

  // Auto (home): fixed package minutes
  if (service === 'auto') {
    const map: Record<ScopeKey, number> = {
      auto_express: 120,
      auto_interior: 120,
      auto_full: 240,
    };
    if (map[scopeKey] != null) return map[scopeKey];
  }

  // Fallback: use estimateForScope minutes
  const est = estimateForScope(S, service, scopeKey);
  return est ? est.minutes || 0 : 0;
}

/**
 * "Typical minutes" for a service/scope, driven by the same engine that
 * powers the bottom estimate card and Step 3.
 *
 * This is what you should use for the "Typical: 1 hr 30 mins" chip on
 * each card.
 */
function scopeTypicalMinutes(
  S: WizardState,
  service: ServiceType,
  scopeKey: ScopeKey
): number {
  return computeScopeMinutes(S, service, scopeKey);
}

function adjustedTypicalMinutes(
  S: WizardState,
  svc: ServiceType,
  scopeKey: string
): number {
  const base = scopeTypicalMinutes(S, svc, scopeKey as ScopeKey);
  const delta = badgeMinutesForScope(S, scopeKey);
  return Math.max(0, base + delta);
}

function extraMinutesFromBadges(S: WizardState): number {
  if (!S.scope) return 0;
  return badgeMinutesForScope(S, S.scope);
}

// ---- window timing ----
function typicalMinutesForWindowsRows(rows: StoreyRow[]) {
  const totalPanes = rows.reduce((a, r) => a + r.int + r.ext, 0);
  const storeys = rows.length || 1;
  if (totalPanes === 0) return 0;
  const refPanes = storeys * 24;
  const mins = (totalPanes / refPanes) * (storeys * WINDOWS_BASE_PER_STOREY_MIN);
  return Math.round(mins);
}

// ---- feedback toasts ----
const notifyDelta = (prevMin: number, nextMin: number) => {
  const diff = Math.round(nextMin - prevMin);
  if (!diff) return;
  const word = diff > 0 ? 'more' : 'fewer';
  const abs = Math.abs(diff);
  const label = abs === 1 ? 'minute' : 'minutes';
  toast.message(`~${abs} ${word} ${label}`);
};

// ---- quote summary / email ----
function buildQuoteSummary(
  S: WizardState,
  estimate: ReturnType<typeof priceQuote>,
  scopedPrice?: { price: number; disclaimer: string }
) {
  const ctxLabel = S.context[0].toUpperCase() + S.context.slice(1);
  const svc = SERVICES.find((x) => x.key === S.service)?.label ?? S.service;
  const scope = SCOPES_BY_SERVICE[S.service].find((s) => s.key === S.scope)?.label ?? S.scope;
  const parts: string[] = [];

  parts.push(`Digital Quote — ${new Date().toLocaleDateString('en-AU')}`);
  parts.push(`Context: ${ctxLabel}`);
  parts.push(`Service: ${svc}`);
  if (S.context === 'commercial' && S.service === 'cleaning' && S.commercialCleaningType)
    parts.push(`Commercial cleaning type: ${S.commercialCleaningType}`);
  else parts.push(`Scope: ${scope}`);
  parts.push('');
  const estimateLine = `${fmtAUD(scopedPrice?.price ?? estimate.total)} (${fmtHrMin(estimate.minutes)})`;
  parts.push(`Estimate: ${estimateLine}`);
  if (estimate.hourlyUsed) parts.push(`Hourly rate used: ${fmtAUD(estimate.hourlyUsed)}/hr`);
  if (estimate.labourFloor) parts.push(`Labour floor: ${fmtAUD(estimate.labourFloor)}`);
  parts.push(`Per-item subtotal: ${fmtAUD(estimate.unitSum)}`);
  parts.push(`After size/condition/contract: ${fmtAUD(estimate.baseBeforeFees)}`);
  if (estimate.travel || estimate.parking || estimate.tip)
    parts.push(
      `Travel/Parking/Tip: ${fmtAUD(estimate.travel + estimate.parking + estimate.tip)}`
    );
  parts.push(`Confidence: ${estimate.confidence}`);
  const params = S.paramsByService[S.service] || {};
  const paramLine = Object.entries(params)
    .filter(([, v]) => Number(v) > 0)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
  if (paramLine) parts.push('Details: ' + paramLine);
  parts.push('');
  parts.push(
    `Customer: ${S.fullName || '—'}${S.companyName ? ` · ${S.companyName}` : ''}${
      S.abn ? ` (ABN ${S.abn})` : ''
    }`
  );
  parts.push(`Contact: ${S.email || '—'} · ${S.phone || '—'}`);
  parts.push(`Region: ${S.region || '—'}`);
  if (S.notes) parts.push(`Notes: ${S.notes}`);
  if (S.yardMeasureRequested) parts.push(`Measurement requested for yard/area.`);
  parts.push('');
  if (scopedPrice) parts.push('Price note: ' + scopedPrice.disclaimer);
  parts.push('Disclaimer: ' + TERMS_SNIPPET);
  parts.push('Fairness: ' + FAIRNESS_PROMISE_COPY);
  parts.push('This quote can be used for reimbursement/business expense purposes.');
  return parts.join('\n');
}

function emailHrefForContext(S: WizardState, body: string) {
  const subject = encodeURIComponent(`Quote request – ${S.context} / ${S.service}`);
  return `mailto:budsatwork@malucare.org?subject=${subject}&body=${encodeURIComponent(body)}`;
}

// ---- a11y / keyboard helper ----
const asButtonProps = (onActivate: () => void, ariaLabel: string) => ({
  role: 'button' as const,
  tabIndex: 0,
  'aria-label': ariaLabel,
  onClick: onActivate,
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onActivate();
    }
  },
});

// ---- glass primitives ----
const GlassCard = ({ className = '', children }: { className?: string; children: React.ReactNode }) => (
  <div
    className={cls(
      'rounded-2xl p-5 border border-white/40 bg-white/60 backdrop-blur-2xl shadow-[0_10px_30px_rgba(2,6,23,0.10)]',
      className
    )}
  >
    {children}
  </div>
);

const KPI = ({ label, value, foot }: { label: string; value: string; foot?: string }) => (
  <div className="rounded-xl border border-white/50 bg-white/70 px-4 py-3 text-slate-900">
    <div className="text-[11px] uppercase tracking-wide text-slate-600">{label}</div>
    <div className="text-xl font-semibold mt-0.5">{value}</div>
    {foot ? <div className="text-[11px] text-slate-600 mt-0.5">{foot}</div> : null}
  </div>
);

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-white/70 border border-white/50 text-slate-800">
    {children}
  </span>
);

const Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <div className="flex items-center justify-between">
    <div className={cls('text-sm', bold ? 'font-medium text-slate-900' : 'text-slate-600')}>{k}</div>
    <div className={cls('text-sm', bold ? 'font-semibold text-slate-900' : 'text-slate-800')}>{v}</div>
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm font-medium text-slate-900">{children}</div>
);

const Caret = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" className="opacity-70">
    <path
      d={open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ===== Minimal S3_* components (Step 3 sidebar/form) ===== */
const S3_Card = ({ className = '', children }: { className?: string; children: React.ReactNode }) => (
  <div className={cls('rounded-2xl p-4 border border-black/10 bg-white/80', className)}>{children}</div>
);

const S3_Title = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm font-medium text-slate-900">{children}</div>
);

const S3_Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <div className="flex items-center justify-between py-1">
    <div className={cls('text-sm', bold ? 'font-medium text-slate-900' : 'text-slate-600')}>{k}</div>
    <div className={cls('text-sm', bold ? 'font-semibold text-slate-900' : 'text-slate-800')}>{v}</div>
  </div>
);

const S3_Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-white/80 border border-white/40 text-slate-800">
    {children}
  </span>
);

type DistanceConfiguratorProps = {
  S: WizardState;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  routeLookup: RouteLookupResult | null;
  routeLookupLoading: boolean;
  routeLookupMessage: string | null;
  routeDistanceLabel: string | null;
  onFocusChange?: (focused: boolean) => void;
  onPlaceSelected?: () => void;
};

const DistanceRouteConfigurator = React.memo(function DistanceRouteConfigurator({
  S,
  set,
  routeLookup,
  routeLookupLoading,
  routeLookupMessage,
  routeDistanceLabel,
  onFocusChange,
  onPlaceSelected,
}: DistanceConfiguratorProps) {
  const pickupInputRef = React.useRef<HTMLInputElement | null>(null);
  const dropoffInputRef = React.useRef<HTMLInputElement | null>(null);
  const pickupAutocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);
  const dropoffAutocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);
  const pickupListenerRef = React.useRef<google.maps.MapsEventListener | null>(null);
  const dropoffListenerRef = React.useRef<google.maps.MapsEventListener | null>(null);
  const [mapsReady, setMapsReady] = React.useState(false);
  const [mapsError, setMapsError] = React.useState<string | null>(null);
  const [pickupError, setPickupError] = React.useState<string | null>(null);
  const [dropoffError, setDropoffError] = React.useState<string | null>(null);
  const [inputs, setInputs] = React.useState({
    pickup: S.dumpRoutePickupQuery,
    dropoff: S.dumpRouteDropoffQuery,
  });
  const focusChangeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFocusChange = React.useCallback(
    (focused: boolean, delay = 0) => {
      if (!onFocusChange || typeof window === 'undefined') return;
      if (focusChangeTimerRef.current) {
        clearTimeout(focusChangeTimerRef.current);
      }
      focusChangeTimerRef.current = window.setTimeout(() => {
        onFocusChange(focused);
        focusChangeTimerRef.current = null;
      }, delay);
    },
    [onFocusChange]
  );

  React.useEffect(
    () => () => {
      if (focusChangeTimerRef.current) {
        clearTimeout(focusChangeTimerRef.current);
      }
    },
    []
  );

  React.useEffect(() => {
    setInputs((prev) => ({ ...prev, pickup: S.dumpRoutePickupQuery }));
  }, [S.dumpRoutePickupQuery]);

  React.useEffect(() => {
    setInputs((prev) => ({ ...prev, dropoff: S.dumpRouteDropoffQuery }));
  }, [S.dumpRouteDropoffQuery]);

  const handleInputChange = React.useCallback((target: 'pickup' | 'dropoff', value: string) => {
    setInputs((prev) => ({ ...prev, [target]: value }));
    if (target === 'pickup') setPickupError(null);
    else setDropoffError(null);
  }, []);

  const handlePlaceSelection = React.useCallback(
    (target: 'pickup' | 'dropoff') => {
      const autocomplete =
        target === 'pickup' ? pickupAutocompleteRef.current : dropoffAutocompleteRef.current;
      if (!autocomplete) return;
      const place = autocomplete.getPlace();
      const formatted = place?.formatted_address?.trim();
      const location = place?.geometry?.location;
      if (!formatted || !location) return;
      if (!isQueenslandPlace(place)) {
        const message = 'Choose an address within Queensland.';
        if (target === 'pickup') {
          setPickupError(message);
        } else {
          setDropoffError(message);
        }
        return;
      }
      const nextLocation: RouteLocation = {
        address: formatted,
        lat: location.lat(),
        lng: location.lng(),
        placeId: place.place_id ?? undefined,
      };
      const queryKey: 'dumpRoutePickupQuery' | 'dumpRouteDropoffQuery' =
        target === 'pickup' ? 'dumpRoutePickupQuery' : 'dumpRouteDropoffQuery';
      const locationKey: 'dumpRoutePickup' | 'dumpRouteDropoff' =
        target === 'pickup' ? 'dumpRoutePickup' : 'dumpRouteDropoff';
      set(locationKey, nextLocation);
      set(queryKey, formatted);
      setInputs((prev) => ({ ...prev, [target]: formatted }));
      if (target === 'pickup') setPickupError(null);
      else setDropoffError(null);
      onPlaceSelected?.();
      triggerFocusChange(false, 100);
    },
    [set, onPlaceSelected, triggerFocusChange]
  );

  React.useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setMapsError('Autocomplete disabled until a Google Maps key is configured.');
      return;
    }
    let cancelled = false;
    loadGoogleMapsOnce({ apiKey: GOOGLE_MAPS_API_KEY, libraries: ['places'] })
      .then(() => {
        if (!cancelled) {
          setMapsReady(true);
          setMapsError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('Delivery autocomplete failed to load', err);
          setMapsError('Address suggestions unavailable right now.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!mapsReady) return;
    if (typeof window === 'undefined') return;
    const googleLib = window.google;
    if (!googleLib?.maps?.places) {
      setMapsError('Address suggestions unavailable.');
      return;
    }
    const bounds = new googleLib.maps.LatLngBounds(
      new googleLib.maps.LatLng(QLD_BOUNDS.south, QLD_BOUNDS.west),
      new googleLib.maps.LatLng(QLD_BOUNDS.north, QLD_BOUNDS.east)
    );

    const attachAutocomplete = (
      target: 'pickup' | 'dropoff',
      inputRef: React.MutableRefObject<HTMLInputElement | null>,
      listenerRef: React.MutableRefObject<google.maps.MapsEventListener | null>,
      autocompleteRef: React.MutableRefObject<google.maps.places.Autocomplete | null>
    ) => {
      if (!inputRef.current) return;
      const autocomplete = new googleLib.maps.places.Autocomplete(inputRef.current, {
        fields: ['formatted_address', 'geometry', 'address_components', 'place_id'],
        types: ['geocode'],
        componentRestrictions: { country: ['au'] },
        bounds,
        strictBounds: false,
      });
      autocompleteRef.current = autocomplete;
      listenerRef.current?.remove();
      listenerRef.current = autocomplete.addListener('place_changed', () => {
        handlePlaceSelection(target);
      });
    };

    attachAutocomplete('pickup', pickupInputRef, pickupListenerRef, pickupAutocompleteRef);
    attachAutocomplete('dropoff', dropoffInputRef, dropoffListenerRef, dropoffAutocompleteRef);

    return () => {
      pickupListenerRef.current?.remove();
      dropoffListenerRef.current?.remove();
      pickupAutocompleteRef.current = null;
      dropoffAutocompleteRef.current = null;
    };
  }, [mapsReady, handlePlaceSelection]);

  const summaryText = routeLookupLoading
    ? 'Calculating travel time…'
    : routeDistanceLabel ?? 'Add both addresses to see travel info.';

  return (
    <div
      className="rounded-2xl border border-black/10 bg-white/80 p-4 space-y-3 mt-4"
      style={{ overflow: 'visible' }}
    >
      <div>
        <div className="text-sm font-semibold text-slate-900">Distance-based pricing</div>
        <div className="text-xs text-slate-600">Driving distances are auto-calculated for QLD drop-offs.</div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-700">
          Pickup location
          <input
            ref={pickupInputRef}
            type="text"
            value={inputs.pickup}
            placeholder="Start address (Queensland only)"
            onChange={(e) => handleInputChange('pickup', e.target.value)}
            onFocus={() => triggerFocusChange(true)}
            onBlur={() => triggerFocusChange(false, 150)}
            className="mt-1 w-full rounded-2xl border border-black/10 px-3 py-2 text-sm text-slate-900 focus:border-[color:var(--accent)] focus:ring-[color:var(--accent)] focus:ring-1"
          />
        </label>
        {pickupError && <div className="text-[11px] text-rose-500">{pickupError}</div>}
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-700">
          Drop-off location
          <input
            ref={dropoffInputRef}
            type="text"
            value={inputs.dropoff}
            placeholder="Drop-off address (Queensland only)"
            onChange={(e) => handleInputChange('dropoff', e.target.value)}
            onFocus={() => triggerFocusChange(true)}
            onBlur={() => triggerFocusChange(false, 150)}
            className="mt-1 w-full rounded-2xl border border-black/10 px-3 py-2 text-sm text-slate-900 focus:border-[color:var(--accent)] focus:ring-[color:var(--accent)] focus:ring-1"
          />
        </label>
        {dropoffError && <div className="text-[11px] text-rose-500">{dropoffError}</div>}
      </div>

      <div
        className="p-3 rounded-2xl border border-dashed border-black/20 text-xs text-slate-700 bg-slate-50"
        aria-live="polite"
      >
        {summaryText}
      </div>
      {routeLookupMessage && <div className="text-[11px] text-amber-700">{routeLookupMessage}</div>}
      {mapsError && <div className="text-[11px] text-rose-500">{mapsError}</div>}
    </div>
  );
});

/* =========================
   MAIN PAGE/* =========================
   MAIN PAGE (opens here; make sure it closes at EOF)
   ========================= */

/**
 * Minimal LiveOrdersStrip placeholder used in multiple steps.
 * Keeps the UI informative and prevents "Cannot find name" errors.
 */
const LIVE_ORDER_ITEMS = [
  { label: 'Window clean', price: '$120', detail: '12 windows washed', icon: <WindowIcon /> },
  { label: 'Deep clean', price: '$380', detail: 'Tidy 2 bed · 2 bath', icon: <CleanIcon /> },
  { label: 'Mow & edge', price: '$140', detail: 'Mow + tidy edges', icon: <LawnIcon /> },
  { label: 'Bin clean', price: '$80', detail: '2 bins scrubbed', icon: <TruckIcon /> },
] as const;

function LiveOrdersStrip({ className = '' }: { className?: string }) {
  return (
    <div
      className={cls(
        'relative rounded-3xl border border-white/70 bg-white/65 backdrop-blur-3xl shadow-[0_18px_40px_rgba(15,23,42,0.08)]',
        'p-5 sm:p-6 overflow-hidden',
        className
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 rounded-t-3xl"
        style={{ background: `linear-gradient(90deg, ${ACCENT}, #22c55e)` }}
        aria-hidden
      />
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <div className="text-base font-semibold text-slate-900 leading-tight tracking-tight">
            What others ordered
          </div>
          <div className="text-[12px] text-slate-600 mt-0.5">
            Quick inspiration you can add in steps 1–3.
          </div>
        </div>
        <div className="hidden sm:inline-flex items-center gap-2 text-[11px] text-slate-600 px-3 py-1 rounded-full border border-white/60 bg-white/75">
          <span aria-hidden>●</span>
          <span>Live now</span>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1" aria-label="Recently ordered services">
        {LIVE_ORDER_ITEMS.map((item) => (
          <div
            key={item.label}
            className={cls(
              'min-w-[190px] rounded-2xl border border-white/70 bg-white/75 backdrop-blur-2xl p-3.5',
              'shadow-[0_12px_30px_rgba(15,23,42,0.08)] hover:shadow-[0_16px_38px_rgba(15,23,42,0.12)] transition-all transform hover:-translate-y-[1px]'
            )}
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="shrink-0 text-slate-800 grid place-items-center h-10 w-10 rounded-2xl bg-white/80 border border-white/70 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
              >
                {item.icon}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{item.label}</div>
                <div className="mt-0.5 text-xs text-slate-600 truncate">{item.detail}</div>
              </div>
            </div>

            <div className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-900 bg-white/90 px-2.5 py-1 rounded-full border border-white/70">
              <span aria-hidden className="text-[color:var(--accent)]">→</span>
              <span>{item.price}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================
   WindowsEditor — FIXED + NO CONFLICT + LOCKED PRESETS
   ========================================================== */
function WindowsEditor({
  S,
  set,
  notifyDelta,
}: {
  S: WizardState;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  notifyDelta: (prevMin: number, nextMin: number) => void;
}) {
  const isCommercial = S.context === 'commercial';
  const announceId = React.useId();

  type Mode = 'both' | 'inside' | 'outside' | 'tracks';

  const currentMode: Mode = React.useMemo(() => {
    if (S.scope === 'windows_interior') return 'inside';
    if (S.scope === 'windows_exterior') return 'outside';
    if (S.scope === 'windows_tracks') return 'tracks';
    return 'both';
  }, [S.scope]);

  const scopeFromMode: Record<Mode, ScopeKey> = {
    both: 'windows_full',
    inside: 'windows_interior',
    outside: 'windows_exterior',
    tracks: 'windows_tracks',
  };

  const presetRowForMode = (mode: Mode, index = 0): WizardState['winRows'][number] => {
    const base = {
      both: { int: 12, ext: 12, tracks: 12, screens: isCommercial ? 0 : 12 },
      inside: { int: 12, ext: 0, tracks: 12, screens: 0 },
      outside: { int: 0, ext: 12, tracks: 0, screens: isCommercial ? 0 : 12 },
      tracks: { int: 0, ext: 0, tracks: 12, screens: isCommercial ? 0 : 12 },
    }[mode];
    const label = isCommercial
      ? index === 0
        ? 'Ground'
        : `Level ${index}`
      : index === 0
      ? 'Ground floor'
      : index === 1
      ? 'Second floor'
      : 'Third floor';
    return { ...base, label };
  };

  const segmentForMode = (mode: Mode) => {
    switch (mode) {
      case 'inside':
        return { int: true, ext: false, tracks: true };
      case 'outside':
        return { int: false, ext: true, tracks: false };
      case 'tracks':
        return { int: false, ext: false, tracks: true };
      default:
        return { int: true, ext: true, tracks: true };
    }
  };

  const toCount = (v: string | number) => Math.max(0, Math.floor(Number(v) || 0));
  const rows = S.winRows;

  const minutes = React.useMemo(
    () => computeWindowsMinutes(S.scope, rows, S.context, S.paramsByService.windows),
    [rows, S.context, S.scope, S.paramsByService.windows]
  );

  const replaceRows = (nextRows: WizardState['winRows'], nextScope?: ScopeKey, nextSeg?: { int: boolean; ext: boolean; tracks: boolean }) => {
    const trimmedRows = isCommercial ? nextRows : nextRows.slice(0, 3);
    const before = computeWindowsMinutes(S.scope, rows, S.context, S.paramsByService.windows);
    const after = computeWindowsMinutes(
      nextScope ?? S.scope,
      trimmedRows,
      S.context,
      S.paramsByService.windows
    );

    if (nextScope) set('scope', nextScope);
    if (nextSeg) set('winSessionSeg', nextSeg);
    set('winRows', trimmedRows);
    set('winStoreys', trimmedRows.length);
    notifyDelta(before, after);
  };

  const applyMode = (mode: Mode) => {
    const seg = segmentForMode(mode);
    const nextRows = [presetRowForMode(mode, 0)];
    replaceRows(nextRows, scopeFromMode[mode], seg);
  };

  const addLevel = () => {
    const next = [...rows, presetRowForMode(currentMode, rows.length)];
    replaceRows(next);
  };

  const removeLevel = () => {
    if (rows.length <= 1) return;
    replaceRows(rows.slice(0, -1));
  };

  const updateRowValue = (rowIndex: number, key: 'int' | 'ext' | 'tracks' | 'screens', value: string | number) => {
    const next = rows.map((r, idx) => (idx === rowIndex ? { ...r, [key]: toCount(value) } : r));
    replaceRows(next);
  };

  const showInside = currentMode === 'both' || currentMode === 'inside';
  const showOutside = currentMode === 'both' || currentMode === 'outside';
  const showTracks = currentMode !== 'outside';
  const showScreens = !isCommercial && (currentMode === 'both' || currentMode === 'outside');

  const labelForRow = (rowIndex: number) => {
    if (isCommercial) return rowIndex === 0 ? 'Ground' : `Level ${rowIndex}`;
    if (rowIndex === 0) return 'Ground Floor';
    if (rowIndex === 1) return 'Second Floor';
    return 'Third Floor';
  };

  const displayRows = (isCommercial ? rows : [...rows].reverse()).map((row, index) => {
    const sourceIndex = isCommercial ? index : rows.length - 1 - index;
    return { row, sourceIndex };
  });

  const columnCount = 1 + Number(showInside) + Number(showOutside) + Number(showTracks) + Number(showScreens) + 1; // +1 for actions
  const gridTemplate = { gridTemplateColumns: `repeat(${columnCount}, minmax(0,1fr))` } as const;

  const Chip = ({
    label,
    pressed,
    onClick,
  }: {
    label: string;
    pressed: boolean;
    onClick: () => void;
  }) => (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={
        'px-2.5 py-1 rounded-lg border text-xs ' +
        (pressed
          ? 'bg-white border-emerald-600 text-emerald-700'
          : 'bg-white/70 border-slate-300 text-slate-700 hover:bg-white')
      }
    >
      {label}
    </button>
  );

  const allowedModes: Mode[] = React.useMemo(() => {
    switch (S.scope) {
      case 'windows_interior':
        return ['inside'];
      case 'windows_exterior':
        return ['outside'];
      case 'windows_tracks':
        return ['tracks'];
      case 'windows_full':
        return ['both'];
      default:
        return ['both', 'inside', 'outside', 'tracks'];
    }
  }, [S.scope]);

  return (
    <section aria-label="Windows editor" className="rounded-2xl p-4 bg-white/80 border border-black/10">
      <div id={announceId} className="sr-only" aria-live="polite">
        {rows.length} levels. {fmtHrMin(minutes)}.
      </div>

      <header className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Mode" className="flex items-center gap-2">
          {allowedModes.includes('both') && (
            <Chip label="All" pressed={currentMode === 'both'} onClick={() => applyMode('both')} />
          )}
          {allowedModes.includes('inside') && (
            <Chip label="Inside" pressed={currentMode === 'inside'} onClick={() => applyMode('inside')} />
          )}
          {allowedModes.includes('outside') && (
            <Chip label="Outside" pressed={currentMode === 'outside'} onClick={() => applyMode('outside')} />
          )}
          {allowedModes.includes('tracks') && (
            <Chip label="Tracks" pressed={currentMode === 'tracks'} onClick={() => applyMode('tracks')} />
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1" aria-label="Levels">
            <button
              type="button"
              className="px-2 py-1 rounded-md border border-slate-300"
              onClick={removeLevel}
              aria-label="Decrease levels"
              disabled={rows.length <= 1}
            >
              −
            </button>
            <span className="text-sm px-2 py-1 rounded-md border border-slate-300 bg-white">{rows.length}</span>
            <button
              type="button"
              className={cls(
                'px-2 py-1 rounded-md border border-slate-300',
                !isCommercial && rows.length >= 3 ? 'opacity-50 blur-[1px] cursor-not-allowed' : ''
              )}
              onClick={addLevel}
              aria-label="Increase levels"
              disabled={isCommercial ? rows.length >= 12 : rows.length >= 3}
            >
              +
            </button>
          </div>
          <button
            type="button"
            className="px-2.5 py-1.5 rounded-md border border-slate-300 text-slate-800 bg-white hover:bg-slate-50"
            onClick={() => replaceRows([presetRowForMode(currentMode, 0)])}
          >
            Reset
          </button>
          <span
            className="ml-2 text-sm text-slate-700 text-right inline-block"
            style={{ minWidth: 92, fontVariantNumeric: 'tabular-nums' }}
            aria-describedby={announceId}
          >
            ~ {fmtHrMin(minutes)}
          </span>
        </div>
      </header>

      <div role="table" aria-label="Levels grid" className="w-full mt-3">
        <div role="row" className="grid gap-2 text-xs font-semibold text-slate-600 mb-1 px-2" style={gridTemplate}>
          <div role="columnheader">Level</div>
          {showInside && <div role="columnheader">Inside</div>}
          {showOutside && <div role="columnheader">Outside</div>}
          {showTracks && <div role="columnheader">Tracks</div>}
          {showScreens && <div role="columnheader">Screens</div>}
          <div role="columnheader" className="text-right">
            Actions
          </div>
        </div>

        <ul className="space-y-2">
          {displayRows.map(({ row: r, sourceIndex }, displayIndex) => {
            const label = labelForRow(sourceIndex);
            return (
              <li
                key={`${label}-${sourceIndex}`}
                role="row"
                className="grid gap-2 items-center bg-white/90 border border-slate-200 rounded-xl p-2"
                style={gridTemplate}
              >
                <div role="cell" className="text-sm text-slate-800">
                  {label}
                </div>
                <div className="hidden" />

                {showInside && (
                  <div role="cell">
                    <label className="sr-only" htmlFor={`int-${displayIndex}`}>
                      Inside panes
                    </label>
                    <input
                      id={`int-${displayIndex}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="w-full px-2 py-1 rounded-md border border-slate-300 bg-white text-sm"
                      aria-label={`Inside panes for ${label}`}
                      value={r.int ? r.int : ''}
                      onChange={(e) => updateRowValue(sourceIndex, 'int', e.target.value)}
                    />
                  </div>
                )}

                {showOutside && (
                  <div role="cell">
                    <label className="sr-only" htmlFor={`ext-${displayIndex}`}>
                      Outside panes
                    </label>
                    <input
                      id={`ext-${displayIndex}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="w-full px-2 py-1 rounded-md border border-slate-300 bg-white text-sm"
                      aria-label={`Outside panes for ${label}`}
                      value={r.ext ? r.ext : ''}
                      onChange={(e) => updateRowValue(sourceIndex, 'ext', e.target.value)}
                    />
                  </div>
                )}

                {showTracks && (
                  <div role="cell">
                    <label className="sr-only" htmlFor={`trk-${displayIndex}`}>
                      Tracks
                    </label>
                    <input
                      id={`trk-${displayIndex}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="w-full px-2 py-1 rounded-md border border-slate-300 bg-white text-sm"
                      aria-label={`Tracks for ${label}`}
                      value={r.tracks ? r.tracks : ''}
                      onChange={(e) => updateRowValue(sourceIndex, 'tracks', e.target.value)}
                    />
                  </div>
                )}

                {showScreens && (
                  <div role="cell">
                    <label className="sr-only" htmlFor={`scr-${displayIndex}`}>
                      Screens
                    </label>
                    <input
                      id={`scr-${displayIndex}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="w-full px-2 py-1 rounded-md border border-slate-300 bg-white text-sm"
                      aria-label={`Screens for ${label}`}
                      value={r.screens ? r.screens : ''}
                      onChange={(e) => updateRowValue(sourceIndex, 'screens', e.target.value)}
                    />
                  </div>
                )}

                <div role="cell" className="text-right">
                  {sourceIndex > 0 && (
                    <button
                      type="button"
                      className="px-2 py-1 rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
                      aria-label={`Remove ${label}`}
                      onClick={() => replaceRows(rows.filter((_, i) => i !== sourceIndex))}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export default function ServicesPage() {
  const [S, dispatch] = useLocalStorageReducer<WizardState>(
    STORAGE_KEY,
    wizardReducer,
    getInitialState
  );
  const yardActive = S.service === 'yard';
  const motionEnabled = !yardActive;
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [hasInteractedStep2, setHasInteractedStep2] = useState(false);
  const { computeQuote, saveQuote, updateAdminRevision } = usePolygonQuote();
  const carSelector = useCarModelSelector();
  const carGlbByType = useMemo(
    () => ({
      hatch: '/models/hatch.glb',
      sedan: '/models/sedan.glb',
      suv: '/models/suv.glb',
      ute: '/models/ute.glb',
      van: '/models/van.glb',
      '4wd': '/models/4WD.glb',
      luxury: '/models/luxury.glb',
      muscle: '/models/muscle.glb',
    }),
    []
  );
  const [isClient, setIsClient] = useState(false);
  const routeCacheRef = useRef<Map<string, RouteLookupResult>>(new Map());
  const [routeLookup, setRouteLookup] = useState<RouteLookupResult | null>(null);
  const [routeLookupLoading, setRouteLookupLoading] = useState(false);
  const [routeLookupMessage, setRouteLookupMessage] = useState<string | null>(null);
  const set = React.useCallback(
    <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
      dispatch({ type: 'set', key, value });
    },
    [dispatch]
  );
  const [isDistanceInputFocused, setIsDistanceInputFocused] = useState(false);

  const handleDistanceInputFocusChange = useCallback((focused: boolean) => {
    setIsDistanceInputFocused(focused);
  }, []);

  const handleDistancePlaceSelected = useCallback(() => {
    setIsDistanceInputFocused(false);
  }, []);
  const routeServiceActive = ROUTE_SCOPES.includes(S.scope as RouteScopeKey);
  const usesRoutePricing = S.service === 'dump' && routeServiceActive;
  const routeCardActive = usesRoutePricing && activeServiceId === S.scope;
  const normalizedStep = Number(S.step);
  const yardStep2 = yardActive && normalizedStep === 2;
  const mapVisible = yardStep2;
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const activeYardJob = React.useMemo(() => {
    const jobs = S.yardJobs || [];
    if (!jobs.length) return null;
    if (S.yardActiveJobId) {
      return jobs.find((job) => job.job_id === S.yardActiveJobId) ?? jobs[0];
    }
    return jobs[0];
  }, [S.yardJobs, S.yardActiveJobId]);

  const yardMeasurementConfig = getYardMeasurementConfig(S.scope);
  const yardMeasurementUnit = YARD_MEASUREMENT_UNITS[yardMeasurementConfig.mode];
  const activeYardPolygon = activeYardJob?.polygon_geojson?.[0] || [];
  const activeMeasurementValue =
    yardMeasurementConfig.mode === 'perimeter'
      ? computePerimeterFromPath(activeYardPolygon)
      : computeAreaFromPath(activeYardPolygon);
  const activeMeasurementLabel =
    activeMeasurementValue > 0
      ? `${yardMeasurementConfig.label}: ${Math.round(activeMeasurementValue)} ${yardMeasurementUnit}`
      : `Draw the ${yardMeasurementConfig.label.toLowerCase()} to capture ${yardMeasurementUnit}`;

  const getMeasurementValueForJob = (job: YardJob) => {
    const coords = job.polygon_geojson?.[0] || [];
    return yardMeasurementConfig.mode === 'perimeter'
      ? computePerimeterFromPath(coords)
      : computeAreaFromPath(coords);
  };

  const measurementLabelForJob = (job: YardJob) => {
    const value = getMeasurementValueForJob(job);
    if (value > 0) {
      return `${yardMeasurementConfig.label}: ${Math.round(value)} ${yardMeasurementUnit}`;
    }
    return `Draw the ${yardMeasurementConfig.label.toLowerCase()} to capture ${yardMeasurementUnit}`;
  };

  const postPolygonToIframe = React.useCallback((coords: LatLng[]) => {
    if (typeof window === 'undefined') return;
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage({ type: 'YARD_SET_POLYGON', coords }, window.location.origin);
  }, []);

  const updateYardJob = (id: string, updater: (job: YardJob) => YardJob) => {
    const nextJobs = (S.yardJobs || []).map((j) => (j.job_id === id ? updater(j) : j));
    set('yardJobs', nextJobs as any);
  };

  const addYardJob = () => {
    const job = createYardJob();
    set('yardJobs', [...(S.yardJobs || []), job]);
    set('yardActiveJobId', job.job_id);
  };

  const removeYardJob = (id: string) => {
    const next = (S.yardJobs || []).filter((j) => j.job_id !== id);
    set('yardJobs', next as any);
    const nextActive = next.length ? next[0].job_id : null;
    set('yardActiveJobId', nextActive);
    if (!nextActive) {
      resetActivePolygon();
    }
  };

  const resetActivePolygon = () => {
    postPolygonToIframe([]);
    set('yardPolygon', []);
    set('yardArea', null);
    set('yardPerimeter', null);
    const measurement = getYardMeasurementConfig(S.scope);
    const yardParams = S.paramsByService.yard || {};
    const clearedParams = {
      ...yardParams,
      [measurement.field]: 0,
    };
    if (measurement.mode === 'area') {
      clearedParams.yard_area = 0;
    }
    set('paramsByService', {
      ...S.paramsByService,
      yard: clearedParams,
    });
    if (activeYardJob) {
      updateYardJob(activeYardJob.job_id, (job) => ({
        ...job,
        polygon_geojson: [],
        area_m2: null,
        price: 0,
        status: 'draft',
      }));
    }
  };

  const mapFrameSrc = '/yard-map-frame';

  const yardJobsRef = useRef<YardJob[]>(S.yardJobs || []);
  useEffect(() => {
    yardJobsRef.current = S.yardJobs || [];
  }, [S.yardJobs]);

  const yardActiveJobIdRef = useRef<string | null>(S.yardActiveJobId);
  useEffect(() => {
    yardActiveJobIdRef.current = S.yardActiveJobId;
  }, [S.yardActiveJobId]);

  const postMessageToIframe = React.useCallback((message: unknown) => {
    if (typeof window === 'undefined') return;
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(message, window.location.origin);
  }, []);

  const handlePolygonChange = React.useCallback(
    (coords: LatLng[]) => {
      const area = computeAreaFromPath(coords);
      const perimeter = computePerimeterFromPath(coords);
      const normalized = coords.length ? [coords] : [];
      const measurement = getYardMeasurementConfig(S.scope);
      const measurementValue = measurement.mode === 'perimeter' ? perimeter : area;
      const currentYardParams = S.paramsByService.yard || {};
      const nextYardParams = {
        ...currentYardParams,
        [measurement.field]: measurementValue,
        ...(measurement.mode === 'area' ? { yard_area: measurementValue } : {}),
      };
      const yardCondMap: Record<'light' | 'standard' | 'heavy', number> = {
        light: 0.9,
        standard: 1,
        heavy: 1.18,
      };
      const yardQuote = computeYardQuote(nextYardParams, {
        scope: S.scope,
        isTwoStoreyGutter: S.secondStorey,
        conditionMultiplier: yardCondMap[S.conditionLevel] ?? 1,
        accessTight: S.clutterAccess,
        conditionLevel: S.conditionLevel,
        context: S.context,
      });
      const price = Math.max(0, yardQuote.cost);
      set('paramsByService', {
        ...S.paramsByService,
        yard: nextYardParams,
      });
      set('yardPolygon', normalized);
      set('yardArea', area || null);
      set('yardPerimeter', perimeter || null);
      if (activeYardJob?.job_id) {
        updateYardJob(activeYardJob.job_id, (job) => ({
          ...job,
          polygon_geojson: normalized,
          area_m2: area || null,
          price,
          status: 'draft',
        }));
      }
    },
    [
      S.scope,
      S.paramsByService,
      S.secondStorey,
      S.conditionLevel,
      S.clutterAccess,
      S.context,
      activeYardJob?.job_id,
      set,
      updateYardJob,
    ]
  );

  // Reset handler + mount
  const hardResetQuote = React.useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    dispatch({ type: 'reset' });
    toast.info('Quote reset.');
    const target = iframeRef.current?.contentWindow;
    if (target) {
      target.postMessage({ type: 'YARD_SET_POLYGON', coords: [] }, window.location.origin);
    }
  }, [dispatch]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; coords?: unknown; address?: string };
      if (!data || typeof data.type !== 'string') return;
      if (data.type === 'YARD_POLYGON_CHANGE' && Array.isArray(data.coords)) {
        const normalized: LatLng[] = data.coords
          .map((entry: any) => ({
            lat: Number(entry?.lat),
            lng: Number(entry?.lng),
          }))
          .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
        handlePolygonChange(normalized);
        return;
      }
      if (data.type === 'YARD_ADDRESS') {
        const address = typeof data.address === 'string' ? data.address.trim() : '';
        if (!address) return;
        const jobs = yardJobsRef.current || [];
        const activeId = yardActiveJobIdRef.current || jobs[0]?.job_id;
        if (!activeId) return;
        const nextJobs = jobs.map((job) =>
          job.job_id === activeId
            ? {
                ...job,
                address,
              }
            : job
        );
        set('yardJobs', nextJobs as any);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handlePolygonChange, set]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    const polygon = activeYardJob?.polygon_geojson?.[0] || [];
    postPolygonToIframe(polygon);
    const normalized = polygon.length ? [polygon] : [];
    const area = computeAreaFromPath(polygon);
    const perimeter = computePerimeterFromPath(polygon);
    const measurement = getYardMeasurementConfig(S.scope);
    const measurementValue = measurement.mode === 'perimeter' ? perimeter : area;
    const currentYardParams = S.paramsByService.yard || {};
    const nextYardParams = {
      ...currentYardParams,
      [measurement.field]: measurementValue,
      ...(measurement.mode === 'area' ? { yard_area: measurementValue } : {}),
    };
    const needsUpdate =
      currentYardParams[measurement.field] !== measurementValue ||
      (measurement.mode === 'area' && currentYardParams.yard_area !== measurementValue);
    if (needsUpdate) {
      set('paramsByService', {
        ...S.paramsByService,
        yard: nextYardParams,
      });
    }
    set('yardPolygon', normalized);
    set('yardArea', area || null);
    set('yardPerimeter', perimeter || null);
  }, [activeYardJob?.job_id, activeYardJob?.price, postPolygonToIframe, S.scope, S.paramsByService]);

  useEffect(() => {
    const handler = () => hardResetQuote();
    window.addEventListener('svc:reset', handler);

    if (RESET_ON_MOUNT) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      dispatch({ type: 'reset' });
    }

    return () => window.removeEventListener('svc:reset', handler);
  }, [hardResetQuote]);


  useEffect(() => {
    if (!isClient) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (isDistanceInputFocused) return;
      if (!activeServiceId) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('.pac-container')) return;
      if (target?.closest('[data-card-interactive="true"]')) return;
      if (routeCardActive) return;
      const cardEl = target?.closest('[data-scope-card]');
      // Only collapse when clicking completely outside any card; moving between cards should stay open.
      if (!cardEl) setActiveServiceId(null);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [activeServiceId, isClient, routeCardActive, isDistanceInputFocused]);

  useEffect(() => {
    setActiveServiceId(null);
  }, [S.service]);

  // Auto-expand newly selected cards after the first interaction on Step 2.
  useEffect(() => {
    if (S.step !== 2) {
      setHasInteractedStep2(false);
      return;
    }
    if (!hasInteractedStep2) return;
    setActiveServiceId(S.scope);
  }, [S.step, S.scope, hasInteractedStep2]);

  // Sync car selector derived into wizard state
  useEffect(() => {
    const d = carSelector.derived;
    set('carModelType', d.carType);
    set('carModelZones', d.zones);
    set('carDirtLevel', d.dirtLevel);
    set('carModelPriceImpact', d.priceImpact);
  }, [carSelector.derived]);

  useEffect(() => {
    if (AUTO_SIZE_CATEGORIES.includes(S.carModelType as VehicleSizeCategory)) {
      const nextSize = S.carModelType as VehicleSizeCategory;
      if (S.carDetectedSizeCategory !== nextSize) {
        set('carDetectedSizeCategory', nextSize);
      }
    }
  }, [S.carModelType, S.carDetectedSizeCategory]);

  // -------------------------
  // Step logic
  // -------------------------
  const [openChecklists, setOpenChecklists] = React.useState<Record<string, boolean>>({});
  const [floorPlanResetKey, setFloorPlanResetKey] = React.useState<number>(0);

  const applyScopePreset = (svc: ServiceType, sc: ScopeKey) => {
    const prev = winSessionMinutes(S);
    const preset = scopePresetFor(svc, sc, S.context);

    // If we are switching to hourly cleaning and have a floor plan estimate, seed hours from it.
    let mergedPreset = preset;
    if (svc === 'cleaning' && sc === 'hourly' && S.floorPlanEstimate?.billableHours) {
      mergedPreset = { ...preset, hours: S.floorPlanEstimate.billableHours };
    }

    set('paramsByService', {
      ...S.paramsByService,
      [svc]: mergedPreset as Record<string, number>,
    });

    if (svc === 'yard' && sc !== S.scope) {
      set('yardJobs', [createYardJob()]);
      set('yardActiveJobId', null);
      set('yardPolygon', []);
      set('yardArea', null);
    }

    if (svc === 'dump') {
      if (sc === 'dump_runs') set('dumpRun', { ...DEFAULT_DUMP_RUN });
      if (sc === 'dump_delivery') set('dumpDelivery', { ...DEFAULT_DUMP_DELIVERY });
      if (sc === 'dump_transport') set('dumpTransport', { ...DEFAULT_DUMP_TRANSPORT });
    }

    if (svc === 'windows') {
      // Build rows according to context-aware preset (screens=0 for commercial)
      const rows = [
        {
          int: Number((preset as any).panes_int ?? (sc === 'windows_exterior' ? 0 : 12)),
          ext: Number((preset as any).panes_ext ?? (sc === 'windows_interior' ? 0 : 12)),
          tracks: Number((preset as any).tracks ?? 12),
          screens:
            S.context === 'commercial'
              ? 0
              : Number(
                  (preset as any).screens ??
                    (sc === 'windows_interior'
                      ? 0
                      : sc === 'windows_exterior'
                      ? 12
                      : 12)
                ),
          label: 'Ground',
        },
      ];

      set('winRows', rows);
      set('winStoreys', rows.length);

      const next = winSessionMinutes({ ...(S as WizardState), winRows: rows });
      notifyDelta(prev, next);
    }
  };

  const goToStep = (n: 1 | 2 | 3) => {
    if (n === 1) {
      const keepContext = S.context; // preserve context only
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      const fresh = getInitialState();
      dispatch({
        type: 'merge',
        value: { ...fresh, context: keepContext, step: 1 },
      });
      toast.info('Quote reset (context kept).');
      return;
    }

    if (n === 2) {
      // Ensure current scope has its preset applied so Step 2 UI starts consistent
      applyScopePreset(S.service, S.scope);
      setActiveServiceId(null);
    }

    set('step', n);
  };

  const selectService = (svc: ServiceType) => {
    dispatch({
      type: 'merge',
      value: {
        service: svc,
        scope:
          svc === 'dump'
            ? 'dump_runs'
            : svc === 'windows'
            ? 'windows_full'
            : svc === 'yard'
            ? 'yard_mow'
            : svc === 'auto'
            ? 'auto_full'
            : svc === 'sneakers'
            ? 'sneaker_full'
            : 'general',
      },
    });
    setActiveServiceId(null);

    if (svc === 'windows') {
      set('winStoreys', 1);
      set('winRows', [
        {
          int: 12,
          ext: 12,
          tracks: 12,
          screens: S.context === 'commercial' ? 0 : 12,
          label: 'Ground',
        },
      ]);
    }

    if (svc === 'cleaning' && S.context === 'commercial' && !S.commercialCleaningType) {
      set('commercialCleaningType', 'office');
    }
  };

  // Seed commercial-cleaning params when the niche changes
  useEffect(() => {
    if (S.context !== 'commercial' || S.service !== 'cleaning' || !S.commercialCleaningType) {
      return;
    }

    const defs = COMM_PARAM_DEFS[S.commercialCleaningType];
    const seeded = Object.fromEntries(defs.map((d) => [d.key, d.defaultValue]));

    set('paramsByService', {
      ...S.paramsByService,
      cleaning: { ...(S.paramsByService.cleaning || {}), ...seeded },
    });
  }, [S.commercialCleaningType]);

  // Enforce context rules (service availability, windows screens)
  useEffect(() => {
    const allowed = ALLOWED_SERVICES_BY_CONTEXT[S.context];
    if (!allowed.includes(S.service)) selectService(allowed[0]);

    // screens always 0 in commercial
    if (S.context === 'commercial' && S.service === 'windows') {
      const rs = S.winRows.map((r) => ({ ...r, screens: 0 }));
      set('winRows', rs);
    }
  }, [S.context]);

  // -------------------------
  // Derived values
  // -------------------------
  const winTotals = useMemo(() => {
    const panes_int = S.winRows.reduce((a, r) => a + r.int, 0);
    const panes_ext = S.winRows.reduce((a, r) => a + r.ext, 0);
    const tracks = S.winRows.reduce((a, r) => a + r.tracks, 0);
    const screens = S.winRows.reduce((a, r) => a + r.screens, 0);
    return { panes_int, panes_ext, tracks, screens };
  }, [S.winRows]);

  // Apply session segments (if any) so Step 2/3 estimate matches this session plan
  const winTotalsSession = useMemo(() => {
    if (S.service !== 'windows') return undefined;
    const seg = S.winSessionSeg ?? undefined;
    if (!seg) return winTotals;
    return {
      panes_int: seg.int ? winTotals.panes_int : 0,
      panes_ext: seg.ext ? winTotals.panes_ext : 0,
      tracks: seg.tracks ? winTotals.tracks : 0,
      screens: seg.ext ? winTotals.screens : 0,
    };
  }, [S.service, S.winSessionSeg, winTotals]);

  const fromParams = useMemo(() => {
    if (S.service === 'windows') {
      return selectedFromParams(
        S.service,
        S.scope,
        S.paramsByService[S.service] || {},
        { secondStorey: S.secondStorey },
        winTotalsSession ?? winTotals, // session-aware totals
        S.context
      );
    }

    const mergedCleaning =
      S.service === 'cleaning'
        ? {
            ...(S.paramsByService.cleaning || {}),
            ...(S.cleaningAddons[S.scope] || {}),
          }
        : S.service === 'yard'
        ? {
            ...(S.paramsByService[S.service] || {}),
            yard_area: S.yardArea ?? (S.paramsByService[S.service] as any)?.yard_area,
          }
        : S.paramsByService[S.service] || {};

    return selectedFromParams(
      S.service,
      S.scope,
      mergedCleaning,
      { secondStorey: S.secondStorey },
      undefined,
      S.context
    );
  }, [
    S.service,
    S.scope,
    S.paramsByService,
    S.cleaningAddons,
    S.secondStorey,
    S.yardArea,
    winTotals,
    winTotalsSession,
    S.context,
  ]);

  const selected = useMemo(() => sumSelected({}, fromParams), [fromParams]);
  const hasWork = useMemo(
    () => Object.values(selected).some((v) => (v || 0) > 0),
    [selected]
  );

  const conditionMult = useMemo(() => {
    // Flags
    let bumps = 0;
    if (S.clutterAccess) bumps += 0.12;
    if (S.photosOK) bumps -= 0.05;

    // Condition level
    const condMap = { light: 0.9, standard: 1.0, heavy: 1.18 } as const;
    const condMult = condMap[S.conditionLevel] ?? 1.0;

    return Math.min(1.4, (1 + bumps) * condMult);
  }, [S.clutterAccess, S.photosOK, S.conditionLevel]);

  const autoSizeCategory = useMemo(() => {
    if (AUTO_SIZE_CATEGORIES.includes(S.carModelType as VehicleSizeCategory)) {
      return S.carModelType as VehicleSizeCategory;
    }
    return S.carDetectedSizeCategory ?? null;
  }, [S.carModelType, S.carDetectedSizeCategory]);
  const autoYear = S.carDetectedYear;

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Ensure at least one yard job exists
  useEffect(() => {
    if (S.yardJobs && S.yardJobs.length > 0) return;
    set('yardJobs', [createYardJob()]);
  }, [S.yardJobs]);

  React.useEffect(() => {
    if (!routeCardActive || !S.dumpRoutePickup || !S.dumpRouteDropoff) {
      setRouteLookup(null);
      setRouteLookupLoading(false);
      setRouteLookupMessage(null);
      set('distanceKm', 0);
      return;
    }

    const pickup = S.dumpRoutePickup;
    const dropoff = S.dumpRouteDropoff;
    if (!pickup || !dropoff) {
      setRouteLookup(null);
      setRouteLookupLoading(false);
      setRouteLookupMessage(null);
      set('distanceKm', 0);
      return;
    }

    const key = formatRouteKey(pickup, dropoff);
    const cached = routeCacheRef.current.get(key);
    if (cached) {
      setRouteLookup(cached);
      setRouteLookupLoading(false);
      setRouteLookupMessage(null);
      set('distanceKm', cached.distanceKm);
      return;
    }

    let cancelled = false;
    setRouteLookupLoading(true);
    setRouteLookupMessage(null);

    (async () => {
      try {
        const result = await fetchDrivingDistance(pickup, dropoff);
        const rounded = {
          distanceKm: roundToHalfKm(result.distanceKm),
          durationMinutes: Math.max(1, result.durationMinutes),
        };
        routeCacheRef.current.set(key, rounded);
        if (!cancelled) {
          setRouteLookup(rounded);
          setRouteLookupLoading(false);
          set('distanceKm', rounded.distanceKm);
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('Delivery route lookup failed', error);
        const fallback = fallbackRoute(pickup, dropoff);
        const roundedFallback = {
          distanceKm: roundToHalfKm(fallback.distanceKm),
          durationMinutes: Math.max(1, fallback.durationMinutes),
        };
        routeCacheRef.current.set(key, roundedFallback);
        setRouteLookup(roundedFallback);
        setRouteLookupLoading(false);
        set('distanceKm', roundedFallback.distanceKm);
        setRouteLookupMessage('Using straight-line distance; refine addresses for a more accurate total.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeCardActive, S.dumpRoutePickup, S.dumpRouteDropoff, set]);

  const sneakerTurnaroundUsage = useMemo(() => {
    const usage: Record<SneakerTurnaround, number> = {
      standard: 0,
      express: 0,
      priority: 0,
    };
    usage[S.sneakerTurnaround] = 1;
    return usage;
  }, [S.sneakerTurnaround]);

  const isSneakerTurnaroundAvailable = (key: SneakerTurnaround) => {
    const meta = sneakerTurnaroundMeta(key);
    const used = sneakerTurnaroundUsage[key] || 0;
    if (S.sneakerTurnaround === key) return true;
    return used < meta.capacity;
  };

  const estimate = useMemo(
    () =>
      priceQuote({
        context: S.context,
        currentService: S.service,
        currentScope: S.scope,
        selected,
        distanceKm: S.distanceKm,
    paidParking: S.paidParking,
    tipFee: S.tipFee,
    conditionMult,
    conditionLevel: S.conditionLevel,
    flags: {
      petHair: S.petHair,
      greaseSoap: S.greaseSoap,
      clutterAccess: S.clutterAccess,
      secondStorey: S.secondStorey,
        },
        // derive storeys from rows
        windowsStoreys: S.service === 'windows' ? S.winRows.length : 1,
        commercialUplift: S.commercialUplift,
        sizeAdjust: S.sizeAdjust,
        conditionFlat: S.conditionFlat,
        contractDiscount: S.contractDiscount,
        commercialType: S.commercialCleaningType,
        commPreset: S.commPreset,
        afterHours: S.afterHours,
        bottleCount: S.service === 'dump' ? Number(S.paramsByService.dump?.bottles ?? 0) : 0,
        dumpRunSelection: S.dumpRun,
        cleaningParams:
          S.service === 'cleaning'
        ? { ...S.paramsByService.cleaning, ...(S.cleaningAddons[S.scope] || {}) }
        : undefined,
    commFrequency: S.commFrequency,
    yardParams:
      S.service === 'yard'
        ? { ...S.paramsByService.yard, yard_area: S.yardArea ?? S.paramsByService.yard?.yard_area }
        : undefined,
    windowsMinutesOverride:
      S.service === 'windows'
        ? computeWindowsMinutes(S.scope, S.winRows, S.context, S.paramsByService.windows)
        : undefined,
        windowsStoreysOverride: S.service === 'windows' ? S.winRows.length || 1 : undefined,
        autoCategory: S.carModelType,
        autoSizeCategory,
        autoYear,
        sneakerTurnaround: S.sneakerTurnaround,
      }),
    [
      S.context,
      S.service,
      S.scope,
      selected,
      S.distanceKm,
      S.paidParking,
      S.tipFee,
      conditionMult,
      S.conditionLevel,
      S.petHair,
      S.greaseSoap,
      S.clutterAccess,
      S.secondStorey,
      S.commercialUplift,
      S.sizeAdjust,
      S.conditionFlat,
      S.contractDiscount,
      S.commercialCleaningType,
      S.afterHours,
      S.paramsByService.dump?.bottles,
      S.paramsByService.yard,
      S.yardArea,
      S.dumpRun,
      S.commPreset,
      S.commFrequency,
      S.winRows,
      S.carModelType,
      autoSizeCategory,
      autoYear,
      S.sneakerTurnaround,
    ]
  );

  const servicedRegion = canonicalServiceRegion(S.region);

  const travelSummary = useMemo(() => {
    if (!hasWork) return 'Add tasks to enable travel & fees';
    const over = Math.max(0, S.distanceKm - POLICY.travelBaseKm);
    const parts = [
      over > 0 ? `+${over}km` : 'Travel included',
      S.paidParking ? `Parking +${fmtAUD(POLICY.parkingMin)}` : 'Parking off',
      S.tipFee ? `Tip ${fmtAUD(S.tipFee)}` : 'Tip $0',
    ];
    return parts.join(' · ');
  }, [S.distanceKm, S.paidParking, S.tipFee, hasWork]);

  // React wrapper
  const windowsSessionMinutes = React.useCallback(
    (rows: WizardState['winRows']) =>
      computeWindowsMinutes(S.scope, rows, S.context, S.paramsByService.windows),
    [S.scope, S.context, S.paramsByService.windows]
  );

const routeDurationOverride =
  usesRoutePricing && routeLookup ? Math.max(1, routeLookup.durationMinutes) : null;
// Display-only typical minutes (Step 2)
const displayMinutes = useMemo(() => {
  if (S.service === "windows") {
    return windowsSessionMinutes(S.winRows);
  }
  if (S.service === "cleaning") {
    if (S.context === "commercial") {
      const kind = S.commercialCleaningType ?? "office";
      const preset =
        COMM_PRESET_PRICING[kind]?.[S.commPreset ?? "essential"] ||
        COMM_PRESET_PRICING[kind]?.essential;
      return Math.round(((preset?.hours ?? 2) as number) * 60);
    }
    if (S.scope === "hourly") {
      return (S.paramsByService.cleaning?.hours || 1) * 60;
    }
    const mergedCleaning = {
      ...(S.paramsByService.cleaning || {}),
      ...(S.cleaningAddons[S.scope] || {}),
    };
    const extras = computeHomeExtras(S.scope, mergedCleaning);
    const addOns = computeCleaningAddons(S.scope, mergedCleaning);
    return extras.baseMinutes + extras.extraMinutes + addOns.minutes;
  }
  return routeDurationOverride ?? estimate.minutes;
}, [
  S.service,
  S.scope,
  S.context,
  S.winRows,
  S.paramsByService.cleaning,
  S.cleaningAddons,
  S.paramsByService.yard,
  estimate.minutes,
  windowsSessionMinutes,
  S.commercialCleaningType,
  S.commPreset,
  routeDurationOverride,
]);

// Step 3 card override
const estMinutes = useMemo(() => {
  if (S.service === "windows") return windowsSessionMinutes(S.winRows);
  if (S.service === "cleaning") {
    if (S.context === "commercial") {
      const kind = S.commercialCleaningType ?? "office";
      const preset =
        COMM_PRESET_PRICING[kind]?.[S.commPreset ?? "essential"] ||
        COMM_PRESET_PRICING[kind]?.essential;
      return Math.round(((preset?.hours ?? 2) as number) * 60);
    }
    if (S.scope === "hourly") {
      return (S.paramsByService.cleaning?.hours || 1) * 60;
    }
    const mergedCleaning = {
      ...(S.paramsByService.cleaning || {}),
      ...(S.cleaningAddons[S.scope] || {}),
    };
    const extras = computeHomeExtras(S.scope, mergedCleaning);
    const addOns = computeCleaningAddons(S.scope, mergedCleaning);
    return extras.baseMinutes + extras.extraMinutes + addOns.minutes;
  }
  return routeDurationOverride ?? estimate.minutes;
}, [
  S.service,
  S.context,
  S.winRows,
  S.scope,
  S.paramsByService.cleaning,
  S.cleaningAddons,
  S.paramsByService.yard,
  estimate.minutes,
  windowsSessionMinutes,
  S.commercialCleaningType,
  S.commPreset,
  routeDurationOverride,
]);

const routePriceOverride = useMemo<number | null>(() => {
  if (!routeCardActive || !routeLookup) return null;
  const raw =
    ROUTE_BASE_FEE +
    routeLookup.distanceKm * ROUTE_PER_KM_RATE +
    routeLookup.durationMinutes * ROUTE_PER_MIN_RATE;
  return Math.max(ROUTE_MIN_PRICE, Math.round(raw));
}, [routeCardActive, routeLookup]);
const routeDistanceLabel = routeLookup
  ? `${routeLookup.distanceKm.toFixed(1)} km · ${Math.round(routeLookup.durationMinutes)} mins travel`
  : null;
const scopedPricing = useMemo(() => calculateServicePrice(S.scope, S), [S]);

  const effectivePrice = routePriceOverride ?? scopedPricing.price;
  const priceLabel = useMemo(() => fmtAUD(effectivePrice), [effectivePrice]);

  const timeLabel = useMemo(() => `~${fmtHrMin(estMinutes)}`, [estMinutes]);

// Compatibility shims
function winSessionSegments(S: WizardState) {
  const { isIntOnly, isExtOnly, isTracksOnly, isFull } = getScopeFlags(S.scope);
  return {
    int: isFull || isIntOnly,
    ext: isFull || isExtOnly,
    tracks: isFull || isTracksOnly,
  };
}
function winSessionMinutes(S: WizardState) {
  return computeWindowsMinutes(S.scope, S.winRows, S.context, S.paramsByService.windows);
}
function winFmtMins(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}

/* =========================
   Typical minutes per scope
   ========================= */
/* =========================
   UI
   ========================= */
  return (
    <MotionContext.Provider value={motionEnabled}>
      <div
        className="relative text-black"
        data-yard-active={yardActive ? '' : undefined}
        style={{ ['--accent' as any]: ACCENT }}
      >
        {S.service !== 'yard' && (
          <>
            <div
              className="fixed inset-0 -z-20"
              aria-hidden
              style={{
                background:
                  'radial-gradient(600px circle at 18% 20%, #e8f5ee 0, transparent 40%), radial-gradient(800px circle at 85% 0%, #fdf2f2 0, transparent 45%), linear-gradient(180deg, #f9fbfd 0%, #eef3f7 100%)',
              }}
            />
            <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
              <div className="absolute blob blob-a" />
              <div className="absolute blob blob-b" />
            </div>
          </>
        )}

        <Toaster richColors position="top-center" />

        <main
          className={cls(
            'relative mx-auto max-w-6xl px-6 md:px-8 py-10',
            !yardActive && S.step >= 2 ? 'pb-[12rem]' : ''
          )}
        >
          <div className="relative">
            {yardStep2 && (
              <div
                aria-hidden
                className="pointer-events-none hidden lg:block absolute inset-y-2 left-1/2 -translate-x-1/2 w-[2px]"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(16,185,129,0) 0%, rgba(16,185,129,0.4) 40%, rgba(16,185,129,0) 100%)',
                  filter: 'blur(0.5px)',
                }}
              />
            )}

            <div className="space-y-8">
          {S.service !== 'yard' && (
            <div
              className="pointer-events-none fixed inset-0 -z-10"
              aria-hidden
              style={{
                background:
                  'radial-gradient(750px circle at 20% 12%, #e6f6ef 0, transparent 50%), radial-gradient(950px circle at 80% 5%, #e8f4ec 0, transparent 55%)',
              }}
            />
          )}
            <section className="mb-6 space-y-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-baseline">
                <div>
                  <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">Build your quote</h1>
                  <p className="mt-2 text-slate-700">It’s that simple every step of the way</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2" role="tablist" aria-label="Wizard steps">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className={`h-2 rounded-full transition-all ${n <= S.step ? 'bg-[color:var(--accent)]' : 'bg-black/10'}`}
                      style={{ width: n === S.step ? 80 : 40 }}
                      aria-current={n === S.step ? 'step' : undefined}
                    />
                  ))}
                </div>
                <div className="text-sm text-slate-600 whitespace-nowrap">Step {S.step} of 3</div>
              </div>
            </section>
            <div className="grid gap-6">
              <div className="space-y-8">
                <div className="grid grid-cols-1 gap-8 items-start">
                  <div>

          {/* ===== STEP 1 ===== */}
          {S.step === 1 && (
            <>
              <section className="mb-8" aria-labelledby="step1-heading">
                <h2 id="step1-heading" className="sr-only">Step 1: Choose context and service</h2>
                <div className={`rounded-2xl p-6 md:p-7 ${glass}`}>
                  {/* Context buttons */}
                  <fieldset className="mb-5">
                    <legend className="text-sm text-slate-700 mb-3">Context</legend>
                    <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Context">
                      {(['home', 'commercial'] as const).map((c) => (
                    <M.button
                      key={c}
                      className={cls(
                        'px-3 py-1.5 rounded-full text-sm border',
                        S.context === c
                          ? 'bg-[color:var(--accent)] border-[color:var(--accent)] text-white shadow-[0_6px_18px_rgba(20,83,45,0.35)]'
                          : 'border-black/10'
                      )}
                      onClick={() => set('context', c as Context)}
                      aria-label={`Select ${c} context`}
                    >
                      {c[0].toUpperCase() + c.slice(1)}
                    </M.button>
                      ))}
                    </div>
                  </fieldset>

          {/* Service tiles */}
          <div className="text-sm text-slate-700 mb-3">Service</div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {SERVICES.map((s) => {
              const allowed = ALLOWED_SERVICES_BY_CONTEXT[S.context].includes(s.key);
              const isActive = S.service === s.key && allowed;
              return (
                <Tile
                  key={s.key}
                  active={isActive}
                  disabled={!allowed}
                  onClick={() => allowed && selectService(s.key)}
                  title={s.label}
                  subtitle={s.subtitle}
                  icon={s.icon}
                />
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <M.button
              className="px-4 py-2 rounded-2xl text-white"
              style={{ background: 'var(--accent)' }}
              onClick={() => goToStep(2)}
              aria-label="Continue to Step 2"
            >
              Continue
            </M.button>
          </div>
        </div>
      </section>

    </>
  )}

                </div>
      {/* ===== STEP 2 ===== */}
      {S.step === 2 && (() => {
        // ---------- lightweight constants ----------
        const RECOMMENDED: Record<string, string[]> = {
          windows: ['windows_full', 'windows_interior'],
          cleaning: ['general', 'deep'],
          yard: ['yard_mow', 'yard_leaves'],
          auto: ['auto_express'],
          dump: ['dump_runs'],
          sneakers: ['sneaker_full'],
        };

        // Local, simplified commercial sliders – shared across niches
        const COMM_SIMPLE = [
          {
            key: 'sqm',
            label: 'Approx. area (sqm)',
            min: 50,
            max: 3000,
            step: 50,
            defaultValue: 300,
            suffix: 'sqm',
          },
          {
            key: 'high_traffic',
            label: 'High-touch points',
            min: 0,
            max: 50,
            step: 1,
            defaultValue: 6,
          },
        ] as const;

        // For non-commercial sliders: which param is the "main" one per service
        const PRIMARY_PARAM_KEY: Partial<Record<ServiceType, string>> = {
          cleaning: 'bedrooms',
          windows: 'storeys',
          yard: 'lawn_m2',
          dump: 'items',
          auto: 'vehicle_size',
        };

        const SERVICE_LABEL: Record<string, string> = {
          windows: 'Window cleaning',
          cleaning: 'Home cleaning',
          yard: 'Lawn & garden care',
          auto: 'Car cleaning & detailing',
          dump: 'Dump runs & bin cleaning',
          sneakers: 'Sneaker care',
        };

const COMM_FEATURES: Record<CommercialCleaningType, string[]> = {
  office: ['Desks & bins', 'Kitchens/tea rooms', 'Restrooms', 'High-touch points'],
  medical: ['Consult rooms', 'Waiting area', 'Restrooms', 'Infection-control touchpoints'],
  fitness: ['Equipment wipe-down', 'Locker/change rooms', 'Showers', 'Mirrors & mats'],
  hospitality: ['Dining/bar areas', 'Kitchen/prep zones', 'Restrooms', 'Grease/touch points'],
  education: ['Classrooms & play', 'Staff rooms', 'Restrooms', 'High-touch toys/rails'],
  event: ['Pre/post-event reset', 'Restrooms', 'Seating/table sets', 'High-traffic touchpoints'],
  accommodation: ['Rooms/units turnover', 'Lobbies & lifts', 'Restrooms/amenities', 'High-touch railings'],
};

const COMM_STANDARDS: Record<CommercialCleaningType, string[]> = {
  office: ['After-hours ready', 'Insured', 'WC/Police checked', 'Supplies optional'],
  medical: ['Infection control', 'Insured', 'WC/Police checked', 'After-hours ready'],
  fitness: ['Anti-microbial', 'Insured', 'After-hours ready', 'Supplies optional'],
  hospitality: ['Grease-safe', 'Insured', 'After-hours ready', 'Supplies optional'],
  education: ['Child-safe', 'Insured', 'WC/Police checked', 'Supplies optional'],
  event: ['Pre/post turnaround', 'Insured', 'After-hours ready', 'Supplies optional'],
  accommodation: ['After-hours ready', 'Insured', 'WC/Police checked', 'Supplies optional'],
};

const COMM_PRESETS: Record<
  CommercialCleaningType,
  { key: string; label: string; params: Partial<Record<string, number>> }[]
> = {
          office: [
            { key: 'essential', label: 'Essential', params: { sqm: 600, workstations: 20, restrooms: 2, break_rooms: 1, floors: 1 } },
            { key: 'standard', label: 'Standard', params: { sqm: 900, workstations: 60, restrooms: 4, break_rooms: 2, floors: 2 } },
            { key: 'intensive', label: 'Intensive', params: { sqm: 1800, workstations: 120, restrooms: 8, break_rooms: 3, floors: 3 } },
          ],
  medical: [
    { key: 'essential', label: 'Essential', params: { sqm: 350, workstations: 6, restrooms: 2, break_rooms: 10, floors: 1, high_traffic: 6 } },
    { key: 'standard', label: 'Standard', params: { sqm: 550, workstations: 12, restrooms: 4, break_rooms: 20, floors: 2, high_traffic: 10 } },
    { key: 'intensive', label: 'Intensive', params: { sqm: 1200, workstations: 20, restrooms: 6, break_rooms: 30, floors: 3, high_traffic: 16 } },
  ],
  fitness: [
    { key: 'essential', label: 'Essential', params: { sqm: 450, workstations: 25, restrooms: 2, break_rooms: 3, floors: 100, high_traffic: 8 } },
    { key: 'standard', label: 'Standard', params: { sqm: 750, workstations: 50, restrooms: 3, break_rooms: 5, floors: 150, high_traffic: 12 } },
    { key: 'intensive', label: 'Intensive', params: { sqm: 1600, workstations: 80, restrooms: 4, break_rooms: 8, floors: 200, high_traffic: 16 } },
  ],
  hospitality: [
    { key: 'essential', label: 'Essential', params: { sqm: 550, workstations: 15, restrooms: 2, break_rooms: 1, floors: 1, high_traffic: 6 } },
    { key: 'standard', label: 'Standard', params: { sqm: 850, workstations: 30, restrooms: 3, break_rooms: 2, floors: 2, high_traffic: 10 } },
    { key: 'intensive', label: 'Intensive', params: { sqm: 1800, workstations: 60, restrooms: 5, break_rooms: 3, floors: 3, high_traffic: 14 } },
  ],
  education: [
    { key: 'essential', label: 'Essential', params: { sqm: 550, workstations: 6, restrooms: 3, break_rooms: 2, floors: 1, high_traffic: 8 } },
    { key: 'standard', label: 'Standard', params: { sqm: 850, workstations: 10, restrooms: 5, break_rooms: 3, floors: 2, high_traffic: 12 } },
    { key: 'intensive', label: 'Intensive', params: { sqm: 1700, workstations: 16, restrooms: 7, break_rooms: 4, floors: 3, high_traffic: 16 } },
  ],
  event: [
    { key: 'essential', label: 'Essential', params: { sqm: 700, workstations: 20, restrooms: 4, break_rooms: 50, floors: 1, high_traffic: 8 } },
    { key: 'standard', label: 'Standard', params: { sqm: 1200, workstations: 40, restrooms: 6, break_rooms: 80, floors: 2, high_traffic: 12 } },
    { key: 'intensive', label: 'Intensive', params: { sqm: 2800, workstations: 80, restrooms: 10, break_rooms: 120, floors: 3, high_traffic: 18 } },
  ],
  accommodation: [
    { key: 'essential', label: 'Essential', params: { sqm: 700, workstations: 25, restrooms: 4, break_rooms: 2, floors: 3, high_traffic: 6 } },
    { key: 'standard', label: 'Standard', params: { sqm: 1100, workstations: 60, restrooms: 8, break_rooms: 4, floors: 5, high_traffic: 10 } },
    { key: 'intensive', label: 'Intensive', params: { sqm: 2400, workstations: 100, restrooms: 12, break_rooms: 6, floors: 8, high_traffic: 14 } },
  ],
};


        const setCommercialType = (t: CommercialCleaningType) => {
          const defs = COMM_PARAM_DEFS[t] || [];
          const defaults = Object.fromEntries(
            defs.map((d) => [d.key, d.defaultValue])
          ) as Record<string, number>;
          set('commercialCleaningType', t);
          set('commFrequency', 'none');
          set('paramsByService', {
            ...S.paramsByService,
            cleaning: {
              ...(S.paramsByService.cleaning || {}),
              ...defaults,
            },
          });
          set('commPreset', 'essential');
        };

        // ---------- small utilities (pure, no hooks) ----------
        const isRec = (svc: string, key: string) => !!RECOMMENDED[svc]?.includes(key);

        const commercialDefaults = (t: CommercialCleaningType) =>
          Object.fromEntries(COMM_PARAM_DEFS[t].map((d) => [d.key, d.defaultValue]));

        const cleaningAddonsForScope = (scopeKey: ScopeKey) =>
          (S.cleaningAddons && S.cleaningAddons[scopeKey]) || {};

        // Use adjustedTypicalMinutes so cards match the main estimate; windows use live rows so chips, editor, and total stay in sync
        const cleaningParamsForScope = (scopeKey: ScopeKey) => {
          if (scopeKey === S.scope) {
            return {
              ...(S.paramsByService.cleaning || {}),
              ...cleaningAddonsForScope(scopeKey),
            };
          }
          // fallback to preset + defaults for that scope, no shared add-ons
          const defaults = defaultParamsByService().cleaning || {};
          const preset = scopePresetFor('cleaning', scopeKey, S.context) || {};
          return { ...defaults, ...preset, ...cleaningAddonsForScope(scopeKey) };
        };

        const computeMins = (Slocal: WizardState, service: ServiceType, scopeKey: ScopeKey) => {
          if (service === 'windows') {
            return computeWindowsMinutes(
              scopeKey,
              S.winRows,
              S.context,
              S.paramsByService.windows
            );
          }
          if (service === 'cleaning' && S.context === 'commercial') {
            const kind = S.commercialCleaningType ?? 'office';
            const preset =
              COMM_PRESET_PRICING[kind]?.[S.commPreset ?? 'essential'] ||
              COMM_PRESET_PRICING[kind]?.essential;
            if (preset) return Math.round((preset.hours || 2) * 60);
            return 120;
          }
          // Lock home cleaning presets to fixed hours
          if (service === 'cleaning' && S.context === 'home') {
            if (scopeKey === 'hourly') {
              const params = cleaningParamsForScope(scopeKey);
              return (params.hours || 1) * 60;
            }
            const params = cleaningParamsForScope(scopeKey);
            const extras = computeHomeExtras(scopeKey, params);
            const addOns = computeCleaningAddons(scopeKey, params);
            return extras.baseMinutes + extras.extraMinutes + addOns.minutes;
          }
          if (service === 'yard') {
            const activeParams =
              scopeKey === S.scope
                ? S.paramsByService.yard || {}
                : {
                    ...(defaultParamsByService().yard || {}),
                    ...(scopePresetFor('yard', scopeKey, S.context) || {}),
                  };
            const yard = computeYardQuote(
              { ...activeParams, yard_area: S.yardArea ?? (activeParams as any).yard_area },
              {
                scope: scopeKey,
                isTwoStoreyGutter: S.secondStorey,
                conditionMultiplier: conditionMult,
                accessTight: S.clutterAccess,
                conditionLevel: S.conditionLevel,
              }
            );
            return yard.minutes;
          }
          return adjustedTypicalMinutes(Slocal, service, scopeKey);
        };

        function cleaningScopesForContext(ctx: Context): ScopeDef[] {
          const std = CLEAN_SCOPES.find((s) => s.key === 'clean_std')!;
          const deep = CLEAN_SCOPES.find((s) => s.key === 'clean_deep')!;
          const move = CLEAN_SCOPES.find((s) => s.key === 'clean_move')!;

          if (ctx === 'commercial') {
            return [
              {
                key: 'general',
                label: 'Standard commercial',
                inclusions: std.inclusions,
                desc: 'Routine clean for offices and small sites.',
              },
              {
                key: 'deep',
                label: 'Deep commercial',
                inclusions: deep.inclusions,
                desc: 'Occasional heavy reset or pre-inspection clean.',
              },
              {
                key: 'hourly',
                label: 'Hourly / contract',
                inclusions: [],
                desc: 'Set a number of hours and direct our team.',
              },
            ];
          }

          // Home / NDIS / other
          return [
            {
              key: 'weekly',
              label: 'Weekly Clean',
              inclusions: std.inclusions,
              desc: 'Recurring weekly tidy-up to keep on top of things.',
            },
            {
              key: 'general',
              label: 'Standard Clean',
              inclusions: std.inclusions,
              desc: std.desc,
            },
            {
              key: 'deep',
              label: 'Deep Clean',
              inclusions: deep.inclusions,
              desc: deep.desc,
            },
            {
              key: 'endoflease',
              label: 'Move In / Out',
              inclusions: move.inclusions,
              desc: move.desc,
            },
            {
              key: 'hourly',
              label: 'Hourly / Directed',
              inclusions: [],
              desc: 'Book by the hour and point to what matters most.',
            },
          ];
        }

        // Auto-pick a sensible default scope if the customer hits "Not sure"
        function autoScopeKeyFor(Slocal: WizardState): ScopeKey | null {
          if (Slocal.service === 'cleaning') return 'general';
          if (Slocal.service === 'windows') return 'windows_full';
          if (Slocal.service === 'yard') return 'yard_mow';
          if (Slocal.service === 'dump') return 'dump_runs';
          if (Slocal.service === 'auto') return 'auto_express';
          if (Slocal.service === 'sneakers') return 'sneaker_basic';
          return null;
        }

        // ---------- card component (simple presets) ----------
        const ScopeCard = React.memo(function ScopeCard({
          S,
          sc,
          isActive,
          onSelect,
          onAdd,
          hookText,
          className = '',
          activeServiceId,
          setActiveServiceId,
        }: {
          S: WizardState;
          sc: any;
          isActive: boolean;
          onSelect: (key: string) => void;
          onAdd: (key: string) => void;
          hookText: string;
          className?: string;
          activeServiceId: string | null;
          setActiveServiceId: React.Dispatch<React.SetStateAction<string | null>>;
        }) {
          const dumpRunState = S.dumpRun || DEFAULT_DUMP_RUN;
          const deliveryState = S.dumpDelivery || DEFAULT_DUMP_DELIVERY;
          const transportState = S.dumpTransport || DEFAULT_DUMP_TRANSPORT;
          const dumpLoadType = dumpRunState.loadType;
          const dumpLoads = Math.max(1, Math.round(dumpRunState.loads || 1));
          const deliveryType = deliveryState.itemType;
          const deliveryDistance = deliveryState.distance;
          const deliveryAssist = deliveryState.assist;
          const transportType = transportState.moveType;
          const transportStairs = transportState.stairs;
          const transportSize = transportState.loadSize;
          const updateDumpRun = (next: Partial<DumpRunSelection>) =>
            set('dumpRun', { ...dumpRunState, ...next });
          const updateDelivery = (next: Partial<DeliverySelection>) =>
            set('dumpDelivery', { ...deliveryState, ...next });
          const updateTransport = (next: Partial<TransportSelection>) =>
            set('dumpTransport', { ...transportState, ...next });
          const [refreshMaterial, setRefreshMaterial] = React.useState<
            'mesh' | 'leather' | 'synthetic' | 'suede' | 'boots' | null
          >(null);
          const [refreshConcern, setRefreshConcern] = React.useState<
            'dirt' | 'yellowing' | 'scuffs' | 'odour' | 'wear' | null
          >(null);
          const [deepSoiling, setDeepSoiling] = React.useState<'light' | 'noticeable' | 'heavy'>('light');
          const [deepSensitive, setDeepSensitive] = React.useState<Set<'suede' | 'dyed' | 'collectible'>>(
            () => new Set()
          );
          const [multiPairs, setMultiPairs] = React.useState(1);
          const [multiMixed, setMultiMixed] = React.useState<'yes' | 'no'>('no');
          const showSheet = !!openChecklists[sc.key];
          const popoverId = React.useId();
          const minutes = computeMins(S, S.service as ServiceType, sc.key as ScopeKey);
          const recommended = isRec(S.service as string, sc.key as string);
          const hourlyRateDisplay =
            S.service === 'cleaning' && sc.key === 'hourly'
              ? `${fmtAUD(hourlyRate(S.context, 'cleaning', 'hourly', S.commercialCleaningType))}/hr`
              : null;
          const hourlyHours =
            S.service === 'cleaning' && sc.key === 'hourly'
              ? Math.max(3, Math.round(S.paramsByService.cleaning?.hours ?? 3))
              : null;
          const isHomeCleaning = S.service === 'cleaning' && S.context === 'home';
          const isHourlyCard = isHomeCleaning && sc.key === 'hourly';
          const isCleaningWizardCard = isHomeCleaning && !isHourlyCard;
          const floorPlanSummary =
            isHourlyCard && S.floorPlanEstimate
              ? `${S.floorPlanEstimate.counts.bedrooms} bed · ${S.floorPlanEstimate.counts.bathrooms} bath · ${S.floorPlanEstimate.counts.totalRooms} rooms · ~${S.floorPlanEstimate.billableHours}h bill`
              : null;
          const basis =
            isHomeCleaning && isActive
              ? `${S.paramsByService.cleaning?.bedrooms ?? 1} bed · ${S.paramsByService.cleaning?.bathrooms ?? 1} bath · ${S.paramsByService.cleaning?.storeys ?? 1} storey`
              : null;
          const addonsQuick: { key: string; label: string }[] = [];
          const addonsState = cleaningAddonsForScope(sc.key);
          const labelId = `sc-${sc.key}-label`;
          const hookId = `sc-${sc.key}-desc`;
          const isCarCleaning = S.service === 'auto';
          const isCleaning = S.service === 'cleaning';
          const isYard = S.service === 'yard';
          const isDumpRunsCard = S.service === 'dump' && sc.key === 'dump_runs';
          const isDeliveryCard = S.service === 'dump' && sc.key === 'dump_delivery';
          const isTransportCard = S.service === 'dump' && sc.key === 'dump_transport';
          const isRouteCard = isDeliveryCard || isTransportCard;
          const isSneakerRefresh = S.service === 'sneakers' && sc.key === 'sneaker_basic';
          const isSneakerDeep = S.service === 'sneakers' && sc.key === 'sneaker_full';
          const isSneakerMulti = S.service === 'sneakers' && sc.key === 'sneaker_lot';
          const cleaningSizePresets = {
            studio: { bedrooms: 1, bathrooms: 1, kitchens: 1, living: 0, laundry: 0, storeys: 1 },
            small: { bedrooms: 2, bathrooms: 1, kitchens: 1, living: 1, laundry: 0, storeys: 1 },
            medium: { bedrooms: 4, bathrooms: 2, kitchens: 1, living: 2, laundry: 1, storeys: 1 },
            large: { bedrooms: 5, bathrooms: 3, kitchens: 1, living: 2, laundry: 1, storeys: 2 },
          } as const;
          type CleaningSizeKey = keyof typeof cleaningSizePresets;
          const cleaningParams =
            (S.paramsByService.cleaning && Object.keys(S.paramsByService.cleaning).length > 0
              ? S.paramsByService.cleaning
              : (scopePresetFor('cleaning', sc.key, S.context) || {})) as Record<string, number>;
          const deriveSizeKey = (): CleaningSizeKey => {
            const beds = cleaningParams.bedrooms ?? 1;
            if (beds <= 1) return 'studio';
            if (beds <= 2) return 'small';
            if (beds <= 4) return 'medium';
            return 'large';
          };
          const cleaningSizeKey = deriveSizeKey();
          const sizePreset = cleaningSizePresets[cleaningSizeKey];
          const bathroomsChoice = (() => {
            const b = cleaningParams.bathrooms ?? sizePreset.bathrooms ?? 1;
            if (b <= 1) return 1;
            if (b <= 2) return 2;
            return 3;
          })() as 1 | 2 | 3;
          const cupboardsSelected =
            (cleaningParams.kitchens ?? sizePreset.kitchens) > sizePreset.kitchens;
          const wallsSelected = (cleaningParams.living ?? sizePreset.living) > sizePreset.living;
          const messLevel = S.conditionLevel;

          const setCleaningWizard = ({
            sizeKey = cleaningSizeKey,
            bathrooms = bathroomsChoice,
            cupboards = cupboardsSelected,
            walls = wallsSelected,
            bedrooms,
            storeys,
          }: {
            sizeKey?: CleaningSizeKey;
            bathrooms?: 1 | 2 | 3;
            cupboards?: boolean;
            walls?: boolean;
            bedrooms?: number;
            storeys?: number;
          }) => {
            const base = cleaningSizePresets[sizeKey] || cleaningSizePresets.medium;
            const nextBedrooms = Math.max(1, bedrooms ?? base.bedrooms);
            const nextBathrooms = Math.max(1, Math.min(3, bathrooms || base.bathrooms || 1));
            const nextStoreys = Math.max(1, Math.min(5, storeys ?? base.storeys ?? 1));
            const nextParams = {
              bedrooms: nextBedrooms,
              bathrooms: nextBathrooms,
              kitchens: base.kitchens + (cupboards ? 1 : 0),
              living: base.living + (walls ? 1 : 0),
              laundry: base.laundry,
              storeys: nextStoreys,
            };
            set('paramsByService', {
              ...S.paramsByService,
              cleaning: {
                ...(S.paramsByService.cleaning || {}),
                ...nextParams,
              },
            });
          };

          const toggleCleaningAddon = (key: 'oven' | 'fridge' | 'windows') => {
            const current = cleaningAddonsForScope(sc.key);
            const next = { ...current, [`addon_${key}`]: current[`addon_${key}`] ? 0 : 1 };
            set('cleaningAddons', { ...S.cleaningAddons, [sc.key]: next });
          };

          const toggleCupboards = () => {
            const current = cleaningAddonsForScope(sc.key);
            const nextSelected = !cupboardsSelected;
            set('cleaningAddons', { ...S.cleaningAddons, [sc.key]: { ...current, wizard_cupboards: nextSelected ? 1 : 0 } });
            setCleaningWizard({ cupboards: nextSelected });
          };

          const toggleWalls = () => {
            const current = cleaningAddonsForScope(sc.key);
            const nextSelected = !wallsSelected;
            set('cleaningAddons', { ...S.cleaningAddons, [sc.key]: { ...current, wizard_walls: nextSelected ? 1 : 0 } });
            setCleaningWizard({ walls: nextSelected });
          };

          const adjustBedrooms = (delta: number) => {
            const current = S.paramsByService.cleaning?.bedrooms ?? sizePreset.bedrooms;
            const next = Math.max(1, Math.min(8, current + delta));
            setCleaningWizard({ bedrooms: next });
          };
          const adjustBathrooms = (delta: number) => {
            const current = S.paramsByService.cleaning?.bathrooms ?? sizePreset.bathrooms;
            const next = Math.max(1, Math.min(6, current + delta));
            setCleaningWizard({ bathrooms: (next > 3 ? 3 : next) as 1 | 2 | 3 });
            set('paramsByService', {
              ...S.paramsByService,
              cleaning: {
                ...(S.paramsByService.cleaning || {}),
                bathrooms: next,
              },
            });
          };
          const adjustStoreys = (delta: number) => {
            const current = S.paramsByService.cleaning?.storeys ?? sizePreset.storeys;
            const next = Math.max(1, Math.min(5, current + delta));
            setCleaningWizard({ storeys: next });
          };
          const adjustKitchens = (delta: number) => {
            const current = S.paramsByService.cleaning?.kitchens ?? sizePreset.kitchens;
            const next = Math.max(0, Math.min(3, current + delta));
            set('paramsByService', {
              ...S.paramsByService,
              cleaning: { ...(S.paramsByService.cleaning || {}), kitchens: next },
            });
          };
          const adjustLaundry = (delta: number) => {
            const current = S.paramsByService.cleaning?.laundry ?? sizePreset.laundry;
            const next = Math.max(0, Math.min(2, current + delta));
            set('paramsByService', {
              ...S.paramsByService,
              cleaning: { ...(S.paramsByService.cleaning || {}), laundry: next },
            });
          };
          const adjustLiving = (delta: number) => {
            const current = S.paramsByService.cleaning?.living ?? sizePreset.living;
            const next = Math.max(0, Math.min(4, current + delta));
            set('paramsByService', {
              ...S.paramsByService,
              cleaning: { ...(S.paramsByService.cleaning || {}), living: next },
            });
          };
          const isBinCleans = S.service === 'dump' && sc.key === 'bin_cleans';
          const isConfigOpen = activeServiceId === sc.key;
          const binPreset = Math.max(1, S.paramsByService.dump?.bins ?? 2);
          const maxBottleCredit = Math.min(500, binPreset * 200); // 10c per bottle; cap so we never owe money
          const bottlePreset = Math.max(0, Math.min(maxBottleCredit, S.paramsByService.dump?.bottles ?? 0));
          const setBinParams = (bins: number) => {
            const safeBins = Math.max(1, Math.min(20, Math.round(bins)));
            const maxBottlesForBins = Math.min(500, safeBins * 200);
            const currentBottles = Math.max(0, Math.min(maxBottlesForBins, S.paramsByService.dump?.bottles ?? 0));
            set('paramsByService', {
              ...S.paramsByService,
              dump: { ...(S.paramsByService.dump || {}), bins: safeBins, bottles: currentBottles },
            });
          };
          const setBottleParams = (bottles: number) => {
            const maxForBins = Math.min(500, Math.max(1, S.paramsByService.dump?.bins ?? 1) * 200);
            const safe = Math.max(0, Math.min(maxForBins, Math.round(bottles)));
            set('paramsByService', {
              ...S.paramsByService,
              dump: { ...(S.paramsByService.dump || {}), bottles: safe },
            });
          };

          const cleaningHint = (() => {
            if (!isCleaningWizardCard) return null;
            if (sc.key === 'deep') return 'Deep cleans add more detail in kitchens and bathrooms.';
            if (sc.key === 'endoflease') return 'Move in/out cleans are bond-style with inside appliances included.';
            if (cleaningSizeKey === 'medium') return 'Most 3–4 bedroom homes take around half a day.';
            if (cleaningSizeKey === 'large') return 'Larger homes may be split into focused sessions; we keep it efficient.';
            return 'We keep visits lean; add details if you want us to focus anywhere extra.';
          })();
          const stopCardBubble = (e: React.SyntheticEvent) => e.stopPropagation();

          const dumpHints = (() => {
            if (!(isConfigOpen && isDumpRunsCard)) return null;
            const typeLabel =
              dumpLoadType === 'ute'
                ? 'ute load'
                : dumpLoadType === 'trailer'
                ? 'trailer full'
                : dumpLoadType === 'bulky'
                ? 'bulky furniture'
                : 'mixed load';
            const volumePer =
              dumpLoadType === 'ute' ? 1.5 : dumpLoadType === 'trailer' ? 2.5 : dumpLoadType === 'bulky' ? 2.0 : 1.2;
            const totalVol = Math.max(1, dumpLoads) * volumePer;
            const minsLow = 40 + (dumpLoads - 1) * 15;
            const minsHigh = 80 + (dumpLoads - 1) * 20;
            const techs = dumpLoads >= 3 ? 'Usually requires 2 techs.' : 'Typically 1–2 techs.';
            return {
              line1: `Looks like approximately ~${Math.round(totalVol * 10) / 10} cubic metres (${typeLabel}).`,
              line2: `Most jobs like this take around ${Math.max(30, minsLow)}–${minsHigh} minutes onsite.`,
              line3: techs,
            };
          })();

          const deliveryHints = (() => {
            if (!(isConfigOpen && isDeliveryCard)) return null;
            const typeHint =
              deliveryType === 'parcel'
                ? 'Parcels usually travel in a standard vehicle.'
                : deliveryType === 'household'
                ? 'Single household items usually fit in a standard vehicle.'
                : deliveryType === 'mattress'
                ? 'Mattresses often need weather protection — we’ll bring covers.'
                : deliveryType === 'groceries'
                ? 'Consumables stay shaded; we keep handling minimal.'
                : deliveryType === 'tools'
                ? 'Tools/equipment get secured for transport.'
                : 'We’ll match the vehicle to the item.';

            const distanceHint =
              deliveryDistance === 'same_suburb'
                ? 'Local runs are typically quick to schedule.'
                : deliveryDistance === 'drive_30'
                ? 'This range typically takes 30–90 minutes end-to-end.'
                : deliveryDistance === 'drive_60'
                ? 'Plan for 45–120 minutes depending on traffic.'
                : 'Longer runs are routed carefully for timing.';

            const assistHint =
              deliveryAssist === 'need_help'
                ? 'We’ll bring an extra pair of hands for lifting.'
                : 'Noted — no lifting help needed.';

            return [typeHint, distanceHint, assistHint];
          })();

          const transportHints = (() => {
            if (!(isConfigOpen && isTransportCard)) return null;
            const typeHint =
              transportType === 'house'
                ? 'Full moves often take multiple loads — we’ll map this out with you.'
                : transportType === 'bedroom'
                ? 'Bedroom moves usually need 1–2 techs and a vehicle.'
                : transportType === 'student'
                ? 'Student moves are usually completed in one trip.'
                : transportType === 'office'
                ? 'Office moves are planned to protect equipment and furniture.'
                : 'Event pack-ups are staged to keep gear organised.';

            const stairsHint =
              transportStairs === 'none'
                ? 'Ground access noted.'
                : transportStairs === 'one'
                ? 'One flight of stairs can add a little loading time.'
                : transportStairs === 'multi'
                ? 'Multiple flights noted — we’ll pace the load safely.'
                : 'No lift access noted — we’ll plan team sizing accordingly.';

            const sizeHint =
              transportSize === 'bags'
                ? 'A few bags/small items are usually one quick trip.'
                : transportSize === 'boot'
                ? 'A boot-full is often a single load.'
                : transportSize === 'small_load'
                ? 'Small loads are usually completed in one trip.'
                : 'Full moves can take multiple loads — we’ll plan this with you.';

            return [typeHint, stairsHint, sizeHint];
          })();

          const refreshHints = (() => {
            if (!(isConfigOpen && isSneakerRefresh)) return null;
            const materialHint =
              refreshMaterial === 'mesh'
                ? 'Mesh pairs respond really well to Refresh cleans.'
                : refreshMaterial === 'leather'
                ? 'Leather pairs get gentle, material-safe cleaning.'
                : refreshMaterial === 'synthetic'
                ? 'Synthetic uppers clean up nicely with a refresh.'
                : refreshMaterial === 'suede'
                ? 'Thanks — suede is cleaned with material-safe methods.'
                : refreshMaterial === 'boots'
                ? 'Boots get an exterior uplift; we keep it material-safe.'
                : 'We’ll match the clean to the material.';

            const concernHint =
              refreshConcern === 'yellowing'
                ? 'Yellowing often needs deeper treatment — Deep Restore may be better.'
                : refreshConcern === 'scuffs'
                ? 'Light scuffs get cosmetic attention in Refresh.'
                : refreshConcern === 'odour'
                ? 'Odour treatment is included in Refresh Clean.'
                : refreshConcern === 'wear'
                ? 'Wear & tear is noted — we’ll set expectations clearly.'
                : 'General dirt is well suited to Refresh Clean.';

            return [materialHint, concernHint];
          })();

          const deepHints = (() => {
            if (!(isConfigOpen && isSneakerDeep)) return null;
            const soilingHint =
              deepSoiling === 'heavy'
                ? 'Heavily worn pairs usually benefit the most from Deep Restore.'
                : deepSoiling === 'noticeable'
                ? 'Noticeably dirty pairs are a great fit for Deep Restore.'
                : 'Lightly worn pairs still get full deep care.';
            const sensitives = Array.from(deepSensitive);
            const sensitiveHint = sensitives.length
              ? 'We’ll take extra care with suede, dyed leather, and collectible pairs.'
              : 'No sensitive materials flagged; we’ll still handle carefully.';
            return [soilingHint, sensitiveHint];
          })();

          const multiHints = (() => {
            if (!(isConfigOpen && isSneakerMulti)) return null;
            const countHint =
              multiPairs >= 10
                ? 'Batch discounts may apply depending on quantity.'
                : multiPairs >= 4
                ? 'Larger batches can be grouped for efficiency.'
                : 'Small batches are easy to schedule together.';
            const mixHint =
              multiMixed === 'yes'
                ? 'You can mix Refresh and Deep Restore in the same booking.'
                : 'All pairs same care — quick to batch together.';
            return [countHint, mixHint, 'We can return pairs together or separately.'];
          })();

          const FALLBACK_INCLUSIONS = [
            'Scope confirmed (what’s in / out)',
            'Access/parking/prep noted',
            'Time & pricing confirmed',
            'Handover/QA (photos or walkthrough)',
          ];

          let inclusions: string[] = Array.isArray(sc.inclusions) ? [...sc.inclusions] : [];
          if (isCleaningWizardCard) {
            const propertySize: CleaningWizardChecklistState['propertySize'] =
              cleaningSizeKey === 'studio'
                ? 'studio'
                : cleaningSizeKey === 'small'
                ? '1-2'
                : cleaningSizeKey === 'medium'
                ? '3-4'
                : '5+';
            const messLevelLabel: CleaningWizardChecklistState['messLevel'] =
              messLevel === 'light' ? 'tidy' : messLevel === 'heavy' ? 'reset' : 'lived-in';
            const addOns: CleaningWizardChecklistState['addOns'] = {
              oven: Boolean((addonsState as any).addon_oven),
              fridge: Boolean((addonsState as any).addon_fridge),
              windows: Boolean((addonsState as any).addon_windows),
              cupboards: cupboardsSelected,
              walls: wallsSelected,
            };
            inclusions = buildCleaningChecklistFromWizard({
              propertySize,
              bathrooms: bathroomsChoice as 1 | 2 | 3,
              messLevel: messLevelLabel,
              addOns,
              scope: sc.key,
            });
          }
          if (!isCleaning && !isCarCleaning && inclusions.length < 4) {
            const needed = 4 - inclusions.length;
            inclusions = inclusions.concat(FALLBACK_INCLUSIONS.slice(0, needed));
          }

          const visibleInclusions = isHourlyCard ? [] : inclusions.slice(0, 4);
          const hiddenInclusions = isHourlyCard ? [] : inclusions.slice(4);
          const moreCount = isHourlyCard ? 0 : Math.max(0, inclusions.length - visibleInclusions.length);
          const addonsSelected =
            addonsQuick.length > 0 &&
            addonsQuick.some((a) => Boolean((addonsState as any)[`addon_${a.key}`]));

          const shouldShowHidden = hiddenInclusions.length > 0 && showSheet;
          const formatInc = (inc: string) => {
            const trimmed = inc.trim();
            const isHeader = /^—/.test(trimmed);
            const text = trimmed.replace(/^—\s*|\s*—$/g, '').trim();
            return { isHeader, text: text || inc };
          };
          const inclusionMinClass = ['windows', 'yard', 'dump', 'sneakers'].includes(
            S.service as any
          )
            ? 'min-h-[52px]'
            : 'min-h-[72px]';

          return (
            <div
              key={sc.key}
              data-scope-card={sc.key}
              role="button"
              tabIndex={0}
              aria-pressed={isActive ? 'true' : 'false'}
              aria-labelledby={labelId}
              aria-describedby={hookId}
              className={cls(
                glassCard(isActive),
                'relative overflow-visible cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 hover:shadow-[0_16px_40px_rgba(2,6,23,0.10)] transition-all',
                'flex flex-col h-full',
                className
              )}
              onClick={(e) => {
                const target = e.target as HTMLElement | null;
                if (target && target.closest('[data-card-interactive="true"]')) return;
                if (S.scope !== sc.key) onSelect(sc.key);
                setHasInteractedStep2(true);
                setActiveServiceId((curr) => (curr === sc.key ? null : sc.key));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  const target = e.target as HTMLElement | null;
                  if (target && target.closest('[data-card-interactive="true"]')) return;
                  e.preventDefault();
                  if (S.scope !== sc.key) onSelect(sc.key);
                  setHasInteractedStep2(true);
                  setActiveServiceId((curr) => (curr === sc.key ? null : sc.key));
                }
              }}
            >
              {/* Header */}
              <div className="flex items-baseline gap-2">
                <svg
                  aria-hidden
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  className="mt-0.5 text-slate-700 shrink-0"
                >
                  <path
                    d="M4 10h16M4 14h16M6 6h12M6 18h12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>

                <div className="min-w-0 flex-1">
                  <div
                    id={labelId}
                    className="text-lg md:text-xl font-semibold leading-tight tracking-tight text-slate-900 truncate"
                  >
                    {titleCase(sc.label)}
                  </div>
                  {!!hookText && (
                    <p
                      id={hookId}
                      className="mt-1 text-[11px] text-slate-600 line-clamp-2 min-h-[28px]"
                    >
                      {hookText}
                    </p>
                  )}
                </div>

                {recommended && (
                  <span className="ml-1 inline-flex items-center rounded-md bg-emerald-600/10 text-emerald-800 px-2 py-0.5 text-[10px] font-medium">
                    Most booked
                  </span>
                )}

                {isActive && (
                  <div className="flex flex-col items-end gap-1 shrink-0" aria-live="polite">
                    <span
                      className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px] md:text-[11px] text-slate-600"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {isHourlyCard
                        ? `~${hourlyHours ?? 3}h`
                        : hourlyRateDisplay
                        ? hourlyRateDisplay
                        : minutes > 0
                        ? `~${fmtHrMin(minutes)}`
                        : '—'}
                    </span>
                    {!isHourlyCard && hourlyHours != null && (
                      <span className="text-[10px] text-slate-600">
                        {hourlyHours}h · {fmtAUD(hourlyHours * hourlyRate(S.context, 'cleaning', 'hourly', S.commercialCleaningType))}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Simple inclusions preview */}
              {isHourlyCard ? (
                <div className={`mt-2 ${inclusionMinClass}`}>
                  <ul className="space-y-1 text-[11px] text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                      <span>3-hour minimum</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                      <span>$60/hr</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                      <span>You choose what gets cleaned</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                      <span>Smart Floor Plan included</span>
                    </li>
                  </ul>
                </div>
              ) : (
              visibleInclusions.length > 0 && (
                <div
                  className={`mt-2 ${inclusionMinClass} rounded-xl border border-black/5 bg-white/85 p-3 shadow-sm`}
                  data-card-interactive="true"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1 select-none">
                    <span className="font-semibold text-slate-800 tracking-tight uppercase">Checklist</span>
                  </div>
                  <ul className="mt-1 space-y-1 text-xs text-slate-700">
                    {visibleInclusions.map((inc) => {
                      const { isHeader, text } = formatInc(inc);
                      if (isHeader) {
                        return (
                          <li key={inc} className="pt-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            {text}
                          </li>
                        );
                      }
                      return (
                        <li key={inc} className="flex items-start gap-1.5">
                          <span
                            className="mt-[5px] h-1.5 w-1.5 rounded-full bg-emerald-400"
                            aria-hidden
                          />
                          <span>{text}</span>
                        </li>
                      );
                    })}
                  </ul>
                  {moreCount > 0 && !shouldShowHidden && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenChecklists((prev) => ({ ...prev, [sc.key]: true }));
                      }}
                      aria-expanded={showSheet}
                      className="mt-1 text-[11px] underline text-slate-600 hover:text-slate-800"
                    >
                      {isCarCleaning || isCleaning
                        ? `${moreCount} remaining`
                        : `+${moreCount} more checklist items included`}
                    </button>
                  )}
                  {shouldShowHidden && (
                    <div className="mt-2 space-y-2">
                      <ul className="space-y-1 text-xs text-slate-700">
                        {hiddenInclusions.map((inc) => {
                          const { isHeader, text } = formatInc(inc);
                          if (isHeader) {
                            return (
                              <li
                                key={inc}
                                className="pt-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide"
                              >
                                {text}
                              </li>
                            );
                          }
                          return (
                            <li key={inc} className="flex items-start gap-1.5">
                              <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                              <span>{text}</span>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="text-left mt-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-slate-300 bg-white/95 text-[11px] text-slate-700 shadow-sm hover:border-[color:var(--accent)] hover:text-emerald-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenChecklists((prev) => {
                              const next = { ...prev };
                              delete next[sc.key];
                              return next;
                            });
                          }}
                        >
                          <span aria-hidden>×</span>
                          <span>Hide</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {isActive && isCleaningWizardCard && isConfigOpen && (
                    <div
                      className="mt-3 space-y-2 border-t border-slate-200/80 pt-3"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-800 tracking-tight uppercase">Adjust details</span>
                        {cleaningHint && <span className="text-slate-500">{cleaningHint}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-slate-700 items-center">
                        <div className="rounded-full border border-black/10 bg-white/80 px-2 py-1 inline-flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-700">Bedrooms</span>
                          <button
                            type="button"
                            aria-label="Decrease bedrooms"
                            className="px-2 py-0.5 rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustBedrooms(-1);
                            }}
                          >
                            –
                          </button>
                          <span className="min-w-[20px] text-center font-semibold text-slate-900">
                            {S.paramsByService.cleaning?.bedrooms ?? sizePreset.bedrooms}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase bedrooms"
                            className="px-2 py-0.5 rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustBedrooms(1);
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div className="rounded-full border border-black/10 bg-white/80 px-2 py-1 inline-flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-700">Kitchen</span>
                          <button
                            type="button"
                            aria-label="Decrease kitchens"
                            className="px-2 py-0.5 rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustKitchens(-1);
                            }}
                          >
                            –
                          </button>
                          <span className="min-w-[20px] text-center font-semibold text-slate-900">
                            {S.paramsByService.cleaning?.kitchens ?? sizePreset.kitchens}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase kitchens"
                            className="px-2 py-0.5 rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustKitchens(1);
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div className="rounded-full border border-black/10 bg-white/80 px-2 py-1 inline-flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-700">Laundry</span>
                          <button
                            type="button"
                            aria-label="Decrease laundry"
                            className="px-2 py-0.5 rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustLaundry(-1);
                            }}
                          >
                            –
                          </button>
                          <span className="min-w-[20px] text-center font-semibold text-slate-900">
                            {S.paramsByService.cleaning?.laundry ?? sizePreset.laundry}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase laundry"
                            className="px-2 py-0.5 rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustLaundry(1);
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div className="rounded-full border border-black/10 bg-white/80 px-2 py-1 inline-flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-700">Living</span>
                          <button
                            type="button"
                            aria-label="Decrease living rooms"
                            className="px-2 py-0.5 rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustLiving(-1);
                            }}
                          >
                            –
                          </button>
                          <span className="min-w-[20px] text-center font-semibold text-slate-900">
                            {S.paramsByService.cleaning?.living ?? sizePreset.living}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase living rooms"
                            className="px-2 py-0.5 rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustLiving(1);
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div className="rounded-full border border-black/10 bg-white/80 px-2 py-1 inline-flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-700">Bathrooms</span>
                          <button
                            type="button"
                            aria-label="Decrease bathrooms"
                            className="px-2 py-0.5 rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustBathrooms(-1);
                            }}
                          >
                            –
                          </button>
                          <span className="min-w-[20px] text-center font-semibold text-slate-900">
                            {S.paramsByService.cleaning?.bathrooms ?? sizePreset.bathrooms}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase bathrooms"
                            className="px-2 py-0.5 rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustBathrooms(1);
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div className="rounded-full border border-black/10 bg-white/80 px-2 py-1 inline-flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-700">Storeys</span>
                          <button
                            type="button"
                            aria-label="Decrease storeys"
                            className="px-2 py-0.5 rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustStoreys(-1);
                            }}
                          >
                            –
                          </button>
                          <span className="min-w-[20px] text-center font-semibold text-slate-900">
                            {S.paramsByService.cleaning?.storeys ?? sizePreset.storeys}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase storeys"
                            className="px-2 py-0.5 rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustStoreys(1);
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        {[
                          { key: 'light', label: 'Tidy' },
                          { key: 'standard', label: 'Lived in' },
                          { key: 'heavy', label: 'Needs a reset' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            className={cls(
                              'px-3 py-1 rounded-full border',
                              messLevel === c.key
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white border-black/10 text-slate-700'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              set('conditionLevel', c.key as any);
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        {[
                          { key: 'oven', label: 'Inside oven' },
                          { key: 'fridge', label: 'Inside fridge/freezer' },
                          { key: 'windows', label: 'Windows' },
                          { key: 'cupboards', label: 'Inside cupboards' },
                          { key: 'walls', label: 'Walls/marks' },
                        ].map((c) => {
                          const active =
                            c.key === 'oven'
                              ? Boolean((addonsState as any).addon_oven)
                              : c.key === 'fridge'
                              ? Boolean((addonsState as any).addon_fridge)
                              : c.key === 'windows'
                              ? Boolean((addonsState as any).addon_windows)
                              : c.key === 'cupboards'
                              ? cupboardsSelected
                              : wallsSelected;
                          const handle = (e: React.MouseEvent) => {
                            e.stopPropagation();
                            if (c.key === 'cupboards') return toggleCupboards();
                            if (c.key === 'walls') return toggleWalls();
                            toggleCleaningAddon(c.key as 'oven' | 'fridge' | 'windows');
                          };
                          return (
                            <button
                              key={c.key}
                              type="button"
                              className={cls(
                                'px-3 py-1 rounded-full border',
                                active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                              )}
                              onClick={handle}
                            >
                              {c.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* CTA row */}
              <div className="mt-auto pt-1.5 flex flex-col gap-3">
                {S.service === 'windows' && isActive && isConfigOpen && (
                  <div
                    data-card-interactive="true"
                    onClick={stopCardBubble}
                    onMouseDown={stopCardBubble}
                    onPointerDown={stopCardBubble}
                    onTouchStart={stopCardBubble}
                  >
                    <WindowsEditor S={S} set={set} notifyDelta={notifyDelta} />
                  </div>
                )}

                {S.service === 'auto' && isActive && isConfigOpen && (
                  <div
                    data-card-interactive="true"
                    className="rounded-xl border border-black/5 bg-white/80 p-3 space-y-3"
                    onClick={stopCardBubble}
                    onMouseDown={stopCardBubble}
                    onPointerDown={stopCardBubble}
                    onTouchStart={stopCardBubble}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">3D car selector (optional)</div>
                        <div className="text-xs text-slate-600">Keeps size/zone selections inside this preset.</div>
                      </div>
                    </div>
                    <RegoLookupAssistant
                      selectedCategory={carSelector.carType}
                      onSelectCategory={(category) => carSelector.setCarType(category)}
                      onVehicleDetected={(_vehicle, classification) => {
                        if (classification.sizeCategory) {
                          set('carDetectedSizeCategory', classification.sizeCategory);
                        }
                        const year = _vehicle.year;
                        set('carDetectedYear', typeof year === 'number' ? year : null);
                      }}
                    />
                    <div className="flex items-center gap-2 text-sm">
                      <label className="text-slate-700">Car type</label>
                      <select
                        className="rounded-lg border border-black/10 px-2 py-1 text-sm"
                        value={carSelector.carType}
                        onChange={(e) => carSelector.setCarType(e.target.value as any)}
                      >
                        {(['hatch', 'sedan', 'suv', 'ute', 'van', '4wd', 'luxury', 'muscle'] as const).map((t) => (
                          <option key={t} value={t}>
                            {t.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    {isClient ? (
                      <CarModelViewer
                        carType={carSelector.carType}
                        dirtLevel={carSelector.dirtLevel}
                        glbByType={carGlbByType}
                        cleanTextureUrl="/textures/clean.jpg"
                        dirtyTextureUrl="/textures/dirty.jpg"
                        onZoneSelect={(zone) => carSelector.toggleZone(zone)}
                      />
                    ) : (
                      <div className="text-xs text-slate-600">Preparing 3D viewer…</div>
                    )}
                  </div>
                )}

                {S.service === 'sneakers' && isActive && isConfigOpen && (
                  <div
                    data-card-interactive="true"
                    className="rounded-xl border border-black/5 bg-white/80 p-3 space-y-2"
                    onClick={stopCardBubble}
                    onMouseDown={stopCardBubble}
                    onPointerDown={stopCardBubble}
                    onTouchStart={stopCardBubble}
                  >
                    <div className="text-sm font-semibold text-slate-900">Turnaround speed</div>
                    <div className="flex flex-wrap gap-2">
                      {SNEAKER_TURNAROUND_META.map((t) => {
                        const available = isSneakerTurnaroundAvailable(t.key);
                        const isActiveTurnaround = S.sneakerTurnaround === t.key;
                        return (
                          <button
                            key={t.key}
                            type="button"
                            disabled={!available}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (available) set('sneakerTurnaround', t.key);
                            }}
                            className={cls(
                              'rounded-full border px-3 py-1 text-sm',
                              isActiveTurnaround ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10',
                              !available && !isActiveTurnaround ? 'opacity-50 cursor-not-allowed' : ''
                            )}
                            title={`${t.window}${t.surcharge ? ` · +$${t.surcharge}/pair` : ''}`}
                          >
                            {t.label} — {t.window}
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Standard is best value; Express and Priority reduce turnaround with limited slots.
                    </div>
                  </div>
                )}

                {isDumpRunsCard && isConfigOpen && (
                  <div
                    data-card-interactive="true"
                    className="rounded-xl border border-black/5 bg-white/80 p-3"
                    onClick={stopCardBubble}
                    onMouseDown={stopCardBubble}
                    onPointerDown={stopCardBubble}
                    onTouchStart={stopCardBubble}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-semibold text-slate-900">Add Details</div>
                      <div className="text-[11px] text-slate-600">Adjusts time & cost</div>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-slate-700">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: 'ute', label: 'Ute load' },
                          { key: 'trailer', label: 'Trailer full' },
                          { key: 'bulky', label: 'Bulky furniture' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            className={cls(
                              'px-3 py-1 rounded-full border text-sm',
                              dumpLoadType === c.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateDumpRun({ loadType: c.key as 'ute' | 'trailer' | 'bulky' });
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-700">Number of loads</span>
                        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = Math.max(1, Math.min(6, dumpLoads - 1));
                              updateDumpRun({ loads: next });
                            }}
                            aria-label="Decrease loads"
                          >
                            –
                          </button>
                          <span className="min-w-[24px] text-center font-semibold">{dumpLoads}</span>
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = Math.max(1, Math.min(6, dumpLoads + 1));
                              updateDumpRun({ loads: next });
                            }}
                            aria-label="Increase loads"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {dumpHints && (
                        <div className="text-[11px] text-slate-600 space-y-1">
                          <div>{dumpHints.line1}</div>
                          <div>{dumpHints.line2}</div>
                          <div>{dumpHints.line3}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {isDeliveryCard && isConfigOpen && (
                  <div
                    data-card-interactive="true"
                    className="rounded-xl border border-black/5 bg-white/80 p-3"
                    onClick={stopCardBubble}
                    onMouseDown={stopCardBubble}
                    onPointerDown={stopCardBubble}
                    onTouchStart={stopCardBubble}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-semibold text-slate-900">Add Delivery Details</div>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-slate-700">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: 'parcel', label: 'Small box / parcel' },
                          { key: 'household', label: 'Single household item' },
                          { key: 'mattress', label: 'Mattress / bed' },
                          { key: 'groceries', label: 'Groceries / consumables' },
                          { key: 'tools', label: 'Tools / equipment' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            className={cls(
                              'px-3 py-1 rounded-full border text-sm',
                              deliveryType === c.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateDelivery({ itemType: c.key as DeliverySelection['itemType'] });
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: 'same_suburb', label: 'Same suburb' },
                          { key: 'drive_30', label: '15–30 minutes drive' },
                          { key: 'drive_60', label: '30–60 minutes drive' },
                          { key: 'long', label: 'Long distance' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            className={cls(
                              'px-3 py-1 rounded-full border text-sm',
                              deliveryDistance === c.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateDelivery({ distance: c.key as DeliverySelection['distance'] });
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: 'no_help', label: 'No lifting help needed' },
                          { key: 'need_help', label: 'Need lifting/carrying help' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            className={cls(
                              'px-3 py-1 rounded-full border text-sm',
                              deliveryAssist === c.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateDelivery({ assist: c.key as DeliverySelection['assist'] });
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      {deliveryHints && (
                        <div className="text-[11px] text-slate-600 space-y-1">
                          {deliveryHints.map((h, i) => (
                            <div key={i}>{h}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {isTransportCard && isConfigOpen && (
                  <div
                    data-card-interactive="true"
                    className="rounded-xl border border-black/5 bg-white/80 p-3"
                    onClick={stopCardBubble}
                    onMouseDown={stopCardBubble}
                    onPointerDown={stopCardBubble}
                    onTouchStart={stopCardBubble}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-semibold text-slate-900">Add Move Details</div>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-slate-700">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: 'house', label: 'House move' },
                          { key: 'bedroom', label: 'Bedroom move' },
                          { key: 'student', label: 'Student move' },
                          { key: 'office', label: 'Office move' },
                          { key: 'event', label: 'Event pack-up' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            className={cls(
                              'px-3 py-1 rounded-full border text-sm',
                              transportType === c.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTransport({ moveType: c.key as TransportSelection['moveType'] });
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: 'none', label: 'No stairs' },
                          { key: 'one', label: 'One flight of stairs' },
                          { key: 'multi', label: 'Multiple flights of stairs' },
                          { key: 'no_lift', label: 'No lift access' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            className={cls(
                              'px-3 py-1 rounded-full border text-sm',
                              transportStairs === c.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTransport({ stairs: c.key as TransportSelection['stairs'] });
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: 'bags', label: 'A few bags / small items' },
                          { key: 'boot', label: 'Car boot full' },
                          { key: 'small_load', label: 'Small load' },
                          { key: 'full_move', label: 'Full move' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            className={cls(
                              'px-3 py-1 rounded-full border text-sm',
                              transportSize === c.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateTransport({ loadSize: c.key as TransportSelection['loadSize'] });
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      {transportHints && (
                        <div className="text-[11px] text-slate-600 space-y-1">
                          {transportHints.map((h, i) => (
                            <div key={i}>{h}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {isRouteCard && isActive && isConfigOpen && (
                  <div
                    data-card-interactive="true"
                    className="mt-4"
                    onClick={stopCardBubble}
                    onMouseDown={stopCardBubble}
                    onPointerDown={stopCardBubble}
                    onTouchStart={stopCardBubble}
                  >
                    <DistanceRouteConfigurator
                      S={S}
                      set={set}
                      routeLookup={routeLookup}
                      routeLookupLoading={routeLookupLoading}
                      routeLookupMessage={routeLookupMessage}
                      routeDistanceLabel={routeDistanceLabel}
                      onFocusChange={handleDistanceInputFocusChange}
                      onPlaceSelected={handleDistancePlaceSelected}
                    />
                  </div>
                )}
                {isBinCleans && isConfigOpen && (
                  <div
                    data-card-interactive="true"
                    className="rounded-xl border border-black/5 bg-white/85 p-3 shadow-sm"
                    onClick={stopCardBubble}
                    onMouseDown={stopCardBubble}
                    onPointerDown={stopCardBubble}
                    onTouchStart={stopCardBubble}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-semibold text-slate-900">Bin Clean Helper</div>
                    </div>
                    <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs text-slate-700">
                      <div className="rounded-lg border border-black/10 bg-white/80 p-3 space-y-2">
                        <div className="text-[11px] font-semibold text-slate-700">Number of bins</div>
                        <div className="flex flex-wrap gap-1.5">
                          {[1, 2, 3, 4].map((n) => (
                            <button
                              key={n}
                              type="button"
                              className={cls(
                                'px-3 py-1 rounded-full border text-sm',
                                binPreset === n ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBinParams(n);
                              }}
                            >
                              {n} bin{n > 1 ? 's' : ''}
                            </button>
                          ))}
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
                            aria-label="Decrease bins"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBinParams(binPreset - 1);
                            }}
                          >
                            –
                          </button>
                          <span className="min-w-[28px] text-center font-semibold">{binPreset}</span>
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
                            aria-label="Increase bins"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBinParams(binPreset + 1);
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Presets replace the old sliders; bins adjust the quote automatically.
                        </div>
                      </div>

                      <div className="rounded-lg border border-black/10 bg-white/80 p-3 space-y-2">
                        <div className="text-[11px] font-semibold text-slate-700">10¢ bottle credit</div>
                        <div className="flex flex-wrap gap-1.5">
                          {[0, 50, 100, 200].map((n) => (
                            <button
                              key={n}
                              type="button"
                              className={cls(
                                'px-3 py-1 rounded-full border text-sm',
                                bottlePreset === n ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBottleParams(n);
                              }}
                            >
                              {n} bottles
                            </button>
                          ))}
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
                            aria-label="Decrease bottles"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBottleParams(bottlePreset - 10);
                            }}
                          >
                            –
                          </button>
                          <span className="min-w-[40px] text-center font-semibold">{bottlePreset}</span>
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
                            aria-label="Increase bottles"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBottleParams(bottlePreset + 10);
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          Bottle credit auto-applies (10¢ each) and can offset the clean.
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isActive && S.service === 'sneakers' && isSneakerRefresh && isConfigOpen && (
                  <div
                    data-card-interactive="true"
                    className="rounded-xl border border-black/5 bg-white/80 p-3"
                    onClick={stopCardBubble}
                    onMouseDown={stopCardBubble}
                    onPointerDown={stopCardBubble}
                    onTouchStart={stopCardBubble}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-semibold text-slate-900">Add sneaker details</div>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-slate-700">
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: 'mesh', label: 'Mesh / knit' },
                          { key: 'leather', label: 'Leather' },
                          { key: 'synthetic', label: 'Synthetic' },
                          { key: 'suede', label: 'Suede / nubuck' },
                          { key: 'boots', label: 'Boots' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            className={cls(
                              'px-3 py-1 rounded-full border text-sm',
                              refreshMaterial === c.key
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white border-black/10'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRefreshMaterial((curr) => (curr === c.key ? null : (c.key as typeof refreshMaterial)));
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: 'dirt', label: 'General dirt' },
                          { key: 'yellowing', label: 'Yellowing' },
                          { key: 'scuffs', label: 'Scuffs / marks' },
                          { key: 'odour', label: 'Odour' },
                          { key: 'wear', label: 'Wear & tear' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            className={cls(
                              'px-3 py-1 rounded-full border text-sm',
                              refreshConcern === c.key
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white border-black/10'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRefreshConcern((curr) => (curr === c.key ? null : (c.key as typeof refreshConcern)));
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      {refreshHints && (
                        <div className="text-[11px] text-slate-600 space-y-1">
                          {refreshHints.map((h, i) => (
                            <div key={i}>{h}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isActive && S.service === 'sneakers' && isSneakerDeep && isConfigOpen && (
                  <div
                    data-card-interactive="true"
                    className="rounded-xl border border-black/5 bg-white/80 p-3"
                    onClick={stopCardBubble}
                    onMouseDown={stopCardBubble}
                    onPointerDown={stopCardBubble}
                    onTouchStart={stopCardBubble}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-semibold text-slate-900">Add sneaker details</div>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-slate-700">
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: 'light', label: 'Light wear' },
                          { key: 'noticeable', label: 'Noticeable dirt' },
                          { key: 'heavy', label: 'Heavy wear' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            className={cls(
                              'px-3 py-1 rounded-full border text-sm',
                              deepSoiling === c.key
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white border-black/10'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeepSoiling(c.key as typeof deepSoiling);
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: 'suede', label: 'Suede / nubuck' },
                          { key: 'dyed', label: 'Dyed leather' },
                          { key: 'collectible', label: 'Collectible' },
                        ].map((c) => {
                          const active = deepSensitive.has(c.key as any);
                          return (
                            <button
                              key={c.key}
                              type="button"
                              className={cls(
                                'px-3 py-1 rounded-full border text-sm',
                                active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeepSensitive((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(c.key as any)) next.delete(c.key as any);
                                  else next.add(c.key as any);
                                  return next;
                                });
                              }}
                            >
                              {c.label}
                            </button>
                          );
                        })}
                      </div>
                      {deepHints && (
                        <div className="text-[11px] text-slate-600 space-y-1">
                          {deepHints.map((h, i) => (
                            <div key={i}>{h}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isActive && S.service === 'sneakers' && isSneakerMulti && isConfigOpen && (
                  <div
                    data-card-interactive="true"
                    className="rounded-xl border border-black/5 bg-white/80 p-3"
                    onClick={stopCardBubble}
                    onMouseDown={stopCardBubble}
                    onPointerDown={stopCardBubble}
                    onTouchStart={stopCardBubble}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-semibold text-slate-900">Add sneaker details</div>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-slate-700">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-slate-700">Pairs in this lot</span>
                        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMultiPairs((n) => Math.max(1, Math.min(20, n - 1)));
                            }}
                            aria-label="Decrease pairs"
                          >
                            –
                          </button>
                          <span className="min-w-[24px] text-center font-semibold">{multiPairs}</span>
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMultiPairs((n) => Math.max(1, Math.min(20, n + 1)));
                            }}
                            aria-label="Increase pairs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: 'no', label: 'Same care for all' },
                          { key: 'yes', label: 'Mix refresh + deep' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            className={cls(
                              'px-3 py-1 rounded-full border text-sm',
                              multiMixed === c.key
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white border-black/10'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              setMultiMixed(c.key as typeof multiMixed);
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      {multiHints && (
                        <div className="text-[11px] text-slate-600 space-y-1">
                          {multiHints.map((h, i) => (
                            <div key={i}>{h}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isActive && addonsQuick.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 relative z-10">
                    {addonsQuick.map((a) => (
                      <button
                        key={a.key}
                        type="button"
                        className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] bg-white hover:border-[color:var(--accent)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          const current = cleaningAddonsForScope(sc.key);
                          const next = { ...current, [`addon_${a.key}`]: current[`addon_${a.key}`] ? 0 : 1 };
                          set('cleaningAddons', { ...S.cleaningAddons, [sc.key]: next });
                        }}
                      >
                        {(addonsState as any)[`addon_${a.key}`] ? '✓ ' : ''}{a.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-[11px] text-slate-600">
                    Builds a clear to-do list for our techs and your peace of mind.
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdd(sc.key);
                    }}
                    className="text-sm px-4 py-2 rounded-2xl text-white shadow-[0_8px_20px_rgba(20,83,45,0.2)]"
                    style={{ background: 'var(--accent)' }}
                  >
                    Add to quote
                  </button>
                </div>
              </div>
            </div>
          );
        });

        // ---------- actual section render (no hooks below) ----------
        const step2Body = (
                  <>
                    {/* Section heading */}
                    {S.service === 'yard' ? (
                      <div>
                        <p className="text-emerald-700 text-sm font-semibold">Yard care</p>
                        <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
                          Map your lawns and sites
                        </h3>
                        <p className="mt-1 text-sm text-slate-600 max-w-2xl">
                          Choose what we’re doing, then outline each address on the satellite map. We auto-calc the area,
                          time, and cost for every site across Greater Brisbane.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
                          Our Abilities
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Tell us what matters and we’ll shape it to you.
                        </p>
                      </div>
                    )}

                    {/* Estimate summary for small screens */}
                    {/* Scope cards (primary + more options) */}
                    <div className="mt-4 space-y-6">
                      <div className={cls('grid gap-4 md:gap-5', 'md:grid-cols-2')}>
                        {(() => {
                          const scopes =
                            S.service === 'cleaning'
                              ? cleaningScopesForContext(S.context)
                              : SCOPES_BY_SERVICE[S.service] || [];


                          const onSelect = (key: string) => {
                            set('scope', key);
                            setHasInteractedStep2(true);
                            applyScopePreset(S.service, key);
                          };
                          const onAdd = (key: string) => {
                            set('scope', key);
                            setHasInteractedStep2(true);
                            applyScopePreset(S.service, key);
                            set('step', 3);
                          };

                          const renderCard = (sc: any, idx: number, total: number, spanLastOdd = false) => {
                            const isActive = S.scope === sc.key;
                            const hook =
                              (sc.desc && String(sc.desc)) ||
                              (Array.isArray(sc.inclusions) &&
                              sc.inclusions.length
                                ? `${sc.inclusions
                                    .slice(0, 3)
                                    .join(', ')}…`
                                : 'A simple, reliable preset tailored to your place.');
                            const className = spanLastOdd ? 'md:col-span-2' : '';
                            return (
                              <ScopeCard
                                key={sc.key}
                                S={S}
                                sc={sc}
                                isActive={isActive}
                                onSelect={onSelect}
                                onAdd={onAdd}
                                hookText={hook}
                                className={className}
                                activeServiceId={activeServiceId}
                                setActiveServiceId={setActiveServiceId}
                              />
                            );
                          };

                          const nonHelperScopes = scopes.filter((s) => !s.helper);
                          return (
                            <>
                              {scopes.map((sc, idx) => {
                                const nonHelperIndex = sc.helper ? -1 : nonHelperScopes.indexOf(sc);
                                const shouldSpan =
                                  !sc.helper &&
                                  nonHelperScopes.length % 2 === 1 &&
                                  nonHelperIndex === nonHelperScopes.length - 1;
                                return renderCard(sc, idx, scopes.length, shouldSpan);
                              })}
                            </>
                          );
                        })()}
                      </div>

                      {S.service === 'cleaning' && S.context === 'home' && S.step === 2 && S.scope === 'hourly' && (
                        <div className={cls('mt-6', glass, 'rounded-2xl p-4 shadow-[0_12px_40px_rgba(15,23,42,0.12)]')}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">Hourly / Directed — powered by your floor plan</div>
                              <div className="text-xs text-slate-600">
                                Sketch the layout; we convert it to hours and keep the card in sync.
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                                Hours auto-updated
                              </span>
                              <button
                                type="button"
                                className="rounded-full border border-black/10 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-emerald-500"
                                onClick={() => {
                                  set('floorPlanLayout', '');
                                  set('floorPlanEstimate', null);
                                  set('paramsByService', {
                                    ...S.paramsByService,
                                    cleaning: { ...(S.paramsByService.cleaning || {}), hours: 3 },
                                  });
                                  setFloorPlanResetKey((k) => k + 1);
                                }}
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                          <div className="mt-4">
                            <FloorPlanBuilder
                              key={`fp-${floorPlanResetKey}`}
                              onChange={({ items, layout, metrics: _metrics }) => {
                                set('floorPlanLayout', serializeLayout(items));
                                const pricing = computeFloorPricing(layout);
                                set('floorPlanEstimate', pricing);
                                const hours = pricing.billableHours;
                                set('paramsByService', {
                                  ...S.paramsByService,
                                  cleaning: { ...(S.paramsByService.cleaning || {}), hours },
                                });
                              }}
                            />
                          </div>
                          <div className="text-xs text-slate-600 mt-2">
                            {S.floorPlanEstimate
                              ? `${S.floorPlanEstimate.counts.bedrooms} bed · ${S.floorPlanEstimate.counts.bathrooms} bath · ${S.floorPlanEstimate.counts.totalRooms} rooms · ${S.floorPlanEstimate.counts.clutter} clutter · ${S.floorPlanEstimate.billableHours}h bill · $${S.floorPlanEstimate.price}`
                              : 'Drag rooms/furniture to sketch your place; hours and pricing will follow the estimate automatically.'}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );

        return (
          <section className="mb-8" aria-labelledby="step2-heading">
            <h2 id="step2-heading" className="sr-only">
              Step 2: Pick what you need
            </h2>

            <div className={`rounded-2xl p-5 ${glass}`}>
              <div
                className={cls(
                  'grid gap-6 items-start',
                  mapVisible ? 'lg:grid-cols-[minmax(0,420px)_1fr]' : 'lg:grid-cols-1'
                )}
              >
                <div className="space-y-6">{step2Body}</div>

                {mapVisible && (
                  <div className="flex flex-col gap-6 lg:self-start">
                    <div className="flex flex-col gap-4">
                      <StableMapSlot
                        className="w-full rounded-2xl border border-black/10 h-[320px] sm:h-[340px] md:h-[360px] lg:h-[75vh] xl:h-[78vh] 2xl:h-[80vh]"
                        style={{ overflow: 'visible' }}
                      >
                        <iframe
                          ref={iframeRef}
                          title="Yard map"
                          src={mapFrameSrc}
                          loading="lazy"
                          allow="geolocation"
                          sandbox="allow-scripts allow-same-origin allow-popups"
                          className="h-full w-full border-0"
                          onLoad={() => {
                            const polygon = activeYardJob?.polygon_geojson?.[0] || [];
                            postPolygonToIframe(polygon);
                          }}
                        />
                      </StableMapSlot>
                      <div className="flex flex-wrap gap-2">
                        <M.button
                          className="px-4 py-2 rounded-2xl text-sm text-white"
                          style={{ background: 'var(--accent)' }}
                          onClick={() => postMessageToIframe({ type: 'YARD_TOGGLE_DRAWING', enabled: true })}
                        >
                          Draw or edit
                        </M.button>
                        <M.button
                          className="px-4 py-2 rounded-2xl text-sm border border-black/10 bg-white text-slate-900"
                          onClick={resetActivePolygon}
                        >
                          Clear polygon
                        </M.button>
                      </div>
                      <div className="text-xs text-slate-600">
                        Use the map search to find an address, then draw the polygon to capture area, perimeter, and pricing.
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {(S.yardJobs || []).map((job, idx) => {
                          const label = job.address && job.address.trim() ? job.address : `Site ${idx + 1}`;
                          const measurement = measurementLabelForJob(job);
                          const isActive = job.job_id === activeYardJob?.job_id;
                          return (
                            <div key={job.job_id} className="flex items-center gap-1">
                              <button
                                type="button"
                                className={cls(
                                  'flex flex-col text-left leading-tight rounded-full px-3 py-1 text-[11px] transition',
                                  'min-w-[130px]',
                                  isActive
                                    ? 'border border-emerald-600 bg-emerald-50 text-emerald-900 shadow-[0_2px_8px_rgba(16,185,129,0.25)]'
                                    : 'border border-black/10 bg-white/70 text-slate-900 hover:border-black/40'
                                )}
                                onClick={() => set('yardActiveJobId', job.job_id)}
                              >
                                <span className="font-semibold truncate">{label}</span>
                                <span className="text-[10px] text-slate-500 line-clamp-2">{measurement}</span>
                              </button>
                              {S.yardJobs && S.yardJobs.length > 1 && (
                                <button
                                  type="button"
                                  aria-label={`Remove ${label}`}
                                  className="text-[11px] text-rose-600 hover:text-rose-800"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeYardJob(job.job_id);
                                  }}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={addYardJob}
                          className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-900 hover:border-slate-900"
                        >
                          <span aria-hidden="true">+</span>
                          Add site
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })()}
      {/* ===== STEP 3 ===== */}
      {S.step === 3 && (
  <>
    <section className="mb-28" aria-labelledby="step3-heading">
      <h2 id="step3-heading" className="sr-only">
        Step 3: Request your booking
      </h2>

      <div className={`rounded-2xl p-5 ${glass}`}>
        {!hasWork ? (
          <div className="text-sm text-slate-800">
            Add a preset on Step 2 to see an estimate.
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* MAIN: form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-semibold text-slate-900">
                    Request your booking
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    We’ll confirm times and any changes before work proceeds.
                  </p>
                </div>
                <span
                  className={cls(
                    'text-[11px] px-2 py-1 rounded-full self-start',
                    estimate.confidence === 'High'
                      ? 'bg-green-100 text-green-900'
                      : estimate.confidence === 'Medium'
                      ? 'bg-amber-100 text-amber-900'
                      : 'bg-red-100 text-red-900'
                  )}
                  title="Our confidence based on typical variance"
                >
                  {estimate.confidence} confidence
                </span>
              </div>

              {/* Contact */}
              <S3_Card>
                <S3_Title>Contact details</S3_Title>
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <input
                      className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm"
                      placeholder="Full name"
                      value={S.fullName}
                      onChange={(e) => set('fullName', e.target.value)}
                      aria-label="Full name"
                    />
                    {S.fullName.trim().length < 2 && (
                      <div className="text-[11px] text-red-700 mt-1">
                        Please enter your full name.
                      </div>
                    )}
                  </div>
                  <div>
                    <input
                      className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm"
                      placeholder="Email"
                      value={S.email}
                      onChange={(e) => set('email', e.target.value)}
                      onBlur={(e) =>
                        set('email', (e.target.value || '').trim().toLowerCase())
                      }
                      aria-label="Email"
                    />
                    {!/\S+@\S+\.\S+/.test(S.email || '') && (
                      <div className="text-[11px] text-red-700 mt-1">
                        Enter a valid email.
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm"
                      placeholder="Phone"
                      value={S.phone}
                      onChange={(e) =>
                        set(
                          'phone',
                          e.target.value
                            .replace(/\D+/g, '')
                            .replace(/(\d{3})(\d{3})(\d{0,4}).*/, '$1 $2 $3')
                            .trim()
                        )
                      }
                      aria-label="Phone"
                    />
                    {S.phone.replace(/\D+/g, '').length < 8 && (
                      <div className="text-[11px] text-red-700 mt-1">
                        Add your phone number.
                      </div>
                    )}
                  </div>
                </div>
              </S3_Card>

              {/* Location & access */}
              <S3_Card>
                <S3_Title>Location & access</S3_Title>
                <div className="mt-3">
                  <div className="text-xs text-slate-600 mb-1">Service region</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SERVICE_REGIONS.map((r) => (
                      <button
                        type="button"
                        key={r}
                        className={cls(
                          'rounded-2xl px-3 py-2 border text-sm',
                          S.region === r
                            ? 'border-[color:var(--accent)] bg-white'
                            : 'border-black/10 bg-white/70'
                        )}
                        onClick={() => set('region', r as any)}
                        aria-label={`Select region ${r}`}
                      >
                        {r}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="col-span-2 sm:col-span-4 text-xs underline text-slate-700"
                      onClick={() => set('region', '')}
                    >
                      Not listed? Enter suburb manually
                    </button>
                  </div>
                  {S.region === '' && (
                    <div className="mt-2">
                      <input
                        className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm"
                        placeholder="Suburb (e.g., Calamvale)"
                        value={typeof S.region === 'string' ? S.region : ''}
                        onChange={(e) => set('region', e.target.value)}
                        aria-label="Suburb"
                      />
                    </div>
                  )}
                  {S.region && !servicedRegion && (
                    <div className="text-[11px] text-red-700 mt-1">
                      We currently service the listed regions only.
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <div className="text-xs text-slate-600 mb-1">Access notes</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={cls(
                        'px-2.5 py-1 rounded-full text-xs border',
                        S.paidParking
                          ? 'border-[color:var(--accent)] bg-white'
                          : 'border-black/10 bg-white/70'
                      )}
                      onClick={() => set('paidParking', !S.paidParking)}
                    >
                      Paid/Street parking
                    </button>
                    <button
                      type="button"
                      className={cls(
                        'px-2.5 py-1 rounded-full text-xs border',
                        S.secondStorey
                          ? 'border-[color:var(--accent)] bg-white'
                          : 'border-black/10 bg-white/70'
                      )}
                      onClick={() => set('secondStorey', !S.secondStorey)}
                    >
                      Second storey
                    </button>
                    <button
                      type="button"
                      className={cls(
                        'px-2.5 py-1 rounded-full text-xs border',
                        S.afterHours
                          ? 'border-[color:var(--accent)] bg-white'
                          : 'border-black/10 bg-white/70'
                      )}
                      onClick={() => set('afterHours', !S.afterHours)}
                    >
                      After-hours (post-6pm)
                    </button>

                    <details className="text-xs text-slate-700">
                      <summary className="cursor-pointer px-1.5 py-0.5 rounded bg-white/60 border border-black/10 inline-block ml-1">
                        More
                      </summary>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={cls(
                            'px-2.5 py-1 rounded-full text-xs border',
                            S.clutterAccess
                              ? 'border-[color:var(--accent)] bg-white'
                              : 'border-black/10 bg-white/70'
                          )}
                          onClick={() => set('clutterAccess', !S.clutterAccess)}
                        >
                          Tight access
                        </button>
                        <button
                          type="button"
                          className={cls(
                            'px-2.5 py-1 rounded-full text-xs border',
                            S.petHair
                              ? 'border-[color:var(--accent)] bg-white'
                              : 'border-black/10 bg-white/70'
                          )}
                          onClick={() => set('petHair', !S.petHair)}
                        >
                          Pets present
                        </button>
                      </div>
                    </details>
                  </div>
                </div>
              </S3_Card>

              {!(S.context === 'commercial' && S.service === 'cleaning') && (
                <S3_Card>
                  <S3_Title>Job complexity</S3_Title>
                  <div className="mt-2">
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={1}
                      value={
                        (['small', 'standard', 'large'] as const).indexOf(S.sizeAdjust)
                      }
                      onChange={(e) => {
                        const idx = Number(e.target.value);
                        const sizes = ['small', 'standard', 'large'] as const;
                        const chosen = sizes[idx] ?? 'standard';
                        set('sizeAdjust', chosen);
                        if (chosen === 'small') {
                          set('contractDiscount', 0 as any);
                          set('conditionFlat', 0 as any);
                        }
                        if (chosen === 'standard') {
                          set('contractDiscount', 0.1 as any);
                          set('conditionFlat', 20 as any);
                        }
                        if (chosen === 'large') {
                          set('contractDiscount', 0.15 as any);
                          set('conditionFlat', 35 as any);
                        }
                      }}
                      className="w-full"
                      aria-label="Job size slider"
                    />
                    <div className="flex justify-between text-[11px] text-slate-600 mt-1">
                      <span>Small</span>
                      <span>Standard</span>
                      <span>Large</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    {(['light', 'standard', 'heavy'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        className={cls(
                          'px-2.5 py-1 rounded-full border',
                          S.conditionLevel === lvl
                            ? 'border-[color:var(--accent)] bg-white'
                            : 'border-black/10 bg-white/70'
                        )}
                        onClick={() => set('conditionLevel', lvl)}
                      >
                        {lvl[0].toUpperCase() + lvl.slice(1)} condition
                      </button>
                    ))}
                  </div>

                  <textarea
                    className="mt-3 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm"
                    rows={3}
                    placeholder="Anything else? (gate code, preferred dates/times, parking notes, pets, etc.)"
                    value={S.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    aria-label="Notes"
                  />
                </S3_Card>
              )}

              {/* Business expense */}
              <S3_Card>
                <label className="inline-flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={S.isBusinessExpense}
                    onChange={(e) => set('isBusinessExpense', e.target.checked)}
                  />
                  Need a GST invoice
                </label>
                <div className="text-[11px] text-slate-600 mt-1">
                  We’ll include GST and invoice details in the confirmation.
                </div>
              </S3_Card>

              <div className="text-[11px] text-slate-600 text-center">
                You won’t be charged now. We’ll confirm any price changes before work
                proceeds.
              </div>
            </div>

            {/* SIDEBAR */}
            <aside className={cls('lg:col-span-1 h-fit', !yardActive && 'lg:sticky lg:top-6')}>
              <S3_Card className="relative overflow-hidden">
                <div
                  className="absolute inset-x-0 -top-1 h-1 rounded-t-2xl"
                  style={{
                    background: `linear-gradient(90deg, ${ACCENT}, #22c55e)`,
                  }}
                />
                {S.service === 'yard' ? (
                  (() => {
                    const siteCount = S.yardJobs?.length || 0;
                    const siteLabel = `${siteCount} site${siteCount === 1 ? '' : 's'}`;
                    const yardDetail = `${siteLabel} · ${fmtHrMin(estimate.minutes)}`;
                    return (
                      <div className="mt-4 space-y-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-600">
                          Final yard price
                        </div>
                        <div className="text-4xl font-semibold mt-1 text-slate-900">
                          {priceLabel}
                        </div>
                        <div className="text-xs text-slate-600">
                          {yardDetail}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-slate-600">
                          Your quote
                        </div>
                        <div className="text-4xl font-semibold mt-1">
                          {priceLabel}
                        </div>
                        <div className="text-xs text-slate-600 mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {timeLabel}
                          {estimate.hourlyUsed ? (
                            <>
                              {' '}
                              · {fmtAUD(estimate.hourlyUsed)}/hr
                            </>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={cls(
                          'text-[11px] px-2 py-1 rounded-full self-start',
                          estimate.confidence === 'High'
                            ? 'bg-green-100 text-green-900'
                            : estimate.confidence === 'Medium'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-red-100 text-red-900'
                        )}
                        title="Our confidence based on typical variance"
                      >
                        {estimate.confidence} confidence
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      <S3_Row k="Per-items" v={fmtAUD(estimate.unitSum)} />
                      {estimate.labourFloor ? (
                        <S3_Row
                          k="Time minimum"
                          v={fmtAUD(estimate.labourFloor)}
                        />
                      ) : null}
                      <S3_Row
                        k="Adjusted (size/condition/contract)"
                        v={fmtAUD(estimate.baseBeforeFees)}
                      />
                      <S3_Row
                        k="Travel / Parking / Tip"
                        v={fmtAUD(
                          estimate.travel + estimate.parking + estimate.tip
                        )}
                      />
                      <S3_Row
                        k="Materials (consumables)"
                        v={fmtAUD(
                          S.service === 'cleaning'
                            ? S.context === 'commercial'
                              ? 12
                              : 8
                            : 0
                        )}
                      />
                      <div className="h-[1px] bg-white/60 my-2" />
                      <S3_Row k="Total" v={priceLabel} bold />
                      <div className="text-[11px] text-slate-600">
                        {PRICE_SCOPE_DISCLAIMER}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {FAIRNESS_PROMISE_COPY}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {TERMS_SNIPPET}
                      </div>

                      <div className="text-xs text-slate-600 mt-2">
                        Need to change what’s included?{' '}
                        <button
                          type="button"
                          className="underline"
                          onClick={() => goToStep(2)}
                        >
                          Edit scope
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Actions */}
                <div className="mt-4 flex flex-col gap-2">
                  <M.button
                    className="px-4 py-2 rounded-2xl text-sm text-white"
                    style={{ background: 'var(--accent)' }}
                    onClick={() => goToStep(2)}
                    aria-label="Back to Step 2"
                  >
                    Back
                  </M.button>

                  <M.button
                    className="px-4 py-2 rounded-2xl text-sm text-white flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(20,83,45,0.25)]"
                    style={{ background: 'var(--accent)' }}
                    onClick={() => {
                      const okInputs =
                        S.fullName?.trim().length >= 2 &&
                        /\S+@\S+\.\S+/.test(S.email || '') &&
                        S.phone.replace(/\D+/g, '').length >= 8 &&
                        Boolean(servicedRegion);

                      if (!okInputs) {
                        toast.error(
                          'Please complete your details and select a serviced region.'
                        );
                        return;
                      }

                      const body = buildQuoteSummary(S, estimate, scopedPricing);
                      const href = emailHrefForContext(S, body);
                      window.location.href = href;

                      setTimeout(() => {
                        const ok = confirm(
                          'Did your email send successfully? This helps show real examples to others.'
                        );
                        if (ok) {
                          toast.success(
                            'Thanks! Added your example (time, cost, and location).'
                          );
                        } else {
                          toast.message('No worries. We didn’t add it.');
                        }
                      }, 600);
                    }}
                    aria-label="Request booking via email"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      className="opacity-90"
                      aria-hidden="true"
                    >
                      <path
                        d="M20 6L9 17l-5-5"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Request booking
                  </M.button>

                  <div className="text-xs text-slate-600 text-center">
                    Or{' '}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        const body = buildQuoteSummary(S, estimate, scopedPricing);
                        const href = emailHrefForContext(S, body);
                        window.location.href = href;

                        setTimeout(() => {
                          const ok = confirm(
                            'Did your email send successfully? This helps show real examples to others.'
                          );
                          if (ok) {
                            toast.success(
                              'Thanks! Added your example (time, cost, and location).'
                            );
                          } else {
                            toast.message('No worries. We didn’t add it.');
                          }
                        }, 600);
                      }}
                      aria-label="Email this quote"
                    >
                      email this quote
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-1">
                  <S3_Chip>Insured</S3_Chip>
                  <S3_Chip>GST invoice ready</S3_Chip>
                  {S.region && SERVICE_REGIONS.includes(S.region as any) ? (
                    <S3_Chip>In service area</S3_Chip>
                  ) : S.region ? (
                    <S3_Chip>Outside area</S3_Chip>
                  ) : null}
                </div>
              </S3_Card>
            </aside>
          </div>
        )}
      </div>
    </section>

        </>
      )}
              </div>

            </div>
          </div>
        </div>



{/* Live orders strip sits below the main flow so Steps 1–3 stay the focal point */}
{S.service !== 'yard' && (
  <section className="mt-[160vh] mb-28">
    <LiveOrdersStrip />
  </section>
)}

{/* Spacer for sticky footer */}
{S.service !== 'yard' && (S.step === 2 || S.step === 3) && <div className="h-28" />}

{/* Sticky footer for STEP 2 */}
{S.service !== 'yard' && S.step === 2 && (
  <div
    className="fixed left-0 right-0 pointer-events-none z-40"
    style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    aria-live="polite"
  >
    <M.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-3xl px-4"
    >
      <div
        className={`pointer-events-auto flex items-center justify-between rounded-2xl px-4 py-3 ${glass}`}
        role="region"
        aria-label="Step 2 price bar"
      >
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-600">
              Price for this scope
            </div>
            <div className="text-2xl font-bold">{priceLabel}</div>
            <div className="text-xs text-slate-600 mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {timeLabel}
            </div>
            {usesRoutePricing && (
              <div className="text-xs text-slate-600 mt-1" aria-live="polite">
                {routeDistanceLabel ??
                  (routeLookupLoading ? 'Calculating travel details…' : 'Add both addresses for travel info.')}
              </div>
            )}
            <div className="text-[11px] text-slate-600 mt-1">
              {PRICE_SCOPE_DISCLAIMER}
            </div>
          <div className="text-[11px] text-slate-600">
            {FAIRNESS_PROMISE_COPY}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <M.button
            className="px-4 py-2 rounded-2xl text-sm text-white"
            style={{ background: 'var(--accent)' }}
            onClick={() => goToStep(1)}
            aria-label="Back to step 1"
          >
            Back
          </M.button>
          <M.button
            className="px-4 py-2 rounded-2xl text-sm text-white"
            style={{ background: 'var(--accent)' }}
            onClick={() => goToStep(3)}
            aria-label="See full quote"
          >
            See Quote
          </M.button>
        </div>
      </div>
    </M.div>
  </div>
)}

{S.service === 'yard' && S.step === 2 && (() => {
  const polygonReady = (S.yardPolygon?.[0]?.length ?? 0) >= 3;
  const priceReady = polygonReady && estimate.total > 0;
  const siteCount = S.yardJobs?.length || 0;
  const siteLabel = `${siteCount} site${siteCount === 1 ? '' : 's'} mapped`;
  const measurementHint = activeMeasurementLabel
    ? `${siteLabel} · ${activeMeasurementLabel}`
    : siteLabel;
  return (
    <div
      className="fixed left-0 right-0 pointer-events-none z-40"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      aria-live="polite"
    >
      <M.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-3xl px-4"
      >
        <div
          className="pointer-events-auto rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl"
          role="region"
          aria-label="Yard mapping price bar"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Exact price</div>
              <div className="text-3xl font-semibold text-slate-900" aria-live="polite">
                {priceReady ? priceLabel : 'Draw a polygon to reveal price'}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                {priceReady ? measurementHint : 'Complete a polygon to reveal calm pricing.'}
              </div>
            </div>
            <M.button
              className={cls(
                'px-4 py-2 rounded-2xl text-sm font-semibold text-white transition',
                priceReady ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--accent)]/70'
              )}
              onClick={() => {
                if (!priceReady) return;
                goToStep(3);
              }}
              disabled={!priceReady}
              aria-label="Review yard quote"
            >
              Review quote
            </M.button>
          </div>
        </div>
      </M.div>
    </div>
  );
})()}
        </div>
      </main>
      {S.service !== 'yard' && (
        <style jsx global>{`
          [data-yard-active] .blob,
          [data-yard-active] [class*='motion'],
          [data-yard-active] [style*='will-change'],
          [data-yard-active] [style*='filter'] {
            animation: none !important;
            transition: none !important;
            filter: none !important;
            will-change: auto !important;
          }
          .blob {
            width: 560px;
            height: 560px;
            border-radius: 9999px;
            filter: blur(50px);
            opacity: 0.35;
            will-change: transform;
            animation-duration: 24s;
            animation-timing-function: ease-in-out;
            animation-iteration-count: infinite;
          }
          .blob-a {
            background: radial-gradient(closest-side, ${ACCENT}55, transparent 70%);
            animation-name: blobFloatA;
            top: -160px;
            right: -140px;
            position: absolute;
          }
          .blob-b {
            background: radial-gradient(closest-side, #ff6b6b55, transparent 70%);
            animation-name: blobFloatB;
            bottom: -180px;
            left: -120px;
            position: absolute;
          }
          @keyframes blobFloatA {
            0% {
              transform: translate(0, 0);
            }
            50% {
              transform: translate(20px, -20px);
            }
            100% {
              transform: translate(0, 0);
            }
          }
          @keyframes blobFloatB {
            0% {
              transform: translate(0, 0);
            }
            50% {
              transform: translate(-20px, 20px);
            }
            100% {
              transform: translate(0, 0);
            }
          }

          /* Subtle page background */
          body {
            background:
              radial-gradient(600px circle at 18% 20%, #e8f5ee 0, transparent 40%),
              radial-gradient(800px circle at 85% 0, #fdf2f2 0, transparent 45%),
              linear-gradient(180deg, #f9fbfd 0%, #eef3f7 100%);
          }
        `}</style>
      )}
      </div>
    </MotionContext.Provider>
  );
}
