# Agent Runtime

## Purpose
The execution engine for all AI agents. Wraps every agent run with retries (3×), a 30 s LLM timeout, robust JSON parsing, guardrails enforcement, and per-run token cost accounting.

## Source files
- `src/lib/agents/runtime.ts` — `runAgent()` entry point
- `src/lib/agents/registry.ts` — loads agent definitions from `src/lib/agents/agents/`
- `src/lib/agents/types.ts` — `AgentDefinition`, `AgentContext`, `ProposedAction`, `AgentRunResult`
- `src/lib/agents/guardrails/` — 7 policies (recursion depth, call loop, cost budget, dangerous-action, context drift, intent completion, hallucination)

## API routes
- `POST /api/agents/run` — manual trigger
- `GET /api/agents/runs` — run history
- `GET|POST /api/agents/actions/[id]` — approval queue
- `POST /api/agents/cron` — scheduled trigger

## Related Systems

- [[Mission Control]]
- [[Bud Core Runtime]]
- [[Meta-Agent]]
- [[Admin-Agent]]
- [[Frontend-Agent]]
- [[Graphify]]
- [[AgentDefinition]]
- [[AgentContext]]
- [[createServiceClient]]
- [[getAuthUser]]
- [[Automations Log]]

## Graphify queries
```bash
graphify query "agent runtime runAgent guardrails"
graphify explain "runtime.ts"
graphify path "runtime.ts" "registry.ts"
```
