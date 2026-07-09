# Architecture Doctor v1.0 — Release Summary

Version: 1.0
Status: Production Ready
Date: 2026-07-09
Enforcement Mode: block_on_critical
Health Baseline: 80/100
Activation: Manual (GitHub Branch Protection)

---

## What Architecture Doctor Is

Architecture Doctor is a static analysis system for Bud OS. It reads the Business Capability Atlas — the canonical description of what the platform is supposed to do and what assets should exist — and compares it against the actual repository state. The result is a health score, a set of findings, and a set of enforcement signals.

It runs entirely from local file analysis. It does not call external services, modify production data, or alter application behaviour. It produces read-only reports and enforces standards only through CI exit codes.

---

## Major Capabilities

### 1. Repository Scanning (`repo-scanner.ts`)
Discovers all pages, API routes, agents, cron workers, database tables, views, storage buckets, environment variables, and source files from the repository tree and Supabase migrations. Produces a structured inventory used by all downstream checks.

### 2. Business Capability Atlas Parsing (`atlas-parser.ts`)
Reads the Bud OS Business Capability Atlas markdown document and extracts 24 capabilities, each with declared owners, pages, routes, agents, tables, buckets, and environment variables. The atlas is the source of truth for what the platform is supposed to have.

### 3. Drift Detection (16 finding types)
Cross-references the atlas against the scanned inventory and reports:
- `atlas_api_missing` / `repo_api_unmapped` — route gaps between atlas and repo
- `atlas_page_missing` / `repo_page_unmapped` — page gaps
- `atlas_agent_missing` / `repo_agent_unmapped` — agent gaps
- `atlas_table_missing` / `repo_table_unmapped` — database ownership gaps
- `cron_route_unregistered` / `cron_target_missing` — cron registration gaps
- `dependency_cycle` / `dependency_cross_domain` — import graph violations
- `governance_unknown` / `business_loop_unknown` — coverage gaps
- `rls_missing_signal` / `rls_unknown` — database security gaps

### 4. Weighted Health Scoring (`risk-model.ts`, `reporter.ts`)
Scores the repository across six categories with weighted contribution:

| Category | Weight | Score |
|---|---:|---:|
| Security | 25% | 99/100 |
| Database | 20% | 85/100 |
| Dependency Architecture | 20% | 41/100 |
| Documentation | 15% | 73/100 |
| Performance | 10% | 97/100 |
| Maintainability | 10% | 94/100 |
| **Overall** | | **80/100** |

### 5. RLS Verification (`rls-checks.ts`, `table-aliases.ts`)
Checks every table discovered in migrations for Row Level Security enablement signals. Resolves logical atlas names to physical table names via a configurable alias layer, preventing false positives from name mismatches (e.g. `expenses` → `payables`, `users` → `profiles`).

### 6. Dependency Graph Analysis (`dependency-graph.ts`)
Builds an import graph from TypeScript source files and detects:
- Circular dependency cycles (currently 5 acceptable shared-layer cycles)
- Cross-domain dependency violations between capability boundaries

### 7. Governance and Business Loop Checks (`governance-checks.ts`, `business-loop.ts`)
Verifies that each capability has declared ownership and that business-critical loops (quote → payment → confirmation, etc.) are traceable through the asset inventory.

### 8. Source Cross-Referencing (`source-index.ts`, `capability-manifest.ts`)
Builds a per-file source index and per-capability manifest so findings can be attributed to the correct business owner rather than just a file path.

### 9. Baseline Management (`baseline.ts`)
Accepts findings that cannot be resolved immediately into a versioned baseline with mandatory metadata: owner, accepted reason, review date, and expiry date. Baselined findings remain visible in reports but are separated from new findings in scoring. Promotes and reviews baseline entries via CLI flags.

### 10. Release Cycle Evidence (`release-cycle-evidence.ts`)
Records every advisory run as an observation in a versioned history JSON. Detects when a clean advisory cycle has been observed (0 criticals, no expired baselines, enforcement mode confirmed), automatically updating the enforcement config.

### 11. Enforcement Policy (`enforcement-policy.ts`, `cli-fail-mode.ts`)
Four progressive enforcement modes:
- `advisory` — reports only, never fails
- `warn_only` — reports what would block, never fails
- `block_on_critical` — exits non-zero when unresolved criticals exist (current mode)
- `block_on_threshold` — exits non-zero when health score falls below minimum

Guards against premature blocking via prerequisite conditions (`releaseCycleObserved`, `scoreThresholdAgreed`).

### 12. Final Safety Check (`final-safety-check.ts`)
Five-condition gate that must all pass before branch protection activation:
1. `critical count = 0`
2. `health score >= 80`
3. `no expired baselines`
4. `releaseCycleObserved = true`
5. `scoreThresholdAgreed = true`

**All five conditions currently pass.**

### 13. Report Diffing (`report-diff.ts`)
Tracks score and finding count deltas between runs so every report shows trend direction alongside absolute values.

### 14. CI Workflows (`.github/workflows/`)
Two workflows:
- **Advisory** (`architecture-doctor-advisory.yml`) — runs on every PR, uploads artifacts, never blocks merge
- **Blocking Dry-Run** (`architecture-doctor-blocking-dry-run.yml`) — runs without `--ci-advisory`, respects enforcement mode, exits non-zero on violations; currently non-required but ready to be promoted to required gate

---

## Governance Model

Full governance detail is in `architecture-doctor-governance.md`.

### Enforcement Config (current)
```json
{
  "enforcementMode": "block_on_critical",
  "minimumHealthScore": 80,
  "failOnCritical": false,
  "failOnExpiredBaseline": false,
  "releaseCycleObserved": true,
  "scoreThresholdAgreed": true
}
```

### Ownership
- Architecture owner (Jackson) — sole authority over enforcement config, baseline, mode changes, and branch protection
- Capability owners — responsible for findings within their capability domain
- Operations / Compliance — owns the 2 accepted `ndis_roles` baseline findings (review due 2026-08-08)

---

## Enforcement Lifecycle

```
advisory
  → warn_only             (dry-run evidence, no blocking)
    → block_on_critical   ← CURRENT POSITION
      → block_on_threshold (future, requires score calibration period)
```

Gate promotion from `block_on_critical` to `block_on_threshold` requires:
- A confirmed stable advisory release cycle at `block_on_critical`
- Explicit architecture-owner decision and config change

---

## Health Scoring (v1.0 Baseline)

| Metric | Value |
|---|---|
| Overall health score | 80/100 |
| Security score | 99/100 |
| Critical findings | 0 |
| Accepted baseline findings | 2 (both `ndis_roles`, review 2026-08-08) |
| Expired baselines | 0 |
| Dependency cycles | 5 (all classified as acceptable shared-layer) |
| Total findings | 186 |
| Capabilities mapped | 24 |
| Pages discovered | 117 |
| API routes discovered | 242 |
| Agents discovered | 61 |
| Database tables/views | 209 |

---

## Baseline Management (v1.0 State)

Two accepted findings at release:

| ID | Finding | Table | Severity | Review Date | Expiry |
|---|---|---|---|---|---|
| SEC-2026-07-09-001 | `atlas_table_missing` | `ndis_roles` | high | 2026-08-08 | 2026-10-07 |
| SEC-2026-07-09-002 | `rls_unknown` | `ndis_roles` | medium | 2026-08-08 | 2026-10-07 |

Both require production Supabase verification (manual review). Neither is a confirmed exploit; both are analysis uncertainty due to a production-applied migration stub with no local SQL body.

---

## CI Workflows

| Workflow | File | Trigger | Required gate | Blocks merge |
|---|---|---|---|---|
| Advisory | `architecture-doctor-advisory.yml` | Every PR | No | Never |
| Blocking dry-run | `architecture-doctor-blocking-dry-run.yml` | Every PR | No (ready to promote) | On criticals when required |

### npm scripts
```bash
npm run architecture:doctor:advisory         # advisory, always exits 0
npm run architecture:doctor:blocking-dry-run # respects enforcement mode
npm run typecheck                             # TypeScript verification
npm run test:unit -- architecture-doctor     # unit tests
```

---

## Activation Procedure

The gate is not yet a required branch protection check. All pre-conditions to make it required are satisfied.

To activate:
1. Confirm `npm run architecture:doctor:blocking-dry-run` exits 0 on current `main`.
2. Confirm `finalSafetyCheck.passed` is `true` in `architecture-health.json`.
3. GitHub → Settings → Branches → main → Require status checks → add `Architecture Doctor Blocking Dry-Run (Non-Required)`.
4. Save.

Do not add the advisory workflow as a required check — it is already non-blocking.

---

## Rollback Procedure

If the gate produces unexpected blocks after activation:

1. GitHub → Settings → Branches → main → remove `Architecture Doctor Blocking Dry-Run (Non-Required)` from required checks.
2. PRs can merge again within 5 minutes.
3. Investigate under advisory mode: `npm run architecture:doctor:advisory`.
4. Downgrade `enforcementMode` to `warn_only` if the issue is structural.
5. Re-activate only after root cause is resolved and local blocking dry-run exits 0.

Rollback criteria: false positive confirmed AND resolution > 1 hour AND architecture-owner approval. Urgency alone is not a technical justification.

---

## Repository Layout

```
scripts/
  architecture-doctor.ts          — CLI entry point

src/lib/architecture-doctor/
  atlas-parser.ts                 — Business Capability Atlas reader
  baseline.ts                     — Accepted finding management
  business-loop.ts                — Business loop continuity checks
  capability-manifest.ts          — Per-capability asset ownership
  ci-plan.ts                      — CI plan report generator
  cli-fail-mode.ts                — --fail-on flag evaluation
  critical-triage.ts              — Critical finding classification
  dependency-graph.ts             — Import cycle and cross-domain detection
  enforcement-policy.ts           — Mode evaluation and threshold logic
  final-safety-check.ts           — Five-condition activation gate
  governance-checks.ts            — Ownership and coverage checks
  release-cycle-evidence.ts       — Advisory cycle history and observation
  repo-scanner.ts                 — Repository asset discovery
  report-diff.ts                  — Cross-run delta tracking
  reporter.ts                     — Report assembly and output
  risk-model.ts                   — Category scoring weights
  rls-checks.ts                   — RLS signal verification
  source-index.ts                 — File-level cross-reference
  table-aliases.ts                — Logical-to-physical table name resolution
  types.ts                        — Shared TypeScript types

.github/workflows/
  architecture-doctor-advisory.yml
  architecture-doctor-blocking-dry-run.yml

Buds At Work/01 Architecture/Architecture Doctor/
  architecture-doctor-baseline.json
  architecture-doctor-enforcement.json
  architecture-doctor-governance.md
  architecture-doctor-release-cycle-history.json
  architecture-health.json
  architecture-drift-report.md
  architecture-doctor-v1-release-summary.md    ← this file
  architecture-doctor-v1-changelog.md
  architecture-doctor-v1-limitations-roadmap.md
```

---

## Verification (v1.0 release)

All four verification commands pass. See verification results appended at end of session.
