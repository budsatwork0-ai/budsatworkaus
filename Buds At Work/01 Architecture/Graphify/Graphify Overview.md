---
tags: [graphify, tooling, architecture]
---

# Graphify Overview

## Purpose
Builds and queries a live knowledge graph of the codebase. Extracts AST nodes, call edges, and community clusters so you can navigate relationships without reading raw source.

## Output location
`graphify-out/` — contains `graph.json`, `GRAPH_REPORT.md`, and the interactive `budsatwork-callflow.html`.
The vault copy lives in `Buds At Work/architecture/Graphify/` — see [[GRAPH_REPORT]] for the full community and god-node breakdown.

## Key commands
```bash
# Scoped subgraph around a concept (fastest)
graphify query "<question>"

# Shortest path between two symbols
graphify path "<A>" "<B>"

# Deep explanation of a single concept
graphify explain "<concept>"

# Rebuild graph after code changes (AST-only, no API cost)
graphify update .
```

## When to run each command

| Command | When |
|---|---|
| `graphify query` | Starting any investigation — get oriented fast |
| `graphify path` | Planning a refactor — understand the cut |
| `graphify explain` | Deep-diving a specific file or symbol |
| `graphify update .` | After every code change that touches shared systems |

## Maintenance

Run `graphify update .` after any code change (AST-only, no API cost).
For a full graph health pass — orphan detection, weak cluster repair, hub strengthening — use [[05 Automation/Claude Code Prompts/Graph Maintenance Prompt|Graph Maintenance Prompt]].

## Claude should know
- The graph is built from commit `e21dbe13` — run `git rev-parse HEAD` to check staleness.
- `graphify query` returns a scoped subgraph. It is almost always faster and smaller than reading `GRAPH_REPORT.md` raw.
- `graphify update .` has zero API cost — it is AST-only. Run it freely.
- God nodes (highest edge count): `createServiceClient` (218), `Brand` (137), `getAuthUser` (85), `AgentContext`/`AgentDefinition` (64 each).
- 5877 nodes · 10653 edges · 378 communities in the current graph.

## Related files/components
- `graphify-out/graph.json` — raw graph data
- `graphify-out/GRAPH_REPORT.md` — human-readable summary
- `graphify-out/budsatwork-callflow.html` — interactive viewer
- [[GRAPH_REPORT]] — vault copy of the report

## Related Systems
- [[../Systems/Bud Core Runtime|Bud Core Runtime]]
- [[../Systems/Agent Runtime|Agent Runtime]]
- [[../Components/ServicesPageContent|ServicesPageContent]]
- [[../Systems/Pricing Engine|Pricing Engine]]
- [[../Systems/Mission Control|Mission Control]]
- [[../Systems/Quote Pipeline|Quote Pipeline]]
- [[../00 Start Here|Architecture Start Here]]
