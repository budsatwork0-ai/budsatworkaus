import { useCallback, useRef, useState } from 'react';
import type { RegoState, VehicleDetails } from '@/lib/rego/types';

type LookupArgs = { registrationNumber: string; state: RegoState };

export function useRegoLookup() {
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setVehicle(null);
    setLoading(false);
    setError(null);
  }, []);

  const lookup = useCallback(async ({ registrationNumber, state }: LookupArgs) => {
    const cleanedRego = registrationNumber.trim();
    if (!cleanedRego) {
      setError('Enter a registration number.');
      setVehicle(null);
      return null;
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
      if (!next?.make || !next?.model || typeof next.bodyStyle !== 'string' || !next.category) {
        throw new Error('Lookup returned incomplete vehicle data.');
      }

      setVehicle(next);
      return next;
    } catch (err) {
      if ((err as any)?.name === 'AbortError') return null;
      setVehicle(null);
      setError(err instanceof Error ? err.message : 'Lookup failed.');
      return null;
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  return { vehicle, loading, error, lookup, reset };
}
