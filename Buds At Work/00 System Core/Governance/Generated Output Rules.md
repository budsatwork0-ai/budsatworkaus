---
status: active
owner: Jackson
source_of_truth: this file
risk_level: high
last_verified: 2026-05-27
depends_on: Vault Constitution, Claude Memory Rules
used_by: src/lib/agents/agents/* (write side), Claude (read side)
---

# Generated Output Rules

Rules for content produced by AI agents and automated tooling. Generated outputs are evidence, not truth. They inform decisions; they do not make them.

## Where generated content lives

| Generator | Destination | Frequency |
| --- | --- | --- |
| `github-historian` (agent) | `Agents/Meta-Agent/{Findings,Tasks,Active-Issues}/` and `Dev/Journal/`, `Dev/ADR-Drafts/` | per-event + weekly |
| `admin-optimization` (agent) | `Agents/Admin-Agent/{Findings,Tasks,Active-Issues}/` | scheduled |
| `analytics-intelligence` (agent) | `Agents/Analytics-Agent/{Reports,Findings,Tasks}/` | scheduled |
| `ux-intelligence` (agent) | `Agents/UX-Agent/{Findings,Tasks,Active-Issues}/` | scheduled |
| `design-system` (agent) | `Agents/Design-System-Agent/{Findings,Tasks,Reports,Decisions}/` | scheduled |
| `scripts/vault-log.ts` | `Dev/Dev Log YYYY-MM-DD.md` | per-session |
| `scripts/vault-adr.ts` | `Dev/ADR-NNNN-<slug>.md` and `Dev/ADR-Index.md` | manual |
| `scripts/vault-convention.ts` | `Dev/Conventions/<slug>.md` and `CLAUDE.md` (repo root) | when a convention is captured |
| Graphify CLI | `graphify-out/` (repo root, outside vault) | per `graphify update .` |

These paths are **destination contracts**. Renaming any of them requires a coordinated code change. See the Vault Restructure Plan for the migration strategy.

## What generated content can claim

Generated content can:

- Describe what an agent observed (heatmap data, click counts, screenshot diffs)
- Propose an action (refactor X, redesign Y, file ticket Z)
- Surface a pattern (this error appeared 12 times this week)
- Summarise prior activity (weekly timeline, daily dev log)

Generated content cannot:

- Override an architecture note in `01 Architecture/`
- Modify a system's source of truth — only the underlying code can do that
- Set `status: active` on a note in any governance, architecture, or operations folder
- Claim authority over pricing, billing, or customer communication

## Freshness expectations

Generated outputs have a half-life. After it expires, the note becomes stale evidence — interesting historically, not useful operationally.

| Output type | Half-life | Action when expired |
| --- | --- | --- |
| Agent finding | 30 days | Move to `99 Archive/` if not promoted to action |
| Weekly timeline | 90 days | Keep in `Dev/Journal/` — historical record |
| Daily dev log | 365 days | Archive per Archive Policy |
| Graphify export | until next `graphify update .` | Overwritten in place |
| Heatmap report | 14 days | Archive |

A generated note past its half-life with no human follow-up should be archived, not deleted. The agent may regenerate a fresher version.

## Promotion path

A generated finding may become canonical truth, but only via human promotion:

1. A human reads the finding in `Agents/<X>-Agent/Findings/`
2. The human extracts the insight into a new or updated note in `01 Architecture/` or `06 Operations/`
3. The new note takes the human as `owner` and lists the finding as `source_of_truth` (or a code path the finding revealed)
4. The original finding moves to `99 Archive/` with `superseded_by:` pointing at the new canonical note

This is the only way AI evidence becomes durable truth.

## What Claude must do when generating content

- Write to the destination listed in the table above — never invent a new path
- Include the agent name in the file's frontmatter `owner` field
- Date-stamp the filename (`YYYY-MM-DD` suffix) for any non-overwriting output
- Set `status: active` only for outputs intended to drive action; everything else is `draft`
- Never set `source_of_truth: this file` on generated content — it points to the observation source (a metric, a screenshot, an event log)

## What humans should never do to generated folders

- Hand-edit notes in `Agents/<X>-Agent/<sub>/` — they will be overwritten
- Delete an empty agent subfolder — it's a destination contract
- Move agent output files into architecture or operations folders without going through the promotion path above

## Anti-patterns

- ❌ A generated note with `status: active` and `owner: Jackson` (claims human authorship for AI output)
- ❌ A generated note whose `source_of_truth` points to another generated note (chains of evidence with no human grounding)
- ❌ Promoting a generated note by renaming and moving the file (loses the audit trail; use the promotion path instead)

## Related

- [[Vault Constitution]]
- [[Claude Memory Rules]]
- [[Archive Policy]]
