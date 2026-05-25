---
tags: [component, hook, react, routing]
---

# useRouteResult

## Purpose
React hook that watches the customer's address in `WizardState` and fires a debounced route lookup. Caches results to avoid redundant API calls when the user revisits the address field.

## Source file
`src/app/(public)/services/lib/hooks/useRouteResult.ts`

## How it fits in
`ServicesPageContent` calls this hook near the top of its render. When the address changes, the hook calls [[Route Service]], then dispatches the `RouteLookupResult` back into `WizardState` so [[Pricing Engine]] can include any travel surcharge.

## Claude should know
- This hook is debounced — do not add extra debouncing around it.
- If routing fails, the hook writes the `fallbackRoute()` result into `WizardState` (zero surcharge, no error shown).
- Results are cached by address key so revisiting the same address doesn't trigger a new API call.

## Related files/components
- `src/app/(public)/services/lib/hooks/useRouteResult.ts`

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
