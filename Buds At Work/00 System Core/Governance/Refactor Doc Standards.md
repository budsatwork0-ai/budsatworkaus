---
status: active
owner: Jackson
source_of_truth: this file
risk_level: medium
last_verified: 2026-05-27
formalises: the existing pattern in architecture/Refactor Plans/
---

# Refactor Doc Standards

How to write a refactor plan that's safe to execute. Formalises the pattern already used in `architecture/Refactor Plans/Services Core Extraction.md`, `Known Unsafe Areas.md`, and `Next Safe Refactor Batches.md`.

A refactor plan that doesn't follow this structure is treated as a draft and should not be executed against production code.

## When to write a refactor plan

Write a plan **before any of these**:

- A change that touches more than 3 files
- Any change in `src/lib/agents/`, `src/app/(public)/services/lib/pricing/`, or other pricing-adjacent code
- Any database schema change
- Any change to Stripe integration code
- A folder rename, file move, or directory restructure (vault or repo)
- A refactor proposed by an AI agent (Claude or otherwise)

For changes smaller than that, a commit message is enough.

## Required structure

Every refactor plan must include the following sections, in this order.

### 1. Frontmatter

```yaml
---
status: draft | active | in-flight | completed | abandoned
owner: <human>
source_of_truth: this file
risk_level: low | medium | high
last_verified: <ISO date>
depends_on: <list of prerequisite refactors or system notes>
used_by: <who acts on this plan>
---
```

### 2. Headline finding

A single paragraph that answers: *what problem does this refactor solve, and what's the one non-obvious thing the reader should know before they read further?*

The headline should make a non-author skim-reader understand the stakes in under 30 seconds.

### 3. Inventory

What currently exists. Note counts, file counts, current state. Verified, not assumed. Include the date of verification.

If the refactor touches code, list the files. If it touches the vault, list the folders and note counts.

### 4. Dependency map

What reads what. What writes what. This is the section most refactor plans skip and most refactor plans regret skipping.

For code: which callers reach the target. For data: which agents or scripts write to the affected path. For the vault: which CLAUDE.md, agent personas, or external scripts reference the path.

A refactor without a dependency map is a guessed refactor.

### 5. Proposed target

What the world looks like after the refactor. Tree diagrams, type signatures, table schemas — whatever shape best communicates the intent.

Include any deliberate divergences from the original idea and explain them. (Example: "the audit suggested flattening X but X is a write target in shipped code, so we leave it alone.")

### 6. Staged migration

The refactor broken into batches. Each batch must be:

- **Independently approvable** — a human reads the batch and says yes or no without reading later batches
- **Independently revertible** — `git revert <commit>` undoes the batch cleanly
- **Independently verifiable** — there is a specific command or check that proves the batch worked

Batches are numbered. Each batch lists its risk level, its actions, and its verification steps.

The first batch is always the lowest-risk one. The highest-risk batches are last and gated on prerequisite work.

### 7. Execution checklist

A literal checklist a human runs through before, during, and after each batch:

- Pre-execution: branch created, backup taken, no other in-flight work
- Execution: change applied, verification commands run
- Post-execution: commit message follows the convention, plan's `last_verified` updated, broken-link/type checks pass

### 8. What this plan does not do

Explicit non-goals. Things that look like part of the refactor but aren't.

This section prevents scope creep and saves the next reader from asking "why didn't you also do X?"

### 9. Open questions

The things the human must decide before any batch is executed. Phrased as concrete questions with concrete options, not vague concerns.

If the plan has zero open questions, it's either trivial or not done.

## Tone

Refactor plans are technical specifications, not pitches. No marketing language. No hedging. No "we should consider..." — either it's part of the plan or it isn't.

Use the second person sparingly. The reader is usually Jackson or a future Claude session. Both deserve direct prose.

## Worked example

`architecture/Refactor Plans/Vault Restructure Plan.md` (created 2026-05-27) follows this structure. Reference it when in doubt.

## Anti-patterns

- ❌ A refactor plan with no inventory ("the code is messy" without numbers)
- ❌ A refactor plan with no dependency map (rename-and-pray)
- ❌ Batches that bundle "while we're in here" extras (violates the surgical-changes rule)
- ❌ "Phase 1: refactor everything, Phase 2: ???" — granular batches are mandatory
- ❌ Closing a plan without setting `status: completed` and updating `last_verified`

## Related

- [[Vault Constitution]]
- [[Metadata Rules]]
- [[../../architecture/Refactor Plans/Services Core Extraction|Services Core Extraction]] — reference example
- [[../../architecture/Refactor Plans/Vault Restructure Plan|Vault Restructure Plan]] — this batch is from there
