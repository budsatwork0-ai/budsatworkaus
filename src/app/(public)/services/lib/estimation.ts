// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

import { toast } from 'sonner';
import type {
  Context,
  ServiceType,
  ScopeKey,
  NumericParams,
  Selected,
  QuoteParams,
  WizardState,
  CommercialCleaningType,
  CleanScopeKindV2,
  ScopeDef,
  StoreyRow,
  DumpRunSelection,
  DeliverySelection,
  TransportSelection,
  TravelBand,
  SelMap,
} from '../types';
import { clamp, fmtAUD, fmtHrMin } from '../utils/formatting';
import {
  POLICY,
  DEFAULT_DUMP_RUN,
  DEFAULT_DUMP_DELIVERY,
  DEFAULT_DUMP_TRANSPORT,
  WINDOWS_BASE_PER_STOREY_MIN,
  AUTO_SIZE_CATEGORIES,
} from './pricing/constants';
import {
  COMM_CLEAN_MIN_HOURS,
  CLEANING_HOME_MIN_HOURS_V2,
  computeHomeExtras,
  computeCleaningAddons,
  computeYardQuote,
  selectedFromParams,
  priceQuote,
  hourlyRate,
} from './pricing/engine';
import {
  SERVICES,
  SCOPES_BY_SERVICE,
  TERMS_SNIPPET,
  FAIRNESS_PROMISE_COPY,
  PRICE_SCOPE_DISCLAIMER,
} from './service-data';
import { defaultParamsByService, scopePresetFor, computeWindowsMinutes } from './service-helpers';
import type { VehicleSizeCategory } from '@/lib/rego/types';

/* ===== Math helpers ===== */

export const sumSelected = (...bags: Selected[]) => {
  const out: Selected = {};
  for (const bag of bags)
    for (const [k, v] of Object.entries(bag)) out[k] = (out[k] || 0) + (v as number);
  return out;
};

/* ===== Estimation constants ===== */

export const ESTIMATE_DISCLAIMER = 'Final timing and cost are confirmed before work begins.';
export const BASE_CALLOUT_PRICE = 79;
export const EFFORT_BLOCK_RANGE = { min: 20, max: 35, minutes: 20 };
export const PHYSICAL_BLOCK_RANGE = { min: 25, max: 50 };
export const TRAVEL_RANGES: Record<TravelBand, { min: number; max: number }> = {
  same_suburb: { min: 0, max: 0 },
  drive_30: { min: 30, max: 45 },
  drive_60: { min: 50, max: 70 },
  long: { min: 70, max: 110 },
};

type ServiceEstimate = {
  estimatedPrice: { min: number; max: number };
  estimatedTime: string;
  disclaimer: string;
};

/* ===== Travel range helper ===== */

export function travelRange(key?: TravelBand | null, km?: number) {
  if (key && TRAVEL_RANGES[key]) return TRAVEL_RANGES[key];
  if (typeof km === 'number' && Number.isFinite(km)) {
    if (km <= 10) return TRAVEL_RANGES.same_suburb;
    if (km <= 30) return TRAVEL_RANGES.drive_30;
    if (km <= 60) return TRAVEL_RANGES.drive_60;
    return TRAVEL_RANGES.long;
  }
  return TRAVEL_RANGES.same_suburb;
}

export function combinePricing(effortBlocks: number, physicalBlocks: number, travel: { min: number; max: number }) {
  const min =
    BASE_CALLOUT_PRICE +
    effortBlocks * EFFORT_BLOCK_RANGE.min +
    physicalBlocks * PHYSICAL_BLOCK_RANGE.min +
    travel.min;
  const max =
    BASE_CALLOUT_PRICE +
    effortBlocks * EFFORT_BLOCK_RANGE.max +
    physicalBlocks * PHYSICAL_BLOCK_RANGE.max +
    travel.max;
  const safeMin = Math.max(0, Math.round(min));
  const safeMax = Math.max(safeMin, Math.round(max));
  return { min: safeMin, max: safeMax };
}

/* ===== Estimated price / time (dump scopes) ===== */

export function calculateEstimatedPrice(serviceId: ScopeKey | string, wizardState: WizardState) {
  const scope = (serviceId || wizardState.scope) as ScopeKey;
  if (scope === 'dump_delivery') {
    const delivery = wizardState.dumpDelivery || DEFAULT_DUMP_DELIVERY;
    const effortMap: Record<NonNullable<DeliverySelection['itemType']>, number> = {
      parcel: 0,
      household: 1,
      mattress: 2,
      groceries: 1,
      tools: 1,
    };
    const effortBlocks = effortMap[delivery.itemType || 'parcel'] ?? 0;
    const physicalBlocks = delivery.assist === 'need_help' ? 1 : 0;
    const travel = travelRange(delivery.distance, wizardState.distanceKm);
    return combinePricing(effortBlocks, physicalBlocks, travel);
  }

  if (scope === 'dump_transport') {
    const transport = wizardState.dumpTransport || DEFAULT_DUMP_TRANSPORT;
    const sizeEffort: Record<TransportSelection['loadSize'], number> = {
      bags: 1,
      boot: 2,
      small_load: 3,
      full_move: 4,
    };
    const effortBlocks = sizeEffort[transport.loadSize] ?? 1;
    const physicalBlocks =
      transport.stairs === 'one'
        ? 1
        : transport.stairs === 'multi' || transport.stairs === 'no_lift'
        ? 2
        : 0;
    const travel = travelRange(null, wizardState.distanceKm);
    return combinePricing(effortBlocks, physicalBlocks, travel);
  }

  if (scope === 'dump_runs') {
    const dump = wizardState.dumpRun || DEFAULT_DUMP_RUN;
    const loads = clamp(Number.isFinite(dump.loads) ? dump.loads : 1, 1, 20);
    let effortBlocks = loads * 1.5;
    if (dump.loadType === 'trailer') effortBlocks += 1;
    const physicalBlocks = dump.loadType === 'bulky' ? 1 : 0;
    const travel = travelRange(null, wizardState.distanceKm);
    return combinePricing(effortBlocks, physicalBlocks, travel);
  }

  if (scope === 'bin_cleans') {
    const dumpParams = wizardState.paramsByService?.dump || {};

    // Bin counts
    const redBins = clamp(Math.round(dumpParams.redBins || 0), 0, 10);
    const yellowBins = clamp(Math.round(dumpParams.yellowBins || 0), 0, 10);
    const greenBins = clamp(Math.round(dumpParams.greenBins || 0), 0, 10);
    const kitchenBins = clamp(Math.round(dumpParams.kitchenBins || 0), 0, 5);

    // Frequencies: 0=oneoff, 1=weekly(red only), 2=fortnightly(red), 1=fortnightly(yellow/green monthly)
    const redFreq = clamp(Math.round(dumpParams.redBinFreq || 0), 0, 2);
    const yellowFreq = clamp(Math.round(dumpParams.yellowBinFreq || 0), 0, 1); // No weekly for yellow
    const greenFreq = clamp(Math.round(dumpParams.greenBinFreq || 0), 0, 1);

    // Subscription plan: 0=none, 1=household ($35, 5 bins), 2=lite ($29, 3 bins)
    const binPlan = clamp(Math.round(dumpParams.binPlan || 0), 0, 2);

    const totalWheelies = redBins + yellowBins + greenBins;
    if (totalWheelies === 0 && kitchenBins === 0) return { min: 0, max: 0 };

    // Kitchen bins require at least one wheelie bin
    const validKitchenBins = totalWheelies > 0 ? kitchenBins : 0;

    // If using a subscription plan
    if (binPlan > 0) {
      const planPrice = binPlan === 1 ? 35 : 29; // Household $35, Lite $29
      const includedBins = binPlan === 1 ? 5 : 3;
      const extraBins = Math.max(0, totalWheelies - includedBins);
      const extraBinCost = extraBins * 6; // +$6 per extra bin
      const kitchenCost = validKitchenBins * 7.5;
      const total = planPrice + extraBinCost + kitchenCost;
      return { min: Math.round(total), max: Math.round(total) };
    }

    // Per-bin pricing (no plan)
    // Red bins: $25 oneoff, $18 weekly, $20 fortnightly
    const redPricePerBin = redFreq === 0 ? 25 : redFreq === 1 ? 18 : 20;
    const redCost = redBins * redPricePerBin;

    // Yellow bins: $20 oneoff, $15 fortnightly (no weekly option)
    const yellowPricePerBin = yellowFreq === 0 ? 20 : 15;
    const yellowCost = yellowBins * yellowPricePerBin;

    // Green bins: $22 oneoff, $17 monthly
    const greenPricePerBin = greenFreq === 0 ? 22 : 17;
    const greenCost = greenBins * greenPricePerBin;

    // Kitchen bins: $7.50 each (add-on only)
    const kitchenCost = validKitchenBins * 7.5;

    const total = redCost + yellowCost + greenCost + kitchenCost;
    return { min: Math.round(total), max: Math.round(total) };
  }

  return null;
}

export function calculateEstimatedTime(serviceId: ScopeKey | string, wizardState: WizardState): string | null {
  const scope = (serviceId || wizardState.scope) as ScopeKey;
  if (scope === 'dump_delivery') return '~1–1.5 hrs';
  if (scope === 'dump_transport') {
    const transport = wizardState.dumpTransport || DEFAULT_DUMP_TRANSPORT;
    if (transport.loadSize === 'full_move') return '~1–2 hrs (multiple loads likely)';
    return '~1.5 hrs';
  }
  if (scope === 'dump_runs') return '~40–80 mins onsite';
  if (scope === 'bin_cleans') {
    const dumpParams = wizardState.paramsByService?.dump || {};
    const redBins = dumpParams.redBins ?? 0;
    const yellowBins = dumpParams.yellowBins ?? 0;
    const greenBins = dumpParams.greenBins ?? 0;
    const kitchenBins = dumpParams.kitchenBins ?? 0;
    const totalBins = redBins + yellowBins + greenBins + kitchenBins;
    if (totalBins <= 2) return '~15–25 mins';
    if (totalBins <= 4) return '~25–40 mins';
    if (totalBins <= 6) return '~35–50 mins';
    return '~45–60 mins';
  }
  return null;
}

export function buildServiceEstimate(serviceId: ScopeKey | string, wizardState: WizardState): ServiceEstimate | null {
  const estimatedPrice = calculateEstimatedPrice(serviceId, wizardState);
  const estimatedTime = calculateEstimatedTime(serviceId, wizardState);
  if (!estimatedPrice || !estimatedTime) return null;
  return { estimatedPrice, estimatedTime, disclaimer: ESTIMATE_DISCLAIMER };
}

/* ===== Badge-based time adjustments ===== */

export const INCLUSION_MINUTES: Record<string, number> = {
  'Inside & Outside Windows': 0,
  'Inside Windows Only': 0,
  'Outside Windows Only': 0,
  'Tracks Vacuum & Wipe': 10,
  'Frames & Sills Wipe': 6,
  'Fly Screens': 8,
  'Mirrors / Glass Doors': 8,
  'High Access (ladder/safety)': 15,
  'Hard Water Spot Treatment': 15,
  'Sticker/Residue Removal': 10,
  'Detail Edges / Silicone': 6,
};

export function badgeMinutesForScope(S: WizardState, scopeKey: string): number {
  const selected = (S as any).selectedInclusions as SelMap | undefined;
  const picked = selected?.[scopeKey] ?? [];
  return picked.reduce((sum, label) => sum + (INCLUSION_MINUTES[label] ?? 0), 0);
}

/* ===== estimateForScope ===== */

/**
 * Internal helper: build a full priceQuote for a given service/scope
 * using the *current wizard state*.
 *
 * - For the active card (S.service + S.scope) we use the live sliders
 *   from S.paramsByService.
 * - For other cards we fall back to the scope preset so they still show
 *   a sensible "typical" time.
 */
export function estimateForScope(
  S: WizardState,
  service: ServiceType,
  scopeKey: ScopeKey
): ReturnType<typeof priceQuote> | null {
  const context = S.context;

  // Base params for this service from state
  const paramsFromState = (S.paramsByService as any)[service] ?? {};

  // When this card is the active selection, use real sliders;
  // otherwise seed from default+scope preset so it still has a value.
  let params: Record<string, number>;
  if (service === 'windows') {
    // Keep window cards stable by always using their presets here
    const defaults = defaultParamsByService() as any;
    const base = defaults[service] ?? {};
    const preset = scopePresetFor(service, scopeKey, context) || {};
    params = { ...base, ...preset };
  } else if (service === S.service && scopeKey === S.scope) {
    params = { ...paramsFromState };
  } else {
    const defaults = defaultParamsByService() as any;
    const base = defaults[service] ?? {};
    const preset = scopePresetFor(service, scopeKey, context) || {};
    params = { ...base, ...preset };
  }

  // Selected line items for this scope
  let windowsOverrideTotals: { panes_int: number; panes_ext: number; tracks: number; screens: number } | undefined;
  let windowsStoreys = 1;
  let windowsRowsForScope: WizardState['winRows'] | undefined;

  if (service === 'windows') {
    // Always use live rows so cards, editor, and totals share the same inputs
    windowsRowsForScope = S.winRows;

    const totals = (windowsRowsForScope || []).reduce(
      (acc, r) => {
        acc.panes_int += Math.max(0, r.int || 0);
        acc.panes_ext += Math.max(0, r.ext || 0);
        acc.tracks += Math.max(0, r.tracks || 0);
        acc.screens += context === 'commercial' ? 0 : Math.max(0, r.screens || 0);
        return acc;
      },
      { panes_int: 0, panes_ext: 0, tracks: 0, screens: 0 }
    );
    windowsOverrideTotals = totals;
    windowsStoreys = windowsRowsForScope?.length || 1;
  }

  if (service === 'yard') {
    params = { ...params, yard_area: S.yardArea ?? (params as any).yard_area };
  }

  const mergedParams =
    service === 'cleaning'
      ? { ...params, ...(S.cleaningAddons[scopeKey] || {}) }
      : params;

  const selected = selectedFromParams(
    service,
    scopeKey,
    mergedParams,
    { secondStorey: S.secondStorey },
    windowsOverrideTotals,
    context,
    S.commercialCleaningType ?? undefined
  );

  const hasSelected = Object.values(selected).some((v) => (v || 0) > 0);
  const allowDumpDisposalOnly = service === 'dump' && scopeKey === 'dump_runs';
  if (!hasSelected && !allowDumpDisposalOnly) return null;

  // Windows storeys – prefer live state if present
  const windowsStoreysParam = service === 'windows' ? windowsStoreys : 1;

  // Condition multiplier from S.conditionLevel
  const conditionMult =
    S.conditionLevel === 'light' ? 0.9 : S.conditionLevel === 'heavy' ? 1.18 : 1;

  const autoSizeCategory =
    AUTO_SIZE_CATEGORIES.includes(S.carModelType as VehicleSizeCategory)
      ? (S.carModelType as VehicleSizeCategory)
      : S.carDetectedSizeCategory ?? null;

  const estimate = priceQuote({
    context,
    currentService: service,
    currentScope: scopeKey,
    selected,
    distanceKm: S.distanceKm,
    paidParking: S.paidParking,
    tipFee: S.tipFee,
    conditionMult,
    conditionLevel: S.conditionLevel,
    flags: {
      petHair: S.petHair,
      greaseSoap: S.greaseSoap,
      clutterAccess: S.clutterAccess,
      secondStorey: S.secondStorey,
    },
    windowsStoreys: windowsStoreysParam,
    commercialUplift: S.commercialUplift,
    sizeAdjust: S.sizeAdjust,
    conditionFlat: S.conditionFlat,
    contractDiscount: S.contractDiscount,
    commercialType: S.commercialCleaningType ?? null,
    commPreset: S.commPreset,
    commFrequency: S.commFrequency,
    afterHours: S.afterHours,
    bottleCount: 0, // Deprecated: now handled via recycling bin pricing
    dumpRunSelection: service === 'dump' ? S.dumpRun : undefined,
    cleaningParams:
      service === 'cleaning'
        ? { ...params, ...(S.cleaningAddons[scopeKey] || {}) }
        : undefined,
    yardParams: service === 'yard' ? params : undefined,
    windowsMinutesOverride:
      service === 'windows' && windowsRowsForScope
        ? computeWindowsMinutes(scopeKey, windowsRowsForScope, context, S.paramsByService.windows)
        : undefined,
    windowsStoreysOverride: service === 'windows' ? windowsStoreysParam : undefined,
    autoCategory: S.carModelType,
    autoSizeCategory,
    autoYear: S.carDetectedYear,
    sneakerTurnaround: S.sneakerTurnaround,
  } as QuoteParams);

  return estimate;
}

/* ===== Service lookup ===== */

export function findServiceForScope(scopeKey: ScopeKey): ServiceType | null {
  for (const [svc, scopes] of Object.entries(SCOPES_BY_SERVICE) as [ServiceType, ScopeDef[]][]) {
    if (scopes.some((s) => s.key === scopeKey)) return svc;
  }
  return null;
}

export function calculateServicePrice(serviceId: ScopeKey | string, wizardState: WizardState) {
  const scopeKey = (serviceId || wizardState.scope) as ScopeKey;
  const targetService = (findServiceForScope(scopeKey) ?? wizardState.service) as ServiceType;

  // Bin cleans uses flat per-bin pricing from calculateEstimatedPrice
  if (scopeKey === 'bin_cleans') {
    const binPrice = calculateEstimatedPrice(scopeKey, wizardState);
    const price = binPrice ? Math.max(0, Math.round(binPrice.min || 0)) : 0;
    return {
      price,
      disclaimer: PRICE_SCOPE_DISCLAIMER,
    };
  }

  const estimate = estimateForScope(wizardState, targetService, scopeKey);
  const price = estimate ? Math.max(0, Math.round(estimate.total || 0)) : 0;
  return {
    price,
    disclaimer: PRICE_SCOPE_DISCLAIMER,
  };
}

/* ===== Scope minutes ===== */

export function computeScopeMinutes(S: WizardState, service: ServiceType, scopeKey: ScopeKey): number {
  // Windows: always use live rows
  if (service === 'windows') {
    return computeWindowsMinutes(scopeKey, S.winRows, S.context, S.paramsByService.windows);
  }
  if (service === 'sneakers') return 0;

  // Cleaning – commercial
  if (service === 'cleaning' && S.context === 'commercial') {
    const kind = S.commercialCleaningType ?? 'office';
    return Math.round((COMM_CLEAN_MIN_HOURS[kind] ?? 1) * 60);
  }

  // Cleaning – home
  if (service === 'cleaning' && S.context === 'home') {
    if (scopeKey === 'hourly') {
      const params =
        scopeKey === S.scope
          ? { ...(S.paramsByService.cleaning || {}), ...(S.cleaningAddons[S.scope] || {}) }
          : { ...(defaultParamsByService().cleaning || {}), ...(scopePresetFor('cleaning', scopeKey, S.context) || {}), ...(S.cleaningAddons[scopeKey] || {}) };
      return (params.hours || 3) * 60;
    }
    const params =
      scopeKey === S.scope
        ? { ...(S.paramsByService.cleaning || {}), ...(S.cleaningAddons[S.scope] || {}) }
        : { ...(defaultParamsByService().cleaning || {}), ...(scopePresetFor('cleaning', scopeKey, S.context) || {}), ...(S.cleaningAddons[scopeKey] || {}) };
    const extras = computeHomeExtras(scopeKey, params);
    const addOns = computeCleaningAddons(scopeKey, params);
    return extras.baseMinutes + extras.extraMinutes + addOns.minutes;
  }

  // Yard
  if (service === 'yard') {
    const params =
      scopeKey === S.scope
        ? S.paramsByService.yard || {}
        : {
            ...(defaultParamsByService().yard || {}),
            ...(scopePresetFor('yard', scopeKey, S.context) || {}),
          };
    const paramsWithArea = {
      ...params,
      yard_area: S.yardArea ?? (params as any).yard_area,
    };
    const yardCondMap: Record<'light' | 'standard' | 'heavy', number> = {
      light: 0.9,
      standard: 1,
      heavy: 1.18,
    };
    const yard = computeYardQuote(paramsWithArea, {
      scope: scopeKey,
      isTwoStoreyGutter: S.secondStorey,
      conditionMultiplier: yardCondMap[S.conditionLevel] ?? 1,
      accessTight: S.clutterAccess,
      conditionLevel: S.conditionLevel,
    });
    return yard.minutes;
  }

  // Auto (home): fixed package minutes
  if (service === 'auto') {
    const map: Record<ScopeKey, number> = {
      auto_express: 120,
      auto_interior: 120,
      auto_full: 240,
    };
    if (map[scopeKey] != null) return map[scopeKey];
  }

  // Fallback: use estimateForScope minutes
  const est = estimateForScope(S, service, scopeKey);
  return est ? est.minutes || 0 : 0;
}

/**
 * "Typical minutes" for a service/scope, driven by the same engine that
 * powers the bottom estimate card and Step 3.
 */
export function scopeTypicalMinutes(
  S: WizardState,
  service: ServiceType,
  scopeKey: ScopeKey
): number {
  return computeScopeMinutes(S, service, scopeKey);
}

export function adjustedTypicalMinutes(
  S: WizardState,
  svc: ServiceType,
  scopeKey: string
): number {
  const base = scopeTypicalMinutes(S, svc, scopeKey as ScopeKey);
  const delta = badgeMinutesForScope(S, scopeKey);
  return Math.max(0, base + delta);
}

export function extraMinutesFromBadges(S: WizardState): number {
  if (!S.scope) return 0;
  return badgeMinutesForScope(S, S.scope);
}

/* ===== Window timing ===== */

export function typicalMinutesForWindowsRows(rows: StoreyRow[]) {
  const totalPanes = rows.reduce((a, r) => a + r.int + r.ext, 0);
  const storeys = rows.length || 1;
  if (totalPanes === 0) return 0;
  const refPanes = storeys * 24;
  const mins = (totalPanes / refPanes) * (storeys * WINDOWS_BASE_PER_STOREY_MIN);
  return Math.round(mins);
}

/* ===== Feedback toasts ===== */

export const notifyDelta = (prevMin: number, nextMin: number) => {
  const diff = Math.round(nextMin - prevMin);
  if (!diff) return;
  const word = diff > 0 ? 'more' : 'fewer';
  const abs = Math.abs(diff);
  const label = abs === 1 ? 'minute' : 'minutes';
  toast.message(`~${abs} ${word} ${label}`);
};

/* ===== Quote summary / email ===== */

export function buildQuoteSummary(
  S: WizardState,
  estimate: ReturnType<typeof priceQuote>,
  scopedPrice?: { price: number; disclaimer: string }
) {
  const ctxLabel = S.context[0].toUpperCase() + S.context.slice(1);
  const svc = SERVICES.find((x) => x.key === S.service)?.label ?? S.service;
  const scope = SCOPES_BY_SERVICE[S.service].find((s) => s.key === S.scope)?.label ?? S.scope;
  const parts: string[] = [];

  parts.push(`Digital Quote — ${new Date().toLocaleDateString('en-AU')}`);
  parts.push(`Context: ${ctxLabel}`);
  parts.push(`Service: ${svc}`);
  if (S.context === 'commercial' && S.service === 'cleaning' && S.commercialCleaningType)
    parts.push(`Commercial cleaning type: ${S.commercialCleaningType}`);
  else parts.push(`Scope: ${scope}`);
  parts.push('');
  const estimateLine = `${fmtAUD(scopedPrice?.price ?? estimate.total)} (${fmtHrMin(estimate.minutes)})`;
  parts.push(`Estimate: ${estimateLine}`);
  if (estimate.hourlyUsed) parts.push(`Hourly rate used: ${fmtAUD(estimate.hourlyUsed)}/hr`);
  if (estimate.labourFloor) parts.push(`Labour floor: ${fmtAUD(estimate.labourFloor)}`);
  parts.push(`Per-item subtotal: ${fmtAUD(estimate.unitSum)}`);
  parts.push(`After size/condition/contract: ${fmtAUD(estimate.baseBeforeFees)}`);
  if (estimate.travel || estimate.parking || estimate.tip)
    parts.push(
      `Travel/Parking/Tip: ${fmtAUD(estimate.travel + estimate.parking + estimate.tip)}`
    );
  parts.push(`Confidence: ${estimate.confidence}`);
  const params = S.paramsByService[S.service] || {};

  // Structured bin cleans breakdown for easier tracking
  if (S.service === 'dump' && S.scope === 'bin_cleans') {
    const bp = Number(params.binPlan || 0);
    const planLabel = bp === 1 ? 'Household Plan ($35/mo, up to 5 bins)' : bp === 2 ? 'Bin Care Lite ($29/mo, up to 3 bins)' : 'Pay per clean (no subscription)';
    parts.push(`Bin Plan: ${planLabel}`);
    parts.push(bp > 0 ? 'Schedule: RECURRING — Monthly subscription' : 'Schedule: As requested');
    const redB = Number(params.redBins || 0);
    const yellowB = Number(params.yellowBins || 0);
    const greenB = Number(params.greenBins || 0);
    const kitchenB = Number(params.kitchenBins || 0);
    const freqLabel = (key: string, freq: number) => {
      if (bp > 0) return 'monthly (plan)';
      if (key === 'red') return freq === 0 ? 'one-off' : freq === 1 ? 'weekly' : 'fortnightly';
      if (key === 'yellow') return freq === 0 ? 'one-off' : 'fortnightly';
      if (key === 'green') return freq === 0 ? 'one-off' : 'monthly';
      return '';
    };
    const bins: string[] = [];
    if (redB > 0) bins.push(`  Red (general waste): ${redB} bin${redB > 1 ? 's' : ''} — ${freqLabel('red', Number(params.redBinFreq || 0))}`);
    if (yellowB > 0) bins.push(`  Yellow (recycling): ${yellowB} bin${yellowB > 1 ? 's' : ''} — ${freqLabel('yellow', Number(params.yellowBinFreq || 0))}`);
    if (greenB > 0) bins.push(`  Green (garden): ${greenB} bin${greenB > 1 ? 's' : ''} — ${freqLabel('green', Number(params.greenBinFreq || 0))}`);
    if (kitchenB > 0) bins.push(`  Kitchen caddies: ${kitchenB}`);
    if (bins.length) parts.push('Bins requested:\n' + bins.join('\n'));
    const total = redB + yellowB + greenB;
    if (bp > 0 && total > (bp === 1 ? 5 : 3)) {
      parts.push(`Extra bins: ${total - (bp === 1 ? 5 : 3)} beyond plan (+$6 each)`);
    }
  } else {
    const paramLine = Object.entries(params)
      .filter(([, v]) => Number(v) > 0)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    if (paramLine) parts.push('Details: ' + paramLine);
  }
  parts.push('');
  parts.push(
    `Customer: ${S.fullName || '—'}${S.companyName ? ` · ${S.companyName}` : ''}${
      S.abn ? ` (ABN ${S.abn})` : ''
    }`
  );
  parts.push(`Contact: ${S.email || '—'} · ${S.phone || '—'}`);
  parts.push(`Region: ${S.region || '—'}`);
  if (S.notes) parts.push(`Notes: ${S.notes}`);
  if (S.yardMeasureRequested) parts.push(`Measurement requested for yard/area.`);
  parts.push('');
  if (scopedPrice) parts.push('Price note: ' + scopedPrice.disclaimer);
  parts.push('Disclaimer: ' + TERMS_SNIPPET);
  parts.push('Fairness: ' + FAIRNESS_PROMISE_COPY);
  parts.push('This quote can be used for reimbursement/business expense purposes.');
  return parts.join('\n');
}

export function emailHrefForContext(S: WizardState, body: string) {
  const subject = encodeURIComponent(`Quote request – ${S.context} / ${S.service}`);
  return `mailto:budsatwork@malucare.org?subject=${subject}&body=${encodeURIComponent(body)}`;
}
