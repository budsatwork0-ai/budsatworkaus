# Architecture Doctor — Reference Architecture

Version: 1.0
Status: Reference Architecture
Date: 2026-07-09
Constitutional authority: Architecture Doctor — Vision & Principles v1.0

---

## 1. Constitutional Frame

Architecture Doctor is a continuous architectural truth verification platform. Its reference architecture exists to make the gap between declared architectural intent and observed system reality visible, measurable, explainable, attributable, and closeable.

This document does not introduce new product doctrine. It translates the approved Vision & Principles into permanent platform building blocks.

The architecture is governed by these constitutional commitments:

- Intent is primary; structure is evidence.
- Governance moves at development speed.
- The business capability is the unit of architecture.
- Architecture is temporal.
- Governance decisions are attributable.
- Findings require recommended action.
- The system is a living model, not a report.
- Human judgment remains the authority ceiling.
- Findings belong to the knowledge graph, not to reports.

---

## 2. Architectural Thesis

Architecture Doctor is composed of nine permanent layers:

1. Intent Layer
2. Evidence Pipeline
3. Verification Engines
4. Shared Architectural Data Model
5. Knowledge Graph Integration
6. Governance Model
7. Reasoning Layer
8. Reporting and Delivery Layer
9. Extension and Plugin System

These layers form a continuous loop:

Declared intent is externalised, evidence is collected, reality is verified against intent, findings and decisions become durable knowledge, humans govern the outcome, and every result is delivered back into the workflows where architectural decisions are made.

Trace: Mission; Purpose; Philosophy 3.1, 3.2, 3.3, 3.7, 3.8; Principles 4, 5, 8.

---

## 3. Permanent Building Blocks

### 3.1 Intent Layer

The Intent Layer holds the declared architectural expectations Architecture Doctor verifies against.

Permanent responsibilities:

- Represent the Business Capability Atlas as the platform's declared architectural intent.
- Represent capabilities, business loops, owners, expected system assets, architectural patterns, control expectations, and known exceptions.
- Treat Atlas discrepancies as investigation signals, not automatic proof of failure.
- Preserve the difference between declared intent, observed reality, and human-governed exceptions.

Constitutional trace:

- Philosophy 3.1: intent is primary; structure is evidence.
- Philosophy 3.3: the business capability is the unit of architecture.
- Principle 6: the Atlas is always slightly wrong.
- Design Goal: a new engineer understands the system from Architecture Doctor alone.
- Section 12: the Business Capability Atlas is the shared source of truth.

Architectural decisions:

- Architecture Doctor never treats files, routes, tables, agents, or services as the primary unit of concern. They are evidence attached to capabilities.
- The Atlas is authoritative as declared intent, but not infallible as observed truth.
- Every verification result must identify the capability or business loop it affects, or explicitly state that ownership is unresolved.

### 3.2 Evidence Pipeline

The Evidence Pipeline continuously collects, normalises, classifies, and timestamps evidence about system reality.

Permanent responsibilities:

- Collect structural evidence from code, configuration, schema, route, policy, dependency, agent, and deployment surfaces.
- Preserve provenance for each evidence item: source, scan moment, confidence, extraction method, and limitations.
- Support future behavioural, runtime, production state, and compliance evidence without replacing static analysis.
- Convert raw observations into capability-linked evidence records.

Constitutional trace:

- Philosophy 3.1: structure is evidence.
- Philosophy 3.2: governance must move at the speed of development.
- Philosophy 3.4: architecture has a temporal dimension.
- Principle 7: static analysis is the floor, not the ceiling.
- Design Goal: auditor can generate a compliance report without human preparation.
- Section 9: evolve from structural to behavioural.

Architectural decisions:

- Static analysis is the always-on baseline evidence source.
- Runtime and behavioural evidence are additive confidence layers, not replacements for structural verification.
- Evidence without provenance is not admissible for critical findings.
- Evidence must be timestamped so architectural state can be understood historically, not only currently.

### 3.3 Verification Engines

Verification Engines compare intent against evidence and produce architectural findings, score changes, and impact assessments.

Permanent engines:

- Capability Verification Engine: verifies whether each business capability has the expected assets, owners, controls, dependencies, and operational shape.
- Drift Detection Engine: identifies divergence between declared intent and observed reality.
- Ownership Verification Engine: detects missing, stale, ambiguous, or over-concentrated ownership.
- Structural Security Verification Engine: verifies architectural security properties such as access boundaries, control coverage, data classification alignment, and policy presence.
- Agent Governance Engine: verifies that agents are declared, purposeful, permissioned, bounded, and owned.
- Dependency and Impact Engine: maps dependencies among capabilities, business loops, assets, owners, and governance obligations.
- Temporal Health Engine: maintains health history, trajectory, rate of change, and regression or improvement patterns.
- Compliance Readiness Engine: converts evidence and control coverage into audit-ready architectural posture.
- PR and Change Impact Engine: evaluates proposed changes before merge and estimates affected capabilities, findings, ownership implications, and score movement.

Constitutional trace:

- Mission: make the gap visible, measurable, and closeable at every development stage.
- Philosophy 3.2: governance must move at development speed.
- Philosophy 3.3: business capability is the unit of architecture.
- Philosophy 3.4: architecture has a temporal dimension.
- Principle 2: precision over recall in critical findings.
- Principle 3: blame-free, owner-aware.
- Principle 7: static analysis is the floor, not the ceiling.
- Section 10: decisions Architecture Doctor should help engineers make.
- Section 12: Architecture Doctor governs routes, agents, capabilities, and platform assets.

Architectural decisions:

- Engines produce findings only when they can explain the affected capability, evidence basis, confidence, risk, and recommended action.
- Critical findings require deterministic or very high-confidence evidence.
- Lower-severity findings may use broader heuristics if uncertainty is explicit.
- Engines do not assign personal blame. They route findings to capability ownership.
- Engines do not perform code quality analysis, vulnerability scanning, operational monitoring, or project management.

### 3.4 Shared Architectural Data Model

The Shared Architectural Data Model defines the durable concepts that all engines, reports, governance workflows, and graph integrations use.

Permanent entities:

- Capability: the primary architectural unit, representing business value and architectural ownership.
- Business Loop: an end-to-end value path across capabilities.
- System Asset: a route, table, service, module, agent, policy, workflow, data store, integration, or other observable system element.
- Evidence Item: a sourced observation about system reality.
- Finding: a verified gap, risk, drift, missing control, unresolved ownership issue, or architectural inconsistency.
- Recommendation: the action context required to make a finding closeable.
- Owner: a human or accountable group responsible for a capability or governance decision.
- Governance Decision: an attributed human decision such as accepting a finding, creating a baseline, changing enforcement mode, approving an exception, or amending policy.
- Baseline: a temporary acknowledged finding with rationale, owner, expiry, and review path.
- Exception: a bounded, attributed divergence from normal governance expectations.
- Enforcement Mode: advisory, warn, or block state for a finding type, capability, or governance surface.
- Health State: current capability-level and platform-level architectural health.
- Health Trajectory: historical direction, velocity, and forecast of health.
- Control: a structural or behavioural expectation relevant to security, compliance, ownership, reliability, or architectural integrity.
- Explanation: audience-specific rendering of the architectural meaning of a finding or state.
- Knowledge Graph Node: the durable representation of architectural knowledge.

Constitutional trace:

- Philosophy 3.3: business capability is the unit of architecture.
- Philosophy 3.4: architecture has a temporal dimension.
- Philosophy 3.5: governance decisions must be attributable.
- Philosophy 3.6: findings need recommended actions.
- Principle 5: baselines are temporary acknowledgments.
- Principle 8: findings belong to the knowledge graph.
- Engineering Values: ownership as commitment, learning as output, transparency in trade-offs.

Architectural decisions:

- Findings are not complete unless linked to evidence, capability impact, confidence, owner context, and recommended action.
- Governance decisions are first-class data, not metadata.
- Baselines and exceptions must expire or be reviewed.
- Health is both current state and trajectory.
- Explanations are part of the data model because Architecture Doctor must serve engineers, leaders, auditors, and non-technical stakeholders.

### 3.5 Knowledge Graph Integration

The Knowledge Graph Integration makes Architecture Doctor a producer and consumer of durable architectural memory.

Permanent responsibilities:

- Publish findings, evidence, capability states, decisions, exceptions, ownership relationships, dependencies, lessons, and health trajectories into Graphify.
- Query historical architectural knowledge when explaining findings, assessing change impact, identifying repeated patterns, or producing reports.
- Preserve relationships among capabilities, assets, owners, controls, decisions, incidents, exceptions, and outcomes.
- Treat reports as renderings of graph knowledge, not as the source of truth.

Constitutional trace:

- Principle 8: findings belong to the knowledge graph, not to reports.
- Philosophy 3.7: the system is a living entity, not a snapshot.
- Section 8 Phase 3: architectural memory of the organisation.
- Section 9: from reports to knowledge.
- Section 12: Graphify is the brain.
- Section 14: AI as historian.

Architectural decisions:

- The knowledge graph is the long-term architectural memory.
- Architecture Doctor must not strand findings in markdown, JSON, CI output, or dashboard-only state.
- Every reportable fact should have an equivalent durable graph representation.
- Historical graph knowledge is admissible for explanation, trend analysis, and advisory reasoning, but not for unsupported critical claims.

### 3.6 Governance Model

The Governance Model defines how humans accept, defer, enforce, override, or amend architectural findings and policies.

Permanent responsibilities:

- Preserve every governance action with actor, timestamp, rationale, scope, affected capability, and review path.
- Support progressive enforcement from advisory to warn to block.
- Require human approval for consequential decisions.
- Ensure baselines and exceptions are temporary, reviewed, and owned.
- Make ownership operational by routing findings, requiring owner review, and recording owner decisions.

Constitutional trace:

- Philosophy 3.5: all governance decisions must be attributable.
- Philosophy 3.8: human judgment is irreplaceable.
- Principle 3: blame-free, owner-aware.
- Principle 4: progressive enforcement.
- Principle 5: baselines are temporary acknowledgments.
- Engineering Values: ownership as commitment; transparency in trade-offs.
- Non-Goal: not an autonomous agent.

Architectural decisions:

- Architecture Doctor may advise, explain, route, and recommend. It may not autonomously accept baselines, close exceptions, change enforcement mode, or perform consequential remediation.
- Enforcement cannot jump directly to blocking without an advisory and warning history unless the constitutionally required evidence threshold is met and human governance approves the transition.
- Anonymous exceptions are invalid.
- Undated baselines are invalid.
- Governance records are permanent architectural memory.

### 3.7 Reasoning Layer

The Reasoning Layer turns verified architectural knowledge into explanations, impact assessments, prioritisation signals, and learning.

Permanent responsibilities:

- Explain why a finding matters technically and in business terms.
- Identify root-cause patterns across multiple findings.
- Estimate affected capabilities and business loops for proposed changes.
- Track recurring governance patterns and convert them into learning artifacts.
- Support future predictive advice using historical evidence and transparent uncertainty.
- Use AI only as an interpreter, historian, simulation partner, documentation author, or triage assistant.

Constitutional trace:

- Philosophy 3.6: findings without recommended actions are alarms, not governance.
- Engineering Values: learning as a first-class output; transparency in trade-offs.
- Design Goal: system can explain any finding to a non-technical stakeholder.
- Section 8 Phase 2: predictive advisor.
- Section 14: AI as interpreter, historian, simulation partner, documentation author, and triage assistant.
- Section 15: feature admission requires attribution, noise discipline, limitation honesty, reversibility, and understandability.

Architectural decisions:

- The Reasoning Layer does not determine governance truth by itself. It interprets verified data.
- AI-generated explanations must be grounded in structured Architecture Doctor data.
- AI cannot determine critical severity, accept baselines, change enforcement mode, or make unsupported business value claims.
- Every recommendation must include risk context, remediation shape, likely effort band, confidence, and uncertainty.

### 3.8 Reporting and Delivery Layer

The Reporting and Delivery Layer renders architectural knowledge for the audience and decision moment.

Permanent delivery surfaces:

- Developer Workflow Surface: PR comments, CI results, editor context, and change impact summaries.
- Leadership Dashboard Surface: capability health, trajectory, ownership, risk, and business impact.
- Compliance Surface: control coverage, data classification, access control posture, policy evidence, and audit trail.
- Knowledge Explorer Surface: graph-backed answers about architecture history, dependencies, decisions, and rationale.
- Governance Surface: baselines, exceptions, approvals, enforcement modes, and pending human decisions.
- Learning Surface: recurring patterns, rationales, remediation examples, and convention evolution.

Constitutional trace:

- Philosophy 3.2: governance must move at development speed.
- Philosophy 3.6: findings require recommended actions.
- Principle 1: truth over comfort.
- Principle 3: blame-free, owner-aware.
- Principle 8: findings belong to the knowledge graph, not reports.
- Design Goals: new engineer understanding, audit readiness, director business view, PR impact awareness, non-technical explanations.
- Section 12: developer workflow is primary delivery surface; dashboard is strategic view.
- Section 13: context, not verdicts; teach through findings; reduce archaeology.

Architectural decisions:

- Reports are projections of graph-backed architectural knowledge.
- Each report must be audience-aware without changing the underlying truth.
- Developer-facing output prioritises affected capability, evidence, confidence, and next action.
- Leadership-facing output prioritises capability health, trend, ownership, risk, and cost of inaction.
- Compliance-facing output prioritises evidence provenance, control coverage, decision history, and auditability.

### 3.9 Extension and Plugin System

The Extension and Plugin System allows Architecture Doctor to evolve without weakening its constitutional guarantees.

Permanent responsibilities:

- Admit new evidence sources, verification engines, report renderers, governance integrations, and graph enrichers.
- Require every extension to declare its capability scope, evidence type, confidence model, limitations, noise budget, reversibility, and graph outputs.
- Prevent extensions from bypassing human authority, attribution, baseline expiry, or progressive enforcement.
- Keep Architecture Doctor evolvable as the system grows.

Constitutional trace:

- Section 9: Architecture Doctor evolves from reports to knowledge, discovery to ownership, static to temporal, structural to behavioural, local to integrated.
- Principle 2: precision over recall in critical findings.
- Principle 4: progressive enforcement.
- Principle 7: static analysis is the floor, not the ceiling.
- Principle 8: findings belong to the knowledge graph.
- Section 15: every future feature must satisfy mission fit, capability orientation, attribution, human authority ceiling, noise budget, limitation honesty, durable knowledge, reversibility, scale, and understandability.

Architectural decisions:

- No plugin may emit an enforceable finding without evidence provenance, capability mapping, confidence, and explanation.
- No plugin may create permanent exceptions or irreversible governance state without explicit human approval.
- Plugins that only produce ephemeral reports are incomplete unless their outputs are also graph-representable.
- A plugin that cannot explain its limitations cannot be trusted for default-on governance.

---

## 4. Core Architectural Flows

### 4.1 Continuous Verification Flow

1. The Intent Layer exposes declared capability expectations.
2. The Evidence Pipeline collects and timestamps observed reality.
3. Verification Engines compare intent and evidence.
4. Findings, health changes, and recommendations are generated.
5. The Knowledge Graph Integration persists the result.
6. The Reporting Layer renders the result to the right audience.
7. The Governance Model records human decisions.
8. The Temporal Health Engine updates trajectory.

Trace: Mission; Philosophy 3.2, 3.4, 3.7; Principles 1, 3, 8.

### 4.2 PR Impact Flow

1. A proposed change is analysed before merge.
2. Affected assets are mapped to capabilities and business loops.
3. Existing capability health, ownership, findings, and dependencies are retrieved.
4. The change impact is estimated.
5. The developer receives context, confidence, risks, and recommended action.
6. Any governance decision is attributed and preserved.

Trace: Design Goal: developer understands architectural impact before merging; Philosophy 3.2; Principle 4; Section 13.

### 4.3 Governance Decision Flow

1. A finding, enforcement change, baseline, exception, or policy question is presented with evidence and impact.
2. The responsible human owner reviews the context.
3. The decision is recorded with actor, rationale, timestamp, scope, expiry or review path, and affected capability.
4. The knowledge graph stores the decision as architectural memory.
5. Future scans and reports account for the decision without erasing the underlying truth.

Trace: Philosophy 3.5, 3.8; Principles 4, 5; Engineering Values: transparency in trade-offs.

### 4.4 Knowledge Graph Memory Flow

1. Every finding, evidence item, owner relationship, capability state, decision, and lesson is written as graph knowledge.
2. Reports query graph knowledge rather than standalone files.
3. Historical patterns inform explanations, triage, forecasting, and impact analysis.
4. The graph becomes the durable architectural memory of the organisation.

Trace: Principle 8; Section 8 Phase 3; Section 9 from reports to knowledge; Section 12 Graphify.

---

## 5. Governance Boundaries

Architecture Doctor may:

- Observe architectural reality.
- Compare reality to declared intent.
- Produce findings.
- Recommend action.
- Explain technical and business impact.
- Route findings to owners.
- Track governance decisions.
- Render reports and dashboards.
- Forecast or simulate impact when uncertainty is explicit.

Architecture Doctor may not:

- Change production systems autonomously.
- Deploy code.
- Modify production data.
- Accept or close baselines without human confirmation.
- Change enforcement modes without human governance.
- Report critical findings without deterministic or very high-confidence evidence.
- Replace architectural judgment.
- Manage project delivery workflows.
- Duplicate code quality, vulnerability scanning, or operations monitoring tools.

Trace: Philosophy 3.8; Non-Goals; Principle 2; Section 14 AI boundaries.

---

## 6. Required Invariants

These invariants must hold across all Architecture Doctor layers:

- Every finding belongs to a capability, business loop, or explicit unresolved-ownership state.
- Every finding has evidence.
- Every evidence item has provenance.
- Every critical finding has high-confidence support.
- Every finding has recommended action.
- Every governance decision is attributable.
- Every baseline has rationale, owner, expiry, and review path.
- Every exception has scope, rationale, owner, and review path.
- Every reportable fact can become graph knowledge.
- Every score has current state and historical context.
- Every automated action respects the human authority ceiling.
- Every extension satisfies the future-feature admission principles.

Trace: Mission; Philosophy 3.1 through 3.8; Principles 1 through 8; Section 15.

---

## 7. Extension Points

Architecture Doctor supports the following permanent extension points:

- Evidence Source Extensions: add new ways to observe system reality.
- Verification Engine Extensions: add new capability-level architectural checks.
- Control Model Extensions: add new compliance, security, reliability, or ownership controls.
- Graph Schema Extensions: add new architectural knowledge relationships.
- Report Renderer Extensions: add new audience-specific renderings.
- Governance Integration Extensions: connect findings and decisions to approved human workflows.
- AI Reasoning Extensions: add grounded explanation, triage, historical patterning, or simulation support.
- Delivery Surface Extensions: surface Architecture Doctor context inside developer, leadership, audit, or knowledge workflows.

Each extension point is constrained by the same admission rules:

- It must serve the mission.
- It must operate at capability level.
- It must be attributable.
- It must respect human authority.
- It must earn its noise budget.
- It must be honest about limitations.
- It must produce durable knowledge.
- It must be reversible.
- It must scale with the architecture.
- It must be understandable without reading source code.

Trace: Section 15.

---

## 8. Reference Architecture Summary

Architecture Doctor is not a scanner, report generator, code quality tool, security scanner, monitoring platform, autonomous agent, or project management tool.

It is a living architectural governance system whose permanent responsibility is to maintain a truthful, temporal, capability-centred, graph-backed model of the gap between architectural intent and system reality.

Its core architectural contract is:

- The Atlas declares intent.
- The Evidence Pipeline observes reality.
- The Verification Engines measure the gap.
- The Shared Data Model preserves meaning.
- Graphify preserves memory.
- Governance preserves human judgment.
- The Reasoning Layer makes findings understandable and closeable.
- Reports render knowledge for specific decisions.
- Plugins extend the system only within constitutional bounds.

Every part of the architecture exists to fulfill the founding mission: make architectural drift visible, measurable, and closeable at every stage of the development lifecycle.
