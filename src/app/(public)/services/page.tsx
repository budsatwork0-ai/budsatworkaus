'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import StableMapSlot from '@/components/StableMapSlot';
import {
  usePolygonQuote,
  computeAreaFromPath,
  computePerimeterFromPath,
} from '@/app/ui/yard/usePolygonQuote';
import FloorPlanBuilder from '@/app/ui/floor/FloorPlanBuilder';
import { serializeLayout } from '@/app/ui/floor/utils';
import { computeFloorPricing } from '@/app/ui/floor/useFloorPricing';
import { useCarModelSelector } from '@/app/ui/car/useCarModelSelector';
import RegoLookupAssistant from '@/app/ui/car/RegoLookupAssistant';
import type { VehicleSizeCategory } from '@/lib/rego/types';
import { useYardMapping } from '@/app/hooks/useYardMapping';
import Turnstile from '@/components/Turnstile';

// Extracted modules - Types
import type {
  Context,
  ServiceType,
  ScopeKey,
  CommFrequency,
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
import { WindowsEditor } from './components/windows/WindowsEditor';
import { DistanceRouteConfigurator } from './components/dump/DistanceRouteConfigurator';

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
  const [urlServiceHandled, setUrlServiceHandled] = useState(false);
  usePolygonQuote();
  const carSelector = useCarModelSelector();
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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

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

  // Optimized yard mapping logic with debouncing, batched updates, and memoization
  const {
    iframeRef,
    activeYardJob,
    postMessageToIframe,
    postPolygonToIframe,
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
  });

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

    // Always reset on mount (covers page refresh & direct navigation)
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    dispatch({ type: 'reset' });

    return () => window.removeEventListener('svc:reset', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hardResetQuote]);


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
    if (JSON.stringify(S.carModelZones) !== JSON.stringify(d.zones)) set('carModelZones', d.zones);
    if (S.carDirtLevel !== d.dirtLevel) set('carDirtLevel', d.dirtLevel);
    if (S.carModelPriceImpact !== d.priceImpact) set('carModelPriceImpact', d.priceImpact);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carSelector.derived.carType, carSelector.derived.zones.length, carSelector.derived.dirtLevel, carSelector.derived.priceImpact]);

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
            ? 'auto_express'
            : svc === 'laundry_sneakers'
            ? 'laundry'
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    if (!isClient) return;

    if (typeof performance === 'undefined') return;

    let navType: string | undefined;
    if (typeof performance.getEntriesByType === 'function') {
      const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      navType = entries?.[0]?.type;
    }

    if (!navType) {
      const { navigation } = performance as Performance & { navigation?: PerformanceNavigation };
      switch (navigation?.type) {
        case 1:
          navType = 'reload';
          break;
        case 2:
          navType = 'back_forward';
          break;
        case 0:
          navType = 'navigate';
          break;
        default:
          break;
      }
    }

    if (navType === 'reload') {
      hardResetQuote(true);
    }
  }, [hardResetQuote, isClient]);

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

  const effectivePrice = routePriceOverride ?? scopedPricing.price;
  const isSneakerLot = S.service === 'laundry_sneakers' && (S.scope === 'sneaker_lot' || (S.scope === 'sneaker_care' && S.sneakerTier === 'multi'));
  const priceLabel = useMemo(() => {
    if (isSneakerLot) {
      const perPairPrice = Math.round(effectivePrice / 4);
      return `${fmtAUD(perPairPrice)}/pair`;
    }
    return fmtAUD(effectivePrice);
  }, [effectivePrice, isSneakerLot]);

  const timeLabel = useMemo(() => `~${fmtHrMin(estMinutes)}`, [estMinutes]);

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          laundry_sneakers: ['laundry'],
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

        // ---------- card component (simple presets) ----------
        const ScopeCard = function ScopeCard({
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
          const _popoverId = React.useId(); // eslint-disable-line @typescript-eslint/no-unused-vars
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
          const isCommercialCleaning = S.service === 'cleaning' && S.context === 'commercial';
          const commercialNicheKeys: CommercialCleaningType[] = ['office', 'medical', 'fitness', 'hospitality', 'education', 'event', 'accommodation'];
          const isCommercialNicheCard = isCommercialCleaning && commercialNicheKeys.includes(sc.key as CommercialCleaningType);
          const isHourlyCard = isHomeCleaning && sc.key === 'hourly';
          const isCleaningWizardCard = isHomeCleaning && !isHourlyCard;
          const addonsQuick: { key: string; label: string }[] = [];
          const addonsState = cleaningAddonsForScope(sc.key);
          const labelId = `sc-${sc.key}-label`;
          const hookId = `sc-${sc.key}-desc`;
          const isCarCleaning = S.service === 'auto';
          const isCleaning = S.service === 'cleaning';
          const isDumpRunsCard = S.service === 'dump' && sc.key === 'dump_runs';
          const isDeliveryCard = S.service === 'dump' && sc.key === 'dump_delivery';
          const isTransportCard = S.service === 'dump' && sc.key === 'dump_transport';
          const isRouteCard = isDeliveryCard || isTransportCard;
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
                'relative overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 hover:shadow-[0_16px_40px_rgba(2,6,23,0.10)] transition-all',
                'flex flex-col h-full min-w-0',
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
                  {isActive && isCleaningWizardCard && isConfigOpen && (
                    <div
                      className="mt-3 space-y-2 border-t border-slate-200/80 pt-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-800 tracking-tight uppercase">Adjust details</span>
                        {cleaningHint && <span className="text-slate-500 hidden sm:inline">{cleaningHint}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[10px] md:text-[11px] text-slate-700">
                        <div className="rounded-full border border-black/10 bg-white/80 px-1.5 py-0.5 inline-flex items-center gap-1">
                          <span className="font-semibold text-slate-700">Bed</span>
                          <button
                            type="button"
                            aria-label="Decrease bedrooms"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustBedrooms(-1);
                            }}
                          >
                            –
                          </button>
                          <span className="min-w-[16px] text-center font-semibold text-slate-900">
                            {S.paramsByService.cleaning?.bedrooms ?? sizePreset.bedrooms}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase bedrooms"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustBedrooms(1);
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div className="rounded-full border border-black/10 bg-white/80 px-1.5 py-0.5 inline-flex items-center gap-1">
                          <span className="font-semibold text-slate-700">Kit</span>
                          <button
                            type="button"
                            aria-label="Decrease kitchens"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustKitchens(-1);
                            }}
                          >
                            –
                          </button>
                          <span className="min-w-[16px] text-center font-semibold text-slate-900">
                            {S.paramsByService.cleaning?.kitchens ?? sizePreset.kitchens}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase kitchens"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustKitchens(1);
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div className="rounded-full border border-black/10 bg-white/80 px-1.5 py-0.5 inline-flex items-center gap-1">
                          <span className="font-semibold text-slate-700">Lndy</span>
                          <button
                            type="button"
                            aria-label="Decrease laundry"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustLaundry(-1);
                            }}
                          >
                            –
                          </button>
                          <span className="min-w-[16px] text-center font-semibold text-slate-900">
                            {S.paramsByService.cleaning?.laundry ?? sizePreset.laundry}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase laundry"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustLaundry(1);
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div className="rounded-full border border-black/10 bg-white/80 px-1.5 py-0.5 inline-flex items-center gap-1">
                          <span className="font-semibold text-slate-700">Liv</span>
                          <button
                            type="button"
                            aria-label="Decrease living rooms"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustLiving(-1);
                            }}
                          >
                            –
                          </button>
                          <span className="min-w-[16px] text-center font-semibold text-slate-900">
                            {S.paramsByService.cleaning?.living ?? sizePreset.living}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase living rooms"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustLiving(1);
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div className="rounded-full border border-black/10 bg-white/80 px-1.5 py-0.5 inline-flex items-center gap-1">
                          <span className="font-semibold text-slate-700">Bath</span>
                          <button
                            type="button"
                            aria-label="Decrease bathrooms"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustBathrooms(-1);
                            }}
                          >
                            –
                          </button>
                          <span className="min-w-[16px] text-center font-semibold text-slate-900">
                            {S.paramsByService.cleaning?.bathrooms ?? sizePreset.bathrooms}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase bathrooms"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustBathrooms(1);
                            }}
                          >
                            +
                          </button>
                        </div>
                        <div className="rounded-full border border-black/10 bg-white/80 px-1.5 py-0.5 inline-flex items-center gap-1">
                          <span className="font-semibold text-slate-700">Flr</span>
                          <button
                            type="button"
                            aria-label="Decrease storeys"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustStoreys(-1);
                            }}
                          >
                            –
                          </button>
                          <span className="min-w-[16px] text-center font-semibold text-slate-900">
                            {S.paramsByService.cleaning?.storeys ?? sizePreset.storeys}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase storeys"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              adjustStoreys(1);
                            }}
                          >
                            +
                          </button>
                        </div>
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
                  )}
                  {isActive && isCommercialNicheCard && isConfigOpen && (
                    <div
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
                      {/* Square metres slider */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-semibold text-slate-700">Approx. area</div>
                          <div className="text-[11px] text-slate-600">{S.paramsByService.cleaning?.sqm ?? COMM_PRESETS[sc.key as CommercialCleaningType]?.[0]?.params?.sqm ?? 300} sqm</div>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={3000}
                          step={50}
                          value={S.paramsByService.cleaning?.sqm ?? COMM_PRESETS[sc.key as CommercialCleaningType]?.[0]?.params?.sqm ?? 300}
                          onChange={(e) => {
                            e.stopPropagation();
                            set('paramsByService', {
                              ...S.paramsByService,
                              cleaning: {
                                ...(S.paramsByService.cleaning || {}),
                                sqm: Number(e.target.value),
                              },
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full accent-emerald-600"
                          aria-label="Square metres slider"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>50</span>
                          <span>1500</span>
                          <span>3000</span>
                        </div>
                      </div>
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
                  )}
                </div>
              ))}

              {/* CTA row */}
              <div className="mt-auto pt-1.5 flex flex-col gap-3">
                {S.service === 'windows' && isActive && isConfigOpen && (
                  <div
                    data-card-interactive="true"
                    className="min-w-0 w-full overflow-hidden"
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
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">
                          Extra focus areas <span className="text-slate-500">(optional)</span>
                        </div>
                        {carSelector.zones.size > 0 && (
                          <div className="text-xs font-semibold text-emerald-400">
                            +${carSelector.derived.priceImpact}
                          </div>
                        )}
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

                {/* Laundry Card - Tier Selector & Load Counter */}
                {S.service === 'laundry_sneakers' && isLaundryCard && isActive && isConfigOpen && (
                  <div
                    data-card-interactive="true"
                    className="rounded-xl border border-black/5 bg-white/80 p-3 space-y-3"
                    onClick={stopCardBubble}
                    onMouseDown={stopCardBubble}
                    onPointerDown={stopCardBubble}
                    onTouchStart={stopCardBubble}
                  >
                    <div className="text-sm font-semibold text-slate-900">Service type</div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'wash_fold', label: 'Wash & Fold', price: 30 },
                        { key: 'wash_iron', label: 'Wash & Iron', price: 45 },
                      ].map((tier) => (
                        <button
                          key={tier.key}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            set('laundryTier', tier.key as any);
                          }}
                          className={cls(
                            'rounded-full border px-3 py-1.5 text-sm flex items-center gap-2',
                            S.laundryTier === tier.key
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white border-black/10 hover:border-emerald-300'
                          )}
                        >
                          <span>{tier.label}</span>
                          <span className={cls('text-xs', S.laundryTier === tier.key ? 'text-emerald-100' : 'text-slate-500')}>
                            ${tier.price}/load
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-slate-700">How many loads? <span className="text-xs text-slate-500">(~5kg each)</span></span>
                      <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                        <button
                          type="button"
                          className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            set('laundryLoads', Math.max(1, (S.laundryLoads || 1) - 1));
                          }}
                          aria-label="Decrease loads"
                        >
                          –
                        </button>
                        <span className="min-w-[24px] text-center font-semibold">{S.laundryLoads || 1}</span>
                        <button
                          type="button"
                          className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            set('laundryLoads', Math.min(20, (S.laundryLoads || 1) + 1));
                          }}
                          aria-label="Increase loads"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <div>✓ Pickup & delivery included</div>
                      <div>✓ 24-48hr turnaround</div>
                    </div>
                  </div>
                )}

                {/* Sneaker Care Card - Tier Selector */}
                {S.service === 'laundry_sneakers' && isSneakerCareCard && isActive && isConfigOpen && (
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
                        { key: 'deep', label: 'Deep Restore', price: '$40' },
                        { key: 'multi', label: 'Multi-Pair', price: '~$30/pair' },
                      ].map((tier) => (
                        <button
                          key={tier.key}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            set('sneakerTier', tier.key as any);
                          }}
                          className={cls(
                            'rounded-full border px-3 py-1.5 text-sm flex items-center gap-2',
                            S.sneakerTier === tier.key
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white border-black/10 hover:border-emerald-300'
                          )}
                        >
                          <span>{tier.label}</span>
                          <span className={cls('text-xs', S.sneakerTier === tier.key ? 'text-emerald-100' : 'text-slate-500')}>
                            {tier.price}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {S.sneakerTier === 'refresh' && 'Quick cosmetic refresh for lightly worn pairs.'}
                      {S.sneakerTier === 'deep' && 'Full restoration for noticeably dirty or worn pairs.'}
                      {S.sneakerTier === 'multi' && 'Batch-friendly pricing for 3+ pairs.'}
                    </div>
                  </div>
                )}

                {/* Sneaker Care Card - Turnaround Selector */}
                {S.service === 'laundry_sneakers' && isSneakerCareCard && isActive && isConfigOpen && (
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
                    className="rounded-xl border border-black/5 bg-white/90 p-4 shadow-sm space-y-4"
                    onClick={stopCardBubble}
                    onMouseDown={stopCardBubble}
                    onPointerDown={stopCardBubble}
                    onTouchStart={stopCardBubble}
                  >
                    {/* Header with live price estimate */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">Delivery Details</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Configure your delivery for an accurate quote</div>
                      </div>
                      {(() => {
                        const estimate = calculateEstimatedPrice('dump_delivery', S);
                        if (!estimate || (estimate.min === 0 && estimate.max === 0)) return null;
                        return (
                          <div className="text-right">
                            <div className="text-lg font-bold text-emerald-700">
                              {estimate.min === estimate.max
                                ? fmtAUD(estimate.min)
                                : `${fmtAUD(estimate.min)}–${fmtAUD(estimate.max)}`}
                            </div>
                            <div className="text-[10px] text-slate-500">estimated</div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Step 1: What are you delivering? */}
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
                    </div>

                    {/* Step 2: Do you need help? */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">2</span>
                        Do you need lifting help?
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: 'no_help', label: 'No help needed', desc: 'I can load/unload myself', icon: '👤' },
                          { key: 'need_help', label: 'Need help', desc: 'Extra hands for lifting', icon: '👥', extra: '+$25–50' },
                        ].map((c) => (
                          <button
                            key={c.key}
                            type="button"
                            className={cls(
                              'p-3 rounded-lg border text-left transition-all',
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
                              <span className="text-lg">{c.icon}</span>
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

                    {/* Step 3: Distance indicator */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">3</span>
                        Pickup & drop-off locations
                      </div>
                      <div className="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-3 border border-dashed border-slate-200">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>
                            {S.distanceKm > 0
                              ? `${Math.round(S.distanceKm)} km route configured`
                              : 'Enter addresses below for distance-based pricing'}
                          </span>
                        </div>
                        {S.distanceKm > 0 && (
                          <div className="mt-2 text-[10px] text-slate-500">
                            Travel component: ~{fmtAUD(Math.round(S.distanceKm * ROUTE_PER_KM_RATE))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pricing breakdown */}
                    {deliveryType && (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 space-y-2">
                        <div className="text-[11px] font-semibold text-emerald-800">Pricing breakdown</div>
                        <div className="text-[11px] text-slate-700 space-y-1">
                          <div className="flex justify-between">
                            <span>Base callout</span>
                            <span className="font-medium">{fmtAUD(BASE_CALLOUT_PRICE)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Item handling ({deliveryType})</span>
                            <span className="font-medium">
                              {fmtAUD(
                                ({ parcel: 0, household: 20, mattress: 40, groceries: 20, tools: 20 }[deliveryType] || 0) +
                                ({ parcel: 0, household: 15, mattress: 35, groceries: 15, tools: 15 }[deliveryType] || 0)
                              ) + '–' + fmtAUD(
                                ({ parcel: 0, household: 35, mattress: 70, groceries: 35, tools: 35 }[deliveryType] || 0)
                              )}
                            </span>
                          </div>
                          {deliveryAssist === 'need_help' && (
                            <div className="flex justify-between">
                              <span>Lifting assistance</span>
                              <span className="font-medium">{fmtAUD(PHYSICAL_BLOCK_RANGE.min)}–{fmtAUD(PHYSICAL_BLOCK_RANGE.max)}</span>
                            </div>
                          )}
                          {S.distanceKm > 0 && (
                            <div className="flex justify-between">
                              <span>Distance ({Math.round(S.distanceKm)} km)</span>
                              <span className="font-medium">~{fmtAUD(Math.round(S.distanceKm * ROUTE_PER_KM_RATE))}</span>
                            </div>
                          )}
                          <div className="border-t border-emerald-200 pt-1 mt-1 flex justify-between font-semibold text-emerald-800">
                            <span>Estimated total</span>
                            {(() => {
                              const estimate = calculateEstimatedPrice('dump_delivery', S);
                              if (!estimate) return <span>—</span>;
                              return (
                                <span>
                                  {estimate.min === estimate.max
                                    ? fmtAUD(estimate.min)
                                    : `${fmtAUD(estimate.min)}–${fmtAUD(estimate.max)}`}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500 italic">
                          Final price confirmed after route is calculated below.
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {isTransportCard && isConfigOpen && (
                  <div
                    data-card-interactive="true"
                    className="rounded-xl border border-black/5 bg-white/90 p-4 shadow-sm space-y-4"
                    onClick={stopCardBubble}
                    onMouseDown={stopCardBubble}
                    onPointerDown={stopCardBubble}
                    onTouchStart={stopCardBubble}
                  >
                    {/* Header with live price estimate */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">Move Assistance Details</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Tell us about your move for accurate pricing</div>
                      </div>
                      {(() => {
                        const estimate = calculateEstimatedPrice('dump_transport', S);
                        if (!estimate || (estimate.min === 0 && estimate.max === 0)) return null;
                        return (
                          <div className="text-right">
                            <div className="text-lg font-bold text-emerald-700">
                              {estimate.min === estimate.max
                                ? fmtAUD(estimate.min)
                                : `${fmtAUD(estimate.min)}–${fmtAUD(estimate.max)}`}
                            </div>
                            <div className="text-[10px] text-slate-500">estimated</div>
                          </div>
                        );
                      })()}
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
                          { key: 'bags', label: 'A few bags', desc: 'Small items only', icon: '🎒', price: 'From $99' },
                          { key: 'boot', label: 'Car boot full', desc: 'Boxes & small furniture', icon: '🚗', price: 'From $129' },
                          { key: 'small_load', label: 'Small load', desc: 'Bed, desk, boxes', icon: '📦', price: 'From $179' },
                          { key: 'full_move', label: 'Full move', desc: 'Complete household', icon: '🚚', price: 'From $299' },
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

                    {/* Step 3: Access difficulty */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">3</span>
                        Stair access at pickup or drop-off?
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: 'none', label: 'No stairs', desc: 'Ground level access', icon: '✓', extra: null },
                          { key: 'one', label: 'One flight', desc: 'Single staircase', icon: '🔼', extra: '+$25–50' },
                          { key: 'multi', label: 'Multiple flights', desc: '2+ floors of stairs', icon: '🔼🔼', extra: '+$50–100' },
                          { key: 'no_lift', label: 'No lift access', desc: 'Apartment without lift', icon: '🏢', extra: '+$50–100' },
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

                    {/* Step 4: Distance indicator */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">4</span>
                        Origin & destination
                      </div>
                      <div className="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-3 border border-dashed border-slate-200">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <span>
                            {S.distanceKm > 0
                              ? `${Math.round(S.distanceKm)} km between locations`
                              : 'Enter addresses below for distance-based pricing'}
                          </span>
                        </div>
                        {S.distanceKm > 0 && (
                          <div className="mt-2 text-[10px] text-slate-500">
                            Travel component: ~{fmtAUD(Math.round(S.distanceKm * ROUTE_PER_KM_RATE))}
                            {transportSize === 'full_move' && ' (per trip)'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Pricing breakdown */}
                    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-2">
                      <div className="text-[11px] font-semibold text-blue-800">Pricing breakdown</div>
                      <div className="text-[11px] text-slate-700 space-y-1">
                        <div className="flex justify-between">
                          <span>Base callout</span>
                          <span className="font-medium">{fmtAUD(BASE_CALLOUT_PRICE)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Load size ({transportSize || 'small_load'})</span>
                          <span className="font-medium">
                            {fmtAUD(
                              ({ bags: 20, boot: 40, small_load: 60, full_move: 80 }[transportSize] || 60) +
                              ({ bags: 15, boot: 35, small_load: 55, full_move: 80 }[transportSize] || 55)
                            )}–{fmtAUD(
                              ({ bags: 35, boot: 70, small_load: 105, full_move: 140 }[transportSize] || 105)
                            )}
                          </span>
                        </div>
                        {transportStairs !== 'none' && (
                          <div className="flex justify-between">
                            <span>Stair access ({transportStairs})</span>
                            <span className="font-medium">
                              {transportStairs === 'one'
                                ? `${fmtAUD(PHYSICAL_BLOCK_RANGE.min)}–${fmtAUD(PHYSICAL_BLOCK_RANGE.max)}`
                                : `${fmtAUD(PHYSICAL_BLOCK_RANGE.min * 2)}–${fmtAUD(PHYSICAL_BLOCK_RANGE.max * 2)}`}
                            </span>
                          </div>
                        )}
                        {S.distanceKm > 0 && (
                          <div className="flex justify-between">
                            <span>Distance ({Math.round(S.distanceKm)} km)</span>
                            <span className="font-medium">~{fmtAUD(Math.round(S.distanceKm * ROUTE_PER_KM_RATE))}</span>
                          </div>
                        )}
                        <div className="border-t border-blue-200 pt-1 mt-1 flex justify-between font-semibold text-blue-800">
                          <span>Estimated total</span>
                          {(() => {
                            const estimate = calculateEstimatedPrice('dump_transport', S);
                            if (!estimate) return <span>—</span>;
                            return (
                              <span>
                                {estimate.min === estimate.max
                                  ? fmtAUD(estimate.min)
                                  : `${fmtAUD(estimate.min)}–${fmtAUD(estimate.max)}`}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 italic">
                        {transportSize === 'full_move'
                          ? 'Full moves often require multiple trips. Final scope confirmed after site review.'
                          : 'Final price confirmed after route is calculated below.'}
                      </div>
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

                {isActive && S.service === 'laundry_sneakers' && isSneakerCareCard && isSneakerRefresh && isConfigOpen && (
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

                {isActive && S.service === 'laundry_sneakers' && isSneakerCareCard && isSneakerDeep && isConfigOpen && (
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

                {isActive && S.service === 'laundry_sneakers' && isSneakerCareCard && isSneakerMulti && isConfigOpen && (
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
        };

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
                      <div className={cls('grid gap-4 md:gap-5', mapVisible ? 'grid-cols-1' : 'md:grid-cols-2')}>
                        {(() => {
                          const scopes =
                            S.service === 'cleaning'
                              ? cleaningScopesForContext(S.context)
                              : SCOPES_BY_SERVICE[S.service] || [];


                          const commercialNiches: CommercialCleaningType[] = ['office', 'medical', 'fitness', 'hospitality', 'education', 'event', 'accommodation'];
                          const onSelect = (key: string) => {
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
                              ? S.commercialCleaningType === sc.key
                              : S.scope === sc.key;
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
                    {/* Quick-access scope icons for easy switching */}
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
                            const polygon = activeYardJob?.polygon_geojson?.[0] || [];
                            postPolygonToIframe(polygon);
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
                      <div className="flex flex-wrap gap-2 items-center p-3 rounded-xl border border-black/5 bg-white/60 backdrop-blur-sm">
                        <M.button
                          className="px-4 py-2 rounded-xl text-sm text-white flex items-center gap-2 shadow-sm hover:shadow-md transition-shadow"
                          style={{ background: 'var(--accent)' }}
                          onClick={() => postMessageToIframe({ type: 'YARD_TOGGLE_DRAWING', enabled: true })}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                          Draw or edit
                        </M.button>
                        <M.button
                          className="px-4 py-2 rounded-xl text-sm border border-black/10 bg-white text-slate-900 hover:border-rose-300 hover:text-rose-700 transition-colors flex items-center gap-2"
                          onClick={resetActivePolygon}
                          disabled={!activeYardJob?.polygon_geojson?.[0]?.length}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Clear polygon
                        </M.button>
                      </div>
                      {/* Live measurement & price display */}
                      {(() => {
                        const measurement = getYardMeasurementConfig(S.scope);
                        const value = measurement.mode === 'perimeter' ? S.yardPerimeter : S.yardArea;
                        const unit = measurement.mode === 'perimeter' ? 'm' : 'm²';
                        const hasPolygon = (S.yardPolygon?.[0]?.length ?? 0) >= 3;
                        const scopeLabel = SCOPES_BY_SERVICE.yard.find((s) => s.key === S.scope)?.label ?? S.scope;
                        const jobPrice = activeYardJob?.price ?? 0;

                        return (
                          <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">{scopeLabel}</span>
                                {hasPolygon ? (
                                  <span className="text-lg font-bold text-emerald-900">
                                    {(value ?? 0).toLocaleString()} {unit}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-500">Draw to measure</span>
                                )}
                              </div>
                            </div>
                            {hasPolygon && jobPrice > 0 && (
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] uppercase tracking-wide text-slate-500">Est. price</span>
                                <span className="text-xl font-bold text-slate-900">${jobPrice.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <div className="text-xs text-slate-500 px-1">
                        Search address, then draw your area. Drag points to adjust.
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
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl sm:text-2xl font-semibold text-slate-900">
                    Request your booking
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    We&apos;ll confirm times and any changes before work proceeds.
                  </p>
                </div>
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
                          : 'bg-emerald-100 text-emerald-800'
                      )}
                    >
                      {S.context === 'commercial' ? 'Commercial' : 'Home'}
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
                      // For other services, show the scope label
                      const scopeDef = SCOPES_BY_SERVICE[S.service]?.find((s) => s.key === S.scope);
                      return scopeDef?.label ?? S.scope ?? 'Select a scope';
                    })()}
                  </div>
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

                {/* CAPTCHA verification */}
                <div className="mt-4">
                  <div className="text-xs text-slate-600 mb-2">Verify you&apos;re human</div>
                  {TURNSTILE_SITE_KEY ? (
                    <Turnstile
                      siteKey={TURNSTILE_SITE_KEY}
                      onVerify={(token) => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken(null)}
                      onError={() => setCaptchaToken(null)}
                      theme="light"
                    />
                  ) : (
                    <div
                      role="status"
                      className="text-[11px] text-amber-600 mt-1"
                    >
                      Turnstile site key missing. Set <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> so the CAPTCHA can render.
                    </div>
                  )}
                  {!captchaToken && TURNSTILE_SITE_KEY && (
                    <div className="text-[11px] text-amber-600 mt-1">
                      Please complete the verification above to submit your quote.
                    </div>
                  )}
                </div>

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
                    className={cls(
                      "px-4 py-2 rounded-2xl text-sm text-white flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(20,83,45,0.25)]",
                      !captchaToken && "opacity-60 cursor-not-allowed"
                    )}
                    style={{ background: 'var(--accent)' }}
                    onClick={() => {
                      if (!captchaToken) {
                        toast.error('Please complete the verification to submit.');
                        return;
                      }

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
  <section className="mt-40 mb-28">
    <LiveOrdersStrip />
  </section>
)}

{/* Spacer for sticky footer */}
{(S.step === 2 || S.step === 3) && <div className="h-48 md:h-36" />}

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
        className={`pointer-events-auto flex items-center justify-between rounded-2xl px-3 py-2 md:px-4 md:py-3 ${glass}`}
        role="region"
        aria-label="Step 2 price bar"
      >
          <div>
            <div className="text-[10px] md:text-[11px] uppercase tracking-wide text-slate-600">
              Price for this scope
            </div>
            <div className="text-xl md:text-2xl font-bold">{priceLabel}</div>
            <div className="text-[11px] md:text-xs text-slate-600 mt-0.5 md:mt-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {timeLabel}
            </div>
            {usesRoutePricing && (
              <div className="hidden md:block text-xs text-slate-600 mt-1" aria-live="polite">
                {routeDistanceLabel ??
                  (routeLookupLoading ? 'Calculating travel details…' : 'Add both addresses for travel info.')}
              </div>
            )}
            <div className="hidden md:block text-[11px] text-slate-600 mt-1">
              {PRICE_SCOPE_DISCLAIMER}
            </div>
          <div className="hidden md:block text-[11px] text-slate-600">
            {FAIRNESS_PROMISE_COPY}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <M.button
            className="px-3 py-1.5 md:px-4 md:py-2 rounded-2xl text-sm text-white"
            style={{ background: 'var(--accent)' }}
            onClick={() => goToStep(1)}
            aria-label="Back to step 1"
          >
            Back
          </M.button>
          <M.button
            className="px-3 py-1.5 md:px-4 md:py-2 rounded-2xl text-sm text-white"
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
              <div className="flex items-center gap-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">Exact price</div>
                {isCalculating && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 border border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] text-blue-600 font-medium">Updating</span>
                  </div>
                )}
              </div>
              <div className="text-3xl font-semibold text-slate-900" aria-live="polite">
                {priceReady ? priceLabel : 'Draw a polygon to reveal price'}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                {priceReady ? measurementHint : 'Complete a polygon to reveal calm pricing.'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <M.button
                className="px-4 py-2 rounded-2xl text-sm font-semibold text-white bg-[color:var(--accent)]"
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
