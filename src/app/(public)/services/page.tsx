'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { sendGAEvent } from '@next/third-parties/google';
import { trackQuoteSubmitted } from '@/lib/analytics/conversions';
import {
  captureLeadAttribution,
  getLeadAttribution,
  getPublicAnalyticsSessionId,
  trackPublicAnalyticsEvent,
} from '@/lib/analytics/public';
import { trackFunnelStart, trackFunnelStepComplete, trackFunnelAbandon, trackFunnelSubmit } from '@/lib/analytics/behavior';
import { trackFunnelEvent } from '@/lib/analytics/quote-funnel';
import type { AnalyticsEventData } from '@/lib/analytics/shared';
import { SMALL_JOB_PAYMENT_COPY } from '@/lib/payments/pricing';
import StableMapSlot from '@/components/StableMapSlot';
import YardZonesPreview from '@/components/YardZonesPreview';
import {
  usePolygonQuote,
  computeAreaFromPath,
  computePerimeterFromPath,
} from '@/app/ui/yard/usePolygonQuote';
import dynamic from 'next/dynamic';
import { serializeLayout } from '@/app/ui/floor/utils';
import { computeFloorPricing } from '@/app/ui/floor/useFloorPricing';
import { useCarModelSelector } from '@/app/ui/car/useCarModelSelector';

const FloorPlanBuilder = dynamic(() => import('@/app/ui/floor/FloorPlanBuilder'), { ssr: false });
import type { VehicleSizeCategory } from '@/lib/rego/types';
import { useYardMapping } from '@/app/hooks/useYardMapping';
// Loaded lazily — only when the user reaches the contact form (step 3).
const QuoteAuthGate = dynamic(() => import('@/components/QuoteAuthGate').then(m => ({ default: m.QuoteAuthGate })), { ssr: false });

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
  MmmDetectionState,
  MmmApiResponse,
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

import { useRouteResult } from './lib/hooks/useRouteResult';

// Extracted modules - Shared UI Components
import { Tile, glassCard, CommSqmSlider, NumberStepper } from './components/shared/UIComponents';
import { type ScopeCardProps, type RouteSlot, type LaundrySlot } from './components/shared/ScopeCard.types';
import { ScopeCard } from './components/shared/ScopeCard';

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
  ACCESS_TOGGLES,
  COMM_FEATURES,
  COMM_STANDARDS,
  COMM_PRESETS,
  NDIS_ACCENT,
  CONTEXT_OPTIONS,
  CONTEXT_LABELS,
  RESIDENTIAL_CLEANING_SCOPE_LABELS,
  NDIS_MANAGEMENT_OPTIONS,
  RECOMMENDED,
  isRec,
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
import { getInitialState, wizardReducer, useLocalStorageReducer, migrateState } from './lib/wizard-state';

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
  cleaningAddonsForScope,
  cleaningParamsForScope,
  computeMins,
  winSessionMinutes,
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

// Module-level constants — pure static data, hoisted out of the render IIFE so they
// are allocated once per module load rather than on every Step 2 render.

// NDIS caps, min/max hours, and suggestion helpers now live in
// lib/pricing/ndis.ts so the Quote Assistant can share the same source of truth.

const YARD_SIZE_BUCKETS = [
  { label: 'Small courtyard', areaM2: 50 },
  { label: 'Suburban block', areaM2: 400 },
  { label: 'Large block', areaM2: 800 },
  { label: 'Acreage', areaM2: 2000 },
] as const;


function ServicesPageContent() {
  const searchParams = useSearchParams();
  // True only when the user is navigating within an active wizard session (e.g. browser
  // back/forward within the steps). False on any fresh entry to the page (link click, new
  // tab, re-visit after navigating away). Checked synchronously so useLocalStorageReducer
  // can skip its restore before the first render, avoiding a flash of old state.
  const [restoreSession] = useState(() =>
    typeof window !== 'undefined' && sessionStorage.getItem('svc:session') === '1'
  );
  const [S, dispatch] = useLocalStorageReducer<WizardState>(
    STORAGE_KEY,
    wizardReducer,
    getInitialState,
    restoreSession,
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
  // Lead prefill — set when admin opens the wizard from Mission Control.
  // Only the lead UUID travels in the URL; PII is fetched server-side.
  const leadIdParam = searchParams?.get('lead_id') ?? null;
  const [quoteLeadId, setQuoteLeadId] = useState<string | null>(null);
  const [quoteLeadSource, setQuoteLeadSource] = useState<string | null>(null);
  const leadPrefillDoneRef = useRef(false);
  // Detect rebook mode from URL before params are cleared (read once at mount).
  const [isRebook] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('rebook')
  );
  usePolygonQuote();
  const carSelector = useCarModelSelector();
  const { carType: carSelectorType, dirtLevel: carSelectorDirt, zones: carSelectorZones, derived: carSelectorDerived, setCarType: carSelectorSetType, setDirtLevel: carSelectorSetDirt, toggleZone: carSelectorToggleZone } = carSelector;
  const [isClient, setIsClient] = useState(false);
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
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [guestSubmitSuccess, setGuestSubmitSuccess] = useState<{ quoteId: string; email: string } | null>(null);
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

  // Capture lead attribution (utm_*, referrer, landing path) on first mount.
  // Idempotent — first-touch wins. The /api/quotes route reads these out of
  // the submit payload to set quotes.source via resolveLeadSource().
  useEffect(() => {
    captureLeadAttribution();
  }, []);

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

  // --- Funnel instrumentation refs (no state — never cause re-renders) ---
  // Timestamp of when the active scope card was last opened.
  const configOpenTsRef = useRef<number | null>(null);
  // Per-scope count of wizard-param mutations while that card is open.
  const configChangesRef = useRef<Record<string, number>>({});
  // Serialised snapshot of config state at last check — used to detect diffs.
  const prevConfigRef = useRef<string>('');
  // Current-value mirrors updated every render — lets tracking effects read
  // the latest service/context without listing them as effect dependencies
  // (which would re-trigger card_expanded / config_started on unrelated changes).
  const funnelServiceRef = useRef(S.service);
  funnelServiceRef.current = S.service;
  const funnelContextRef = useRef(S.context);
  funnelContextRef.current = S.context;

  // Fire card_expanded when a scope card opens; reset tracking state when it closes.
  useEffect(() => {
    if (!activeServiceId) {
      prevConfigRef.current = '';
      configOpenTsRef.current = null;
      return;
    }
    configOpenTsRef.current = Date.now();
    configChangesRef.current[activeServiceId] = 0;
    prevConfigRef.current = '';
    trackFunnelEvent('card_expanded', {
      service: funnelServiceRef.current,
      scope: activeServiceId,
      context: funnelContextRef.current,
    });
  }, [activeServiceId]);

  // Detect wizard-param mutations while a card is open.
  // Fires config_started on the first change; increments change counter on each.
  useEffect(() => {
    if (!activeServiceId) return;
    const fingerprint = JSON.stringify([
      S.paramsByService,
      S.cleaningAddons,
      S.commercialCleaningType,
      S.commPreset,
      S.commFrequency,
      S.winRows,
      S.dumpRun,
      S.dumpDelivery,
      S.dumpTransport,
      S.distanceKm,
      S.laundryLoads,
      S.laundryPerLoadAddOns,
      S.laundryPerOrderAddOns,
      S.laundryIroningItems,
      S.sneakerTier,
      S.sneakerPairCount,
      S.sneakerTurnaround,
      S.conditionLevel,
      S.yardArea,
    ]);
    if (!prevConfigRef.current) {
      // First run for this card open — establish baseline, don't count as a change.
      prevConfigRef.current = fingerprint;
      return;
    }
    if (prevConfigRef.current === fingerprint) return;
    prevConfigRef.current = fingerprint;
    const prev = configChangesRef.current[activeServiceId] ?? 0;
    configChangesRef.current[activeServiceId] = prev + 1;
    if (prev === 0) {
      trackFunnelEvent('config_started', {
        service: funnelServiceRef.current,
        scope: activeServiceId,
        context: funnelContextRef.current,
      });
    }
  }, [
    activeServiceId,
    S.paramsByService, S.cleaningAddons, S.commercialCleaningType, S.commPreset, S.commFrequency,
    S.winRows, S.dumpRun, S.dumpDelivery, S.dumpTransport, S.distanceKm,
    S.laundryLoads, S.laundryPerLoadAddOns, S.laundryPerOrderAddOns, S.laundryIroningItems,
    S.sneakerTier, S.sneakerPairCount, S.sneakerTurnaround,
    S.conditionLevel, S.yardArea,
  ]);

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
        trackFunnelAbandon(S.step, S.service ?? undefined, missing.join(',') || 'none');
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
  const { result: routeLookup, loading: routeLookupLoading, message: routeLookupMessage } =
    useRouteResult(S.dumpRoutePickup, S.dumpRouteDropoff, routeCardActive);
  useEffect(() => {
    set('distanceKm', routeLookup?.distanceKm ?? 0);
  }, [routeLookup, set]);
  const normalizedStep = Number(S.step);
  const yardStep2 = yardActive && normalizedStep === 2;
  const mapVisible = yardStep2;

  const [isDesktop, setIsDesktop] = React.useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false
  );
  const [headerH, setHeaderH] = React.useState(72);

  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const fn = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  React.useEffect(() => {
    // Yard step 2 always uses the inline (fixed) layout — match the body-scroll lock to that.
    const usesInline = mapVisible && isDesktop;
    if (usesInline) {
      setHeaderH(document.querySelector('header')?.getBoundingClientRect().height ?? 72);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mapVisible, isDesktop]);

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
  const activePolygonMeasurement =
    yardMeasurementConfig.mode === 'perimeter'
      ? activeYardZones.reduce((sum, zone) => sum + computePerimeterFromPath(zone), 0)
      : activeYardZones.reduce((sum, zone) => sum + computeAreaFromPath(zone), 0);
  const activeMeasurementValue =
    activePolygonMeasurement === 0 && yardMeasurementConfig.mode === 'area' && S.manualYardAreaM2
      ? S.manualYardAreaM2
      : activePolygonMeasurement;
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

  // Fire once on mount — provides the funnel entry baseline in GA4 + PostHog.
  useEffect(() => {
    trackQuoteEvent('quote_start', { context: S.context });
    trackFunnelStart(S.context);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Session tracking: mark that the user is actively mid-wizard once they pass step 1.
  // The flag lives in sessionStorage (per-tab, cleared on tab close).
  useEffect(() => {
    if (S.step > 1) {
      try { sessionStorage.setItem('svc:session', '1'); } catch {}
    }
  }, [S.step]);

  // Clear the session flag when the user navigates away from this page so that
  // a fresh re-entry (clicking the link from home, new tab, etc.) always starts
  // from step 1 rather than restoring a stale quote.
  useEffect(() => {
    return () => {
      try { sessionStorage.removeItem('svc:session'); } catch {}
    };
  }, []);

  // Browser back button support within the wizard.
  // Push a history entry whenever the step advances so the back button returns
  // to the previous step instead of leaving the services page entirely.
  const prevStepRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevStepRef.current === null) {
      // First run: tag the current history entry with the initial step so that
      // pressing back from step 1 navigates away naturally.
      window.history.replaceState({ ...window.history.state, wizardStep: S.step }, '');
    } else if (S.step > prevStepRef.current) {
      window.history.pushState({ ...window.history.state, wizardStep: S.step }, '');
    }
    prevStepRef.current = S.step;
  // S.step change is the only trigger; window.history.state is read live
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.step]);

  // Handle browser back/forward within the wizard.
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const targetStep = e.state?.wizardStep;
      if (typeof targetStep === 'number' && targetStep >= 1 && targetStep <= 3) {
        dispatch({ type: 'set', key: 'step', value: targetStep });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dispatch]);

  // On mount: pre-fill contact fields for already-signed-in users, then prompt
  // to resume if there is meaningful quote progress in localStorage.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        // Unauthenticated fresh visit: wipe any stale quote so the next re-entry
        // also starts clean. Skip if we're in an active session (browser back/forward).
        if (!restoreSession) {
          try { localStorage.removeItem(STORAGE_KEY); } catch {}
        }
        return;
      }

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
        const stepLabel = parsed.step === 3 ? 'Step 3 (contact)'
          : parsed.step === 2 ? 'Step 2 (details)'
          : 'in progress';
        const ctxLabel = parsed.context ? ` · ${parsed.context}` : '';
        if (!restoreSession) {
          // Fresh re-entry: state was NOT auto-restored. Let the user choose to resume.
          toast('Quote in progress', {
            description: `Resume where you left off — ${stepLabel}${ctxLabel}.`,
            duration: 10_000,
            action: {
              label: 'Resume',
              onClick: () => {
                try {
                  dispatch({ type: 'merge', value: migrateState(JSON.parse(raw)) });
                } catch {}
              },
            },
            cancel: { label: 'Start fresh', onClick: () => {
              try { localStorage.removeItem(STORAGE_KEY); } catch {}
            }},
          });
        } else {
          // In-session (e.g. hard-refresh mid-wizard): state already restored.
          toast('Quote resumed', {
            description: `Picked up where you left off — ${stepLabel}${ctxLabel}.`,
            duration: 8_000,
            action: { label: 'Got it', onClick: () => {} },
            cancel: { label: 'Start fresh', onClick: () => hardResetQuote(true) },
          });
        }
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
      trackFunnelStepComplete(1, S.service ?? undefined);
    }

    if (n === 3) {
      trackQuoteEvent('quote_step_3', { service: S.service, scope: S.scope });
      trackFunnelStepComplete(2, S.service ?? undefined);
    }

    set('step', n);
  };

  const selectService = (svc: ServiceType) => {
    trackQuoteEvent('service_selected', { service: svc, context: S.context });
    trackFunnelEvent('service_selected', { service: svc, context: S.context });
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
      // Clear URL parameter to prevent re-triggering. IMPORTANT: preserve the
      // existing history state (which carries our wizardStep marker), otherwise
      // we wipe out the back-navigation breadcrumbs the popstate handler relies
      // on — browser-back from a later step would then silently leave the page.
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('service');
        window.history.replaceState({ ...window.history.state }, '', url.pathname);
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

    // Strip rebook params from URL. Preserve existing history.state so the
    // wizardStep marker survives — see the matching note in the URL-service
    // handler above; without this, browser-back from step 3 skips step 2.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('rebook');
      url.searchParams.delete('context');
      url.searchParams.delete('scope');
      url.searchParams.delete('notes');
      window.history.replaceState(
        { ...window.history.state },
        '',
        url.pathname + (url.search || '')
      );
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
            yard_area: S.yardArea ?? S.manualYardAreaM2 ?? (S.paramsByService[S.service] as any)?.yard_area,
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
    S.manualYardAreaM2,
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
      case 'yard': {
        const isAreaScope = S.scope !== 'yard_hedge' && S.scope !== 'gutter_clean';
        const hasPolygons =
          (S.yardJobs?.length ?? 0) > 0 &&
          (S.yardJobs ?? []).every((job: { polygon_geojson?: unknown[][] }) =>
            (job.polygon_geojson ?? []).some((z) => z.length >= 3)
          );
        const hasFallbackArea =
          isAreaScope && (S.manualYardAreaM2 ?? 0) > 0 && (S.yardJobs?.length ?? 0) <= 1;
        return (!isNdisMmmEligible || S.address.trim().length > 0) && (hasPolygons || hasFallbackArea);
      }
      case 'auto':
        return !!S.carModelType;
      case 'dump':
        return !!(S.dumpRun ?? S.dumpDelivery ?? S.dumpTransport);
      case 'laundry_sneakers':
        return (S.laundryLoads ?? 0) >= 1;
      default:
        return hasWork;
    }
  }, [S.service, S.scope, S.address, S.winRows, S.yardJobs, S.manualYardAreaM2, S.carModelType, S.dumpRun, S.dumpDelivery, S.dumpTransport, S.laundryLoads, hasWork, isNdisMmmEligible]);

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

  // Lead prefill — fires once after client hydration when lead_id is in the URL.
  // Fetches name/email/phone/service from the admin-only lead endpoint.
  // Falls back silently if the caller is not an admin or the lead does not exist.
  const LEAD_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const VALID_LEAD_SERVICES = new Set<string>(['windows', 'cleaning', 'yard', 'dump', 'auto', 'laundry_sneakers']);
  useEffect(() => {
    if (!isClient || leadPrefillDoneRef.current) return;
    if (!leadIdParam || !LEAD_UUID_RE.test(leadIdParam)) return;
    leadPrefillDoneRef.current = true;
    void fetch(`/api/leads/${leadIdParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: {
        lead?: {
          customer_name: string | null;
          customer_email: string | null;
          customer_phone: string | null;
          service_type: string | null;
          source: string;
        };
      } | null) => {
        if (!data?.lead) return;
        const { lead } = data;
        setQuoteLeadId(leadIdParam);
        setQuoteLeadSource(lead.source ?? null);
        const { fullName, email, phone } = wizardContactRef.current;
        const prefill: Partial<WizardState> = {};
        if (!fullName.trim() && lead.customer_name) prefill.fullName = lead.customer_name;
        if (!email.trim() && lead.customer_email) prefill.email = lead.customer_email;
        if (!phone.trim() && lead.customer_phone) prefill.phone = lead.customer_phone;
        if (lead.service_type && VALID_LEAD_SERVICES.has(lead.service_type)) {
          prefill.service = lead.service_type as ServiceType;
        }
        if (Object.keys(prefill).length > 0) dispatch({ type: 'merge', value: prefill });
      })
      .catch(() => {}); // non-admin session or invalid lead — silent ignore
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

  // Ensure at least one yard job exists
  useEffect(() => {
    if (S.yardJobs && S.yardJobs.length > 0) return;
    set('yardJobs', [createYardJob()]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.yardJobs]);


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
        ? { ...S.paramsByService.yard, yard_area: S.yardArea ?? S.manualYardAreaM2 ?? S.paramsByService.yard?.yard_area }
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
      S.manualYardAreaM2,
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
const routeSlot = useMemo<RouteSlot>(() => ({
  expanded: routeExpanded,
  setExpanded: setRouteExpanded,
  transportExpanded: transportRouteExpanded,
  setTransportExpanded: setTransportRouteExpanded,
  lookup: routeLookup,
  loading: routeLookupLoading,
  message: routeLookupMessage,
  distanceLabel: routeDistanceLabel,
  onFocusChange: handleDistanceInputFocusChange,
  onPlaceSelected: handleDistancePlaceSelected,
}), [routeExpanded, transportRouteExpanded, routeLookup, routeLookupLoading, routeLookupMessage, routeDistanceLabel]);
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

  const laundrySlot = useMemo<LaundrySlot>(() => ({
    ironingOpen: laundryIroningOpen,
    setIroningOpen: setLaundryIroningOpen,
    addOnTotal: laundryAddOnTotal,
    priceLabel: priceLabelBase,
    isTurnaroundAvailable: isSneakerTurnaroundAvailable,
  }), [laundryIroningOpen, laundryAddOnTotal, priceLabelBase, isSneakerTurnaroundAvailable]);

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

/* =========================
   Typical minutes per scope
   ========================= */
/* =========================
   UI
   ========================= */

  const handleSubmitQuote = async (isGuest = false, guestToken = '') => {
    const normalisedPhone = S.phone.replace(/\D+/g, '').replace(/^61/, '0');
    const ndisForwardEmail = S.ndisForwardEmail.trim().toLowerCase();
    const hasValidNdisForwardEmail =
      !ndisForwardEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ndisForwardEmail);
    // Yard jobs with all polygons drawn don't require a typed address (polygon defines the site).
    // NDIS yard jobs still require an address for MMM region detection.
    const yardHasAllPolygons =
      S.service === 'yard' &&
      !isNdisContext &&
      (S.yardJobs ?? []).length > 0 &&
      (S.yardJobs ?? []).every(
        (job: { polygon_geojson?: unknown[][] }) =>
          (job.polygon_geojson ?? []).some((z: unknown[]) => z.length >= 3)
      );
    const okInputs =
      S.fullName?.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email || '') &&
      normalisedPhone.length >= 10 &&
      (yardHasAllPolygons || S.address.trim().length > 0) &&
      (!isNdisContext || !!S.ndisManagementType) &&
      hasValidNdisForwardEmail;

    if (!okInputs) {
      const missingFields = [
        (!S.fullName?.trim() || S.fullName.trim().length < 2) && 'name',
        !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email || '')) && 'email',
        normalisedPhone.length < 10 && 'phone',
        (!yardHasAllPolygons && !S.address.trim()) && 'address',
        (isNdisContext && !S.ndisManagementType) && 'ndis_management',
        (isNdisContext && !hasValidNdisForwardEmail) && 'ndis_forward_email',
      ].filter(Boolean).join(',');
      trackQuoteEvent('quote_step3_submit_failed', { service: S.service, scope: S.scope, missing_fields: missingFields });
      toast.error(
        isNdisContext
          ? 'Please complete your details, service address, and NDIS routing fields.'
          : yardHasAllPolygons
          ? 'Please complete your name, email, and phone number.'
          : 'Please complete your details and confirm your service address.'
      );
      const firstInvalid =
        (!S.fullName?.trim() || S.fullName.trim().length < 2) ? 's3-fullname'
        : !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email || '')) ? 's3-email'
        : normalisedPhone.length < 10 ? 's3-phone'
        : (!yardHasAllPolygons && !S.address.trim()) ? 's3-service-address'
        : isNdisContext && !S.ndisManagementType ? 's3-ndis-routing'
        : isNdisContext && !hasValidNdisForwardEmail ? 's3-ndis-forward-email'
        : null;
      if (firstInvalid) {
        document.getElementById(firstInvalid)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById(firstInvalid)?.focus();
      }
      return;
    }

    let effectiveTotal = scopedPricing?.price ?? estimate.total;
    if (ndisHourlyPrice !== null) {
      effectiveTotal = ndisHourlyPrice;
    }
    if (isLaundryService) {
      const laundryBase = Math.max(LAUNDRY_MIN, laundryLoads * 30) + laundryAddOnTotal;
      effectiveTotal = laundryBase + LAUNDRY_FEE;
    } else if (isSneakerLot) {
      const sneakerOpt = SNEAKER_MULTI_PRICING.find((o) => o.pairs === (S.sneakerPairCount ?? 3));
      effectiveTotal = (sneakerOpt?.price ?? 95) + SNEAKER_FEE;
    } else if (isSneakerService) {
      effectiveTotal = Math.max(SNEAKER_MIN + SNEAKER_FEE, effectiveTotal + SNEAKER_FEE);
    }
    if (!effectiveTotal || effectiveTotal <= 0) {
      toast.error('Unable to calculate a price. Please adjust your selections.');
      return;
    }

    submitAbortRef.current?.abort();
    submitAbortRef.current = new AbortController();
    setIsCheckoutLoading(true);

    // First-touch attribution captured on landing. Server resolves this to
    // a LeadSource via resolveLeadSource() — missing fields just fall back
    // to the 'website' default.
    const attribution = getLeadAttribution();

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
          utm_source: attribution?.utm_source ?? null,
          utm_medium: attribution?.utm_medium ?? null,
          utm_campaign: attribution?.utm_campaign ?? null,
          referrer: attribution?.referrer ?? null,
          landing_path: attribution?.landing_path ?? null,
          ...(isGuest && guestToken ? { turnstileToken: guestToken } : {}),
          ...(quoteLeadId ? { lead_id: quoteLeadId, lead_src: quoteLeadSource } : {}),
          submitted_total: effectiveTotal,
          total: effectiveTotal,
          service_address: S.address.trim(),
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
            S.service === 'yard' && yardMeasurementConfig.mode === 'area' && (S.yardArea ?? S.manualYardAreaM2)
              ? `Yard area: ~${Math.round((S.yardArea ?? S.manualYardAreaM2) ?? 0)} sqm${yardHasAllPolygons ? ' (polygon-measured)' : ' (self-estimated)'}`
              : '',
            S.service === 'yard' && yardMeasurementConfig.mode === 'perimeter' && (S.yardPerimeter ?? 0) > 0
              ? `Perimeter: ~${Math.round(S.yardPerimeter ?? 0)} m (polygon-measured)`
              : '',
            S.service === 'yard' && yardHasAllPolygons && !S.address.trim()
              ? `No typed address — location defined by satellite polygon (${(S.yardJobs ?? []).length} zone${(S.yardJobs ?? []).length !== 1 ? 's' : ''})`
              : '',
          ].filter(Boolean).join('\n').trim() || '',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || `Error ${res.status}`);
      }

      const { quote } = await res.json() as { quote: { id: string } };

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
        trackFunnelSubmit(quote.id, S.service ?? undefined, effectiveTotal);
        trackFunnelEvent('quote_submitted', {
          service: S.service,
          scope: S.scope,
          context: S.context,
          quote_submitted: true,
        });

        if (isGuest) {
          setGuestSubmitSuccess({ quoteId: quote.id, email: S.email.trim() });
          setIsCheckoutLoading(false);
          return;
        }

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

        window.location.href = `/portal/quotes?new=${encodeURIComponent(quote.id)}`;
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
  };

  function renderPriceBreakdown() {
    if (S.service === 'dump' && (S.scope === 'dump_transport' || S.scope === 'dump_delivery')) {
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
          <div className="text-[11px] text-slate-500 mt-1">Transparent pricing — no hidden fees.</div>
          <div className="text-[11px] text-slate-500">Large or long-distance jobs may require a custom quote.</div>
        </>
      );
    }

    if (isNdisContext && S.service === 'cleaning' && ndisHourlyPrice !== null) {
      const rate = ndisRateFor(S.ndisRateSlot, S.ndisRegion);
      const hours = effectiveNdisHours || NDIS_MIN_HOURS;
      const fmtHours = (h: number) =>
        Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/\.?0+$/, '');
      return (
        <>
          <div className="text-[11px] font-medium text-slate-700 mb-1">Price breakdown</div>
          <S3_Row k="Estimated hours" v={`${fmtHours(hours)} hr`} />
          <S3_Row k={`Rate · ${NDIS_RATE_LABELS[S.ndisRateSlot]}`} v={`${fmtAUD(rate)}/hr`} />
          <S3_Row k="Region" v={NDIS_REGION_LABELS[S.ndisRegion]} />
          <div className="h-[1px] bg-white/60 my-2" />
          <S3_Row k="Subtotal" v={fmtAUD(Math.round(hours * rate))} />
          <S3_Row k="Total" v={priceLabel} bold />
          <div className="mt-2 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-[11px] text-violet-900">
            <span className="font-semibold">Hourly billing.</span>{' '}
            We log time on-site so your plan is only charged for actual delivered hours.
            Quarter-hour units, capped at the NDIS Price Guide rate.
          </div>
          <div className="text-[11px] text-slate-600 mt-2">{FAIRNESS_PROMISE_COPY}</div>
        </>
      );
    }

    const mats = S.service === 'cleaning' ? (S.context === 'commercial' ? 12 : 8) : 0;
    return (
      <>
        {estimate.labourFloor ? <S3_Row k="Time minimum" v={fmtAUD(estimate.labourFloor)} /> : null}
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
        {estimate.travel > 0 && <S3_Row k="Travel" v={fmtAUD(estimate.travel)} />}
        {estimate.parking > 0 && <S3_Row k="Parking" v={fmtAUD(estimate.parking)} />}
        {estimate.tip > 0 && <S3_Row k="Tip" v={fmtAUD(estimate.tip)} />}
        {mats > 0 && <S3_Row k="Materials" v={fmtAUD(mats)} />}
        <div className="h-[1px] bg-white/60 my-2" />
        <S3_Row k="Total" v={priceLabel} bold />
        <div className="text-[11px] text-slate-600">{PRICE_SCOPE_DISCLAIMER}</div>
        <div className="text-[11px] text-slate-600">{FAIRNESS_PROMISE_COPY}</div>
      </>
    );
  }

  return (
    <MotionContext.Provider value={motionEnabled}>
      <div
        className="relative text-black"
        data-yard-active={yardActive ? '' : undefined}
        style={{ ['--accent' as any]: ACCENT }}
      >

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
            <section className={cls('mb-12', S.service === 'yard' && 'hidden')}>
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

                {/* New-user tap hint — visible only on step 1 */}
                <div className="flex items-center gap-2 mb-4 px-1">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                    style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 11V7a3 3 0 0 1 6 0v4" />
                      <path d="M9 11H5l1 9h12l1-9h-4" />
                    </svg>
                    Tap a card to choose your service
                  </span>
                </div>

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
                              tapHint
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
                      !isDesktop ? (
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
                      ) : null
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
                    {/* Scope cards (primary + more options) — only add top spacing when a
                        heading is rendered above. For yard on desktop the heading is null,
                        so any mt-* here would push the cards out of alignment with the
                        map's search bar (which sits 16px from the iframe top). */}
                    <div className={cls(
                      'space-y-6',
                      !(S.service === 'yard' && isDesktop) && 'mt-4'
                    )}>
                      {S.service !== 'yard' && !hasInteractedStep2 && (
                        <p className="flex items-center gap-1.5 text-[12px] font-medium text-slate-600 select-none -mb-3">
                          <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-emerald-600">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 8v4M12 16h.01" />
                          </svg>
                          Tip: tap a service card to see everything included.
                        </p>
                      )}
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
                            const _funnelTimeSpent = configOpenTsRef.current !== null
                              ? Math.round((Date.now() - configOpenTsRef.current) / 1000)
                              : null;
                            trackFunnelEvent('add_to_quote', {
                              service: S.service,
                              scope: key,
                              context: S.context,
                              time_spent_seconds: _funnelTimeSpent,
                              config_changes: configChangesRef.current[activeServiceId ?? key] ?? 0,
                            });
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
                                routeSlot={routeSlot}
                                laundrySlot={laundrySlot}
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

        // Shared JSX fragments reused in both mobile and desktop layouts
        const mapIframe = (
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
        );
        const calculatingOverlay = isCalculating ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 px-6 py-4 bg-white rounded-2xl border border-emerald-200 shadow-2xl">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-emerald-900 font-semibold">Calculating area & pricing...</span>
            </div>
          </div>
        ) : null;
        const ndisCard = isNdisContext ? (
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
        ) : null;
        const scopeTabs = !isNdisContext ? (
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
        ) : null;
        // Compute price readiness for the desktop dock
        const yardZonesLocal = S.yardPolygon ?? [];
        const polygonReadyLocal = yardZonesLocal.some((z: any[]) => z.length >= 3);
        const ndisAddressReadyLocal = !isNdisContext || S.address.trim().length > 0;
        const priceReadyLocal = polygonReadyLocal && ndisAddressReadyLocal && (isNdisContext ? ndisHourlyPrice !== null : estimate.total > 0);

        const hasZones = (activeYardJob?.polygon_geojson ?? []).some((z: any[]) => z.length >= 3);
        const clearZonesBtn = hasZones ? (
          <M.button
            className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
            onClick={resetActivePolygon}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Clear zones
          </M.button>
        ) : null;
        const instructionText = (
          <div className="text-[11px] leading-snug text-slate-500 px-1">
            Search your address, tap <strong>Draw</strong>, outline your yard, then tap <strong>Done</strong>.
          </div>
        );
        const yardSizeFallback = !hasZones && yardMeasurementConfig.mode === 'area' ? (
          <div className="mt-3 px-1">
            <div className="text-[11px] font-medium text-slate-400 mb-2">Or pick a size estimate</div>
            <div className="grid grid-cols-2 gap-1.5">
              {YARD_SIZE_BUCKETS.map((b) => (
                <button
                  key={b.areaM2}
                  type="button"
                  onClick={() => {
                    set('manualYardAreaM2', b.areaM2);
                    set('yardArea', b.areaM2);
                  }}
                  className={cls(
                    'px-2.5 py-2 rounded-xl border text-[11px] font-medium text-left transition-colors',
                    S.manualYardAreaM2 === b.areaM2
                      ? 'border-[color:var(--accent)] bg-[color:var(--accent)]/5 text-[color:var(--accent)]'
                      : 'border-black/10 text-slate-600 hover:border-slate-300 bg-white/60'
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        ) : null;
        const sitesWidget = (S.yardJobs?.length ?? 0) <= 1 ? (
          <button
            type="button"
            onClick={addYardJob}
            className="self-start flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-900 transition-colors px-1"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add another location
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {(S.yardJobs || []).map((job, idx) => {
              const hasAddress = job.address && job.address.trim();
              const label = hasAddress ? job.address : `Site ${idx + 1}`;
              const isActive = job.job_id === activeYardJob?.job_id;
              return (
                <div key={job.job_id} className="group relative flex items-center gap-1">
                  <button
                    type="button"
                    className={cls(
                      'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-200',
                      isActive ? 'bg-emerald-600 text-white shadow-md' : 'border border-black/10 bg-white text-slate-700 hover:border-emerald-300'
                    )}
                    onClick={() => set('yardActiveJobId', job.job_id)}
                  >
                    <span className="max-w-[140px] truncate">{label}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    className="opacity-0 group-hover:opacity-100 w-4 h-4 rounded-full flex items-center justify-center text-rose-500 hover:text-white hover:bg-rose-500 border border-rose-200 transition-all text-xs leading-none"
                    onClick={(e) => { e.stopPropagation(); removeYardJob(job.job_id); }}
                  >×</button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addYardJob}
              className="flex items-center gap-1 rounded-full border border-dashed border-emerald-300 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50 transition-all"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add site
            </button>
          </div>
        );

        // Desktop gets the side-by-side layout (cards left, map right). Mobile always
        // stacks vertically: heading → cards → map → price bar.
        const inlineLayout = isDesktop;

        return (
          <>
            <h2 id="step2-heading" className="sr-only">Step 2: Pick what you need</h2>

            {mapVisible ? (
              /* ── Airtasker-style: scrollable cards left, full-height map right ── */
              <>
              <div
                className={cls('z-40', inlineLayout ? 'fixed inset-x-0 bottom-0 flex' : 'mb-32 flex flex-col gap-4')}
                style={inlineLayout ? { top: headerH } : undefined}
              >
                {/* LEFT PANEL: scope cards (inline) / stacked above map (mobile only when not yard) */}
                <div
                  className={cls(
                    'flex flex-col',
                    inlineLayout
                      ? 'w-[300px] sm:w-[340px] md:w-[360px] lg:w-[420px] flex-shrink-0 h-full overflow-hidden border-r border-slate-200/60'
                      : 'py-2'
                  )}
                  style={inlineLayout ? { background: 'linear-gradient(180deg, #f9fbfd 0%, #eef3f7 100%)' } : undefined}
                >
                  {/* Scrollable content */}
                  <div className={inlineLayout ? 'flex-1 min-h-0 overflow-y-auto' : 'space-y-6'}>
                    <div className={inlineLayout ? 'px-4 pt-4 pb-2 space-y-4' : undefined}>
                      {step2Body}
                    </div>
                    {inlineLayout && (
                      <div className="px-4 pt-2 pb-4 space-y-2.5">
                        {ndisCard}
                        {clearZonesBtn}
                        {instructionText}
                        {yardSizeFallback}
                        {sitesWidget}
                      </div>
                    )}
                  </div>

                  {/* Sticky price dock — inline-layout only, never scrolls out of view */}
                  {inlineLayout && (
                    <div className="shrink-0 border-t border-slate-200/60 px-4 py-3.5" style={{ background: 'linear-gradient(180deg, #f3f7f5 0%, #eaeff3 100%)' }}>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                        {isNdisContext ? 'Total' : 'Price for this scope'}
                      </div>
                      <div className="text-2xl font-bold text-slate-900 mt-0.5 truncate">
                        {priceReadyLocal
                          ? priceLabel
                          : polygonReadyLocal && !ndisAddressReadyLocal
                          ? 'Search address to set region'
                          : 'Draw a zone to reveal price'}
                      </div>
                      {priceReadyLocal && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate">{activeMeasurementLabel}</div>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => goToStep(1)}
                          className="px-4 py-2 rounded-2xl text-sm font-semibold border border-black/15 bg-white text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (priceReadyLocal) goToStep(3); }}
                          disabled={!priceReadyLocal}
                          className={cls(
                            'flex-1 min-w-0 px-4 py-2 rounded-2xl text-sm font-semibold text-white transition-opacity whitespace-nowrap',
                            priceReadyLocal ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--accent)]/60 cursor-not-allowed'
                          )}
                        >
                          Review quote →
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT PANEL / BELOW PANEL: map */}
                <div className={inlineLayout ? 'flex-1 relative overflow-hidden' : 'flex flex-col gap-3'}>
                  {/* Stacked-mobile only: scope tabs or NDIS card above the map */}
                  {!inlineLayout && (isNdisContext ? ndisCard : scopeTabs)}

                  {/* The map — absolute fill in inline layout, fixed height in stacked-mobile */}
                  <StableMapSlot
                    className={
                      inlineLayout
                        ? ''
                        : 'w-full h-[480px] sm:h-[560px] rounded-2xl border border-black/10 shadow-lg overflow-hidden'
                    }
                    style={inlineLayout ? { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } : undefined}
                  >
                    {mapIframe}
                    {calculatingOverlay}
                  </StableMapSlot>

                  {/* Stacked-mobile only: actions below the map */}
                  {!inlineLayout && (
                    <div className="flex flex-col gap-2">
                      {clearZonesBtn}
                      {instructionText}
                      {yardSizeFallback}
                      {sitesWidget}
                    </div>
                  )}
                </div>
              </div>

              {/* Stacked-mobile sticky price dock — only when we're not using the inline layout */}
              {!inlineLayout && mapVisible && S.service !== 'yard' && (
                <div
                  className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/60 px-4 pt-3"
                  style={{
                    background: 'linear-gradient(180deg, #f3f7f5 0%, #eaeff3 100%)',
                    paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">
                        {isNdisContext ? 'Total' : 'Price'}
                      </div>
                      <div className="text-base font-bold text-slate-900 truncate">
                        {priceReadyLocal
                          ? priceLabel
                          : polygonReadyLocal && !ndisAddressReadyLocal
                          ? 'Search address'
                          : 'Draw a zone'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="px-3 py-2 rounded-2xl text-sm font-semibold border border-black/15 bg-white text-slate-700 whitespace-nowrap"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (priceReadyLocal) goToStep(3); }}
                        disabled={!priceReadyLocal}
                        className={cls(
                          'px-4 py-2 rounded-2xl text-sm font-semibold text-white whitespace-nowrap transition-opacity',
                          priceReadyLocal ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--accent)]/60 cursor-not-allowed'
                        )}
                      >
                        Review quote →
                      </button>
                    </div>
                  </div>
                </div>
              )}
              </>
            ) : (
              /* ── Regular non-map layout ── */
              <section className="mb-8" aria-labelledby="step2-heading">
                <div className="space-y-6">{step2Body}</div>
              </section>
            )}
          </>
        );
      })()}</Step2ErrorBoundary>}
      {/* ===== STEP 3 ===== */}
      {S.step === 3 && (
  <>
    <section className="mb-28" aria-labelledby="step3-heading">
      <h2 id="step3-heading" className="sr-only">
        Step 3: Request your booking
      </h2>

      <div className="min-w-0 overflow-x-hidden">
        {!hasWork ? (
          <div className="text-sm text-slate-800">
            Add a preset on Step 2 to see an estimate.
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6 min-w-0">
            {/* MAIN: form */}
            <div className="min-w-0 lg:col-span-2 space-y-4 lg:order-1">
              {/* Header */}
              <div className="pb-1">
                <h3 className="text-xl sm:text-2xl font-semibold text-slate-900">
                  Almost there
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {authedUser
                    ? 'Review your details and confirm your service address.'
                    : 'We\u2019ll confirm timing and pricing before any work begins \u2014 no payment needed now.'}
                </p>
              </div>

              {/* Contact */}
              <S3_Card>
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-white text-[10px] font-bold" aria-hidden="true">1</span>
                  <S3_Title>Your details</S3_Title>
                </div>
                {authedUser && !profileHydrated && (
                  <div className="mb-3 text-[11px] text-slate-400">Loading your details&hellip;</div>
                )}
                {authedUser && profileHydrated && S.phone.trim() && (
                  <div className="mb-3 flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-[11px] font-medium text-emerald-700">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    Prefilled from your account — edit below if needed
                  </div>
                )}
                {authedUser && profileHydrated && !S.phone.trim() && (
                  <div className="mb-3 flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] font-medium text-amber-700">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Add your phone number to continue
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="s3-fullname">Full name <span className="text-red-500">*</span></label>
                    <input
                      id="s3-fullname"
                      type="text"
                      autoComplete="name"
                      className={cls(
                        "w-full rounded-xl border bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 focus:border-[color:var(--accent)]",
                        fieldTouched.fullName && (!authedUser || profileHydrated) && !S.fullName.trim() ? "border-red-400" : "border-black/10"
                      )}
                      placeholder="Jane Smith"
                      value={S.fullName}
                      onChange={(e) => set('fullName', e.target.value)}
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
                      type="email"
                      autoComplete="email"
                      className={cls(
                        "w-full rounded-xl border bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 focus:border-[color:var(--accent)]",
                        fieldTouched.email && (!authedUser || profileHydrated) && !S.email.trim() ? "border-red-400" : "border-black/10"
                      )}
                      placeholder="jane@example.com"
                      value={S.email}
                      onChange={(e) => set('email', e.target.value)}
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
                      type="tel"
                      autoComplete="tel"
                      className={cls(
                        "w-full rounded-xl border bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 focus:border-[color:var(--accent)]",
                        fieldTouched.phone && (!authedUser || profileHydrated) && !S.phone.trim() ? "border-red-400" : "border-black/10"
                      )}
                      placeholder="04XX XXX XXX"
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
                <S3_Card className="scroll-mt-24">
                  <div id="s3-ndis-routing" className="sr-only" aria-hidden="true" />
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-600 text-white text-[10px] font-bold" aria-hidden="true">2</span>
                    <S3_Title>NDIS routing</S3_Title>
                    <span className="ml-auto text-[10px] font-medium text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">Required</span>
                  </div>
                  <p className="mb-3 text-[12px] text-slate-500">
                    How is this participant managed? We&apos;ll route the quote directly to the right contact.
                  </p>
                  <div className="grid gap-2">
                    {NDIS_MANAGEMENT_OPTIONS.map((option) => {
                      const active = S.ndisManagementType === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          className={cls(
                            'rounded-xl border px-3 py-2.5 text-left transition-colors',
                            active
                              ? 'border-violet-500 bg-violet-50 shadow-[0_4px_16px_rgba(109,40,217,0.10)]'
                              : 'border-black/10 bg-white/70 hover:border-violet-300 hover:bg-violet-50/40'
                          )}
                          onClick={() => set('ndisManagementType', option.key)}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={cls(
                                'flex-shrink-0 inline-flex h-4 w-4 items-center justify-center rounded-full border',
                                active ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-transparent'
                              )}
                              aria-hidden="true"
                            >
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                            </span>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900">{option.title}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{option.destination}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {!S.ndisManagementType && (
                    <div className="mt-2 text-[11px] text-amber-700">
                      Select how this participant is managed to continue.
                    </div>
                  )}
                  {S.ndisManagementType === 'self_managed' && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-[11px] text-emerald-800">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                      <span>Self-managed — the quote goes directly to the participant email above. No forwarding needed.</span>
                    </div>
                  )}
                  {(S.ndisManagementType === 'plan_managed' || S.ndisManagementType === 'agency_managed') && (
                    <>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="s3-ndis-forward-contact">
                            {S.ndisManagementType === 'plan_managed' ? 'Plan manager name' : 'Contact name'}
                          </label>
                          <input
                            id="s3-ndis-forward-contact"
                            className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                            placeholder={S.ndisManagementType === 'plan_managed' ? 'Plan manager or provider name' : 'Contact name'}
                            value={S.ndisForwardContactName}
                            onChange={(e) => set('ndisForwardContactName', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="s3-ndis-forward-email">
                            {S.ndisManagementType === 'plan_managed' ? 'Plan manager email' : 'Forward quote email'}
                          </label>
                          <input
                            id="s3-ndis-forward-email"
                            className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                            placeholder="billing@provider.com.au"
                            value={S.ndisForwardEmail}
                            onChange={(e) => set('ndisForwardEmail', e.target.value)}
                            onBlur={(e) => set('ndisForwardEmail', (e.target.value || '').trim().toLowerCase())}
                          />
                          {S.ndisForwardEmail.trim().length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.ndisForwardEmail.trim()) && (
                            <div className="mt-1 text-[11px] text-red-600">Enter a valid email address.</div>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2 text-[11px] text-violet-800">
                        Leave the forwarding email blank to send to the participant first &mdash; we&apos;ll note the routing for the team.
                      </div>
                    </>
                  )}
                </S3_Card>
              )}

              {/* Location & access */}
              <S3_Card>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-900 text-white text-[10px] font-bold" aria-hidden="true">{isNdisContext ? 3 : 2}</span>
                  <S3_Title>Service address</S3_Title>
                </div>
                <div id="s3-service-address">
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

                <div className="mt-4 pt-3 border-t border-black/5">
                  <div className="text-xs font-medium text-slate-600 mb-2">Access &amp; site notes</div>
                  <div className="flex flex-wrap gap-2">
                    {ACCESS_TOGGLES.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        className={cls(
                          'px-2.5 py-1 rounded-full text-xs border',
                          S[key]
                            ? 'border-[color:var(--accent)] bg-white'
                            : 'border-black/10 bg-white/70'
                        )}
                        onClick={() => {
                          const next = !S[key];
                          set(key, next);
                          trackQuoteEvent('quote_step3_access_toggle', { field: key, value: next });
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </S3_Card>

              {/* Optional extras */}
              <div>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-dashed border-slate-300/70 bg-white/40 text-sm text-slate-600 hover:bg-white/60 transition-colors"
                  onClick={() => {
                    setS3DetailsOpen((v) => {
                      trackQuoteEvent('quote_step3_details_toggled', { opened: !v });
                      return !v;
                    });
                  }}
                  aria-expanded={s3DetailsOpen}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-dashed border-slate-400 text-slate-500 text-xs font-medium" aria-hidden="true">+</span>
                    <span className="font-medium text-slate-700">Optional extras</span>
                    <span className="text-slate-400 text-[11px] font-normal">scheduling, notes, photos</span>
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
                  <S3_Card className="mt-2 space-y-0">
                    {/* Availability */}
                    <div>
                      <div className="text-xs font-medium text-slate-700 mb-2">When works best?</div>
                      <div className="flex flex-wrap gap-2">
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
                    </div>

                    {/* Notes */}
                    <div className="mt-4 pt-4 border-t border-black/5">
                      <div className="text-xs font-medium text-slate-700 mb-2">Anything else to note?</div>
                      {savedPropertyAccess && !S.notes?.trim() && (
                        <div className="mb-2 flex items-center justify-between p-2.5 rounded-xl border border-black/10 bg-white/70">
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
                        className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 focus:border-[color:var(--accent)] resize-none"
                        rows={3}
                        placeholder="Gate code, parking notes, pets, anything specific…"
                        value={S.notes}
                        maxLength={2000}
                        onChange={(e) => set('notes', e.target.value.slice(0, 2000))}
                        aria-label="Notes"
                      />
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {(['Gate code', 'Key in lockbox', 'Driveway access', 'Pool or spa', 'Extra mess', 'Fragile items'] as const).map((chip) => {
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
                        <span className={`text-[10px] flex-shrink-0 ml-2 ${S.notes.length > 1800 ? 'text-amber-600' : 'text-slate-400'}`}>
                          {S.notes.length}/2000
                        </span>
                      </div>
                    </div>

                    {/* Photos */}
                    <label className="mt-4 pt-4 border-t border-black/5 flex items-start gap-2.5 cursor-pointer">
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
                        Share a few photos for a faster, more accurate quote
                        <span className="block text-[11px] text-slate-400 mt-0.5">We&apos;ll follow up via SMS or email — no app needed.</span>
                      </span>
                    </label>
                  </S3_Card>
                )}
              </div>

              {/* Reassurance banner */}
              <div className="flex items-center gap-2.5 rounded-xl border border-black/5 bg-slate-50/70 px-4 py-3 text-[11px] text-slate-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>No payment now — we confirm times and any price changes before work begins. Typically within 2 hours on business days.</span>
              </div>
            </div>

            {/* SIDEBAR */}
            <aside className={cls('min-w-0 lg:col-span-1 h-fit lg:order-2', !yardActive && 'lg:sticky lg:top-6')}>
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
                        {/* Aerial preview of the polygons the customer drew — confirms
                            what they're booking and is included in the quote/booking record. */}
                        <YardZonesPreview jobs={S.yardJobs} className="mt-3" />
                        {/* Prominent "back to map" affordance — yard care doesn't have
                            the "Edit scope or inclusions" button that other services
                            get further down, so without this users had no visible
                            way back to Step 2 above the fold. */}
                        <div className="mt-3">
                          <button
                            type="button"
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-black/15 bg-white/70 text-xs text-slate-700 font-medium hover:bg-white hover:border-black/25 transition-colors"
                            onClick={() => goToStep(2)}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Edit zones or scope
                          </button>
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
                      {renderPriceBreakdown()}
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

                {/* Auth gate or submit */}
                {!authedUser && guestSubmitSuccess ? (
                  <div className="mt-4 py-3 text-center space-y-1.5">
                    <p className="text-[13.5px] font-semibold text-slate-800">✓ Quote submitted</p>
                    <p className="text-[12px] text-slate-400 leading-snug">
                      We&apos;ll be in touch at <span className="text-slate-600">{guestSubmitSuccess.email}</span>
                    </p>
                    <button
                      className="text-[11.5px] text-slate-400 hover:text-slate-600 transition-colors"
                      onClick={() => { dispatch({ type: 'reset' }); setGuestSubmitSuccess(null); }}
                    >
                      Start another quote
                    </button>
                  </div>
                ) : !authedUser ? (
                  <div id="step3-submit-btn" className="mt-4 space-y-2">
                    <QuoteAuthGate
                      prefillEmail={S.email}
                      onGuestContinue={(token) => void handleSubmitQuote(true, token)}
                    />
                    {/* Back button — same wording/styling as the authed branch
                        so guest users have an obvious way to return to Step 2
                        to tweak their drawn zones / scope. */}
                    <button
                      type="button"
                      className="w-full text-center text-[12px] text-slate-400 hover:text-slate-600 transition-colors"
                      onClick={() => goToStep(2)}
                    >
                      ← Back to scope
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2">
                  <M.button
                    id="step3-submit-btn"
                    className={cls(
                      "w-full px-4 py-2.5 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2",
                      isCheckoutLoading && "opacity-60 cursor-not-allowed"
                    )}
                    style={{ background: 'var(--accent)' }}
                    disabled={isCheckoutLoading}
                    onClick={() => void handleSubmitQuote(false)}
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
                      'Get my quote →'
                    )}
                  </M.button>

                  <button
                    type="button"
                    className="w-full text-center text-[12px] text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => goToStep(2)}
                  >
                    ← Back to scope
                  </button>
                  </div>
                )}

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
{!isNdisContext && S.service !== 'yard' && (
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

{S.service === 'yard' && S.step === 2 && !isDesktop && (() => {
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
  const measurement = isPerimeterScope ? (S.yardPerimeter ?? 0) : (S.yardArea ?? S.manualYardAreaM2 ?? 0);
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
