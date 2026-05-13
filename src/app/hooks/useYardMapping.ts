import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import type { LatLng } from '@/app/ui/yard/yardPricing';
import { computeAreaFromPath, computePerimeterFromPath } from '@/app/ui/yard/yardPricing';

type YardJob = {
  job_id: string;
  address?: string;
  polygon_geojson?: LatLng[][];
  area_m2: number | null;
  price: number;
  status: 'draft' | 'ready' | 'completed';
};

type YardMeasurementConfig = {
  mode: 'area' | 'perimeter';
  field: string;
  label: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SetFunction = (key: any, value: any) => void;

type YardConditionLevel = 'light' | 'standard' | 'heavy';

type UseYardMappingProps = {
  scope: string;
  yardJobs: YardJob[] | null;
  yardActiveJobId: string | null;
  paramsByService: any;
  secondStorey: boolean;
  conditionLevel: YardConditionLevel;
  clutterAccess: boolean;
  context: string;
  set: SetFunction;
  getYardMeasurementConfig: (scope: string) => YardMeasurementConfig;
  computeYardQuote: (params: any, options: any) => { cost: number };
  onAddressSelected?: (address: string, coords?: { lat: number; lng: number }) => void;
};

// Debounce utility — kept for legacy callers, but useYardMapping now uses a
// ref-based stable debounce (see below) so renders don't drop pending updates.
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function useYardMapping({
  scope,
  yardJobs,
  yardActiveJobId,
  paramsByService,
  secondStorey,
  conditionLevel,
  clutterAccess,
  context,
  set,
  getYardMeasurementConfig,
  computeYardQuote,
  onAddressSelected,
}: UseYardMappingProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const yardJobsRef = useRef<YardJob[]>(yardJobs || []);
  const yardActiveJobIdRef = useRef<string | null>(yardActiveJobId);
  const [isCalculating, setIsCalculating] = useState(false);

  // Use refs for values that don't need to trigger callback re-creation
  const scopeRef = useRef(scope);
  const paramsRef = useRef(paramsByService);
  const secondStoreyRef = useRef(secondStorey);
  const conditionLevelRef = useRef(conditionLevel);
  const clutterAccessRef = useRef(clutterAccess);
  const contextRef = useRef(context);

  // Update refs when values change
  useEffect(() => {
    scopeRef.current = scope;
    paramsRef.current = paramsByService;
    secondStoreyRef.current = secondStorey;
    conditionLevelRef.current = conditionLevel;
    clutterAccessRef.current = clutterAccess;
    contextRef.current = context;
  }, [scope, paramsByService, secondStorey, conditionLevel, clutterAccess, context]);

  useEffect(() => {
    yardJobsRef.current = yardJobs || [];
  }, [yardJobs]);

  useEffect(() => {
    yardActiveJobIdRef.current = yardActiveJobId;
  }, [yardActiveJobId]);

  const activeYardJob = useMemo(() => {
    const jobs = yardJobs || [];
    if (!jobs.length) return null;
    if (yardActiveJobId) {
      return jobs.find((job) => job.job_id === yardActiveJobId) ?? jobs[0];
    }
    return jobs[0];
  }, [yardJobs, yardActiveJobId]);

  const postMessageToIframe = useCallback((message: unknown) => {
    if (typeof window === 'undefined') return;
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(message, window.location.origin);
  }, []);

  /** Send all zones to the iframe map. Each element is one zone's coord array. */
  const postZonesToIframe = useCallback((zones: LatLng[][]) => {
    if (typeof window === 'undefined') return;
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage({ type: 'YARD_SET_ZONES', zones }, window.location.origin);
  }, []);

  /** @deprecated Use postZonesToIframe instead. Wraps single polygon as one zone. */
  const postPolygonToIframe = useCallback((coords: LatLng[]) => {
    postZonesToIframe(coords.length >= 3 ? [coords] : []);
  }, [postZonesToIframe]);

  const updateYardJob = useCallback(
    (id: string, updater: (job: YardJob) => YardJob) => {
      const nextJobs = (yardJobsRef.current || []).map((j) => (j.job_id === id ? updater(j) : j));
      set('yardJobs', nextJobs as any);
    },
    [set]
  );

  // Memoize expensive calculations
  const computeMeasurements = useCallback((zones: LatLng[][]) => {
    const area = zones.reduce((sum, zone) => sum + computeAreaFromPath(zone), 0);
    const perimeter = zones.reduce((sum, zone) => sum + computePerimeterFromPath(zone), 0);
    return { area, perimeter };
  }, []);

  // ── Canonical compute-and-commit pipeline ──────────────────────────────────
  //
  // Single path for turning a set of zones into (measurement → params → price →
  // state commit). Called by the debounced message handler AND by the
  // scope-sync effect, so there's no race between the two.
  //
  // The function reads every piece of state from refs so its identity never
  // has to change — that's what makes the debounced wrapper below safe to
  // build once for the life of the hook.
  const computeAndCommit = useCallback(
    (zones: LatLng[][]) => {
      setIsCalculating(true);

      const { area, perimeter } = computeMeasurements(zones);
      const pricingScope = contextRef.current === 'ndis' ? 'yard_mow' : scopeRef.current;
      const measurement = getYardMeasurementConfig(pricingScope);
      const measurementValue = measurement.mode === 'perimeter' ? perimeter : area;

      const currentYardParams = paramsRef.current.yard || {};
      const nextYardParams = {
        ...currentYardParams,
        [measurement.field]: measurementValue,
        // yard_area is a fallback the engine also accepts. Always stamp it so
        // a scope switch (e.g. mow → blast) still has an area to read from.
        ...(measurement.mode === 'area' ? { yard_area: measurementValue } : {}),
      };

      // Condition level is passed through as a string; engine.ts maps it to
      // the DifficultyFlags shape. (The old numeric `conditionMultiplier`
      // pathway is kept for back-compat but no longer drives pricing.)
      const yardCondMap: Record<YardConditionLevel, number> = {
        light: 0.9,
        standard: 1,
        heavy: 1.18,
      };

      const price =
        contextRef.current === 'ndis'
          ? 0
          : Math.max(0, computeYardQuote(nextYardParams, {
              scope: pricingScope,
              isTwoStoreyGutter: secondStoreyRef.current,
              conditionMultiplier: yardCondMap[conditionLevelRef.current] ?? 1,
              accessTight: clutterAccessRef.current,
              conditionLevel: conditionLevelRef.current,
              context: contextRef.current,
            }).cost);
      const activeId = yardActiveJobIdRef.current || yardJobsRef.current[0]?.job_id || null;

      // Batch: params + geometry state
      set('paramsByService', { ...paramsRef.current, yard: nextYardParams });
      set('yardPolygon', zones);
      set('yardArea', area || null);
      set('yardPerimeter', perimeter || null);

      if (activeId) {
        updateYardJob(activeId, (job) => ({
          ...job,
          polygon_geojson: zones,
          area_m2: area || null,
          price,
          status: 'draft',
        }));
      }

      setIsCalculating(false);
    },
    // `set`, `updateYardJob`, `getYardMeasurementConfig`, `computeYardQuote`
    // and `computeMeasurements` are the only deps that are actually used at
    // call-time. Everything that varies per-render (scope, params, flags,
    // active job) is read from refs, so identity stays stable as long as the
    // parent passes stable versions of these props.
    [set, updateYardJob, getYardMeasurementConfig, computeYardQuote, computeMeasurements]
  );

  // ── Ref-based debounce ─────────────────────────────────────────────────────
  //
  // The previous implementation used useMemo(() => debounce(fn, 150), [fn]).
  // That looks fine until you notice that `fn` was recreated on every render
  // (its deps included `set`, which the parent often passes as a fresh
  // reference). A fresh `fn` meant a fresh debounced wrapper with a fresh
  // internal timeout — so any in-flight pending call was silently dropped
  // the moment React re-rendered. That's the "price jumps / doesn't update
  // on redraw" symptom.
  //
  // We fix it by holding the latest computeAndCommit in a ref and building
  // one stable debouncer for the life of the component.
  const latestComputeRef = useRef(computeAndCommit);
  useEffect(() => {
    latestComputeRef.current = computeAndCommit;
  }, [computeAndCommit]);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastZonesRef = useRef<LatLng[][] | null>(null);

  const handlePolygonChange = useCallback((zones: LatLng[][]) => {
    lastZonesRef.current = zones;

    // Leading-edge: fire immediately on the first change so the price moves
    // the moment the polygon is drawn. Subsequent rapid changes coalesce on
    // the trailing edge.
    if (!debounceTimerRef.current) {
      latestComputeRef.current(zones);
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const pending = lastZonesRef.current;
      if (pending) latestComputeRef.current(pending);
    }, 150);
  }, []);

  // Clean up any pending timer on unmount.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Kept for legacy imports — direct synchronous commit, no debounce.
  const handlePolygonChangeImmediate = computeAndCommit;

  const addYardJob = useCallback(() => {
    const createYardJob = (): YardJob => ({
      job_id: `yard_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      polygon_geojson: [],
      area_m2: null,
      price: 0,
      status: 'draft',
    });
    const job = createYardJob();
    set('yardJobs', [...(yardJobsRef.current || []), job]);
    set('yardActiveJobId', job.job_id);
  }, [set]);

  const removeYardJob = useCallback(
    (id: string) => {
      const next = (yardJobsRef.current || []).filter((j) => j.job_id !== id);
      set('yardJobs', next as any);
      const nextActive = next.length ? next[0].job_id : null;
      set('yardActiveJobId', nextActive);
      if (!nextActive) {
        postZonesToIframe([]);
        const pricingScope = contextRef.current === 'ndis' ? 'yard_mow' : scopeRef.current;
        const measurement = getYardMeasurementConfig(pricingScope);
        const yardParams = paramsRef.current.yard || {};
        const clearedParams = {
          ...yardParams,
          [measurement.field]: 0,
        };
        if (measurement.mode === 'area') {
          clearedParams.yard_area = 0;
        }
        set('paramsByService', {
          ...paramsRef.current,
          yard: clearedParams,
        });
      }
    },
    [set, postZonesToIframe, getYardMeasurementConfig]
  );

  const resetActivePolygon = useCallback(() => {
    postZonesToIframe([]);
    set('yardPolygon', []);
    set('yardArea', null);
    set('yardPerimeter', null);

    const pricingScope = contextRef.current === 'ndis' ? 'yard_mow' : scopeRef.current;
    const measurement = getYardMeasurementConfig(pricingScope);
    const yardParams = paramsRef.current.yard || {};
    const clearedParams = {
      ...yardParams,
      [measurement.field]: 0,
    };
    if (measurement.mode === 'area') {
      clearedParams.yard_area = 0;
    }

    set('paramsByService', {
      ...paramsRef.current,
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

    // Auto-enable drawing mode after clearing
    postMessageToIframe({ type: 'YARD_TOGGLE_DRAWING', enabled: true });
  }, [set, postZonesToIframe, activeYardJob, updateYardJob, getYardMeasurementConfig, postMessageToIframe]);

  // Listen to messages from iframe
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; zones?: unknown; coords?: unknown; address?: string };
      if (!data || typeof data.type !== 'string') return;

      if (data.type === 'YARD_POLYGON_CHANGE') {
        // New multi-zone format: data.zones is LatLng[][]
        if (Array.isArray(data.zones)) {
          const normalizedZones: LatLng[][] = data.zones
            .map((zone: any) =>
              (Array.isArray(zone) ? zone : [])
                .map((entry: any) => ({
                  lat: Number(entry?.lat),
                  lng: Number(entry?.lng),
                }))
                .filter((pt: any) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng))
            )
            .filter((zone: LatLng[]) => zone.length >= 3);
          handlePolygonChange(normalizedZones);
          return;
        }
        // Legacy format: data.coords is a flat LatLng[] (single polygon)
        if (Array.isArray(data.coords)) {
          const normalized: LatLng[] = (data.coords as any[])
            .map((entry: any) => ({ lat: Number(entry?.lat), lng: Number(entry?.lng) }))
            .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng));
          if (normalized.length >= 3) {
            handlePolygonChange([normalized]);
          }
          return;
        }
      }

      if (data.type === 'YARD_ADDRESS') {
        const address = typeof data.address === 'string' ? data.address.trim() : '';
        if (!address) return;
        const coordsCandidate = data.coords as { lat?: unknown; lng?: unknown } | undefined;
        const coords =
          Number.isFinite(Number(coordsCandidate?.lat)) && Number.isFinite(Number(coordsCandidate?.lng))
            ? { lat: Number(coordsCandidate?.lat), lng: Number(coordsCandidate?.lng) }
            : undefined;
        const jobs = yardJobsRef.current || [];
        const activeId = yardActiveJobIdRef.current || jobs[0]?.job_id;
        if (!activeId) return;
        const nextJobs = jobs.map((job) =>
          job.job_id === activeId ? { ...job, address } : job
        );
        set('yardJobs', nextJobs as any);
        onAddressSelected?.(address, coords);
      }

      // The iframe map has finished initialising (Google Maps loaded, message
      // listener wired up, polygon-applier ready). Re-send zones + scope now
      // so the freshly-mounted map renders them — this fixes the "Step 3 →
      // Edit zones lands on the default Brisbane view" bug, where the
      // parent's iframe.onLoad fired too early (before the map was ready) and
      // the zones were silently dropped.
      if (data.type === 'YARD_MAP_READY') {
        const job = yardJobsRef.current?.find(
          (j) => j.job_id === yardActiveJobIdRef.current
        ) ?? yardJobsRef.current?.[0];
        const zones = job?.polygon_geojson ?? [];
        postZonesToIframe(zones);
        // Reuse the same scope-resolution rule as the iframe.onLoad path so
        // perimeter scopes (yard_hedge, gutter_clean) re-style correctly.
        postMessageToIframe({
          type: 'YARD_SET_SCOPE',
          scope: contextRef.current === 'ndis' ? 'yard_mow' : scopeRef.current,
        });
        return;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handlePolygonChange, onAddressSelected, set, postZonesToIframe, postMessageToIframe]);

  // Sync zones to the iframe when active job or scope changes, and trigger a
  // single canonical recompute through computeAndCommit.
  //
  // NOTE: previously this effect ran its own parallel price calculation. When
  // it fired mid-drag it would race with the debounced polygon handler and
  // produce the "price jumps / goes stale" symptom. Now it delegates to
  // computeAndCommit so there is exactly one code path that owns pricing.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = iframeRef.current?.contentWindow;
    if (!target) return;

    const zones = activeYardJob?.polygon_geojson || [];
    postZonesToIframe(zones);
    postMessageToIframe({ type: 'YARD_SET_SCOPE', scope: context === 'ndis' ? 'yard_mow' : scope });

    // If there's nothing drawn, just clear geometry state — no price to compute.
    if (!zones.some((z) => z.length >= 3)) {
      set('yardPolygon', zones);
      set('yardArea', null);
      set('yardPerimeter', null);
      return;
    }

    // Cancel any pending debounced update so we don't overwrite this one,
    // then recompute synchronously for the new scope/job.
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    computeAndCommit(zones);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeYardJob?.job_id, context, scope, postZonesToIframe, postMessageToIframe, computeAndCommit, set]);

  return {
    iframeRef,
    activeYardJob,
    handlePolygonChange,
    postMessageToIframe,
    postPolygonToIframe,
    postZonesToIframe,
    addYardJob,
    removeYardJob,
    resetActivePolygon,
    updateYardJob,
    isCalculating,
  };
}
