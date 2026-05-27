---
tags: [system, routing, pricing, geo]
---

# Route Service

## Purpose
Calculates driving distance and estimated travel time between the customer's address and the nearest service depot. The result feeds a travel surcharge into the quote.

## Source files
- `src/lib/services-core/routing.ts` — **canonical location** (pure functions + types)
- `src/app/(public)/services/lib/routing/index.ts` — UI shim: re-exports everything from services-core, plus `isQueenslandPlace` (Google Maps type dependency, UI layer only)

Key functions:
- `fallbackRoute()` — haversine-based fallback when the Maps API is unavailable
- `formatRouteKey()` — cache key for deduplicating identical address lookups
- `fetchDrivingDistance()` — calls Google Maps Distance Matrix API
- `haversineDistanceKm()` — straight-line distance calculation
- `roundToHalfKm()` — normalises distance to nearest 0.5 km

## Types
- `RouteLocation` — `{ address, lat, lng, placeId? }` — canonical in `services-core/routing.ts`
- `RouteLookupResult` — `{ distanceKm, durationMinutes }` — canonical in `services-core/routing.ts`
- Both are re-exported from `services/types/index.ts` for backward compatibility

## How it fits in
`useRouteResult` calls the route service when the customer address changes. The `RouteLookupResult` is stored in `WizardState` and read by the [[Pricing Engine]] to add any travel surcharge.

## Import sites (3 total)
- `useRouteResult.ts` — imports `fetchDrivingDistance`, `fallbackRoute`, `formatRouteKey`, `roundToHalfKm` from the shim
- `DistanceRouteConfigurator.tsx` — imports `isQueenslandPlace` from the shim (stays in UI layer)
- `ServiceAddressInput.tsx` — imports `isQueenslandPlace` from the shim (stays in UI layer)

## Claude should know
- `fallbackRoute()` returns haversine distance — if the Maps API is broken, quotes proceed without travel surcharge. This is intentional (degrade gracefully, don't block checkout).
- `isQueenslandPlace` uses `google.maps.places.PlaceResult` — it must stay in the UI shim, not in services-core.
- `RouteLocation` and `RouteLookupResult` are now canonically defined in `services-core/routing.ts`. The definitions in `services/types/index.ts` are re-exports — do not add a second definition there.
- The Google Maps API key is `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — must be set in `.env.local` and Vercel.

## Related files/components
- `src/lib/services-core/routing.ts` — canonical
- `src/app/(public)/services/lib/routing/index.ts` — UI shim
- `src/app/(public)/services/lib/hooks/useRouteResult.ts`
- `src/app/(public)/services/types/index.ts` — re-exports the types

## Related Systems
- [[WizardState]]
- [[useRouteResult]]
- [[Pricing Engine]]
- [[ServicesPageContent]]

## Graphify queries
```bash
graphify query "route routing travel distance"
graphify explain "routing.ts"
graphify path "useRouteResult.ts" "routing.ts"
```
