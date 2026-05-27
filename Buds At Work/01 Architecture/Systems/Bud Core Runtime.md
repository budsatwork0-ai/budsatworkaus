---
tags: [system, runtime, architecture, god-node]
---

# Bud Core Runtime

## Core Runtime Functions
- `deriveGlobalTruth()` — pulls together jobs, quotes, crew, finance into unified state
- `deriveBudOsState()` — maps global truth to OS-level view model
- `buildBudOsActionQueue()` — derives prioritised action list from state
- `MissionControlHealth` — typed health snapshot used by the admin dashboard

## Purpose
Centralised operational truth engine for Bud OS. Business logic lives here, not in UI components.

## Source files
- `src/lib/bud/health.ts` — `MissionControlHealth` type and health-check logic
- `src/lib/bud/overview-v2.ts` — `deriveGlobalTruth()`
- `src/lib/bud/os-view-model.ts` — `deriveBudOsState()`, `buildBudOsActionQueue()`

## Long-term Goal
Move operational intelligence out of UI components and into runtime orchestration layers.

## Future Packages
- `bud-core`
- `services-core`
- `analytics-core`
- `github-intelligence`
- `mission-control-core`
- `agent-runtime`

## Architectural Principle
> UI visualises operational intelligence. Runtime owns operational intelligence.

## Claude should know
- This is the single source of truth for "what is the business doing." Agents query it; the dashboard displays it.
- Do not embed operational logic in React components — extract to this layer.
- Treat `deriveGlobalTruth()` as an append-only aggregator. Adding a new data source goes here, not in a dashboard tab.
- The runtime is the long-term destination for any logic currently tangled inside `ServicesPageContent`.

## Related files/components
- `src/lib/bud/health.ts`
- `src/lib/bud/overview-v2.ts`
- `src/lib/bud/os-view-model.ts`
- `src/app/(app)/dashboard/` — renders this state

## Related Systems
- [[Pricing Engine]]
- [[WizardState]]
- [[Route Service]]
- [[Quote Pipeline]]
- [[Mission Control]]
- [[Agent Runtime]]
- [[Graphify/Graphify Overview|Graphify]]

## Graphify queries
```bash
graphify query "bud core runtime derive global truth"
graphify explain "overview-v2.ts"
graphify path "deriveGlobalTruth()" "buildBudOsActionQueue()"
```
