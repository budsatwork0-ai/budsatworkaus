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
5. **For automation/prompt design** — see [[05 Automation/Claude Code Prompts/]] for reusable graph maintenance and analysis prompts.

---

## Folder map

| Folder | Contents |
|---|---|
| [[Graphify/Graphify Overview\|Graphify/]] | Graph commands, outputs, GRAPH_REPORT |
| [[Systems/]] | Runtime, infra, and server-side system notes |
| [[Components/]] | React components and hooks |
| [[../03 Active Refactors/]] | Safe extraction plans and risk assessments |
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

All refactors follow the principle in [[../03 Active Refactors/Services Core Extraction]]: **surgical extractions only, no broad rewrites**.

1. Check [[../03 Active Refactors/Known Unsafe Areas]] — if the target area is listed, read it before touching anything.
2. Check [[../03 Active Refactors/Next Safe Refactor Batches]] — pick a batch that is already scoped and risk-assessed.
3. Run `graphify path "<source>" "<target>"` to understand what you're cutting.
4. One extraction per PR. No UI rewrites bundled with logic moves.
5. After the PR lands, run `graphify update .` and verify the path has changed.

---

## Where query outputs should go

| Output type | Destination |
|---|---|
| `graphify query` results used to plan a refactor | paste into the relevant [[../03 Active Refactors/]] note |
| `graphify explain` results that reveal new god-node behaviour | add a "Graphify queries" section to the [[Systems/]] or [[Components/]] note |
| Full `graphify update .` after a large refactor | note the new commit hash in [[Graphify/GRAPH_REPORT]] |
| Graph health pass results | append to [[05 Automation/Claude Code Prompts/Graph Maintenance Prompt]] |

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
- [[05 Automation/Bud Automation Roadmap]] — what's automated and what's next
- [[Graphify/GRAPH_REPORT]] — full community and god-node breakdown

# Bud OS Global Architecture Constitution

You are working on the Buds at Work platform, Bud OS, Mission Control, Graphify, Supabase, Claude Code integrations, and the runtime agent fleet.

Before making any changes, understand the core principle:

The goal is not to add more AI.

The goal is to reduce confusion, increase truthfulness, and create a self-improving system that can be understood by humans, Claude Code, Codex, Graphify, and future developers.

---

# Primary Mission

Mission Control must answer one question:

"What requires attention right now?"

If a feature does not help answer that question, it probably belongs somewhere else.

Mission Control is not a dumping ground for tools, reports, experiments, diagnostics, prototypes, architecture diagrams, or future ideas.

Mission Control is an operational cockpit.

---

# Authority Hierarchy

Bud OS has a clear chain of command.

Bud
→ Orchestrator

Bud Observer
→ Watches systems and detects issues

Graphify
→ Brain and knowledge graph

Claude Code
→ Builder and implementer

Runtime Agents
→ Workers that perform actions

Reports
→ Information only

Planned Systems
→ Future work

Never present these categories as equals.

---

# Runtime Truth Rules

An agent is only Active if it has:

* a runtime execution path
* a cron trigger
* a queue
* a webhook
* a job runner
* a real API execution route

If none of those exist:

Do not call it Active.

Instead label it:

* Report Only
* Planned
* Prototype
* Needs Wiring

Never fake runtime status.

Never imply automation where none exists.

---

# Mission Control Structure

Mission Control Home contains:

1. Attention Queue
2. System Health
3. Business Snapshot
4. Approval Queue
5. Activity Feed
6. Next Recommended Action

Only operational information belongs here.

---

# Development Command Structure

Development Command contains:

* Graphify
* Bud Terminal
* Dev OS
* Design System
* Evidence
* Architecture
* Claude Memory

Development tools do not belong on the operational dashboard.

---

# Graphify Rules

Graphify is the source of architectural truth.

Before major refactors:

1. Query Graphify.
2. Identify dependencies.
3. Identify ownership.
4. Identify duplicate logic.
5. Identify dead code.

Do not perform large refactors without consulting Graphify first.

Graphify should reduce uncertainty.

Never ignore Graphify findings.

---

# Supabase Rules

Supabase is not a dumping ground.

Every table must belong to a domain.

Domains:

Core Business

* customers
* jobs
* quotes
* leads

Operations

* agent_runs
* approvals
* tasks
* logs

Knowledge

* graph_nodes
* graph_edges
* memory

Analytics

* events
* metrics

If a table has no clear owner, investigate before adding more data.

---

# Refactor Rules

Prefer deletion over addition.

Prefer consolidation over duplication.

Prefer truth over appearance.

Before creating:

* new component
* new hook
* new table
* new agent
* new route

Check whether an existing solution already exists.

If duplication exists:
eliminate duplication before creating new architecture.

---

# Design System Rules

Do not use fake metrics.

Do not use fake revenue.

Do not use fake jobs counts.

Do not use fake business data.

If data is not real:

Label it:

Sample Data

or

Placeholder

Never allow placeholder content to look operational.

---

# Agent Rules

Separate these categories:

Workers

* Quote Triage
* Customer Reply
* Reviews
* Scheduling
* etc

Orchestrator

* Bud

Watchers

* Bud Observer

Knowledge

* Graphify

Builders

* Claude Code

Personas

* bud-memory
* bud-architect
* bud-qa
* bud-taste

Personas are not runtime agents.

Do not mix them together.

---

# Codebase Cleanup Rules

Always search for:

* dead files
* dead exports
* dead imports
* duplicate components
* duplicate queries
* duplicate logic

before adding new functionality.

Reducing confusion is more valuable than adding features.

---

# Overview-V2 Rule

The current codebase contains legacy architecture and dormant logic.

Treat large files with caution.

Before editing:

* determine what is actually used
* identify dormant exports
* identify dependent files
* produce a deletion plan

Never assume a large file is important simply because it is large.

---

# Mission Control Success Test

After every change ask:

Can a new developer explain:

1. What Bud does?
2. What Bud Observer does?
3. What Graphify does?
4. What Claude Code does?
5. What the Runtime Fleet does?
6. What needs attention right now?

If not:

The architecture is still too confusing.

---

# Final Principle

The objective is not to build the most impressive AI platform.

The objective is to build the clearest, most truthful, most maintainable operating system possible for Buds at Work.

Every refactor should reduce uncertainty.

Every dashboard should increase clarity.

Every agent should have a real purpose.

Every piece of data should have a source of truth.

Every system should have a clear owner.
