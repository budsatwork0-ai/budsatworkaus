---
tags: [system, pricing, quote, calculation]
---

# Pricing Engine

## Purpose
Calculates the final price for each service from the current wizard state. The single source of truth for all quote amounts — cleaning, windows, yard, car detailing, dump runs, etc.

## Source files
- `src/app/(public)/services/lib/pricing/engine.ts` — core engine
- `src/app/ui/yard/yardPricing.ts` — polygon area → price
- `src/app/(public)/services/lib/pricing/ndis.ts` — NDIS rate overrides

## How it fits in
`ServicesPageContent` calls the engine on every state change to keep the live estimate up to date. The result is passed to `computeLiveEstimate()` and ultimately into the quote payload.

## Claude should know
- This is the only place service prices are calculated. Never compute prices inside React components.
- NDIS rate overrides live in a separate file (`ndis.ts`) — they apply on top of the base engine.
- Yard pricing uses polygon area from the FloorPlanBuilder — a separate calculation path.
- Travel surcharge is injected by the [[Route Service]] via `WizardState.routeResult`, not calculated here.

## Related files/components
- `src/app/(public)/services/lib/pricing/engine.ts`
- `src/app/ui/yard/yardPricing.ts`
- `src/app/(public)/services/lib/pricing/ndis.ts`

## Related Systems
- [[WizardState]]
- [[ServicesPageContent]]
- [[Quote Pipeline]]
- [[Route Service]]
- [[Bud Core Runtime]]
- [[NDIS Matching]]
- [[Processes/Quote Flow|Quote Flow]]

## Graphify queries
```bash
graphify query "pricing engine estimate calculation"
graphify explain "engine.ts"
graphify path "ServicesPageContent()" "engine.ts"
```
