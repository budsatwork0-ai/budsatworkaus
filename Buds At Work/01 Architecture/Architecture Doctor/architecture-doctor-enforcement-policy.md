# Architecture Doctor Enforcement Policy

Date: 2026-07-09

Status: Draft policy. Blocking CI is not enabled.

## Purpose

Architecture Doctor enforcement exists to turn advisory architecture evidence into a future release gate only after the repository has stable signal quality, reviewed baselines, and an observed advisory release cycle.

## Enforcement Levels

| Mode | Behavior | Intended use |
|---|---|---|
| `advisory` | Never fails because of Architecture Doctor findings. Findings, score, baseline state, and enforcement readiness are reported only. | Current default for local and CI report generation. |
| `warn_only` | Evaluates the configured gates and reports whether blocking would have occurred, but never fails. | Dry run before any blocking mode. |
| `block_on_critical` | Fails only when unresolved critical findings exist and blocking prerequisites are satisfied. | First future blocking mode after advisory evidence is stable. |
| `block_on_threshold` | Fails only when the health score is below `minimumHealthScore` and blocking prerequisites are satisfied. | Later maturity gate after score calibration is agreed. |

## Config Format

Architecture Doctor reads `architecture-doctor-enforcement.json` from the report output directory by default.

```json
{
  "enforcementMode": "advisory",
  "minimumHealthScore": 80,
  "failOnCritical": false,
  "failOnExpiredBaseline": false,
  "releaseCycleObserved": false,
  "scoreThresholdAgreed": false
}
```

## Policy Rules

- `advisory` never fails.
- `warn_only` never fails.
- `block_on_critical` can fail only for unresolved critical findings.
- `block_on_threshold` can fail only when `healthScore < minimumHealthScore`.
- Expired baseline findings can fail only when `failOnExpiredBaseline` is explicitly `true`.
- Blocking is disabled when `releaseCycleObserved` is `false`.
- Blocking is disabled while the enforcement-readiness checklist has missing items.
- The agreed minimum health score threshold is `80`; set `scoreThresholdAgreed` to `true` only after this decision is explicitly recorded.
- GitHub Actions must remain advisory-only until a separate phase explicitly promotes enforcement.

## Current Status

Current default enforcement mode is `advisory`. The advisory workflow may fail for dependency installation, typecheck, unit-test, or Architecture Doctor command crashes, but it must not fail on Architecture Doctor findings.
