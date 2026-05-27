---
status: active
owner: Jackson
source_of_truth: this file (lifecycle rules) + Governance/Archive Policy.md
risk_level: low
last_verified: 2026-05-27
last_review: 2026-05-27
next_review_due: 2026-08-27
---

# 99 Archive

Notes that are no longer current operational truth, kept for history.

## What lives here

| Subfolder | Contents |
| --- | --- |
| `Dev Logs/` | Dev Logs older than 90 days |
| `Refactor Plans/` | Refactor plans whose target shipped |
| `Architecture/` | Systems and components that no longer ship |
| `Operations/` | Superseded SOPs and processes |
| `Generated/<year>/` | Expired AI agent outputs |

The structure mirrors the active vault's top-level shape — a note's archive position should match its original position.

## Current state

The archive is currently empty. No Dev Logs are old enough to archive (earliest is 2026-05-18, less than 90 days). The structure is created so future archive moves have a clear destination.

## Rules

Full lifecycle rules: [[../00 System Core/Governance/Archive Policy|Archive Policy]].

Short version:

- A note moves here when its topic is no longer relevant, it has been superseded, or it is a dated generated output past its half-life
- Move via human action — set `status: archived` in the note's frontmatter, then move the file
- Never delete; always archive
- The Constitution, the active Architecture systems, the Claude Memory anti-patterns, and ADRs never move here

## Review cadence

This README's `next_review_due` field is set to 90 days out. A quarterly review by Jackson sweeps:

- Dev Logs that have aged past 90 days into `Dev Logs/`
- Generated outputs past their half-life into `Generated/<year>/`
- Any notes with `status: archived` in their frontmatter that haven't yet moved

When the scheduled archive job lands (see Archive Policy's "Future work"), this manual review becomes a fallback rather than the primary path.
