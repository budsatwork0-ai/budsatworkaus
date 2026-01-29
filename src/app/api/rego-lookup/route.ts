import { NextRequest, NextResponse } from 'next/server';
import type { RegoState, VehicleDetails } from '@/lib/rego/types';
import { classifyVehicle } from '@/lib/rego/classify';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const SUPPORTED_STATES: RegoState[] = ['QLD'];

function isRegoState(value: string): value is RegoState {
  return (SUPPORTED_STATES as readonly string[]).includes(value);
}

function isDev() {
  return process.env.NODE_ENV !== 'production';
}

const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function supabaseSafe() {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

const normalizeKey = (value: string) => value.trim().toUpperCase();
const normalizeMatch = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

async function fetchCache(
  rego: string,
  state: RegoState
): Promise<VehicleDetails | null> {
  const client = supabaseSafe();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('rego_cache')
      .select('vehicle_data, expires_at')
      .eq('rego', normalizeKey(rego))
      .eq('state', normalizeKey(state))
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();
    if (error || !data?.vehicle_data) return null;
    return {
      ...(data.vehicle_data as VehicleDetails),
      categorySource: 'cache',
      source: 'cache',
    };
  } catch {
    return null;
  }
}

async function writeCache(rego: string, state: RegoState, vehicle: VehicleDetails) {
  const client = supabaseSafe();
  if (!client) return;
  try {
    await client.from('rego_cache').upsert({
      rego: normalizeKey(rego),
      state: normalizeKey(state),
      vehicle_data: vehicle,
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    });
  } catch {
    // Swallow cache errors to avoid blocking lookup.
  }
}

type OverrideRow = { category: string; model_pattern: string | null };
const VALID_CATEGORIES: Set<string> = new Set([
  'hatch',
  'sedan',
  'suv',
  'ute',
  'van',
  '4wd',
  'luxury',
  'muscle',
]);

function matchesPattern(model: string, pattern: string | null | undefined) {
  if (!pattern) return false;
  const pat = pattern.trim();
  if (!pat) return false;
  const normalizedModel = normalizeMatch(model);
  const normalizedPattern = normalizeMatch(pat);
  if (normalizedPattern && normalizedModel.includes(normalizedPattern)) return true;
  try {
    const re = new RegExp(pat, 'i');
    return re.test(model);
  } catch {
    return false;
  }
}

async function applyOverrides(
  vehicle: VehicleDetails
): Promise<{ vehicle: VehicleDetails; source: 'override' | 'rules' }> {
  const client = supabaseSafe();
  if (!client)
    return {
      vehicle: { ...vehicle, categorySource: 'rules', source: 'rules' },
      source: 'rules',
    };

  const makeNorm = vehicle.make.trim();
  try {
    const { data, error } = await client
      .from('vehicle_overrides')
      .select('category, model_pattern, priority')
      .ilike('make', makeNorm)
      .order('priority', { ascending: false })
      .limit(20);

    if (!error && Array.isArray(data)) {
      const match = (data as (OverrideRow & { priority: number })[]).find((row) =>
        matchesPattern(vehicle.model, row.model_pattern)
      );
      if (match) {
        const cat = match.category.toLowerCase();
        if (VALID_CATEGORIES.has(cat)) {
          return {
            vehicle: {
              ...vehicle,
              category: cat as any,
              categorySource: 'override',
              source: 'override',
            },
            source: 'override',
          };
        }
      }
    }
  } catch {
    // ignore override errors
  }

  return {
    vehicle: { ...vehicle, categorySource: 'rules', source: 'rules' },
    source: 'rules',
  };
}

function redactSecrets(input: string, secrets: Array<string | undefined>) {
  let out = input;
  for (const s of secrets) {
    if (!s) continue;
    if (!s.trim()) continue;
    out = out.replaceAll(s, '***');
  }
  return out;
}

function safeProviderHint(url: URL) {
  const safe = new URL(url.toString());
  safe.searchParams.delete('password');
  safe.searchParams.delete('REGCHECK_PASSWORD');
  safe.searchParams.delete('REGCHECK_USERNAME');
  safe.searchParams.delete('username');
  safe.searchParams.delete('apiKey');
  safe.searchParams.delete('key');
  safe.searchParams.delete('token');
  return `${safe.origin}${safe.pathname}`;
}

function decodeXmlEntities(input: string) {
  return input
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function tryParseJsonFromText(rawText: string): unknown | null {
  const text = rawText.replace(/^\uFEFF/, '').trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {}

  // ASMX services often wrap JSON inside XML: <string>...json...</string>
  const withoutTags = decodeXmlEntities(text.replace(/<[^>]*>/g, '').trim());
  if (!withoutTags) return null;

  const objectCandidate = (() => {
    const start = withoutTags.indexOf('{');
    const end = withoutTags.lastIndexOf('}');
    if (start >= 0 && end > start) return withoutTags.slice(start, end + 1);
    return null;
  })();

  if (objectCandidate) {
    try {
      return JSON.parse(objectCandidate);
    } catch {}
  }

  const arrayCandidate = (() => {
    const start = withoutTags.indexOf('[');
    const end = withoutTags.lastIndexOf(']');
    if (start >= 0 && end > start) return withoutTags.slice(start, end + 1);
    return null;
  })();

  if (arrayCandidate) {
    try {
      return JSON.parse(arrayCandidate);
    } catch {}
  }

  return null;
}

function normalizeInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readTextValue(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (!value || typeof value !== 'object') return null;

  const obj = value as Record<string, unknown>;
  const candidates: unknown[] = [
    obj.CurrentTextValue,
    obj.currentTextValue,
    obj.Value,
    obj.value,
    obj.Text,
    obj.text,
    obj.Name,
    obj.name,
    obj.Description,
    obj.description,
  ];

  for (const c of candidates) {
    if (typeof c === 'string') return c;
    if (typeof c === 'number' && Number.isFinite(c)) return String(c);
  }

  return null;
}

function readIntValue(value: unknown): number | null {
  const text = readTextValue(value);
  if (text != null) return normalizeInt(text);
  return normalizeInt(value);
}

function extractProviderMessage(payload: unknown): string | null {
  const text = readTextValue(payload);
  if (text) return text;

  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const candidates: unknown[] = [
      obj.error,
      obj.Error,
      obj.message,
      obj.Message,
      obj.description,
      obj.Description,
      obj.Result,
      obj.result,
      obj.Status,
      obj.status,
    ];
    for (const c of candidates) {
      const t = readTextValue(c);
      if (t) return t;
    }
  }

  return null;
}

function normalizeVehicleDetails(payload: unknown): VehicleDetails | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;

  const make =
    readTextValue(obj.make) ??
    readTextValue(obj.Make) ??
    readTextValue(obj.manufacturer) ??
    readTextValue(obj.brand) ??
    readTextValue(obj.CarMake) ??
    readTextValue(obj.carMake);

  const model =
    readTextValue(obj.model) ??
    readTextValue(obj.Model) ??
    readTextValue(obj.series) ??
    readTextValue(obj.variant) ??
    readTextValue(obj.CarModel) ??
    readTextValue(obj.carModel);

  const bodyStyle =
    readTextValue(obj.bodyStyle) ??
    readTextValue(obj.BodyStyle) ??
    readTextValue(obj.body_style) ??
    readTextValue(obj.bodyType) ??
    readTextValue(obj.body) ??
    readTextValue(obj.vehicleType);

  if (!make || !model) return null;

  const normalizedMake = String(make).trim();
  const normalizedModel = String(model).trim();
  const normalizedBodyStyle = bodyStyle ? String(bodyStyle).trim() : '';

  const year = readIntValue(
    obj.year ??
      obj.Year ??
      obj.RegistrationYear ??
      obj.registrationYear ??
      obj.yearOfManufacture ??
      obj.manufactureYear ??
      obj.ManufactureYear ??
      obj.BuildYear ??
      obj.buildYear
  );

  const doors = readIntValue(obj.doors ?? obj.Doors ?? obj.doorCount ?? obj.numDoors ?? obj.DoorCount);
  const seats = readIntValue(obj.seats ?? obj.Seats ?? obj.seatCount ?? obj.numSeats ?? obj.SeatCount);
  const classification = classifyVehicle({
    make: normalizedMake,
    model: normalizedModel,
    bodyStyle: normalizedBodyStyle,
    seats,
  });

  return {
    make: normalizedMake,
    model: normalizedModel,
    year,
    bodyStyle: normalizedBodyStyle,
    doors,
    seats,
    category: classification.category,
    sizeCategory: classification.sizeCategory,
  };
}

function pickVehiclePayload(providerResponse: unknown): unknown {
  let current: unknown = providerResponse;
  for (let i = 0; i < 4; i++) {
    if (!current || typeof current !== 'object') return current;
    const obj = current as Record<string, unknown>;

    const candidate =
      obj.vehicleJson ??
      obj.VehicleJson ??
      obj.d ??
      obj.CheckAustraliaResult ??
      (obj.CheckAustraliaResponse && typeof obj.CheckAustraliaResponse === 'object'
        ? (obj.CheckAustraliaResponse as any).CheckAustraliaResult
        : undefined) ??
      obj.vehicle ??
      obj.result ??
      obj.data ??
      current;

    if (typeof candidate === 'string') {
      current = tryParseJsonFromText(candidate) ?? candidate;
      continue;
    }

    if (candidate === current) return current;
    current = candidate;
  }

  return current;
}

function mockLookup(registrationNumber: string, state: RegoState): VehicleDetails {
  const key = registrationNumber.replace(/\s+/g, '').toUpperCase();

  // Deterministic mock response for local/dev use.
  // Try regos like "MUS123", "LUX999", "4WD111", "UTE777", "VAN222", "HAT333".
  const mock = (() => {
    if (key.includes('MUS') || key.includes('MUSTANG')) {
      return {
        make: 'Ford',
        model: 'Mustang',
        year: 2018,
        bodyStyle: 'Coupe',
        doors: 2,
        seats: 4,
      };
    }
    if (key.includes('CAM') || key.includes('CAMARO')) {
      return {
        make: 'Chevrolet',
        model: 'Camaro',
        year: 2017,
        bodyStyle: 'Coupe',
        doors: 2,
        seats: 4,
      };
    }
    if (key.includes('CHA') || key.includes('CHARGER')) {
      return {
        make: 'Dodge',
        model: 'Charger',
        year: 2016,
        bodyStyle: 'Sedan',
        doors: 4,
        seats: 5,
      };
    }
    if (key.includes('LUX')) {
      return {
        make: 'BMW',
        model: 'X5',
        year: 2021,
        bodyStyle: 'SUV',
        doors: 5,
        seats: 5,
      };
    }
    if (key.includes('TES')) {
      return {
        make: 'Tesla',
        model: 'Model 3',
        year: 2022,
        bodyStyle: 'Sedan',
        doors: 4,
        seats: 5,
      };
    }
    if (key.includes('4WD') || key.includes('4X4')) {
      return {
        make: 'Toyota',
        model: 'Land Cruiser',
        year: 2020,
        bodyStyle: '4WD',
        doors: 5,
        seats: 7,
      };
    }
    if (key.includes('UTE')) {
      return {
        make: 'Ford',
        model: 'Ranger',
        year: 2020,
        bodyStyle: 'Utility',
        doors: 4,
        seats: 5,
      };
    }
    if (key.includes('VAN')) {
      return {
        make: 'Toyota',
        model: 'HiAce',
        year: 2019,
        bodyStyle: 'Van',
        doors: 4,
        seats: 3,
      };
    }
    if (key.includes('HAT')) {
      return {
        make: 'Hyundai',
        model: 'i30',
        year: 2018,
        bodyStyle: 'Hatch',
        doors: 5,
        seats: 5,
      };
    }
    if (key.includes('SUV')) {
      return {
        make: 'Mazda',
        model: 'CX-5',
        year: 2020,
        bodyStyle: 'SUV',
        doors: 5,
        seats: 5,
      };
    }

    // Default: something common.
    // Include state in model so it is obvious in dev that the state param is being used.
    const make = 'Toyota';
    const model = `Corolla (${state})`;
    const bodyStyle = 'Sedan';
    return {
      make,
      model,
      year: 2017,
      bodyStyle,
      doors: 4,
      seats: 5,
    };
  })();

  const classification = classifyVehicle({
    make: mock.make,
    model: mock.model,
    bodyStyle: mock.bodyStyle,
    seats: mock.seats,
  });

  return {
    ...mock,
    category: classification.category,
    sizeCategory: classification.sizeCategory,
  };
}

async function lookupFromProvider(
  registrationNumber: string,
  state: RegoState
): Promise<VehicleDetails | null> {
  const providerUrlRaw =
    process.env.REGO_LOOKUP_PROVIDER_URL ?? process.env['rego_lookup_provider_URL'];
  const providerUrl = providerUrlRaw?.trim().replace(/[.,;]\s*$/, '');
  if (!providerUrl) return null;

  const url = new URL(providerUrl);

  // If the URL is copied from an ASMX "op=" docs page, convert it to the callable endpoint.
  const op = url.searchParams.get('op')?.trim().toLowerCase();
  if (op === 'checkaustralia') {
    url.search = '';
    if (/\/reg\.asmx$/i.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/$/, '')}/CheckAustralia`;
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  headers['User-Agent'] = 'budsatwork/rego-lookup';
  const apiKey = process.env.REGO_LOOKUP_PROVIDER_API_KEY;
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers['x-api-key'] = apiKey;
  }

  const regcheckUsername = process.env.REGCHECK_USERNAME;
  const regcheckPassword = process.env.REGCHECK_PASSWORD;

  const isRegCheck = url.hostname.toLowerCase().includes('regcheck.org.uk');
  if (isRegCheck) {
    // RegCheck ASMX method binding is strict; send only expected parameter names.
    url.searchParams.set('RegistrationNumber', registrationNumber);
    url.searchParams.set('State', state);
    if (regcheckUsername) url.searchParams.set('username', regcheckUsername);
    if (regcheckPassword) url.searchParams.set('password', regcheckPassword);
  } else {
    // Generic providers.
    url.searchParams.set('rego', registrationNumber);
    url.searchParams.set('registrationNumber', registrationNumber);
    url.searchParams.set('state', state);
  }

  // Optional generic auth: allow Basic Auth via env vars (disabled for RegCheck ASMX).
  if (!isRegCheck && !apiKey && regcheckUsername && regcheckPassword) {
    const token = Buffer.from(`${regcheckUsername}:${regcheckPassword}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });

    const rawText = await res.text();

    if (!res.ok) {
      const hint = safeProviderHint(url);
      const msg = extractProviderMessage(tryParseJsonFromText(rawText)) ?? decodeXmlEntities(rawText);
      const clipped = msg.replace(/\s+/g, ' ').trim().slice(0, 180);
      throw new Error(`Provider responded ${res.status} (${hint})${clipped ? `: ${clipped}` : ''}`);
    }

    const parsed = tryParseJsonFromText(rawText);
    if (!parsed) {
      const hint = safeProviderHint(url);
      throw new Error(`Provider returned an unparseable response (${hint}).`);
    }

    const payload = pickVehiclePayload(parsed);
    const vehicle = normalizeVehicleDetails(payload);
    if (!vehicle) {
      const hint = safeProviderHint(url);
      const msg = extractProviderMessage(payload) ?? extractProviderMessage(parsed);
      const clipped = (msg ?? 'No vehicle details found.').replace(/\s+/g, ' ').trim().slice(0, 180);
      throw new Error(`Provider returned no vehicle details (${hint}): ${clipped}`);
    }

    return vehicle;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const providerUrlRaw =
    process.env.REGO_LOOKUP_PROVIDER_URL ?? process.env['rego_lookup_provider_URL'];
  const registrationNumberRaw =
    req.nextUrl.searchParams.get('registrationNumber') ??
    req.nextUrl.searchParams.get('rego') ??
    '';
  const stateRaw = req.nextUrl.searchParams.get('state') ?? '';

  const registrationNumber = registrationNumberRaw.trim();
  const state = stateRaw.trim().toUpperCase();

  if (!registrationNumber || !state) {
    return NextResponse.json(
      { error: 'Missing required query params: registrationNumber, state' },
      { status: 400 }
    );
  }

  if (!isRegoState(state)) {
    return NextResponse.json(
      { error: `Invalid state. Expected one of: ${SUPPORTED_STATES.join(', ')}` },
      { status: 400 }
    );
  }

  const typedState = state as RegoState;

  const cached = await fetchCache(registrationNumber, typedState);
  if (cached) {
    return NextResponse.json(cached, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  // If no provider is configured, serve a deterministic mock response so the UI remains usable.
  if (!providerUrlRaw) {
    const mock = mockLookup(registrationNumber, typedState);
    const finalMock = await applyOverrides(mock);
    await writeCache(registrationNumber, typedState, {
      ...finalMock.vehicle,
      categorySource: finalMock.vehicle.categorySource ?? finalMock.source,
      source: finalMock.source,
    });
    return NextResponse.json(finalMock.vehicle, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  try {
    const providerVehicle = await lookupFromProvider(registrationNumber, typedState);
    if (!providerVehicle) {
      return NextResponse.json(
        { error: 'Rego lookup provider did not return vehicle details.' },
        { status: 502 }
      );
    }

    const { vehicle: finalVehicle } = await applyOverrides(providerVehicle);
    await writeCache(registrationNumber, typedState, finalVehicle);

    return NextResponse.json(finalVehicle, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const secrets = [process.env.REGCHECK_USERNAME, process.env.REGCHECK_PASSWORD, process.env.REGO_LOOKUP_PROVIDER_API_KEY];
    const message =
      isDev()
        ? redactSecrets(
            err instanceof Error ? err.message : 'Rego lookup provider request failed.',
            secrets
          )
        : 'Rego lookup is currently unavailable. Please select car type manually.';

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
