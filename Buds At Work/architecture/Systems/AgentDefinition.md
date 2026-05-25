---
tags: [system, agents, interface, god-node]
---

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

## Claude should know
- To add a new agent: create a new file in `src/lib/agents/agents/`, implement `AgentDefinition`, and the registry picks it up automatically — no other wiring needed.
- The `category` field is used by the dashboard grid to group agents by domain.
- Use `config.policies.disabled` sparingly — disabling guardrails should have a documented reason.
- 30+ agent definitions exist across categories: sales, support, ops, hiring, finance, compliance.

## Related files/components
- `src/lib/agents/types.ts` L31
- `src/lib/agents/agents/` — all agent implementations

## Related Systems
- [[Agent Runtime]]
- [[AgentContext]]

## Graphify queries
```bash
graphify explain "AgentDefinition"
graphify path "AgentDefinition" "runtime.ts"
```
