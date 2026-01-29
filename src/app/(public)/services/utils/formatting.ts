// String utilities
export const cls = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(' ');

export const titleCase = (s: string) =>
  s.replace(/\b([a-z])/gi, (m) => m.toUpperCase()).replace(/\s{2,}/g, ' ').trim();

// Number utilities
export const toNumber = (v: unknown, fallback = 0): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  const n = Number((v as any)?.valueOf?.() ?? v);
  return Number.isFinite(n) ? n : fallback;
};

export const fmtAUD = (v: unknown) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toNumber(v));

export const roundTo = (n: number, mult = 10) => Math.round(n / mult) * mult;
export const roundTo5 = (n: number) => Math.ceil(n / 5) * 5;
export const roundToHalfHour = (hours: number) => Math.ceil(hours * 2) / 2;

export const num = (v: any, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
export const clamp = (v: number, min = 0, max = Infinity) => Math.max(min, Math.min(max, v));

export const toSafeInt = (n: unknown): number => {
  const v = Number.isFinite(n as number) ? (n as number) : 0;
  return Math.max(0, Math.floor(v));
};

// Time formatting
export function fmtHrMin(mins: number) {
  if (!Number.isFinite(mins) || mins < 1) return '0 min';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h === 0) parts.push(`${m}m`);
  return parts.join(' ');
}

export function fmtHrMinPretty(mins: number) {
  if (!Number.isFinite(mins) || mins < 1) return '0 minutes';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m > 0) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  return parts.join(' ');
}

export function fmtHrMinCompact(mins: number) {
  if (!Number.isFinite(mins) || mins < 1) return '0';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

// Region helper
export const canonicalServiceRegion = (value?: string | null, serviceRegions: readonly string[] = []) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const exact = serviceRegions.find((region) => region.toLowerCase() === lower);
  if (exact) return exact;
  const containsMatch = serviceRegions.find((region) => lower.includes(region.toLowerCase()));
  return containsMatch ?? trimmed;
};
