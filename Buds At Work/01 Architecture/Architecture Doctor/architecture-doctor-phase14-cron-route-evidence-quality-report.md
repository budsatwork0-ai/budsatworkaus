# Architecture Doctor Phase 14 Evidence Quality Report

Generated: 2026-07-11T04:21:10.946Z
Detector: cron-route-registration

## Authority

- v1 decides.
- v2 learns.
- v1 remains the only authoritative detector.
- Phase 12, Phase 13, and Phase 14 outputs are advisory only.
- v2 evidence does not affect authoritative findings, health score, enforcement, reports, CI outcomes, process exit codes, or production behaviour.
- No automatic promotion or replacement occurred.

## Evidence Summary

- Total historical runs: 10
- Comparable runs: 5
- Independent runs: 2
- Duplicate-state runs: 2
- Unique commits: 1
- Unique fingerprints: 3
- Clean states: 0
- Dirty states: 5
- Unknown states: 0
- Unknown or missing metrics: 7
- Rejected records: 8
- Evidence defects: 17
- Evidence quality score: 0

## Readiness

- Status: continue_shadow
- Replacement approved: false
- Ready for replacement: false

## Blockers

- incomplete_detector_execution: Record did not complete comparable v1/v2 shadow execution.
- legacy_record_missing_metrics: Legacy record lacks explicit difference-count metrics.
- legacy_record_missing_metrics: Legacy record lacks explicit difference-count metrics.
- incomplete_detector_execution: Record did not complete comparable v1/v2 shadow execution.
- legacy_record_missing_metrics: Legacy record lacks explicit difference-count metrics.
- duplicate_repository_state: Run repeats an unchanged repository fingerprint.
- legacy_record_missing_metrics: Legacy record lacks explicit difference-count metrics.
- incomplete_detector_execution: Record did not complete comparable v1/v2 shadow execution.
- legacy_record_missing_metrics: Legacy record lacks explicit difference-count metrics.
- incomplete_detector_execution: Record did not complete comparable v1/v2 shadow execution.
- legacy_record_missing_metrics: Legacy record lacks explicit difference-count metrics.
- incomplete_detector_execution: Record did not complete comparable v1/v2 shadow execution.
- legacy_record_missing_metrics: Legacy record lacks explicit difference-count metrics.
- duplicate_repository_state: Run repeats an unchanged repository fingerprint.
- insufficient_repository_diversity: Only 1 unique commit(s) observed; 2 required.
- insufficient_independent_runs: Only 2 independent run(s) observed; 5 required.
- insufficient_observation_period: Comparable evidence spans 3.6038 hour(s); 24 required.
- Replacement requires explicit governance approval in a later phase; Phase 14 cannot approve replacement.

## Defects

- incomplete_detector_execution: Record did not complete comparable v1/v2 shadow execution. Impact: Record cannot count as independent readiness evidence.
- legacy_record_missing_metrics: Legacy record lacks explicit difference-count metrics. Impact: Missing metrics are unknown and cannot increase readiness confidence.
- legacy_record_missing_metrics: Legacy record lacks explicit difference-count metrics. Impact: Missing metrics are unknown and cannot increase readiness confidence.
- incomplete_detector_execution: Record did not complete comparable v1/v2 shadow execution. Impact: Record cannot count as independent readiness evidence.
- legacy_record_missing_metrics: Legacy record lacks explicit difference-count metrics. Impact: Missing metrics are unknown and cannot increase readiness confidence.
- duplicate_repository_state: Run repeats an unchanged repository fingerprint. Impact: Duplicate-state runs are tracked but do not count as independent evidence.
- legacy_record_missing_metrics: Legacy record lacks explicit difference-count metrics. Impact: Missing metrics are unknown and cannot increase readiness confidence.
- incomplete_detector_execution: Record did not complete comparable v1/v2 shadow execution. Impact: Record cannot count as independent readiness evidence.
- legacy_record_missing_metrics: Legacy record lacks explicit difference-count metrics. Impact: Missing metrics are unknown and cannot increase readiness confidence.
- incomplete_detector_execution: Record did not complete comparable v1/v2 shadow execution. Impact: Record cannot count as independent readiness evidence.
- legacy_record_missing_metrics: Legacy record lacks explicit difference-count metrics. Impact: Missing metrics are unknown and cannot increase readiness confidence.
- incomplete_detector_execution: Record did not complete comparable v1/v2 shadow execution. Impact: Record cannot count as independent readiness evidence.
- legacy_record_missing_metrics: Legacy record lacks explicit difference-count metrics. Impact: Missing metrics are unknown and cannot increase readiness confidence.
- duplicate_repository_state: Run repeats an unchanged repository fingerprint. Impact: Duplicate-state runs are tracked but do not count as independent evidence.
- insufficient_repository_diversity: Only 1 unique commit(s) observed; 2 required. Impact: Repository diversity is insufficient for readiness.
- insufficient_independent_runs: Only 2 independent run(s) observed; 5 required. Impact: Independent evidence threshold is not met.
- insufficient_observation_period: Comparable evidence spans 3.6038 hour(s); 24 required. Impact: Immediate repeated runs cannot establish longitudinal stability.

## Why Replacement Is Not Yet Justified

- Phase 14 is evidence governance only and cannot approve replacement.
- Replacement requires a later explicit governance decision outside this advisory layer.
