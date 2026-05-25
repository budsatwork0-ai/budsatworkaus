# useRouteResult

## Purpose
React hook that watches the customer's address in `WizardState` and fires a debounced route lookup. Caches results to avoid redundant API calls when the user revisits the address field.

## Source file
`src/app/(public)/services/lib/hooks/useRouteResult.ts`

## How it fits in
`ServicesPageContent` calls this hook near the top of its render. When the address changes, the hook calls [[Route Service]], then dispatches the `RouteLookupResult` back into `WizardState` so [[Pricing Engine]] can include any travel surcharge.

## Related Systems

- [[Route Service]]
- [[WizardState]]
- [[ServicesPageContent]]
- [[Pricing Engine]]

## Graphify queries
```bash
graphify query "useRouteResult route hook address"
graphify explain "useRouteResult.ts"
graphify path "useRouteResult.ts" "routing/index.ts"
```
