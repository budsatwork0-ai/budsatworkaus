# Graphify

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

## Maintenance

Run `graphify update .` after any code change (AST-only, no API cost).
For a full graph health pass — orphan detection, weak cluster repair, hub strengthening — use [[Automation/Graph Maintenance|Graph Maintenance]].

## Related Systems

- [[Bud Core Runtime]]
- [[Agent Runtime]]
- [[ServicesPageContent]]
- [[Pricing Engine]]
- [[Mission Control]]
- [[Quote Pipeline]]
