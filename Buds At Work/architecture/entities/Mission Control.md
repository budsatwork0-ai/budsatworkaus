# Mission Control

## Purpose
Aggregates operational truth from jobs, quotes, crew, and finance into a unified health state for the admin dashboard. The single read model for "what is the business doing right now."

## Source files
- `src/lib/bud/health.ts` — `MissionControlHealth` type; health-check logic
- `src/lib/bud/overview-v2.ts` — `deriveGlobalTruth()` pulls together all data sources
- `src/lib/bud/os-view-model.ts` — `deriveBudOsState()`, `buildBudOsActionQueue()`

## How it fits in
The admin dashboard (`/dashboard`) renders Mission Control data. The [[Agent Runtime]] queries this state when agents need current operational context (e.g. scheduling, cash-flow agents).

## Related Systems

- [[Bud Core Runtime]]
- [[Agent Runtime]]
- [[Quote Pipeline]]
- [[Admin-Agent]]
- [[createServiceClient]]
- [[getAuthUser]]
- [[New Booking]]
- [[Automations Log]]

## Graphify queries
```bash
graphify query "mission control health derive global truth"
graphify explain "health.ts"
graphify path "deriveGlobalTruth()" "buildBudOsActionQueue()"
```
