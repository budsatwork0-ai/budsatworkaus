# Pricing Engine

## Purpose
Calculates the final price for each service from the current wizard state. The single source of truth for all quote amounts — cleans up, windows, yard, car detailing, dump runs, etc.

## Source file
`src/app/(public)/services/lib/pricing/engine.ts`

Related pricing helpers:
- `src/app/ui/yard/yardPricing.ts` — polygon area → price
- `src/app/(public)/services/lib/pricing/ndis.ts` — NDIS rate overrides

## How it fits in
`ServicesPageContent` calls the engine on every state change to keep the live estimate up to date. The result is passed to `computeLiveEstimate()` and ultimately into the quote payload.

## Related Systems

- [[WizardState]]
- [[ServicesPageContent]]
- [[Quote Pipeline]]
- [[Route Service]]
- [[Bud Core Runtime]]
- [[Quote Flow]]

## Graphify queries
```bash
graphify query "pricing engine estimate calculation"
graphify explain "engine.ts"
graphify path "ServicesPageContent()" "engine.ts"
```
