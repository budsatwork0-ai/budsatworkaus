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

## Related Systems

- [[AgentDefinition]]
- [[Agent Runtime]]
- [[Mission Control]]

## Graphify queries
```bash
graphify explain "AgentContext"
graphify path "AgentContext" "runtime.ts"
```
