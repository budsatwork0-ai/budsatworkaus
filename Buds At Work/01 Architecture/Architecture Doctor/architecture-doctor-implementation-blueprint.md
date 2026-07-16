# Architecture Doctor - Implementation Blueprint

Version: 1.0
Status: Implementation Blueprint
Date: 2026-07-10
Constitutional authority: Architecture Doctor Constitution v1.0

Constitution documents:

- Architecture Doctor - Vision & Principles v1.0
- Architecture Doctor - Reference Architecture v1.0
- Architecture Doctor - Canonical Domain Model v1.0
- Architecture Doctor - Reasoning Model v1.0

---

## 1. Purpose

This document defines the implementation strategy for Architecture Doctor v2.0 as an incremental 12-24 month programme.

It does not write production code. It does not redesign the architecture. It translates the approved constitution into a build sequence that preserves constitutional principles, proves the core reasoning model early, and avoids premature optimisation.

The programme is guided by five implementation commitments:

- Build the smallest trustworthy core before adding breadth.
- Preserve the reasoning chain from intent to learning in every milestone.
- Keep static analysis as the always-on foundation.
- Treat graph-backed knowledge as the destination, even when transitional outputs still exist.
- Keep all enforcement progressive and human-governed.

Trace:

- Vision Mission: make the gap between architectural intent and system reality visible, measurable, and closeable.
- Vision Principle 2: precision over recall in critical findings.
- Vision Principle 4: progressive enforcement.
- Vision Principle 7: static analysis is the floor, not the ceiling.
- Vision Principle 8: findings belong to the knowledge graph, not reports.
- Reference Architecture: Evidence Pipeline, Verification Engines, Knowledge Graph Integration, Governance Model, Reasoning Layer.
- Canonical Domain Model: canonical entities and plugin language compliance.
- Reasoning Model: Intent -> Observation -> Evidence -> Claim -> Finding -> Recommendation -> Governance -> Knowledge -> Learning.

---

## 2. Programme Shape

Architecture Doctor v2.0 should be built in six phases:

1. Foundation and compatibility: preserve v1.x value while introducing canonical concepts.
2. Minimum viable core: prove the complete reasoning loop with one narrow vertical slice.
3. Trusted verifier: expand core engines across capability, drift, ownership, and static structural controls.
4. Governance and knowledge maturity: make decisions, baselines, exceptions, and graph memory first-class.
5. Delivery surfaces and operational adoption: bring reasoning into PR, dashboard, audit, and owner workflows.
6. Learning and advisory maturity: add root-cause insight, historical learning, constrained AI, and predictive foundations.

The phases are sequential in trust, not strictly sequential in calendar. Exploratory work may run ahead, but no phase should become operational until its validation criteria are met.

---

## 3. Minimum Viable Core

The minimum viable core is the smallest Architecture Doctor v2.0 system that proves the constitution end to end.

It must include:

- Canonical Intent ingestion from the Business Capability Atlas.
- Static Observation collection for a narrow asset class.
- Evidence admission with provenance and confidence.
- Claim formation against declared intent.
- Finding creation with capability context, risk, confidence, and recommendation.
- Human-governed finding acknowledgement or baseline.
- Knowledge publication as graph-representable records.
- A report rendered from canonical knowledge, not treated as primary truth.
- A verification run record with scope, timepoint, participating sources, and limitations.

The minimum viable core should not include:

- Broad plugin marketplace.
- AI-generated reasoning.
- Runtime or production-state verification.
- Predictive scoring.
- Automated enforcement beyond advisory.
- Complex dashboards.
- Full compliance automation.
- Multi-repository generalisation.

Minimum viable core success test:

Architecture Doctor can take one declared capability, observe one class of related system assets, admit evidence, produce one valid finding with recommendation, record a human governance decision, preserve the result as knowledge, and render a report that traces every conclusion back to evidence.

Trace:

- Vision: trust before breadth.
- Reference Architecture 4.1: Continuous Verification Flow.
- Canonical Domain Model 17: Observation to Evidence, Evidence to Finding, Finding to Governance, Governance to Knowledge.
- Reasoning Model 3: Architectural Reasoning Lifecycle.

---

## 4. Core Engine Build Order

The engine order should follow the reasoning lifecycle and trust dependencies.

### Phase 1 Engines: Constitutional Substrate

1. Intent Registry
2. Observation Collector
3. Evidence Admission Engine
4. Provenance and Verification Run Ledger
5. Canonical Knowledge Publisher

Reason:

No verification engine can be trusted until Architecture Doctor can distinguish intent, observation, evidence, provenance, and knowledge.

### Phase 2 Engines: First Verification Loop

6. Capability Verification Engine
7. Claim and Finding Engine
8. Recommendation Engine
9. Advisory Reporting Engine
10. Governance Event Engine

Reason:

These engines prove the complete loop from declared intent to governed knowledge without requiring broad asset coverage.

### Phase 3 Engines: Trusted Static Verifier

11. Drift Detection Engine
12. Ownership Verification Engine
13. Static Structural Control Engine
14. Dependency and Impact Engine
15. Temporal Health Engine

Reason:

These engines turn the first slice into a useful v2 verifier while staying within static analysis, capability-level reasoning, and progressive enforcement.

### Phase 4 Engines: Governance and Delivery Maturity

16. Baseline and Exception Engine
17. Enforcement Mode Engine
18. PR and Change Impact Engine
19. Leadership Health Reporting Engine
20. Compliance Readiness Reporting Engine

Reason:

Once findings are trustworthy, Architecture Doctor can mature how humans govern them and how different audiences consume them.

### Phase 5 Engines: Extension and Learning

21. Plugin Contract Engine
22. Plugin Admission and Noise Budget Engine
23. Root-Cause and Insight Engine
24. Lesson Candidate Engine
25. Constrained AI Explanation and Triage Engine

Reason:

Plugins, root-cause reasoning, lessons, and AI depend on a stable canonical model, confidence discipline, and governance loop.

### Phase 6 Engines: Future Evidence Expansion

26. Runtime Evidence Adapter
27. Production State Evidence Adapter
28. Behavioural Verification Engine
29. Predictive Advisory Engine
30. Forecasting and Scenario Impact Engine

Reason:

These fulfil the long-term vision but should wait until v2.0 is trusted as a static, temporal, graph-backed verifier.

---

## 5. Engine Dependency Graph

The engine dependency graph is:

- Intent Registry -> Capability Verification Engine
- Intent Registry -> Drift Detection Engine
- Observation Collector -> Evidence Admission Engine
- Evidence Admission Engine -> Claim and Finding Engine
- Provenance and Verification Run Ledger -> Evidence Admission Engine
- Provenance and Verification Run Ledger -> Reporting Engines
- Evidence Admission Engine -> Static Structural Control Engine
- Evidence Admission Engine -> Ownership Verification Engine
- Claim and Finding Engine -> Recommendation Engine
- Claim and Finding Engine -> Temporal Health Engine
- Claim and Finding Engine -> Baseline and Exception Engine
- Recommendation Engine -> Reporting Engines
- Governance Event Engine -> Baseline and Exception Engine
- Governance Event Engine -> Enforcement Mode Engine
- Governance Event Engine -> Knowledge Publisher
- Canonical Knowledge Publisher -> Reporting Engines
- Canonical Knowledge Publisher -> Root-Cause and Insight Engine
- Canonical Knowledge Publisher -> Lesson Candidate Engine
- Capability Verification Engine -> Dependency and Impact Engine
- Ownership Verification Engine -> Dependency and Impact Engine
- Dependency and Impact Engine -> PR and Change Impact Engine
- Temporal Health Engine -> Leadership Health Reporting Engine
- Static Structural Control Engine -> Compliance Readiness Reporting Engine
- Plugin Contract Engine -> Plugin Admission and Noise Budget Engine
- Plugin Admission and Noise Budget Engine -> Plugin-provided Evidence Sources
- Root-Cause and Insight Engine -> Lesson Candidate Engine
- Knowledge Publisher -> Constrained AI Explanation and Triage Engine
- Runtime Evidence Adapter -> Behavioural Verification Engine
- Production State Evidence Adapter -> Behavioural Verification Engine
- Temporal Health Engine -> Predictive Advisory Engine
- Root-Cause and Insight Engine -> Predictive Advisory Engine

Dependency rule:

An engine may consume upstream knowledge, but it must not bypass the canonical reasoning lifecycle. Every engine output must be expressible as canonical domain entities and graph-representable knowledge.

---

## 6. First End-to-End Vertical Slice

The first vertical slice should verify one high-value capability with one static asset class and one governance outcome.

Recommended slice:

Quote or pricing capability intent from the Atlas -> static route or module observation -> evidence admission -> claim about declared capability coverage -> finding for unmapped or inconsistent asset -> recommendation -> owner acknowledgement or temporary baseline -> graph-representable knowledge -> advisory report.

Why this slice:

- It is business-capability centred.
- It uses static analysis as the floor.
- It tests Atlas intent without treating the Atlas as infallible.
- It exercises evidence, claim, finding, recommendation, governance, and knowledge.
- It produces a result meaningful to engineers and business stakeholders.
- It avoids runtime complexity, AI dependency, or broad plugin infrastructure.

Vertical slice acceptance criteria:

- The capability is declared as intent with source and scope.
- Observations are raw and distinguishable from evidence.
- Evidence has provenance, confidence, and claim linkage.
- At least one claim is supported, refuted, or contested.
- Any finding has capability context, risk, confidence, severity, and recommendation.
- The report shows traceability from conclusion to evidence.
- A human governance event can acknowledge, baseline, reject, or request revision.
- The resulting knowledge is graph-representable.
- The same inputs produce the same reasoning outcome.
- The slice runs in advisory mode only.

---

## 7. Milestones and Validation Criteria

### Milestone 0: Constitutional Readiness

Goal:

Confirm that v2 implementation starts from the constitution, not from v1.x code shape.

Deliverables:

- Approved constitution documents.
- Named canonical entities.
- Agreed first vertical slice.
- v1.x artifact inventory.
- Explicit deferral list.

Validation:

- Every planned entity maps to the Canonical Domain Model.
- Every planned reasoning step maps to the Reasoning Model.
- No planned v2 capability violates Vision non-goals.
- No implementation milestone requires autonomous consequential action.

### Milestone 1: Canonical Core

Goal:

Represent intent, observation, evidence, claim, finding, recommendation, governance event, and knowledge consistently.

Deliverables:

- Canonical domain contracts.
- Verification run record.
- Provenance model.
- Confidence and risk vocabulary.
- Knowledge publication shape.

Validation:

- Raw observation cannot be mistaken for admitted evidence.
- Findings cannot exist without evidence and recommendation.
- Critical severity cannot be emitted without required confidence.
- Governance events require actor, rationale, scope, and timepoint.
- Reports can be generated from canonical knowledge.

### Milestone 2: First Vertical Slice

Goal:

Prove the complete reasoning loop with one capability and one static evidence source.

Deliverables:

- Atlas intent ingestion for selected capability.
- Static observation collector for selected asset class.
- Evidence admission and claim formation.
- Finding and recommendation generation.
- Advisory report.
- Human governance event.
- Graph-representable knowledge output.

Validation:

- End-to-end traceability is complete.
- Contradictory or missing intent is represented honestly.
- The result is reproducible for the same inputs.
- All output remains advisory.
- The finding statement is blame-free and owner-aware.

### Milestone 3: Trusted Static Verifier

Goal:

Expand from one slice to the core static verification surface.

Deliverables:

- Capability verification.
- Drift detection.
- Ownership verification.
- Static structural controls.
- Basic dependency and impact mapping.
- Temporal health history.

Validation:

- Each engine emits canonical observations, evidence, claims, findings, and knowledge.
- False positives in high-severity findings are reviewed and below the agreed trust threshold.
- Every finding has owner context or explicit unresolved ownership state.
- Health reports include direction, not only current score.
- Findings are stored as knowledge, not report-only artifacts.

### Milestone 4: Governance Maturity

Goal:

Make human governance durable, attributable, and operational.

Deliverables:

- Baseline lifecycle.
- Exception lifecycle.
- Enforcement mode lifecycle.
- Owner review workflow.
- Governance event history.
- Expiry and review surfacing.

Validation:

- Baselines cannot be accepted without owner, rationale, scope, and expiry.
- Exceptions cannot exist without scope, owner, rationale, and review path.
- Enforcement cannot move to warn or block without governance history.
- Governance decisions do not erase findings.
- Audit trail is complete for every decision.

### Milestone 5: Delivery Surfaces

Goal:

Put architectural context where decisions happen.

Deliverables:

- Developer advisory surface.
- PR impact surface.
- Leadership capability health surface.
- Governance review surface.
- Compliance readiness report.

Validation:

- Developer output explains affected capability, evidence, risk, confidence, and next action.
- Leadership output uses capability-level language and trajectory.
- Compliance output cites evidence provenance and control status.
- Reports are rendered from graph-backed knowledge.
- Delivery surfaces respect noise budget.

### Milestone 6: Plugin System

Goal:

Allow extension without losing canonical language or trust.

Deliverables:

- Plugin contract model.
- Plugin admission lifecycle.
- Plugin confidence and limitation declarations.
- Plugin noise budget.
- Plugin knowledge mapping.
- First internal plugin beyond the core static slice.

Validation:

- No plugin can emit findings without evidence and recommendation.
- Plugin outputs are graph-representable.
- Plugin limitations are visible in reports.
- Plugin reasoning steps are classified as deterministic, heuristic, or AI-assisted.
- Plugins start in experimental or advisory mode.

### Milestone 7: Reasoning and Learning Maturity

Goal:

Move from individual findings to architectural insight and organisational learning.

Deliverables:

- Finding grouping.
- Root-cause hypothesis generation.
- Architectural insights.
- Lesson candidates.
- Historical bias controls.
- Constrained AI explanation and triage.

Validation:

- Grouped findings remain individually visible.
- Root-cause outputs distinguish hypothesis from fact.
- AI output does not increase confidence or make governance decisions.
- Lessons cite evidence and scope.
- Historical context informs but does not override current evidence.

### Milestone 8: v2.0 Operational Declaration

Goal:

Declare Architecture Doctor v2.0 operational as a trusted verifier.

Deliverables:

- Core static verifier active.
- Governance model active.
- Knowledge-backed reporting active.
- Plugin admission available for controlled extensions.
- Migration from v1.x baseline complete.
- Operational runbook and ownership declared.

Validation:

- v2.0 satisfies the success criteria in section 15.

---

## 8. What Should Be Deferred

The following should be intentionally deferred until the trusted verifier is operational:

- Autonomous remediation.
- Blocking enforcement by default.
- Runtime behaviour verification.
- Production state verification.
- Predictive forecasting.
- Broad AI reasoning.
- External plugin marketplace.
- Multi-repository generalisation beyond proven internal need.
- Comprehensive compliance automation.
- Sophisticated scoring models.
- Complex UI customisation.
- Auto-generated policy amendments.
- Automatic Atlas mutation.
- Incident correlation as a default finding source.
- Cost optimisation recommendations beyond declared agent governance.

Reason:

These capabilities are valuable later but would weaken trust if introduced before evidence discipline, governance memory, and graph-backed knowledge are stable.

Trace:

- Vision Non-Goals.
- Vision Principle 4: progressive enforcement.
- Vision Principle 7: static analysis is the floor, not the ceiling.
- Reasoning Model: deterministic wherever consequential.

---

## 9. Technical Risks and Mitigation Strategies

### Risk: Rebuilding v1.x assumptions under new names

Mitigation:

- Require every v2 entity and output to map to the Canonical Domain Model.
- Treat v1.x reports as migration inputs, not constitutional authority.

### Risk: Report-first implementation

Mitigation:

- Build knowledge publication before polished reports.
- Validate that report facts are graph-backed or graph-representable.

### Risk: False positives erode trust

Mitigation:

- Keep early findings advisory.
- Apply strict confidence thresholds.
- Track finding dismissal and correction rates.
- Promote finding types only after review.

### Risk: Atlas treated as infallible

Mitigation:

- Represent Atlas disagreement as a contradiction condition.
- Create separate outcomes for stale intent and system drift.

### Risk: Plugin inconsistency

Mitigation:

- Require plugin contracts before activation.
- Require canonical language mapping.
- Start plugins in experimental or advisory mode.

### Risk: Governance becomes metadata

Mitigation:

- Model governance events as first-class knowledge.
- Require actor, rationale, scope, and timepoint.
- Preserve superseded decisions historically.

### Risk: Knowledge graph integration becomes too heavy too early

Mitigation:

- Begin with graph-representable knowledge records.
- Mature into deeper Graphify integration after the vertical slice proves traceability.
- Keep reports transitional but never authoritative.

### Risk: AI creates unsupported certainty

Mitigation:

- Restrict AI to explanation, triage, documentation, historical pattern surfacing, and simulation support.
- Require AI outputs to cite structured data.
- Prohibit AI from severity, enforcement, baseline, exception, or policy authority.

### Risk: Scoring becomes opaque

Mitigation:

- Prefer explicit findings, confidence, risk, and trajectory before aggregate scores.
- Require score changes to explain causes.

### Risk: Scope expands before trust is earned

Mitigation:

- Enforce milestone gates.
- Defer runtime, predictive, marketplace, and broad compliance capabilities.
- Measure operational trust before increasing enforcement.

---

## 10. Testing Strategy for Architecture Doctor Itself

Architecture Doctor must test both software behaviour and constitutional behaviour.

### 10.1 Constitutional Conformance Tests

Purpose:

Verify that platform outputs obey the constitution.

Must test:

- Findings cannot exist without evidence.
- Findings cannot exist without recommendations.
- Evidence cannot exist without provenance.
- Critical findings cannot be emitted below required confidence.
- Baselines cannot exist without expiry.
- Exceptions cannot exist without scope and rationale.
- Reports are not primary knowledge.
- Plugin outputs use canonical terms.
- AI outputs cannot perform governance actions.

### 10.2 Reasoning Golden Tests

Purpose:

Verify deterministic reasoning for known scenarios.

Must test:

- Intent matches reality.
- Reality exists without Atlas intent.
- Atlas intent exists without observed reality.
- Conflicting evidence.
- Stale evidence.
- Unknown ownership.
- Accepted baseline.
- Expired baseline.
- Policy exception.
- Confidence downgrade.
- Finding reopened after new evidence.

### 10.3 Fixture-Based Static Analysis Tests

Purpose:

Verify static observation and evidence admission against controlled sample systems.

Must test:

- Asset discovery.
- Asset-to-capability mapping.
- Orphaned assets.
- Missing controls.
- Dependency detection.
- Ownership mapping.
- Provenance capture.

### 10.4 Governance Lifecycle Tests

Purpose:

Verify human decision memory and state transitions.

Must test:

- Advisory to warn to block progression.
- Baseline creation, expiry, renewal, and closure.
- Exception request, approval, review, expiry, and revocation.
- Owner transfer.
- Governance event audit trail.

### 10.5 Plugin Contract Tests

Purpose:

Verify that plugins cannot violate canonical language or reasoning invariants.

Must test:

- Missing plugin contract.
- Missing limitations.
- Missing confidence model.
- Non-graph-representable output.
- Finding without evidence.
- Critical finding from heuristic evidence.
- Autonomous governance action attempt.

### 10.6 Knowledge and Report Consistency Tests

Purpose:

Verify that reports render durable knowledge rather than creating private truth.

Must test:

- Every report fact traces to knowledge or evidence.
- Superseded findings remain historical.
- Contradictions remain queryable.
- Governance decisions remain attributable.

### 10.7 Migration Regression Tests

Purpose:

Verify that v1.x findings and baselines migrate without losing truth or creating false authority.

Must test:

- Existing findings mapped to canonical findings or archived migration records.
- Existing baselines gain required owner, rationale, expiry, and scope or are flagged for review.
- Existing reports are preserved as historical artifacts, not authoritative state.

---

## 11. Migration Strategy from v1.x to v2.0

Migration should be conservative and audit-friendly.

### 11.1 Migration Principles

- Do not discard v1.x findings.
- Do not treat v1.x reports as canonical truth.
- Do not auto-promote v1.x baselines without required governance fields.
- Preserve v1.x outputs as historical evidence or migration artifacts.
- Make unmapped v1.x concepts explicit review items.
- Run v1.x and v2.0 in parallel until v2.0 is trusted.

### 11.2 Migration Steps

1. Inventory v1.x artifacts: baseline files, enforcement files, reports, health outputs, changelogs, governance docs, release summaries, and known limitations.
2. Classify each artifact as observation, evidence candidate, finding, governance event, report, policy, or historical artifact.
3. Map v1.x finding categories to canonical Finding Types where valid.
4. Map v1.x baselines to canonical Baselines only when owner, rationale, scope, expiry, and review path can be established.
5. Preserve unmappable baselines as migration review findings.
6. Convert v1.x enforcement settings into advisory governance history, not immediate v2 blocking authority.
7. Run v2.0 vertical slice alongside v1.x outputs.
8. Compare outputs for drift, missing evidence, false positives, and missing recommendations.
9. Promote selected v2 engines from advisory to warn only after governance review.
10. Retire v1.x authoritative status once v2.0 satisfies operational success criteria.

### 11.3 Migration Validation

Migration is valid when:

- No v1.x active finding is silently dropped.
- No v1.x baseline becomes permanent by accident.
- Every migrated item has canonical type, scope, provenance, and confidence or is flagged for review.
- v2 reports can explain differences from v1.x reports.
- Governance approves the transition of authority.

---

## 12. 12-24 Month Roadmap

### Months 0-3: Foundation

Focus:

- Constitutional conformance.
- Canonical model contracts.
- v1.x artifact inventory.
- First vertical slice selection.

Exit criteria:

- Milestone 0 and Milestone 1 complete.

### Months 3-6: First Vertical Slice

Focus:

- Intent to observation to evidence to finding to recommendation to governance to knowledge.
- Advisory report.
- Reproducible reasoning.

Exit criteria:

- Milestone 2 complete.

### Months 6-9: Trusted Static Core

Focus:

- Capability verification.
- Drift detection.
- Ownership verification.
- Static structural controls.
- Basic temporal health.

Exit criteria:

- Milestone 3 complete.

### Months 9-12: Governance Maturity

Focus:

- Baselines.
- Exceptions.
- Enforcement modes.
- Owner review.
- Audit trail.

Exit criteria:

- Milestone 4 complete.

### Months 12-15: Delivery and Adoption

Focus:

- Developer advisory surfaces.
- PR impact.
- Leadership dashboard outputs.
- Compliance readiness reporting.
- Knowledge-backed reports.

Exit criteria:

- Milestone 5 complete.

### Months 15-18: Plugin Discipline

Focus:

- Plugin contracts.
- Plugin admission.
- Noise budget.
- First controlled internal plugin.

Exit criteria:

- Milestone 6 complete.

### Months 18-21: Reasoning Maturity

Focus:

- Root-cause grouping.
- Architectural insights.
- Lesson candidates.
- Historical bias controls.
- Constrained AI explanations.

Exit criteria:

- Milestone 7 complete.

### Months 21-24: v2.0 Operationalisation

Focus:

- v1.x authority retirement.
- v2 operational declaration.
- Governance review.
- Reliability hardening.
- Controlled enforcement progression.

Exit criteria:

- Milestone 8 complete.

---

## 13. Enforcement Progression

Enforcement must mature slowly:

- Months 0-6: observe and advisory only.
- Months 6-12: advisory by default; selected mature findings may become warn after governance review.
- Months 12-18: warn for trusted static verifier findings; no broad blocking.
- Months 18-24: block eligibility only for deterministic, high-confidence, high-risk findings with advisory and warn history.

Blocking is not a v2.0 success requirement. Trustworthy advisory and warn modes are more important than premature blocking.

Trace:

- Vision Principle 4: never block before informing; never enforce before advising.
- Vision Principle 2: precision over recall in critical findings.

---

## 14. Operational Ownership

Before v2.0 is operational, Architecture Doctor itself must have declared ownership.

Required ownership:

- Platform owner for Architecture Doctor.
- Governance owner for policies, baselines, exceptions, and enforcement modes.
- Capability owner for each capability under verification.
- Plugin owner for each plugin.
- Knowledge graph owner for Graphify integration.
- Reporting owner for delivery surfaces.

Ownership validation:

- No active engine without an owner.
- No active plugin without an owner.
- No governance workflow without accountable human authority.
- No finding type promoted without ownership for review and calibration.

Trace:

- Vision Principle 3: blame-free, owner-aware.
- Engineering Value: ownership as commitment.

---

## 15. Success Criteria for Architecture Doctor v2.0 Operational

Architecture Doctor v2.0 may be declared operational when all of the following are true:

- The core reasoning lifecycle is implemented end to end.
- Static analysis operates as the always-on baseline.
- Findings are capability-centred, evidence-backed, confidence-bearing, risk-aware, and recommendation-backed.
- Every reportable finding is graph-backed or graph-representable.
- Governance events are attributable and durable.
- Baselines and exceptions have owner, rationale, scope, expiry or review path.
- At least capability verification, drift detection, ownership verification, and static structural controls are active in advisory or warn mode.
- Temporal health exists for verified capabilities.
- Developer-facing output explains impact before merge for selected change types.
- Leadership-facing output shows capability health, trajectory, risk, and ownership.
- Compliance-facing output can cite evidence and control status for selected controls.
- v1.x findings and baselines have been migrated, archived, or flagged for review.
- Plugins cannot bypass canonical language, provenance, confidence, or human authority.
- AI, if present, is limited to constitutionally permitted roles.
- Reasoning outcomes are reproducible where deterministic and explicitly labelled where heuristic.
- High-severity and critical findings meet precision expectations.
- Engineering users trust advisory outputs enough to act on them.
- Governance owners approve v2.0 as the authoritative Architecture Doctor surface.

v2.0 is not required to have:

- Runtime verification.
- Predictive forecasting.
- Autonomous remediation.
- External plugin ecosystem.
- Full compliance automation.
- Broad blocking enforcement.

Operational definition:

Architecture Doctor v2.0 is operational when it is the trusted, capability-centred, graph-backed verifier of architectural intent versus system reality for the core Bud OS architecture, with human-governed findings and durable architectural memory.

---

## 16. Blueprint Summary

The Architecture Doctor v2.0 implementation programme should begin with trust, not breadth.

The first objective is a narrow end-to-end verifier that proves the constitutional chain from intent to learning. The next objective is a trusted static verifier across capability, drift, ownership, and structural controls. Only after that should Architecture Doctor expand into governance maturity, delivery surfaces, plugins, insights, AI-assisted reasoning, runtime evidence, and predictive advice.

The blueprint deliberately defers the most attractive advanced capabilities until the platform has earned trust through precision, traceability, human governance, and graph-backed memory.

The right implementation is the one that makes architectural truth visible without making Architecture Doctor noisy, opaque, autonomous, or overcomplicated before it deserves that power.
