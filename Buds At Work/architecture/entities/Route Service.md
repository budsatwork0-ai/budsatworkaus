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
