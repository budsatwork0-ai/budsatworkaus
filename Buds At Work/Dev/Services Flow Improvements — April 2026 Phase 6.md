# Services Flow Improvements — April 2026 Phase 6

**Date:** 2026-04-20
**Status:** Implemented
**Scope:** Rego lookup UX polish, dump/removal flow expansion (delivery + transport subtypes), pricing engine rework for auto interiors and dump runs

**Related:** [[Services Flow Improvements — April 2026 Phase 5]] · [[Quote Flow]] · [[Pricing Engine]]

---

## Why This Was Done

The rego lookup assistant step lacked persistence — users couldn't see which vehicle was detected as they progressed through subsequent questions. The dump/removal flow only supported three load types (ute, trailer, bulky) with no delivery or transport options. The auto interior pricing model used a fractional-unit pattern that caused unexpectedly large price jumps for multi-row vehicles. All three needed fixing before the assistant flow could be considered production-ready.

---

## Changes

### 1. Persistent rego vehicle banner (`AssistantRegoBanner`)

**File:** `src/app/(public)/services/assistant/AssistantRegoBanner.tsx` (**NEW**)

A sticky summary banner that appears on every assistant step after a rego lookup has resolved a vehicle. Shows: plate, year, make/model, and size category. Includes a "Change" button that clears all `auto_detected_*` answers, resets `auto_rego_lookup`, and jumps the user back to the rego lookup step so they can try a different plate.

Renders nothing if the lookup hasn't yet resolved (status ≠ `'detected'`).

---

### 2. `auto_rego_lookup` added as first auto step

**File:** `src/app/(public)/services/assistant/flow.ts`

`QUESTION_SEQUENCES.auto` now starts with `'auto_rego_lookup'` before `'auto_vehicle_size'`. This makes rego lookup the entry point for all car detailing quotes. If the user skips or the lookup fails, they fall through to manual vehicle size selection as before.

---

### 3. Detected vehicle data passed through to quote payload

**Files:** `src/app/(public)/services/assistant/flow.ts`, `src/app/(public)/services/assistant/useAssistant.ts`, `src/app/(public)/services/types/index.ts`

`buildMergePayload` now reads `auto_detected_make`, `auto_detected_model`, `auto_detected_year`, `auto_detected_body_style`, `auto_detected_doors`, `auto_detected_seats` from answers and passes them as `carDetectedVehicle`, `carDetectedSizeCategory`, and `carDetectedYear` on the quote payload. This data flows through to the Supabase quote record for use in admin/ops tooling.

`paramsByService.auto` now always includes `rows` and `child_seats` (inferred from scope: `auto_express` gets `rows: 0`, `auto_interior`/`auto_full` get `rows: 2`).

A `onJumpToRegoLookup` callback was added to `useAssistant` and threaded through to `QuoteAssistantPanel` for use by the banner's "Change" button.

---

### 4. Dump/removal — two new subtypes: Delivery and Transport & Haul

**File:** `src/app/(public)/services/assistant/flow.ts`

`QUESTION_SEQUENCES.dump` expanded from 3 questions to 9. Two new subtype branches were added:

**Delivery (`dump_delivery`)**
- `dump_delivery_item` — what is being delivered (parcel, household, mattress, groceries, tools)
- `dump_delivery_distance` — same suburb / 30-min drive / 60-min drive / longer trip (custom quote)
- `dump_delivery_assist` — drop-off only vs. help carrying

**Transport & Haul (`dump_transport`)**
- `dump_transport_move` — bedroom / student move / whole house / office / event
- `dump_transport_load` — bags / boot-full / small load / full move
- `dump_transport_stairs` — ground floor / 1 flight / multiple flights / no lift
- `dump_transport_helpers` — 1 / 2 / 3 helpers

`buildMergePayload` maps both subtypes into typed `dumpDelivery` and `dumpTransport` objects on the payload. Both objects use `scope: subtype` so the admin panel and quote record distinguish them from standard disposal runs.

---

### 5. Dump load-type expanded: `single_item` and `half_trailer` added

**Files:** `src/app/(public)/services/assistant/flow.ts`, `src/app/(public)/services/lib/pricing/engine.ts`

`dump_load_count` now offers five options instead of three:

| Value | Label | Volume |
|-------|-------|--------|
| `single_item` | Single item | ~0.5 m³ |
| `ute` | Small load | ~1.5 m³ |
| `half_trailer` | Half trailer | ~2 m³ |
| `trailer` | Medium load | ~2.5 m³ |
| `bulky` | Bulky items | ~2 m³ |

`DUMP_LOAD_META` updated with per-load `effortPerLoad`, `extraEffort`, and `physicalBlocks` fields (see pricing engine change below).

---

### 6. Dump pricing engine — effort-block model

**File:** `src/app/(public)/services/lib/pricing/engine.ts`

Replaced the previous flat-fee lookup with an effort-block model:

```
price = BASE_CALLOUT ($79)
      + effortBlocks × EFFORT_BLOCK_RATE ($27.50)
      + physicalBlocks × PHYSICAL_BLOCK_RATE ($37.50)
      + disposalFee
```

Where `effortBlocks = loads × effortPerLoad + extraEffort` per load type. This means single-item runs price much lower than a full trailer, and trailer hookup adds a flat effort surcharge. Bulky items carry an extra physical block for awkward lifts.

---

### 7. Auto interior pricing — additive surcharge model

**File:** `src/app/(public)/services/lib/pricing/engine.ts`

The previous model used a fractional unit that multiplied the base price — causing a 3-row SUV interior to cost nearly 3× a hatch. Replaced with:

```
sel['auto.interior'] = sizeMultiplier + (extraRows × $40 / base) + (childSeats × $30 / base)
```

- `sizeMultiplier` follows the same `[1, 1.1, 1.2, 1.3, 1.4, 1.5]` scale as `auto_full`
- Extra rows above 2 add a flat ~$40 each (predictable, not exponential)
- Child seats add ~$30 each

`auto_full` was updated in parallel to use the same additive row surcharge instead of the previous multiplicative formula.

---

## Key Files Modified / Created

| File | Change |
|------|--------|
| `src/app/(public)/services/assistant/AssistantRegoBanner.tsx` | **NEW** — persisted vehicle banner with "Change" escape hatch |
| `src/app/(public)/services/assistant/AssistantRegoLookup.tsx` | Wired to banner, exposes `onJumpBack` |
| `src/app/(public)/services/assistant/QuoteAssistantPanel.tsx` | Threads `onJumpToRegoLookup` to banner and lookup step |
| `src/app/(public)/services/assistant/flow.ts` | Rego as first auto step; delivery + transport question defs; `buildMergePayload` extensions |
| `src/app/(public)/services/assistant/types.ts` | New answer IDs for detected vehicle + delivery/transport questions |
| `src/app/(public)/services/assistant/useAssistant.ts` | `onJumpToRegoLookup` callback; detected vehicle passthrough |
| `src/app/(public)/services/lib/pricing/constants.ts` | Minor constant updates |
| `src/app/(public)/services/lib/pricing/engine.ts` | Effort-block dump model; additive auto interior/full pricing |
| `src/app/(public)/services/lib/service-data.tsx` | Delivery/transport service descriptions |
| `src/app/(public)/services/page.tsx` | Banner + jump callback wired into wizard |
| `src/app/(public)/services/types/index.ts` | `carDetectedVehicle`, `carDetectedSizeCategory`, `carDetectedYear` on quote payload type |

---

## Verification

- [ ] Car detailing flow → first question is rego lookup → successful lookup → banner appears on every subsequent step showing plate + vehicle
- [ ] Banner "Change" button → clears detection, returns to rego lookup step
- [ ] Rego lookup skip / failure → falls through to manual vehicle size selection
- [ ] `auto_interior` quote — sedan vs. SUV vs. van → price scales predictably (no huge jumps)
- [ ] `auto_full` quote — same vehicle size gradient check
- [ ] Dump flow → subtype "dump_removal" → load type options include `single_item` and `half_trailer`
- [ ] Dump flow → subtype "dump_delivery" → delivery-specific questions appear
- [ ] Dump flow → subtype "dump_transport" → transport/haul questions appear
- [ ] Quote payload includes `carDetectedVehicle` object when rego was resolved
- [ ] `dumpDelivery` / `dumpTransport` objects present on payload for those subtypes
