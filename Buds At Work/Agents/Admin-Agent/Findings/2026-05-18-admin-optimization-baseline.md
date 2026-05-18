---
type: "finding"
workspace: "admin-agent"
severity: "info"
systems:
  - "admin-optimization"
  - "/dashboard"
tags:
  - "finding"
  - "admin-agent"
  - "baseline"
  - "admin-optimization"
run_id: "baseline-seed"
created: "2026-05-18T00:00:00Z"
related: []
---

# Finding: Admin Optimization Agent — Baseline Seed

## Summary

Baseline seed written at agent deployment. The `admin-optimization` agent has been added to the
Admin workspace. Subsequent runs will semantic-search this and the Active-Issues notes to establish
recurrence detection for friction patterns.

## Friction Scoring Reference

| Score | Band | Meaning |
|-------|------|---------|
| 0–4   | low | No material friction |
| 5–9   | medium | Annoying but workable |
| 10–15 | high | Significant daily cost |
| 16–20 | critical | Blocks or degrades daily operations |

Formula: `clicks × 2 + context_switches × 3 + manual_steps × 2 + error_prone × 3`

## Focus Areas Covered

| Area | Pages | Design Goal |
|------|-------|------------|
| Scheduling UX | `/dashboard/schedule` | Landscape run-sheet, drag-assign, one-click crew swap |
| Quote Management | `/dashboard/quotes` | Single-pane pipeline, inline edit, status colour-coding |
| Crew Onboarding | `/dashboard/crew` | Checklist progress tracker, document status at a glance |
| Repetitive Tasks | `/dashboard/automations` | Every task > 3×/week gets a one-click recipe |
| Operational Dashboard | `/dashboard` | ≤ 3 clicks from landing to any action |

## Design Philosophy

Every redesign proposal must satisfy:
1. **Landscape-first** — time/status on X-axis, entities on Y-axis at ≥1280px
2. **Operational clarity** — one glance = full context, no expand-to-read
3. **Low visual noise** — data density over decoration; glass-morphism used sparingly
4. **Rapid scanning** — colour-coded status badges, bold deltas, compact rows
5. **Minimal clicks** — ≤3 clicks from dashboard to completing any action

## Systems

- [[/dashboard]]
- [[/dashboard/quotes]]
- [[/dashboard/crew]]
- [[Job Scheduling]]
- [[Quote Pipeline]]
