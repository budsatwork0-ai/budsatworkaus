# Architecture Doctor v1.0 — Changelog

Phases 1–22 summary. All work completed 2026-07-09 unless otherwise noted.

---

## Phase 1 — Project Bootstrap

Established the core module structure, TypeScript type system (`types.ts`), and CLI entry point (`scripts/architecture-doctor.ts`). Defined `ArchitectureInventory`, `AtlasSpec`, `CapabilitySpec`, `DriftFinding`, and `ArchitectureHealthReport` as the shared contracts used by all downstream modules.

**Introduced:** `types.ts`, `scripts/architecture-doctor.ts`

---

## Phase 2 — Atlas Parser and Repository Scanner

Implemented the Business Capability Atlas parser (`atlas-parser.ts`) to extract 24 capabilities from the Bud OS markdown atlas document. Implemented the repository scanner (`repo-scanner.ts`) to discover pages, API routes, agents, cron workers, database tables, views, storage buckets, environment variables, and source files from the repository tree and migration history.

**Introduced:** `atlas-parser.ts`, `repo-scanner.ts`
**Capabilities mapped:** 24

---

## Phase 3 — Drift Detection and Risk Model

Wired the atlas and inventory into a cross-reference engine that generates `DriftFinding` records for every gap. Defined 16 finding types covering routes, pages, agents, tables, cron, dependency architecture, governance, and RLS. Introduced the risk model (`risk-model.ts`) with six weighted categories: Security (25%), Database (20%), Dependency Architecture (20%), Documentation (15%), Performance (10%), Maintainability (10%).

**Introduced:** `risk-model.ts`, finding type definitions in `types.ts`

---

## Phase 4 — RLS Verification

Added `rls-checks.ts` to analyse migration files for Row Level Security enablement signals. Added `table-aliases.ts` to resolve logical atlas names to physical table names, eliminating false positives from name mismatches (`expenses` → `payables`, `users` → `profiles`, `fundraising_campaigns` → `fundraising_items`).

**Introduced:** `rls-checks.ts`, `table-aliases.ts`
**RLS score at release:** 99/100

---

## Phase 5 — Baseline Management

Added `baseline.ts` with `promoteBaselineEntries`, `reviewBaselineEntries`, and `generateProposedBaseline`. Accepted findings enter the baseline with mandatory metadata fields: `id`, `key`, `owner`, `accepted_by`, `accepted_reason`, `review_after`, `expiry_date`. Baselined findings remain visible in reports but are separated from new findings in scoring.

**Introduced:** `baseline.ts`, `architecture-doctor-baseline.json`

---

## Phase 6 — Advisory CI Workflow

Added the non-blocking GitHub Actions advisory workflow (`architecture-doctor-advisory.yml`). The workflow runs on every pull request, typechecks, runs unit tests, generates all reports, and uploads artifacts. It never sets a non-zero exit code for architecture findings. Added `--ci-advisory` flag to the CLI to enforce advisory-only behaviour regardless of enforcement mode. Added `ci-plan.ts` to generate a machine-readable CI plan document.

**Introduced:** `.github/workflows/architecture-doctor-advisory.yml`, `ci-plan.ts`, `--ci-advisory` flag
**npm script:** `architecture:doctor:advisory`

---

## Phase 7 — Dependency Graph Analysis

Added `dependency-graph.ts` to build an import graph from TypeScript source files and detect circular dependency cycles and cross-domain dependency violations. Classified discovered cycles into: production architecture cycles, manual-review cycles, acceptable shared-layer cycles, and test/tooling cycles.

**Introduced:** `dependency-graph.ts`
**Cycles at release:** 5 (all acceptable shared-layer)

---

## Phase 8 — Governance and Business Loop Checks

Added `governance-checks.ts` to verify that each capability has declared ownership and that asset assignments are complete. Added `business-loop.ts` to verify that business-critical flow sequences (lead → quote → payment → confirmation → job completion) are traceable through the capability asset inventory.

**Introduced:** `governance-checks.ts`, `business-loop.ts`
**Governance coverage score at release:** 97/100

---

## Phase 9 — Source Indexing and Capability Manifest

Added `source-index.ts` to build a per-file cross-reference index, associating every source file with the capabilities it serves. Added `capability-manifest.ts` to assemble a structured per-capability manifest from the atlas and scan data, enabling findings to be attributed to the correct business owner.

**Introduced:** `source-index.ts`, `capability-manifest.ts`

---

## Phase 10 — Report Diffing and Trend Tracking

Added `report-diff.ts` to read the previous `architecture-health.json` and compute deltas for health score, critical count, warning count, and dependency cycle count. Every subsequent report now shows trend direction (delta) alongside absolute values.

**Introduced:** `report-diff.ts`

---

## Phase 11 — Security Findings Triage

Systematic review of 16 Security findings. Triaged each finding to one of: `true_positive_fix_now`, `detector_false_positive`, `needs_manual_review`.

Results:
- **14 resolved as false positives** — corrected by adding table aliases or marking views as views rather than tables. Detector code updated, no production changes made.
- **1 true positive fixed** — `rls_missing_signal` on `agent_workflow_memberships`; RLS and admin/service-role policies added via migration `20260709120000_150_agent_workflow_memberships_rls.sql`.
- **2 deferred to baseline** — `atlas_table_missing` and `rls_unknown` on `ndis_roles`; production-applied stub migration has no local SQL body; manual Supabase verification required.

**Files:** `security-findings-triage-2026-07-09.md`, `architecture-doctor-baseline.json`

---

## Phase 12 — Critical Triage Module

Added `critical-triage.ts` to classify findings into structured triage records with fields: `classification`, `requiredChange`, `whyItMatters`, `smallestSafeFix`. Critical triage output appears in `architecture-drift-report.md` → `## Critical findings triage` and drives the enforcement policy evaluation.

**Introduced:** `critical-triage.ts`

---

## Phase 13 — Enforcement Policy Design

Added `enforcement-policy.ts` defining four progressive enforcement modes (`advisory`, `warn_only`, `block_on_critical`, `block_on_threshold`) and the prerequisite conditions that must be satisfied before blocking can occur (`releaseCycleObserved`, `scoreThresholdAgreed`). Introduced `architecture-doctor-enforcement.json` as the persistent config file read by the CLI at runtime.

**Introduced:** `enforcement-policy.ts`, `architecture-doctor-enforcement.json`

---

## Phase 14 — CLI Fail Mode

Added `cli-fail-mode.ts` to evaluate `--fail-on` flag values independently of the enforcement policy. Allows targeted local failure modes (e.g. `--fail-on critical`) without changing the global enforcement config. The `--ci-advisory` flag overrides both the enforcement policy and the fail mode to ensure advisory workflows never block.

**Introduced:** `cli-fail-mode.ts`

---

## Phase 15 — Release Cycle Evidence

Added `release-cycle-evidence.ts` to record every advisory run as a structured observation in `architecture-doctor-release-cycle-history.json`. Each observation captures: run date, git commit, health score, critical count, security score, dependency cycle count, baselined finding count, expired baseline count, enforcement mode, and blocking status.

Implements automatic `releaseCycleObserved` promotion: when a clean advisory cycle is first detected (criticals = 0, no expired baselines, enforcement mode stable), the enforcement config is updated automatically.

**Introduced:** `release-cycle-evidence.ts`, `architecture-doctor-release-cycle-history.json`

---

## Phase 16 — Score Calibration and Threshold Agreement

Ran threshold dry-run analysis. Agreed minimum health score of 80/100 and set `scoreThresholdAgreed: true` in the enforcement config. Documented the threshold in `architecture-doctor-threshold-dry-run.md`. At 80/100, the threshold dry-run confirms the gate would pass.

**Files:** `architecture-doctor-threshold-dry-run.md`
**Config update:** `scoreThresholdAgreed: true`, `minimumHealthScore: 80`

---

## Phase 17 — Governance Documentation

Wrote `architecture-doctor-governance.md` documenting: the two CI workflows, all four enforcement modes, the final safety check conditions, the branch protection activation procedure, the rollback procedure, and the enforcement config reference.

**Introduced:** `architecture-doctor-governance.md`

---

## Phase 18 — Controlled Blocking CI Preparation

Changed `enforcementMode` from `warn_only` to `block_on_critical` in `architecture-doctor-enforcement.json`. Confirmed that at 0 critical findings, the enforcement policy evaluates to `shouldFail: false` — the gate is armed but not triggered. Regenerated all reports.

**Config change:** `enforcementMode: "block_on_critical"`

---

## Phase 19 — Blocking Dry-Run Workflow

Created `architecture-doctor-blocking-dry-run.yml` — a second GitHub Actions workflow that runs without `--ci-advisory`, allowing the enforcement policy to fire. This workflow is not a required branch protection gate; it is a controlled rehearsal showing exactly what would happen if the gate were required. Added `architecture:doctor:blocking-dry-run` npm script.

**Introduced:** `.github/workflows/architecture-doctor-blocking-dry-run.yml`
**npm script:** `architecture:doctor:blocking-dry-run`
**Local dry-run result:** exit 0 (0 criticals, `shouldFail: false`)

---

## Phase 20 — Final Safety Check

Added `final-safety-check.ts` implementing a five-condition gate:
1. `critical count = 0` ✓
2. `health score >= 80` ✓
3. `no expired baselines` ✓
4. `releaseCycleObserved = true` ✓
5. `scoreThresholdAgreed = true` ✓

Wired `runFinalSafetyCheck()` into the reporter and added a `## Final Safety Check` section to `architecture-drift-report.md` and a `Final safety check` row to `architecture-doctor-pr-summary.md`. All five conditions pass: `finalSafetyCheck.passed = true`.

**Introduced:** `final-safety-check.ts`

---

## Phase 21 — Activation Readiness Review

Formal activation readiness review against all pre-conditions:

| # | Check | Result |
|---|---|---|
| 1 | Blocking dry-run workflow exists | ✓ |
| 2 | Blocking dry-run exits 0 on current main | ✓ |
| 3 | `finalSafetyCheck.passed` is `true` | ✓ |
| 4 | Advisory workflow remains non-blocking | ✓ |
| 5 | Rollback procedure documented | ✓ |

**Verdict: SAFE TO ACTIVATE BRANCH PROTECTION**

The blocking dry-run workflow is ready to be promoted to a required GitHub branch protection gate.

---

## Phase 22 — Post-Activation Monitoring Plan

Appended a `## Phase 22 — Post-Activation Monitoring Plan` section to `architecture-doctor-governance.md` covering:
1. What to check after the first protected PR (6-item checklist)
2. What to do if the gate blocks correctly (confirm genuine critical → fix or accept → re-push)
3. What to do if the gate blocks falsely (advisory investigation → rollback if needed → document)
4. Baseline review schedule for 2 accepted findings (review date 2026-08-08, Supabase production verification steps)
5. Owner responsibilities (architecture owner vs Operations/Compliance vs PR author)
6. Rollback decision criteria (all three conditions required: false positive confirmed, resolution > 1h, architecture-owner approval)

**Files:** `architecture-doctor-governance.md`

---

## v1.0 Release Summary

All 22 phases complete. Architecture Doctor is a production-ready static analysis system with:
- 20 library modules (~4,000 lines of TypeScript)
- 1 CLI entry point (205 lines)
- 2 CI workflows
- 4 progressive enforcement modes
- 5-condition final safety check
- Formal governance documentation
- Post-activation monitoring runbook
- 24 capabilities mapped, 186 findings tracked, 80/100 health score
