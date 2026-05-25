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

## Related Systems

- [[WizardState]]
- [[Pricing Engine]]
- [[Route Service]]
- [[useRouteResult]]
- [[Quote Pipeline]]
- [[Bud Core Runtime]]
- [[Brand]]
- [[Quote Flow]]

## Graphify queries
```bash
graphify query "ServicesPageContent wizard step"
graphify explain "page.tsx"
graphify path "ServicesPageContent()" "WizardState"
```
