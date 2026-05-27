---
tags: [system, agents, context, god-node]
---

# AgentContext

## Purpose
The runtime context object injected into every agent execution (64 connections). Gives agents access to the LLM caller, action proposer, sub-agent caller, and structured logger — without needing to import anything directly.

## Source file
`src/lib/agents/types.ts` L49

Key properties:
- `ctx.llm(prompt)` — calls Claude with the agent's prompt, respects the 30 s timeout
- `ctx.proposeAction(action)` — submits a `ProposedAction` for guardrails review
- `ctx.callAgent(id, input)` — spawns a sub-agent (subject to recursion-depth and call-loop guardrails)
- `ctx.log(message)` — appends to the structured run log

## Why it's a god node
Every agent's `run()` function receives it. It's the primary interface between agent logic and the runtime.

## Claude should know
- Never import `claude` or `anthropic` directly inside an agent definition — always use `ctx.llm()`.
- `ctx.proposeAction()` is how agents request side-effects. All proposals go through guardrails.
- `ctx.callAgent()` enforces recursion depth (max 5) and call-loop detection automatically.
- Do not log sensitive data via `ctx.log()` — logs are stored and visible in the approval queue.

## Related files/components
- `src/lib/agents/types.ts` L49

## Related Systems
- [[AgentDefinition]]
- [[Agent Runtime]]
- [[Mission Control]]

## Graphify queries
```bash
graphify explain "AgentContext"
graphify path "AgentContext" "runtime.ts"
```
