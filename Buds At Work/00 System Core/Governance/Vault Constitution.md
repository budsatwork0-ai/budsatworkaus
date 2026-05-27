---
status: active
owner: Jackson
source_of_truth: this file
risk_level: foundational
last_verified: 2026-05-27
supersedes: implicit conventions in CLAUDE.md (codebase) and 00 Start Here.md (architecture)
---

# Vault Constitution

The single, authoritative statement of what this vault is, what it must protect, and how it must change. All other governance docs flow from this one.

## What this vault is

The Buds at Work vault is **operational engineering memory** for a live production platform. It is not a notebook. It is a two-way memory system:

- **Humans write here** to record architecture, decisions, dev logs, processes, and operations.
- **Code writes here** — agent runtime in `src/lib/agents/agents/` and CLI scripts in `scripts/vault-*.ts` write notes, ADRs, findings, and issues into specific paths.

Treat every change to vault structure as a code change.

## What this vault must protect

1. **Production runtime paths.** `Agents/<X>-Agent/<sub>/` and `Dev/{ADR-*,Journal,ADR-Drafts,Conventions}/` are write targets in shipped code. Renaming any of them without a coordinated code refactor causes silent data loss.
2. **Claude's memory order.** `CLAUDE.md` (codebase) and `architecture/Claude Memory/*.md` are loaded by Claude on every session. Breaking these breaks the AI's working knowledge of the project.
3. **Architecture truth.** The `architecture/` folder is the canonical source of truth for systems, components, and refactor plans. It supersedes any conflicting note elsewhere.
4. **Pricing integrity.** Documented pricing rules, formulas, and helpers in the vault must match the code in `src/`. Drift between them is a business risk.

## How this vault must change

The constitution defines five rules that apply to every modification:

### Rule 1 — Surgical changes only

No broad rewrites. No mass renames. No "while we're in here" tangents. Every change has a single explicit purpose. This applies equally to human edits, AI edits, and tooling sweeps.

### Rule 2 — Read before writing

Before creating a new note, search for an existing home for the content. Before renaming a folder, search for code references. Before deleting a file, confirm zero upstream references via `grep -r` and `graphify query`.

### Rule 3 — Author over destination

Every authoritative note declares its author and source of truth in frontmatter. If two notes appear to contradict each other, the one with the most recent `last_verified` date and a clearer ownership chain wins. Notes without metadata are treated as drafts.

### Rule 4 — Generated content is disposable

AI-generated outputs (graphify exports, agent findings, automated reports) live under `08 Generated Intelligence/` or inside their owning agent's folder. They do not become canonical truth. If a generated note needs to become canonical, a human must promote it into `01 Architecture/` or `06 Operations/` and accept ownership.

### Rule 5 — Lifecycle is mandatory

Every note has one of four states: `active`, `draft`, `superseded`, `archived`. Notes that haven't been touched in 90 days and have no `active` frontmatter are candidates for review. The Archive Policy doc governs the move to `99 Archive/`.

## What this vault is not

- It is not a personal scratchpad — that belongs in a different tool.
- It is not a project tracker — Mission Control and the GitHub project board own that.
- It is not a public-facing knowledge base — anything customer-facing belongs in code (`/app/(public)/`) or in the marketing site.
- It is not a backup — `Buds At Work.zip` and git history exist for that.

## Authority and conflicts

When two rules appear to conflict:

1. The Vault Constitution wins.
2. Then the codebase `CLAUDE.md` (it is loaded first by every Claude session).
3. Then specific governance docs (Naming Rules, Metadata Rules, etc.).
4. Then individual notes' frontmatter.

When the vault disagrees with the code: **the code wins.** The vault documents the code; the code is the system. If the vault says one thing and `src/` says another, fix the vault.

## How to amend this constitution

The constitution changes only by explicit human decision, recorded as a ADR in `Dev/ADR-NNNN-<slug>.md`. AI agents and tooling may propose amendments but cannot ratify them.

## Related

- [[Naming Rules]]
- [[Metadata Rules]]
- [[Claude Memory Rules]]
- [[Generated Output Rules]]
- [[Archive Policy]]
- [[Refactor Doc Standards]]
- [[../../architecture/Refactor Plans/Vault Restructure Plan|Vault Restructure Plan]]
