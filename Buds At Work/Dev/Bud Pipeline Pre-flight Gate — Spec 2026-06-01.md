# Bud Pipeline Pre-flight Gate — Spec

**Status:** Proposed
**Author:** Bud OS (drafted with Jackson)
**Date:** 2026-06-01
**Related:** PR #113 (CI-failure fix), PR #114 (self-correcting prompts)
**Touches:** `src/lib/bud/improvement-executor.ts`, new `src/lib/bud/preflight.ts`

---

## 1. Summary

Today every improvement patch is validated by pushing a `bud/**` branch and waiting for
GitHub Actions to run `npm ci` + `tsc --noEmit` — roughly **60–90 seconds and a full CI
run per attempt**. The most common failures (Zod-v4 arity, forbidden imports, test files
in the wrong place, design-token misuse) are mechanical and detectable in **milliseconds,
in-process, before any branch or CI run exists**.

This spec proposes a **pre-flight gate**: a cheap, dependency-free validation pass over the
generated patches that runs *before* the branch is created. Failing patches are sent back
to the model for one free corrective regeneration; only patches that clear pre-flight ever
touch GitHub. CI remains the source of truth for real type-checking — pre-flight only shifts
the high-frequency, obvious failures left.

---

## 2. Goals / Non-goals

### Goals
- Catch the **observed** mechanical failure classes before a branch/CI run is spent.
- Add **zero new runtime dependencies** for the first phase.
- Reuse the existing **corrective-regeneration loop** (`callClaudeForPatches`) rather than
  inventing a new one.
- Feed pre-flight rejections into the same **learnings** table so the prompt keeps improving.
- Be **fail-open**: if pre-flight errors or is disabled, behave exactly as today.

### Non-goals
- Replacing CI. Pre-flight does **not** do full project type-checking — it cannot see
  cross-file types in a serverless context. CI stays authoritative.
- Static analysis of the entire repo. Pre-flight only inspects the **changed files'** content.
- UI/visual scoring. The taste gate (`visual-scorer`) already covers that post-push; pre-flight
  may *pre-empt* a subset of taste rules but does not duplicate the scorer.

---

## 3. Where it slots in

Current pipeline (in `executeImprovementPipeline`):

```
DETECT → ANALYZE → PLAN → PATCH ──────────────► VALIDATE (CI) → TASTE → BROWSER → PR → [MERGE]
                          │
                          ├─ callClaudeForPatches(patchPrompt)
                          ├─ createBranch(branchName)         ← GitHub write #1
                          ├─ writeFileToBranch(... )           ← GitHub write #2..n
                          └─ pollWorkflowUntilComplete(...)     ← ~60–90s CI wait
```

Proposed — a `PRE-FLIGHT` step inserted **between patch generation and branch creation**
(i.e. after `callClaudeForPatches` returns and before `createBranch`, around line 643 of
`improvement-executor.ts`):

```
PATCH:
  patches = callClaudeForPatches(patchPrompt)
  ┌─────────────────────────────────────────────┐
  │ PRE-FLIGHT  (new, in-process, ~ms)           │
  │   result = preflightPatches(patches)         │
  │   if result.autoFixable → apply fixes        │
  │   else if result.blocking:                   │
  │     patches = callClaudeForPatches(           │
  │        patchPrompt + result.feedback)  ← free │
  │     re-run preflight once                     │
  │   if still blocking → block execution,        │
  │     write learning, NO branch/CI spent        │
  └─────────────────────────────────────────────┘
  createBranch(...) → writeFileToBranch(...) → CI
```

Key property: a patch that fails pre-flight twice **never creates a branch, never starts a
CI run, never opens an issue**. It is blocked locally and logged as a learning.

---

## 4. Design

### 4.1 Two tiers

**Tier A — Footgun rules (Phase 1, no dependencies).**
Pure functions over `{ file, content }`. Each rule is a regex/string heuristic encoding a
failure mode we have actually seen or that the Design Constitution already documents. Runs
in well under a millisecond per file. Two outcomes per rule:
- `autofix` — deterministic rewrite (e.g. add the missing `z.string(),` argument).
- `block` — cannot be safely auto-fixed; emit structured feedback for the model.

**Tier B — Syntax/parse validation (Phase 2, optional).**
Use the TypeScript compiler API (`ts.createSourceFile` / `ts.transpileModule` with
`reportDiagnostics`) to catch **syntax** and `isolatedModules` errors. This does *not*
type-check (no cross-file resolution) but reliably catches malformed output and a class of
`isolatedModules` violations that CI rejects.
- **Dependency note:** `typescript` is currently a **devDependency only** (`^5`), so it is
  not guaranteed to resolve inside the Vercel function bundle. Phase 2 requires either
  promoting `typescript` to a runtime dependency or bundling it explicitly. Because that is
  a heavier change, Tier B is deferred; Tier A alone covers every failure class observed so far.

### 4.2 Initial rule set (Tier A)

| # | Rule | Detect | Action | Source of truth |
|---|------|--------|--------|-----------------|
| A1 | Zod v4 `z.record` arity | `z.record(` with a single argument | **autofix** → `z.record(z.string(), <arg>)` | Zod v4 (`buildToolchainNotes`) |
| A2 | Forbidden Supabase import | `import { createClient } from '@/lib/supabase/server'` | block → "use `createServiceClient()`" | server.ts exports |
| A3 | Test file under `src/` | path matches `src/**/*.test.ts(x)` | block → "place under `tests/`" | tsconfig `exclude` |
| A4 | `glass`/`glassSoft` misuse | `style={{...glass}}` / `style={glass}` / `{...glass}` | autofix → `className={glass}` | CLAUDE.md / Design Constitution |
| A5 | Button uses `brand.primary` bg | `bg`/`background` paired with `brand.primary` on an action element | block → "use `brand.accent`" | Design Constitution C-… |
| A6 | Token import path | imports of theme tokens from `../theme` / `@/app/ui/theme.ts` / re-export paths | autofix → `@/app/ui/theme` | CLAUDE.md |
| A7 | Forbidden secret/env edits | patch targets `.env*`, `vercel.json`, `next.config.*` | block → out of scope | Constitution "Never" list |
| A8 | Empty / truncated file | content length 0 or unbalanced braces/backticks | block → "regenerate full file" | safety |

The rule registry lives in `preflight.ts` as an ordered array so rules can be added without
touching the pipeline. A5/A4/A6 only run on files where `isUiFile(path)` is true (reusing
`design-constitution.isUiFile`).

### 4.3 Module interface (`src/lib/bud/preflight.ts`)

```ts
export type PreflightSeverity = 'autofix' | 'block';

export interface PreflightFinding {
  rule: string;            // 'A1'
  file: string;
  message: string;         // human + model-facing explanation
  severity: PreflightSeverity;
}

export interface PreflightResult {
  ok: boolean;                 // true if no blocking findings remain
  patches: Patch[];            // possibly auto-fixed copies
  findings: PreflightFinding[];
  autofixedCount: number;
  feedback: string;            // formatted block for the corrective prompt ('' if ok)
}

export function preflightPatches(patches: Patch[]): PreflightResult;
```

`feedback` is a compact, model-facing string, e.g.:

```
PRE-FLIGHT REJECTED YOUR PATCH. Fix these before resubmitting:
- src/agents/quote-triage/schema.ts: `z.record(z.unknown())` is Zod v3. Use `z.record(z.string(), z.unknown())`.
- src/lib/agents/agents/foo.test.ts: test files must live under `tests/`, not `src/`.
Return corrected patches in the same JSON format.
```

### 4.4 Integration in `improvement-executor.ts`

Add a flag and a single insertion point. Pseudocode:

```ts
const PREFLIGHT_ENABLED = process.env.BUD_OS_PREFLIGHT_ENABLED !== 'false'; // default ON

// ...after the initial callClaudeForPatches, before createBranch:
if (PREFLIGHT_ENABLED && patches.length > 0) {
  await emitStage(supabase, pipelineRunId, 'sandbox', 'active', { preflight: true });
  let pf = preflightPatches(patches);
  if (!pf.ok) {
    // one free corrective regeneration — no GitHub, no CI
    const corrected = await callClaudeForPatches(`${patchPrompt}\n\n${pf.feedback}`);
    if (corrected.patches.length > 0 && corrected.patches.length <= SURGICAL_FILE_LIMIT) {
      pf = preflightPatches(corrected.patches);
    }
  }
  if (pf.ok) {
    patches = pf.patches;                       // includes auto-fixes
    await emitStage(supabase, pipelineRunId, 'sandbox', 'passed',
      { preflight: 'passed', autofixed: pf.autofixedCount });
  } else {
    await finishStep(supabase, patchStep, 'blocked', { preflight: pf.findings });
    await writeLearning(supabase, executionId, typedSignal, 'blocked',
      `Pre-flight blocked: ${pf.findings.map(f => f.rule + ' ' + f.file).join('; ')}`);
    await emitStage(supabase, pipelineRunId, 'sandbox', 'rejected', { preflight: pf.findings });
    await emitStage(supabase, pipelineRunId, 'reject', 'rejected', { reason: 'preflight' });
    await finalizePipelineRun(supabase, pipelineRunId, { verdict: 'rejected' });
    return { executionId, status: 'blocked', blockedReason: 'preflight' };
  }
}
```

Because `writeLearning(..., 'blocked', ...)` is reused, **PR #114's failure-aware prompting
automatically learns from pre-flight blocks too** — a virtuous loop where the gate teaches
the generator.

---

## 5. Observability

- New pipeline sub-state on the existing `sandbox` stage: `preflight: passed | autofixed | rejected`.
- `bud_improvement_steps.evidence` records findings + autofix count for the patch step.
- Optional dashboard metric: **pre-flight catch rate** = preflight-blocked / (preflight-blocked + CI-failed).
  Target: the majority of mechanical failures caught before CI within two weeks of rollout.
- Each rule logs its hit count so dead rules can be pruned and new failure modes promoted to rules.

---

## 6. Rollout

1. **Phase 0 — shadow mode.** Ship `preflight.ts` + integration behind
   `BUD_OS_PREFLIGHT_ENABLED`, but in shadow it only *logs* findings (does not block or
   regenerate). Compare findings against subsequent CI results for one week to measure
   precision and tune rules. No behaviour change.
2. **Phase 1 — enforce autofix + block.** Flip to enforcing. Auto-fixes apply silently;
   blocks trigger one corrective regeneration, then hard-block. This is the main win.
3. **Phase 2 — Tier B parse check.** Only if Phase 1 catch-rate shows residual syntax
   failures reaching CI *and* after deciding how to make `typescript` resolvable at runtime.

Each phase is independently revertible via the env flag.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| **False positive blocks a valid patch.** | Rules start in *shadow mode* (Phase 0); only enforce after measuring precision. Prefer `autofix` over `block`; keep block rules conservative. |
| **Auto-fix corrupts code.** | Auto-fixes are limited to deterministic, single-token rewrites (A1, A4, A6) verified by re-running pre-flight; the patch still goes through full CI afterward. |
| **Pre-flight gives false confidence.** | CI is unchanged and remains the gate of record. Pre-flight is strictly additive — it never *approves* a merge. |
| **Rules drift from reality.** | Version-derived rules (A1) read from `buildToolchainNotes`/`package.json`; per-rule hit counters surface dead rules. |
| **`typescript` bundling bloat (Phase 2).** | Deferred; not required for Phase 1. Decide separately. |

---

## 8. Testing strategy

Vitest unit tests in `tests/lib/bud-preflight.test.ts` (under `tests/`, excluded from CI
typecheck — see A3). Fixture-driven:

- One fixture per rule: a known-bad input → assert the expected finding + (for autofix) the
  exact corrected output.
- A "clean" fixture (e.g. correct Zod v4 usage) → assert `ok: true`, zero findings.
- Regression fixture: the real `z.record(z.unknown())` schema that caused the original
  outage → assert A1 autofix produces `z.record(z.string(), z.unknown())`.
- Idempotence: `preflightPatches(preflightPatches(x).patches)` yields no new autofixes.

---

## 9. Effort & sequencing

| Item | Est. | Notes |
|------|------|-------|
| `preflight.ts` (rules A1–A8 + registry) | ~0.5 day | Pure functions, no deps |
| Integration + flag in `improvement-executor.ts` | ~0.25 day | Single insertion point |
| Vitest fixtures | ~0.25 day | One per rule |
| Phase 0 shadow + tuning | ~1 week elapsed | Passive measurement |
| Tier B (optional) | ~0.5 day + dep decision | Deferred |

**Recommended first PR:** `preflight.ts` + integration shipped in **shadow mode**
(`BUD_OS_PREFLIGHT_ENABLED` present, logging only), plus the Vitest fixtures. Low blast
radius, immediately measurable, and reuses every existing hook (`callClaudeForPatches`,
`emitStage`, `writeLearning`, `isUiFile`).

---

## 10. Open questions

1. Should pre-flight **auto-fixes** be surfaced in the PR body (transparency) or applied
   silently? (Lean: list them in the PR description.)
2. Do we want a **hard cap on corrective regenerations** across PATCH + pre-flight + CI
   retry combined, to bound model spend per signal? (Current: 1 at pre-flight, 1 at CI.)
3. Should A7 (forbidden file edits) be a pre-flight rule or moved earlier into
   `identifyTargetFiles` so those files are never offered as targets at all?
