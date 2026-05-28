---
tags: [system, runtime, dashboard, read-model]
---

# Mission Control

## Purpose
Aggregates operational truth from jobs, quotes, crew, and finance into a unified health state for the admin dashboard. The single read model for "what is the business doing right now."

## Source files
- `src/lib/bud/health.ts` — `MissionControlHealth` type; health-check logic
- `src/lib/bud/overview-v2.ts` — `deriveGlobalTruth()` pulls together all data sources
- `src/lib/bud/os-view-model.ts` — `deriveBudOsState()`, `buildBudOsActionQueue()`

## How it fits in
The admin dashboard (`/dashboard`) renders Mission Control data. The [[Agent Runtime]] queries this state when agents need current operational context (e.g. scheduling, cash-flow agents).

## Claude should know
- Mission Control is read-only from the UI side — never write to it directly from a component.
- All state mutations happen via API routes or agent actions, then Mission Control re-derives on the next poll.
- If the admin dashboard shows stale data, the issue is almost always in `deriveGlobalTruth()` not including a new data source.
- Agents that need operational context should read from this layer, not query Supabase directly.

## Related files/components
- `src/lib/bud/health.ts`
- `src/lib/bud/overview-v2.ts`
- `src/lib/bud/os-view-model.ts`
- `src/app/(app)/dashboard/` — renders this state

## Related Systems
- [[Bud Core Runtime]]
- [[Agent Runtime]]
- [[Quote Pipeline]]
- [[createServiceClient]]
- [[getAuthUser]]
- [[05 Automation/Automations Log|Automations Log]]

## Graphify queries
```bash
graphify query "mission control health derive global truth"
graphify explain "health.ts"
graphify path "deriveGlobalTruth()" "buildBudOsActionQueue()"
```
