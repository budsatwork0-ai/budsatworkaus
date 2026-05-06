'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { sendGAEvent } from '@next/third-parties/google';
import { trackQuoteSubmitted } from '@/lib/analytics/conversions';
import { getPublicAnalyticsSessionId, trackPublicAnalyticsEvent } from '@/lib/analytics/public';
import type { AnalyticsEventData } from '@/lib/analytics/shared';
import { SMALL_JOB_PAYMENT_COPY } from '@/lib/payments/pricing';
import StableMapSlot from '@/components/StableMapSlot';
import {
  usePolygonQuote,
  computeAreaFromPath,
  computePerimeterFromPath,
} from '@/app/ui/yard/usePolygonQuote';
import dynamic from 'next/dynamic';
import { serializeLayout } from '@/app/ui/floor/utils';
import { computeFloorPricing } from '@/app/ui/floor/useFloorPricing';
import { useCarModelSelector } from '@/app/ui/car/useCarModelSelector';
import RegoLookupAssistant from '@/app/ui/car/RegoLookupAssistant';
const FloorPlanBuilder = dynamic(() => import('@/app/ui/floor/FloorPlanBuilder'), { ssr: false });
import type { VehicleSizeCategory } from '@/lib/rego/types';
import { useYardMapping } from '@/app/hooks/useYardMapping';
// Loaded lazily — only when the user reaches the contact form (step 3).
const Turnstile = dynamic(() => import('@/components/Turnstile'), { ssr: false });

// Extracted modules - Types
import type {
  Context,
  ServiceType,
  ScopeKey,
  CommFrequency,
  NdisManagementType,
  WizardState,
  SneakerTurnaround,
  RouteLookupResult,
  RouteScopeKey,
  YardJob,
  CommercialCleaningType,
  ScopeDef,
  DumpRunSelection,
  DeliverySelection,
  TransportSelection,
  CleaningWizardChecklistState,
  LaundryPerLoadAddOn,
  LaundryPerOrderAddOn,
  IroningItemType,
  IroningItem,
} from './types';

// Extracted modules - Constants
import {
  ACCENT,
  glass,
  ROUTE_BASE_FEE,
  ROUTE_PER_KM_RATE,
  ROUTE_PER_MIN_RATE,
  ROUTE_MIN_PRICE,
  ROUTE_SCOPES,
  SERVICE_REGIONS,
  ALLOWED_SERVICES_BY_CONTEXT,
  DEFAULT_DUMP_RUN,
  DEFAULT_DUMP_DELIVERY,
  DEFAULT_DUMP_TRANSPORT,
  AUTO_SIZE_CATEGORIES,
  SNEAKER_TURNAROUND_META,
  SNEAKER_MULTI_PRICING,
  LAUNDRY_PER_LOAD_ADDONS,
  LAUNDRY_PER_ORDER_ADDONS,
  LAUNDRY_IRONING_PRICES,
} from './lib/pricing/constants';

// Extracted modules - Utilities
import {
  cls,
  titleCase,
  fmtAUD,
  fmtHrMin,
  canonicalServiceRegion,
} from './utils/formatting';

// Extracted modules - Motion
import { MotionContext, M } from './utils/motion';

// Extracted modules - Routing
import {
  fallbackRoute,
  formatRouteKey,
  fetchDrivingDistance,
  roundToHalfKm,
} from './lib/routing';

// Extracted modules - Shared UI Components
import { Tile, glassCard } from './components/shared/UIComponents';

// Extracted modules - Service data & helpers
import {
  SERVICES,
  TERMS_SNIPPET,
  PRICE_SCOPE_DISCLAIMER,
  FAIRNESS_PROMISE_COPY,
  STORAGE_KEY,
  CLEAN_SCOPES,
  SCOPES_BY_SERVICE,
  YARD_MEASUREMENT_UNITS,
  getYardMeasurementConfig,
  COMM_PARAM_DEFS,
  COMM_LABELS,
  TURNSTILE_SITE_KEY,
} from './lib/service-data';
import {
  defaultParamsByService,
  computeWindowsMinutes,
  scopePresetFor,
  buildCleaningChecklistFromWizard,
  createYardJob,
} from './lib/service-helpers';

// Extracted modules - Pricing engine
import {
  COMM_PRESET_PRICING,
  computeCleaningAddons,
  computeHomeExtras,
  selectedFromParams,
  hourlyRate,
  sneakerTurnaroundMeta,
  computeYardQuote,
  priceQuote,
} from './lib/pricing/engine';

// NDIS pricing — shared with the Quote Assistant so live estimates and
// Step 2 always agree. Rates are Price-Guide-tabled (weekday daytime,
// Saturday, Sunday, public holiday) with an MMM region modifier on top.
// Weekday evening intentionally omitted — we only operate 7am–5pm.
import {
  NDIS_MIN_HOURS,
  NDIS_MAX_HOURS,
  NDIS_RATE_LABELS,
  NDIS_REGION_LABELS,
  ndisRateFor,
  suggestNdisCleaningHours,
  suggestNdisYardHours,
} from './lib/pricing/ndis';
import type { NdisRegion } from './lib/pricing/ndis';

// Extracted modules - Wizard state
import { getInitialState, wizardReducer, useLocalStorageReducer } from './lib/wizard-state';

// Extracted modules - Estimation
import {
  sumSelected,
  BASE_CALLOUT_PRICE,
  PHYSICAL_BLOCK_RANGE,
  calculateEstimatedPrice,
  calculateServicePrice,
  adjustedTypicalMinutes,
  notifyDelta,
  buildQuoteSummary,
  emailHrefForContext,
} from './lib/estimation';

// Quote Assistant
import { useAssistant } from './assistant/useAssistant';
import { QuoteAssistantPanel } from './assistant/QuoteAssistantPanel';
import { QuoteAssistantTrigger } from './assistant/QuoteAssistantTrigger';

// Transport / Delivery dedicated pricing
import {
  calcTransportQuote,
  calcDeliveryQuote,
} from './lib/pricing/transport';

// Extracted modules - Glass UI
import {
  S3_Card,
  S3_Title,
  S3_Row,
  S3_Chip,
  getFrequencyLabel,
} from './components/shared/GlassUI';

// Extracted modules - Standalone components
import { LiveOrdersStrip } from './components/shared/LiveOrdersStrip';
// Lazy-loaded — only needed inside Step 2 for specific services.
const WindowsEditor = dynamic(
  () => import('./components/windows/WindowsEditor').then(m => ({ default: m.WindowsEditor })),
  { ssr: false }
);
const DistanceRouteConfigurator = dynamic(
  () => import('./components/dump/DistanceRouteConfigurator').then(m => ({ default: m.DistanceRouteConfigurator })),
  { ssr: false }
);
import { ServiceAddressInput } from './components/shared/ServiceAddressInput';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Catches render errors inside Step 2 so a single broken service config
// doesn't crash the entire wizard.
class Step2ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error('[Step2] Render error:', err, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 my-4">
          <div className="font-semibold mb-1">Something went wrong building your quote.</div>
          <button
            className="underline text-red-700"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
          {' or '}
          <button
            className="underline text-red-700"
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
          >
            refresh the page
          </button>.
        </div>
      );
    }
    return this.props.children;
  }
}

// Isolated slider component so dragging doesn't re-render the entire ServicesPageContent.
// Keeps a local display-value and only propagates the final value on pointer/touch release.
type CommSqmSliderProps = { value: number; onChange: (v: number) => void };
function CommSqmSlider({ value, onChange }: CommSqmSliderProps) {
  const [local, setLocal] = React.useState(value);
  // Keep in sync when the parent changes the value externally (e.g. preset button click).
  React.useEffect(() => { setLocal(value); }, [value]);
  const commit = React.useCallback(() => onChange(local), [local, onChange]);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-slate-700">Approx. area</div>
        <div className="text-[11px] text-slate-600">{local} sqm</div>
      </div>
      <input
        type="range"
        min={50}
        max={3000}
        step={50}
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        onMouseUp={commit}
        onTouchEnd={commit}
        onClick={stop}
        onPointerDown={stop}
        onTouchStart={stop}
        onTouchMove={stop}
        className="w-full accent-emerald-600"
        // pan-y lets the browser handle vertical scroll but gives horizontal drag to the slider
        style={{ touchAction: 'pan-y' }}
        aria-label="Square metres slider"
      />
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>50</span>
        <span>1500</span>
        <span>3000</span>
      </div>
    </div>
  );
}

// Module-level constants — pure static data, hoisted out of the render IIFE so they
// are allocated once per module load rather than on every Step 2 render.
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

const NDIS_ACCENT = '#6d28d9';

// NDIS caps, min/max hours, and suggestion helpers now live in
// lib/pricing/ndis.ts so the Quote Assistant can share the same source of truth.

const CONTEXT_OPTIONS: { key: Context; label: string; activeColor: string }[] = [
  { key: 'home', label: 'Home', activeColor: ACCENT },
  { key: 'commercial', label: 'Commercial', activeColor: ACCENT },
  { key: 'ndis', label: 'NDIS', activeColor: NDIS_ACCENT },
];

const CONTEXT_LABELS: Record<Context, string> = {
  home: 'Home',
  commercial: 'Commercial',
  ndis: 'NDIS',
};

type MmmDetectionState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'detected'; label: string }
  | { status: 'failed'; message: string };

type MmmApiResponse = {
  rawMMM: number;
  pricingRegion: 'metro' | 'regional' | 'remote' | 'veryRemote';
  label: string;
  geocode?: {
    address: string;
    lat: number;
    lng: number;
    score: number;
  };
};

const RESIDENTIAL_CLEANING_SCOPE_LABELS: Record<string, string> = {
  weekly: 'Weekly Clean',
  general: 'Standard Clean',
  deep: 'Deep Clean',
  endoflease: 'Move In / Out',
  hourly: 'Hourly / Directed',
};

const NDIS_MANAGEMENT_OPTIONS: {
  key: NdisManagementType;
  title: string;
  description: string;
  destination: string;
}[] = [
  {
    key: 'plan_managed',
    title: 'Plan-Managed',
    description: 'We send the quote straight to the participant’s plan management provider for budgeting and payment processing.',
    destination: 'Send to the participant’s Plan Management Provider',
  },
  {
    key: 'self_managed',
    title: 'Self-Managed',
    description: 'We send the quote directly to the participant or their nominee so they can pay and claim back through the NDIS.',
    destination: 'Send to the participant or nominee/family',
  },
  {
    key: 'agency_managed',
    title: 'Agency-Managed (NDIA)',
    description: 'We send the quote to the participant first. After approval, an NDIS-registered provider creates the service booking in myplace.',
    destination: 'Send to the participant for review and acceptance',
  },
];

/** Compact +/– stepper for room/unit counts. Handles stopPropagation internally. */
function NumberStepper({ label, value, onStep }: {
  label: string;
  value: number;
  onStep: (delta: 1 | -1) => void;
}) {
  return (
    <div className="rounded-full border border-black/10 bg-white/80 px-1.5 py-0.5 inline-flex items-center gap-1">
      <span className="font-semibold text-slate-700">{label}</span>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10"
        onClick={(e) => { e.stopPropagation(); onStep(-1); }}
      >–</button>
      <span className="min-w-[16px] text-center font-semibold text-slate-900">{value}</span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10"
        onClick={(e) => { e.stopPropagation(); onStep(1); }}
      >+</button>
    </div>
  );
}

// ---------- module-level constants (used by ScopeCard) ----------
const RECOMMENDED: Record<string, string[]> = {
  windows: ['windows_full', 'windows_interior'],
  cleaning: ['general', 'deep'],
  yard: ['yard_mow', 'yard_leaves'],
  auto: ['auto_express'],
  dump: ['dump_runs'],
  laundry_sneakers: ['laundry'],
};

// ---------- module-level helpers (pure, no hooks) ----------
const isRec = (svc: string, key: string) => !!RECOMMENDED[svc]?.includes(key);

const cleaningAddonsForScope = (scopeKey: ScopeKey, cleaningAddons: WizardState['cleaningAddons']) =>
  (cleaningAddons && cleaningAddons[scopeKey]) || {};

const cleaningParamsForScope = (
  scopeKey: ScopeKey,
  scope: string,
  paramsByService: WizardState['paramsByService'],
  context: WizardState['context'],
  cleaningAddons: WizardState['cleaningAddons']
) => {
  if (scopeKey === scope) {
    return {
      ...(paramsByService.cleaning || {}),
      ...cleaningAddonsForScope(scopeKey, cleaningAddons),
    };
  }
  const defaults = defaultParamsByService().cleaning || {};
  const preset = scopePresetFor('cleaning', scopeKey, context) || {};
  return { ...defaults, ...preset, ...cleaningAddonsForScope(scopeKey, cleaningAddons) };
};

const computeMins = (S: WizardState, service: ServiceType, scopeKey: ScopeKey, conditionMult: number) => {
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
  // Lock residential/NDIS cleaning presets to fixed hours
  if (service === 'cleaning' && S.context !== 'commercial') {
    if (scopeKey === 'hourly') {
      const params = cleaningParamsForScope(scopeKey, S.scope, S.paramsByService, S.context, S.cleaningAddons);
      return (params.hours || 1) * 60;
    }
    const params = cleaningParamsForScope(scopeKey, S.scope, S.paramsByService, S.context, S.cleaningAddons);
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
  return adjustedTypicalMinutes(S, service, scopeKey);
};

// ---------- card component (simple presets) ----------
type ScopeCardProps = {
  S: WizardState;
  sc: any;
  isActive: boolean;
  onSelect: (key: string) => void;
  onAdd: (key: string) => void;
  hookText: string;
  className?: string;
  activeServiceId: string | null;
  setActiveServiceId: React.Dispatch<React.SetStateAction<string | null>>;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  setMany: (values: Partial<WizardState>) => void;
  setHasInteractedStep2: React.Dispatch<React.SetStateAction<boolean>>;
  openChecklists: Record<string, boolean>;
  setOpenChecklists: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  notifyDelta: (prevMin: number, nextMin: number) => void;
  conditionMult: number;
  carSelector: ReturnType<typeof useCarModelSelector>;
  laundryIroningOpen: boolean;
  setLaundryIroningOpen: React.Dispatch<React.SetStateAction<boolean>>;
  routeExpanded: boolean;
  setRouteExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  transportRouteExpanded: boolean;
  setTransportRouteExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  routeLookup: RouteLookupResult | null;
  routeLookupLoading: boolean;
  routeLookupMessage: string | null;
  routeDistanceLabel: string | null;
  handleDistanceInputFocusChange: (focused: boolean) => void;
  handleDistancePlaceSelected: () => void;
  laundryAddOnTotal: number;
  priceLabelBase: string;
  isSneakerTurnaroundAvailable: (key: SneakerTurnaround) => boolean;
};

function scopeCardPropsAreEqual(prev: ScopeCardProps, next: ScopeCardProps): boolean {
  // Always re-render if scope selection or activity changes
  if (prev.isActive !== next.isActive) return false;
  if (prev.sc.key !== next.sc.key) return false;
  if (prev.activeServiceId !== next.activeServiceId) return false;
  if (prev.hookText !== next.hookText) return false;
  if (prev.className !== next.className) return false;

  // Wizard state fields that affect all cards
  if (prev.S.service !== next.S.service) return false;
  if (prev.S.scope !== next.S.scope) return false;
  if (prev.S.context !== next.S.context) return false;
  if (prev.S.conditionLevel !== next.S.conditionLevel) return false;

  // Service-specific state — only check what this card's service uses
  const svc = next.S.service;
  if (svc === 'cleaning') {
    if (prev.S.paramsByService.cleaning !== next.S.paramsByService.cleaning) return false;
    if (prev.S.cleaningAddons !== next.S.cleaningAddons) return false;
    if (prev.S.commercialCleaningType !== next.S.commercialCleaningType) return false;
    if (prev.S.commPreset !== next.S.commPreset) return false;
    if (prev.S.commFrequency !== next.S.commFrequency) return false;
    if (prev.conditionMult !== next.conditionMult) return false;
  }
  if (svc === 'windows') {
    if (prev.S.winRows !== next.S.winRows) return false;
    if (prev.S.paramsByService.windows !== next.S.paramsByService.windows) return false;
  }
  if (svc === 'dump') {
    if (prev.S.dumpRun !== next.S.dumpRun) return false;
    if (prev.S.dumpDelivery !== next.S.dumpDelivery) return false;
    if (prev.S.dumpTransport !== next.S.dumpTransport) return false;
    if (prev.S.paramsByService.dump !== next.S.paramsByService.dump) return false;
    if (prev.routeExpanded !== next.routeExpanded) return false;
    if (prev.transportRouteExpanded !== next.transportRouteExpanded) return false;
    if (prev.routeLookup !== next.routeLookup) return false;
    if (prev.routeLookupLoading !== next.routeLookupLoading) return false;
    if (prev.routeLookupMessage !== next.routeLookupMessage) return false;
    if (prev.routeDistanceLabel !== next.routeDistanceLabel) return false;
    if (prev.S.distanceKm !== next.S.distanceKm) return false;
  }
  if (svc === 'auto') {
    if (prev.carSelector !== next.carSelector) return false;
    if (prev.S.paramsByService.auto !== next.S.paramsByService.auto) return false;
    if (prev.S.carDetectedVehicle !== next.S.carDetectedVehicle) return false;
  }
  if (svc === 'laundry_sneakers') {
    if (prev.S.laundryLoads !== next.S.laundryLoads) return false;
    if (prev.S.laundryPerLoadAddOns !== next.S.laundryPerLoadAddOns) return false;
    if (prev.S.laundryPerOrderAddOns !== next.S.laundryPerOrderAddOns) return false;
    if (prev.S.laundryIroningItems !== next.S.laundryIroningItems) return false;
    if (prev.S.sneakerTier !== next.S.sneakerTier) return false;
    if (prev.S.sneakerPairCount !== next.S.sneakerPairCount) return false;
    if (prev.S.sneakerTurnaround !== next.S.sneakerTurnaround) return false;
    if (prev.laundryIroningOpen !== next.laundryIroningOpen) return false;
    if (prev.laundryAddOnTotal !== next.laundryAddOnTotal) return false;
    if (prev.priceLabelBase !== next.priceLabelBase) return false;
    if (prev.isSneakerTurnaroundAvailable !== next.isSneakerTurnaroundAvailable) return false;
  }
  if (svc === 'yard') {
    if (prev.S.paramsByService.yard !== next.S.paramsByService.yard) return false;
    if (prev.S.yardArea !== next.S.yardArea) return false;
    if (prev.conditionMult !== next.conditionMult) return false;
  }

  // Checklist open state for this card's key
  const key = next.sc.key;
  if ((prev.openChecklists[key] ?? false) !== (next.openChecklists[key] ?? false)) return false;

  // All stable — skip re-render
  return true;
}

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
  set,
  setMany,
  setHasInteractedStep2,
  openChecklists,
  setOpenChecklists,
  notifyDelta,
  conditionMult,
  carSelector,
  laundryIroningOpen,
  setLaundryIroningOpen,
  routeExpanded,
  setRouteExpanded,
  transportRouteExpanded,
  setTransportRouteExpanded,
  routeLookup,
  routeLookupLoading,
  routeLookupMessage,
  routeDistanceLabel,
  handleDistanceInputFocusChange,
  handleDistancePlaceSelected,
  laundryAddOnTotal,
  priceLabelBase,
  isSneakerTurnaroundAvailable,
}: ScopeCardProps) {
  const dumpRunState = S.dumpRun || DEFAULT_DUMP_RUN;
  const deliveryState = S.dumpDelivery || DEFAULT_DUMP_DELIVERY;
  const transportState = S.dumpTransport || DEFAULT_DUMP_TRANSPORT;
  const dumpLoadType = dumpRunState.loadType;
  const dumpLoads = Math.max(1, Math.round(dumpRunState.loads || 1));
  const deliveryType = deliveryState.itemType;
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
  const [deliveryItemQty, setDeliveryItemQty] = React.useState(1);
  const showSheet = !!openChecklists[sc.key];
  const _popoverId = React.useId(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const minutes = computeMins(S, S.service as ServiceType, sc.key as ScopeKey, conditionMult);
  const recommended = isRec(S.service as string, sc.key as string);
  const hourlyRateDisplay =
    S.service === 'cleaning' && sc.key === 'hourly'
      ? `${fmtAUD(hourlyRate(S.context, 'cleaning', 'hourly', S.commercialCleaningType))}/hr`
      : null;
  const hourlyHours =
    S.service === 'cleaning' && sc.key === 'hourly'
      ? Math.max(3, Math.round(S.paramsByService.cleaning?.hours ?? 3))
      : null;
  const isHomeCleaning = S.service === 'cleaning' && S.context !== 'commercial';
  const isCommercialCleaning = S.service === 'cleaning' && S.context === 'commercial';
  const commercialNicheKeys: CommercialCleaningType[] = ['office', 'medical', 'fitness', 'hospitality', 'education', 'event', 'accommodation'];
  const isCommercialNicheCard = isCommercialCleaning && commercialNicheKeys.includes(sc.key as CommercialCleaningType);
  const isHourlyCard = isHomeCleaning && sc.key === 'hourly';
  const isCleaningWizardCard = isHomeCleaning && !isHourlyCard;
  const addonsQuick: { key: string; label: string }[] = [];
  const addonsState = cleaningAddonsForScope(sc.key, S.cleaningAddons);
  const labelId = `sc-${sc.key}-label`;
  const hookId = `sc-${sc.key}-desc`;
  const isCarCleaning = S.service === 'auto';
  const isCleaning = S.service === 'cleaning';
  const isDumpRunsCard = S.service === 'dump' && sc.key === 'dump_runs';
  const isDeliveryCard = S.service === 'dump' && sc.key === 'dump_delivery';
  const isTransportCard = S.service === 'dump' && sc.key === 'dump_transport';
  // Laundry & Sneaker Care card detection
  const isLaundryCard = S.service === 'laundry_sneakers' && sc.key === 'laundry';
  const isSneakerCareCard = S.service === 'laundry_sneakers' && sc.key === 'sneaker_care';
  // Legacy sneaker card detection (for backward compatibility)
  const isSneakerRefresh = S.service === 'laundry_sneakers' && (sc.key === 'sneaker_basic' || (sc.key === 'sneaker_care' && S.sneakerTier === 'refresh'));
  const isSneakerDeep = S.service === 'laundry_sneakers' && (sc.key === 'sneaker_full' || (sc.key === 'sneaker_care' && S.sneakerTier === 'deep'));
  const isSneakerMulti = S.service === 'laundry_sneakers' && (sc.key === 'sneaker_lot' || (sc.key === 'sneaker_care' && S.sneakerTier === 'multi'));
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
    const current = cleaningAddonsForScope(sc.key, S.cleaningAddons);
    const next = { ...current, [`addon_${key}`]: current[`addon_${key}`] ? 0 : 1 };
    set('cleaningAddons', { ...S.cleaningAddons, [sc.key]: next });
  };

  const toggleCupboards = () => {
    const current = cleaningAddonsForScope(sc.key, S.cleaningAddons);
    const nextSelected = !cupboardsSelected;
    set('cleaningAddons', { ...S.cleaningAddons, [sc.key]: { ...current, wizard_cupboards: nextSelected ? 1 : 0 } });
    setCleaningWizard({ cupboards: nextSelected });
  };

  const toggleWalls = () => {
    const current = cleaningAddonsForScope(sc.key, S.cleaningAddons);
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

  // Bin cleans state
  const dumpParams = S.paramsByService.dump || {};
  const redBins = Math.max(0, dumpParams.redBins ?? 0);
  const redBinFreq = Math.max(0, Math.min(2, dumpParams.redBinFreq ?? 0)); // 0=oneoff, 1=weekly, 2=fortnightly
  const yellowBins = Math.max(0, dumpParams.yellowBins ?? 0);
  const yellowBinFreq = Math.max(0, Math.min(1, dumpParams.yellowBinFreq ?? 0)); // 0=oneoff, 1=fortnightly
  const greenBins = Math.max(0, dumpParams.greenBins ?? 0);
  const greenBinFreq = Math.max(0, Math.min(1, dumpParams.greenBinFreq ?? 0)); // 0=oneoff, 1=monthly
  const kitchenBins = Math.max(0, dumpParams.kitchenBins ?? 0);
  const binPlan = Math.max(0, Math.min(2, dumpParams.binPlan ?? 0)); // 0=none, 1=household, 2=lite

  const totalWheelies = redBins + yellowBins + greenBins;
  const validKitchenBins = totalWheelies > 0 ? kitchenBins : 0;

  const updateDumpParam = (key: string, value: number) => {
    set('paramsByService', {
      ...S.paramsByService,
      dump: { ...(S.paramsByService.dump || {}), [key]: value },
    });
  };

  const setRedBins = (n: number) => updateDumpParam('redBins', Math.max(0, Math.min(10, Math.round(n))));
  const setRedBinFreq = (n: number) => updateDumpParam('redBinFreq', Math.max(0, Math.min(2, n)));
  const setYellowBins = (n: number) => updateDumpParam('yellowBins', Math.max(0, Math.min(10, Math.round(n))));
  const setYellowBinFreq = (n: number) => updateDumpParam('yellowBinFreq', Math.max(0, Math.min(1, n)));
  const setGreenBins = (n: number) => updateDumpParam('greenBins', Math.max(0, Math.min(10, Math.round(n))));
  const setGreenBinFreq = (n: number) => updateDumpParam('greenBinFreq', Math.max(0, Math.min(1, n)));
  const setKitchenBins = (n: number) => updateDumpParam('kitchenBins', Math.max(0, Math.min(5, Math.round(n))));
  const setBinPlan = (n: number) => {
    const next = Math.max(0, Math.min(2, n));
    // Reset all bin selections when switching plans so the form feels fresh
    set('paramsByService', {
      ...S.paramsByService,
      dump: {
        ...(S.paramsByService.dump || {}),
        binPlan: next,
        redBins: 0,
        redBinFreq: 0,
        yellowBins: 0,
        yellowBinFreq: 0,
        greenBins: 0,
        greenBinFreq: 0,
        kitchenBins: 0,
      },
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
      dumpLoadType === 'single_item'
        ? 'single item'
        : dumpLoadType === 'ute'
        ? 'ute load'
        : dumpLoadType === 'half_trailer'
        ? 'half trailer'
        : dumpLoadType === 'trailer'
        ? 'trailer full'
        : dumpLoadType === 'bulky'
        ? 'bulky furniture'
        : 'mixed load';
    const volumePer =
      dumpLoadType === 'single_item'
        ? 0.5
        : dumpLoadType === 'ute'
        ? 1.5
        : dumpLoadType === 'half_trailer'
        ? 2.0
        : dumpLoadType === 'trailer'
        ? 2.5
        : dumpLoadType === 'bulky'
        ? 2.0
        : 1.2;
    const totalVol = Math.max(1, dumpLoads) * volumePer;
    const baseLow =
      dumpLoadType === 'single_item' ? 20 : dumpLoadType === 'bulky' ? 50 : 40;
    const baseHigh =
      dumpLoadType === 'single_item' ? 40 : dumpLoadType === 'bulky' ? 90 : 80;
    const minsLow = baseLow + (dumpLoads - 1) * 15;
    const minsHigh = baseHigh + (dumpLoads - 1) * 20;
    const techs =
      dumpLoadType === 'single_item'
        ? 'Usually a solo tech.'
        : dumpLoadType === 'bulky' || dumpLoads >= 3
        ? 'Usually requires 2 techs.'
        : 'Typically 1–2 techs.';
    return {
      line1: `Looks like approximately ~${Math.round(totalVol * 10) / 10} cubic metres (${typeLabel}).`,
      line2: `Most jobs like this take around ${Math.max(30, minsLow)}–${minsHigh} minutes onsite.`,
      line3: techs,
    };
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
        : "We'll match the clean to the material.";

    const concernHint =
      refreshConcern === 'yellowing'
        ? 'Yellowing often needs deeper treatment — Deep Restore may be better.'
        : refreshConcern === 'scuffs'
        ? 'Light scuffs get cosmetic attention in Refresh.'
        : refreshConcern === 'odour'
        ? 'Odour treatment is included in Refresh Clean.'
        : refreshConcern === 'wear'
        ? "Wear & tear is noted — we'll set expectations clearly."
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
      ? "We'll take extra care with suede, dyed leather, and collectible pairs."
      : "We'll still handle carefully — no sensitive materials flagged.";
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
    "Scope confirmed (what's in / out)",
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


  const shouldShowHidden = hiddenInclusions.length > 0 && showSheet;
  const formatInc = (inc: string) => {
    const trimmed = inc.trim();
    const isHeader = /^—/.test(trimmed);
    const text = trimmed.replace(/^—\s*|\s*—$/g, '').trim();
    return { isHeader, text: text || inc };
  };
  const inclusionMinClass = ['windows', 'yard', 'dump', 'laundry_sneakers'].includes(
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
        'relative overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 transition-all',
        isConfigOpen
          ? 'shadow-[0_20px_60px_rgba(2,6,23,0.18)] z-10'
          : 'hover:shadow-[0_16px_40px_rgba(2,6,23,0.10)]',
        'flex flex-col h-full min-w-0',
        className
      )}
      onClick={(e) => {
        const target = e.target as HTMLElement | null;
        if (target && target.closest('[data-card-interactive="true"]')) return;
        if (S.scope !== sc.key) onSelect(sc.key);
        setHasInteractedStep2(true);
        if (S.service !== 'yard') setActiveServiceId((curr) => (curr === sc.key ? null : sc.key));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const target = e.target as HTMLElement | null;
          if (target && target.closest('[data-card-interactive="true"]')) return;
          e.preventDefault();
          if (S.scope !== sc.key) onSelect(sc.key);
          setHasInteractedStep2(true);
          if (S.service !== 'yard') setActiveServiceId((curr) => (curr === sc.key ? null : sc.key));
        }
      }}
    >
      {/* Header */}
      <div className="flex items-baseline gap-2 min-w-0">
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

        {isActive && S.service !== 'laundry_sneakers' && (
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
        {/* Expand/collapse chevron — hidden for yard cards */}
        {S.service !== 'yard' && (
        <svg
          aria-hidden
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cls(
            'shrink-0 self-center text-slate-400 transition-transform duration-200',
            isConfigOpen && 'rotate-90'
          )}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
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
              data-card-interactive="true"
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
                  data-card-interactive="true"
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
          <AnimatePresence>
            {isActive && isCleaningWizardCard && isConfigOpen && (
              <M.div
                key="cleaning-config"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
            <div
              className="mt-3 space-y-2 border-t border-slate-200/80 pt-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-slate-600">
                <span className="font-semibold text-slate-800 tracking-tight uppercase">Adjust details</span>
                {cleaningHint && <span className="text-slate-500 hidden sm:inline">{cleaningHint}</span>}
              </div>
              <div className="flex flex-wrap gap-1.5 text-[10px] md:text-[11px] text-slate-700">
                <NumberStepper label="Bed"  value={S.paramsByService.cleaning?.bedrooms  ?? sizePreset.bedrooms}  onStep={(d) => adjustBedrooms(d)}  />
                <NumberStepper label="Kit"  value={S.paramsByService.cleaning?.kitchens  ?? sizePreset.kitchens}  onStep={(d) => adjustKitchens(d)}  />
                <NumberStepper label="Lndy" value={S.paramsByService.cleaning?.laundry   ?? sizePreset.laundry}   onStep={(d) => adjustLaundry(d)}   />
                <NumberStepper label="Liv"  value={S.paramsByService.cleaning?.living    ?? sizePreset.living}    onStep={(d) => adjustLiving(d)}    />
                <NumberStepper label="Bath" value={S.paramsByService.cleaning?.bathrooms ?? sizePreset.bathrooms} onStep={(d) => adjustBathrooms(d)} />
                <NumberStepper label="Flr"  value={S.paramsByService.cleaning?.storeys   ?? sizePreset.storeys}   onStep={(d) => adjustStoreys(d)}   />
              </div>
              <div className="flex flex-wrap gap-1 text-[10px] md:text-[11px]">
                {[
                  { key: 'light', label: 'Tidy' },
                  { key: 'standard', label: 'Lived in' },
                  { key: 'heavy', label: 'Reset' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'px-2 py-0.5 md:px-3 md:py-1 rounded-full border',
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
              <div className="flex flex-wrap gap-1 text-[10px] md:text-[11px]">
                {[
                  { key: 'oven', label: 'Oven' },
                  { key: 'fridge', label: 'Fridge' },
                  { key: 'windows', label: 'Windows' },
                  { key: 'cupboards', label: 'Cupboards' },
                  { key: 'walls', label: 'Walls' },
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
                        'px-2 py-0.5 md:px-3 md:py-1 rounded-full border',
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
              </M.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isActive && isCommercialNicheCard && isConfigOpen && (
              <M.div
                key="commercial-config"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
            <div
              data-card-interactive="true"
              className="mt-3 space-y-3 border-t border-slate-200/80 pt-3"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span className="font-semibold text-slate-800 tracking-tight uppercase">Configure your clean</span>
              </div>
              {/* Preset selector: Essential / Standard / Intensive */}
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-700">Service level</div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {[
                    { key: 'essential', label: 'Essential', desc: 'Basic maintenance clean' },
                    { key: 'standard', label: 'Standard', desc: 'Comprehensive clean' },
                    { key: 'intensive', label: 'Intensive', desc: 'Deep reset clean' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className={cls(
                        'px-3 py-1.5 rounded-full border text-sm',
                        S.commPreset === p.key
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white border-black/10 text-slate-700 hover:border-emerald-400'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        set('commPreset', p.key as 'essential' | 'standard' | 'intensive');
                        const niche = sc.key as CommercialCleaningType;
                        const presetParams = COMM_PRESETS[niche]?.find((pr) => pr.key === p.key)?.params;
                        if (presetParams?.sqm) {
                          set('paramsByService', {
                            ...S.paramsByService,
                            cleaning: {
                              ...(S.paramsByService.cleaning || {}),
                              sqm: presetParams.sqm,
                            },
                          });
                        }
                      }}
                      title={p.desc}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Frequency selector */}
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-700">Frequency</div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {[
                    { key: 'none', label: 'One-off' },
                    { key: 'weekly', label: 'Weekly' },
                    { key: 'fortnightly', label: 'Fortnightly' },
                    { key: 'monthly', label: 'Monthly' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      className={cls(
                        'px-3 py-1 rounded-full border text-sm',
                        S.commFrequency === f.key
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white border-black/10 text-slate-700 hover:border-emerald-400'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        set('commFrequency', f.key as CommFrequency);
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Square metres slider — isolated component prevents full-page re-render on drag */}
              <CommSqmSlider
                value={S.paramsByService.cleaning?.sqm ?? COMM_PRESETS[sc.key as CommercialCleaningType]?.[0]?.params?.sqm ?? 300}
                onChange={(sqm) => set('paramsByService', {
                  ...S.paramsByService,
                  cleaning: { ...(S.paramsByService.cleaning || {}), sqm },
                })}
              />
              {/* Features covered */}
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-700">Included</div>
                <div className="flex flex-wrap gap-1.5">
                  {(COMM_FEATURES[sc.key as CommercialCleaningType] || []).map((feature) => (
                    <span
                      key={feature}
                      className="px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-800"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
              {/* Standards */}
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-700">Standards</div>
                <div className="flex flex-wrap gap-1.5">
                  {(COMM_STANDARDS[sc.key as CommercialCleaningType] || []).map((std) => (
                    <span
                      key={std}
                      className="px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-[11px] text-slate-600"
                    >
                      {std}
                    </span>
                  ))}
                </div>
              </div>
            </div>
              </M.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {/* CTA row */}
      <div className="mt-auto pt-1.5 flex flex-col gap-3">
        <AnimatePresence>
          {isConfigOpen && (
            <M.div
              key={sc.key + '-cta'}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-3"
            >
        {S.service === 'windows' && isActive && (
          <div
            data-card-interactive="true"
            className="min-w-0 w-full overflow-hidden"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <WindowsEditor S={S} setMany={setMany} notifyDelta={notifyDelta} />
          </div>
        )}

        {S.service === 'auto' && isActive && (
          <div
            data-card-interactive="true"
            className="rounded-2xl bg-slate-900 overflow-hidden"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            {/* Rego Lookup Section */}
            <div className="p-4 border-b border-white/10">
              <RegoLookupAssistant
                selectedCategory={carSelector.carType}
                detectedVehicle={S.carDetectedVehicle}
                onVehicleChange={(vehicle) => set('carDetectedVehicle', vehicle)}
                onSelectCategory={(category) => {
                  carSelector.setCarType(category);
                  const sizeMap: Record<string, number> = {
                    hatch: 1, sedan: 2, suv: 3, ute: 4, van: 5, '4wd': 6, luxury: 2, muscle: 2,
                  };
                  set('paramsByService', {
                    ...S.paramsByService,
                    auto: { ...S.paramsByService.auto, vehicle_size: sizeMap[category] || 2 },
                  });
                }}
                onVehicleDetected={(_vehicle, classification) => {
                  if (classification.sizeCategory) {
                    set('carDetectedSizeCategory', classification.sizeCategory);
                  }
                  set('carDetectedYear', typeof _vehicle.year === 'number' ? _vehicle.year : null);
                }}
              />
            </div>

            {/* Car Type Selection */}
            <div className="p-4 border-b border-white/10">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">
                Select vehicle type
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(['hatch', 'sedan', 'suv', 'ute', 'van', '4wd', 'luxury', 'muscle'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      carSelector.setCarType(type);
                      const sizeMap: Record<string, number> = {
                        hatch: 1, sedan: 2, suv: 3, ute: 4, van: 5, '4wd': 6, luxury: 2, muscle: 2,
                      };
                      set('paramsByService', {
                        ...S.paramsByService,
                        auto: { ...S.paramsByService.auto, vehicle_size: sizeMap[type] || 2 },
                      });
                    }}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                      carSelector.carType === type
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    {type === '4wd' ? '4WD' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Interior Config */}
            <div className="p-4 border-b border-white/10">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">
                Interior details
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-400 mb-2">Seat rows</div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          set('paramsByService', {
                            ...S.paramsByService,
                            auto: { ...S.paramsByService.auto, rows: n },
                          });
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          (S.paramsByService.auto?.rows || 2) === n
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-2">Child seats</div>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          set('paramsByService', {
                            ...S.paramsByService,
                            auto: { ...S.paramsByService.auto, child_seats: n },
                          });
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          (S.paramsByService.auto?.child_seats || 0) === n
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Condition */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Current condition
                </div>
                <div className="text-xs font-medium text-emerald-400">
                  {carSelector.dirtLevel === 0 ? 'Clean' : carSelector.dirtLevel < 0.4 ? 'Light dirt' : carSelector.dirtLevel < 0.7 ? 'Moderate' : 'Heavy'}
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={carSelector.dirtLevel}
                onChange={(e) => carSelector.setDirtLevel(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Clean</span>
                <span>Heavy</span>
              </div>
            </div>

            {/* Focus Zones Selection */}
            <div className="p-4">
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Any areas to focus on? <span className="text-slate-500">(optional)</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { zone: 'hood', label: 'Hood', icon: '🚗' },
                  { zone: 'roof', label: 'Roof', icon: '☀️' },
                  { zone: 'boot', label: 'Boot', icon: '📦' },
                  { zone: 'wheels', label: 'Wheels', icon: '🛞' },
                  { zone: 'glass', label: 'Glass', icon: '🪟' },
                  { zone: 'interior', label: 'Interior', icon: '💺' },
                ] as const).map(({ zone, label, icon }) => {
                  const isSelected = carSelector.zones.has(zone);
                  return (
                    <button
                      key={zone}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        carSelector.toggleZone(zone);
                      }}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white/10 text-slate-300 hover:bg-white/20'
                      }`}
                    >
                      <span className="text-lg">{icon}</span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Laundry Card */}
        {S.service === 'laundry_sneakers' && isLaundryCard && isActive && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/80 p-3 space-y-3"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            {/* Service type — single pre-selected pill */}
            <div>
              <div className="text-xs text-slate-500 mb-1.5">Service type</div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-3 py-1.5 text-sm">
                <span>Wash &amp; Fold</span>
                <span className="text-emerald-100 text-xs">$30/load</span>
              </span>
            </div>

            {/* Load counter */}
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-700">How many loads? <span className="text-xs text-slate-500">(~5kg each)</span></span>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                <button
                  type="button"
                  className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
                  onClick={(e) => { e.stopPropagation(); set('laundryLoads', Math.max(1, (S.laundryLoads || 1) - 1)); }}
                  aria-label="Decrease loads"
                >–</button>
                <span className="min-w-[24px] text-center font-semibold">{S.laundryLoads || 1}</span>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
                  onClick={(e) => { e.stopPropagation(); set('laundryLoads', Math.min(10, (S.laundryLoads || 1) + 1)); }}
                  aria-label="Increase loads"
                >+</button>
              </div>
            </div>

            {/* Add-ons */}
            <div>
              <div className="text-xs text-slate-500 mb-1.5">Add-ons <span className="text-slate-400">(optional)</span></div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(LAUNDRY_PER_LOAD_ADDONS) as [LaundryPerLoadAddOn, { label: string; price: number }][]).map(([key, meta]) => {
                  const active = (S.laundryPerLoadAddOns ?? []).includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const current = S.laundryPerLoadAddOns ?? [];
                        set('laundryPerLoadAddOns', active ? current.filter((k) => k !== key) : [...current, key]);
                      }}
                      className={cls(
                        'rounded-full border px-2.5 py-1 text-xs flex items-center gap-1',
                        active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10 hover:border-emerald-300',
                      )}
                    >
                      {meta.label}
                      <span className={active ? 'text-emerald-100' : 'text-slate-400'}>+${meta.price}/load</span>
                    </button>
                  );
                })}
                {(Object.entries(LAUNDRY_PER_ORDER_ADDONS) as [LaundryPerOrderAddOn, { label: string; price: number }][]).map(([key, meta]) => {
                  const active = (S.laundryPerOrderAddOns ?? []).includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const current = S.laundryPerOrderAddOns ?? [];
                        set('laundryPerOrderAddOns', active ? current.filter((k) => k !== key) : [...current, key]);
                      }}
                      className={cls(
                        'rounded-full border px-2.5 py-1 text-xs flex items-center gap-1',
                        active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10 hover:border-emerald-300',
                      )}
                    >
                      {meta.label}
                      <span className={active ? 'text-emerald-100' : 'text-slate-400'}>+${meta.price}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ironing toggle */}
            <div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLaundryIroningOpen((v) => !v); }}
                className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
              >
                <span>{laundryIroningOpen ? '▼' : '▶'}</span>
                <span>Add ironing items</span>
              </button>
              {laundryIroningOpen && (
                <div className="mt-2 space-y-2">
                  {(Object.entries(LAUNDRY_IRONING_PRICES) as [IroningItemType, { label: string; price: number }][]).map(([type, meta]) => {
                    const item = (S.laundryIroningItems ?? []).find((i) => i.type === type);
                    const count = item?.count ?? 0;
                    const setCount = (n: number) => {
                      const items: IroningItem[] = (S.laundryIroningItems ?? []).filter((i) => i.type !== type);
                      if (n > 0) items.push({ type, count: n });
                      set('laundryIroningItems', items);
                    };
                    return (
                      <div key={type} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-700">{meta.label} <span className="text-slate-400">${meta.price}/item</span></span>
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-1.5 py-0.5">
                          <button
                            type="button"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10 hover:bg-slate-50 text-[11px]"
                            onClick={(e) => { e.stopPropagation(); setCount(Math.max(0, count - 1)); }}
                            aria-label={`Decrease ${meta.label}`}
                          >–</button>
                          <span className="min-w-[20px] text-center font-semibold">{count}</span>
                          <button
                            type="button"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10 hover:bg-slate-50 text-[11px]"
                            onClick={(e) => { e.stopPropagation(); setCount(count + 1); }}
                            aria-label={`Increase ${meta.label}`}
                          >+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live estimated total */}
            {laundryAddOnTotal > 0 && (
              <div className="text-xs text-slate-600 font-medium">
                Estimated: {priceLabelBase} <span className="text-slate-400">(excl. fees)</span>
              </div>
            )}

            {/* Footer notes */}
            <div className="text-[11px] text-slate-500 space-y-0.5">
              <div>Minimum service $60 (pickup &amp; delivery for up to 2 loads) · fees shown at checkout</div>
              <div>Loads are ~5kg each. Overweight or bulky items may count as an extra load — we&apos;ll confirm any changes before washing.</div>
            </div>
          </div>
        )}

        {/* Sneaker Care Card - Tier Selector */}
        {S.service === 'laundry_sneakers' && isSneakerCareCard && isActive && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/80 p-3 space-y-2"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <div className="text-sm font-semibold text-slate-900">Care level</div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'refresh', label: 'Refresh Clean', price: '$40' },
                { key: 'deep',    label: 'Deep Restore',  price: '$60' },
                { key: 'multi',   label: 'Multi-Pair',    price: 'from $40' },
              ].map((tier) => (
                <button
                  key={tier.key}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); set('sneakerTier', tier.key as any); }}
                  className={cls(
                    'rounded-full border px-3 py-1.5 text-sm flex items-center gap-2',
                    S.sneakerTier === tier.key
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white border-black/10 hover:border-emerald-300',
                  )}
                >
                  <span>{tier.label}</span>
                  <span className={cls('text-xs', S.sneakerTier === tier.key ? 'text-emerald-100' : 'text-slate-500')}>
                    {tier.price}
                  </span>
                </button>
              ))}
            </div>

            {/* Multi-pair count picker */}
            {S.sneakerTier === 'multi' && (
              <div>
                <div className="text-xs text-slate-500 mb-1.5">How many pairs?</div>
                <div className="flex flex-wrap gap-1.5">
                  {SNEAKER_MULTI_PRICING.map((opt) => (
                    <button
                      key={opt.pairs}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); set('sneakerPairCount', opt.pairs); }}
                      className={cls(
                        'rounded-full border px-2.5 py-1 text-xs flex items-center gap-1',
                        (S.sneakerPairCount ?? 3) === opt.pairs
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white border-black/10 hover:border-emerald-300',
                      )}
                    >
                      {opt.popular && <span>⭐</span>}
                      <span>{opt.pairs} {opt.pairs === 1 ? 'pair' : 'pairs'}</span>
                      <span className={cls('ml-0.5', (S.sneakerPairCount ?? 3) === opt.pairs ? 'text-emerald-100' : 'text-slate-400')}>
                        {fmtAUD(opt.price)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-600 space-y-0.5">
              <div>
                {S.sneakerTier === 'refresh' && 'Quick cosmetic refresh for lightly worn pairs.'}
                {S.sneakerTier === 'deep' && 'Full restoration for noticeably dirty or worn pairs.'}
                {S.sneakerTier === 'multi' && 'Best value when cleaning 3 or more pairs at once.'}
              </div>
              <div>Fees shown at checkout</div>
            </div>
          </div>
        )}

        {/* Sneaker Care Card - Turnaround Selector */}
        {S.service === 'laundry_sneakers' && isSneakerCareCard && isActive && (
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

        {isDumpRunsCard && (
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
                  { key: 'single_item',  label: 'Single item' },
                  { key: 'ute',          label: 'Ute load' },
                  { key: 'half_trailer', label: 'Half trailer' },
                  { key: 'trailer',      label: 'Trailer full' },
                  { key: 'bulky',        label: 'Bulky furniture' },
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
                      updateDumpRun({
                        loadType: c.key as
                          | 'single_item'
                          | 'ute'
                          | 'half_trailer'
                          | 'trailer'
                          | 'bulky',
                      });
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
        {isDeliveryCard && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/90 p-4 shadow-sm space-y-4"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <div>
              <div className="font-semibold text-slate-900">Delivery Details</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Tell us what you need delivered</div>
            </div>

            {/* Step 1: What + how many */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">1</span>
                What are you delivering?
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: 'parcel', label: 'Small box / parcel', desc: 'Fits in a car', icon: '📦' },
                  { key: 'household', label: 'Household item', desc: 'Chair, table, etc.', icon: '🪑' },
                  { key: 'mattress', label: 'Mattress / bed', desc: 'Weather protected', icon: '🛏️' },
                  { key: 'groceries', label: 'Groceries', desc: 'Kept shaded', icon: '🛒' },
                  { key: 'tools', label: 'Tools / equipment', desc: 'Secured transport', icon: '🔧' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'p-3 rounded-lg border text-left transition-all',
                      deliveryType === c.key
                        ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400'
                        : 'border-black/10 bg-white hover:bg-slate-50'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateDelivery({ itemType: c.key as DeliverySelection['itemType'] });
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{c.icon}</span>
                      <div>
                        <div className="text-xs font-medium text-slate-800">{c.label}</div>
                        <div className="text-[10px] text-slate-500">{c.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {/* Quantity */}
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-[11px] text-slate-700">How many items?</span>
                <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
                    onClick={(e) => { e.stopPropagation(); setDeliveryItemQty((n) => Math.max(1, n - 1)); }}
                    aria-label="Decrease quantity"
                  >–</button>
                  <span className="min-w-[24px] text-center font-semibold text-sm">{deliveryItemQty}</span>
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
                    onClick={(e) => { e.stopPropagation(); setDeliveryItemQty((n) => Math.min(20, n + 1)); }}
                    aria-label="Increase quantity"
                  >+</button>
                </div>
              </div>
              {/* Lifting help */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[
                  { key: 'no_help', label: 'No help needed', desc: 'I can load/unload myself', icon: '👤' },
                  { key: 'need_help', label: 'Need help', desc: 'Extra hands for lifting', icon: '👥', extra: '+$25–50' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'p-2.5 rounded-lg border text-left transition-all',
                      deliveryAssist === c.key
                        ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400'
                        : 'border-black/10 bg-white hover:bg-slate-50'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateDelivery({ assist: c.key as DeliverySelection['assist'] });
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{c.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-800">{c.label}</div>
                        <div className="text-[10px] text-slate-500">{c.desc}</div>
                      </div>
                      {c.extra && (
                        <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1 py-0.5 rounded shrink-0">{c.extra}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Extra stops + optional extras */}
            <div className="space-y-3">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">2</span>
                Any extra stops?
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-[11px] text-slate-700">Extra drop-off stops <span className="text-slate-400">(+$8 each)</span></span>
                <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
                    onClick={(e) => { e.stopPropagation(); updateDelivery({ extraStops: Math.max(0, (deliveryState.extraStops ?? 0) - 1) }); }}
                    aria-label="Decrease stops"
                  >–</button>
                  <span className="min-w-[24px] text-center font-semibold text-sm">{deliveryState.extraStops ?? 0}</span>
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
                    onClick={(e) => { e.stopPropagation(); updateDelivery({ extraStops: Math.min(5, (deliveryState.extraStops ?? 0) + 1) }); }}
                    aria-label="Increase stops"
                  >+</button>
                </div>
              </div>
              <div className="space-y-1.5">
                {[
                  { key: 'priority', label: 'Priority / same-day delivery', price: '+$15', value: deliveryState.priority ?? false },
                  { key: 'stairsAtDropoff', label: 'Stairs at drop-off', price: '+$20', value: deliveryState.stairsAtDropoff ?? false },
                ].map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-black/10 bg-white cursor-pointer hover:bg-slate-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={opt.value}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateDelivery({ [opt.key]: !opt.value } as any);
                        }}
                        className="rounded border-slate-300 accent-emerald-600"
                      />
                      <span className="text-xs text-slate-800">{opt.label}</span>
                    </div>
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">{opt.price}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Live delivery price preview */}
            {deliveryType && (() => {
              const dResult = calcDeliveryQuote(deliveryState, S.distanceKm);
              if (dResult.isCustomQuote) {
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <div className="font-semibold mb-0.5">Custom quote may be required</div>
                    <div className="text-[11px]">{dResult.customQuoteReason ?? 'This job may require a custom quote based on distance or item size.'}</div>
                  </div>
                );
              }
              return (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 space-y-1">
                  <div className="text-[11px] font-semibold text-emerald-900 mb-1.5">Price breakdown</div>
                  {dResult.lineItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-700">{item.label}</span>
                      <span className="font-medium text-slate-900 tabular-nums">
                        {item.note === 'Included' ? <span className="text-slate-400">Included</span> : `$${item.amount}`}
                      </span>
                    </div>
                  ))}
                  <div className="h-px bg-emerald-200 my-1" />
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-slate-900">Total</span>
                    <span className="text-emerald-700">{fmtAUD(dResult.total)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Transparent pricing — no hidden fees</div>
                </div>
              );
            })()}

            {/* Step 3: Where to deliver */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">3</span>
                Where would you like it delivered?
              </div>
              <div className="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-3 border border-dashed border-slate-200">
                {S.dumpRouteDropoff?.address
                  ? <span className="text-emerald-700 font-medium">{S.dumpRouteDropoff.address}</span>
                  : <span>Add addresses in the route calculator to refine the distance price</span>}
              </div>
            </div>

            {/* Step 4: Route Calculator (collapsible) */}
            <div className="space-y-2">
              <button
                type="button"
                className="w-full text-left"
                onClick={(e) => { e.stopPropagation(); setRouteExpanded((v) => !v); }}
              >
                <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">4</span>
                  Route Calculator
                  {S.distanceKm > 0 && (
                    <span className="ml-1 text-emerald-600 font-semibold">{Math.round(S.distanceKm)} km</span>
                  )}
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className={cls('ml-auto text-slate-400 transition-transform duration-200', routeExpanded ? 'rotate-180' : '')}
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
              {routeExpanded && (
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
              )}
            </div>
          </div>
        )}
        {isTransportCard && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/90 p-4 shadow-sm space-y-4"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <div>
              <div className="font-semibold text-slate-900">Transport & Haul Details</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Tell us about the move</div>
            </div>

            {/* Step 1: Type of move */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">1</span>
                What type of move?
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: 'house', label: 'House move', desc: 'Full home relocation', icon: '🏠', note: 'Multiple loads likely' },
                  { key: 'bedroom', label: 'Bedroom move', desc: 'Single room items', icon: '🛏️', note: '1–2 techs' },
                  { key: 'student', label: 'Student move', desc: 'Dorm/share house', icon: '🎓', note: 'Usually 1 trip' },
                  { key: 'office', label: 'Office move', desc: 'Desks & equipment', icon: '💼', note: 'Equipment protected' },
                  { key: 'event', label: 'Event pack-up', desc: 'Staging & gear', icon: '🎪', note: 'Organised staging' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'p-3 rounded-lg border text-left transition-all',
                      transportType === c.key
                        ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                        : 'border-black/10 bg-white hover:bg-slate-50'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTransport({ moveType: c.key as TransportSelection['moveType'] });
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{c.icon}</span>
                      <div>
                        <div className="text-xs font-medium text-slate-800">{c.label}</div>
                        <div className="text-[10px] text-slate-500">{c.desc}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{c.note}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Load size */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">2</span>
                How much are you moving?
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'bags', label: 'A few bags', desc: 'Small items only', icon: '🎒', price: 'From $104' },
                  { key: 'boot', label: 'Car boot load', desc: 'Boxes & small furniture', icon: '🚗', price: 'From $124' },
                  { key: 'small_load', label: 'Small load', desc: 'Bed, desk, boxes', icon: '📦', price: 'From $158' },
                  { key: 'full_move', label: 'Full move', desc: 'Complete household', icon: '🚚', price: 'From $228' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'p-3 rounded-lg border text-left transition-all',
                      transportSize === c.key
                        ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                        : 'border-black/10 bg-white hover:bg-slate-50'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTransport({ loadSize: c.key as TransportSelection['loadSize'] });
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{c.icon}</span>
                      <div className="flex-1">
                        <div className="text-xs font-medium text-slate-800">{c.label}</div>
                        <div className="text-[10px] text-slate-500">{c.desc}</div>
                      </div>
                      <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {c.price}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Stair access */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">3</span>
                Stair access at pickup or drop-off?
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'none', label: 'No stairs', desc: 'Ground level access', icon: '✓', extra: null },
                  { key: 'one', label: 'One flight', desc: 'Single staircase', icon: '🔼', extra: '+$20' },
                  { key: 'multi', label: 'Multiple flights', desc: '2+ floors of stairs', icon: '🔼🔼', extra: '+$40' },
                  { key: 'no_lift', label: 'No lift access', desc: 'Apartment without lift', icon: '🏢', extra: '+$30' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'p-3 rounded-lg border text-left transition-all',
                      transportStairs === c.key
                        ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                        : 'border-black/10 bg-white hover:bg-slate-50'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTransport({ stairs: c.key as TransportSelection['stairs'] });
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm w-6 text-center">{c.icon}</span>
                      <div className="flex-1">
                        <div className="text-xs font-medium text-slate-800">{c.label}</div>
                        <div className="text-[10px] text-slate-500">{c.desc}</div>
                      </div>
                      {c.extra && (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          {c.extra}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 4: How many helpers? */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">4</span>
                How many helpers do you need?
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 1, label: '1 helper', desc: 'Included', extra: null },
                  { key: 2, label: '2 helpers', desc: 'Extra hands', extra: '+$60' },
                  { key: 3, label: '3 helpers', desc: 'Heavy loads', extra: '+$120' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'p-3 rounded-lg border text-left transition-all',
                      (transportState.helpers ?? 1) === c.key
                        ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                        : 'border-black/10 bg-white hover:bg-slate-50'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTransport({ helpers: c.key as 1 | 2 | 3 });
                    }}
                  >
                    <div className="text-xs font-medium text-slate-800">{c.label}</div>
                    <div className="text-[10px] text-slate-500">{c.desc}</div>
                    {c.extra && (
                      <div className="text-[10px] font-medium text-amber-600 mt-0.5">{c.extra}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional extras */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                Optional extras
              </div>
              <div className="space-y-1.5">
                {[
                  { key: 'urgent', label: 'Priority / urgent booking', price: '+$15', value: transportState.urgent ?? false },
                  { key: 'afterHours', label: 'After-hours or weekend loading', price: '+$40', value: transportState.afterHours ?? false },
                ].map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-black/10 bg-white cursor-pointer hover:bg-slate-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={opt.value}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateTransport({ [opt.key]: !opt.value } as any);
                        }}
                        className="rounded border-slate-300 accent-blue-600"
                      />
                      <span className="text-xs text-slate-800">{opt.label}</span>
                    </div>
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">{opt.price}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Live price preview */}
            {(() => {
              const tResult = calcTransportQuote(transportState, S.distanceKm);
              if (tResult.isCustomQuote) {
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <div className="font-semibold mb-0.5">Custom quote may be required</div>
                    <div className="text-[11px]">{tResult.customQuoteReason ?? 'This job may require a custom quote based on distance, access, or item size.'}</div>
                  </div>
                );
              }
              return (
                <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 space-y-1">
                  <div className="text-[11px] font-semibold text-blue-900 mb-1.5">Price breakdown</div>
                  {tResult.lineItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-700">{item.label}</span>
                      <span className="font-medium text-slate-900 tabular-nums">
                        {item.note === 'Included' ? <span className="text-slate-400">Included</span> : `$${item.amount}`}
                      </span>
                    </div>
                  ))}
                  <div className="h-px bg-blue-200 my-1" />
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-slate-900">Total</span>
                    <span className="text-blue-700">{fmtAUD(tResult.total)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Transparent pricing — no hidden fees</div>
                </div>
              );
            })()}

            {/* Step 5: Origin & destination display */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">5</span>
                Origin &amp; destination
              </div>
              <div className="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-3 border border-dashed border-slate-200">
                {S.distanceKm > 0
                  ? <span className="text-blue-700 font-medium">{Math.round(S.distanceKm)} km between locations</span>
                  : <span>Add addresses in the route calculator to refine the distance price</span>}
              </div>
            </div>

            {/* Step 6: Route Calculator (collapsible) */}
            <div className="space-y-2">
              <button
                type="button"
                className="w-full text-left"
                onClick={(e) => { e.stopPropagation(); setTransportRouteExpanded((v) => !v); }}
              >
                <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">6</span>
                  Route Calculator
                  {S.distanceKm > 0 && (
                    <span className="ml-1 text-blue-600 font-semibold">{Math.round(S.distanceKm)} km</span>
                  )}
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className={cls('ml-auto text-slate-400 transition-transform duration-200', transportRouteExpanded ? 'rotate-180' : '')}
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
              {transportRouteExpanded && (
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
              )}
            </div>
          </div>
        )}
        {isBinCleans && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/90 p-4 shadow-sm"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <div className="flex items-center justify-between text-sm mb-3">
              <div className="font-semibold text-slate-900">Bin Cleaning</div>
              <div className="text-[10px] text-slate-500">Select bins &amp; frequency</div>
            </div>

            <div className="space-y-3 text-xs">
              {/* Subscription Plans */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="text-[11px] font-semibold text-slate-800">Choose your plan</div>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {/* Pay per clean option */}
                  <button
                    type="button"
                    className={cls(
                      'w-full p-3 rounded-xl border-2 text-left transition-all',
                      binPlan === 0
                        ? 'border-slate-400 bg-white shadow-sm'
                        : 'border-transparent bg-slate-50 hover:bg-slate-100'
                    )}
                    onClick={(e) => { e.stopPropagation(); setBinPlan(0); }}
                    aria-label="No subscription plan"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cls(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        binPlan === 0 ? 'border-slate-600' : 'border-slate-300'
                      )}>
                        {binPlan === 0 && <div className="w-2 h-2 rounded-full bg-slate-600" />}
                      </div>
                      <div>
                        <div className="text-[12px] font-medium text-slate-800">Pay per clean</div>
                        <div className="text-[10px] text-slate-500">No commitment &mdash; book when you need it</div>
                      </div>
                    </div>
                  </button>

                  {/* Household Plan */}
                  <button
                    type="button"
                    className={cls(
                      'w-full p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden',
                      binPlan === 1
                        ? 'border-emerald-500 bg-emerald-50/60 shadow-sm'
                        : 'border-transparent bg-slate-50 hover:bg-slate-100'
                    )}
                    onClick={(e) => { e.stopPropagation(); setBinPlan(1); }}
                    aria-label="Household Bin Care Plan"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cls(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                        binPlan === 1 ? 'border-emerald-600' : 'border-slate-300'
                      )}>
                        {binPlan === 1 && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[12px] font-medium text-slate-800">Household Plan</div>
                          <div className={cls(
                            'text-[12px] font-bold tabular-nums',
                            binPlan === 1 ? 'text-emerald-700' : 'text-slate-600'
                          )}>$35<span className="text-[10px] font-normal text-slate-500">/mo</span></div>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Up to 5 bins, cleaned monthly</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">+$6 per extra bin</div>
                      </div>
                    </div>
                    {binPlan === 1 && <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-500" />}
                  </button>

                  {/* Bin Care Lite */}
                  <button
                    type="button"
                    className={cls(
                      'w-full p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden',
                      binPlan === 2
                        ? 'border-sky-500 bg-sky-50/60 shadow-sm'
                        : 'border-transparent bg-slate-50 hover:bg-slate-100'
                    )}
                    onClick={(e) => { e.stopPropagation(); setBinPlan(2); }}
                    aria-label="Bin Care Lite plan"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cls(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                        binPlan === 2 ? 'border-sky-600' : 'border-slate-300'
                      )}>
                        {binPlan === 2 && <div className="w-2 h-2 rounded-full bg-sky-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[12px] font-medium text-slate-800">Bin Care Lite</div>
                          <div className={cls(
                            'text-[12px] font-bold tabular-nums',
                            binPlan === 2 ? 'text-sky-700' : 'text-slate-600'
                          )}>$29<span className="text-[10px] font-normal text-slate-500">/mo</span></div>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Up to 3 bins, cleaned monthly</div>
                      </div>
                    </div>
                    {binPlan === 2 && <div className="absolute top-0 left-0 w-full h-0.5 bg-sky-500" />}
                  </button>
                </div>
              </div>

              {/* Bin selection — compact rows */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-slate-700">
                      {binPlan > 0 ? 'Which bins do you have?' : 'Select your bins'}
                    </div>
                    {binPlan > 0 && (
                      <div className="text-[10px] text-slate-500">All cleaned monthly</div>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {/* Red — General Waste */}
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-slate-800">General waste</div>
                        <div className="text-[10px] text-slate-500">Red lid</div>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                        <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Decrease red bins" onClick={(e) => { e.stopPropagation(); setRedBins(redBins - 1); }}>–</button>
                        <span className="min-w-[18px] text-center font-semibold text-[12px]">{redBins}</span>
                        <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Increase red bins" onClick={(e) => { e.stopPropagation(); setRedBins(redBins + 1); }}>+</button>
                      </div>
                      {binPlan === 0 && redBins > 0 && (
                        <div className="text-[10px] text-slate-500 tabular-nums w-10 text-right">${redBinFreq === 0 ? 25 : redBinFreq === 1 ? 18 : 20}<span className="text-slate-400">/ea</span></div>
                      )}
                    </div>
                    {redBins > 0 && binPlan === 0 && (
                      <div className="flex gap-1 mt-2 ml-6">
                        {[
                          { val: 0, label: 'One-off' },
                          { val: 1, label: 'Weekly' },
                          { val: 2, label: 'Fortnightly' },
                        ].map((opt) => (
                          <button key={opt.val} type="button" className={cls('px-2 py-0.5 rounded-full border text-[10px] transition-colors', redBinFreq === opt.val ? 'bg-red-500 text-white border-red-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')} onClick={(e) => { e.stopPropagation(); setRedBinFreq(opt.val); }} aria-label={`${opt.label} frequency for red bins`}>{opt.label}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Yellow — Recycling */}
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-yellow-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-slate-800">Recycling</div>
                        <div className="text-[10px] text-slate-500">Yellow lid</div>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                        <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Decrease yellow bins" onClick={(e) => { e.stopPropagation(); setYellowBins(yellowBins - 1); }}>–</button>
                        <span className="min-w-[18px] text-center font-semibold text-[12px]">{yellowBins}</span>
                        <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Increase yellow bins" onClick={(e) => { e.stopPropagation(); setYellowBins(yellowBins + 1); }}>+</button>
                      </div>
                      {binPlan === 0 && yellowBins > 0 && (
                        <div className="text-[10px] text-slate-500 tabular-nums w-10 text-right">${yellowBinFreq === 0 ? 20 : 15}<span className="text-slate-400">/ea</span></div>
                      )}
                    </div>
                    {yellowBins > 0 && binPlan === 0 && (
                      <div className="flex gap-1 mt-2 ml-6">
                        {[
                          { val: 0, label: 'One-off' },
                          { val: 1, label: 'Fortnightly' },
                        ].map((opt) => (
                          <button key={opt.val} type="button" className={cls('px-2 py-0.5 rounded-full border text-[10px] transition-colors', yellowBinFreq === opt.val ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')} onClick={(e) => { e.stopPropagation(); setYellowBinFreq(opt.val); }} aria-label={`${opt.label} frequency for yellow bins`}>{opt.label}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Green — Garden */}
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-slate-800">Garden waste</div>
                        <div className="text-[10px] text-slate-500">Green lid</div>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                        <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Decrease green bins" onClick={(e) => { e.stopPropagation(); setGreenBins(greenBins - 1); }}>–</button>
                        <span className="min-w-[18px] text-center font-semibold text-[12px]">{greenBins}</span>
                        <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Increase green bins" onClick={(e) => { e.stopPropagation(); setGreenBins(greenBins + 1); }}>+</button>
                      </div>
                      {binPlan === 0 && greenBins > 0 && (
                        <div className="text-[10px] text-slate-500 tabular-nums w-10 text-right">${greenBinFreq === 0 ? 22 : 17}<span className="text-slate-400">/ea</span></div>
                      )}
                    </div>
                    {greenBins > 0 && binPlan === 0 && (
                      <div className="flex gap-1 mt-2 ml-6">
                        {[
                          { val: 0, label: 'One-off' },
                          { val: 1, label: 'Monthly' },
                        ].map((opt) => (
                          <button key={opt.val} type="button" className={cls('px-2 py-0.5 rounded-full border text-[10px] transition-colors', greenBinFreq === opt.val ? 'bg-green-600 text-white border-green-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')} onClick={(e) => { e.stopPropagation(); setGreenBinFreq(opt.val); }} aria-label={`${opt.label} frequency for green bins`}>{opt.label}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Kitchen — Add-on */}
                  <div className={cls('px-3 py-2.5', totalWheelies === 0 && 'opacity-40')}>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded bg-amber-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="text-[11px] font-medium text-slate-800">Kitchen caddy</div>
                          <span className="text-[8px] px-1 py-px rounded bg-slate-200 text-slate-500 uppercase tracking-wide">Add-on</span>
                        </div>
                        <div className="text-[10px] text-slate-500">{totalWheelies === 0 ? 'Add a wheelie bin first' : '$7.50/ea — cleaned same visit'}</div>
                      </div>
                      {totalWheelies > 0 && (
                        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                          <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Decrease kitchen bins" onClick={(e) => { e.stopPropagation(); setKitchenBins(kitchenBins - 1); }}>–</button>
                          <span className="min-w-[18px] text-center font-semibold text-[12px]">{kitchenBins}</span>
                          <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Increase kitchen bins" onClick={(e) => { e.stopPropagation(); setKitchenBins(kitchenBins + 1); }}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bin count note for plans */}
                {binPlan > 0 && totalWheelies > 0 && (
                  <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500">
                    {totalWheelies} of {binPlan === 1 ? 5 : 3} included bins used{totalWheelies > (binPlan === 1 ? 5 : 3) ? ` — ${totalWheelies - (binPlan === 1 ? 5 : 3)} extra at $6/ea` : ''}
                  </div>
                )}
              </div>

              {/* Info footer */}
              <div className="text-[10px] text-slate-500 leading-relaxed">
                Flat rates per bin, no hidden fees. Subscriptions lock in lower rates and guarantee your spot.
                {(totalWheelies > 0 || validKitchenBins > 0) && (
                  <span className="text-slate-400"> Price updates in the bar below.</span>
                )}
              </div>
            </div>
          </div>
        )}

        {isActive && S.service === 'laundry_sneakers' && isSneakerCareCard && isSneakerRefresh && (
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

        {isActive && S.service === 'laundry_sneakers' && isSneakerCareCard && isSneakerDeep && (
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

        {isActive && S.service === 'laundry_sneakers' && isSneakerCareCard && isSneakerMulti && (
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
                      setMultiPairs((n) => Math.max(1, Math.min(10, n - 1)));
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
                      setMultiPairs((n) => Math.max(1, Math.min(10, n + 1)));
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
                  const current = cleaningAddonsForScope(sc.key, S.cleaningAddons);
                  const next = { ...current, [`addon_${a.key}`]: current[`addon_${a.key}`] ? 0 : 1 };
                  set('cleaningAddons', { ...S.cleaningAddons, [sc.key]: next });
                }}
              >
                {(addonsState as any)[`addon_${a.key}`] ? '✓ ' : ''}{a.label}
              </button>
            ))}
          </div>
        )}

            </M.div>
          )}
        </AnimatePresence>
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
}, scopeCardPropsAreEqual);

function ServicesPageContent() {
  const searchParams = useSearchParams();
  const [S, dispatch] = useLocalStorageReducer<WizardState>(
    STORAGE_KEY,
    wizardReducer,
    getInitialState
  );
  const yardActive = S.service === 'yard';
  const motionEnabled = !yardActive;
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [hasInteractedStep2, setHasInteractedStep2] = useState(false);
  const assistant = useAssistant({
    dispatch,
    wizardStep: S.step,
    wizardHasInteracted: hasInteractedStep2,
    context: S.context,
  });
  const [urlServiceHandled, setUrlServiceHandled] = useState(false);
  // Detect rebook mode from URL before params are cleared (read once at mount).
  const [isRebook] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('rebook')
  );
  usePolygonQuote();
  const carSelector = useCarModelSelector();
  const { carType: carSelectorType, dirtLevel: carSelectorDirt, zones: carSelectorZones, derived: carSelectorDerived, setCarType: carSelectorSetType, setDirtLevel: carSelectorSetDirt, toggleZone: carSelectorToggleZone } = carSelector;
  const [isClient, setIsClient] = useState(false);
  const routeCacheRef = useRef<Map<string, RouteLookupResult>>(new Map());
  const [routeLookup, setRouteLookup] = useState<RouteLookupResult | null>(null);
  const [routeLookupLoading, setRouteLookupLoading] = useState(false);
  const [routeLookupMessage, setRouteLookupMessage] = useState<string | null>(null);
  const [mmmDetection, setMmmDetection] = useState<MmmDetectionState>({ status: 'idle' });
  const [showManualNdisRegion, setShowManualNdisRegion] = useState(false);
  const lastMmmLookupRef = useRef<string>('');
  const set = React.useCallback(
    <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
      dispatch({ type: 'set', key, value });
    },
    [dispatch]
  );
  const setMany = React.useCallback(
    (values: Partial<WizardState>) => {
      dispatch({ type: 'merge', value: values });
    },
    [dispatch]
  );
  const trackQuoteEvent = React.useCallback((eventName: string, payload: AnalyticsEventData = {}) => {
    sendGAEvent('event', eventName, payload);
    void trackPublicAnalyticsEvent({
      eventName,
      eventData: payload,
    });
  }, []);
  const isNdisMmmEligible = S.context === 'ndis' && (S.service === 'cleaning' || S.service === 'yard');
  const detectNdisMmmRegion = React.useCallback(async (coords: { lat: number; lng: number }) => {
    if (!isNdisMmmEligible) return;

    setMmmDetection({ status: 'checking' });
    try {
      const params = new URLSearchParams({
        context: 'ndis',
        service: S.service,
        lat: String(coords.lat),
        lng: String(coords.lng),
      });
      const response = await fetch(`/api/geo/mmm?${params.toString()}`);
      const data = (await response.json()) as Partial<MmmApiResponse> & { error?: string };

      if (!response.ok || !data.label || !data.pricingRegion) {
        throw new Error(data.error || 'MMM detection failed.');
      }

      const ndisRegion: NdisRegion =
        data.pricingRegion === 'veryRemote' ? 'very_remote' : data.pricingRegion;

      setMany({ ndisRegion, ndisRegionSource: 'auto' });
      setShowManualNdisRegion(false);
      if (data.geocode?.address) {
        setMany({
          address: data.geocode.address,
          region: data.geocode.address,
        });
      }
      setMmmDetection({ status: 'detected', label: data.label });
    } catch {
      setMmmDetection({
        status: 'failed',
        message: 'We couldn’t detect your MMM region. Please choose it manually.',
      });
      setShowManualNdisRegion(true);
    }
  }, [S.service, isNdisMmmEligible, setMany]);
  const detectNdisMmmAddress = React.useCallback(async (address: string) => {
    const trimmed = address.trim();
    if (!isNdisMmmEligible || !trimmed) return;

    setMmmDetection({ status: 'checking' });
    try {
      const params = new URLSearchParams({
        context: 'ndis',
        service: S.service,
        address: trimmed,
      });
      const response = await fetch(`/api/geo/mmm?${params.toString()}`);
      const data = (await response.json()) as Partial<MmmApiResponse> & { error?: string };

      if (!response.ok || !data.label || !data.pricingRegion) {
        throw new Error(data.error || 'MMM detection failed.');
      }

      const ndisRegion: NdisRegion =
        data.pricingRegion === 'veryRemote' ? 'very_remote' : data.pricingRegion;

      if (S.ndisRegionSource !== 'manual') {
        setMany({ ndisRegion, ndisRegionSource: 'auto' });
        setShowManualNdisRegion(false);
      }
      setMmmDetection({ status: 'detected', label: data.label });
    } catch {
      setMmmDetection({
        status: 'failed',
        message: 'We couldn’t detect your MMM region. Please choose it manually.',
      });
      setShowManualNdisRegion(true);
    }
  }, [S.ndisRegionSource, S.service, isNdisMmmEligible, setMany]);
  const handleServiceAddressSelected = React.useCallback((formatted: string, suburb?: string, coords?: { lat: number; lng: number }) => {
    setMany({
      address: formatted,
      region: suburb || formatted,
    });
    if (coords && isNdisMmmEligible) {
      void detectNdisMmmRegion(coords);
    } else if (isNdisMmmEligible) {
      void detectNdisMmmAddress(formatted);
    }
    trackQuoteEvent('quote_step3_address_filled', { service: S.service, scope: S.scope });
  }, [S.service, S.scope, detectNdisMmmAddress, detectNdisMmmRegion, isNdisMmmEligible, setMany, trackQuoteEvent]);
  const handleYardMapAddressSelected = React.useCallback((address: string, coords?: { lat: number; lng: number }) => {
    handleServiceAddressSelected(address, address, coords);
  }, [handleServiceAddressSelected]);
  const renderMmmStatus = React.useCallback(() => {
    if (!isNdisMmmEligible || mmmDetection.status === 'idle') return null;

    const text =
      mmmDetection.status === 'checking'
        ? 'Checking MMM region...'
        : mmmDetection.status === 'detected'
          ? `Detected: ${mmmDetection.label}`
          : mmmDetection.message;

    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
        <span
          className={cls(
            'inline-flex items-center rounded-full border px-2.5 py-1 font-medium',
            mmmDetection.status === 'checking'
              ? 'border-violet-200 bg-violet-50 text-violet-700'
              : mmmDetection.status === 'detected'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
          )}
        >
          {text}
        </span>
      </div>
    );
  }, [isNdisMmmEligible, mmmDetection]);
  useEffect(() => {
    if (!isNdisMmmEligible) {
      setMmmDetection({ status: 'idle' });
      setShowManualNdisRegion(false);
      lastMmmLookupRef.current = '';
    }
  }, [isNdisMmmEligible]);
  useEffect(() => {
    if (!isNdisMmmEligible || S.ndisRegionSource === 'manual') return;
    const address = S.address?.trim() ?? '';
    if (!address || lastMmmLookupRef.current === address) return;
    lastMmmLookupRef.current = address;
    void detectNdisMmmAddress(address);
  }, [S.address, S.ndisRegionSource, detectNdisMmmAddress, isNdisMmmEligible]);
  const handlePartnerReferralClick = React.useCallback(() => {
    try {
      trackQuoteEvent('partner_referral_click', {
        partner: 'MaluCare',
        source: 'services_ndis_quote_flow',
        destination_url: 'https://malucare.org/',
      });
    } catch (error) {
      console.warn('[analytics] partner_referral_click failed', error);
    }
  }, [trackQuoteEvent]);

  // Tracks the currently authenticated user for contact-form UX (badge + mismatch warning).
  const [authedUser, setAuthedUser] = useState<User | null>(null);

  // Stable ref so handleAuthSignIn can read the latest contact values without
  // being recreated (and re-registering the event listener) on every keystroke.
  const wizardContactRef = useRef({ fullName: S.fullName, email: S.email, phone: S.phone });
  useEffect(() => {
    wizardContactRef.current = { fullName: S.fullName, email: S.email, phone: S.phone };
  }, [S.fullName, S.email, S.phone]);

  // Pre-fill contact fields from auth user (only if the fields are currently empty).
  // Depends only on `dispatch` which is stable — the listener is registered once.
  const handleAuthSignIn = React.useCallback((user: User) => {
    setAuthedUser(user);
    const meta = user.user_metadata as Record<string, string | undefined>;
    const { fullName, email, phone } = wizardContactRef.current;
    const prefill: Partial<WizardState> = {};
    if (!fullName?.trim() && meta?.full_name) prefill.fullName = meta.full_name;
    if (!email?.trim() && user.email) prefill.email = user.email;
    if (!phone?.trim() && meta?.phone) prefill.phone = meta.phone;
    if (Object.keys(prefill).length > 0) dispatch({ type: 'merge', value: prefill });
  }, [dispatch]);

  // Listen for sign-in from the header's inline ServicesAuthBar.
  // The handler is stable so this effect runs exactly once.
  React.useEffect(() => {
    const handler = (e: Event) => handleAuthSignIn((e as CustomEvent<User>).detail);
    window.addEventListener('svc:auth-signin', handler);
    return () => window.removeEventListener('svc:auth-signin', handler);
  }, [handleAuthSignIn]);

  const [isDistanceInputFocused, setIsDistanceInputFocused] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaExpired, setCaptchaExpired] = useState(false);
  // Gate Turnstile render until the user first interacts with the contact form,
  // avoiding an eager network request on step-3 mount for users who abandon early.
  const [captchaReady, setCaptchaReady] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [saveToProfile, setSaveToProfile] = useState(true);
  // True once the /api/portal/profile fetch has settled (success or failure).
  // Used to gate autofocus and validation errors so they never fire before hydration.
  const [profileHydrated, setProfileHydrated] = useState(false);
  // Track which contact fields have been blurred so we can show "required" on empty touched fields.
  const [fieldTouched, setFieldTouched] = useState<Record<string, boolean>>({});
  const touchField = useCallback((name: string) => setFieldTouched(prev => ({ ...prev, [name]: true })), []);
  const submitAbortRef = useRef<AbortController | null>(null);
  // Prevent double-submit on slow networks (AbortController cleanup on unmount).
  useEffect(() => { return () => { submitAbortRef.current?.abort(); }; }, []);

  // --- Tracking: record when Step 2 becomes active so we can measure time-to-advance ---
  const step2StartTsRef = useRef<number | null>(null);
  useEffect(() => {
    if (S.step === 2 && step2StartTsRef.current === null) {
      step2StartTsRef.current = Date.now();
    }
    if (S.step !== 2) {
      if (step2StartTsRef.current !== null) {
        const timeOnStep2 = Math.round((Date.now() - step2StartTsRef.current) / 1000);
        trackQuoteEvent('quote_step2_time', { service: S.service, scope: S.scope, seconds: timeOnStep2 });
      }
      step2StartTsRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.step]);

  // --- Tracking: record when Step 3 becomes active so we can measure time-to-submit ---
  const step3StartTsRef = useRef<number | null>(null);
  useEffect(() => {
    if (S.step === 3 && step3StartTsRef.current === null) {
      step3StartTsRef.current = Date.now();
    }
    if (S.step !== 3) {
      step3StartTsRef.current = null;
    }
  }, [S.step]);

  // --- Tracking: fire once when all required contact fields become valid (high-intent signal) ---
  const contactCompleteFiredRef = useRef(false);
  useEffect(() => {
    if (S.step !== 3) { contactCompleteFiredRef.current = false; return; }
    const contactValid =
      S.fullName?.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email || '') &&
      S.phone.replace(/\D+/g, '').length >= 10;
    if (contactValid && !contactCompleteFiredRef.current) {
      contactCompleteFiredRef.current = true;
      trackQuoteEvent('quote_step3_contact_complete', { service: S.service, scope: S.scope });
    }
  }, [S.step, S.fullName, S.email, S.phone, S.service, S.scope, trackQuoteEvent]);

  // --- Tracking: fire on tab-close / navigation away from Step 3 before submitting ---
  useEffect(() => {
    if (S.step !== 3) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const missing: string[] = [];
        if (!S.fullName?.trim()) missing.push('name');
        if (!S.email?.trim()) missing.push('email');
        if (!S.phone?.trim()) missing.push('phone');
        if (!S.address?.trim()) missing.push('address');
        trackQuoteEvent('quote_step3_abandoned', {
          service: S.service,
          scope: S.scope,
          missing_fields: missing.join(',') || 'none',
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.step, S.service, S.scope, trackQuoteEvent]);
  const [laundryIroningOpen, setLaundryIroningOpen] = useState(false);
  // Step 3: controls whether the optional Availability + Notes cards are expanded
  const [s3DetailsOpen, setS3DetailsOpen] = useState(true);

  // Step 3: autofocus first empty required field on mount (skip if user is signed in and pre-filled).
  // For authenticated users, wait until profile hydration completes so we never autofocus a field
  // that is about to be filled, which would trigger blur → validation error before the user acts.
  useEffect(() => {
    if (S.step !== 3) return;
    if (authedUser && !profileHydrated) return;
    const alreadyFilled = authedUser && S.fullName?.trim() && S.email?.trim() && S.phone?.trim();
    if (!alreadyFilled) {
      const firstEmpty =
        !S.fullName?.trim() ? 's3-fullname' :
        !S.email?.trim() ? 's3-email' :
        !S.phone?.trim() ? 's3-phone' : null;
      if (firstEmpty) {
        setTimeout(() => document.getElementById(firstEmpty)?.focus(), 150);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.step, profileHydrated]);

  // Step 3: saved property address + access details for signed-in users (fetched once on step-3 mount)
  const [savedPropertyAddress, setSavedPropertyAddress] = useState<string | null>(null);
  const [savedPropertyAccess, setSavedPropertyAccess] = useState<{
    gate_code?: string | null;
    pet_warnings?: string | null;
    parking?: string | null;
    special_instructions?: string | null;
  } | null>(null);
  useEffect(() => {
    if (S.step !== 3 || !authedUser) return;
    let cancelled = false;
    fetch('/api/portal/property')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data?.property) return;
        const prop = data.property;
        if (prop.address) {
          setSavedPropertyAddress(prop.address);
          if (isRebook && !S.address?.trim()) {
            dispatch({ type: 'merge', value: { address: prop.address, region: prop.address } });
          }
        }
        const access = {
          gate_code: prop.gate_code ?? null,
          pet_warnings: prop.pet_warnings ?? null,
          parking: prop.parking ?? null,
          special_instructions: prop.special_instructions ?? null,
        };
        const hasAccess = Object.values(access).some((v) => v?.trim());
        if (hasAccess) {
          setSavedPropertyAccess(access);
          // On rebook, auto-compose notes from saved access details if notes field is empty.
          if (isRebook && !S.notes?.trim()) {
            const parts: string[] = [];
            if (access.gate_code?.trim()) parts.push(`Gate code: ${access.gate_code.trim()}`);
            if (access.pet_warnings?.trim()) parts.push(`Pets: ${access.pet_warnings.trim()}`);
            if (access.parking?.trim()) parts.push(`Parking: ${access.parking.trim()}`);
            if (access.special_instructions?.trim()) parts.push(access.special_instructions.trim());
            if (parts.length > 0) dispatch({ type: 'merge', value: { notes: parts.join('\n') } });
          }
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.step, authedUser]);
  const [routeExpanded, setRouteExpanded] = useState(false);
  const [transportRouteExpanded, setTransportRouteExpanded] = useState(false);

  const handleDistanceInputFocusChange = useCallback((focused: boolean) => {
    setIsDistanceInputFocused(focused);
  }, []);

  const handleDistancePlaceSelected = useCallback(() => {
    setIsDistanceInputFocused(false);
  }, []);
  const routeServiceActive = ROUTE_SCOPES.includes(S.scope as RouteScopeKey);
  const usesRoutePricing = S.service === 'dump' && routeServiceActive;
  const routeCardActive = usesRoutePricing;
  const normalizedStep = Number(S.step);
  const yardStep2 = yardActive && normalizedStep === 2;
  const mapVisible = yardStep2;

  // Optimized yard mapping logic with debouncing, batched updates, and memoization
  const {
    iframeRef,
    activeYardJob,
    postMessageToIframe,
    postZonesToIframe,
    addYardJob,
    removeYardJob,
    resetActivePolygon,
    isCalculating,
  } = useYardMapping({
    scope: S.scope,
    yardJobs: S.yardJobs,
    yardActiveJobId: S.yardActiveJobId,
    paramsByService: S.paramsByService,
    secondStorey: S.secondStorey,
    conditionLevel: S.conditionLevel,
    clutterAccess: S.clutterAccess,
    context: S.context,
    set,
    getYardMeasurementConfig,
    computeYardQuote,
    onAddressSelected: isNdisMmmEligible ? handleYardMapAddressSelected : undefined,
  });

  const yardMeasurementConfig = getYardMeasurementConfig(S.scope);
  const yardMeasurementUnit = YARD_MEASUREMENT_UNITS[yardMeasurementConfig.mode];
  // Sum across all zones in the active job
  const activeYardZones = activeYardJob?.polygon_geojson ?? [];
  const activeMeasurementValue =
    yardMeasurementConfig.mode === 'perimeter'
      ? activeYardZones.reduce((sum, zone) => sum + computePerimeterFromPath(zone), 0)
      : activeYardZones.reduce((sum, zone) => sum + computeAreaFromPath(zone), 0);
  const activeMeasurementLabel =
    activeMeasurementValue > 0
      ? `${yardMeasurementConfig.label}: ${Math.round(activeMeasurementValue)} ${yardMeasurementUnit}`
      : `Draw the ${yardMeasurementConfig.label.toLowerCase()} to capture ${yardMeasurementUnit}`;

  const getMeasurementValueForJob = (job: YardJob) => {
    const zones = job.polygon_geojson ?? [];
    return yardMeasurementConfig.mode === 'perimeter'
      ? zones.reduce((sum, zone) => sum + computePerimeterFromPath(zone), 0)
      : zones.reduce((sum, zone) => sum + computeAreaFromPath(zone), 0);
  };

  const measurementLabelForJob = (job: YardJob) => {
    const value = getMeasurementValueForJob(job);
    if (value > 0) {
      return `${yardMeasurementConfig.label}: ${Math.round(value)} ${yardMeasurementUnit}`;
    }
    return `Draw the ${yardMeasurementConfig.label.toLowerCase()} to capture ${yardMeasurementUnit}`;
  };

  const mapFrameSrc = '/yard-map-frame';

  // Reset handler + mount
  const hardResetQuote = React.useCallback((silent = false) => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    dispatch({ type: 'reset' });
    if (!silent) {
      toast.info('Quote reset.');
    }
    const target = iframeRef.current?.contentWindow;
    if (target) {
      target.postMessage({ type: 'YARD_SET_POLYGON', coords: [] }, window.location.origin);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    const handler = (e: Event) => {
      const silent = (e as CustomEvent).detail?.silent ?? false;
      hardResetQuote(silent);
    };
    window.addEventListener('svc:reset', handler);
    return () => window.removeEventListener('svc:reset', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hardResetQuote]);

  // Fire once on mount — provides the funnel entry baseline in GA4.
  useEffect(() => {
    trackQuoteEvent('quote_start', { context: S.context });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On mount: pre-fill contact fields for already-signed-in users, then prompt
  // to resume if there is meaningful quote progress in localStorage.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return; // anonymous visitors: restore silently, no prompt

      // Pre-fill contact fields even if the user didn't just sign in here —
      // e.g. they were already signed in when they navigated to /services.
      handleAuthSignIn(data.user);

      // Fetch the customer profile to fill in any fields not in user_metadata
      // (most importantly: phone, which is never stored in user_metadata).
      fetch('/api/portal/profile')
        .then((r) => r.ok ? r.json() : null)
        .then((profileData) => {
          if (profileData?.profile) {
            const p = profileData.profile as { full_name?: string; email?: string; phone?: string };
            const cur = wizardContactRef.current; // reads latest wizard values via stable ref
            const extra: Partial<WizardState> = {};
            if (!cur.fullName?.trim() && p.full_name) extra.fullName = p.full_name;
            if (!cur.email?.trim() && p.email) extra.email = p.email;
            if (!cur.phone?.trim() && p.phone) extra.phone = p.phone;
            if (Object.keys(extra).length > 0) dispatch({ type: 'merge', value: extra });
          }
          setProfileHydrated(true);
        })
        .catch(() => { setProfileHydrated(true); });

      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<WizardState>;
        const hasProgress =
          (parsed.step ?? 1) > 1 ||
          (parsed.service && parsed.service !== 'windows') ||
          Boolean((parsed.fullName as string | undefined)?.trim()) ||
          Boolean((parsed.email as string | undefined)?.trim());
        if (!hasProgress) return;
        // Describe where they left off so the prompt is concrete, not vague.
        const stepLabel = parsed.step === 3 ? 'Step 3 (contact)'
          : parsed.step === 2 ? 'Step 2 (details)'
          : 'in progress';
        const ctxLabel = parsed.context ? ` · ${parsed.context}` : '';
        toast('Quote resumed', {
          description: `Picked up where you left off — ${stepLabel}${ctxLabel}.`,
          duration: 8_000,
          // No-op action just acknowledges; state is already restored by
          // useLocalStorageReducer. We confirm rather than do nothing silently.
          action: { label: 'Got it', onClick: () => {} },
          cancel: { label: 'Start fresh', onClick: () => hardResetQuote(true) },
        });
      } catch {}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Track touch/pointer state to distinguish clicks from scrolls on mobile
  const pointerStartRef = useRef<{ x: number; y: number; target: EventTarget | null } | null>(null);
  const scrolledDuringTouchRef = useRef(false);

  useEffect(() => {
    if (!isClient) return;

    const handlePointerDown = (e: PointerEvent) => {
      // Record starting position to detect scrolling
      pointerStartRef.current = { x: e.clientX, y: e.clientY, target: e.target };
      scrolledDuringTouchRef.current = false;
    };

    const handleScroll = () => {
      // Mark that a scroll happened during the touch
      scrolledDuringTouchRef.current = true;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isDistanceInputFocused) return;
      if (!activeServiceId) return;

      // If user scrolled, don't collapse
      if (scrolledDuringTouchRef.current) {
        pointerStartRef.current = null;
        return;
      }

      // Check if this was a significant movement (scroll gesture on mobile)
      const start = pointerStartRef.current;
      if (start) {
        const dx = Math.abs(e.clientX - start.x);
        const dy = Math.abs(e.clientY - start.y);
        // If moved more than 10px, treat as scroll/drag not click
        if (dx > 10 || dy > 10) {
          pointerStartRef.current = null;
          return;
        }
      }

      const target = e.target as HTMLElement | null;
      if (target?.closest('.pac-container')) return;
      if (target?.closest('[data-card-interactive="true"]')) return;
      if (routeCardActive) return;
      const cardEl = target?.closest('[data-scope-card]');
      // Only collapse when clicking completely outside any card; moving between cards should stay open.
      if (!cardEl) setActiveServiceId(null);

      pointerStartRef.current = null;
    };

    document.addEventListener('pointerdown', handlePointerDown, { passive: true });
    document.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
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

  // Sync car selector derived into wizard state (optimized to prevent unnecessary updates)
  useEffect(() => {
    const d = carSelector.derived;
    if (S.carModelType !== d.carType) set('carModelType', d.carType);
    if (S.carModelZones.length !== d.zones.length || d.zones.some((z, i) => z !== S.carModelZones[i])) set('carModelZones', d.zones);
    if (S.carDirtLevel !== d.dirtLevel) set('carDirtLevel', d.dirtLevel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carSelector.derived.carType, carSelector.derived.zones.length, carSelector.derived.dirtLevel]);

  useEffect(() => {
    if (AUTO_SIZE_CATEGORIES.includes(S.carModelType as VehicleSizeCategory)) {
      const nextSize = S.carModelType as VehicleSizeCategory;
      if (S.carDetectedSizeCategory !== nextSize) {
        set('carDetectedSizeCategory', nextSize);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.carModelType, S.carDetectedSizeCategory]);

  // -------------------------
  // Step logic
  // -------------------------
  const [openChecklists, setOpenChecklists] = React.useState<Record<string, boolean>>({});
  const [floorPlanResetKey, setFloorPlanResetKey] = React.useState<number>(0);

  const applyScopePreset = React.useCallback((svc: ServiceType, sc: ScopeKey) => {
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

    // When switching yard scopes, preserve existing jobs (with addresses and polygons)
    // but recalculate prices based on the new scope's measurement mode
    if (svc === 'yard' && sc !== S.scope) {
      // Don't reset jobs - just trigger a recalculation by updating the scope
      // The useYardMapping hook will recalculate measurements for the new scope
      // Keep existing polygon/area state intact
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
  }, [set, S.paramsByService, S.context, S.scope, S.floorPlanEstimate, S.winRows]);

  const goToStep = (n: 1 | 2 | 3) => {
    if (n === 1) {
      trackQuoteEvent('quote_reset', { service: S.service, context: S.context });
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

    if (n < S.step) {
      trackQuoteEvent('quote_step_back', { from: S.step, to: n, service: S.service });
    }

    if (n === 2) {
      // Ensure current scope has its preset applied so Step 2 UI starts consistent
      applyScopePreset(S.service, S.scope);
      setActiveServiceId(null);
      trackQuoteEvent('quote_step_2', { service: S.service });
    }

    if (n === 3) {
      trackQuoteEvent('quote_step_3', { service: S.service, scope: S.scope });
      // Pre-fill users already have their contact details — prime captcha immediately.
      if (authedUser) setCaptchaReady(true);
    }

    set('step', n);
  };

  const selectService = (svc: ServiceType) => {
    trackQuoteEvent('service_selected', { service: svc, context: S.context });
    const defaultScope =
      svc === 'dump' ? 'dump_runs' :
      svc === 'windows' ? 'windows_full' :
      svc === 'yard' ? 'yard_mow' :
      svc === 'auto' ? 'auto_express' :
      svc === 'laundry_sneakers' ? 'laundry' :
      'general';
    dispatch({
      type: 'merge',
      value: { service: svc, scope: defaultScope, step: 2 },
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

    // Auto-advance to Step 2 — intent is clear on tile selection
    trackQuoteEvent('quote_step_2', { service: svc });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.commercialCleaningType]);

  // Enforce context rules (service availability, windows screens)
  useEffect(() => {
    const allowed = ALLOWED_SERVICES_BY_CONTEXT[S.context];
    if (!allowed.includes(S.service)) {
      // IMPORTANT: Don't auto-advance to Step 2 when the context switch forces
      // a service reset. Keep the user on Step 1 so they can pick between the
      // allowed services (e.g. NDIS → Cleaning vs Yard Care).
      const fallback = allowed[0];
      const defaultScope =
        fallback === 'dump' ? 'dump_runs' :
        fallback === 'windows' ? 'windows_full' :
        fallback === 'yard' ? 'yard_mow' :
        fallback === 'auto' ? 'auto_express' :
        fallback === 'laundry_sneakers' ? 'laundry' :
        'general';
      dispatch({
        type: 'merge',
        value: { service: fallback, scope: defaultScope, step: 1 },
      });
      setActiveServiceId(null);
    }

    // screens always 0 in commercial
    if (S.context === 'commercial' && S.service === 'windows') {
      const rs = S.winRows.map((r) => ({ ...r, screens: 0 }));
      set('winRows', rs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.context]);

  // Handle URL service parameter - navigate directly to step 2 with the selected service
  useEffect(() => {
    if (urlServiceHandled) return;
    const serviceParam = searchParams?.get('service');
    if (!serviceParam) return;

    const validServices: ServiceType[] = ['windows', 'cleaning', 'yard', 'dump', 'auto', 'laundry_sneakers'];
    if (validServices.includes(serviceParam as ServiceType)) {
      setUrlServiceHandled(true);
      // Clear URL parameter to prevent re-triggering
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('service');
        window.history.replaceState({}, '', url.pathname);
      }
      // Select the service and go to step 2
      selectService(serviceParam as ServiceType);
      set('step', 2);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, urlServiceHandled]);

  // Handle rebook URL params — pre-fill service, context, scope, and notes from a previous order/subscription.
  // Runs once on mount; clears params from the URL immediately so back-navigation doesn't re-trigger.
  useEffect(() => {
    if (!isRebook) return;
    const params = new URLSearchParams(window.location.search);
    const rebookService = params.get('rebook') as ServiceType | null;
    const rebookContext = params.get('context') as 'home' | 'commercial' | null;
    const rebookScope = params.get('scope');
    const rebookNotes = params.get('notes');

    const validServices: ServiceType[] = ['windows', 'cleaning', 'yard', 'dump', 'auto', 'laundry_sneakers'];
    if (!rebookService || !validServices.includes(rebookService)) return;

    // Strip rebook params from URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('rebook');
      url.searchParams.delete('context');
      url.searchParams.delete('scope');
      url.searchParams.delete('notes');
      window.history.replaceState({}, '', url.pathname + (url.search || ''));
    }

    const prefill: Partial<WizardState> = { service: rebookService };
    if (rebookContext) prefill.context = rebookContext;
    if (rebookScope) prefill.scope = rebookScope as ScopeKey;
    // Pre-fill notes from the previous order (only if no notes already in local storage)
    if (rebookNotes?.trim() && !S.notes?.trim()) prefill.notes = rebookNotes.trim();
    dispatch({ type: 'merge', value: prefill });
    set('step', 2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        : S.service === 'laundry_sneakers'
        ? {
            ...(S.paramsByService[S.service] || {}),
            laundryTier: S.laundryTier,
            laundryLoads: S.laundryLoads,
            sneakerTier: S.sneakerTier,
          }
        : S.paramsByService[S.service] || {};

    return selectedFromParams(
      S.service,
      S.scope,
      mergedCleaning as any,
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
    S.laundryTier,
    S.laundryLoads,
    S.sneakerTier,
    winTotals,
    winTotalsSession,
    S.context,
  ]);

  const selected = useMemo(() => sumSelected({}, fromParams), [fromParams]);
  const hasWork = useMemo(
    () => Object.values(selected).some((v) => (v || 0) > 0),
    [selected]
  );

  // Per-service minimum-work check: guards the Step 2 → Step 3 CTA.
  const hasMinimumWork = useMemo(() => {
    switch (S.service) {
      case 'cleaning':
        return isNdisMmmEligible ? hasWork && S.address.trim().length > 0 : hasWork;
      case 'windows':
        return S.winRows.some((r) => (r.int ?? 0) > 0 || (r.ext ?? 0) > 0);
      case 'yard':
        return (
          (!isNdisMmmEligible || S.address.trim().length > 0) &&
          (S.yardJobs?.length ?? 0) > 0 &&
          (S.yardJobs ?? []).every((job: { polygon_geojson?: unknown[][] }) =>
            (job.polygon_geojson ?? []).some((z) => z.length >= 3)
          )
        );
      case 'auto':
        return !!S.carModelType;
      case 'dump':
        return !!(S.dumpRun ?? S.dumpDelivery ?? S.dumpTransport);
      case 'laundry_sneakers':
        return (S.laundryLoads ?? 0) >= 1;
      default:
        return hasWork;
    }
  }, [S.service, S.address, S.winRows, S.yardJobs, S.carModelType, S.dumpRun, S.dumpDelivery, S.dumpTransport, S.laundryLoads, hasWork, isNdisMmmEligible]);

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

  // Previously this effect detected reloads via performance.navigation and
  // hard-reset the quote. That destroyed in-progress quotes for everyone
  // (especially authenticated users returning to /services), and it ran
  // BEFORE the "Quote in progress" toast could even read localStorage.
  // Restoration is now handled exclusively by useLocalStorageReducer +
  // the resume toast in the auth effect above. Reloads keep your progress.
  useEffect(() => {
    if (!isClient) return;
    // Intentionally a no-op: kept as a hook stub so future reload-aware
    // logic (e.g. analytics) has an obvious place to live.
  }, [isClient]);

  // Ensure at least one yard job exists
  useEffect(() => {
    if (S.yardJobs && S.yardJobs.length > 0) return;
    set('yardJobs', [createYardJob()]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const isSneakerTurnaroundAvailable = React.useCallback((key: SneakerTurnaround) => {
    const meta = sneakerTurnaroundMeta(key);
    const used = sneakerTurnaroundUsage[key] || 0;
    if (S.sneakerTurnaround === key) return true;
    return used < meta.capacity;
  }, [S.sneakerTurnaround, sneakerTurnaroundUsage]);

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
        bottleCount: 0, // Deprecated: now handled via recycling bin pricing
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      S.paramsByService.dump?.redBins,
      S.paramsByService.dump?.redBinFreq,
      S.paramsByService.dump?.yellowBins,
      S.paramsByService.dump?.yellowBinFreq,
      S.paramsByService.dump?.greenBins,
      S.paramsByService.dump?.greenBinFreq,
      S.paramsByService.dump?.kitchenBins,
      S.paramsByService.dump?.binPlan,
      S.paramsByService.yard,
      S.yardArea,
      S.dumpRun,
      S.commPreset,
      S.commFrequency,
      S.cleaningAddons,
      S.winRows,
      S.carModelType,
      autoSizeCategory,
      autoYear,
      S.sneakerTurnaround,
      S.laundryTier,
      S.laundryLoads,
      S.sneakerTier,
    ]
  );

  const servicedRegion = canonicalServiceRegion(S.region);


  // React wrapper
  const windowsSessionMinutes = React.useCallback(
    (rows: WizardState['winRows']) =>
      computeWindowsMinutes(S.scope, rows, S.context, S.paramsByService.windows),
    [S.scope, S.context, S.paramsByService.windows]
  );

const routeDurationOverride =
  usesRoutePricing && routeLookup ? Math.max(1, routeLookup.durationMinutes) : null;
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
  // Auto detailing: use fixed package times regardless of vehicle size multiplier
  if (S.service === "auto") {
    const autoTimeMap: Partial<Record<string, number>> = {
      auto_express: 120,
      auto_interior: 120,
      auto_full: 240,
    };
    return autoTimeMap[S.scope] ?? estimate.minutes;
  }
  // Dump runs: scale time with load count and load type
  if (S.service === "dump" && S.scope === "dump_runs") {
    const loads = Math.max(1, S.dumpRun?.loads || 1);
    const loadType = S.dumpRun?.loadType || 'ute';
    const perLoadMins = loadType === 'trailer' ? 45 : loadType === 'bulky' ? 20 : 30;
    return 15 + loads * perLoadMins;
  }
  return routeDurationOverride ?? estimate.minutes;
// eslint-disable-next-line react-hooks/exhaustive-deps
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
  S.dumpRun,
]);

const routePriceOverride = useMemo<number | null>(() => {
  // Transport and delivery use dedicated calculators — route formula doesn't apply
  if (S.scope === 'dump_transport' || S.scope === 'dump_delivery') return null;
  if (!routeCardActive || !routeLookup) return null;
  const raw =
    ROUTE_BASE_FEE +
    routeLookup.distanceKm * ROUTE_PER_KM_RATE +
    routeLookup.durationMinutes * ROUTE_PER_MIN_RATE;
  return Math.max(ROUTE_MIN_PRICE, Math.round(raw));
}, [S.scope, routeCardActive, routeLookup]);
const routeDistanceLabel = routeLookup
  ? `${routeLookup.distanceKm.toFixed(1)} km · ${Math.round(routeLookup.durationMinutes)} mins travel`
  : null;
// eslint-disable-next-line react-hooks/exhaustive-deps
const scopedPricing = useMemo(() => calculateServicePrice(S.scope, S), [
  S,
  S.scope,
  S.paramsByService.dump?.redBins,
  S.paramsByService.dump?.redBinFreq,
  S.paramsByService.dump?.yellowBins,
  S.paramsByService.dump?.yellowBinFreq,
  S.paramsByService.dump?.greenBins,
  S.paramsByService.dump?.greenBinFreq,
  S.paramsByService.dump?.kitchenBins,
  S.paramsByService.dump?.binPlan,
]);

  // NDIS context is always priced as (estimated hours × Price Guide rate for
  // the chosen slot + region) — this bypasses scope-based pricing for cleaning
  // + yard. Defaults to weekday-day metro so quotes match the pre-rate-table
  // behaviour until the user explicitly picks a band.
  const effectiveNdisHours =
    S.context === 'ndis' && S.service === 'cleaning'
      ? S.ndisHoursOrigin === 'manual' && S.ndisEstimatedHours
        ? S.ndisEstimatedHours
        : suggestNdisCleaningHours({
            bedrooms: S.ndisPropertyBedrooms,
            bathrooms: S.ndisPropertyBathrooms,
            living: S.ndisPropertyLiving,
            kitchens: S.ndisPropertyKitchens,
            laundry: S.ndisPropertyLaundry,
            storeys: S.ndisPropertyStoreys,
            condition: S.ndisCondition,
          })
      : S.context === 'ndis' && S.service === 'yard'
        ? S.ndisHoursOrigin === 'manual' && S.ndisEstimatedHours
          ? S.ndisEstimatedHours
          : suggestNdisYardHours(S.ndisYardSize, S.ndisCondition)
        : null;
  const ndisHourlyPrice =
    S.context === 'ndis' && (S.service === 'cleaning' || S.service === 'yard')
      ? Math.round((effectiveNdisHours || NDIS_MIN_HOURS) * ndisRateFor(S.ndisRateSlot, S.ndisRegion))
      : null;
  const effectivePrice = ndisHourlyPrice ?? routePriceOverride ?? scopedPricing.price;
  const isSneakerLot = S.service === 'laundry_sneakers' && (S.scope === 'sneaker_lot' || (S.scope === 'sneaker_care' && S.sneakerTier === 'multi'));
  const isLaundryService = S.service === 'laundry_sneakers' && S.scope === 'laundry';
  const isSneakerService = S.service === 'laundry_sneakers' && S.scope === 'sneaker_care';
  // Minimums: $60 laundry, $40 sneaker care
  const LAUNDRY_MIN = 60;
  const SNEAKER_MIN = 40;
  // Fees: $12 pickup+delivery + $2 service fee for laundry; $8 p+d + $2 service fee for sneakers
  const LAUNDRY_FEE = 14; // $12 delivery + $2 service
  const SNEAKER_FEE = 10; // $8 delivery + $2 service

  const laundryLoads = S.laundryLoads || 1;
  const laundryAddOnTotal = useMemo(() => {
    const perLoad = (S.laundryPerLoadAddOns ?? []).reduce(
      (sum, k) => sum + (LAUNDRY_PER_LOAD_ADDONS[k]?.price ?? 0) * laundryLoads,
      0,
    );
    const perOrder = (S.laundryPerOrderAddOns ?? []).reduce(
      (sum, k) => sum + (LAUNDRY_PER_ORDER_ADDONS[k]?.price ?? 0),
      0,
    );
    const ironing = (S.laundryIroningItems ?? []).reduce(
      (sum, item) => sum + (LAUNDRY_IRONING_PRICES[item.type]?.price ?? 0) * item.count,
      0,
    );
    return perLoad + perOrder + ironing;
  }, [S.laundryPerLoadAddOns, S.laundryPerOrderAddOns, S.laundryIroningItems, laundryLoads]);

  const priceLabelBase = useMemo(() => {
    if (S.service === 'dump' && S.scope === 'dump_transport') {
      const result = calcTransportQuote(S.dumpTransport, S.distanceKm);
      return result.isCustomQuote ? 'Custom quote' : fmtAUD(result.total);
    }
    if (S.service === 'dump' && S.scope === 'dump_delivery') {
      const result = calcDeliveryQuote(S.dumpDelivery, S.distanceKm);
      return result.isCustomQuote ? 'Custom quote' : fmtAUD(result.total);
    }
    if (isSneakerLot) {
      const opt = SNEAKER_MULTI_PRICING.find((o) => o.pairs === (S.sneakerPairCount ?? 3));
      return fmtAUD(opt?.price ?? 95);
    }
    if (isLaundryService) {
      const base = Math.max(LAUNDRY_MIN, laundryLoads * 30) + laundryAddOnTotal;
      return fmtAUD(base);
    }
    if (isSneakerService) return fmtAUD(Math.max(SNEAKER_MIN, effectivePrice));
    return fmtAUD(effectivePrice);
  }, [S.service, S.scope, S.dumpTransport, S.dumpDelivery, S.distanceKm, effectivePrice, isSneakerLot, isLaundryService, isSneakerService, S.sneakerPairCount, laundryLoads, laundryAddOnTotal]);

  const priceLabel = useMemo(() => {
    if (S.service === 'dump' && S.scope === 'dump_transport') {
      const result = calcTransportQuote(S.dumpTransport, S.distanceKm);
      return result.isCustomQuote ? 'Custom quote' : fmtAUD(result.total);
    }
    if (S.service === 'dump' && S.scope === 'dump_delivery') {
      const result = calcDeliveryQuote(S.dumpDelivery, S.distanceKm);
      return result.isCustomQuote ? 'Custom quote' : fmtAUD(result.total);
    }
    if (isSneakerLot) {
      const opt = SNEAKER_MULTI_PRICING.find((o) => o.pairs === (S.sneakerPairCount ?? 3));
      return fmtAUD((opt?.price ?? 95) + SNEAKER_FEE);
    }
    if (isLaundryService) {
      const base = Math.max(LAUNDRY_MIN, laundryLoads * 30) + laundryAddOnTotal;
      return fmtAUD(base + LAUNDRY_FEE);
    }
    if (isSneakerService) {
      const withFees = effectivePrice + SNEAKER_FEE;
      const total = Math.max(SNEAKER_MIN + SNEAKER_FEE, withFees);
      return fmtAUD(total);
    }
    return fmtAUD(effectivePrice);
  }, [S.service, S.scope, S.dumpTransport, S.dumpDelivery, S.distanceKm, effectivePrice, isSneakerLot, isLaundryService, isSneakerService, S.sneakerPairCount, laundryLoads, laundryAddOnTotal]);

  const timeLabel = useMemo(() => {
    if (isLaundryService) return '~1–2 business days';
    if (isSneakerService) {
      const turnaround = S.sneakerTurnaround ?? 'standard';
      const meta = SNEAKER_TURNAROUND_META.find((m) => m.key === turnaround);
      return meta ? `~${meta.window}` : '~3–5 business days';
    }
    // NDIS cleaning + yard are billed on an hourly estimate — surface that
    // directly instead of deriving from scope-based estMinutes.
    if (S.context === 'ndis' && (S.service === 'cleaning' || S.service === 'yard')) {
      const h = effectiveNdisHours || NDIS_MIN_HOURS;
      return `~${h} hr`;
    }
    return `~${fmtHrMin(estMinutes)}`;
  }, [effectiveNdisHours, estMinutes, isLaundryService, isSneakerService, S.sneakerTurnaround, S.context, S.service]);

  const isNdisContext = S.context === 'ndis';
  const serviceContextLabel = CONTEXT_LABELS[S.context];

function winSessionMinutes(S: WizardState) {
  return computeWindowsMinutes(S.scope, S.winRows, S.context, S.paramsByService.windows);
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
            'relative mx-auto max-w-6xl px-4 sm:px-6 md:px-8 py-10 overflow-x-hidden',
            !yardActive && S.step >= 2 ? 'pb-[12rem]' : ''
          )}
        >
          <div className="relative">
            {yardStep2 && (
              <div
                aria-hidden
                className="pointer-events-none hidden lg:block absolute inset-y-2 left-1/2 -translate-x-1/2 w-[2px] animate-pulse"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(16,185,129,0) 0%, rgba(16,185,129,0.3) 40%, rgba(16,185,129,0.3) 60%, rgba(16,185,129,0) 100%)',
                  filter: 'blur(0.5px)',
                  animationDuration: '3s',
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
            <section className="mb-12">
              <div>
                  <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">Build your quote</h1>
                  <p className="mt-2 text-slate-400 text-base">Instant pricing. No surprises.</p>
              </div>
              {/* Step progress indicator */}
              <div className="flex items-center gap-3 mt-6 select-none" aria-label="Quote progress">
                {([
                  { n: 1, label: 'Service' },
                  { n: 2, label: 'Details' },
                  { n: 3, label: 'Contact' },
                ] as const).map(({ n, label }, i) => {
                  const done = S.step > n;
                  const active = S.step === n;
                  return (
                    <React.Fragment key={n}>
                      {i > 0 && (
                        <div
                          className="flex-1 h-px rounded-full"
                          style={{
                            background: done ? 'var(--accent)' : '#e8eaed',
                            transition: 'background 300ms ease-in-out',
                          }}
                        />
                      )}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div
                          className="rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
                          style={{
                            width: active ? '22px' : '18px',
                            height: active ? '22px' : '18px',
                            background: active ? 'var(--accent)' : done ? 'var(--accent)' : '#dde1e7',
                            color: active || done ? '#fff' : '#9ca3af',
                            boxShadow: active ? '0 2px 8px rgba(15,61,46,0.25)' : 'none',
                            transition: 'all 200ms cubic-bezier(0.25,0.46,0.45,0.94)',
                          }}
                        >
                          {done ? (
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                              <polyline points="1.5 5 4 7.5 8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : n}
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: active ? 600 : 400,
                            color: active ? 'var(--accent)' : done ? '#64748b' : '#b0b8c4',
                            transition: 'color 200ms ease-in-out, font-weight 200ms ease-in-out',
                          }}
                        >
                          {label}
                        </span>
                      </div>
                    </React.Fragment>
                  );
                })}
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

                {/* Context segmented control */}
                <div className="mb-10">
                  <div
                    className="inline-flex items-center rounded-full p-1 gap-0.5"
                    style={{ background: '#eff0f2' }}
                    role="tablist"
                    aria-label="Context"
                  >
                    {CONTEXT_OPTIONS.map(({ key, label, activeColor }) => {
                      const isActive = S.context === key;
                      return (
                        <button
                          key={key}
                          role="tab"
                          aria-selected={isActive}
                          className="relative px-5 py-1.5 rounded-full text-sm font-medium focus-visible:outline-none"
                          style={{
                            background: isActive ? activeColor : 'transparent',
                            color: isActive ? '#fff' : 'rgba(75,85,99,0.85)',
                            boxShadow: isActive
                              ? key === 'ndis'
                                ? '0 2px 10px rgba(109,40,217,0.28)'
                                : '0 2px 8px rgba(15,61,46,0.22)'
                              : 'none',
                            transform: isActive ? 'scale(1.02)' : 'scale(1)',
                            transition: 'background 160ms ease-in-out, color 160ms ease-in-out, box-shadow 160ms ease-in-out, transform 160ms ease-in-out',
                          }}
                          onClick={() => {
                            if (S.context !== key) {
                              trackQuoteEvent('context_switched', { from: S.context, to: key });
                            }
                            set('context', key);
                          }}
                          aria-label={`Select ${label} context`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {isNdisContext && (
                  <section
                    aria-labelledby="ndis-hero-title"
                    className="mb-8 rounded-[28px] border border-violet-100/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,245,255,0.96))] shadow-[0_18px_40px_-26px_rgba(109,40,217,0.22)]"
                  >
                    <div
                      aria-hidden="true"
                      className="h-[2px] w-full bg-gradient-to-r from-violet-400 via-violet-500 to-fuchsia-400"
                    />
                    <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] md:items-center md:gap-8 md:p-7">
                      <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-800">
                          <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
                          NDIS quote flow
                        </div>
                        <h3
                          id="ndis-hero-title"
                          className="max-w-xl text-[24px] font-semibold leading-tight tracking-tight text-slate-900 md:text-[30px]"
                        >
                          Cleaning and yard care for NDIS participants.
                        </h3>
                        <p className="max-w-xl text-[15px] leading-7 text-slate-600">
                          Delivered through our partnership with MaluCare.
                        </p>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[12px] text-slate-500">
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                            Built for supported cleaning and yard care
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                            Plan, self, and agency-managed routing
                          </span>
                        </div>
                      </div>

                      <div className="w-full">
                        <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-slate-400 md:text-right">
                          In partnership with
                        </div>
                        <a
                          href="https://malucare.org/"
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Visit MaluCare website"
                          onClick={handlePartnerReferralClick}
                          className="group relative block w-full overflow-hidden rounded-[24px] border border-violet-100/80 bg-white/95 text-left shadow-[0_12px_28px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(109,40,217,0.10)] focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                          <div className="relative min-h-[240px] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-5 pt-5 pb-24 md:min-h-[260px] md:px-6 md:pt-6 md:pb-28">
                            <Image
                              src="/images/partners/malucare-logo.png"
                              alt=""
                              width={720}
                              height={320}
                              className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                              sizes="(max-width: 768px) 100vw, 420px"
                              aria-hidden="true"
                            />
                            <div className="pointer-events-none absolute inset-x-4 bottom-4 md:inset-x-5 md:bottom-5">
                              <div className="flex items-end justify-between gap-4 rounded-[20px] border border-white/70 bg-white/88 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.10)] backdrop-blur-md">
                                <div className="space-y-1">
                                  <div className="text-[20px] font-semibold tracking-tight text-slate-900 transition-colors group-hover:text-violet-900">
                                    MaluCare
                                  </div>
                                  <div className="max-w-sm text-[13px] leading-5 text-slate-500">
                                    Registered NDIS &amp; community support organisation
                                  </div>
                                </div>
                                <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors group-hover:text-violet-700">
                                  Visit
                                  <svg
                                    aria-hidden="true"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="shrink-0 transition-all duration-200 group-hover:translate-x-0.5"
                                  >
                                    <path d="M7 17L17 7" />
                                    <path d="M8 7h9v9" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        </a>
                      </div>
                    </div>
                  </section>
                )}

                {/* Service tiles — only show services available for the selected context. */}
                {(() => {
                  const isCommercialContext = S.context === 'commercial';
                  // Commercial only has 3 allowed services, so the default 2x3
                  // grid leaves cards feeling stretched and short. Use the same
                  // feature-sized tiles as NDIS for visual balance, with a
                  // 3-up row on sm+ and a single column on narrow viewports.
                  const gridClass = isNdisContext
                    ? 'grid-cols-1 xl:grid-cols-2'
                    : isCommercialContext
                      ? 'grid-cols-1 sm:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-3';
                  const tileVariant = isNdisContext || isCommercialContext ? 'feature' : 'default';
                  return (
                    <div className={cls('grid gap-3.5', gridClass)}>
                      {SERVICES
                        .filter((s) => ALLOWED_SERVICES_BY_CONTEXT[S.context].includes(s.key))
                        .map((s) => {
                          const isActive = S.service === s.key;
                          // Step 1 lead text is intentionally non-numeric across all
                          // contexts (Home / Commercial / NDIS) so we never anchor on
                          // a "from $X" that doesn't reflect the final scoped quote.
                          // Real pricing is computed in Step 2+ once scope is known.
                          const leadText = 'Tailored quote';
                          return (
                            <Tile
                              key={s.key}
                              active={isActive}
                              onClick={() => selectService(s.key)}
                              title={s.label}
                              subtitle={s.subtitle}
                              icon={s.icon}
                              popular={'popular' in s ? (s as { popular?: boolean }).popular : undefined}
                              from={leadText}
                              variant={tileVariant}
                            />
                          );
                        })}
                    </div>
                  );
                })()}

              </section>
            </>
          )}

                </div>
      {/* ===== STEP 2 ===== */}
      {S.step === 2 && <Step2ErrorBoundary>{(() => {
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

        function cleaningScopesForContext(ctx: Context): ScopeDef[] {
          const std = CLEAN_SCOPES.find((s) => s.key === 'clean_std')!;
          const deep = CLEAN_SCOPES.find((s) => s.key === 'clean_deep')!;
          const move = CLEAN_SCOPES.find((s) => s.key === 'clean_move')!;

          if (ctx === 'commercial') {
            // Return specific commercial niche cards using COMM_LABELS
            const niches: CommercialCleaningType[] = ['office', 'medical', 'fitness', 'hospitality', 'education', 'event', 'accommodation'];
            return niches.map((niche) => {
              const meta = COMM_LABELS[niche];
              return {
                key: niche,
                label: meta.title,
                inclusions: COMM_FEATURES[niche] || [],
                desc: meta.covers,
              };
            });
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


        // ---------- actual section render (no hooks below) ----------
        // NDIS cleaning + yard get a dedicated hourly-estimator panel that
        // short-circuits the regular scope picker. Hours are suggested from
        // house/yard size + condition, and priced at the NDIS Price Guide cap
        // ($57.10/hr). Users can still fine-tune hours manually.
        //
        // Visual layout: a hero band with the live price chip, then three
        // grouped section cards (About → Schedule → Estimate) with one
        // shared active-state vocabulary. Avoid restacking loose grids — they
        // read as a wall of pills with no rhythm.
        const ndisStep2Panel =
          isNdisContext && (S.service === 'cleaning' || S.service === 'yard') ? (() => {
            const suggested = S.service === 'cleaning'
              ? suggestNdisCleaningHours({
                  bedrooms: S.ndisPropertyBedrooms,
                  bathrooms: S.ndisPropertyBathrooms,
                  living: S.ndisPropertyLiving,
                  kitchens: S.ndisPropertyKitchens,
                  laundry: S.ndisPropertyLaundry,
                  storeys: S.ndisPropertyStoreys,
                  condition: S.ndisCondition,
                })
              : suggestNdisYardHours(S.ndisYardSize, S.ndisCondition);
            // When the user hasn't manually overridden, the displayed hours
            // *must* track the current inputs — previously it was frozen at
            // whatever ndisEstimatedHours happened to be, so changing rooms
            // didn't move the price. Only respect ndisEstimatedHours in
            // 'manual' mode.
            const hours =
              S.ndisHoursOrigin === 'manual' && S.ndisEstimatedHours
                ? S.ndisEstimatedHours
                : suggested;
            // Resolve the actual Price Guide rate from the chosen slot +
            // region. Defaults are weekday-day metro ($57.10) so existing
            // quotes look identical until the user picks a different band.
            const effectiveRate = ndisRateFor(S.ndisRateSlot, S.ndisRegion);
            const subtotal = Math.round(hours * effectiveRate);
            const STEP = 0.25; // quarter-hour increments — matches NDIS claim units
            const bumpHours = (next: number) => {
              const stepped = Math.round(next / STEP) * STEP;
              const clamped = Math.max(NDIS_MIN_HOURS, Math.min(NDIS_MAX_HOURS, stepped));
              setMany({ ndisEstimatedHours: clamped, ndisHoursOrigin: 'manual' });
            };
            const applySuggested = () => {
              // Switch back to suggested mode. Don't overwrite ndisEstimatedHours
              // here — the renderer will pick up `suggested` automatically while
              // origin === 'suggested'.
              setMany({ ndisEstimatedHours: 0, ndisHoursOrigin: 'suggested' });
            };
            // Pretty-print hours that may now be fractional (e.g. 5.25 hr).
            const fmtHours = (h: number) =>
              Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/\.?0+$/, '');

            // Shared selectable-tile vocabulary. Every chip-style control on
            // this panel — Yard size, When, Condition, Region — uses these so
            // the panel reads as one design system rather than five. The
            // active state earns its weight: a violet ring plus a small
            // checkmark in the corner so users get unmistakable feedback.
            const tileCls = (active: boolean) => cls(
              'group relative overflow-hidden rounded-xl border px-3.5 py-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1',
              active
                ? 'border-violet-500 bg-gradient-to-br from-violet-50 to-white ring-1 ring-violet-300/60 shadow-[0_4px_12px_-2px_rgba(124,58,237,0.18)]'
                : 'border-slate-200 bg-white hover:-translate-y-px hover:border-violet-300 hover:bg-violet-50/40 hover:shadow-sm'
            );
            const tileTitle = (active: boolean) => cls(
              'text-sm font-semibold leading-tight',
              active ? 'text-violet-900' : 'text-slate-900'
            );
            const tileBlurb = (active: boolean) => cls(
              'mt-0.5 text-[11px] leading-snug',
              active ? 'text-violet-700/80' : 'text-slate-500'
            );
            const TileCheck = ({ active }: { active: boolean }) => (
              <span
                aria-hidden
                className={cls(
                  'pointer-events-none absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full transition-all',
                  active
                    ? 'bg-violet-600 text-white opacity-100 scale-100'
                    : 'bg-slate-100 text-slate-300 opacity-0 scale-90'
                )}
              >
                <svg viewBox="0 0 12 12" width={9} height={9} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                </svg>
              </span>
            );

            // Stepper — promoted from a thin row to a small card, so each
            // room type has its own dedicated tile with a generous tap-target.
            const Stepper = ({ label, value, onChange, min, max, icon }: {
              label: string; value: number; onChange: (n: number) => void; min: number; max: number; icon?: React.ReactNode;
            }) => {
              const has = value > 0;
              return (
                <div className={cls(
                  'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors',
                  has
                    ? 'border-violet-200 bg-violet-50/50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                )}>
                  <span className={cls('flex items-center gap-2 text-sm font-medium', has ? 'text-violet-900' : 'text-slate-700')}>
                    {icon && <span className={has ? 'text-violet-500' : 'text-slate-400'}>{icon}</span>}
                    {label}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className={cls(
                        'h-8 w-8 rounded-lg border text-base font-medium transition-all active:scale-95 disabled:opacity-30 disabled:active:scale-100',
                        has
                          ? 'border-violet-300 bg-white text-violet-700 hover:border-violet-500 hover:bg-violet-50'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50'
                      )}
                      onClick={() => onChange(Math.max(min, value - 1))}
                      disabled={value <= min}
                      aria-label={`Decrease ${label.toLowerCase()}`}
                    >
                      −
                    </button>
                    <span className={cls(
                      'min-w-[1.75rem] text-center text-base font-semibold tabular-nums',
                      has ? 'text-violet-900' : 'text-slate-900'
                    )}>{value}</span>
                    <button
                      type="button"
                      className={cls(
                        'h-8 w-8 rounded-lg border text-base font-medium transition-all active:scale-95 disabled:opacity-30 disabled:active:scale-100',
                        has
                          ? 'border-violet-300 bg-white text-violet-700 hover:border-violet-500 hover:bg-violet-50'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50'
                      )}
                      onClick={() => onChange(Math.min(max, value + 1))}
                      disabled={value >= max}
                      aria-label={`Increase ${label.toLowerCase()}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            };

            // Section-card wrapper. Three of these stack with consistent
            // breathing room and a subtle violet accent on the icon, plus a
            // numbered badge so the user always knows where they are in the
            // panel — no more "wall of generic cards" feel.
            const SectionCard = ({
              step,
              icon,
              title,
              subtitle,
              children,
              aside,
            }: {
              step?: number;
              icon: React.ReactNode;
              title: string;
              subtitle?: string;
              children: React.ReactNode;
              aside?: React.ReactNode;
            }) => (
              <section className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_4px_16px_-4px_rgba(15,23,42,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 text-violet-700 ring-1 ring-violet-200/60">
                      {icon}
                      {typeof step === 'number' && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[9px] font-bold text-white ring-2 ring-white">
                          {step}
                        </span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h4>
                      {subtitle && (
                        <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>
                      )}
                    </div>
                  </div>
                  {aside}
                </div>
                <div className="mt-5 space-y-5">{children}</div>
              </section>
            );

            // Tiny inline SVGs — keeps us off lucide-react (the codebase
            // already uses hand-rolled icons in ./utils/icons.tsx).
            const sIconProps = {
              viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none',
              stroke: 'currentColor', strokeWidth: 1.75,
              strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
            };
            const sIcon = {
              property: (
                <svg {...sIconProps}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
              ),
              yard: (
                <svg {...sIconProps}><path d="M3 20h18" /><path d="M6 20v-5m3 5v-3m3 3v-6m3 6v-4m3 4v-5" /></svg>
              ),
              calendar: (
                <svg {...sIconProps}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>
              ),
              calculator: (
                <svg {...sIconProps}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M9 11h.01M13 11h.01M17 11h.01M9 15h.01M13 15h.01M17 15h.01M9 19h.01M13 19h.01M17 19h.01" /></svg>
              ),
            };

            // Shared props for tile icons — slightly larger than section-card icons.
            const tileIconProps = {
              viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none',
              stroke: 'currentColor', strokeWidth: 1.75,
              strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
            };
            // Condition icons keyed by service then condition.
            const condIcon: Record<string, Record<string, React.ReactNode>> = {
              cleaning: {
                tidy: <svg {...tileIconProps}><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>,
                lived_in: <svg {...tileIconProps}><path d="M3 11l9-7 9 7v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" /></svg>,
                reset: <svg {...tileIconProps}><path d="M3 12a9 9 0 0115-6.7L21 8M21 4v4h-4M21 12a9 9 0 01-15 6.7L3 16M3 20v-4h4" /></svg>,
              },
              yard: {
                tidy: <svg {...tileIconProps}><path d="M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg>,
                lived_in: <svg {...tileIconProps}><path d="M12 22V12M12 12C12 7 8 3 3 3c0 5 3.5 9 9 9zM12 12c0-5 4-9 9-9 0 5-3.5 9-9 9" /></svg>,
                reset: <svg {...tileIconProps}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>,
              },
            };
            // Schedule icons keyed by rate slot.
            const schedIcon: Record<string, React.ReactNode> = {
              weekday_day: <svg {...tileIconProps}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>,
              saturday: <svg {...tileIconProps}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4M12 13v4M10 15h4" /></svg>,
              sunday: <svg {...tileIconProps}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>,
              public_holiday: <svg {...tileIconProps}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
            };
            // Yard size icons — dot-grid to visually show relative area.
            const yardSizeIcon: Record<string, React.ReactNode> = {
              small: (
                <svg viewBox="0 0 20 20" width={18} height={18} aria-hidden>
                  <circle cx="6" cy="6" r="2.5" fill="currentColor" />
                  <circle cx="14" cy="6" r="2.5" fill="currentColor" />
                  <circle cx="6" cy="14" r="2.5" fill="currentColor" />
                  <circle cx="14" cy="14" r="2.5" fill="currentColor" />
                </svg>
              ),
              medium: (
                <svg viewBox="0 0 20 20" width={18} height={18} aria-hidden>
                  {[4, 10, 16].flatMap(y => [4, 10, 16].map(x => (
                    <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" fill="currentColor" />
                  )))}
                </svg>
              ),
              large: (
                <svg viewBox="0 0 20 20" width={18} height={18} aria-hidden>
                  {[3, 8, 13, 18].flatMap(y => [3, 8, 13, 18].map(x => (
                    <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="currentColor" />
                  )))}
                </svg>
              ),
              xlarge: (
                <svg viewBox="0 0 22 22" width={18} height={18} aria-hidden>
                  {[2, 6, 10, 14, 18].flatMap(y => [2, 6, 10, 14, 18].map(x => (
                    <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />
                  )))}
                </svg>
              ),
            };
            // Room icons for steppers — 13px render size.
            const rIconProps = {
              viewBox: '0 0 24 24', width: 13, height: 13, fill: 'none',
              stroke: 'currentColor', strokeWidth: 1.75,
              strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
            };
            const roomIcon = {
              bed: <svg {...rIconProps}><path d="M2 20V10a2 2 0 012-2h16a2 2 0 012 2v10M2 14h20M7 8V6.5a.5.5 0 01.5-.5h9a.5.5 0 01.5.5V8" /></svg>,
              bath: <svg {...rIconProps}><path d="M9 6l2 2M3 11h18v2a6 6 0 01-6 6H9a6 6 0 01-6-6v-2z" /><path d="M3 11V7a2 2 0 114 0" /></svg>,
              sofa: <svg {...rIconProps}><rect x="2" y="9" width="20" height="11" rx="2" /><path d="M2 14h20M7 9V6M17 9V6" /></svg>,
              kitchen: <svg {...rIconProps}><path d="M6 3v9M4 9c0 1.1.9 2 2 2s2-.9 2-2M17 3v6M14 3c0 6 3 8 3 9v9" /></svg>,
              laundry: <svg {...rIconProps}><rect x="2" y="2" width="20" height="20" rx="3" /><circle cx="12" cy="13" r="4" /><circle cx="8" cy="6" r="1" /></svg>,
              stairs: <svg {...rIconProps}><path d="M3 20V14h4v-4h5V7h5V3M3 20h18" /></svg>,
            };

            const isOverridden = S.ndisHoursOrigin === 'manual' && hours !== suggested;
            const showRegionPicker = showManualNdisRegion || S.ndisRegionSource === 'manual';

            return (
              <section aria-labelledby="ndis-step2-heading" className="space-y-5">
                {/* Hero — title left, live price right. Distinctive violet
                    gradient with a soft dot pattern overlay so the panel
                    announces itself instead of fading into the page. The
                    price tile uses inverted contrast (deep violet bg, white
                    figures) so it reads as the unmistakable answer. */}
                <div className="relative overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-white p-5 sm:p-6 shadow-[0_4px_24px_-8px_rgba(124,58,237,0.18)]">
                  {/* Decorative dot pattern */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-[0.18]"
                    style={{
                      backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(124 58 237) 1px, transparent 0)',
                      backgroundSize: '20px 20px',
                      maskImage: 'radial-gradient(ellipse at top right, rgba(0,0,0,0.55), transparent 60%)',
                      WebkitMaskImage: 'radial-gradient(ellipse at top right, rgba(0,0,0,0.55), transparent 60%)',
                    }}
                  />
                  {/* Decorative blur orb */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-violet-300/40 to-fuchsia-200/20 blur-3xl"
                  />

                  <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white/80 px-2.5 py-1 backdrop-blur-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-700">
                          NDIS · Household tasks
                        </span>
                      </div>
                      <h3 id="ndis-step2-heading" className="mt-3 text-2xl md:text-[28px] font-semibold leading-tight tracking-tight text-slate-900">
                        {S.service === 'cleaning' ? 'Estimate your cleaning hours' : 'Estimate your yard hours'}
                      </h3>
                      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600">
                        Tell us about the {S.service === 'cleaning' ? 'home' : 'yard'} and we&apos;ll suggest the hours.
                        Adjust anytime — we only bill for time on-site.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80">
                          <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                          Price-Guide capped
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200/80">
                          <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                          Quarter-hour billing
                        </span>
                      </div>
                    </div>

                    <div className="relative shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-700 to-violet-800 px-5 py-4 text-white shadow-[0_8px_24px_-8px_rgba(124,58,237,0.55)] sm:min-w-[220px]">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10 blur-2xl"
                      />
                      <div className="relative">
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-200">Live estimate</span>
                        </div>
                        <div className="mt-1.5 text-[34px] leading-none font-semibold tracking-tight tabular-nums">
                          {fmtAUD(subtotal)}
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] tabular-nums text-violet-100">
                          <span className="rounded-md bg-white/15 px-1.5 py-0.5 font-semibold">{fmtHours(hours)} hr</span>
                          <span className="text-violet-300">×</span>
                          <span className="rounded-md bg-white/15 px-1.5 py-0.5 font-semibold">${effectiveRate.toFixed(2)}/hr</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 1 — About the property/yard.
                    Note: input changes do NOT touch ndisHoursOrigin. The
                    manual override sticks until the user clicks "Use
                    suggested" in the estimate card below. */}
                <SectionCard
                  step={1}
                  icon={S.service === 'cleaning' ? sIcon.property : sIcon.yard}
                  title={S.service === 'cleaning' ? 'About the home' : 'About the yard'}
                  subtitle={S.service === 'cleaning' ? 'Helps us right-size the visit' : 'How big is the space?'}
                >
                  {S.service === 'cleaning' && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Service address</p>
                      <div className="mt-2">
                        <ServiceAddressInput
                          address={S.address}
                          onAddressChange={(formatted, suburb, coords) => {
                            handleServiceAddressSelected(formatted, suburb, coords);
                          }}
                          onClear={() => {
                            setMany({ address: '', region: '' });
                            setMmmDetection({ status: 'idle' });
                            lastMmmLookupRef.current = '';
                          }}
                        />
                        {renderMmmStatus()}
                      </div>
                    </div>
                  )}

                  {S.service === 'cleaning' ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Rooms</p>
                        <span className="text-[10px] text-slate-400">Tap ± to adjust</span>
                      </div>
                      <div className="mt-2.5 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                        <Stepper label="Bedrooms" value={S.ndisPropertyBedrooms} min={0} max={8} onChange={(n) => setMany({ ndisPropertyBedrooms: n })} icon={roomIcon.bed} />
                        <Stepper label="Bathrooms" value={S.ndisPropertyBathrooms} min={0} max={6} onChange={(n) => setMany({ ndisPropertyBathrooms: n })} icon={roomIcon.bath} />
                        <Stepper label="Living rooms" value={S.ndisPropertyLiving} min={0} max={5} onChange={(n) => setMany({ ndisPropertyLiving: n })} icon={roomIcon.sofa} />
                        <Stepper label="Kitchens" value={S.ndisPropertyKitchens} min={0} max={3} onChange={(n) => setMany({ ndisPropertyKitchens: n })} icon={roomIcon.kitchen} />
                        <Stepper label="Laundry" value={S.ndisPropertyLaundry} min={0} max={2} onChange={(n) => setMany({ ndisPropertyLaundry: n })} icon={roomIcon.laundry} />
                        <Stepper label="Storeys" value={S.ndisPropertyStoreys} min={1} max={3} onChange={(n) => setMany({ ndisPropertyStoreys: n })} icon={roomIcon.stairs} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Yard size</p>
                      <div className="mt-2.5 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                        {([
                          { k: 'small', label: 'Small', blurb: 'Courtyard / unit' },
                          { k: 'medium', label: 'Medium', blurb: 'Typical suburban' },
                          { k: 'large', label: 'Large', blurb: '700–1500 m²' },
                          { k: 'xlarge', label: 'X-Large', blurb: 'Acreage / dual' },
                        ] as const).map(({ k, label, blurb }) => {
                          const active = S.ndisYardSize === k;
                          return (
                            <button key={k} type="button" className={tileCls(active)} onClick={() => setMany({ ndisYardSize: k })} aria-pressed={active}>
                              <TileCheck active={active} />
                              <span className={cls('mb-2 flex items-center', active ? 'text-violet-500' : 'text-slate-300')}>
                                {yardSizeIcon[k]}
                              </span>
                              <div className={tileTitle(active)}>{label}</div>
                              <div className={tileBlurb(active)}>{blurb}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                      {S.service === 'yard' ? 'Growth level' : 'Property condition'}
                    </p>
                    <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                      {(S.service === 'yard'
                        ? ([
                            { k: 'tidy',     label: 'Maintained',     blurb: 'Recently mowed — quick trim & tidy' },
                            { k: 'lived_in', label: 'Standard growth', blurb: 'Routine fortnightly mow & edge' },
                            { k: 'reset',    label: 'Overgrown',      blurb: 'Heavy growth — full clearance & green-waste' },
                          ] as const)
                        : ([
                            { k: 'tidy',     label: 'Tidy',     blurb: 'Maintained — light touch' },
                            { k: 'lived_in', label: 'Lived-in', blurb: 'Typical ongoing support' },
                            { k: 'reset',    label: 'Reset',    blurb: 'Needs a deeper pass' },
                          ] as const)
                      ).map(({ k, label, blurb }) => {
                        const active = S.ndisCondition === k;
                        const serviceKey = S.service === 'yard' ? 'yard' : 'cleaning';
                        return (
                          <button key={k} type="button" className={tileCls(active)} onClick={() => setMany({ ndisCondition: k })} aria-pressed={active}>
                            <TileCheck active={active} />
                            <span className={cls('mb-2 flex h-8 w-8 items-center justify-center rounded-lg transition-colors', active ? 'bg-violet-100 text-violet-600' : 'bg-slate-50 text-slate-400')}>
                              {condIcon[serviceKey][k]}
                            </span>
                            <div className={tileTitle(active)}>{label}</div>
                            <div className={tileBlurb(active)}>{blurb}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </SectionCard>

                {/* Card 2 — Schedule & rate. Day-of-week + region together so
                    the user sees both inputs that drive the $/hr cap in one
                    place, with the resolved rate shown as a chip. */}
                <SectionCard
                  step={2}
                  icon={sIcon.calendar}
                  title="Schedule & rate"
                  subtitle="Day of week sets the Price Guide cap"
                  aside={(
                    <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-violet-700">
                      <span className="h-1 w-1 rounded-full bg-violet-500" />
                      ${effectiveRate.toFixed(2)}/hr
                    </span>
                  )}
                >
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">When?</p>
                    <div className="mt-2.5 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                      {([
                        { k: 'weekday_day',    label: 'Weekday day',    blurb: 'Mon–Fri 7am–5pm' },
                        { k: 'saturday',       label: 'Saturday',       blurb: 'Sat 7am–5pm' },
                        { k: 'sunday',         label: 'Sunday',         blurb: 'Sun 7am–5pm' },
                        { k: 'public_holiday', label: 'Public holiday', blurb: 'QLD calendar' },
                      ] as const).map(({ k, label, blurb }) => {
                        const active = S.ndisRateSlot === k;
                        return (
                          <button key={k} type="button" className={tileCls(active)} onClick={() => setMany({ ndisRateSlot: k })} aria-pressed={active}>
                            <TileCheck active={active} />
                            <span className={cls('mb-2 flex h-8 w-8 items-center justify-center rounded-lg transition-colors', active ? 'bg-violet-100 text-violet-600' : 'bg-slate-50 text-slate-400')}>
                              {schedIcon[k]}
                            </span>
                            <div className={tileTitle(active)}>{label}</div>
                            <div className={tileBlurb(active)}>{blurb}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Region</p>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-violet-200 hover:bg-white hover:text-violet-700"
                        onClick={() => setShowManualNdisRegion((v) => !v)}
                        aria-expanded={showRegionPicker}
                      >
                        <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          {showRegionPicker ? <path d="M5 15l7-7 7 7" /> : <path d="M12 5v14M5 12h14" />}
                        </svg>
                        {showRegionPicker ? 'Hide' : 'Change region'}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px]">
                        <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                        <span className="font-semibold text-slate-800">{NDIS_REGION_LABELS[S.ndisRegion]}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px]">
                        <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                        <span className="text-slate-700">{NDIS_RATE_LABELS[S.ndisRateSlot]}</span>
                      </span>
                    </div>
                    {showRegionPicker && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                        {([
                          { k: 'metro',       label: 'Metro',       blurb: 'MMM 1' },
                          { k: 'regional',    label: 'Regional',    blurb: 'MMM 2-5' },
                          { k: 'remote',      label: 'Remote',      blurb: 'MMM 6 · +40%' },
                          { k: 'very_remote', label: 'Very remote', blurb: 'MMM 7 · +50%' },
                        ] as const).map(({ k, label, blurb }) => {
                          const active = S.ndisRegion === k;
                          return (
                            <button key={k} type="button" className={tileCls(active)} onClick={() => setMany({ ndisRegion: k, ndisRegionSource: 'manual' })} aria-pressed={active}>
                              <TileCheck active={active} />
                              <div className={tileTitle(active)}>{label}</div>
                              <div className={tileBlurb(active)}>{blurb}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* Card 3 — Hours estimate. The visual climax of the panel:
                    deep violet gradient, oversized hour readout, and a
                    custom slider track that shows the suggested-hours
                    waypoint so users see how their override compares. */}
                <SectionCard
                  step={3}
                  icon={sIcon.calculator}
                  title="Hours estimate"
                  subtitle={isOverridden ? 'Manual override active' : 'Suggested from your inputs above'}
                  aside={isOverridden ? (
                    <button
                      type="button"
                      onClick={applySuggested}
                      className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700 transition-colors hover:bg-violet-100"
                    >
                      <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0115-6.7L21 8M21 4v4h-4M21 12a9 9 0 01-15 6.7L3 16M3 20v-4h4" /></svg>
                      Use suggested ({fmtHours(suggested)} hr)
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200/70">
                      <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                      Auto
                    </span>
                  )}
                >
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-800 p-5 text-white shadow-[0_12px_32px_-12px_rgba(124,58,237,0.6)]">
                    {/* Decorative shimmer */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-fuchsia-400/15 blur-3xl"
                    />

                    <div className="relative">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-200">You&apos;ll book</div>
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="text-[56px] leading-none font-semibold tracking-tight tabular-nums">{fmtHours(hours)}</span>
                            <span className="text-base font-medium text-violet-200">hr</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-violet-200">Total</div>
                          <div className="mt-1 text-3xl leading-none font-semibold tracking-tight tabular-nums">{fmtAUD(subtotal)}</div>
                          <div className="mt-1 text-[11px] tabular-nums text-violet-200">@ ${effectiveRate.toFixed(2)}/hr</div>
                        </div>
                      </div>

                      {/* Custom slider with suggested-hours marker */}
                      <div className="mt-5">
                        {(() => {
                          const range = NDIS_MAX_HOURS - NDIS_MIN_HOURS;
                          const suggestedPct = Math.max(0, Math.min(100, ((suggested - NDIS_MIN_HOURS) / range) * 100));
                          const valuePct = Math.max(0, Math.min(100, ((hours - NDIS_MIN_HOURS) / range) * 100));
                          return (
                            <div className="relative">
                              {/* Track background */}
                              <div className="h-2 rounded-full bg-violet-900/60 ring-1 ring-inset ring-white/5" />
                              {/* Filled portion */}
                              <div
                                aria-hidden
                                className="absolute left-0 top-0 h-2 rounded-full bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200"
                                style={{ width: `${valuePct}%` }}
                              />
                              {/* Suggested marker */}
                              <div
                                aria-hidden
                                className="absolute -top-1 h-4 w-0.5 rounded-full bg-emerald-300/90 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]"
                                style={{ left: `calc(${suggestedPct}% - 1px)` }}
                                title={`Suggested ${fmtHours(suggested)} hr`}
                              />
                              {/* Native slider on top — invisible track, visible thumb via accent + custom styling */}
                              <input
                                type="range"
                                min={NDIS_MIN_HOURS}
                                max={NDIS_MAX_HOURS}
                                step={STEP}
                                value={hours}
                                onChange={(e) => bumpHours(Number(e.target.value))}
                                className="ndis-hours-slider absolute inset-0 -top-2 h-6 w-full cursor-pointer appearance-none bg-transparent"
                                aria-label="Estimated hours"
                              />
                              <style jsx>{`
                                :global(.ndis-hours-slider)::-webkit-slider-thumb {
                                  -webkit-appearance: none;
                                  appearance: none;
                                  height: 22px;
                                  width: 22px;
                                  border-radius: 9999px;
                                  background: white;
                                  border: 3px solid rgb(124 58 237);
                                  box-shadow: 0 4px 12px -2px rgba(0,0,0,0.3), 0 0 0 4px rgba(255,255,255,0.15);
                                  cursor: grab;
                                  transition: transform 0.1s ease;
                                }
                                :global(.ndis-hours-slider)::-webkit-slider-thumb:active {
                                  cursor: grabbing;
                                  transform: scale(1.1);
                                }
                                :global(.ndis-hours-slider)::-moz-range-thumb {
                                  height: 22px;
                                  width: 22px;
                                  border-radius: 9999px;
                                  background: white;
                                  border: 3px solid rgb(124 58 237);
                                  box-shadow: 0 4px 12px -2px rgba(0,0,0,0.3), 0 0 0 4px rgba(255,255,255,0.15);
                                  cursor: grab;
                                }
                              `}</style>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] tabular-nums">
                        <span className="text-violet-200/80">{NDIS_MIN_HOURS} hr min</span>
                        <span className="inline-flex items-center gap-1 text-emerald-200/90">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                          Suggested {fmtHours(suggested)} hr
                        </span>
                        <span className="text-violet-200/80">{NDIS_MAX_HOURS} hr cap</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5">
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-slate-500"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
                    <p className="text-xs leading-relaxed text-slate-600">
                      <span className="font-medium text-slate-700">Estimate only.</span>{' '}
                      Adjust anytime before the visit — we log time on-site so your plan is only
                      charged for actual delivered hours.
                    </p>
                  </div>
                </SectionCard>
              </section>
            );
          })() : null;

        const step2Body = ndisStep2Panel ? (
                  <>{ndisStep2Panel}</>
                ) : (
                  <>
                    {/* Section heading */}
                    {S.service === 'yard' ? (
                      <div>
                        <p className="text-emerald-700 text-sm font-semibold">Yard care</p>
                        <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
                          Map your lawns and sites
                        </h3>
                        <p className="mt-1 text-sm text-slate-600 max-w-2xl">
                          Choose what we&apos;re doing, then outline each address on the satellite map. We auto-calc the area,
                          time, and cost for every site across Greater Brisbane.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
                          Our Abilities
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Tell us what matters and we&apos;ll shape it to you.
                        </p>
                      </div>
                    )}

                    {/* Estimate summary for small screens */}
                    {/* Scope cards (primary + more options) */}
                    <div className="mt-4 space-y-6">
                      <div className={cls('grid gap-4 md:gap-5', mapVisible ? 'grid-cols-1' : 'md:grid-cols-2')}>
                        {(() => {
                          const scopes =
                            S.service === 'cleaning'
                              ? cleaningScopesForContext(S.context)
                              : SCOPES_BY_SERVICE[S.service] || [];


                          const commercialNiches: CommercialCleaningType[] = ['office', 'medical', 'fitness', 'hospitality', 'education', 'event', 'accommodation'];
                          const onSelect = (key: string) => {
                            const prevScope = S.scope;
                            trackQuoteEvent('scope_selected', { service: S.service, scope: key, context: S.context });
                            if (prevScope && prevScope !== key) {
                              trackQuoteEvent('scope_changed', { service: S.service, from: prevScope, to: key });
                            }
                            // If commercial cleaning and key is a niche, set the commercial type
                            if (S.context === 'commercial' && S.service === 'cleaning' && commercialNiches.includes(key as CommercialCleaningType)) {
                              setCommercialType(key as CommercialCleaningType);
                              set('scope', 'general'); // Use general scope for all niches
                            } else {
                              set('scope', key);
                              applyScopePreset(S.service, key);
                            }
                            setHasInteractedStep2(true);
                          };
                          const onAdd = (key: string) => {
                            // If commercial cleaning and key is a niche, set the commercial type
                            if (S.context === 'commercial' && S.service === 'cleaning' && commercialNiches.includes(key as CommercialCleaningType)) {
                              setCommercialType(key as CommercialCleaningType);
                              set('scope', 'general'); // Use general scope for all niches
                            } else {
                              set('scope', key);
                              applyScopePreset(S.service, key);
                            }
                            setHasInteractedStep2(true);
                            set('step', 3);
                          };

                          const renderCard = (sc: any, idx: number, total: number, spanLastOdd = false) => {
                            // For commercial cleaning, check commercialCleaningType instead of scope
                            const isActive = S.context === 'commercial' && S.service === 'cleaning' && commercialNiches.includes(sc.key as CommercialCleaningType)
                              ? (S.commercialCleaningType ?? '') === sc.key
                              : S.scope === sc.key;
                            const hook =
                              (sc.desc && String(sc.desc)) ||
                              (Array.isArray(sc.inclusions) &&
                              sc.inclusions.length
                                ? `${sc.inclusions
                                    .slice(0, 3)
                                    .join(', ')}…`
                                : 'A simple, reliable preset tailored to your place.');
                            const isBlurred = !mapVisible && !!activeServiceId && activeServiceId !== sc.key;
                            const className = cls(
                              spanLastOdd ? 'md:col-span-2' : '',
                              'transition-all duration-200',
                              isBlurred ? 'blur-[2px] opacity-50 pointer-events-none' : ''
                            );
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
                                set={set}
                                setMany={setMany}
                                setHasInteractedStep2={setHasInteractedStep2}
                                openChecklists={openChecklists}
                                setOpenChecklists={setOpenChecklists}
                                notifyDelta={notifyDelta}
                                conditionMult={conditionMult}
                                carSelector={carSelector}
                                laundryIroningOpen={laundryIroningOpen}
                                setLaundryIroningOpen={setLaundryIroningOpen}
                                routeExpanded={routeExpanded}
                                setRouteExpanded={setRouteExpanded}
                                transportRouteExpanded={transportRouteExpanded}
                                setTransportRouteExpanded={setTransportRouteExpanded}
                                routeLookup={routeLookup}
                                routeLookupLoading={routeLookupLoading}
                                routeLookupMessage={routeLookupMessage}
                                routeDistanceLabel={routeDistanceLabel}
                                handleDistanceInputFocusChange={handleDistanceInputFocusChange}
                                handleDistancePlaceSelected={handleDistancePlaceSelected}
                                laundryAddOnTotal={laundryAddOnTotal}
                                priceLabelBase={priceLabelBase}
                                isSneakerTurnaroundAvailable={isSneakerTurnaroundAvailable}
                              />
                            );
                          };

                          const nonHelperScopes = scopes.filter((s) => !s.helper);
                          return (
                            <>
                              {scopes.map((sc, idx) => {
                                const nonHelperIndex = sc.helper ? -1 : nonHelperScopes.indexOf(sc);
                                // Disable spanning for yard service when map is visible to keep cards equal width
                                const shouldSpan =
                                  !mapVisible &&
                                  !sc.helper &&
                                  nonHelperScopes.length % 2 === 1 &&
                                  nonHelperIndex === nonHelperScopes.length - 1;
                                return renderCard(sc, idx, scopes.length, shouldSpan);
                              })}
                            </>
                          );
                        })()}
                      </div>

                      {S.service === 'cleaning' && S.context !== 'commercial' && S.step === 2 && S.scope === 'hourly' && (
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
                              onChange={({ items, layout }) => {
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
                  'flex flex-col gap-6',
                  mapVisible ? 'xl:grid xl:grid-cols-2 xl:gap-8' : ''
                )}
              >
                <div className={cls('space-y-6', mapVisible ? 'xl:order-1' : '')}>{step2Body}</div>

                {mapVisible && (
                  <div className="flex flex-col gap-4 xl:order-2 xl:self-start xl:sticky xl:top-4">
                    {isNdisContext ? (
                      <div className="rounded-2xl border border-violet-100 bg-white/90 p-3 text-xs text-slate-600 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-800">Service address</span>
                          <span className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                            {NDIS_REGION_LABELS[S.ndisRegion]}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                          {S.address || 'Search the map address to detect MMM before reviewing the quote.'}
                        </p>
                        {renderMmmStatus()}
                      </div>
                    ) : (
                      <div className="grid grid-cols-5 gap-1 p-1.5 rounded-xl border border-black/5 bg-white/90 backdrop-blur-sm shadow-sm">
                        {[
                          { key: 'yard_mow', label: 'Mow', icon: (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="14" width="18" height="6" rx="1" strokeLinejoin="round"/>
                              <circle cx="6" cy="20" r="2"/>
                              <circle cx="18" cy="20" r="2"/>
                              <path d="M7 14V10a2 2 0 0 1 2-2h2" strokeLinecap="round"/>
                              <path d="M11 8l3-4" strokeLinecap="round"/>
                            </svg>
                          )},
                          { key: 'yard_hedge', label: 'Hedge', icon: (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <ellipse cx="6" cy="10" rx="4" ry="5"/>
                              <ellipse cx="12" cy="8" rx="4" ry="5"/>
                              <ellipse cx="18" cy="10" rx="4" ry="5"/>
                              <path d="M6 15v5M12 13v7M18 15v5" strokeLinecap="round"/>
                            </svg>
                          )},
                          { key: 'yard_leaves', label: 'Garden', icon: (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M12 22V12"/>
                              <path d="M12 12C12 12 6 10 6 5c0-2 2-3 6-3s6 1 6 3c0 5-6 7-6 7z"/>
                              <path d="M8 22c0-2 1.5-4 4-4s4 2 4 4" strokeLinecap="round"/>
                            </svg>
                          )},
                          { key: 'blast_and_shine', label: 'Wash', icon: (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M12 3v3M12 9v3M12 15v3M12 21v0" strokeLinecap="round"/>
                              <path d="M7 5l1 2M7 11l1 2M7 17l1 2" strokeLinecap="round"/>
                              <path d="M17 5l-1 2M17 11l-1 2M17 17l-1 2" strokeLinecap="round"/>
                              <path d="M4 8l2 1M4 14l2 1" strokeLinecap="round"/>
                              <path d="M20 8l-2 1M20 14l-2 1" strokeLinecap="round"/>
                            </svg>
                          )},
                          { key: 'gutter_clean', label: 'Gutter', icon: (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M4 6l2-2h12l2 2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M4 6v4c0 1 1 2 2 2h12c1 0 2-1 2-2V6" strokeLinejoin="round"/>
                              <path d="M8 12v8M16 12v8" strokeLinecap="round"/>
                              <path d="M12 12v4" strokeLinecap="round" strokeDasharray="2 2"/>
                            </svg>
                          )},
                        ].map((scope) => (
                          <button
                            key={scope.key}
                            type="button"
                            onClick={() => {
                              trackQuoteEvent('scope_selected', { service: S.service, scope: scope.key, context: S.context });
                              set('scope', scope.key);
                              applyScopePreset(S.service, scope.key);
                              setHasInteractedStep2(true);
                            }}
                            className={cls(
                              'flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg transition-all text-[11px] font-semibold',
                              S.scope === scope.key
                                ? 'bg-emerald-600 text-white shadow-lg ring-2 ring-emerald-600 ring-offset-1'
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                            )}
                            title={scope.label}
                          >
                            {scope.icon}
                            <span>{scope.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col gap-4 relative">
                      <StableMapSlot
                        className="w-full rounded-2xl border border-black/10 shadow-lg overflow-hidden h-[400px] sm:h-[500px] xl:h-[600px] xl:max-h-[70vh]"
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
                            const zones = activeYardJob?.polygon_geojson || [];
                            postZonesToIframe(zones);
                            postMessageToIframe({ type: 'YARD_SET_SCOPE', scope: isNdisContext ? 'yard_mow' : S.scope });
                          }}
                        />
                        {isCalculating && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-3 px-6 py-4 bg-white rounded-2xl border border-emerald-200 shadow-2xl">
                              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                              <span className="text-sm text-emerald-900 font-semibold">Calculating area & pricing...</span>
                            </div>
                          </div>
                        )}
                      </StableMapSlot>
                      {(activeYardJob?.polygon_geojson ?? []).some((z: any[]) => z.length >= 3) && (
                        <M.button
                          className="self-start px-3 py-1.5 rounded-lg text-xs border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-1.5"
                          onClick={resetActivePolygon}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Clear zones
                        </M.button>
                      )}
                      {/* Live measurement & price display */}
                      {(() => {
                        const measurement = getYardMeasurementConfig(S.scope);
                        const value = measurement.mode === 'perimeter' ? S.yardPerimeter : S.yardArea;
                        const unit = measurement.mode === 'perimeter' ? 'm' : 'm²';
                        const activeZones = (S.yardPolygon ?? []).filter((z: any[]) => z.length >= 3);
                        const hasPolygon = activeZones.length > 0;
                        const scopeLabel = isNdisContext
                          ? 'NDIS Yard Care'
                          : SCOPES_BY_SERVICE.yard.find((s) => s.key === S.scope)?.label ?? S.scope;
                        const jobPrice = activeYardJob?.price ?? 0;
                        const displayPrice = isNdisContext ? ndisHourlyPrice : jobPrice;

                        return (
                          <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">{scopeLabel}</span>
                                {hasPolygon ? (
                                  <span className="text-lg font-bold text-emerald-900">
                                    {isNdisContext
                                      ? `About ${effectiveNdisHours || NDIS_MIN_HOURS} hours · ${NDIS_REGION_LABELS[S.ndisRegion]}`
                                      : (
                                        <>
                                          {(value ?? 0).toLocaleString()} {unit}
                                          {activeZones.length > 1 && (
                                            <span className="ml-1.5 text-[11px] font-normal text-emerald-600">({activeZones.length} zones)</span>
                                          )}
                                        </>
                                      )}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-500">Tap Draw and outline your area</span>
                                )}
                              </div>
                            </div>
                            {hasPolygon && displayPrice !== null && displayPrice > 0 && (
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] uppercase tracking-wide text-slate-500">Est. price</span>
                                <span className="text-xl font-bold text-slate-900">{fmtAUD(displayPrice)}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <div className="text-xs text-slate-500 px-1">
                        Search your address, tap <strong>Draw</strong> on the map, then outline your area — tap the first point or &ldquo;Close shape&rdquo; to finish. Tap a completed zone to edit it.
                      </div>
                      <div className="rounded-xl border border-black/5 bg-gradient-to-br from-white/80 to-slate-50/50 p-3">
                        <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2 px-1">Your sites</div>
                        <div className="flex flex-wrap items-center gap-2">
                          {(S.yardJobs || []).map((job, idx) => {
                            const hasAddress = job.address && job.address.trim();
                            const label = hasAddress ? job.address : `Site ${idx + 1}`;
                            const measurement = measurementLabelForJob(job);
                            const isActive = job.job_id === activeYardJob?.job_id;
                            return (
                              <div key={job.job_id} className="group relative flex items-center gap-1">
                                <button
                                  type="button"
                                  className={cls(
                                    'flex flex-col text-left leading-tight rounded-xl px-3 py-2 text-[11px] transition-all duration-200',
                                    'min-w-[140px] max-w-[200px]',
                                    isActive
                                      ? 'border-2 border-emerald-600 bg-emerald-50 text-emerald-900 shadow-[0_4px_12px_rgba(16,185,129,0.3)] scale-105'
                                      : 'border border-black/10 bg-white text-slate-900 hover:border-emerald-300 hover:shadow-md'
                                  )}
                                  onClick={() => set('yardActiveJobId', job.job_id)}
                                >
                                  <span className="font-semibold truncate">{label}</span>
                                  <span className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{measurement}</span>
                                </button>
                                {/* Action buttons - show on hover */}
                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {/* Reset address button - only show if site has an address */}
                                  {hasAddress && (
                                    <button
                                      type="button"
                                      aria-label="Clear address"
                                      title="Clear address"
                                      className="w-5 h-5 rounded-full flex items-center justify-center text-amber-600 hover:text-white hover:bg-amber-500 border border-amber-200 hover:border-amber-500 transition-all"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        // Clear just the address for this job
                                        const nextJobs = (S.yardJobs || []).map((j) =>
                                          j.job_id === job.job_id ? { ...j, address: '' } : j
                                        );
                                        set('yardJobs', nextJobs as any);
                                      }}
                                    >
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M3 12h18M12 3l-4 4m4-4l4 4" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </button>
                                  )}
                                  {/* Remove site button - only show if more than 1 site */}
                                  {S.yardJobs && S.yardJobs.length > 1 && (
                                    <button
                                      type="button"
                                      aria-label={`Remove ${label}`}
                                      title="Remove site"
                                      className="w-5 h-5 rounded-full flex items-center justify-center text-sm text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 transition-all"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        removeYardJob(job.job_id);
                                      }}
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={addYardJob}
                            className="flex items-center gap-1.5 rounded-xl border-2 border-dashed border-emerald-300 bg-white/80 px-4 py-2 text-xs font-semibold text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-md transition-all"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add site
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })()}</Step2ErrorBoundary>}
      {/* ===== STEP 3 ===== */}
      {S.step === 3 && (
  <>
    <section className="mb-28" aria-labelledby="step3-heading">
      <h2 id="step3-heading" className="sr-only">
        Step 3: Request your booking
      </h2>

      <div className={`rounded-2xl p-3 sm:p-5 ${glass} min-w-0 overflow-x-hidden`}>
        {!hasWork ? (
          <div className="text-sm text-slate-800">
            Add a preset on Step 2 to see an estimate.
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6 min-w-0">
            {/* MAIN: form */}
            <div className="min-w-0 lg:col-span-2 space-y-6 order-2 lg:order-1">
              {/* Header */}
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold text-slate-900">
                  Request your booking
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  {authedUser
                    ? 'Review your details below and confirm your service address.'
                    : 'We\u2019ll confirm times and any changes before work proceeds.'}
                </p>
              </div>

              {/* Contact */}
              <S3_Card>
                <S3_Title>
                  <span className="flex items-center gap-2">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    Contact details
                  </span>
                </S3_Title>
                {authedUser && !profileHydrated && (
                  <div className="mt-2 mb-1 text-[11px] text-slate-400">Loading your details&hellip;</div>
                )}
                {authedUser && profileHydrated && S.phone.trim() && (
                  <div className="mt-2 mb-1 flex items-center gap-1.5 text-[11px] font-medium" style={{ color: '#15803d' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    We&apos;ve filled this from your account &mdash; edit below to change
                  </div>
                )}
                {authedUser && profileHydrated && !S.phone.trim() && (
                  <div className="mt-2 mb-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-600">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    We filled what we could from your account &mdash; add your phone to continue.
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="s3-fullname">Full name <span className="text-red-500">*</span></label>
                    <input
                      id="s3-fullname"
                      className={cls(
                        "w-full rounded-xl border bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 focus:border-[color:var(--accent)]",
                        fieldTouched.fullName && (!authedUser || profileHydrated) && !S.fullName.trim() ? "border-red-400" : "border-black/10"
                      )}
                      placeholder="Jane Smith"
                      value={S.fullName}
                      onChange={(e) => set('fullName', e.target.value)}
                      onFocus={() => setCaptchaReady(true)}
                      onBlur={() => touchField('fullName')}
                      aria-label="Full name"
                      required
                      aria-required="true"
                    />
                    {fieldTouched.fullName && (!authedUser || profileHydrated) && !S.fullName.trim() && (
                      <div className="text-[11px] text-red-600 mt-1">Full name is required.</div>
                    )}
                    {S.fullName.trim().length > 0 && S.fullName.trim().length < 2 && (
                      <div className="text-[11px] text-red-600 mt-1">Please enter your full name.</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="s3-email">Email <span className="text-red-500">*</span></label>
                    <input
                      id="s3-email"
                      className={cls(
                        "w-full rounded-xl border bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 focus:border-[color:var(--accent)]",
                        fieldTouched.email && (!authedUser || profileHydrated) && !S.email.trim() ? "border-red-400" : "border-black/10"
                      )}
                      placeholder="jane@example.com"
                      value={S.email}
                      onChange={(e) => set('email', e.target.value)}
                      onFocus={() => setCaptchaReady(true)}
                      onBlur={(e) => {
                        touchField('email');
                        set('email', (e.target.value || '').trim().toLowerCase());
                      }}
                      aria-label="Email"
                      required
                      aria-required="true"
                    />
                    {fieldTouched.email && (!authedUser || profileHydrated) && !S.email.trim() && (
                      <div className="text-[11px] text-red-600 mt-1">Email is required.</div>
                    )}
                    {S.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email) && (
                      <div className="text-[11px] text-red-600 mt-1">Enter a valid email.</div>
                    )}
                    {authedUser && S.email.trim() && S.email.trim().toLowerCase() !== (authedUser.email ?? '').toLowerCase() && (
                      <div className="text-[11px] text-amber-600 mt-1">
                        This doesn&apos;t match your account email ({authedUser.email}). The quote may not appear in your portal.
                      </div>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="s3-phone">Phone <span className="text-red-500">*</span></label>
                    <input
                      id="s3-phone"
                      className={cls(
                        "w-full rounded-xl border bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 focus:border-[color:var(--accent)]",
                        fieldTouched.phone && (!authedUser || profileHydrated) && !S.phone.trim() ? "border-red-400" : "border-black/10"
                      )}
                      placeholder="04XX XXX XXX"
                      onFocus={() => setCaptchaReady(true)}
                      onBlur={() => touchField('phone')}
                      value={S.phone}
                      onChange={(e) => {
                        // Strip non-digits, then normalise +61 country code to leading 0
                        const digits = e.target.value.replace(/\D+/g, '').replace(/^61/, '0');
                        set(
                          'phone',
                          digits
                            .replace(/(\d{4})(\d{3})(\d{0,3}).*/, '$1 $2 $3')
                            .trim()
                        );
                      }}
                      aria-label="Phone"
                      required
                      aria-required="true"
                    />
                    {fieldTouched.phone && (!authedUser || profileHydrated) && !S.phone.trim() && (
                      <div className="text-[11px] text-red-600 mt-1">Phone is required.</div>
                    )}
                    {S.phone.replace(/\D+/g, '').length > 0 && S.phone.replace(/\D+/g, '').length < 10 && (
                      <div className="text-[11px] text-red-600 mt-1">Enter a valid Australian phone number (10 digits).</div>
                    )}
                  </div>
                </div>
                {authedUser && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="s3-save-profile"
                      checked={saveToProfile}
                      onChange={(e) => setSaveToProfile(e.target.checked)}
                      className="rounded border-black/20 accent-[color:var(--accent)]"
                    />
                    <label htmlFor="s3-save-profile" className="text-[11px] text-slate-500 cursor-pointer select-none">
                      Save these details to my account
                    </label>
                  </div>
                )}
              </S3_Card>

              {isNdisContext && (
                <S3_Card className="scroll-mt-24" >
                  <div id="s3-ndis-routing" className="sr-only" aria-hidden="true" />
                  <S3_Title>
                    <span className="flex items-center gap-2">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600" aria-hidden="true"><path d="M12 2v20"/><path d="M2 12h20"/><circle cx="12" cy="12" r="9"/></svg>
                      NDIS quote routing
                    </span>
                  </S3_Title>
                  <p className="mt-2 text-[12px] text-slate-600">
                    Routed with Buds At Work and <span className="font-semibold text-violet-800">MaluCare</span> so the quote lands with the right person from the start.
                  </p>
                  <div className="mt-3 grid gap-2">
                    {NDIS_MANAGEMENT_OPTIONS.map((option) => {
                      const active = S.ndisManagementType === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          className={cls(
                            'rounded-2xl border px-4 py-3 text-left transition-colors',
                            active
                              ? 'border-violet-500 bg-violet-50 shadow-[0_8px_24px_rgba(109,40,217,0.10)]'
                              : 'border-black/10 bg-white/70 hover:border-violet-300 hover:bg-violet-50/50'
                          )}
                          onClick={() => set('ndisManagementType', option.key)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{option.title}</div>
                              <div className="mt-1 text-xs text-slate-600">{option.description}</div>
                              <div className="mt-2 text-[11px] font-medium text-violet-800">{option.destination}</div>
                            </div>
                            <span
                              className={cls(
                                'mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border',
                                active ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-transparent'
                              )}
                              aria-hidden="true"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {!S.ndisManagementType && (
                    <div className="mt-2 text-[11px] text-amber-700">
                      Select how this participant is managed so we know who should receive the quote.
                    </div>
                  )}
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="s3-ndis-forward-contact">
                        Forward contact
                      </label>
                      <input
                        id="s3-ndis-forward-contact"
                        className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                        placeholder="Plan manager, nominee, or participant"
                        value={S.ndisForwardContactName}
                        onChange={(e) => set('ndisForwardContactName', e.target.value)}
                        onFocus={() => setCaptchaReady(true)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="s3-ndis-forward-email">
                        Forward quote email
                      </label>
                      <input
                        id="s3-ndis-forward-email"
                        className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                        placeholder="billing@provider.com.au"
                        value={S.ndisForwardEmail}
                        onChange={(e) => set('ndisForwardEmail', e.target.value)}
                        onBlur={(e) => set('ndisForwardEmail', (e.target.value || '').trim().toLowerCase())}
                        onFocus={() => setCaptchaReady(true)}
                      />
                      {S.ndisForwardEmail.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.ndisForwardEmail.trim()) && (
                        <div className="mt-1 text-[11px] text-red-600">Enter a valid forwarding email or leave this blank.</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-[11px] text-slate-600">
                    Leave the forwarding email blank if the quote should go to the participant email above first. We’ll include the routing notes for the team either way.
                  </div>
                </S3_Card>
              )}

              {/* Location & access */}
              <S3_Card>
                <S3_Title>
                  <span className="flex items-center gap-2">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    Location & access
                  </span>
                </S3_Title>
                <div id="s3-service-address" className="mt-3">
                  {savedPropertyAddress && !S.address.trim() && !(isNdisContext && S.service === 'yard') && (
                    <div className="mb-2 flex items-center gap-2 p-2.5 rounded-xl border border-black/10 bg-white/70">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 flex-shrink-0" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      <span className="text-[11px] text-slate-600 flex-1 truncate">{savedPropertyAddress}</span>
                      <button
                        type="button"
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[color:var(--accent)] text-[color:var(--accent)] hover:bg-emerald-50 transition-colors flex-shrink-0"
                        onClick={() => {
                          handleServiceAddressSelected(savedPropertyAddress, savedPropertyAddress);
                          trackQuoteEvent('quote_step3_address_filled', { service: S.service, scope: S.scope, source: 'saved_property' });
                        }}
                      >
                        Use saved
                      </button>
                    </div>
                  )}
                  {isNdisContext ? (
                    <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 text-sm text-slate-700">
                      {S.address ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 flex-1 truncate">{S.address}</span>
                          <span className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                            {NDIS_REGION_LABELS[S.ndisRegion]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500">
                          {S.service === 'yard'
                            ? 'Search the address on the map before reviewing the quote.'
                            : 'Add the service address in Job details before reviewing the quote.'}
                        </span>
                      )}
                    </div>
                  ) : (
                    <ServiceAddressInput
                      address={S.address}
                      onAddressChange={(formatted, suburb, coords) => {
                        handleServiceAddressSelected(formatted, suburb, coords);
                      }}
                      onClear={() => {
                        setMany({ address: '', region: '' });
                      }}
                    />
                  )}
                  {renderMmmStatus()}
                </div>

                <div className="mt-4">
                  <div className="text-xs text-slate-600 mb-2">Access notes</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={cls(
                        'px-2.5 py-1 rounded-full text-xs border',
                        S.paidParking
                          ? 'border-[color:var(--accent)] bg-white'
                          : 'border-black/10 bg-white/70'
                      )}
                      onClick={() => { set('paidParking', !S.paidParking); trackQuoteEvent('quote_step3_access_toggle', { field: 'paidParking', value: !S.paidParking }); }}
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
                      onClick={() => { set('secondStorey', !S.secondStorey); trackQuoteEvent('quote_step3_access_toggle', { field: 'secondStorey', value: !S.secondStorey }); }}
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
                      onClick={() => { set('afterHours', !S.afterHours); trackQuoteEvent('quote_step3_access_toggle', { field: 'afterHours', value: !S.afterHours }); }}
                    >
                      After-hours (post-6pm)
                    </button>
                    <button
                      type="button"
                      className={cls(
                        'px-2.5 py-1 rounded-full text-xs border',
                        S.clutterAccess
                          ? 'border-[color:var(--accent)] bg-white'
                          : 'border-black/10 bg-white/70'
                      )}
                      onClick={() => { set('clutterAccess', !S.clutterAccess); trackQuoteEvent('quote_step3_access_toggle', { field: 'clutterAccess', value: !S.clutterAccess }); }}
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
                      onClick={() => { set('petHair', !S.petHair); trackQuoteEvent('quote_step3_access_toggle', { field: 'petHair', value: !S.petHair }); }}
                    >
                      Pets present
                    </button>
                  </div>
                </div>
              </S3_Card>

              {/* Inline quick-note chips — most common access notes surfaced before the expand toggle */}
              <div className="flex flex-wrap gap-1.5 -mt-2">
                {(['Gate code', 'Key in lockbox'] as const).map((chip) => {
                  const alreadyAdded = S.notes.includes(chip);
                  return (
                    <button
                      key={chip}
                      type="button"
                      disabled={alreadyAdded}
                      className={cls(
                        'px-2.5 py-1 rounded-full text-xs border transition-colors',
                        alreadyAdded
                          ? 'border-[color:var(--accent)] bg-white text-slate-500 cursor-default'
                          : 'border-black/10 bg-white/70 text-slate-600 hover:border-[color:var(--accent)] hover:bg-white'
                      )}
                      onClick={() => {
                        const sep = S.notes.trim() ? '\n' : '';
                        set('notes', `${S.notes.trim()}${sep}${chip}: `);
                      }}
                    >
                      {alreadyAdded ? '✓ ' : '+ '}{chip}
                    </button>
                  );
                })}
              </div>

              {/* Expandable: Availability + Notes */}
              <div>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-black/10 bg-white/60 text-sm font-medium text-slate-700 hover:bg-white/80 transition-colors"
                  onClick={() => {
                    setS3DetailsOpen((v) => {
                      trackQuoteEvent('quote_step3_details_toggled', { opened: !v });
                      return !v;
                    });
                  }}
                  aria-expanded={s3DetailsOpen}
                >
                  <span className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    Add scheduling preferences &amp; notes
                    {(S.preferredAvailability?.length > 0 || S.notes.trim()) && (
                      <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-medium">
                        {[S.preferredAvailability?.length > 0 && 'availability', S.notes.trim() && 'notes'].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={cls('transition-transform', s3DetailsOpen ? 'rotate-180' : '')}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {s3DetailsOpen && (
                  <div className="mt-3 space-y-4">

              {/* Availability */}
              <S3_Card>
                <S3_Title>
                  <span className="flex items-center gap-2">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    When works best for you?
                  </span>
                </S3_Title>
                <p className="text-[11px] text-slate-500 mt-1">Select all that apply — we&apos;ll try to match your schedule.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(['Weekday mornings', 'Weekday afternoons', 'Weekends', 'Flexible / ASAP'] as const).map((slot) => {
                    const active = (S.preferredAvailability || []).includes(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        className={cls(
                          'px-3 py-1.5 rounded-full text-xs border transition-colors',
                          active
                            ? 'border-[color:var(--accent)] bg-white font-medium'
                            : 'border-black/10 bg-white/70'
                        )}
                        onClick={() => {
                          const current: string[] = S.preferredAvailability || [];
                          const next = active ? current.filter((v) => v !== slot) : [...current, slot];
                          set('preferredAvailability', next);
                          trackQuoteEvent('quote_step3_availability_selected', { slot, selected: !active });
                        }}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
                <label className="mt-4 flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={S.photosOK}
                    onChange={(e) => {
                      set('photosOK', e.target.checked);
                      trackQuoteEvent('quote_step3_photos_ok', { checked: e.target.checked });
                    }}
                    className="mt-0.5 accent-emerald-600"
                  />
                  <span className="text-xs text-slate-700">
                    Send a few photos for a faster, more accurate quote
                    <span className="block text-[11px] text-slate-400 mt-0.5">Customers who share photos get a confirmed price sooner — we&apos;ll follow up via SMS or email, no app needed.</span>
                  </span>
                </label>
              </S3_Card>

              {/* Notes */}
              <S3_Card>
                <S3_Title>
                  <span className="flex items-center gap-2">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Anything else?
                  </span>
                </S3_Title>
                {savedPropertyAccess && !S.notes?.trim() && (
                  <div className="mt-3 mb-2 flex items-center justify-between p-2.5 rounded-xl border border-black/10 bg-white/70">
                    <span className="text-[11px] text-slate-600 truncate">Saved access details available</span>
                    <button
                      type="button"
                      className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[color:var(--accent)] text-[color:var(--accent)] hover:bg-emerald-50 transition-colors flex-shrink-0 ml-2"
                      onClick={() => {
                        const parts: string[] = [];
                        if (savedPropertyAccess.gate_code?.trim()) parts.push(`Gate code: ${savedPropertyAccess.gate_code.trim()}`);
                        if (savedPropertyAccess.pet_warnings?.trim()) parts.push(`Pets: ${savedPropertyAccess.pet_warnings.trim()}`);
                        if (savedPropertyAccess.parking?.trim()) parts.push(`Parking: ${savedPropertyAccess.parking.trim()}`);
                        if (savedPropertyAccess.special_instructions?.trim()) parts.push(savedPropertyAccess.special_instructions.trim());
                        set('notes', parts.join('\n'));
                      }}
                    >
                      Use saved
                    </button>
                  </div>
                )}
                <textarea
                  className="mt-3 w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 focus:border-[color:var(--accent)] resize-none"
                  rows={3}
                  placeholder="Gate code, parking instructions, pets, anything specific…"
                  value={S.notes}
                  maxLength={2000}
                  onChange={(e) => set('notes', e.target.value.slice(0, 2000))}
                  aria-label="Notes"
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-[10px] ${S.notes.length > 1800 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {S.notes.length}/2000
                  </span>
                </div>
                {/* Quick-add chips — tap to append a prompt to the notes field */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(['Gate code', 'Driveway access', 'Pool or spa', 'Extra mess', 'Fragile items', 'Key in lockbox'] as const).map((chip) => {
                    const alreadyAdded = S.notes.includes(chip);
                    return (
                      <button
                        key={chip}
                        type="button"
                        disabled={alreadyAdded}
                        className={cls(
                          'px-2 py-0.5 rounded-full text-[11px] border transition-colors',
                          alreadyAdded
                            ? 'border-[color:var(--accent)] bg-white text-slate-500 cursor-default'
                            : 'border-black/10 bg-white/70 text-slate-600 hover:border-[color:var(--accent)] hover:bg-white'
                        )}
                        onClick={() => {
                          const sep = S.notes.trim() ? '\n' : '';
                          set('notes', `${S.notes.trim()}${sep}${chip}: `);
                        }}
                      >
                        {alreadyAdded ? '✓ ' : '+ '}{chip}
                      </button>
                    );
                  })}
                </div>
              </S3_Card>

                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-600 text-center space-y-1">
                <div>You won&apos;t be charged now — we&apos;ll confirm times and any price changes before work proceeds.</div>
                <div className="text-slate-400">We typically respond within 2 hours on business days.</div>
              </div>
            </div>

            {/* SIDEBAR */}
            <aside className={cls('min-w-0 lg:col-span-1 h-fit order-1 lg:order-2', !yardActive && 'lg:sticky lg:top-6')}>
              <S3_Card className="relative overflow-hidden">
                <div
                  className="absolute inset-x-0 -top-1 h-1 rounded-t-2xl"
                  style={{
                    background: `linear-gradient(90deg, ${ACCENT}, #22c55e)`,
                  }}
                />

                {/* Service Summary */}
                <div className="mb-4 pb-3 border-b border-black/5">
                  <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      Service requested
                    </div>
                    <span
                      className={cls(
                        'text-[10px] px-2 py-0.5 rounded-full flex-shrink-0',
                        S.context === 'commercial'
                          ? 'bg-indigo-100 text-indigo-800'
                          : S.context === 'ndis'
                          ? 'bg-violet-100 text-violet-800'
                          : 'bg-emerald-100 text-emerald-800'
                      )}
                    >
                      {serviceContextLabel}
                    </span>
                  </div>
                  <div className="text-base font-medium text-slate-900">
                    {SERVICES.find((x) => x.key === S.service)?.label ?? S.service}
                  </div>
                  <div className="text-sm text-slate-600 mt-0.5">
                    {(() => {
                      // For commercial cleaning, show the cleaning type + frequency
                      if (S.context === 'commercial' && S.service === 'cleaning') {
                        const typeLabel = S.commercialCleaningType
                          ? COMM_LABELS[S.commercialCleaningType]?.title ?? S.commercialCleaningType
                          : 'Office & Corporate';
                        const freqLabel = getFrequencyLabel(S.commFrequency);
                        const presetLabel = S.commPreset
                          ? S.commPreset.charAt(0).toUpperCase() + S.commPreset.slice(1)
                          : 'Essential';
                        return (
                          <>
                            {typeLabel}
                            <span className="mx-1.5 text-slate-400">·</span>
                            {presetLabel}
                            <span className="mx-1.5 text-slate-400">·</span>
                            {freqLabel}
                          </>
                        );
                      }
                      // For NDIS cleaning + yard the user doesn't pick a
                      // scope on Step 2 — they configure hours via the
                      // dedicated estimator. Surface the actual inputs
                      // (rooms / yard size + condition) so this row reflects
                      // their Step 2 selections.
                      if (isNdisContext && S.service === 'cleaning') {
                        const rooms =
                          S.ndisPropertyBedrooms +
                          S.ndisPropertyBathrooms +
                          S.ndisPropertyLiving +
                          S.ndisPropertyKitchens +
                          S.ndisPropertyLaundry;
                        const condLabel =
                          S.ndisCondition === 'tidy' ? 'Tidy'
                          : S.ndisCondition === 'lived_in' ? 'Lived-in'
                          : 'Reset';
                        return (
                          <>
                            {S.ndisPropertyBedrooms} bed · {S.ndisPropertyBathrooms} bath
                            <span className="mx-1.5 text-slate-400">·</span>
                            {rooms} rooms total
                            <span className="mx-1.5 text-slate-400">·</span>
                            {condLabel}
                          </>
                        );
                      }
                      if (isNdisContext && S.service === 'yard') {
                        const sizeLabel =
                          S.ndisYardSize === 'small' ? 'Small yard'
                          : S.ndisYardSize === 'medium' ? 'Medium yard'
                          : S.ndisYardSize === 'large' ? 'Large yard'
                          : 'X-Large yard';
                        const condLabel =
                          S.ndisCondition === 'tidy' ? 'Maintained'
                          : S.ndisCondition === 'lived_in' ? 'Standard growth'
                          : 'Overgrown';
                        return (
                          <>
                            {sizeLabel}
                            <span className="mx-1.5 text-slate-400">·</span>
                            {condLabel}
                          </>
                        );
                      }
                      // For other services, show the scope label
                      if (S.service === 'cleaning' && S.context !== 'commercial') {
                        return RESIDENTIAL_CLEANING_SCOPE_LABELS[S.scope] ?? S.scope ?? 'Select a scope';
                      }
                      const scopeDef = SCOPES_BY_SERVICE[S.service]?.find((s) => s.key === S.scope);
                      return scopeDef?.label ?? S.scope ?? 'Select a scope';
                    })()}
                  </div>
                  {isNdisContext && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="inline-block h-1 w-1 rounded-full bg-violet-400" aria-hidden="true" />
                      <span>
                        Partnered with <span className="font-semibold text-slate-700">MaluCare</span>
                      </span>
                    </div>
                  )}
                  {/* Show subscription badge for recurring commercial cleans */}
                  {S.context === 'commercial' && S.service === 'cleaning' && S.commFrequency && S.commFrequency !== 'none' && (
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-violet-100 text-violet-800">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Recurring subscription
                      </span>
                    </div>
                  )}
                </div>

                {S.service === 'yard' ? (
                  (() => {
                    // NDIS yard is priced as (estimated hours × Price-Guide
                    // rate) — there's no polygon flow, so the regular
                    // siteCount + estimate.minutes detail row is wrong and
                    // wouldn't reflect Step 2 inputs (yard size, condition,
                    // rate slot, region). Surface the same hourly breakdown
                    // we use for NDIS cleaning instead.
                    if (isNdisContext && ndisHourlyPrice !== null) {
                      const rate = ndisRateFor(S.ndisRateSlot, S.ndisRegion);
                      const hours = effectiveNdisHours || NDIS_MIN_HOURS;
                      const fmtHours = (h: number) =>
                        Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/\.?0+$/, '');
                      const sizeLabel =
                        S.ndisYardSize === 'small' ? 'Small'
                        : S.ndisYardSize === 'medium' ? 'Medium'
                        : S.ndisYardSize === 'large' ? 'Large'
                        : 'X-Large';
                      const condLabel =
                        S.ndisCondition === 'tidy' ? 'Maintained'
                        : S.ndisCondition === 'lived_in' ? 'Standard growth'
                        : 'Overgrown';
                      return (
                        <div className="mt-4 space-y-3">
                          <div className="text-[11px] uppercase tracking-wide text-slate-600">
                            Final yard price
                          </div>
                          <div className="text-4xl font-semibold mt-1 text-slate-900">
                            {priceLabel}
                          </div>
                          <div className="text-xs text-slate-600">
                            {sizeLabel} yard · {condLabel} · ~{fmtHours(hours)} hr
                          </div>
                          <div className="mt-3 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                            <S3_Row k="Estimated hours" v={`${fmtHours(hours)} hr`} />
                            <S3_Row
                              k={`Rate · ${NDIS_RATE_LABELS[S.ndisRateSlot]}`}
                              v={`${fmtAUD(rate)}/hr`}
                            />
                            <S3_Row k="Region" v={NDIS_REGION_LABELS[S.ndisRegion]} />
                            <div className="h-[1px] bg-white/60 my-1" />
                            <S3_Row k="Total" v={priceLabel} bold />
                          </div>
                          <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-[11px] text-violet-900">
                            <span className="font-semibold">Hourly billing.</span>{' '}
                            We log time on-site so your plan is only charged for actual delivered hours.
                          </div>
                        </div>
                      );
                    }
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
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] uppercase tracking-wide text-slate-600">
                          Your quote
                        </div>
                        <div className="text-3xl sm:text-4xl font-semibold mt-1">
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
                      {S.service !== 'dump' || (S.scope !== 'dump_transport' && S.scope !== 'dump_delivery') ? (
                        <span
                          className={cls(
                            'text-[11px] px-2 py-1 rounded-full flex-shrink-0',
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
                      ) : (
                        <span className="text-[11px] px-2 py-1 rounded-full flex-shrink-0 bg-green-100 text-green-900">
                          Fixed pricing
                        </span>
                      )}
                    </div>

                    <div className="mt-4 space-y-2">
                      {/* Transport / Delivery: dedicated transparent breakdown */}
                      {S.service === 'dump' && (S.scope === 'dump_transport' || S.scope === 'dump_delivery') ? (() => {
                        const isTransport = S.scope === 'dump_transport';
                        const quoteResult = isTransport
                          ? calcTransportQuote(S.dumpTransport, S.distanceKm)
                          : calcDeliveryQuote(S.dumpDelivery, S.distanceKm);

                        if (quoteResult.isCustomQuote) {
                          return (
                            <>
                              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                                <div className="font-semibold mb-1">Custom quote required</div>
                                <div className="text-[11px]">{quoteResult.customQuoteReason ?? 'This job may require a custom quote based on distance, access, or item size.'}</div>
                              </div>
                              <div className="text-[11px] text-slate-600 mt-2">
                                Contact us and we&apos;ll provide a fair, itemised quote.
                              </div>
                            </>
                          );
                        }

                        return (
                          <>
                            <div className="text-[11px] font-medium text-slate-700 mb-1">Price breakdown</div>
                            {quoteResult.lineItems.map((item, i) => (
                              <S3_Row
                                key={i}
                                k={item.label}
                                v={item.note === 'Included' ? 'Included' : fmtAUD(item.amount)}
                              />
                            ))}
                            <div className="h-[1px] bg-white/60 my-2" />
                            <S3_Row k="Total" v={priceLabel} bold />
                            <div className="text-[11px] text-slate-500 mt-1">
                              Transparent pricing — no hidden fees.
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Large or long-distance jobs may require a custom quote.
                            </div>
                          </>
                        );
                      })() : isNdisContext && S.service === 'cleaning' && ndisHourlyPrice !== null ? (() => {
                        // NDIS cleaning is billed strictly as
                        // (estimated hours × Price-Guide rate). The
                        // scope-based `estimate.*` rows don't apply here —
                        // they ignore the hour/rate slot/region inputs from
                        // Step 2, which made the breakdown look frozen
                        // whenever the user changed any of those. (Yard is
                        // handled separately in its own branch above.)
                        const rate = ndisRateFor(S.ndisRateSlot, S.ndisRegion);
                        const hours = effectiveNdisHours || NDIS_MIN_HOURS;
                        const fmtHours = (h: number) =>
                          Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/\.?0+$/, '');
                        return (
                          <>
                            <div className="text-[11px] font-medium text-slate-700 mb-1">Price breakdown</div>
                            <S3_Row k="Estimated hours" v={`${fmtHours(hours)} hr`} />
                            <S3_Row
                              k={`Rate · ${NDIS_RATE_LABELS[S.ndisRateSlot]}`}
                              v={`${fmtAUD(rate)}/hr`}
                            />
                            <S3_Row k="Region" v={NDIS_REGION_LABELS[S.ndisRegion]} />
                            <div className="h-[1px] bg-white/60 my-2" />
                            <S3_Row k="Subtotal" v={fmtAUD(Math.round(hours * rate))} />
                            <S3_Row k="Total" v={priceLabel} bold />
                            <div className="mt-2 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-[11px] text-violet-900">
                              <span className="font-semibold">Hourly billing.</span>{' '}
                              We log time on-site so your plan is only charged for actual delivered hours.
                              Quarter-hour units, capped at the NDIS Price Guide rate.
                            </div>
                            <div className="text-[11px] text-slate-600 mt-2">
                              {FAIRNESS_PROMISE_COPY}
                            </div>
                          </>
                        );
                      })() : (
                        <>
                          {estimate.labourFloor ? (
                            <S3_Row k="Time minimum" v={fmtAUD(estimate.labourFloor)} />
                          ) : null}
                          <S3_Row k="Service estimate" v={fmtAUD(estimate.baseBeforeFees)} />
                          {isLaundryService && (
                            <>
                              {(S.laundryPerLoadAddOns ?? []).map((k) => (
                                <S3_Row key={k} k={LAUNDRY_PER_LOAD_ADDONS[k].label} v={`+${fmtAUD(LAUNDRY_PER_LOAD_ADDONS[k].price * laundryLoads)}`} />
                              ))}
                              {(S.laundryPerOrderAddOns ?? []).map((k) => (
                                <S3_Row key={k} k={LAUNDRY_PER_ORDER_ADDONS[k].label} v={`+${fmtAUD(LAUNDRY_PER_ORDER_ADDONS[k].price)}`} />
                              ))}
                              {(S.laundryIroningItems ?? []).filter((i) => i.count > 0).map((item) => (
                                <S3_Row key={item.type} k={`Ironing – ${LAUNDRY_IRONING_PRICES[item.type].label}`} v={`+${fmtAUD(LAUNDRY_IRONING_PRICES[item.type].price * item.count)}`} />
                              ))}
                              <S3_Row k="Pickup & delivery" v={fmtAUD(12)} />
                              <S3_Row k="Service fee" v={fmtAUD(2)} />
                            </>
                          )}
                          {(isSneakerService || isSneakerLot) && (
                            <>
                              <S3_Row k="Pickup & delivery" v={fmtAUD(8)} />
                              <S3_Row k="Service fee" v={fmtAUD(2)} />
                            </>
                          )}
                          {estimate.travel > 0 && (
                            <S3_Row k="Travel" v={fmtAUD(estimate.travel)} />
                          )}
                          {estimate.parking > 0 && (
                            <S3_Row k="Parking" v={fmtAUD(estimate.parking)} />
                          )}
                          {estimate.tip > 0 && (
                            <S3_Row k="Tip" v={fmtAUD(estimate.tip)} />
                          )}
                          {(() => {
                            const mats = S.service === 'cleaning'
                              ? S.context === 'commercial' ? 12 : 8
                              : 0;
                            return mats > 0 ? <S3_Row k="Materials" v={fmtAUD(mats)} /> : null;
                          })()}
                          <div className="h-[1px] bg-white/60 my-2" />
                          <S3_Row k="Total" v={priceLabel} bold />
                          <div className="text-[11px] text-slate-600">
                            {PRICE_SCOPE_DISCLAIMER}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            {FAIRNESS_PROMISE_COPY}
                          </div>
                        </>
                      )}
                      <div className="text-[11px] text-slate-600">
                        {TERMS_SNIPPET}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {SMALL_JOB_PAYMENT_COPY}
                      </div>

                      <div className="mt-3">
                        <button
                          type="button"
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-black/15 bg-white/70 text-xs text-slate-700 font-medium hover:bg-white hover:border-black/25 transition-colors"
                          onClick={() => goToStep(2)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Edit scope or inclusions
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* CAPTCHA verification — deferred until first contact-field interaction */}
                <div className="mt-4">
                  <div className="text-xs text-slate-600 mb-2">Verify you&apos;re human</div>
                  {captchaReady ? (
                    TURNSTILE_SITE_KEY ? (
                      <Turnstile
                        siteKey={TURNSTILE_SITE_KEY}
                        onVerify={(token) => { setCaptchaToken(token); setCaptchaExpired(false); }}
                        onExpire={() => { setCaptchaToken(null); setCaptchaExpired(true); }}
                        onError={() => { setCaptchaToken(null); setCaptchaExpired(false); }}
                        theme="light"
                      />
                    ) : (
                      <div
                        role="status"
                        className="text-[11px] text-amber-600 mt-1"
                      >
                        Turnstile site key missing. Set <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> so the CAPTCHA can render.
                      </div>
                    )
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">
                      Verification will appear when you start filling in your details.
                    </div>
                  )}
                  {!captchaToken && !!TURNSTILE_SITE_KEY && captchaExpired && (
                    <div className="text-[11px] text-amber-600 mt-1">
                      Verification expired — please re-verify above.
                    </div>
                  )}
                  {!captchaToken && !!TURNSTILE_SITE_KEY && !captchaExpired && captchaReady && (
                    <div className="text-[11px] text-amber-600 mt-1">
                      Please complete the verification above to submit your quote.
                    </div>
                  )}
                </div>

                {/* Captcha directional hint — only shown when captcha is ready but not yet verified */}
                {captchaReady && !captchaToken && !!TURNSTILE_SITE_KEY && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Complete the verification above to unlock the submit button.
                  </div>
                )}

                {/* Actions */}
                <div className="mt-5 flex flex-col gap-2.5">
                  <M.button
                    id="step3-submit-btn"
                    className={cls(
                      "px-4 py-3 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(20,83,45,0.28)]",
                      ((!captchaToken && !!TURNSTILE_SITE_KEY) || isCheckoutLoading) && "opacity-60 cursor-not-allowed"
                    )}
                    style={{ background: 'var(--accent)' }}
                    disabled={isCheckoutLoading}
                    onClick={async () => {
                      if (!captchaToken && TURNSTILE_SITE_KEY) {
                        toast.error('Please complete the verification to submit.');
                        return;
                      }

                      const normalisedPhone = S.phone.replace(/\D+/g, '').replace(/^61/, '0');
                      const ndisForwardEmail = S.ndisForwardEmail.trim().toLowerCase();
                      const hasValidNdisForwardEmail =
                        !ndisForwardEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ndisForwardEmail);
                      const okInputs =
                        S.fullName?.trim().length >= 2 &&
                        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email || '') &&
                        normalisedPhone.length >= 10 &&
                        S.address.trim().length > 0 &&
                        (!isNdisContext || !!S.ndisManagementType) &&
                        hasValidNdisForwardEmail;

                      if (!okInputs) {
                        const missingFields = [
                          (!S.fullName?.trim() || S.fullName.trim().length < 2) && 'name',
                          !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email || '')) && 'email',
                          normalisedPhone.length < 10 && 'phone',
                          !S.address.trim() && 'address',
                          (isNdisContext && !S.ndisManagementType) && 'ndis_management',
                          (isNdisContext && !hasValidNdisForwardEmail) && 'ndis_forward_email',
                        ].filter(Boolean).join(',');
                        trackQuoteEvent('quote_step3_submit_failed', { service: S.service, scope: S.scope, missing_fields: missingFields });
                        toast.error(
                          isNdisContext
                            ? 'Please complete your details, service address, and NDIS routing fields.'
                            : 'Please complete your details and confirm your service address.'
                        );
                        // Scroll to the first invalid field so it's visible.
                        const firstInvalid =
                          (!S.fullName?.trim() || S.fullName.trim().length < 2) ? 's3-fullname'
                          : !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email || '')) ? 's3-email'
                          : normalisedPhone.length < 10 ? 's3-phone'
                          : !S.address.trim() ? 's3-service-address'
                          : isNdisContext && !S.ndisManagementType ? 's3-ndis-routing'
                          : isNdisContext && !hasValidNdisForwardEmail ? 's3-ndis-forward-email'
                          : null;
                        if (firstInvalid) {
                          document.getElementById(firstInvalid)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          document.getElementById(firstInvalid)?.focus();
                        }
                        return;
                      }

                      // Compute the total that matches what the customer saw in the UI,
                      // including any delivery/service fees for laundry and sneaker services.
                      let effectiveTotal = scopedPricing?.price ?? estimate.total;
                      // NDIS cleaning + yard are billed at (estimated hours × NDIS hourly rate) —
                      // mirror the override used in the live price display.
                      if (ndisHourlyPrice !== null) {
                        effectiveTotal = ndisHourlyPrice;
                      }
                      if (isLaundryService) {
                        // Match priceLabel: base service cost + pickup/delivery + service fee
                        const laundryBase = Math.max(LAUNDRY_MIN, laundryLoads * 30) + laundryAddOnTotal;
                        effectiveTotal = laundryBase + LAUNDRY_FEE;
                      } else if (isSneakerLot) {
                        // Match priceLabel: fixed multi-pair price + sneaker fee
                        const sneakerOpt = SNEAKER_MULTI_PRICING.find((o) => o.pairs === (S.sneakerPairCount ?? 3));
                        effectiveTotal = (sneakerOpt?.price ?? 95) + SNEAKER_FEE;
                      } else if (isSneakerService) {
                        // Match priceLabel: service price + sneaker fee, floored at minimum
                        effectiveTotal = Math.max(SNEAKER_MIN + SNEAKER_FEE, effectiveTotal + SNEAKER_FEE);
                      }
                      if (!effectiveTotal || effectiveTotal <= 0) {
                        toast.error('Unable to calculate a price. Please adjust your selections.');
                        return;
                      }

                      // Abort any in-flight request and create a fresh controller.
                      submitAbortRef.current?.abort();
                      submitAbortRef.current = new AbortController();
                      setIsCheckoutLoading(true);

                      try {
                        const res = await fetch('/api/quotes', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          signal: submitAbortRef.current.signal,
                          body: JSON.stringify({
                            customer_name: S.fullName.trim(),
                            customer_email: S.email.trim(),
                            customer_phone: S.phone.trim(),
                            service_type: S.service,
                            context: S.context,
                            scope: S.scope,
                            frequency: S.commFrequency || 'none',
                            analytics_session_id: getPublicAnalyticsSessionId(),
                            submitted_total: effectiveTotal,
                            total: effectiveTotal,
                            service_address: S.address.trim(),
                            // Structured NDIS fields — the API and admin dashboard read these
                            // first and fall back to parsing notes for older quotes.
                            ndis_management_type: isNdisContext ? S.ndisManagementType : null,
                            ndis_forward_contact: isNdisContext ? (S.ndisForwardContactName.trim() || null) : null,
                            ndis_forward_email: isNdisContext ? (ndisForwardEmail || null) : null,
                            ndis_estimated_hours: isNdisContext && ndisHourlyPrice !== null ? effectiveNdisHours : null,
                            ndis_hourly_rate: isNdisContext && ndisHourlyPrice !== null
                              ? ndisRateFor(S.ndisRateSlot, S.ndisRegion)
                              : null,
                            ndis_rate_slot: isNdisContext && ndisHourlyPrice !== null ? S.ndisRateSlot : null,
                            ndis_region: isNdisContext && ndisHourlyPrice !== null ? S.ndisRegion : null,
                            notes: [
                              S.notes || '',
                              S.preferredAvailability?.length
                                ? `Availability: ${S.preferredAvailability.join(', ')}`
                                : '',
                              S.photosOK ? 'Happy to share photos for quoting.' : '',
                              isNdisContext && S.ndisManagementType
                                ? `NDIS management: ${
                                    S.ndisManagementType === 'plan_managed'
                                      ? 'Plan-managed participant'
                                      : S.ndisManagementType === 'self_managed'
                                      ? 'Self-managed participant'
                                      : 'Agency-managed (NDIA) participant'
                                  }`
                                : '',
                              isNdisContext && S.ndisForwardContactName.trim()
                                ? `NDIS forward contact: ${S.ndisForwardContactName.trim()}`
                                : '',
                              isNdisContext && ndisForwardEmail
                                ? `NDIS forward email: ${ndisForwardEmail}`
                                : '',
                              isNdisContext && ndisHourlyPrice !== null
                                ? `NDIS quote: ${effectiveNdisHours} hr × $${ndisRateFor(S.ndisRateSlot, S.ndisRegion).toFixed(2)}/hr (${NDIS_RATE_LABELS[S.ndisRateSlot]} · ${NDIS_REGION_LABELS[S.ndisRegion]} · Price Guide cap)`
                                : '',
                              isNdisContext
                                ? 'NDIS quote flow supported under the Buds At Work x MaluCare partnership.'
                                : '',
                            ].filter(Boolean).join('\n').trim() || '',
                          }),
                        });

                        if (!res.ok) {
                          const errData = await res.json().catch(() => ({}));
                          throw new Error(errData.error || `Error ${res.status}`);
                        }

                        const { quote } = await res.json();

                        if (quote?.id) {
                          const timeToSubmit = step3StartTsRef.current
                            ? Math.round((Date.now() - step3StartTsRef.current) / 1000)
                            : null;
                          const submittedPayload: AnalyticsEventData = {
                            service: S.service,
                            scope: S.scope,
                            value: effectiveTotal,
                            ...(timeToSubmit !== null ? { time_to_submit_seconds: timeToSubmit } : {}),
                          };
                          sendGAEvent('event', 'quote_submitted', submittedPayload);
                          void trackPublicAnalyticsEvent({
                            eventName: 'quote_submitted',
                            quoteId: quote.id,
                            eventValue: effectiveTotal,
                            eventData: submittedPayload,
                            useBeacon: true,
                          });
                          trackQuoteSubmitted(effectiveTotal);

                          // Await profile sync before navigating so it cannot be silently dropped.
                          if (authedUser && saveToProfile) {
                            const profileUpdate: Record<string, string> = {
                              full_name: S.fullName.trim(),
                              phone: S.phone.trim(),
                            };
                            if (S.address.trim()) {
                              profileUpdate.default_address = S.address.trim();
                              if (S.region?.trim()) profileUpdate.region = S.region.trim();
                            }
                            try {
                              await fetch('/api/portal/profile', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(profileUpdate),
                              });
                            } catch (e) {
                              console.warn('[profile-save] failed silently:', e);
                            }
                          }

                          window.location.href = `/services/checkout/success?quote_id=${encodeURIComponent(quote.id)}`;
                        } else {
                          throw new Error('No quote reference returned');
                        }
                      } catch (err) {
                        if (err instanceof Error && err.name === 'AbortError') return;
                        console.error('Quote request error:', err);
                        toast.error(
                          err instanceof Error ? err.message : 'Something went wrong. Please try again.'
                        );
                        setIsCheckoutLoading(false);
                      }
                    }}
                    aria-label="Get my quote"
                  >
                    {isCheckoutLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" />
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      <>
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
                        Get my quote →
                      </>
                    )}
                  </M.button>

                  <M.button
                    className="px-4 py-2 rounded-2xl text-sm font-medium text-slate-700 border border-black/10 bg-white/70 hover:bg-white/90 transition-colors"
                    onClick={() => goToStep(2)}
                    aria-label="Back to Step 2"
                  >
                    ← Back to scope
                  </M.button>
                </div>

                {/* Trust signals */}
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Secure payment
                  </span>
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    No lock-in contracts
                  </span>
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    Local Logan &amp; South Brisbane
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 text-center mt-2 leading-relaxed">
                  By submitting this request you agree to the{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 text-slate-600 hover:text-slate-800"
                  >
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 text-slate-600 hover:text-slate-800"
                  >
                    Privacy Policy
                  </a>{' '}
                  of Buds At Work.
                </p>

                <div className="flex flex-wrap gap-2 mt-3">
                  <S3_Chip>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Insured
                  </S3_Chip>
                  <S3_Chip>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    GST invoice ready
                  </S3_Chip>
                  {S.address ? (
                    <S3_Chip>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                      Address verified
                    </S3_Chip>
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



{/* Live orders strip — positioned further down, visible after completing the flow */}
{!isNdisContext && (
  <section className="mt-20 mb-16">
    <LiveOrdersStrip />
  </section>
)}

{/* Spacer for sticky footers */}
{(S.step === 2 || S.step === 3) && <div className="h-48 md:h-36" />}

{/* ── Sticky quote-summary bar — STEP 3 (mobile-only: sidebar covers desktop) ── */}
{S.step === 3 && (
  <div
    className="lg:hidden fixed left-0 right-0 pointer-events-none z-40"
    style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    aria-live="polite"
    aria-label="Step 3 quote summary"
  >
    <div className="mx-auto max-w-3xl px-4">
      <div
        className={`pointer-events-auto flex items-center justify-between rounded-2xl px-3 py-2.5 gap-3 ${glass}`}
      >
        {/* Quote summary */}
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Your quote</div>
          <div className="text-lg font-bold truncate" style={{ color: 'var(--accent)' }}>
            {priceLabel}
          </div>
          {S.service && (
            <div className="text-[11px] text-slate-500 truncate capitalize">
              {S.service.replace('_', ' & ')}
            </div>
          )}
        </div>
        {/* Back + Submit */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <M.button
            className="px-3 py-1.5 rounded-xl text-sm text-slate-600 border border-black/10 bg-white/70 hover:bg-white/90 transition-colors"
            onClick={() => goToStep(2)}
            aria-label="Back to step 2"
          >
            ← Back
          </M.button>
          <M.button
            className="px-3 py-1.5 rounded-xl text-sm font-semibold text-white shadow-[0_6px_18px_rgba(20,83,45,0.25)]"
            style={{ background: 'var(--accent)' }}
            onClick={() => {
              // Scroll to the submit button in the sidebar
              document.getElementById('step3-submit-btn')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              document.getElementById('step3-submit-btn')?.focus();
            }}
            aria-label="Go to submit"
          >
            Submit quote →
          </M.button>
        </div>
      </div>
    </div>
  </div>
)}

{/* Sticky footer for STEP 2 */}
{S.service !== 'yard' && S.step === 2 && (
  <div
    className="fixed left-0 right-0 pointer-events-none z-40"
    style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    aria-live="polite"
  >
    <div className="mx-auto max-w-3xl px-4">
      <div
        className={`pointer-events-auto rounded-2xl px-3 py-2 md:px-4 md:py-3 ${glass}`}
        role="region"
        aria-label="Step 2 price bar"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] md:text-[11px] uppercase tracking-wide text-slate-500">
              {isNdisContext && S.service === 'cleaning' ? 'Total' : 'Price for this scope'}
            </div>
            <div className="text-xl md:text-2xl font-bold leading-none mt-0.5">{priceLabelBase}</div>
            <div className="text-[11px] md:text-xs text-slate-500 mt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {isNdisContext && S.service === 'cleaning'
                ? `About ${effectiveNdisHours || NDIS_MIN_HOURS} hours`
                : timeLabel}
            </div>
            {!isNdisContext && usesRoutePricing && (
              <div className="hidden md:block text-xs text-slate-500 mt-0.5" aria-live="polite">
                {routeDistanceLabel ??
                  (routeLookupLoading ? 'Calculating travel details…' : 'Add both addresses for travel info.')}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <M.button
              className="h-10 px-4 rounded-2xl text-sm font-medium whitespace-nowrap border border-black/15 bg-white/80 text-slate-700"
              onClick={() => goToStep(1)}
              aria-label="Back to step 1"
            >
              Back
            </M.button>
            <M.button
              className={`h-10 px-4 rounded-2xl text-sm font-medium whitespace-nowrap text-white transition-opacity${!hasMinimumWork ? ' opacity-50 cursor-not-allowed' : ''}`}
              style={{ background: 'var(--accent)' }}
              onClick={() => hasMinimumWork && goToStep(3)}
              aria-label={isNdisContext && S.service === 'cleaning' ? 'Review quote' : 'Get my quote'}
              title={!hasMinimumWork ? 'Configure your service above to continue' : undefined}
            >
              {isNdisContext && S.service === 'cleaning' ? 'Review quote' : 'Get My Quote →'}
            </M.button>
          </div>
        </div>
        <div className={cls('hidden md:block text-[11px] text-slate-500 mt-2 leading-relaxed', isNdisContext && S.service === 'cleaning' && 'md:hidden')}>
          {PRICE_SCOPE_DISCLAIMER} {FAIRNESS_PROMISE_COPY}
        </div>
      </div>
    </div>
  </div>
)}

{S.service === 'yard' && S.step === 2 && (() => {
  const zones = S.yardPolygon ?? [];
  const polygonReady = zones.some((z: any[]) => z.length >= 3);
  const ndisYardAddressReady = !isNdisContext || S.address.trim().length > 0;
  const priceReady = polygonReady && ndisYardAddressReady && (isNdisContext ? ndisHourlyPrice !== null : estimate.total > 0);
  const siteCount = S.yardJobs?.length || 0;
  const zoneCount = zones.filter((z: any[]) => z.length >= 3).length;
  const siteLabel = `${siteCount} site${siteCount === 1 ? '' : 's'} · ${zoneCount} zone${zoneCount !== 1 ? 's' : ''}`;
  const measurementHint = activeMeasurementLabel
    ? `${siteLabel} · ${activeMeasurementLabel}`
    : siteLabel;
  // Price cap detection
  const YARD_SCOPE_MAX: Record<string, number> = {
    yard_mow: 420, yard_hedge: 420, yard_leaves: 420,
    blast_and_shine: 360, gutter_clean: 360,
  };
  const scopeMax = YARD_SCOPE_MAX[S.scope] ?? 420;
  const isAtCap = !isNdisContext && priceReady && estimate.total >= scopeMax;
  // Large-property warning: when area/perimeter exceeds one-visit threshold
  const YARD_VISIT_MAX_M2: Partial<Record<string, number>> = {
    yard_mow: 3000, yard_leaves: 2000, blast_and_shine: 800,
  };
  const YARD_VISIT_MAX_M: Partial<Record<string, number>> = {
    yard_hedge: 220, gutter_clean: 160,
  };
  const isPerimeterScope = S.scope === 'yard_hedge' || S.scope === 'gutter_clean';
  const measurement = isPerimeterScope ? (S.yardPerimeter ?? 0) : (S.yardArea ?? 0);
  const visitCap = isPerimeterScope ? (YARD_VISIT_MAX_M[S.scope] ?? null) : (YARD_VISIT_MAX_M2[S.scope] ?? null);
  const isLargeProperty = visitCap !== null && measurement > visitCap;
  const unit = isPerimeterScope ? 'm' : 'm²';
  const numVisits = isLargeProperty ? Math.ceil(measurement / visitCap!) : 1;
  const perVisitMeasurement = isLargeProperty ? measurement / numVisits : measurement;
  const perVisitParams = isPerimeterScope
    ? { ...S.paramsByService.yard, yard_perimeter: perVisitMeasurement }
    : { ...S.paramsByService.yard, yard_area: perVisitMeasurement };
  const perVisitQuote = !isNdisContext && isLargeProperty
    ? computeYardQuote(perVisitParams, {
        scope: S.scope,
        conditionMultiplier: conditionMult,
        accessTight: S.clutterAccess,
        conditionLevel: S.conditionLevel,
      })
    : null;
  const multiVisitTotal = perVisitQuote ? perVisitQuote.cost * numVisits : null;
  return (
    <div
      className="fixed left-0 right-0 pointer-events-none z-40"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      aria-live="polite"
    >
      <M.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-3xl px-4 space-y-2"
      >
        {/* Large property — multi-visit pricing */}
        {!isNdisContext && isLargeProperty && priceReady && perVisitQuote && (
          <div className="pointer-events-auto rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900 shadow-lg">
            <div className="font-semibold mb-0.5">Large property — {numVisits} visits recommended</div>
            <div className="text-blue-800">
              ~{Math.round(perVisitMeasurement).toLocaleString()}{unit} per visit
              · {fmtAUD(perVisitQuote.cost)}/visit
              · <span className="font-semibold">Total {fmtAUD(multiVisitTotal!)}</span>
            </div>
          </div>
        )}
        <div
          className="pointer-events-auto rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl"
          role="region"
          aria-label="Yard mapping price bar"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  {isNdisContext ? 'Total' : 'Price for this scope'}
                </div>
                {isCalculating && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 border border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] text-blue-600 font-medium">Updating</span>
                  </div>
                )}
                {isAtCap && !isLargeProperty && !isCalculating && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    Max price reached
                  </span>
                )}
              </div>
              <div className="text-3xl font-semibold text-slate-900" aria-live="polite">
                {priceReady ? priceLabel : polygonReady && !ndisYardAddressReady ? 'Search address to set region' : 'Draw a zone to reveal price'}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                {polygonReady && !ndisYardAddressReady
                  ? 'Use the map address search so MMM can set the NDIS rate band.'
                  : isNdisContext && priceReady
                    ? `About ${effectiveNdisHours || NDIS_MIN_HOURS} hours · ${NDIS_REGION_LABELS[S.ndisRegion]}`
                  : isAtCap && !isLargeProperty
                  ? `Max for this service — we'll honour this price regardless of area.`
                  : isLargeProperty && priceReady
                    ? `Price per visit · ${numVisits} visits recommended`
                    : priceReady ? measurementHint : 'Tap "Draw" on the map above and outline your area.'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <M.button
                className="px-4 py-2 rounded-2xl text-sm font-semibold border border-black/15 bg-white/80 text-slate-700"
                onClick={() => goToStep(1)}
                aria-label="Back to step 1"
              >
                Back
              </M.button>
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

      {/* Quote Assistant — floating trigger + slide-in panel */}
      <QuoteAssistantTrigger
        onOpen={assistant.handlers.onOpen}
        visible={!assistant.open && !assistant.dismissed && !hasInteractedStep2 && S.step === 1}
        context={S.context}
      />
      <QuoteAssistantPanel assistant={assistant} />
    </MotionContext.Provider>
  );
}

// Loading fallback for Suspense
function ServicesPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent" />
        <p className="mt-4 text-slate-600">Loading services...</p>
      </div>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function ServicesPage() {
  return (
    <Suspense fallback={<ServicesPageLoading />}>
      <ServicesPageContent />
    </Suspense>
  );
}
