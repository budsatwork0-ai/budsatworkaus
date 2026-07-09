# Architecture Doctor v1.0 — Known Limitations and Roadmap

Version: 1.0
Date: 2026-07-09

These items are not release blockers. They are known constraints and future improvement areas recorded separately to avoid confusion with active issues.

---

## Known Limitations

### L1 — Static Analysis Only
Architecture Doctor reads files. It does not inspect the live production database, running process state, or Vercel deployment configuration. Findings are bounded by what can be inferred from migrations, source files, and the atlas document.

**Impact:** Two accepted baseline findings (`ndis_roles`) cannot be resolved by the tool alone; they require a human to open Supabase production and verify the table and RLS state.

**Mitigation:** Baseline entries are time-bounded (review 2026-08-08, expiry 2026-10-07). The monitoring runbook documents the verification steps.

---

### L2 — Dependency Architecture Score is Low (41/100)
The Dependency Architecture category carries 20% weight and scores 41/100 due to 105 findings: 5 circular import cycles and 100 cross-domain dependency observations. All 5 cycles are classified as acceptable shared-layer cycles (`design-system/themes/index.ts`, `lib/types/status.ts`). The cross-domain observations are low-severity crew-portal pages importing from finance/earnings domains.

**Impact:** This is the primary suppressor of the overall 80/100 score. Without it, the weighted score would be in the 90s.

**Mitigation:** The cycles are documented, classified, and non-blocking. The enforcement mode `block_on_critical` does not fail on dependency findings. Resolution would require refactoring shared type layers into leaf modules — a planned roadmap item.

---

### L3 — Atlas Requires Manual Maintenance
The Business Capability Atlas is a manually maintained markdown document. If a new capability, route, or agent is added to the codebase without updating the atlas, it appears as `repo_api_unmapped` or `repo_agent_unmapped`. These are low-severity findings but accumulate over time if the atlas is not kept current.

**Impact:** Currently 12 `repo_api_unmapped` findings, mostly new admin/Docusign routes not yet catalogued in the atlas.

**Mitigation:** These are advisory-only (low severity) and do not trigger the `block_on_critical` gate. Roadmap item R2 addresses atlas automation.

---

### L4 — No Runtime Verification
The tool does not verify that discovered routes actually respond correctly, that migrations have been applied to production, or that environment variables are set in Vercel. It only verifies that the code and migrations exist in the repository.

**Impact:** A migration that exists locally but was never applied to production would appear as resolved by the tool.

**Mitigation:** Separate from Architecture Doctor's scope. Production verification is a deployment and operations concern.

---

### L5 — Single Clean Advisory Cycle Observed
The `releaseCycleObserved` flag was set after 8 runs across one day (2026-07-09), all at the same git commit. Strictly speaking, this is 8 runs of the same snapshot, not 8 releases. The flag's intent is to confirm a stable advisory period before blocking is enabled.

**Impact:** The prerequisite technically reflects stability over a single day, not across real releases.

**Mitigation:** This is acceptable for v1.0 given zero criticals and stable scores. The monitoring plan (Phase 22) specifies what to verify after the first real protected PR.

---

### L6 — `architecture-health.json` is Large
The report JSON file is ~735KB due to including all 186 findings with full evidence and source paths. This can slow diff operations and make the file impractical to open in editors.

**Impact:** File cannot be fully read in a single tool call; must be paged.

**Mitigation:** All human-readable summary data is in `architecture-drift-report.md` and `architecture-doctor-pr-summary.md`. The JSON is for machine consumers only.

---

### L7 — Documentation Score is 73/100
The Documentation category (15% weight) scores 73/100 from 27 findings, primarily `atlas_api_missing` for `/api/leads` (high severity) and `atlas_page_missing` for `/portal/ratings` (medium severity) plus `cron_route_unregistered` for `/api/cron/vercel-repair`.

**Impact:** These are advisory findings, not blockers. The high-severity `/api/leads` finding is a planned route not yet implemented.

**Mitigation:** When `/api/leads` is built or removed from the atlas, the documentation score will improve.

---

## Roadmap

Items are ordered by estimated value, not by implementation priority. None are required for v1.0.

### R1 — Block on Threshold (v1.1)
Promote `enforcementMode` from `block_on_critical` to `block_on_threshold` after observing at least one complete release cycle (real PRs merged with the gate active) at the `block_on_critical` level. Requires no code changes; only an enforcement config update and architecture-owner sign-off.

**Trigger:** After 2–4 weeks of clean advisory PRs with the blocking dry-run as a required gate.

---

### R2 — Atlas Auto-Update from Scan
Add a `--sync-atlas` mode that generates a draft atlas diff when new `repo_api_unmapped` or `repo_agent_unmapped` findings are detected. The draft would stage additions to the atlas document for human review rather than requiring manual atlas edits.

**Value:** Reduces the atlas maintenance burden and prevents documentation-score drift as the platform grows.

---

### R3 — Dependency Architecture Remediation
Resolve the 5 acceptable shared-layer cycles by extracting shared types into dedicated leaf modules:
- `src/lib/design-system/themes/index.ts` cycles → extract color/token primitives to `src/lib/design-system/tokens.ts`
- `src/lib/types/status.ts` cycle → ensure status types have no upward imports

**Value:** Would raise the Dependency Architecture score from 41/100, improving overall score by ~10 points.
**Constraint:** Requires a refactor batch with full downstream import updates. Low urgency; score is stable.

---

### R4 — Production Supabase Verification Integration
Add an optional `--verify-production` mode that calls the Supabase Management API to confirm table existence and RLS enablement for baseline entries marked `needs_manual_review`. Output the verification result alongside the baseline entry in reports.

**Value:** Would close L1 and allow `ndis_roles` baseline entries to be resolved automatically after production confirms coverage.
**Constraint:** Requires Supabase Management API key in CI environment and careful scoping to read-only checks.

---

### R5 — Capability Atlas Versioning
Add a version field and date stamp to the Business Capability Atlas document, and track atlas version in `architecture-health.json`. When the atlas version changes between runs, surface it prominently in the drift report summary.

**Value:** Makes it visible when architecture drift findings are caused by an atlas update vs a codebase change.

---

### R6 — Cross-Run History Dashboard
Add a lightweight HTML or markdown summary of Architecture Doctor score history across all release cycle observations, making score trends visible over weeks and months without reading raw JSON.

**Value:** Supports strategic architecture health conversations without requiring JSON analysis.

---

### R7 — Per-Capability Health Drill-Down
Extend the drift report to include a per-capability section showing each capability's individual score contribution, findings count, RLS coverage, and dependency health. Currently the report is flat; capability-level drill-down would help owners understand their specific exposure.

**Value:** Enables capability owners to take targeted ownership of findings in their domain without reading the full 186-finding report.
