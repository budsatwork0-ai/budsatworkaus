const MIN_COVERAGE_MULTIPLIER = 0.3;

const roundHours = (value: number) => Math.round(Math.max(value, 0) * 10) / 10;

const clampMultiplier = (value: number) => Math.max(value, MIN_COVERAGE_MULTIPLIER);

type ConditionLevel = 'light' | 'standard' | 'heavy';

const isSteepSlope = (slopePercent?: number) => Number(slopePercent ?? 0) >= 35;

export type LawnTimeOptions = {
  conditionLevel?: ConditionLevel;
  slopePercent?: number;
  tightAccess?: boolean;
};

export type GardenTimeOptions = {
  conditionLevel?: ConditionLevel;
  slopePercent?: number;
};

export type PressureTimeOptions = {
  heavyGrime?: boolean;
  slopeOrAccess?: boolean;
};

export type HedgeTimeOptions = {
  thickTall?: boolean;
  tightAccess?: boolean;
};

export type GutterTimeOptions = {
  heavyDebris?: boolean;
  twoStorey?: boolean;
};

const computeCoverageHours = (area: number, coverageRate: number, overhead: number, multiplier: number) => {
  const effectiveRate = Math.max(coverageRate * clampMultiplier(multiplier), 1);
  return roundHours(overhead + Math.max(0, area) / effectiveRate);
};

export const estimateLawnHours = (areaM2: number, opts: LawnTimeOptions = {}) => {
  const { conditionLevel, slopePercent, tightAccess } = opts;
  let multiplier = 1;
  if (conditionLevel === 'heavy') multiplier *= 0.8;
  if (isSteepSlope(slopePercent)) multiplier *= 0.85;
  if (tightAccess) multiplier *= 0.9;
  return computeCoverageHours(areaM2, 2200, 0.75, multiplier);
};

export const estimatePressureHours = (areaM2: number, opts: PressureTimeOptions = {}) => {
  let multiplier = 1;
  if (opts.heavyGrime) multiplier *= 0.8;
  if (opts.slopeOrAccess) multiplier *= 0.85;
  return computeCoverageHours(areaM2, 80, 0.5, multiplier);
};

export const estimateGardenHours = (areaM2: number, opts: GardenTimeOptions = {}) => {
  let multiplier = 1;
  if (opts.conditionLevel === 'heavy') {
    multiplier *= 0.55;
  } else if (opts.conditionLevel === 'standard') {
    multiplier *= 0.7;
  }
  if (isSteepSlope(opts.slopePercent)) {
    multiplier *= 0.8;
  }
  return computeCoverageHours(areaM2, 30, 0.75, multiplier);
};

export const estimateHedgeHours = (perimeterM: number, opts: HedgeTimeOptions = {}) => {
  let multiplier = 1;
  if (opts.thickTall) multiplier *= 0.75;
  if (opts.tightAccess) multiplier *= 0.85;
  return computeCoverageHours(perimeterM, 20, 0.5, multiplier);
};

export const estimateGutterHours = (perimeterM: number, opts: GutterTimeOptions = {}) => {
  let multiplier = 1;
  if (opts.heavyDebris) multiplier *= 0.75;
  if (opts.twoStorey) multiplier *= 0.65;
  return computeCoverageHours(perimeterM, 30, 0.5, multiplier);
};

export const hoursToMinutes = (hours: number) => Math.round(Math.max(0, hours) * 60);

const TIME_ESTIMATE_MIN_HOURS = 0.5;

const formatRangeValue = (value: number) =>
  Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);

export const formatTimeEstimate = (estimatedHours: number) => {
  const hours = Number.isFinite(estimatedHours) ? estimatedHours : 0;
  const clamped = Math.max(hours, TIME_ESTIMATE_MIN_HOURS);
  const rounded = Math.round(clamped * 2) / 2;
  if (rounded <= 1.5) {
    return `About 1–2 hours`;
  }
  const anchor = Math.floor(rounded);
  const isHalfAnchor = Math.abs(rounded - (anchor + 0.5)) < 0.001;
  const end = isHalfAnchor ? anchor + 0.5 : anchor + 1;
  return `About ${formatRangeValue(anchor)}–${formatRangeValue(end)} hours`;
};
