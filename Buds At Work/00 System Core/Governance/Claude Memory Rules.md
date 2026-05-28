---
status: active
owner: Jackson
source_of_truth: this file + codebase CLAUDE.md
risk_level: high
last_verified: 2026-05-27
depends_on: CLAUDE.md (repo root), .claude/agents/*.md
used_by: every Claude session that touches this repo
---

# Claude Memory Rules

Rules that govern what Claude reads, in what order, and what counts as memory versus context. Breaking these rules causes Claude to act on stale or contradictory information.

## The memory tiers

Claude has access to four tiers of memory in this repo. They are loaded in priority order, and higher tiers override lower tiers when they conflict.

### Tier 1 — Always loaded (codebase CLAUDE.md files)

These files are injected at the start of every Claude session. They are short, blunt, and override everything else.

- `CLAUDE.md` (repo root) — the codebase constitution; pricing protection, design system anti-patterns, refactor strategy
- `.claude/CLAUDE.md` — graphify trigger, user email, current date
- `.claude/agents/*.md` — agent personas Claude loads when invoked (bud-memory, bud-architect, bud-factory, bud-taste, bud-researcher, bud-qa, bud-pricing-guard)

**Rule:** Anything that must be true for every Claude action belongs here. Keep these files short. Pricing rules, anti-patterns, hard-coded paths.

### Tier 2 — Architecture memory

Loaded on demand when Claude needs structural context.

- `01 Architecture/00 Start Here.md` — entry point for all architecture questions
- `01 Architecture/Systems/*` — system-level truth (Pricing Engine, Quote Pipeline, Bud Core Runtime, etc.)
- `01 Architecture/Components/*` — component-level truth (Brand, WizardState, ServicesPageContent, etc.)
- `00 System Core/Claude Memory/*.md` — conventions and anti-patterns Claude has captured via `scripts/vault-convention.ts`

**Rule:** These notes must carry the Metadata Rules' `source_of_truth` field so Claude can verify them against reality.

### Tier 3 — Operational memory

Loaded when Claude is acting in operations mode rather than coding mode.

- `06 Operations/Team Areas/*` — per-team responsibility maps
- `06 Operations/SOPs/*` — standard operating procedures
- `06 Operations/Processes/*` — end-to-end process documentation
- `05 Automation/*` — automation roadmap and live recipes

**Rule:** Operational notes are read-only for AI. AI never modifies an SOP or process doc without human approval.

### Tier 4 — Generated memory

Treated as evidence, not truth.

- `08 Generated Intelligence/*` — graphify exports, agent reports, automated summaries
- `Agents/<X>-Agent/{Findings,Reports,Tasks,Active-Issues,Decisions}/` — agent output
- `Dev/Journal/*` — automated weekly timelines from github-historian
- `graphify-out/*` (outside vault) — raw graphify CLI output

**Rule:** Tier 4 content informs decisions but cannot make decisions. If a generated note appears to contradict a Tier 1–2 statement, the Tier 1–2 statement wins. Promoting Tier 4 content to authoritative status requires a human edit into Tier 2.

## What Claude is allowed to write

- Code in `src/`, `scripts/`, `tests/` — subject to the codebase constitution in `CLAUDE.md`
- Notes in `Dev/Dev Log YYYY-MM-DD.md` via `scripts/vault-log.ts`
- ADRs in `Dev/ADR-NNNN-<slug>.md` via `scripts/vault-adr.ts`
- Conventions in `Dev/Conventions/<slug>.md` via `scripts/vault-convention.ts`
- Agent findings, reports, tasks, issues in `Agents/<X>-Agent/<sub>/` via shipped agent code
- Refactor plans in `03 Active Refactors/` when explicitly asked

## What Claude is not allowed to write without explicit approval

- `00 System Core/Governance/*` — these are the constitution; only humans amend them
- `01 Architecture/Systems/*` and `Components/*` — system truth requires human ownership
- `00 System Core/Claude Memory/Anti-Patterns.md` and `Convention Rules.md` — captured via tooling, never freely edited
- Any file with `status: active` and an owner other than Claude
- `.env*`, `vercel.json`, Stripe config, Supabase migrations — per codebase constitution

## What Claude must do on conflict

When two memory sources disagree:

1. State the conflict explicitly. Don't paper over it.
2. Identify which tier each source belongs to.
3. Default to the higher tier.
4. If the higher-tier source looks wrong, flag it for human review — don't silently override it.

## What Claude must never do

- Treat Generated Intelligence (Tier 4) as if it were Architecture Memory (Tier 2)
- Edit a note's `last_verified` date without having actually verified it
- Add new entries to `00 System Core/Claude Memory/Anti-Patterns.md` outside of `scripts/vault-convention.ts`
- Rename or move files in `Agents/<X>-Agent/<sub>/` paths (they are write targets in shipped code)

## Related

- [[Vault Constitution]]
- [[Metadata Rules]]
- [[Generated Output Rules]]
