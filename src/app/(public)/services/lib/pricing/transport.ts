/**
 * Transport / Move Assistance + Delivery Services pricing
 *
 * Formula:
 *   Transport: base + loadSize + distance + access + helpers + extras
 *   Delivery:  base + itemType + distance + extraStops + extras
 *
 * Tweak rates here — nothing is hardcoded in components.
 */

import type { TransportSelection, DeliverySelection } from '../../types';

/* ─── Transport pricing config ──────────────────────────────────────────── */

export const TRANSPORT_PRICING = {
  baseCallout: 79,

  loadSize: {
    bags: 25,
    boot: 45,
    small_load: 79,
    full_move: 149,
  } as Record<TransportSelection['loadSize'], number>,

  loadSizeLabel: {
    bags: 'Few bags',
    boot: 'Car boot load',
    small_load: 'Small load',
    full_move: 'Full move',
  } as Record<TransportSelection['loadSize'], string>,

  /** Distance bands — checked in order; last band = ≤ that km */
  distance: [
    { maxKm: 10, price: 0, label: 'Included' },
    { maxKm: 25, price: 15, label: 'Up to 25 km' },
    { maxKm: 40, price: 30, label: 'Up to 40 km' },
    { maxKm: 60, price: 50, label: 'Up to 60 km' },
  ],

  /** Distances over this trigger a custom quote */
  customQuoteKm: 60,

  access: {
    none: 0,
    one: 20,
    multi: 40,
    no_lift: 30,
  } as Record<TransportSelection['stairs'], number>,

  accessLabel: {
    none: 'No stairs',
    one: 'One flight of stairs',
    multi: 'Multiple flights of stairs',
    no_lift: 'No lift access',
  } as Record<TransportSelection['stairs'], string>,

  /** 1 helper is included (0 surcharge). 2+ helpers are extra. */
  helpers: {
    1: 0,
    2: 60,
    3: 120,
  } as Record<1 | 2 | 3, number>,

  extras: {
    urgent: { label: 'Priority / urgent booking', price: 15 },
    afterHours: { label: 'After-hours or weekend loading', price: 40 },
    heavyItem: { label: 'Heavy / awkward item handling', price: 25 },
  },
} as const;

/* ─── Delivery pricing config ────────────────────────────────────────────── */

export const DELIVERY_PRICING = {
  basePickupFee: 19,

  itemType: {
    parcel: 10,
    groceries: 12,
    tools: 18,
    household: 25,
    mattress: 40,
  } as Record<NonNullable<DeliverySelection['itemType']>, number>,

  itemTypeLabel: {
    parcel: 'Small box / parcel',
    groceries: 'Groceries',
    tools: 'Tools / equipment',
    household: 'Household item',
    mattress: 'Mattress / bed',
  } as Record<NonNullable<DeliverySelection['itemType']>, string>,

  distance: [
    { maxKm: 10, price: 0, label: 'Included' },
    { maxKm: 20, price: 10, label: 'Up to 20 km' },
    { maxKm: 35, price: 20, label: 'Up to 35 km' },
    { maxKm: 50, price: 35, label: 'Up to 50 km' },
  ],

  customQuoteKm: 50,

  extraStopPrice: 8,

  extras: {
    priority: { label: 'Priority / same-day delivery', price: 15 },
    stairsAtDropoff: { label: 'Stairs at drop-off', price: 20 },
    twoPerson: { label: 'Two-person lift (bulky item)', price: 35 },
  },
} as const;

/* ─── Line-item types ────────────────────────────────────────────────────── */

export type PriceLineItem = {
  label: string;
  amount: number;
  /** Optional display note, e.g. "Included" or "+ $15" */
  note?: string;
};

export type QuoteResult = {
  lineItems: PriceLineItem[];
  total: number;
  isCustomQuote: boolean;
  customQuoteReason?: string;
};

/* ─── Distance helpers ────────────────────────────────────────────────────── */

export function calcTransportDistancePrice(km: number): { price: number; label: string } {
  for (const band of TRANSPORT_PRICING.distance) {
    if (km <= band.maxKm) return { price: band.price, label: band.label };
  }
  return { price: 50, label: `${Math.round(km)} km` };
}

export function calcDeliveryDistancePrice(km: number): { price: number; label: string } {
  for (const band of DELIVERY_PRICING.distance) {
    if (km <= band.maxKm) return { price: band.price, label: band.label };
  }
  return { price: 35, label: `${Math.round(km)} km` };
}

/* ─── Custom quote rules ─────────────────────────────────────────────────── */

export function isTransportCustomQuote(
  sel: TransportSelection,
  km: number
): { isCustom: boolean; reason?: string } {
  if (km > TRANSPORT_PRICING.customQuoteKm) {
    return { isCustom: true, reason: 'Distance over 60 km requires a custom quote.' };
  }
  // Aggressive stacking: full move + hard access + max helpers
  const helpers = (sel.helpers ?? 1) as 1 | 2 | 3;
  if (
    sel.loadSize === 'full_move' &&
    (sel.stairs === 'multi' || sel.stairs === 'no_lift') &&
    helpers === 3
  ) {
    return {
      isCustom: true,
      reason: 'A full move with difficult access and 3 helpers may require a custom quote.',
    };
  }
  return { isCustom: false };
}

export function isDeliveryCustomQuote(
  sel: DeliverySelection,
  km: number
): { isCustom: boolean; reason?: string } {
  if (km > DELIVERY_PRICING.customQuoteKm) {
    return { isCustom: true, reason: 'Distance over 50 km requires a custom quote.' };
  }
  // Mattress + stairs = heavy combo — flag it
  if (sel.itemType === 'mattress' && sel.stairsAtDropoff) {
    return {
      isCustom: true,
      reason: 'Mattress delivery with stair access may require a custom quote.',
    };
  }
  // Too many extra stops
  const stops = sel.extraStops ?? 0;
  if (stops > 5) {
    return {
      isCustom: true,
      reason: 'More than 5 extra stops requires a custom quote.',
    };
  }
  return { isCustom: false };
}

/* ─── Line-item builders ─────────────────────────────────────────────────── */

export function buildTransportLineItems(sel: TransportSelection, km: number): PriceLineItem[] {
  const items: PriceLineItem[] = [];
  const helpers = (sel.helpers ?? 1) as 1 | 2 | 3;

  // Base callout
  items.push({ label: 'Base callout', amount: TRANSPORT_PRICING.baseCallout });

  // Load size
  const loadPrice = TRANSPORT_PRICING.loadSize[sel.loadSize] ?? 0;
  const loadLabel = TRANSPORT_PRICING.loadSizeLabel[sel.loadSize] ?? sel.loadSize;
  items.push({ label: loadLabel, amount: loadPrice });

  // Distance
  const dist = km > 0 ? calcTransportDistancePrice(km) : { price: 0, label: 'Included' };
  items.push({
    label: 'Distance',
    amount: dist.price,
    note: dist.price === 0 ? 'Included' : dist.label,
  });

  // Access / stairs
  const accessPrice = TRANSPORT_PRICING.access[sel.stairs] ?? 0;
  if (accessPrice > 0) {
    items.push({
      label: TRANSPORT_PRICING.accessLabel[sel.stairs],
      amount: accessPrice,
    });
  }

  // Helpers
  const helperPrice = TRANSPORT_PRICING.helpers[helpers] ?? 0;
  if (helperPrice > 0) {
    items.push({ label: `${helpers} helpers`, amount: helperPrice });
  }

  // Extras
  if (sel.urgent) {
    items.push({
      label: TRANSPORT_PRICING.extras.urgent.label,
      amount: TRANSPORT_PRICING.extras.urgent.price,
    });
  }
  if (sel.afterHours) {
    items.push({
      label: TRANSPORT_PRICING.extras.afterHours.label,
      amount: TRANSPORT_PRICING.extras.afterHours.price,
    });
  }

  return items;
}

export function buildDeliveryLineItems(sel: DeliverySelection, km: number): PriceLineItem[] {
  const items: PriceLineItem[] = [];

  // Base pickup fee
  items.push({ label: 'Base pickup fee', amount: DELIVERY_PRICING.basePickupFee });

  // Item type
  if (sel.itemType) {
    const itemPrice = DELIVERY_PRICING.itemType[sel.itemType] ?? 0;
    const itemLabel = DELIVERY_PRICING.itemTypeLabel[sel.itemType] ?? sel.itemType;
    items.push({ label: itemLabel, amount: itemPrice });
  }

  // Distance
  const dist = km > 0 ? calcDeliveryDistancePrice(km) : { price: 0, label: 'Included' };
  items.push({
    label: 'Distance',
    amount: dist.price,
    note: dist.price === 0 ? 'Included' : dist.label,
  });

  // Extra stops
  const stops = sel.extraStops ?? 0;
  if (stops > 0) {
    items.push({
      label: `Extra stops (×${stops})`,
      amount: stops * DELIVERY_PRICING.extraStopPrice,
    });
  }

  // Extras
  if (sel.priority) {
    items.push({
      label: DELIVERY_PRICING.extras.priority.label,
      amount: DELIVERY_PRICING.extras.priority.price,
    });
  }
  if (sel.stairsAtDropoff) {
    items.push({
      label: DELIVERY_PRICING.extras.stairsAtDropoff.label,
      amount: DELIVERY_PRICING.extras.stairsAtDropoff.price,
    });
  }

  return items;
}

/* ─── Main calculators ───────────────────────────────────────────────────── */

export function calcTransportQuote(sel: TransportSelection, km: number): QuoteResult {
  const customCheck = isTransportCustomQuote(sel, km);
  if (customCheck.isCustom) {
    return {
      lineItems: [],
      total: 0,
      isCustomQuote: true,
      customQuoteReason: customCheck.reason,
    };
  }

  const lineItems = buildTransportLineItems(sel, km);
  const total = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return { lineItems, total, isCustomQuote: false };
}

export function calcDeliveryQuote(sel: DeliverySelection, km: number): QuoteResult {
  const customCheck = isDeliveryCustomQuote(sel, km);
  if (customCheck.isCustom) {
    return {
      lineItems: [],
      total: 0,
      isCustomQuote: true,
      customQuoteReason: customCheck.reason,
    };
  }

  const lineItems = buildDeliveryLineItems(sel, km);
  const total = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return { lineItems, total, isCustomQuote: false };
}
