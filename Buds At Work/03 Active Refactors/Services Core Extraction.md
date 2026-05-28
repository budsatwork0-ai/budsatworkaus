---
tags: [refactor, services, extraction, plan]
---

# Services Core Extraction

## Highest-risk files
- `src/app/(public)/services/page.tsx` — 5,500+ lines, IIFE pattern in Step 2
- `src/app/(public)/services/lib/pricing/engine.ts`
- `src/app/(public)/services/lib/pricing/estimation.ts`
- `src/app/(public)/services/lib/hooks/useAssistant.ts`
- `src/app/(public)/services/lib/flow.ts`
- `src/app/ui/yard/yardPricing.ts`
- `src/app/(public)/services/lib/routing/index.ts`

## Goal
Extract business logic from UI orchestration. Move pure computation into `services-core` / [[Bud Core Runtime]].

## Phase 1 — safe extractions
Move:
- pricing constants (no side-effects)
- yard pricing (pure function)
- route calculations (already mostly isolated in `routing/index.ts`)
- estimation helpers (pure functions)
- pure utility functions

## Rule
> No broad UI rewrites. Only surgical extractions.

One extraction per PR. Do not mix logic moves with UI changes.

## Claude should know
- The IIFE in Step 2 is not a refactor target — it is load-bearing. Leave it alone.
- Before touching any file in the highest-risk list, run `graphify path "<file>" "<dependency>"` to understand what you're cutting.
- Check [[Known Unsafe Areas]] before starting any extraction in this file.
- After each extraction, run `graphify update .` and verify the graph shows the new path.

## Related files/components
- `src/app/(public)/services/page.tsx`
- `src/app/(public)/services/lib/pricing/engine.ts`
- `src/app/(public)/services/lib/routing/index.ts`

## Related Systems
- [[../Components/ServicesPageContent|ServicesPageContent]] — the component being refactored
- [[../Components/useRouteResult|useRouteResult]] — route calculation hook
- [[../Systems/Route Service|Route Service]] — underlying routing/distance lib
- [[../Systems/Pricing Engine|Pricing Engine]] — pricing engine that estimation helpers feed into
- [[../Systems/Bud Core Runtime|Bud Core Runtime]] — long-term home for extracted runtime logic
- [[Known Unsafe Areas]]
- [[Next Safe Refactor Batches]]
