# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"` before doing anything else.

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
