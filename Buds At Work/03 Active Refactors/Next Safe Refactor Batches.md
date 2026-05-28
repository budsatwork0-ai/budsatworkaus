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

## ~~Batch 4 — Shared components audit~~ ✅ DONE (2026-05-26)

Audit findings:
- All 6 tab files (`OverviewTab`, `ReceivablesTab`, `PayablesTab`, `JobsTab`, `ReportsTab`, `VisitorsTab`) already imported from `../shared` correctly.
- `orders/page.tsx` and `subscriptions/page.tsx` each had an identical inline `SummaryCard` copy.
- Both local `StatusChip` implementations were intentionally page-specific (`OrderStatus`/`SubscriptionStatus` have different type domains and color maps from the shared `statusStyles`) — left in place.

Fix applied:
- Made `viewLabel` optional in shared `SummaryCard`; "View →" button now only renders when `viewLabel` is provided.
- Removed inline `SummaryCard` from `orders/page.tsx` and `subscriptions/page.tsx`.
- Both pages now import `SummaryCard` from `'../components/shared'`.

---

## ~~Batch 5 — NDIS pricing separation~~ ✅ DONE (2026-05-26)

`src/lib/services-core/ndis-pricing.ts` — canonical NDIS pricing module. All rates, helpers, types, and overloaded functions extracted verbatim from the 2024-25 NDIS Price Guide. Zero imports — entirely self-contained.
`src/app/(public)/services/lib/pricing/ndis.ts` is now a one-line shim: `export * from '@/lib/services-core/ndis-pricing'`.

**3 consumer import sites (`flow.ts`, `useAssistant.ts`, `page.tsx`) — zero import path changes required.**

Risk was assessed as LOW despite the vault saying MEDIUM: graphify path showed no direct connection to `engine.ts`; `ndis.ts` had zero imports. Rates copied verbatim from Price Guide — not modified.

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
