import type { RouteLocation, RouteLookupResult } from '../../types';
import { GOOGLE_MAPS_API_KEY, ROUTE_AVG_SPEED_KMH, QLD_BOUNDS } from '../pricing/constants';

// Math utilities
export const roundToHalfKm = (value: number) => Math.round(value * 2) / 2;
const toRadians = (value: number) => (value * Math.PI) / 180;

// Haversine distance calculation
export const haversineDistanceKm = (a: RouteLocation, b: RouteLocation) => {
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

// Fallback route calculation using haversine
export const fallbackRoute = (pickup: RouteLocation, dropoff: RouteLocation): RouteLookupResult => {
  const distanceKm = haversineDistanceKm(pickup, dropoff);
  const durationMinutes = Math.max(1, (distanceKm / ROUTE_AVG_SPEED_KMH) * 60);
  return { distanceKm, durationMinutes };
};

// Format route key for caching
export const formatRouteKey = (pickup: RouteLocation, dropoff: RouteLocation) =>
  `${pickup.lat.toFixed(5)},${pickup.lng.toFixed(5)}|${dropoff.lat.toFixed(5)},${dropoff.lng.toFixed(5)}`;

// Check if place is in Queensland
export const isQueenslandPlace = (place?: google.maps.places.PlaceResult | null) =>
  Boolean(
    place?.address_components?.some(
      (comp) =>
        comp.types?.includes('administrative_area_level_1') &&
        (comp.short_name === 'QLD' || comp.long_name?.toLowerCase().includes('queensland'))
    )
  );

// Fetch driving distance using Google Maps API
export async function fetchDrivingDistance(
  pickup: RouteLocation,
  dropoff: RouteLocation
): Promise<RouteLookupResult> {
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
