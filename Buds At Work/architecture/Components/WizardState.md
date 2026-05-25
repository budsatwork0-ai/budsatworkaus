---
tags: [component, state, react, wizard]
---

# WizardState

## Purpose
The shared data shape for the entire quote wizard. Holds every user selection — service type, address, add-ons, room count, yard size, vehicle details — plus derived pricing inputs.

## Source files
- Type definition: `src/app/(public)/services/types/index.ts` (L228 — `WizardState`)
- Reducer + localStorage persistence: `src/app/(public)/services/lib/wizard-state.ts`
  - `useLocalStorageReducer()` — syncs state to `localStorage` on every change
  - `wizardReducer` — handles all `DISPATCH` actions

## How it fits in
Every step component reads from and dispatches to `WizardState`. The [[Pricing Engine]] consumes it to calculate prices. [[useRouteResult]] reads the address fields and writes back the route result.

## Claude should know
- WizardState is persisted to `localStorage` — old state from a previous session can interfere with tests. Clear it between test runs.
- All state mutations go through `wizardReducer` — never mutate the state object directly in a component.
- Adding a new wizard field means: 1) update the type in `types/index.ts`, 2) handle it in `wizardReducer`, 3) update the pricing engine if it affects price.
- The route result (`routeResult`) is written back into WizardState by the `useRouteResult` hook — it is not set by the user.

## Related files/components
- `src/app/(public)/services/types/index.ts` L228
- `src/app/(public)/services/lib/wizard-state.ts`

## Related Systems
- [[ServicesPageContent]]
- [[Pricing Engine]]
- [[Route Service]]
- [[useRouteResult]]
- [[Quote Pipeline]]
- [[Bud Core Runtime]]
- [[Processes/Quote Flow|Quote Flow]]

## Graphify queries
```bash
graphify query "WizardState reducer wizard"
graphify explain "wizard-state.ts"
graphify path "WizardState" "engine.ts"
```
