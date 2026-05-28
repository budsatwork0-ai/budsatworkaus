# NDIS Pricing Rewrite & Stripe Hardening — April 2026

**Date:** 2026-04-29
**Status:** Implemented
**Scope:** Quote Assistant ↔ wizard alignment for NDIS pricing, suggester rewrite with quarter-hour rounding, full Price Guide rate table (weekday/Saturday/Sunday/holiday + MMM region), Stripe launch-readiness audit + the two P0 fixes.

**Related:** [[Services Flow Improvements — April 2026 Phase 6]] · [[Failed Payment]] · [[Refund Process]] · [[Quote Flow]] · [[Pricing Engine]]

---

## Why This Was Done

Two complaints landed at once:

1. **NDIS pricing felt flawed.** The Quote Assistant's live estimate and the wizard's Step 2 NDIS panel were calculated in completely different ways — assistant ran through the generic `priceQuote` (home matrix), Step 2 ran through `hours × $57.10`. Same inputs gave different prices, sometimes off by 50%+. The hours suggester itself only modelled bedrooms / bathrooms / living rooms, ignored kitchens / laundry / storeys, rounded to whole hours (throwing ~$14 away per quote on average), and silently capped at 12h.
2. **Pre-launch Stripe nerves.** No-one had read every payment code path end-to-end. Needed a launch-readiness audit before taking real money.

---

## Changes

### 1. NDIS rate constants extracted to `lib/pricing/ndis.ts`

**File:** `src/app/(public)/services/lib/pricing/ndis.ts` (**NEW**)

`NDIS_HOURLY_RATE`, `NDIS_MIN_HOURS`, `NDIS_MAX_HOURS`, `suggestNdisCleaningHours`, `suggestNdisYardHours`, and the new `ndisRateFor` / `ndisSlotFor` / `ndisSubtotal` helpers all live here. Single source of truth so the Quote Assistant, the wizard's Step 2 panel, and any future surface (PDF quote, plan-manager email) share identical numbers.

Previously these constants lived inline in `services/page.tsx`, which is why the assistant couldn't import them and the two surfaces drifted.

### 2. Hours suggester rewritten

**File:** `src/app/(public)/services/lib/pricing/ndis.ts`

`suggestNdisCleaningHours` now factors:

- ~1h setup
- ~0.8h per bedroom
- ~0.5h per bathroom
- ~0.3h per living room
- ~0.75h per kitchen *(new)*
- ~0.4h per laundry room *(new)*
- ~0.7h per *additional* storey above 1 *(new)*

Then the condition multiplier (tidy 0.85, lived-in 1.0, reset 1.35), then **round UP** to the nearest 0.25h (the actual NDIS claim unit), then clamp to `[2, 20]` hours (raised from 12 because reset cleans of large multi-storey homes regularly suggest >12h and the old cap silently truncated).

Two call shapes for backward compat:

- Legacy positional: `suggestNdisCleaningHours(bed, bath, living, condition)` — used by the assistant
- Object form: `suggestNdisCleaningHours({ bedrooms, bathrooms, living, kitchens, laundry, storeys, condition })` — used by Step 2

### 3. Full Price Guide rate table

**File:** `src/app/(public)/services/lib/pricing/ndis.ts`

```ts
NDIS_RATES = {
  weekday_day: 57.10,
  weekday_evening: 62.85,
  saturday: 80.32,
  sunday: 103.39,
  public_holiday: 126.46,
};
NDIS_REGION_MULT = {
  metro: 1.0,
  regional: 1.0,
  remote: 1.4,
  very_remote: 1.5,
};
```

`ndisRateFor(slot, region)` returns the resolved $/hr. `ndisSlotFor(date, isPublicHoliday)` picks the slot from a Date — defers public holiday calendar to caller (we don't ship a QLD holiday list yet).

`ndisSubtotal(hours, { slot, region })` is the new entry point; the legacy `ndisSubtotal(hours)` form keeps working with weekday-day metro defaults.

### 4. Quote Assistant pricing aligned with wizard

**Files:** `src/app/(public)/services/assistant/useAssistant.ts`, `src/app/(public)/services/assistant/flow.ts`, `src/app/(public)/services/assistant/types.ts`

`computeLiveEstimate` now has an early branch for `context === 'ndis' && (service === 'cleaning' || service === 'yard')` that returns `hours × NDIS_HOURLY_RATE` with breakdown copy `"5 hr × $57.10 · NDIS Price Guide cap"` and a new `confidence: 'guide'` flag. The price the assistant shows now equals what Step 2 computes — they pull from the same helper.

Three new question IDs (NDIS-only, appended to the cleaning + yard sequences when context is NDIS):

- `clean_living_rooms` (stepper)
- `clean_condition` (button-grid: tidy / lived-in / reset)
- `yard_condition` (same options, yard variant)

`getActiveSequence(service, answers, context)` is now context-aware.

### 5. Wizard handoff carries NDIS state through `buildMergePayload`

**File:** `src/app/(public)/services/assistant/flow.ts`

When `context === 'ndis'`, the cleaning + yard branches now populate `ndisPropertyBedrooms`, `ndisPropertyBathrooms`, `ndisPropertyLiving`, `ndisYardSize`, `ndisCondition`, `ndisEstimatedHours`, and `ndisHoursOrigin: 'suggested'`. Step 2 pre-fills instead of resetting to defaults.

### 6. NDIS Step 2 panel UI updates

**File:** `src/app/(public)/services/page.tsx` (NDIS panel block, ~line 4838+)

- New steppers for **Kitchens**, **Laundry**, **Storeys** alongside the existing room counts.
- New "When?" picker — weekday day / weekday evening / Saturday / Sunday / public holiday.
- New "Region" picker — metro / regional / remote / very remote with the % loadings shown.
- Quarter-hour stepper for the hours selector (was whole-hour only).
- Hours display now shows fractional values (`5.25 hr`) with a `fmtHours` helper.
- Rate-band pill in the header reads e.g. *"Weekday daytime · Metro (MMM 1) · $57.10/hr"* and updates live.

### 7. Override-reset bug fixed

**File:** `src/app/(public)/services/page.tsx`, NDIS panel input setters

Previously every input change ran `setMany({ ndisPropertyBedrooms: n, ndisHoursOrigin: 'suggested' })` — which blew away any manual hours override the user had typed. Removed the `ndisHoursOrigin` reset from every input setter. Now overrides stick until the user explicitly clicks "Use suggestion".

Also: the displayed hours now correctly auto-update from current inputs while in `'suggested'` mode. Previously it was frozen at whatever was last written into `ndisEstimatedHours`.

### 8. Wizard state extended

**Files:** `src/app/(public)/services/types/index.ts`, `src/app/(public)/services/lib/wizard-state.ts`

New fields on `WizardState`:

- `ndisPropertyKitchens` (default 1)
- `ndisPropertyLaundry` (default 1)
- `ndisPropertyStoreys` (default 1)
- `ndisRateSlot` (default `'weekday_day'`)
- `ndisRegion` (default `'metro'`)

Old localStorage state migrates cleanly because the merge starts from `getInitialState()` defaults.

### 9. Stripe API version pinned

**File:** `src/lib/stripe/server.ts`

```ts
const STRIPE_API_VERSION = '2024-09-30.acacia' as const;
return new Stripe(key, { apiVersion: STRIPE_API_VERSION, typescript: true });
```

Was previously unpinned, meaning a Dashboard-side bump could change webhook payload shapes under us with no code change. Bump deliberately in a controlled PR after reading Stripe's upgrade guide.

### 10. `success_url` / `cancel_url` precedence flipped

**File:** `src/app/api/quotes/[id]/checkout/route.ts:138`

Previously trusted the request `Origin` header first, falling back to `NEXT_PUBLIC_SITE_URL`. `Origin` is request-controlled — an attacker triggering a checkout on their own quote could steer post-payment users (and Stripe receipt URLs) to an arbitrary domain. Flipped the precedence.

```ts
const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || '';
```

### 11. Webhook handler test coverage

**File:** `tests/api/stripe-webhook.test.ts`

Vitest unit suite covering:

- Valid signature → 200
- Invalid signature → 400, no DB writes
- `payout.created` / `paid` / `failed` upserts with the right status
- `payment_intent.succeeded` confirms the order even when it arrives before `checkout.session.completed`
- `payment_intent.payment_failed` flips order → failed and quote → finalized
- `charge.dispute.created` audit log includes evidence due-by
- Unknown events return 200 with no DB writes

All 9 tests pass under `npm run test:unit`.

---

## Verification

- `npx tsc --noEmit` → clean
- `npm run test:unit` → 9/9 pass
- Numeric trace cross-check: assistant live estimate for *3 bed / 2 bath / 1 living lived-in (defaults: 1 kitchen / 1 laundry / 1 storey)* = `6 hr × $57.10 = $343`. Wizard Step 2 with the same inputs returns the same number.

---

## Stripe launch-readiness audit

Full report committed at `STRIPE_LAUNCH_READINESS.md` in repo root. Headline:

- **2 × P0** — both shipped (this doc, items 9 & 10).
- **6 × P1** — duplicate-payment idempotency, missing unique index on `payments(payment_reference, status)`, in-memory rate limit on Vercel, dispute-handling silent, no automated webhook tests *(now done)*, `stripe_customer_id` write-back race.
- **9 × P2** — webhook timeout exposure, `payment_intent.succeeded` doesn't update order status, missing `requires_action` handler, lazy env-var validation, no CSRF defence-in-depth, email trim issue, float-cents storage, missing `payments.currency` column, status-machine sprawl.
- Pre-launch operational checklist included.

`@upstash/ratelimit` and `@upstash/redis` are already in `package.json` deps — half of the rate-limit P1 fix is in place; just needs wiring into `api/checkout/route.ts`.

---

## Follow-ups (open)

- [ ] **P1 fix:** make webhook `orders` update conditional on `status = 'pending'` and add unique index on `payments(payment_reference, status)`.
- [ ] **P1 fix:** wire `@upstash/ratelimit` into `api/checkout/route.ts`.
- [ ] **P1 fix:** Resend email to ops on `charge.dispute.created`.
- [ ] **NDIS:** ship a QLD public-holiday calendar so `ndisSlotFor` can auto-pick `public_holiday` from a booking date.
- [ ] **NDIS:** thread `ndisRateSlot` / `ndisRegion` from the Step 3 scheduler date picker so the rate band auto-resolves instead of being a manual choice.

---

## Files touched

```
NEW   src/app/(public)/services/lib/pricing/ndis.ts
NEW   tests/api/stripe-webhook.test.ts
NEW   vitest.config.ts
NEW   STRIPE_LAUNCH_READINESS.md (repo root)
EDIT  src/app/(public)/services/assistant/flow.ts
EDIT  src/app/(public)/services/assistant/types.ts
EDIT  src/app/(public)/services/assistant/useAssistant.ts
EDIT  src/app/(public)/services/lib/wizard-state.ts
EDIT  src/app/(public)/services/page.tsx
EDIT  src/app/(public)/services/types/index.ts
EDIT  src/app/api/quotes/[id]/checkout/route.ts
EDIT  src/app/api/webhooks/stripe/route.ts
EDIT  src/lib/stripe/server.ts
EDIT  package.json (+ vitest, test:unit script)
```
