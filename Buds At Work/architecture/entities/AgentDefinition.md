# AgentDefinition

## Purpose
The TypeScript interface every agent must implement (64 connections). Defines the agent's ID, category, prompt template, and optional policy overrides. The registry loads all definitions from `src/lib/agents/agents/` and the runtime reads them at execution time.

## Source file
`src/lib/agents/types.ts` L31

Key fields:
- `id` — unique slug (e.g. `quote-triage`, `cash-flow-forecaster`)
- `category` — `sales | support | ops | hiring | finance | compliance`
- `prompt` — function that receives `AgentContext` and returns the LLM prompt string
- `config.policies.disabled` — array of guardrail policy names to skip for this agent

## Why it's a god node
Every agent file imports it. Adding a new capability means implementing this interface.

## Related Systems

- [[Agent Runtime]]
- [[AgentContext]]
- [[Meta-Agent]]
- [[Admin-Agent]]
- [[Frontend-Agent]]

## Graphify queries
```bash
graphify explain "AgentDefinition"
graphify path "AgentDefinition" "runtime.ts"
```
