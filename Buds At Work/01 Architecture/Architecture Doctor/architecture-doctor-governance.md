# Architecture Doctor Governance

Version: 1.0
Status: Production Ready
Date: 2026-07-09
Enforcement Mode: block_on_critical
Health Baseline: 80/100
Activation: Manual (GitHub Branch Protection)

---

## Overview

The Architecture Doctor runs static analysis against the Business Capability Atlas and produces health
reports, enforcement readiness checklists, and CI artifacts. This document explains what the workflows
do, what the enforcement modes mean, how to activate branch protection, and how to roll back.

---

## Workflows

### 1. Advisory Workflow (non-blocking)

**File:** `.github/workflows/architecture-doctor-advisory.yml`
**npm script:** `npm run architecture:doctor:advisory`

This workflow runs on every pull request. It uploads health reports as artifacts and publishes a
summary to the GitHub Actions job summary. It **never** sets a non-zero exit code because of
architecture findings.

The only things that can fail it are:
- `npm ci` dependency install failures
- TypeScript type errors (`npm run typecheck`)
- Unit test failures (`npm run test:unit -- architecture-doctor`)
- A crash in the architecture-doctor script itself

This workflow is safe to add as a required check — it will not block PRs on architecture findings.

### 2. Blocking Dry-Run Workflow (non-required)

**File:** `.github/workflows/architecture-doctor-blocking-dry-run.yml`
**npm script:** `npm run architecture:doctor:blocking-dry-run`

This workflow runs without `--ci-advisory`. The enforcement policy is therefore live: if the current
`enforcementMode` in `architecture-doctor-enforcement.json` is `block_on_critical`, this workflow
will exit non-zero whenever there are unresolved critical findings.

It is **not** a required branch protection gate. Failing this workflow does not block merge.
It is a controlled rehearsal — it shows exactly what would happen if the gate were required.

To promote this workflow to a required gate, follow the activation instructions below.

---

## Enforcement Modes

Configured in:
```
Buds At Work/01 Architecture/Architecture Doctor/architecture-doctor-enforcement.json
```

| Mode | Exit behaviour |
|---|---|
| `advisory` | Never exits non-zero on architecture findings. Reports only. |
| `warn_only` | Never exits non-zero. Logs what would have blocked. |
| `block_on_critical` | Exits non-zero if any unresolved critical finding exists. Health score and expired baselines do not trigger failure. |
| `block_on_threshold` | Exits non-zero if health score falls below `minimumHealthScore`. Also fails if `block_on_critical` conditions are met. |

**Current mode:** `block_on_critical`

The `npm run architecture:doctor:advisory` script always adds `--ci-advisory`, which forces advisory
behaviour regardless of the configured mode. The `npm run architecture:doctor:blocking-dry-run`
script does not add that flag, so the enforcement mode is respected.

---

## Final Safety Check

Before activating branch protection, all five conditions must pass:

| Check | What it verifies |
|---|---|
| `critical count = 0` | No unresolved critical findings in the current run |
| `health score >= 80` | Health score meets or exceeds the agreed minimum |
| `no expired baselines` | No accepted baseline entries have passed their `review_after` date |
| `releaseCycleObserved = true` | Set in the enforcement config after observing at least one clean advisory cycle |
| `scoreThresholdAgreed = true` | Set in the enforcement config after the team formally agrees the minimum score |

The final safety check result appears in:
- `architecture-drift-report.md` → `## Final Safety Check` section
- `architecture-health.json` → `finalSafetyCheck` field
- `architecture-doctor-pr-summary.md` → `Final safety check` row

---

## How to Activate Branch Protection

Only proceed after the final safety check shows **SAFE TO ACTIVATE BRANCH PROTECTION**.

Steps:

1. Confirm `npm run architecture:doctor:blocking-dry-run` exits 0 on the current `main` branch.
2. Confirm `finalSafetyCheck.passed` is `true` in `architecture-health.json`.
3. Go to GitHub → Settings → Branches → Branch protection rules → Edit the `main` rule.
4. Under "Require status checks to pass before merging", add:
   - `Architecture Doctor blocking dry-run (non-required gate)`
5. Save the rule.

Do not add the advisory workflow as a required gate — it is already non-blocking and does not need
branch protection enforcement.

Do not activate branch protection if any of the following are true:
- `finalSafetyCheck.passed` is `false`
- The blocking dry-run has not been run at least once on the current branch
- Any team member has not been briefed on the rollback procedure

---

## Rollback Procedure

If the blocking dry-run produces unexpected failures after being made a required gate:

### Immediate rollback (< 5 minutes)

1. Go to GitHub → Settings → Branches → Branch protection rules → Edit the `main` rule.
2. Remove `Architecture Doctor blocking dry-run (non-required gate)` from the required checks list.
3. Save. PRs can now merge again.

### Investigate without pressure

After rolling back, investigate in advisory mode:

```bash
npm run architecture:doctor:advisory
```

Read `architecture-drift-report.md` → `## Critical findings triage` to identify what triggered the failure.

### Downgrade enforcement mode

If the issue is a structural false positive or a noisy finding category, downgrade the mode:

```json
// architecture-doctor-enforcement.json
{
  "enforcementMode": "warn_only",
  ...
}
```

Then run `npm run architecture:doctor:advisory` to regenerate reports with the new mode.

The new findings can be accepted into the baseline with `--promote-baseline` after review.

### Re-activate after fixing

Once the root cause is resolved:
1. Re-run `npm run architecture:doctor:blocking-dry-run` locally and confirm exit 0.
2. Confirm `finalSafetyCheck.passed` is `true`.
3. Re-add the required check in GitHub branch protection.

---

## Phase 22 — Post-Activation Monitoring Plan

*Written: 2026-07-09. Applies from the moment the blocking dry-run is added as a required GitHub check.*

---

### 1. After the First Protected PR

Run these checks before declaring the gate healthy:

| Check | Command / Location |
|---|---|
| Gate produced an exit code | GitHub Actions → blocking dry-run → exit code in summary |
| PR summary row `Blocking would occur` | `architecture-doctor-pr-summary.md` in workflow artifacts |
| Health score has not dropped below 80 | `architecture-health.json` → `healthScore` |
| Critical count remains 0 | `architecture-health.json` → `criticalCount` |
| No new baseline entries added | diff `architecture-doctor-baseline.json` vs the prior run |
| Advisory findings unchanged or reduced | compare `warningCount` between runs |

If all checks pass and the gate did not block: the gate is operating correctly. Record the PR number and date in the release cycle history.

---

### 2. If the Gate Blocks Correctly

A correct block means the blocking dry-run exits non-zero and the PR summary shows a new unresolved critical finding.

Steps:

1. Read `architecture-drift-report.md` → `## Critical findings triage` to identify the finding.
2. Confirm the finding is genuine — not a stale artifact or environment issue.
3. Notify the capability owner listed against the finding (see enforcement config and atlas).
4. Resolve using one of:
   - Fix the root cause in the same PR branch.
   - Accept the finding into the baseline with `--promote-baseline` only after explicit architecture-owner approval.
5. Re-run `npm run architecture:doctor:blocking-dry-run` locally to confirm exit 0 before re-pushing.
6. Do not merge until the gate exits clean.

---

### 3. If the Gate Blocks Falsely

A false block is when the gate exits non-zero but no genuine new architectural issue exists in the PR.

Common false-positive causes:
- A production-applied migration has no local SQL body (same class as the `ndis_roles` stub).
- A transient asset reference in the atlas points to a file that was renamed.
- The report output directory contains a stale prior run artifact.

Steps:

1. Run `npm run architecture:doctor:advisory` locally on the PR branch.
2. Read `architecture-drift-report.md` → confirm the finding is a known stub or transient artifact.
3. If it is a known pattern already in the baseline, the baseline key must match — verify `key` field exactly.
4. If it is a new false positive, **do not merge**. Accept it into the baseline with documented justification, then re-run.
5. If resolution cannot be completed quickly, execute an **immediate rollback** (see §Rollback Procedure above) to unblock the team, then investigate under advisory mode.
6. Document the false positive in the release cycle history JSON.

---

### 4. Baseline Review Schedule — 2 Accepted Findings

Both accepted findings relate to the `ndis_roles` table (Capability C08 — NDIS Partner and Participant Matching).

| ID | Finding | Severity | Review Date | Hard Expiry |
|---|---|---|---|---|
| SEC-2026-07-09-001 | `atlas_table_missing` — `ndis_roles` | high | **2026-08-08** | 2026-10-07 |
| SEC-2026-07-09-002 | `rls_unknown` — `ndis_roles` | medium | **2026-08-08** | 2026-10-07 |

**Review action (due 2026-08-08):**

1. Open Supabase production → Table Editor → confirm `ndis_roles` exists.
2. Open Supabase production → Authentication → Policies → confirm RLS is enabled on `ndis_roles` and at least one policy covers participant-to-role read access.
3. If both exist and are correct: write a reconciliation migration or evidence metadata file documenting the production state. Remove the two baseline entries once evidence is in the repository.
4. If either is missing: escalate to Operations / Compliance immediately. Do not remove the baseline entries until the production gap is closed.
5. Update `review_date` in `architecture-doctor-baseline.json` after each completed review cycle.

**Hard expiry (2026-10-07):** if the findings are not resolved by this date and `failOnExpiredBaseline` is later set to `true`, the gate will begin blocking on expiry. Resolve before this date.

---

### 5. Owner Responsibilities

| Role | Responsibility |
|---|---|
| **Architecture owner** (Jackson) | Approve baseline promotions, approve threshold changes, execute rollbacks, record release cycle evidence |
| **Operations / Compliance** | Review and resolve `ndis_roles` findings by 2026-08-08; verify production Supabase RLS |
| **PR author** | Investigate any gate block before requesting a rollback; never bypass with `--ci-advisory` on the blocking workflow |
| **Any team member** | May trigger advisory run locally at any time; may not modify `architecture-doctor-enforcement.json` without architecture-owner approval |

The architecture owner is the only person who may:
- Change `enforcementMode` in the enforcement config.
- Remove or modify entries in `architecture-doctor-baseline.json`.
- Promote the gate from `block_on_critical` to `block_on_threshold`.
- Execute a GitHub branch protection rollback.

---

### 6. Rollback Decision Criteria

Roll back (remove the blocking check from GitHub branch protection) only when **all three** of the following are true:

| Criterion | Test |
|---|---|
| The block is confirmed false or premature | Advisory run confirms no genuine new critical in the diff |
| Rollback is faster than resolution | The root cause cannot be fixed within one working hour |
| The architecture owner has approved | Verbal or written confirmation logged |

Do **not** roll back because a PR is urgent or a deadline is close. Urgency is not a technical justification.

After rollback, set `enforcementMode` to `warn_only` in `architecture-doctor-enforcement.json` to continue generating evidence without blocking. Re-activate only after the false positive is resolved and a clean advisory run confirms exit 0.

**Automatic re-activation trigger:** re-add the required check once:
1. `npm run architecture:doctor:blocking-dry-run` exits 0 locally.
2. `finalSafetyCheck.passed` is `true` in `architecture-health.json`.
3. The root cause of the false positive is documented in `architecture-doctor-release-cycle-history.json`.

---

## Enforcement Config Reference

```json
// Buds At Work/01 Architecture/Architecture Doctor/architecture-doctor-enforcement.json
{
  "enforcementMode": "block_on_critical",
  "minimumHealthScore": 80,
  "failOnCritical": false,
  "failOnExpiredBaseline": false,
  "releaseCycleObserved": true,
  "scoreThresholdAgreed": true
}
```

| Field | Purpose |
|---|---|
| `enforcementMode` | Controls when the blocking dry-run exits non-zero. |
| `minimumHealthScore` | The agreed minimum score threshold. Used by `block_on_threshold` mode and the final safety check. |
| `failOnCritical` | Legacy flag. Leave `false`; mode `block_on_critical` already handles this. |
| `failOnExpiredBaseline` | Set `true` only after all baseline entries are within their review windows. |
| `releaseCycleObserved` | Set `true` manually after confirming a clean advisory cycle in the release history. |
| `scoreThresholdAgreed` | Set `true` manually after the team formally agrees the minimum score. |
