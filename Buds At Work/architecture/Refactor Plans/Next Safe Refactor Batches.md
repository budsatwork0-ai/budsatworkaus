---
tags: [refactor, plan, batches, roadmap]
---

# Next Safe Refactor Batches

Ordered list of safe, staged refactors. Each batch is self-contained — complete one before starting the next.

---

## ~~Batch 1 — Pricing constants extraction~~ ✅ DONE

`src/lib/services-core/constants.ts` — all rate tables and magic numbers already extracted.
`src/app/(public)/services/lib/pricing/constants.ts` is a re-export shim.

---

## ~~Batch 2 — Yard pricing isolation~~ ✅ DONE

`src/lib/services-core/yard-pricing.ts` — all pure pricing logic already extracted.
`src/app/ui/yard/yardPricing.ts` is a thin shim that adds Google Maps utilities only (`polygonToArray`, `arrayToPolygon`).

---

## ~~Batch 3 — Route service stabilisation~~ ✅ DONE (2026-05-26)

`src/lib/services-core/routing.ts` — pure functions + `RouteLocation`/`RouteLookupResult` types extracted.
`src/app/(public)/services/lib/routing/index.ts` is now a thin shim: re-exports from services-core + keeps `isQueenslandPlace` in UI layer (Google Maps type dependency).
`src/app/(public)/services/types/index.ts` now re-exports the types from services-core for backward compatibility.
`src/lib/services-core/index.ts` updated to include routing.

**3 import sites — zero import path changes required for consumers.**

---

## Batch 4 — Shared components audit (LOW RISK)
**Target:** `SummaryCard`, `Panel`, `StatRow`, `StatusChip` in `components/shared/index.tsx`  
**Scope:** Ensure all dashboard tabs use the shared components and no tab re-implements any of these inline.  
**Why safe:** Components already extracted — this batch audits and standardises usage.  
**Verify with:** `grep -r "SummaryCard\|StatRow\|StatusChip" src/`

---

## Batch 5 — NDIS pricing separation (MEDIUM RISK)
**Target:** `src/app/(public)/services/lib/pricing/ndis.ts`  
**Extract:** Move NDIS rate logic to `src/lib/services-core/ndis/pricing.ts`  
**Why medium risk:** NDIS rates are legislated — must stay in sync with `engine.ts`. Run both tests together.  
**Constraint:** Never change NDIS rates without a reference to the current NDIS pricing catalogue. See [[Known Unsafe Areas]].  
**Verify with:** `graphify path "ndis.ts" "engine.ts"`

---

## Guardrails before any batch
1. Check [[Known Unsafe Areas]] — if the target is listed, escalate before touching.
2. Run `graphify path "<source>" "<target>"` to map the blast radius.
3. One extraction per PR. No UI changes in the same PR.
4. After merging, run `graphify update .`.

## Related Systems
- [[Services Core Extraction]]
- [[Known Unsafe Areas]]
- [[../Components/ServicesPageContent|ServicesPageContent]]
- [[../Systems/Pricing Engine|Pricing Engine]]
- [[../Systems/Route Service|Route Service]]
- [[../Systems/Bud Core Runtime|Bud Core Runtime]]
