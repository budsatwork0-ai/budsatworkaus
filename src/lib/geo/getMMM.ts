import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';

const MMM_2023_GEOJSON_URL =
  'https://services5.arcgis.com/OvOcYIrJnM97ABBA/arcgis/rest/services/Modified_Monash_Model_2023/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson';
const ARCGIS_GEOCODE_URL =
  'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type MMMPricingRegion = 'metro' | 'regional' | 'remote' | 'veryRemote';

export type MMMDetection = {
  rawMMM: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  pricingRegion: MMMPricingRegion;
  label: string;
};

export type AddressGeocode = {
  address: string;
  lat: number;
  lng: number;
  score: number;
};

type GeoJsonGeometry = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: unknown;
};

type GeoJsonFeature = {
  type: 'Feature';
  properties?: Record<string, unknown>;
  geometry?: GeoJsonGeometry | null;
};

type GeoJsonFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
};

let cachedCollection: GeoJsonFeatureCollection | null = null;
let cacheExpiresAt = 0;
let pendingFetch: Promise<GeoJsonFeatureCollection> | null = null;

export async function geocodeAddressForMMM(address: string): Promise<AddressGeocode | null> {
  const trimmed = address.trim();
  if (!trimmed) {
    throw new Error('A valid address is required.');
  }

  const url = new URL(ARCGIS_GEOCODE_URL);
  url.searchParams.set('SingleLine', trimmed);
  url.searchParams.set('f', 'json');
  url.searchParams.set('outFields', 'Match_addr,Addr_type');
  url.searchParams.set('maxLocations', '1');
  url.searchParams.set('countryCode', 'AUS');

  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Address lookup failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      address?: string;
      score?: number;
      location?: { x?: number; y?: number };
    }>;
  };
  const candidate = data.candidates?.[0];
  const lat = Number(candidate?.location?.y);
  const lng = Number(candidate?.location?.x);

  if (!candidate || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    address: candidate.address || trimmed,
    lat,
    lng,
    score: Number(candidate.score ?? 0),
  };
}

function pricingRegionForMMM(rawMMM: MMMDetection['rawMMM']): MMMPricingRegion {
  if (rawMMM === 1) return 'metro';
  if (rawMMM >= 2 && rawMMM <= 5) return 'regional';
  if (rawMMM === 6) return 'remote';
  return 'veryRemote';
}

function labelForMMM(rawMMM: MMMDetection['rawMMM'], pricingRegion: MMMPricingRegion): string {
  const regionLabel: Record<MMMPricingRegion, string> = {
    metro: 'Metro',
    regional: 'Regional',
    remote: 'Remote',
    veryRemote: 'Very remote',
  };
  return `${regionLabel[pricingRegion]} · MMM ${rawMMM}`;
}

function extractMMM(properties: Record<string, unknown> | undefined): MMMDetection['rawMMM'] | null {
  if (!properties) return null;

  const preferred = Object.entries(properties).find(([key, value]) => {
    const normalized = key.toLowerCase();
    const numeric = Number(value);
    return (
      Number.isInteger(numeric) &&
      numeric >= 1 &&
      numeric <= 7 &&
      (normalized.includes('mmm') ||
        normalized.includes('monash') ||
        normalized.includes('modified'))
    );
  });

  const fallback = preferred ?? Object.entries(properties).find(([, value]) => {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric >= 1 && numeric <= 7;
  });

  return fallback ? (Number(fallback[1]) as MMMDetection['rawMMM']) : null;
}

async function fetchMMMGeoJson(): Promise<GeoJsonFeatureCollection> {
  const now = Date.now();
  if (cachedCollection && cacheExpiresAt > now) return cachedCollection;
  if (pendingFetch) return pendingFetch;

  pendingFetch = fetch(MMM_2023_GEOJSON_URL, {
    headers: { accept: 'application/geo+json, application/json' },
    next: { revalidate: 86_400 },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`MMM GeoJSON fetch failed with ${response.status}`);
      }
      const data = (await response.json()) as GeoJsonFeatureCollection;
      if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
        throw new Error('MMM GeoJSON response was not a FeatureCollection');
      }
      cachedCollection = data;
      cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return data;
    })
    .finally(() => {
      pendingFetch = null;
    });

  return pendingFetch;
}

export async function getMMM(lat: number, lng: number): Promise<MMMDetection | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('A valid latitude and longitude are required.');
  }

  const collection = await fetchMMMGeoJson();
  const target = point([lng, lat]);

  for (const feature of collection.features) {
    if (!feature.geometry) continue;
    if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') continue;
    if (!booleanPointInPolygon(target, feature.geometry as any)) continue;

    const rawMMM = extractMMM(feature.properties);
    if (!rawMMM) return null;

    const pricingRegion = pricingRegionForMMM(rawMMM);
    return {
      rawMMM,
      pricingRegion,
      label: labelForMMM(rawMMM, pricingRegion),
    };
  }

  return null;
}

export async function getMMMForAddress(
  address: string,
): Promise<(MMMDetection & { geocode: AddressGeocode }) | null> {
  const geocode = await geocodeAddressForMMM(address);
  if (!geocode) return null;

  const detected = await getMMM(geocode.lat, geocode.lng);
  return detected ? { ...detected, geocode } : null;
}
