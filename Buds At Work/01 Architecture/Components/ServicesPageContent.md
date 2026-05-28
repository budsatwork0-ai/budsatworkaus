---
tags: [component, react, quote-wizard, refactor-risk]
---

# ServicesPageContent

## Purpose
The main quote wizard component — a ~5,500-line React component that orchestrates every step of the public services page. It owns the step router, renders each service's UI, and drives the live pricing display.

## Source file
`src/app/(public)/services/page.tsx` — `ServicesPageContent()` starts at L2987.

Step 2 is rendered via an IIFE pattern `{S.step === 2 && (() => { ... })()}` — this is intentional to avoid prop-drilling across deeply nested sub-steps.

## Key internal dependencies
- `useLocalStorageReducer` + `wizardReducer` — shared state
- `computeLiveEstimate()` — calls [[Pricing Engine]] on every render
- `useRouteResult` hook — triggers route lookups on address change
- Dynamically imported: `FloorPlanBuilder`, `RegoLookupAssistant`

## Claude should know
- At 5,500+ lines this is the highest-risk file in the codebase. Any refactor here must be surgical.
- The IIFE in Step 2 is intentional — do not "clean it up" by converting to a component without understanding the prop-drilling implications.
- Static data constants (`COMM_FEATURES`, `COMM_STANDARDS`, `COMM_PRESETS`) live at module scope above `ServicesPageContent` — move them to the runtime layer, not to a new component.
- See [[../03 Active Refactors/Services Core Extraction]] for the staged extraction plan.
- See [[../03 Active Refactors/Known Unsafe Areas]] for areas to avoid touching.

## Related files/components
- `src/app/(public)/services/page.tsx`

## Related Systems
- [[WizardState]]
- [[Pricing Engine]]
- [[Route Service]]
- [[useRouteResult]]
- [[Quote Pipeline]]
- [[Bud Core Runtime]]
- [[Brand]]
- [[06 Operations/Processes/Quote Flow|Quote Flow]]
- [[../03 Active Refactors/Services Core Extraction|Services Core Extraction]]

## Graphify queries
```bash
graphify query "ServicesPageContent wizard step"
graphify explain "page.tsx"
graphify path "ServicesPageContent()" "WizardState"
```
