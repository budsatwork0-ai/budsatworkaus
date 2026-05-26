/**
 * NDIS pricing — single source of truth.
 *
 * NDIS Pricing Arrangements and Price Limits 2024–25 — household tasks
 * (support item 01_020_0120_1_1 and similar). Weekday daytime cap is ~$57.10/hr.
 *
 * Kept in `services-core` so the wizard, the Quote Assistant, and any future
 * surfaces (PDF quote, plan-manager email) all read the same numbers and
 * helpers — no parallel copies that drift on the next Price Guide update.
 */

// Backwards-compatible alias for the weekday-daytime metro rate.
// New code should call `ndisRateFor(...)` instead — that helper handles the
// time-of-day, day-of-week, and region differentials documented below.
export const NDIS_HOURLY_RATE = 57.10;
export const NDIS_MIN_HOURS = 2;
// Bumped from 12 → 20. Reset cleans of large multi-storey homes regularly
// suggest >12h; the old cap silently truncated the quote. Plan managers can
// still split across visits — we shouldn't quietly underclaim.
export const NDIS_MAX_HOURS = 20;
// Smallest claim unit on the NDIS Price Guide is 0.25h (15 min). Rounding
// to whole hours throws away ~$14 per quote on average.
export const NDIS_HOUR_INCREMENT = 0.25;

export type NdisCondition = 'tidy' | 'lived_in' | 'reset';
export type NdisYardSize = 'small' | 'medium' | 'large' | 'xlarge';

/**
 * NDIS Price Guide rate slots for household tasks (support item
 * 01_020_0120_1_1 and equivalents). Source: NDIS Pricing Arrangements and
 * Price Limits 2024–25, household tasks pricing table. These are MMM 1-3
 * (metro/regional) caps — non-metro modifiers applied separately.
 *
 * Buds At Work operating hours are 7am–5pm, so the Price Guide's
 * weekday-evening band (20:00–24:00) is intentionally not exposed — we
 * don't roster cleans or mows outside operating hours. Saturday, Sunday
 * and public-holiday differentials still apply for weekend work.
 *
 * Update once a year when the new Price Guide is published (1 July).
 */
export type NdisRateSlot =
  | 'weekday_day'      // Mon–Fri 07:00–17:00 (our operating window)
  | 'saturday'
  | 'sunday'
  | 'public_holiday';

export const NDIS_RATES: Record<NdisRateSlot, number> = {
  weekday_day: 57.10,
  saturday: 80.32,
  sunday: 103.39,
  public_holiday: 126.46,
};

export const NDIS_RATE_LABELS: Record<NdisRateSlot, string> = {
  weekday_day: 'Weekday daytime',
  saturday: 'Saturday',
  sunday: 'Sunday',
  public_holiday: 'Public holiday',
};

/**
 * Modified Monash Model regions. The Price Guide caps above apply to MMM 1-3
 * (metro + regional centres). Non-metro modifiers come from the Price Guide's
 * remoteness loadings — kept conservative until we have a customer outside
 * Brisbane / Logan / Gold Coast.
 *
 * Source: NDIS Pricing Arrangements and Price Limits 2024–25,
 * "Provider Travel and National Non-Labour Costs".
 */
export type NdisRegion = 'metro' | 'regional' | 'remote' | 'very_remote';

export const NDIS_REGION_MULT: Record<NdisRegion, number> = {
  metro: 1.0,        // MMM 1
  regional: 1.0,     // MMM 2-3 — same cap, no loading
  remote: 1.4,       // MMM 6 — Price Guide loading for remote areas
  very_remote: 1.5,  // MMM 7
};

export const NDIS_REGION_LABELS: Record<NdisRegion, string> = {
  metro: 'Metro (MMM 1)',
  regional: 'Regional (MMM 2-5)',
  remote: 'Remote (MMM 6)',
  very_remote: 'Very remote (MMM 7)',
};

const CONDITION_MULT: Record<NdisCondition, number> = {
  tidy: 0.85,
  lived_in: 1.0,
  reset: 1.35,
};

/**
 * Base yard-care hours by property size, calibrated to a market-quality
 * NDIS visit: mow + edge + whipper-snip + blow-down, with a buffer for
 * basic green-waste tidy. These mirror what an experienced operator
 * actually spends on the ground, including setup/pack-down and walking
 * a typical block — not just the time the mower is running.
 *
 *  small   ≈ courtyard / unit yard      → ~1.5 hr
 *  medium  ≈ typical suburban block     → ~2.5 hr
 *  large   ≈ 700–1500 m² yard           → ~4 hr
 *  xlarge  ≈ acreage / dual-occupancy   → ~6 hr
 */
const YARD_BASE_HOURS: Record<NdisYardSize, number> = {
  small: 1.5,
  medium: 2.5,
  large: 4,
  xlarge: 6,
};

/**
 * Round UP to the nearest 0.25h. Round-up (not nearest) so we never quietly
 * underquote — a 4.1h job is billed as 4.25h, which is what most providers
 * actually claim against an NDIS plan.
 */
export function roundToQuarterHour(hours: number): number {
  return Math.ceil(hours / NDIS_HOUR_INCREMENT) * NDIS_HOUR_INCREMENT;
}

function clampHours(raw: number): number {
  return Math.max(NDIS_MIN_HOURS, Math.min(NDIS_MAX_HOURS, roundToQuarterHour(raw)));
}

/**
 * Inputs for the cleaning suggester. All fields except condition are optional
 * and default to a typical mid-sized home so older call sites (e.g. the Quote
 * Assistant, which only collects bed/bath/living) keep working unchanged.
 */
export type NdisCleaningInputs = {
  bedrooms: number;
  bathrooms: number;
  living: number;
  /** Kitchens — each adds ~1.1h on top of the base. */
  kitchens?: number;
  /** Laundry rooms — each adds ~0.4h. */
  laundry?: number;
  /** Storeys — each *additional* storey above 1 adds ~0.5h for stairs/movement. */
  storeys?: number;
  condition: NdisCondition;
};

/**
 * Suggest hours for a property based on its rooms + condition.
 *
 * Two call shapes for backward compatibility:
 *  - Legacy positional:  suggestNdisCleaningHours(bedrooms, bathrooms, living, condition)
 *  - Object form:        suggestNdisCleaningHours({ bedrooms, bathrooms, living, kitchens, laundry, storeys, condition })
 *
 * The legacy form is what the Quote Assistant uses today (it only collects
 * bed/bath/living/condition); the object form is what the wizard's Step 2
 * panel uses now that it exposes kitchens/laundry/storeys.
 */
export function suggestNdisCleaningHours(
  bedrooms: number,
  bathrooms: number,
  living: number,
  condition: NdisCondition,
): number;
export function suggestNdisCleaningHours(inputs: NdisCleaningInputs): number;
export function suggestNdisCleaningHours(
  a: number | NdisCleaningInputs,
  b?: number,
  c?: number,
  d?: NdisCondition,
): number {
  const inputs: NdisCleaningInputs =
    typeof a === 'object'
      ? a
      : { bedrooms: a, bathrooms: b ?? 1, living: c ?? 1, condition: d ?? 'lived_in' };

  const {
    bedrooms,
    bathrooms,
    living,
    kitchens = 1,
    laundry = 1,
    storeys = 1,
    condition,
  } = inputs;

  // Baseline calibrated to market-standard "quality time" for an NDIS
  // household clean (vacuum + dust + surfaces + bathrooms scrubbed
  // + kitchen wiped down + floors mopped). Numbers reflect what an
  // experienced cleaner takes per room when doing the job properly,
  // not a once-over.
  //
  //  setup / walkthrough / pack-down  : 0.50 hr
  //  per bedroom                      : 0.55 hr  (vacuum, dust, surfaces, mirrors)
  //  per bathroom                     : 0.85 hr  (toilet, basin, shower, mop, splashback)
  //  per kitchen                      : 1.10 hr  (surfaces, stovetop, splashback, sink, mop)
  //  per living / lounge              : 0.50 hr  (vacuum, dust, surfaces)
  //  per laundry                      : 0.40 hr  (surfaces, sink, mop)
  //  per *additional* storey          : 0.50 hr  (stairs + extra transit)
  const base =
    0.5 +
    bedrooms * 0.55 +
    bathrooms * 0.85 +
    living * 0.5 +
    kitchens * 1.1 +
    laundry * 0.4 +
    Math.max(0, storeys - 1) * 0.5;

  return clampHours(base * (CONDITION_MULT[condition] ?? 1));
}

/** Rough yard hours suggestion based on property size category + condition. */
export function suggestNdisYardHours(
  size: NdisYardSize,
  condition: NdisCondition,
): number {
  // Yard tops out at a slightly milder reset multiplier — even an overgrown
  // yard caps at the same NDIS visit length, so we don't want to inflate it
  // as aggressively as a "reset" cleaning.
  const yardMult = condition === 'reset' ? 1.3 : (CONDITION_MULT[condition] ?? 1);
  return clampHours((YARD_BASE_HOURS[size] ?? YARD_BASE_HOURS.medium) * yardMult);
}

/**
 * Resolve the applicable Price Guide rate for a given slot + region.
 * Returns dollars per hour.
 */
export function ndisRateFor(
  slot: NdisRateSlot = 'weekday_day',
  region: NdisRegion = 'metro',
): number {
  const base = NDIS_RATES[slot] ?? NDIS_HOURLY_RATE;
  const mult = NDIS_REGION_MULT[region] ?? 1;
  // Round to 2dp so display + downstream rounding are deterministic.
  return Math.round(base * mult * 100) / 100;
}

/**
 * Pick the Price Guide slot for a given Date. Caller-supplied isPublicHoliday
 * (we don't ship a QLD holiday calendar — the wizard or caller knows the
 * calendar context). Times resolved in the local timezone of the Date object.
 *
 * Buds At Work only rosters between 07:00 and 17:00, so any weekday time
 * resolves to `weekday_day`. The Price Guide's weekday-evening band is
 * intentionally not represented here.
 */
export function ndisSlotFor(
  when: Date,
  isPublicHoliday: boolean = false,
): NdisRateSlot {
  if (isPublicHoliday) return 'public_holiday';
  const dow = when.getDay(); // 0 = Sun, 6 = Sat
  if (dow === 0) return 'sunday';
  if (dow === 6) return 'saturday';
  return 'weekday_day';
}

/**
 * Subtotal in dollars for an NDIS household-task booking.
 *
 * Two call shapes for backward compatibility:
 *  - Legacy: ndisSubtotal(hours)                     → uses weekday-day metro rate
 *  - New:    ndisSubtotal(hours, { slot, region })   → uses the right Price Guide cap
 */
export function ndisSubtotal(hours: number): number;
export function ndisSubtotal(
  hours: number,
  ctx: { slot?: NdisRateSlot; region?: NdisRegion },
): number;
export function ndisSubtotal(
  hours: number,
  ctx?: { slot?: NdisRateSlot; region?: NdisRegion },
): number {
  const rate = ndisRateFor(ctx?.slot, ctx?.region);
  const safeHours = Number.isFinite(hours) ? hours : NDIS_MIN_HOURS;
  const billableHours = Math.max(NDIS_MIN_HOURS, Math.min(NDIS_MAX_HOURS, safeHours));
  return Math.round(billableHours * rate);
}
