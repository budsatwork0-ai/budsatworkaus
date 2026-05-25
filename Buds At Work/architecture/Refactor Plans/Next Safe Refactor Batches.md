---
tags: [refactor, plan, batches, roadmap]
---

# Next Safe Refactor Batches

Ordered list of safe, staged refactors. Each batch is self-contained — complete one before starting the next.

---

## Batch 1 — Pricing constants extraction (LOW RISK)
**Target:** `src/app/(public)/services/lib/pricing/engine.ts`  
**Extract:** Magic number constants and rate tables to a separate `src/lib/services-core/pricing/constants.ts`  
**Why safe:** Pure data — no side-effects, no component dependencies.  
**Verify with:** `graphify path "engine.ts" "WizardState"`

---

## Batch 2 — Yard pricing isolation (LOW RISK)
**Target:** `src/app/ui/yard/yardPricing.ts`  
**Extract:** Move to `src/lib/services-core/pricing/yardPricing.ts`  
**Why safe:** Already a pure function. Only one import path to update.  
**Verify with:** `graphify query "yard pricing polygon area"`

---

## Batch 3 — Route service stabilisation (MEDIUM RISK)
**Target:** `src/app/(public)/services/lib/routing/index.ts`  
**Extract:** Move to `src/lib/services-core/routing/index.ts`  
**Why medium risk:** `useRouteResult` hook imports it — one import path update required.  
**Verify with:** `graphify path "useRouteResult.ts" "routing/index.ts"`

---

## Batch 4 — Shared components extraction from dashboard tabs (LOW RISK)
**Target:** `SummaryCard`, `Panel`, `StatRow`, `StatusChip` in `components/shared/index.tsx`  
**Scope:** Ensure all call sites are consistent and no tab re-implements any of these.  
**Why safe:** Already extracted — this batch audits and standardises usage.  
**Verify with:** `grep -r "SummaryCard\|StatRow\|StatusChip" src/`

---

## Batch 5 — NDIS pricing separation (MEDIUM RISK)
**Target:** `src/app/(public)/services/lib/pricing/ndis.ts`  
**Extract:** Move NDIS rate logic to `src/lib/services-core/ndis/pricing.ts`  
**Why medium risk:** Must stay in sync with `engine.ts`. Run both tests together.  
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
