---
status: active
owner: Jackson
source_of_truth: this file
risk_level: medium
last_verified: 2026-05-27
depends_on: Vault Constitution, Metadata Rules, Generated Output Rules
---

# Archive Policy

What moves to `99 Archive/`, when, and how. The archive exists so that the live vault represents *current operational truth* — and only that.

## What gets archived

A note moves to the archive when **any** of these is true:

- Its topic is no longer relevant (project shipped, system deprecated, decision obsolete)
- It has been `superseded` by a newer note (link both via `supersedes` / `superseded_by`)
- It is a dated generated output past its half-life (see Generated Output Rules)
- It is a dev log older than 90 days
- A human has marked it `status: archived` in frontmatter

## What never gets archived

- Anything in `00 System Core/Governance/` — these are evergreen rules
- Anything in `01 Architecture/Systems/` that documents a still-shipped system
- ADRs in `Dev/ADR-*.md` — they are historical truth and stay where they are
- Anti-Patterns and Convention Rules in `00 System Core/Claude Memory/` — Claude reads these every session
- Refactor plans in `03 Active Refactors/` while their target is in flight (move to `Refactor Plans/Completed/` when shipped, not to archive)

## Archive structure

```
99 Archive/
├── Dev Logs/                      # Dev Logs older than 90 days
├── Refactor Plans/                # completed plans whose refactors have shipped
├── Architecture/                  # systems and components that no longer ship
├── Operations/                    # superseded SOPs and processes
├── Generated/                     # expired agent outputs (by year)
│   ├── 2026/
│   └── 2025/
└── README.md                      # what this archive contains, last review date
```

The archive mirrors the active vault's top-level shape so a note's original location is obvious from its archive position.

## How to archive a note (manual)

1. Update the note's frontmatter: set `status: archived`, set `last_verified` to the archive date, add an `archived_reason:` line explaining why
2. If the note is being replaced, set `superseded_by:` to the replacement note's filename
3. Move the file to the matching subfolder under `99 Archive/`
4. Run `graphify update .` so the graph reflects the move
5. Open Obsidian and confirm the broken-link panel shows zero new warnings

## How to archive (automated, future)

A scheduled job (not yet implemented — see future work below) can:

- Move dev logs older than 90 days into `99 Archive/Dev Logs/` automatically
- Move generated agent outputs past their half-life into `99 Archive/Generated/<year>/`
- Refuse to archive anything in the "never archive" list above

Until that job exists, archiving is a human action. A quarterly review by Jackson is the manual fallback.

## Restoring a note

If an archived note is found to be still relevant:

1. Read the `archived_reason` and decide whether the reason still applies
2. If not, move the file back to its original folder
3. Update `status` back to `active`, refresh `last_verified`
4. Remove the `archived_reason` field (or move it to a comment)
5. If a `superseded_by` was set incorrectly, remove it; otherwise leave the chain visible

## Anti-patterns

- ❌ Deleting notes instead of archiving them — history is cheap; deletion is final
- ❌ Archiving notes by moving them but not updating `status` in frontmatter — `99 Archive/` then becomes inconsistent with metadata
- ❌ Leaving an `active`-status note in `99 Archive/` — fix one or the other immediately
- ❌ Letting `99 Archive/Dev Logs/` swell to thousands of files without yearly subfolders

## Future work

- Implement the scheduled archive job (Vercel Cron) — file lives in `Dev/ADR-Drafts/` for now as a draft proposal
- Add `last_verified` checking to the graphify update pass — surface notes that haven't been verified in >120 days

## Related

- [[Vault Constitution]]
- [[Metadata Rules]]
- [[Generated Output Rules]]
