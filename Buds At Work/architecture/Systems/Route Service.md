---
tags: [system, routing, pricing, geo]
---

# Route Service

## Purpose
Calculates driving distance and estimated travel time between the customer's address and the nearest service depot. The result feeds a travel surcharge into the quote.

## Source file
`src/app/(public)/services/lib/routing/index.ts`

Key functions:
- `fallbackRoute()` — returns a zero-cost route when the API is unavailable
- `formatRouteKey()` — cache key for deduplicating identical address lookups

## How it fits in
`useRouteResult` calls the route service when the customer address changes. The `RouteLookupResult` is stored in `WizardState` and read by the [[Pricing Engine]] to add any travel surcharge.

## Claude should know
- `fallbackRoute()` returns zero cost — if routing is broken, quotes will not include travel surcharge. This is intentional (degrade gracefully rather than block checkout).
- Results are keyed by `formatRouteKey()` to avoid redundant API calls for the same address.
- The Google Maps API key is `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — it must be set in both `.env.local` and Vercel.

## Related files/components
- `src/app/(public)/services/lib/routing/index.ts`
- `src/app/(public)/services/lib/hooks/useRouteResult.ts`

## Related Systems
- [[WizardState]]
- [[useRouteResult]]
- [[Pricing Engine]]
- [[ServicesPageContent]]

## Graphify queries
```bash
graphify query "route routing travel distance"
graphify explain "routing/index.ts"
graphify path "useRouteResult.ts" "engine.ts"
```
