---
tags: [architecture, index, claude-guide]
---

# Architecture — Start Here

This is the entry point for Claude Code and human collaborators navigating the Buds at Work codebase.

---

## How Claude Code should use this vault

1. **For any codebase question** — run `graphify query "<question>"` first. The knowledge graph gives you a scoped subgraph far faster than grepping raw files. Only open `GRAPH_REPORT.md` for broad architecture orientation.
2. **For system relationships** — use `graphify path "<A>" "<B>"` to find the connection between two symbols.
3. **For deep dives** — use `graphify explain "<concept>"` then cross-reference the matching note in [[Systems/]] or [[Components/]].
4. **After editing code** — run `graphify update .` (AST-only, no API cost) to keep the graph current.
5. **For automation/prompt design** — see [[Automation/Claude Code Prompts/]] for reusable graph maintenance and analysis prompts.

---

## Folder map

| Folder | Contents |
|---|---|
| [[Graphify/Graphify Overview\|Graphify/]] | Graph commands, outputs, GRAPH_REPORT |
| [[Systems/]] | Runtime, infra, and server-side system notes |
| [[Components/]] | React components and hooks |
| [[Refactor Plans/]] | Safe extraction plans and risk assessments |
| [[Claude Memory/]] | Anti-patterns, conventions, and known failure modes |

---

## How Graphify fits into the architecture workflow

```
Code change
    ↓
graphify update .          ← keep graph fresh (free)
    ↓
graphify query "<concept>" ← scoped subgraph for the affected area
    ↓
Cross-reference note in Systems/ or Components/
    ↓
If refactoring → check Refactor Plans/ for staged plan
    ↓
After significant refactor → update architecture note + re-run graphify update .
```

The graph lives at `graphify-out/graph.json`. The human-readable summary is at [[Graphify/GRAPH_REPORT]]. The interactive call-flow viewer is `graphify-out/budsatwork-callflow.html`.

---

## How refactors should be staged

All refactors follow the principle in [[Refactor Plans/Services Core Extraction]]: **surgical extractions only, no broad rewrites**.

1. Check [[Refactor Plans/Known Unsafe Areas]] — if the target area is listed, read it before touching anything.
2. Check [[Refactor Plans/Next Safe Refactor Batches]] — pick a batch that is already scoped and risk-assessed.
3. Run `graphify path "<source>" "<target>"` to understand what you're cutting.
4. One extraction per PR. No UI rewrites bundled with logic moves.
5. After the PR lands, run `graphify update .` and verify the path has changed.

---

## Where query outputs should go

| Output type | Destination |
|---|---|
| `graphify query` results used to plan a refactor | paste into the relevant [[Refactor Plans/]] note |
| `graphify explain` results that reveal new god-node behaviour | add a "Graphify queries" section to the [[Systems/]] or [[Components/]] note |
| Full `graphify update .` after a large refactor | note the new commit hash in [[Graphify/GRAPH_REPORT]] |
| Graph health pass results | append to [[Automation/Claude Code Prompts/Graph Maintenance Prompt]] |

---

## How runtime and system ownership is documented

Each note in [[Systems/]] documents:
- **Purpose** — what the system does
- **Source files** — exact paths with line numbers where known
- **API routes** — if it exposes HTTP endpoints
- **Claude should know** — gotchas, invariants, and non-obvious constraints
- **Related files/components** — wikilinks to dependents
- **Graphify queries** — ready-to-run commands for the most common questions about that system

The god nodes (highest connection count) are:
- [[Systems/createServiceClient]] — 218 connections — every API route
- [[Components/Brand]] — 137 connections — every UI component
- [[Systems/getAuthUser]] — 85 connections — every protected route
- [[Systems/AgentContext]] — 64 connections — every agent execution

---

## Key system hubs

### Runtime
- [[Systems/Bud Core Runtime]] — operational truth engine
- [[Systems/Mission Control]] — aggregated business health state
- [[Systems/Agent Runtime]] — AI agent execution, guardrails, approval queue

### Quote & Payment
- [[Components/ServicesPageContent]] — 5,500-line quote wizard
- [[Components/WizardState]] — shared wizard state shape
- [[Systems/Pricing Engine]] — live price calculation
- [[Systems/Route Service]] — travel distance and surcharge
- [[Systems/Quote Pipeline]] — quote → checkout → webhook lifecycle
- [[Systems/Stripe Integration]] — Stripe session and webhook handler

### Infrastructure
- [[Systems/createServiceClient]] — Supabase service client (god node)
- [[Systems/getAuthUser]] — auth gate (god node)
- [[Systems/Email System]] — Resend transactional emails

### Design
- [[Components/Brand]] — design token object (god node)

### NDIS
- [[Systems/NDIS Matching]] — worker coordination and scoring layer

---

## Related
- [[00 System Core/Home|Home]] — vault root index
- [[Automation/Bud Automation Roadmap]] — what's automated and what's next
- [[Graphify/GRAPH_REPORT]] — full community and god-node breakdown
