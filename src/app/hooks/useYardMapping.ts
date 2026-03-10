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
};

// Debounce utility
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

  // Optimized polygon change handler with debouncing and batched updates
  // Now accepts an array of zones (multi-polygon support)
  const handlePolygonChangeImmediate = useCallback(
    (zones: LatLng[][]) => {
      setIsCalculating(true);

      const { area, perimeter } = computeMeasurements(zones);
      const measurement = getYardMeasurementConfig(scopeRef.current);
      const measurementValue = measurement.mode === 'perimeter' ? perimeter : area;

      const currentYardParams = paramsRef.current.yard || {};
      const nextYardParams = {
        ...currentYardParams,
        [measurement.field]: measurementValue,
        ...(measurement.mode === 'area' ? { yard_area: measurementValue } : {}),
      };

      const yardCondMap: Record<YardConditionLevel, number> = {
        light: 0.9,
        standard: 1,
        heavy: 1.18,
      };

      const yardQuote = computeYardQuote(nextYardParams, {
        scope: scopeRef.current,
        isTwoStoreyGutter: secondStoreyRef.current,
        conditionMultiplier: yardCondMap[conditionLevelRef.current] ?? 1,
        accessTight: clutterAccessRef.current,
        conditionLevel: conditionLevelRef.current,
        context: contextRef.current,
      });

      const price = Math.max(0, yardQuote.cost);

      // Batch all state updates together
      const updates: Record<string, any> = {
        paramsByService: {
          ...paramsRef.current,
          yard: nextYardParams,
        },
        yardPolygon: zones,
        yardArea: area || null,
        yardPerimeter: perimeter || null,
      };

      Object.entries(updates).forEach(([key, value]) => {
        set(key as any, value);
      });

      if (activeYardJob?.job_id) {
        updateYardJob(activeYardJob.job_id, (job) => ({
          ...job,
          polygon_geojson: zones,
          area_m2: area || null,
          price,
          status: 'draft',
        }));
      }

      setIsCalculating(false);
    },
    [activeYardJob?.job_id, set, updateYardJob, getYardMeasurementConfig, computeYardQuote, computeMeasurements]
  );

  // Debounced version for real-time updates
  const handlePolygonChange = useMemo(
    () => debounce(handlePolygonChangeImmediate, 150),
    [handlePolygonChangeImmediate]
  );

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
        const measurement = getYardMeasurementConfig(scopeRef.current);
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

    const measurement = getYardMeasurementConfig(scopeRef.current);
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
        const jobs = yardJobsRef.current || [];
        const activeId = yardActiveJobIdRef.current || jobs[0]?.job_id;
        if (!activeId) return;
        const nextJobs = jobs.map((job) =>
          job.job_id === activeId ? { ...job, address } : job
        );
        set('yardJobs', nextJobs as any);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handlePolygonChange, set]);

  // Sync zones when active job or scope changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = iframeRef.current?.contentWindow;
    if (!target) return;

    // All zones for the active job
    const zones = activeYardJob?.polygon_geojson || [];
    postZonesToIframe(zones);
    postMessageToIframe({ type: 'YARD_SET_SCOPE', scope });

    const { area, perimeter } = computeMeasurements(zones);
    const measurement = getYardMeasurementConfig(scope);
    const measurementValue = measurement.mode === 'perimeter' ? perimeter : area;

    const currentYardParams = paramsRef.current.yard || {};
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
        ...paramsRef.current,
        yard: nextYardParams,
      });
    }

    set('yardPolygon', zones);
    set('yardArea', area || null);
    set('yardPerimeter', perimeter || null);

    // Recalculate job price when scope changes
    if (activeYardJob?.job_id && zones.some((z) => z.length >= 3)) {
      const yardCondMap: Record<YardConditionLevel, number> = {
        light: 0.9,
        standard: 1,
        heavy: 1.18,
      };

      const yardQuote = computeYardQuote(nextYardParams, {
        scope,
        isTwoStoreyGutter: secondStoreyRef.current,
        conditionMultiplier: yardCondMap[conditionLevelRef.current] ?? 1,
        accessTight: clutterAccessRef.current,
        conditionLevel: conditionLevelRef.current,
        context: contextRef.current,
      });

      const price = Math.max(0, yardQuote.cost);

      updateYardJob(activeYardJob.job_id, (job) => ({
        ...job,
        area_m2: area || null,
        price,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeYardJob?.job_id, scope, postZonesToIframe, set, getYardMeasurementConfig, computeMeasurements, computeYardQuote, updateYardJob]);

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
