---
type: "issue"
workspace: "admin-agent"
status: "open"
severity: "high"
systems:
  - "/dashboard"
  - "/dashboard/schedule"
  - "Job Scheduling"
tags:
  - "issue"
  - "admin-agent"
  - "scheduling-ux"
  - "admin-optimization"
created: "2026-05-18T00:00:00Z"
---

# Issue: Job Scheduling — No Drag-Assign; 5+ Clicks per Assignment

## Description

Assigning a crew member to a job requires: (1) opening the jobs list, (2) finding the job row,
(3) clicking edit/assign, (4) opening a crew picker, (5) selecting crew, (6) confirming. There
is no drag-to-assign or inline crew selector visible directly from the run-sheet view.

Friction score: **16/20 (critical)** — 5 clicks, 1 context switch, 2 manual steps (cross-reference
crew availability separately), error-prone 1 (wrong crew selected due to no availability preview).

The current view does not show crew availability alongside the job list, requiring the admin to
mentally cross-reference two separate views. On days with 8+ jobs this is the single highest-cost
admin workflow.

## Steps to Reproduce

1. Open `/dashboard` → navigate to schedule/jobs view
2. Attempt to assign an unassigned job to a crew member
3. Count clicks and note whether crew availability is visible without navigating away
4. Observe whether the layout supports landscape scanning (time on X-axis)

## Impact

Priority P0 — highest-friction recurring daily workflow. Affects run-sheet quality (wrong
assignments due to mental load) and admin time (est. 20–40 min/day on busy days).

## Related

- [[/dashboard]]
- [[Job Scheduling]]
- [[scheduling]]
- [[crew-briefing]]
- [[Admin Optimization Agent Design Decision]]
