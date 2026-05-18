---
type: "decision"
workspace: "ux-agent"
status: "accepted"
impact: "high"
systems:
  - "ux-intelligence"
  - "/services"
  - "/dashboard"
  - "/crew"
tags:
  - "decision"
  - "ux-agent"
  - "architecture"
created: "2026-05-18T00:00:00Z"
---

# Decision: Introduce UX Intelligence as a Dedicated Autonomous Audit Agent

## Context

The UX workspace previously had four narrowly-scoped agents (`layout-critic`, `heatmap-analyst`,
`admin-ux-designer`, `ab-test-architect`). Each ran independently with no shared memory context and
produced siloed `design_insights` rows. There was no mechanism to detect recurring friction patterns
across runs, compare with historical Obsidian memory, or generate a unified priority-ordered roadmap.

As the platform grows (NDIS matching, agent lobby, yard mapping), the number of critical UX surfaces
has outpaced what the existing agents could cover in isolation.

## Rationale

A single `ux-intelligence` agent running weekly:
- Covers all 6 high-priority UX surfaces in one pass (quoting flow, sticky footers, authenticated
  states, admin UX, map interfaces, mobile responsiveness)
- Semantic memory recall (`ctx.memory.search`) enables cross-run comparison, turning isolated findings
  into tracked recurring issues
- Synthesis phase detects cross-area patterns and produces a priority-ordered roadmap (P0→P3)
- Backlinks anchor every finding to affected pages, workflows, and prior issues — satisfying
  Obsidian's bidirectional linking model
- Output shape matches the runtime's `logAgentRun` contract → auto-populates Findings, Tasks, and
  Active-Issues without custom write code

## Consequences

- `ux-intelligence` is the primary UX audit signal source; other UX agents feed it context via
  `design_insights` and `admin_ux_proposals`, not the reverse
- Runs weekly (Monday 8 am); manual trigger available from `/dashboard/agents`
- P0 findings always surface to the approval queue (`requiresApproval: true`)
- High and critical findings are written to `memory_documents` (category `ux`, agent scope
  `ux-intelligence`) for future recall; medium/low are DB-only to avoid memory bloat

## Related

- [[layout-critic]]
- [[heatmap-analyst]]
- [[admin-ux-designer]]
- [[Quote Wizard]]
- [[/services]]
