---
status: draft
owner: Jackson
source_of_truth: this file
last_verified: 2026-05-27
risk_level: medium
depends_on: vault audit (2026-05-27)
used_by: human review only — do not execute batches without explicit approval
---

# Vault Restructure Plan — Buds OS Migration

A staged migration from the current vault layout to the "Buds OS" structure proposed in the 2026-05-27 audit. **Nothing in this plan executes automatically.** Each batch is independently reviewable and gated on explicit human approval, per the constitution's "surgical changes only" rule.

The audit was correct on diagnosis. It was incomplete on one critical dimension, which this plan corrects:

> **The audit treated the vault as a knowledge base. It is actually a two-way memory system.** Production code in `src/lib/agents/agents/` and CLI tools in `scripts/vault-*.ts` write into specific vault folders. Renaming those folders without coordinated code changes will silently break agent output destinations.

That changes the risk profile of the migration significantly, and dictates the order of the batches below.

---

## Part 1 — Inventory (verified 2026-05-27)

### Note counts by folder

| Folder | .md count | Health |
| --- | ---: | --- |
| Agents/ | 59 | Most are README placeholders for 5 unused agents |
| Dev/ | 33 | Active — daily logs, ADRs, project notes |
| architecture/ | 25 | Mature, well-organised, the strongest part of the vault |
| Admin/ | 13 | Misnamed — these are *team area* notes, not admin |
| Automation/ | 4 | Small but coherent |
| SOPs/ | 3 | Coherent |
| Processes/ | 3 | Overlaps semantically with SOPs |
| 00-Index/ | 1 | Just Home.md |
| analytics/ bugs/ customers/ deployments/ design/ pricing/ ux/ Untitled/ | 0 each | **Empty since April — pure entropy** |

### Confirmed cruft

Pure-deletion candidates with no upstream references:

- `Untitled/` (empty directory)
- `Untitled.md`, `Untitled.base`, `Untitled.canvas`
- `Untitled 1.base`, `Untitled 1.canvas`
- `Untitled 2.base`, `Untitled 2.canvas`
- `_COMMUNITY_Community 45.md` (zero bytes)
- `2026-05-27.md` (zero bytes; today's daily note was never written)

Root-level alias redirects (small but pollute root):

- `2026-05-25.md` → `[[Dev/Dev Log 2026-05-25]]` (1-line redirect)
- `Pricing Engine.md` → `[[architecture/Systems/Pricing Engine]]` (1-line redirect)

Empty Dev subdirs:

- `Dev/PRs/` (empty)
- `Dev/Releases/` (empty)
- `Dev/Journal/` (empty — but `github-historian.ts` writes here, so **DO NOT DELETE**)
- `Dev/Deployments/` (only README — but referenced from agent wikilinks)
- `Dev/ADR-Drafts/` (only README — but `github-historian.ts` writes here)

### Critical finding: empty agent subdirs are *destination contracts*, not entropy

The audit flagged the 6-subfolder-per-agent structure (Active-Issues / Decisions / Findings / Reports / Resolved-Issues / Tasks across 7 agents = 42 mostly-empty directories) as "structural noise." That is half right.

The structure is noisy **for human reading**, but those folders are **write targets in production code**:

- `src/lib/agents/agents/admin-optimization.ts` writes to `Agents/Admin-Agent/{Findings,Tasks,Active-Issues}/`
- `src/lib/agents/agents/analytics-intelligence.ts` writes to `Agents/Analytics-Agent/{Reports,Findings,Tasks}/`
- `src/lib/agents/agents/ux-intelligence.ts` writes to `Agents/UX-Agent/{Findings,Tasks,Active-Issues}/`
- `src/lib/agents/agents/design-system.ts` writes to `Agents/Design-System-Agent/{Findings,Tasks,Reports,Decisions}/`
- `src/lib/agents/agents/github-historian.ts` writes to `Agents/Meta-Agent/{Findings,Tasks,Active-Issues}/` and `Dev/Journal/`, `Dev/ADR-Drafts/`

The 5 mostly-empty agents are empty *because they haven't run yet or haven't surfaced issues*, not because the folders are dead. Deleting them = silent data loss the next time the agent fires.

---

## Part 2 — Dependency map (what each path is wired to)

This is the table that determines what can move and what cannot.

| Vault path | Read/written by | Risk if renamed |
| --- | --- | --- |
| `Buds At Work/` (vault root) | `scripts/vault-adr.ts`, `scripts/vault-context.ts`, `scripts/vault-log.ts`, `scripts/vault-convention.ts` (all default to `path.join(cwd, 'Buds At Work')`); `OBSIDIAN_VAULT_PATH` env var in `/api/memory/agents/*` and `/api/bud/obsidian` | **HIGH** — root rename breaks all CLI vault tools and several API routes |
| `Dev/Dev Log YYYY-MM-DD.md` | `scripts/vault-log.ts` writes here; `.claude/agents/bud-memory.md` reads here | HIGH |
| `Dev/ADR-*.md` and `Dev/ADR-Index.md` | `scripts/vault-adr.ts` writes; `github-historian.ts` references via wikilink | HIGH |
| `Dev/Conventions/{slug}.md` | `scripts/vault-convention.ts` writes (folder doesn't exist yet but is created on first write) | MEDIUM |
| `Dev/Journal/` | `github-historian.ts` writes weekly timelines | HIGH |
| `Dev/ADR-Drafts/` | `github-historian.ts` writes ADR drafts | HIGH |
| `Dev/Deployments` | wikilink target from `analytics-intelligence.ts` and `github-historian.ts` | MEDIUM (wikilinks tolerate dangling, but break navigation) |
| `Dev/Bug Tracker` | wikilink target from `github-historian.ts` | MEDIUM |
| `Agents/<X>-Agent/<sub>/` | 5 agent files write here (admin-optimization, analytics-intelligence, ux-intelligence, design-system, github-historian) | **HIGH** — paths are string literals, not configurable |
| `architecture/` (lowercase) | `.claude/agents/bud-memory.md` references `Buds At Work/Architecture/` (uppercase — latent case-sensitivity bug) | LOW (already broken on case-sensitive FS) |
| `architecture/Claude Memory/` | Read by humans + Claude via CLAUDE.md memory sources order | LOW |
| `architecture/Graphify/` | Generated by graphify CLI | LOW |
| `architecture/Systems/`, `Components/`, `Refactor Plans/` | Pure human-authored | LOW |
| `Admin/`, `SOPs/`, `Processes/` | No code references found | LOW |
| `Automation/` | No code references found | LOW |
| `00-Index/Home.md` | Linked from `Untitled.md` redirect | LOW |
| lowercase orphans (`analytics`, `bugs`, etc.) | No references | NONE |
| `Untitled*` files | No references | NONE |

### Latent bug worth fixing during this work

`.claude/agents/bud-memory.md` line 42 references `Buds At Work/Architecture/` (capital A) while the actual folder is `architecture/` (lowercase). On a case-sensitive filesystem this fails silently. **Fix in Batch 1.**

---

## Part 3 — Proposed target structure

This implements the audit's recommended Buds OS root, adapted to the dependency realities above.

```
Buds At Work/
├── 00 System Core/
│   ├── Home.md                          ← from 00-Index/Home.md
│   ├── Buds OS Dashboard.md             ← NEW — single operational dashboard
│   └── Governance/
│       ├── Vault Constitution.md         ← NEW
│       ├── Naming Rules.md               ← NEW
│       ├── Metadata Rules.md             ← NEW
│       ├── Claude Memory Rules.md        ← NEW
│       ├── Generated Output Rules.md     ← NEW
│       ├── Archive Policy.md             ← NEW
│       └── Refactor Doc Standards.md     ← NEW
│
├── 01 Architecture/                     ← from architecture/ (rename, fix capitalisation)
│   ├── 00 Start Here.md
│   ├── Systems/
│   ├── Components/
│   └── Graphify/                         ← consider moving to 08, see notes
│
├── 02 Runtime Systems/
│   └── Agents/                          ← Agents/ stays structurally identical
│       ├── Admin-Agent/{Findings,Tasks,Active-Issues,Decisions,Reports,Resolved-Issues}/
│       ├── Analytics-Agent/...
│       └── ...                          ← DO NOT FLATTEN — code writes here
│
├── 03 Active Refactors/                 ← from architecture/Refactor Plans/
│
├── 04 Claude Memory/                    ← from architecture/Claude Memory/
│   ├── Anti-Patterns.md
│   └── Convention Rules.md
│
├── 05 Automation/                       ← from Automation/
│
├── 06 Operations/                       ← consolidates Admin/ + SOPs/ + Processes/
│   ├── Team Areas/                       ← from Admin/ (Engineering.md, Finance.md, etc.)
│   ├── SOPs/                             ← from SOPs/
│   └── Processes/                        ← from Processes/
│
├── 07 Business/                         ← empty stub for future customer/lead notes
│
├── 08 Generated Intelligence/           ← graphify exports, agent reports digest
│
└── 99 Archive/                          ← Dev Logs older than 30 days, superseded plans
```

### Two deliberate divergences from the audit

1. **Agents stays where it is structurally.** The audit suggested collapsing per-agent subfolder trees. The dependency map shows this is **HIGH-RISK** — requires synchronised refactor of 5 agent files plus their tests. Recommend deferring to a separate refactor (see Batch 5).

2. **Dev/ is not renamed.** The audit didn't surface this, but `Dev/` is the single most code-coupled folder in the vault. Renaming requires touching `scripts/vault-adr.ts`, `scripts/vault-log.ts`, `scripts/vault-convention.ts`, `.claude/agents/bud-memory.md`, and `github-historian.ts`. Recommend keeping `Dev/` and addressing operational separation through `06 Operations/` instead.

---

## Part 4 — Staged migration

Each batch is independently approvable, independently revertible, and produces a verifiable outcome. **Do not execute a later batch until the prior batch is approved.**

### Batch 0 — Pure cleanup (no code changes)

**Risk:** NONE. Nothing in code references these.

Actions:

- Delete 7 lowercase empty root folders: `analytics/`, `bugs/`, `customers/`, `deployments/`, `design/`, `pricing/`, `ux/`
- Delete `Untitled/` directory
- Delete `Untitled.md`, `Untitled.canvas`, `Untitled.base`, `Untitled 1.base`, `Untitled 1.canvas`, `Untitled 2.base`, `Untitled 2.canvas`
- Delete `_COMMUNITY_Community 45.md` (zero bytes)
- Delete `2026-05-27.md` (zero bytes)
- Delete `Dev/PRs/` (empty), `Dev/Releases/` (empty)
- **Keep** `Dev/Journal/`, `Dev/Deployments/`, `Dev/ADR-Drafts/` even though sparse — write targets

Verification:

- `find . -type d -empty` returns no orphan dirs
- `git status` shows only deletions
- `npx tsc --noEmit && eslint src/` passes
- `graphify update .` runs clean

**Deliverable:** clean root.

---

### Batch 1 — Governance docs + bud-memory.md case fix (no folder moves)

**Risk:** LOW.

Actions:

- Create `00 System Core/` folder
- Move `00-Index/Home.md` → `00 System Core/Home.md`
- Delete empty `00-Index/`
- Create `00 System Core/Governance/` and author the 7 governance docs:
  - Vault Constitution.md — distillation of CLAUDE.md + audit principles
  - Naming Rules.md — folder prefix scheme, kebab-case for files, etc.
  - Metadata Rules.md — required YAML frontmatter for architecture, operations, refactor plans
  - Claude Memory Rules.md — what Claude reads, in what order, what counts as memory
  - Generated Output Rules.md — where AI outputs land, how they expire
  - Archive Policy.md — when notes move to `99 Archive/`, who decides
  - Refactor Doc Standards.md — formalises the existing pattern in architecture/Refactor Plans/
- Update `.claude/agents/bud-memory.md` line 42: `Buds At Work/Architecture/` → `Buds At Work/01 Architecture/` (or `architecture/` if not yet renamed)
- Update `Untitled.md` redirect target — but it's being deleted in Batch 0, so skip

Verification:

- All 7 docs present and have required frontmatter
- bud-memory.md change committed
- `graphify update .` runs clean

**Deliverable:** governance scaffolding in place. Future notes have authoritative rules to follow.

---

### Batch 2 — Buds OS Dashboard

**Risk:** LOW.

Actions:

- Create `00 System Core/Buds OS Dashboard.md` linking:
  - Active refactors (auto-list from `03 Active Refactors/`)
  - Architecture entry points (link to `01 Architecture/00 Start Here.md`)
  - Graphify hotspots (link to current `GRAPH_REPORT.md`)
  - Runtime systems status (links into `02 Runtime Systems/Agents/*/README.md`)
  - Current refactor batch in flight (manually updated)
  - Tech debt priorities (link to refactor plan)
- Update `00 System Core/Home.md` to point to the Dashboard as the primary entry

Verification:

- Dashboard renders correctly in Obsidian
- All wikilinks resolve
- Linked from Home.md

**Deliverable:** one canonical operational view.

---

### Batch 3 — Archive policy + Dev Log archival

**Risk:** LOW (file moves only, no code refs to Dev Logs older than 30 days).

Actions:

- Create `99 Archive/` and `99 Archive/Dev Logs/`
- Move Dev Logs older than 30 days from today (2026-05-27) into `99 Archive/Dev Logs/`
  - As of today: Dev Logs from before 2026-04-27 would move (none currently — earliest is 2026-05-18)
  - So this batch creates the structure but currently moves zero files
- Archive `STRIPE_LAUNCH_READINESS.md` from repo root if no longer relevant (Apr 30 file — check first)

Verification:

- Archive folder created with README explaining policy
- Any moved files still searchable in Obsidian

**Deliverable:** lifecycle management exists.

---

### Batch 4 — Architecture rename + adjacent moves

**Risk:** MEDIUM. Touches Claude memory references.

Actions:

- `architecture/` → `01 Architecture/`
  - Update `.claude/agents/bud-memory.md` accordingly
  - Update `CLAUDE.md` reference (`Buds At Work/Architecture/` → `Buds At Work/01 Architecture/`)
  - Update `00 Start Here.md` self-references if any
- `architecture/Refactor Plans/` → `03 Active Refactors/`
  - This file moves with it; update its `source_of_truth` frontmatter
- `architecture/Claude Memory/` → `04 Claude Memory/`
  - Update CLAUDE.md memory-sources order if it references this path
- `Automation/` → `05 Automation/`
- Consolidate `Admin/` + `SOPs/` + `Processes/` → `06 Operations/{Team Areas,SOPs,Processes}/`
- Decide whether `architecture/Graphify/` stays under `01 Architecture/` or moves to `08 Generated Intelligence/` (recommend leaving it — `00 Start Here.md` treats it as architecture)

Verification:

- `grep -rn "architecture/" .claude/ scripts/ src/` returns zero hits except in comments referencing old paths (acceptable)
- `grep -rn "Admin/" .claude/ scripts/ src/` returns zero hits
- `npx tsc --noEmit && eslint src/ && next build` passes
- `graphify update .` runs clean
- All wikilinks in vault still resolve (Obsidian's broken-link panel = empty)

**Deliverable:** prefix-numbered Buds OS structure live.

---

### Batch 5 — Agents folder migration (GATED on code refactor)

**Risk:** HIGH. Do not execute until pre-work is done.

**Pre-work required first (separate refactor, not part of this plan):**

1. Introduce a `VAULT_AGENT_OUTPUT_ROOT` config in `src/lib/agents/` that all 5 agent files read from instead of string-literal paths
2. Move all per-agent output path construction into a shared helper
3. Add an integration test that asserts each agent writes to the configured root
4. Land that refactor, ship it, verify in production

**Only then:**

- `Agents/` → `02 Runtime Systems/Agents/`
- Set `VAULT_AGENT_OUTPUT_ROOT=02 Runtime Systems/Agents` (or via env in Vercel)
- Run smoke test: trigger each of the 5 agents in a sandbox workspace, verify outputs land in the new path

Verification:

- Production agents have written at least one note to the new path
- Old `Agents/` path returns 404 to any code attempting to write there (i.e. no straggling references)

**Recommendation:** until the pre-work refactor lands, leave `Agents/` at root. The structural noise is real but the production risk of moving without refactoring is unacceptable.

---

## Part 5 — Execution checklist (per batch)

Before executing any batch:

- [ ] Jackson has reviewed and approved this batch specifically
- [ ] Current state committed to git on a fresh branch (`vault/restructure-batch-N`)
- [ ] `Buds At Work.zip` backup is current (it's from today, so re-zip first)
- [ ] No agents are mid-run (check Mission Control)

Executing:

- [ ] Apply changes in the order listed for the batch
- [ ] Run verification commands listed for the batch
- [ ] Open Obsidian and confirm vault loads with zero broken-link warnings
- [ ] Run `npx tsc --noEmit && eslint src/` for batches 1, 4, 5
- [ ] Run `next build` for batch 4 and 5
- [ ] Run `graphify update .`

After the batch:

- [ ] Commit with message `vault: restructure batch N — <summary>`
- [ ] Update this plan's `last_verified` date and add a "Batch N complete" note
- [ ] If anything failed, revert the branch — do not patch forward

---

## Part 6 — What this plan deliberately does not do

- **No content rewrites.** Existing notes are moved, not edited (except bud-memory.md path fix).
- **No deletion of agent output destinations.** Even when empty.
- **No flattening of the per-agent subfolder structure.** Gated on Batch 5 pre-work.
- **No Dev/ rename.** Too code-coupled. Operational separation comes through `06 Operations/` instead.
- **No metadata backfill across existing notes.** Metadata Rules.md sets the standard for *new* notes; backfilling is a separate workstream.
- **No automatic generated-content cleanup.** Generated Output Rules.md defines the policy; sweeping `graphify-out/` per the policy is a separate workstream.

---

## Part 7 — Open questions for Jackson

Before approving Batch 0:

1. Is `STRIPE_LAUNCH_READINESS.md` at repo root still needed, or can it move to `99 Archive/`?
2. The `agents-lobby-medieval.html`, `agents-lobby-preview.html`, `agents-preview.html`, `mission-control-autonomy-flow.html`, and `buds-at-work-app.jsx` files at repo root — are they preview prototypes or active? They look like development scratch.
3. Confirm comfort level with deleting all `Untitled.*` artifacts permanently rather than archiving.

Before approving Batch 4:

4. Is the `01 02 03` prefix scheme acceptable for Obsidian sorting, or would you prefer alphabetical (`Architecture/`, `Automation/`, `Claude Memory/`)? Numeric prefixes guarantee order; alphabetical reads cleaner.
5. Should `architecture/Graphify/` live under `01 Architecture/` (current) or `08 Generated Intelligence/` (audit suggestion)?

Before approving Batch 5:

6. Confirm the pre-work refactor (introducing `VAULT_AGENT_OUTPUT_ROOT`) is something you want done before touching `Agents/`. The alternative is to leave `Agents/` at root indefinitely and accept the structural noise.

---

## Appendix — Audit cross-reference

| Audit priority | Addressed in |
| --- | --- |
| Priority 1: Root cleanup | Batch 0 |
| Priority 2: Metadata governance | Batch 1 (Metadata Rules.md authored — backfill deferred) |
| Priority 3: Human/machine memory separation | Batch 1 (Claude Memory Rules.md), Batch 4 (move of `04 Claude Memory/`) |
| Priority 4: Governance docs | Batch 1 |
| Priority 5: Runtime dashboard | Batch 2 |
| Folder governance overall | Batch 4 |
| Agents noise | Batch 5 (gated) |
| Operational separation | Batch 4 (`06 Operations/`) |
| Lifecycle management | Batch 3 |
