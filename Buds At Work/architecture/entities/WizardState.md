# WizardState

## Purpose
The shared data shape for the entire quote wizard. Holds every user selection — service type, address, add-ons, room count, yard size, vehicle details — plus derived pricing inputs.

## Source files
- Type definition: `src/app/(public)/services/types/index.ts` (L228 — `WizardState`)
- Reducer + localStorage persistence: `src/app/(public)/services/lib/wizard-state.ts`
  - `useLocalStorageReducer()` — syncs state to `localStorage` on every change
  - `wizardReducer` — handles all `DISPATCH` actions

## How it fits in
Every step component reads from and dispatches to `WizardState`. The [[Pricing Engine]] consumes it to calculate prices. `[[useRouteResult]]` reads the address fields and writes back the route result.

## Related Systems

- [[ServicesPageContent]]
- [[Pricing Engine]]
- [[Route Service]]
- [[useRouteResult]]
- [[Quote Pipeline]]
- [[Bud Core Runtime]]
- [[Quote Flow]]

## Graphify queries
```bash
graphify query "WizardState reducer wizard"
graphify explain "wizard-state.ts"
graphify path "WizardState" "engine.ts"
```
