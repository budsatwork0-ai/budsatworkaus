---
tags: [system, agents, runtime, guardrails]
---

# Agent Runtime

## Purpose
The execution engine for all AI agents. Wraps every agent run with retries (3×), a 30 s LLM timeout, robust JSON parsing, guardrails enforcement, and per-run token cost accounting.

## Source files
- `src/lib/agents/runtime.ts` — `runAgent()` entry point
- `src/lib/agents/registry.ts` — loads agent definitions from `src/lib/agents/agents/`
- `src/lib/agents/types.ts` — `AgentDefinition`, `AgentContext`, `ProposedAction`, `AgentRunResult`
- `src/lib/agents/guardrails/` — 7 policies

## API routes
- `POST /api/agents/run` — manual trigger
- `GET /api/agents/runs` — run history
- `GET|POST /api/agents/actions/[id]` — approval queue
- `POST /api/agents/cron` — scheduled trigger

## Guardrails summary
| Policy | Limit |
|---|---|
| Recursion depth | Max 5 nested `callAgent()` hops |
| Call loop | Blocks same (agentId, input) twice in lineage |
| Cost budget | 200¢ per-run, 500¢ per-lineage |
| Dangerous action | Human review for bulk delete ≥25 rows, mass email ≥50 recipients, financial >A$500, DDL SQL |
| Context drift | Child intent must share ≥0.08 Jaccard similarity with parent |
| Intent completion | Post-run summary must echo stated intent (warn-only) |
| Hallucination | `target_id` in proposed actions must exist in `target_table` |

## Claude should know
- All 30+ agent definitions live in `src/lib/agents/agents/` — add a new agent by implementing `AgentDefinition`.
- Guardrails run on every hook — you cannot bypass them without editing `config.policies.disabled` in the agent definition.
- The approval queue is the safety valve for dangerous actions. Do not remove it.
- Tests live at `tests/lib/agent-guardrails.test.ts` — run them before touching guardrail logic.
- The dashboard UI is at `src/app/(app)/dashboard/agents/`.

## Related files/components
- `src/lib/agents/runtime.ts`
- `src/lib/agents/registry.ts`
- `src/lib/agents/types.ts`
- `src/lib/agents/guardrails/`
- `src/app/(app)/dashboard/agents/` — admin UI

## Related Systems
- [[Mission Control]]
- [[Bud Core Runtime]]
- [[AgentDefinition]]
- [[AgentContext]]
- [[createServiceClient]]
- [[getAuthUser]]
- [[05 Automation/Automations Log|Automations Log]]
- [[Graphify/Graphify Overview|Graphify]]

## Graphify queries
```bash
graphify query "agent runtime runAgent guardrails"
graphify explain "runtime.ts"
graphify path "runtime.ts" "registry.ts"
```
