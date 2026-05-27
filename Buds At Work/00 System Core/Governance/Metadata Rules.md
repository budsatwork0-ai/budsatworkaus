---
status: active
owner: Jackson
source_of_truth: this file
risk_level: medium
last_verified: 2026-05-27
applies_to: all new authoritative notes
---

# Metadata Rules

Every authoritative note in the vault must carry YAML frontmatter so Claude, Graphify, and humans can reason about its status, ownership, and freshness. Notes without metadata are treated as drafts.

## Required fields

```yaml
---
status:           # active | draft | superseded | archived
owner:            # who maintains this — usually "Jackson" or an agent name
source_of_truth:  # where this note's claims come from
last_verified:    # ISO date when this was last checked against reality
---
```

These four fields are the minimum. A note missing any of them is not authoritative and can be safely ignored by Claude when answering questions.

## Optional fields

Add these when relevant:

```yaml
risk_level:       # low | medium | high | foundational
                  # how much damage a wrong claim here would cause
depends_on:       # list of notes or systems this one assumes are true
used_by:          # list of notes, agents, or code paths that read this
supersedes:       # what this replaces (filename or short description)
superseded_by:    # set when a newer note takes over
tags:             # Obsidian tags — useful for filtering, not for hierarchy
aliases:          # alt names for the quick-switcher
```

## Field semantics

### status

- **active** — current truth; Claude should treat it as authoritative
- **draft** — being written; not yet authoritative
- **superseded** — a newer note exists that replaces this one (set `superseded_by`)
- **archived** — kept for history; not authoritative and not actively maintained

A note moves from `active` → `superseded` when a newer note takes over. It moves from `active` → `archived` when the topic itself is no longer relevant.

### owner

The human or agent responsible for keeping this note honest. If the named owner is gone or the agent is decommissioned, the note's status drops to `draft` until reassigned. Agent-authored notes use the agent's name (e.g. `owner: github-historian`).

### source_of_truth

What this note documents. Options:

- `this file` — the note itself is the canonical statement (e.g. governance docs, ADRs)
- A code path — e.g. `src/app/(public)/services/lib/pricing/engine.ts`
- Another note — for derivative notes that synthesise upstream truth
- A live system — e.g. `Stripe dashboard`, `Supabase auth.users table`

The point of this field is to make it obvious where to look when reality and the note disagree.

### last_verified

The most recent date a human (or agent) confirmed the claims in the note still match reality. **This is not the date the file was last edited.** A note edited yesterday to fix a typo doesn't get its `last_verified` bumped. A note read this morning and confirmed against the source does.

## Where metadata is required

- All notes in `00 System Core/Governance/`
- All notes in `01 Architecture/Systems/` and `01 Architecture/Components/`
- All notes in `03 Active Refactors/`
- All ADRs in `Dev/`
- Conventions captured by `scripts/vault-convention.ts`

## Where metadata is optional

- Dev Logs (`Dev/Dev Log YYYY-MM-DD.md`) — they are dated by nature
- Operations notes in `06 Operations/SOPs/` and `06 Operations/Processes/` — strongly recommended but not blocking
- Generated outputs in `08 Generated Intelligence/` — the file's date suffix carries enough freshness signal

## Backfill is not part of this rule

Existing notes that predate this policy are not retroactively required to add metadata. Add it when next editing the note, not as a separate sweep. Metadata backfill across the existing vault is a deferred workstream — see the Vault Restructure Plan.

## Anti-patterns

- ❌ Empty frontmatter blocks (`---\n---`) — write the fields or don't write the block
- ❌ Stale `last_verified` dates that don't reflect actual verification
- ❌ `status: active` on a note whose `source_of_truth` no longer exists
- ❌ Listing the file's own path in `source_of_truth` for derivative notes (use the real upstream)

## Related

- [[Vault Constitution]]
- [[Naming Rules]]
- [[Claude Memory Rules]]
