import { useCallback, useRef, useState } from 'react';
import type { RegoState, VehicleDetails } from '@/lib/rego/types';

type LookupArgs = { registrationNumber: string; state: RegoState };
type LookupMeta = {
  source: 'memory' | 'session' | 'cache' | 'provider' | 'mock' | 'unknown';
  durationMs: number | null;
};

type CachedLookup = {
  vehicle: VehicleDetails;
  meta: LookupMeta;
};

const SESSION_KEY_PREFIX = 'budsatwork.regoLookup.';
const memoryCache = new Map<string, CachedLookup>();

function cacheKey({ registrationNumber, state }: LookupArgs) {
  return `${state}:${registrationNumber.trim().toUpperCase()}`;
}

function readSessionCache(key: string): CachedLookup | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`${SESSION_KEY_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLookup | null;
    if (!parsed?.vehicle?.make || !parsed?.vehicle?.model) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCache(key: string, value: CachedLookup) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`${SESSION_KEY_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

export function useRegoLookup() {
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<LookupMeta | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setVehicle(null);
    setLoading(false);
    setError(null);
    setMeta(null);
  }, []);

  const lookup = useCallback(async ({ registrationNumber, state }: LookupArgs) => {
    const cleanedRego = registrationNumber.trim();
    if (!cleanedRego) {
      setError('Enter a registration number.');
      setVehicle(null);
      setMeta(null);
      return null;
    }

    const key = cacheKey({ registrationNumber: cleanedRego, state });
    const fromMemory = memoryCache.get(key);
    if (fromMemory) {
      setError(null);
      setVehicle(fromMemory.vehicle);
      setMeta({ ...fromMemory.meta, source: 'memory' });
      return fromMemory.vehicle;
    }

    const fromSession = readSessionCache(key);
    if (fromSession) {
      memoryCache.set(key, fromSession);
      setError(null);
      setVehicle(fromSession.vehicle);
      setMeta({ ...fromSession.meta, source: 'session' });
      return fromSession.vehicle;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ registrationNumber: cleanedRego, state });
      const res = await fetch(`/api/rego-lookup?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      const data = (await res.json()) as unknown;
      if (!res.ok) {
        const msg =
          data && typeof data === 'object' && 'error' in data ? String((data as any).error) : null;
        throw new Error(msg || `Lookup failed (${res.status})`);
      }

      const next = data as VehicleDetails;
      if (!next?.make || !next?.model) {
        throw new Error('Lookup returned incomplete vehicle data.');
      }

      // Ensure defaults for optional fields
      const vehicle: VehicleDetails = {
        make: next.make,
        model: next.model,
        year: next.year ?? null,
        bodyStyle: next.bodyStyle ?? '',
        doors: next.doors ?? null,
        seats: next.seats ?? null,
        category: next.category ?? 'unknown',
        sizeCategory: next.sizeCategory ?? null,
      };

      const responseMeta: LookupMeta = {
        source:
          (res.headers.get('x-rego-source') as LookupMeta['source'] | null) ??
          (typeof (data as any)?.source === 'string' ? ((data as any).source as LookupMeta['source']) : null) ??
          'unknown',
        durationMs:
          Number.parseInt(res.headers.get('x-rego-duration-ms') ?? '', 10) ||
          (typeof (data as any)?.lookupDurationMs === 'number' ? (data as any).lookupDurationMs : null),
      };

      setVehicle(vehicle);
      setMeta(responseMeta);
      const cacheValue = { vehicle, meta: responseMeta };
      memoryCache.set(key, cacheValue);
      writeSessionCache(key, cacheValue);
      return vehicle;
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return null;
      setVehicle(null);
      setError(err instanceof Error ? err.message : 'Lookup failed.');
      setMeta(null);
      return null;
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  return { vehicle, loading, error, meta, lookup, reset };
}
