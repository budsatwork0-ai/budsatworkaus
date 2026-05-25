import { useRef, useState, useEffect } from 'react';
import type { RouteLocation, RouteLookupResult } from '../../types';
import {
  fetchDrivingDistance,
  fallbackRoute,
  formatRouteKey,
  roundToHalfKm,
} from '../routing';

export interface RouteResult {
  result: RouteLookupResult | null;
  loading: boolean;
  message: string | null;
}

export function useRouteResult(
  pickup: RouteLocation | null | undefined,
  dropoff: RouteLocation | null | undefined,
  active: boolean,
): RouteResult {
  const cache = useRef<Map<string, RouteLookupResult>>(new Map());
  const [result, setResult] = useState<RouteLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !pickup || !dropoff) {
      setResult(null);
      setLoading(false);
      setMessage(null);
      return;
    }

    const key = formatRouteKey(pickup, dropoff);
    const cached = cache.current.get(key);
    if (cached) {
      setResult(cached);
      setLoading(false);
      setMessage(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setMessage(null);

    (async () => {
      try {
        const raw = await fetchDrivingDistance(pickup, dropoff);
        const rounded: RouteLookupResult = {
          distanceKm: roundToHalfKm(raw.distanceKm),
          durationMinutes: Math.max(1, raw.durationMinutes),
        };
        cache.current.set(key, rounded);
        if (!cancelled) {
          setResult(rounded);
          setLoading(false);
        }
      } catch {
        if (cancelled) return;
        const fb = fallbackRoute(pickup, dropoff);
        const rounded: RouteLookupResult = {
          distanceKm: roundToHalfKm(fb.distanceKm),
          durationMinutes: Math.max(1, fb.durationMinutes),
        };
        cache.current.set(key, rounded);
        setResult(rounded);
        setLoading(false);
        setMessage('Using straight-line distance; refine addresses for a more accurate total.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, pickup, dropoff]);

  return { result, loading, message };
}
