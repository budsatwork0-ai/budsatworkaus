# Architecture Doctor — Canonical Domain Model

Version: 1.0
Status: Canonical Domain Model
Date: 2026-07-09
Constitutional authority: Architecture Doctor — Vision & Principles v1.0
Architectural authority: Architecture Doctor — Reference Architecture v1.0

---

## 1. Purpose

This document defines the ubiquitous language of Architecture Doctor.

Every future engine, plugin, report, governance workflow, graph integration, and AI reasoning surface must speak this domain language. A plugin may add domain-specific details, but it may not redefine these concepts, bypass their invariants, or emit Architecture Doctor knowledge outside this model.

This is not an implementation schema. It is the canonical conceptual model that future schemas, APIs, graph nodes, report contracts, and plugin contracts must conform to.

Trace:

- Vision Mission: make the gap between architectural intent and system reality visible, measurable, and closeable.
- Vision Philosophy 3.1: intent is primary; structure is evidence.
- Vision Philosophy 3.3: the business capability is the unit of architecture.
- Vision Philosophy 3.5: governance decisions must be attributable.
- Vision Philosophy 3.7: the system is a living entity, not a snapshot.
- Vision Principle 8: findings belong to the knowledge graph, not to reports.
- Reference Architecture 3.4: Shared Architectural Data Model.
- Reference Architecture 3.9: Extension and Plugin System.

---

## 2. Domain Boundaries

The Architecture Doctor domain is the domain of architectural truth verification.

It includes:

- Declared architectural intent.
- Observed system reality.
- Evidence derived from observation.
- Verification of reality against intent.
- Findings, recommendations, confidence, and risk.
- Capability ownership and impact.
- Governance decisions, baselines, exceptions, and enforcement states.
- Durable architectural knowledge.
- Plugin contributions that conform to the shared language.

It excludes:

- Code quality concerns whose primary unit is a function, file, or style rule.
- Vulnerability scanning whose primary output is a code-level exploit finding.
- Runtime operations monitoring whose primary concern is current service health.
- Autonomous remediation.
- Project management task ownership.

Trace:

- Vision Non-Goals.
- Vision Section 11: Architecture Doctor is a truth verification system, not a rules engine.
- Reference Architecture 5: Governance Boundaries.

---

## 3. Universal Language Rules

The following language rules are mandatory:

- "Capability" means business capability, not technical component.
- "Observation" means a raw recorded fact about system reality.
- "Evidence" means an observation or set of observations admitted for architectural reasoning.
- "Finding" means a verified architectural gap, risk, drift, missing control, or unresolved ownership issue.
- "Rule" means a verifiable expectation used by an engine or plugin.
- "Policy" means a governed architectural expectation with authority, scope, and enforcement posture.
- "Governance Event" means an attributable human or system-recorded governance action.
- "Knowledge Node" means a durable graph-backed representation of architectural knowledge.
- "Confidence" means the system's stated certainty about a claim.
- "Risk" means the potential architectural, business, compliance, ownership, reliability, or security consequence of a finding.
- "Recommendation" means the actionable context that makes a finding closeable.

No plugin may use these terms with private meanings.

Trace:

- Vision Philosophy 3.6: findings without recommended actions are alarms, not governance.
- Vision Principle 2: precision over recall in critical findings.
- Vision Principle 3: blame-free, owner-aware.
- Reference Architecture 6: Required Invariants.

---

## 4. Domain Model Overview

The model is organised into eleven entity groups:

1. Intent Entities
2. System Reality Entities
3. Verification Entities
4. Finding Entities
5. Governance Entities
6. Knowledge Graph Entities
7. Reasoning Entities
8. Reporting Entities
9. Plugin Entities
10. Temporal Entities
11. Shared Value Objects

The core relationship is:

Capability declares intent. Observation records reality. Evidence admits reality for reasoning. Rule evaluates evidence against intent. Finding records the verified gap. Recommendation makes the finding closeable. Governance Event records human judgment. Knowledge Node preserves the result. Report renders it for a decision.

Trace:

- Reference Architecture 2: Architectural Thesis.
- Reference Architecture 4.1: Continuous Verification Flow.

---

## 5. Intent Entities

### 5.1 Capability

Definition:

A Capability is the primary unit of Architecture Doctor. It represents a thing the system does that has value to a customer, operator, stakeholder, or business outcome.

Responsibilities:

- Express architectural intent at business level.
- Anchor findings, evidence, owners, controls, health, risk, and reports.
- Provide the stable language through which technical reality is translated into business meaning.
- Connect system assets to business outcomes.

Relationships:

- Has one or more Owners.
- May participate in one or more Business Loops.
- May depend on other Capabilities.
- May own or expect System Assets.
- May be governed by Policies.
- May be evaluated by Rules.
- May have Findings.
- May have Health States and Health Trajectories.
- May have Knowledge Nodes.

Lifecycle:

- Proposed: intent is emerging but not yet governed.
- Declared: present in the Atlas as intended architecture.
- Observed: evidence exists that the capability is implemented or partially implemented.
- Verified: declared intent and observed reality have been compared.
- At Risk: open findings materially affect the capability.
- Deprecated: capability is intentionally being retired.
- Retired: capability is no longer expected and should not produce active findings except historical knowledge.

Invariants:

- Every active Finding must link to a Capability, Business Loop, or explicit Unresolved Ownership state.
- Capability health must include current state and historical context.
- Capability ownership must be explicit, unknown, or disputed; it must never be silently absent.
- A Capability is not a file, service, route, table, or agent. Those are System Assets.

Trace:

- Vision Philosophy 3.3.
- Vision Principle 3.
- Reference Architecture 3.1 and 3.4.

### 5.2 Business Loop

Definition:

A Business Loop is an end-to-end value path across one or more Capabilities.

Responsibilities:

- Show how capabilities combine to produce business outcomes.
- Provide context for impact analysis.
- Translate technical drift into operational or commercial consequence.

Relationships:

- Contains or traverses Capabilities.
- Depends on System Assets.
- May have Owners.
- May have Findings when an issue affects an end-to-end outcome rather than a single Capability.
- May be represented as Knowledge Nodes.

Lifecycle:

- Declared.
- Verified.
- Degraded.
- Deprecated.
- Retired.

Invariants:

- A Business Loop must be expressible in non-technical language.
- A Business Loop finding must identify affected Capabilities or explicitly state why the impact crosses capability boundaries.

Trace:

- Vision Design Goals: business-level architectural health and non-technical explanations.
- Reference Architecture 3.4.

### 5.3 Architectural Intent

Definition:

Architectural Intent is a declared expectation about what the system should be, do, own, protect, expose, or avoid.

Responsibilities:

- Represent the intended architecture before verification.
- Provide the basis for Rules and Policies.
- Preserve the difference between what is declared, observed, and governed by exception.

Relationships:

- Belongs to a Capability, Business Loop, Policy, or Control.
- Is expressed by the Atlas, governance decisions, policies, or approved architectural records.
- Is verified through Evidence.

Lifecycle:

- Draft.
- Approved.
- Active.
- Superseded.
- Retired.

Invariants:

- Intent must have an authority source.
- Intent must have scope.
- Intent must not be treated as automatically correct when contradicted by evidence.

Trace:

- Vision Philosophy 3.1.
- Vision Principle 6.
- Reference Architecture 3.1.

### 5.4 Owner

Definition:

An Owner is a human or accountable group with continuing responsibility for a Capability, Business Loop, Policy, Control, Finding, or Governance Event.

Responsibilities:

- Provide accountable human context.
- Receive routed findings.
- Make or approve governance decisions within scope.
- Preserve ownership as commitment, not label.

Relationships:

- Owns Capabilities, Business Loops, Policies, Controls, Baselines, Exceptions, and Governance Events.
- May be required to review Findings.
- May be represented as a Knowledge Node.

Lifecycle:

- Declared.
- Active.
- Delegated.
- Transferred.
- Removed.
- Unknown.
- Disputed.

Invariants:

- Findings are owner-aware but blame-free.
- Governance decisions require an attributed actor.
- Unknown ownership is itself architectural knowledge, not a missing field.

Trace:

- Vision Principle 3.
- Vision Engineering Value: ownership as a commitment.
- Reference Architecture 3.6.

---

## 6. System Reality Entities

### 6.1 System Asset

Definition:

A System Asset is an observable element of the system that may provide evidence about architectural reality.

Examples:

- Route.
- Table.
- Schema.
- Service.
- Module.
- Agent.
- Policy.
- Workflow.
- Data store.
- Integration.
- Configuration.
- Deployment surface.
- Documented architectural record.

Responsibilities:

- Provide concrete evidence for or against architectural intent.
- Connect technical structure to Capabilities and Business Loops.
- Support dependency and impact analysis.

Relationships:

- May implement, support, expose, protect, or depend on Capabilities.
- May produce Observations.
- May be source material for Evidence.
- May be governed by Rules and Policies.
- May be represented as Knowledge Nodes.

Lifecycle:

- Discovered.
- Classified.
- Mapped.
- Verified.
- Orphaned.
- Deprecated.
- Removed.

Invariants:

- A System Asset is never the primary unit of architecture.
- Orphaned assets must be treated as investigation signals.
- Asset-to-capability mapping must include confidence or unresolved status.

Trace:

- Vision Philosophy 3.1 and 3.3.
- Reference Architecture 3.2 and 3.4.

### 6.2 Observation

Definition:

An Observation is a raw recorded fact about system reality collected at a point in time.

Responsibilities:

- Preserve what was seen before interpretation.
- Maintain provenance and collection context.
- Provide raw material for Evidence.

Relationships:

- Is produced by an Evidence Source or Plugin.
- Refers to one or more System Assets or external records.
- May become Evidence.
- May be represented as a Knowledge Node when historically meaningful.

Lifecycle:

- Collected.
- Normalised.
- Classified.
- Admitted as Evidence.
- Rejected as inadmissible.
- Superseded.
- Archived.

Invariants:

- An Observation must have source, timestamp, and collection context.
- An Observation may be true but not sufficient as Evidence.
- Observations must not directly create critical Findings without admissibility assessment.

Trace:

- Vision Philosophy 3.1.
- Vision Principle 7.
- Reference Architecture 3.2.

### 6.3 Evidence

Definition:

Evidence is an Observation, or a set of Observations, admitted for architectural reasoning because it has sufficient provenance, relevance, and confidence for a defined claim.

Responsibilities:

- Support or contradict Architectural Intent.
- Provide the factual basis for Findings, Health States, Recommendations, and Governance Events.
- Make claims auditable and explainable.

Relationships:

- Derived from one or more Observations.
- Supports or refutes one or more Claims.
- Used by Rules, Policies, Verification Engines, and Findings.
- Has Confidence.
- Has provenance.
- May be represented as a Knowledge Node.

Lifecycle:

- Candidate.
- Admitted.
- Contested.
- Superseded.
- Invalidated.
- Archived.

Invariants:

- Evidence must have provenance.
- Evidence must state what claim it supports or refutes.
- Evidence must have a confidence assessment.
- Critical Findings require deterministic or very high-confidence Evidence.
- Evidence cannot erase contradictory Evidence; contradictions become domain knowledge.

Trace:

- Vision Principle 1.
- Vision Principle 2.
- Reference Architecture 3.2 and 6.

### 6.4 Evidence Source

Definition:

An Evidence Source is a surface from which Observations are collected.

Responsibilities:

- Declare what kind of reality it can observe.
- Declare limitations and confidence implications.
- Preserve source identity for auditability.

Relationships:

- Produces Observations.
- May be provided by a Plugin.
- May be governed by a Policy.

Lifecycle:

- Proposed.
- Approved.
- Active.
- Degraded.
- Disabled.
- Retired.

Invariants:

- Evidence Sources must declare limitations.
- Source failures must be visible because they affect confidence.
- A new Evidence Source must satisfy feature admission principles.

Trace:

- Vision Section 15.
- Reference Architecture 3.9.

---

## 7. Verification Entities

### 7.1 Rule

Definition:

A Rule is a verifiable architectural expectation used to compare Evidence against Architectural Intent.

Responsibilities:

- Define what condition is being evaluated.
- Declare scope, evidence requirements, confidence behavior, and possible outcomes.
- Produce Claims, Finding Candidates, or Health Signals.

Relationships:

- Belongs to a Policy, Control, Plugin, or Verification Engine.
- Applies to Capabilities, Business Loops, System Assets, or Evidence.
- Uses Evidence.
- May produce Findings.
- May have Enforcement Modes.

Lifecycle:

- Draft.
- Advisory.
- Warn.
- Block.
- Deprecated.
- Retired.

Invariants:

- A Rule must operate in service of capability-level architectural truth.
- A Rule must declare its confidence model and limitations.
- A Rule must not emit an enforceable Finding without admissible Evidence.
- A Rule that only checks structure must explain the intent that structure evidences.

Trace:

- Vision Philosophy 3.1.
- Vision Principle 4.
- Vision Section 11: not merely a rules engine.
- Reference Architecture 3.3.

### 7.2 Policy

Definition:

A Policy is a governed architectural expectation with authority, rationale, scope, enforcement posture, and decision history.

Responsibilities:

- Express durable architectural governance expectations.
- Bind Rules and Controls to authority.
- Support progressive enforcement and attributable amendments.

Relationships:

- Contains or authorises Rules.
- Applies to Capabilities, Business Loops, System Assets, Plugins, Owners, or Controls.
- Has Governance Events.
- Has Enforcement Modes.
- May allow Baselines or Exceptions.
- May be represented as a Knowledge Node.

Lifecycle:

- Proposed.
- Approved.
- Active Advisory.
- Active Warn.
- Active Block.
- Amended.
- Superseded.
- Retired.

Invariants:

- Policy changes are Governance Events.
- Policy authority must be explicit.
- Policy enforcement must follow progressive enforcement unless exceptional human governance approves otherwise.
- Policies must be understandable without reading implementation source.

Trace:

- Vision Principle 4.
- Vision Philosophy 3.5.
- Vision Section 15.
- Reference Architecture 3.6.

### 7.3 Control

Definition:

A Control is a required architectural property relevant to security, compliance, reliability, ownership, data handling, or architectural integrity.

Responsibilities:

- Translate governance expectations into verifiable architectural properties.
- Support compliance readiness.
- Connect evidence to audit posture.

Relationships:

- May be defined by a Policy.
- May be evaluated by Rules.
- Applies to Capabilities, Business Loops, System Assets, or data classes.
- May produce Findings.
- May have Evidence.

Lifecycle:

- Declared.
- Mapped.
- Verified.
- Failing.
- Exceptioned.
- Retired.

Invariants:

- A Control must identify the risk it mitigates.
- Control status must be evidence-backed.
- Control exceptions require human governance and review path.

Trace:

- Vision Design Goal: audit-ready compliance reports.
- Vision Non-Goal: structural security verifier, not security scanner.
- Reference Architecture 3.3 and 3.4.

### 7.4 Claim

Definition:

A Claim is a specific assertion Architecture Doctor makes or evaluates about architectural reality.

Responsibilities:

- Bridge Evidence and Findings.
- Make reasoning explicit and attributable.
- Preserve uncertainty and contradiction.

Relationships:

- Supported or refuted by Evidence.
- Produced by Rules, Engines, Plugins, or Reasoning Layer.
- May become a Finding.
- Has Confidence.
- May be represented as a Knowledge Node.

Lifecycle:

- Proposed.
- Supported.
- Refuted.
- Contested.
- Accepted for Finding.
- Superseded.

Invariants:

- A Claim must state its subject, predicate, evidence basis, and confidence.
- A contested Claim must not be silently resolved by preference.
- Critical Claims require high-confidence support.

Trace:

- Vision Principle 1.
- Vision Principle 2.
- Reference Architecture 3.7.

### 7.5 Verification Run

Definition:

A Verification Run is a bounded cycle of observation, evidence admission, rule evaluation, finding update, and knowledge publication.

Responsibilities:

- Provide temporal context for generated knowledge.
- Record which engines, plugins, evidence sources, and policies participated.
- Support repeatability, auditability, and trend analysis.

Relationships:

- Contains Observations, Evidence admissions, Rule evaluations, Claims, Findings, Health updates, and Knowledge publications.
- May be triggered by commit, PR, schedule, manual review, or integration event.

Lifecycle:

- Planned.
- Running.
- Completed.
- Completed with limitations.
- Failed.
- Superseded.

Invariants:

- A Verification Run must record timing, scope, participating sources, and limitations.
- Failed or partial runs must be visible because they affect confidence.
- Reports are outputs of runs, not the source of truth.

Trace:

- Vision Philosophy 3.2 and 3.7.
- Reference Architecture 4.1.

---

## 8. Finding Entities

### 8.1 Finding

Definition:

A Finding is a verified architectural gap, risk, drift, missing control, unresolved ownership issue, or architectural inconsistency that matters because it affects a Capability, Business Loop, governance obligation, or declared intent.

Responsibilities:

- Make architectural truth visible.
- Explain what is wrong, why it matters, what evidence supports it, and what action is recommended.
- Preserve lifecycle and governance memory.

Relationships:

- Belongs to a Capability, Business Loop, or explicit Unresolved Ownership state.
- Is supported by Evidence.
- May derive from one or more Claims.
- Has Confidence.
- Has Risk.
- Has Severity.
- Has Recommendation.
- May have Governance Events, Baselines, Exceptions, and Enforcement Modes.
- Is represented as one or more Knowledge Nodes.

Lifecycle:

- Candidate.
- Open.
- Acknowledged.
- Baseline Accepted.
- Exception Granted.
- In Remediation.
- Resolved.
- Reopened.
- Superseded.
- Archived.

Invariants:

- A Finding must have evidence.
- A Finding must have recommended action.
- A Finding must state affected capability context or unresolved ownership state.
- A Finding must have technical and business-impact explanation when stakeholder-facing.
- A Finding must not blame an individual developer.
- A Finding must not be hidden because it is inconvenient.
- A Finding that exists only in a report is incomplete.

Trace:

- Vision Principle 1.
- Vision Principle 3.
- Vision Philosophy 3.6.
- Vision Principle 8.
- Reference Architecture 3.4 and 6.

### 8.2 Finding Type

Definition:

A Finding Type is the stable category of architectural concern a Finding belongs to.

Responsibilities:

- Provide consistent language across plugins and reports.
- Define expected evidence, confidence, risk, recommendation, and enforcement behavior.
- Support trend analysis and recurring pattern detection.

Relationships:

- May be produced by Rules, Policies, Engines, or Plugins.
- Has default Severity and Enforcement Mode.
- Has Noise Budget.
- Has confidence requirements.

Lifecycle:

- Proposed.
- Experimental.
- Advisory.
- Warn.
- Block Eligible.
- Deprecated.
- Retired.

Invariants:

- A Finding Type must declare expected false-positive tolerance before promotion.
- A Finding Type that cannot explain its limitations cannot become default-on.
- High-severity and critical Finding Types require strict confidence thresholds.

Trace:

- Vision Principle 2.
- Vision Section 15.
- Reference Architecture 3.9.

### 8.3 Recommendation

Definition:

A Recommendation is the actionable guidance that makes a Finding closeable.

Responsibilities:

- Explain the remediation path.
- Identify expected effort, risk reduction, ownership path, and verification criteria.
- Teach the architectural rationale.

Relationships:

- Belongs to a Finding.
- May reference Policies, Rules, Controls, Capabilities, Owners, or prior Knowledge Nodes.
- May be drafted or improved by AI when grounded in structured data.

Lifecycle:

- Drafted.
- Published.
- Updated.
- Superseded.
- Verified Complete.

Invariants:

- Every open Finding must have a Recommendation.
- A Recommendation must include enough context for action, not merely a verdict.
- A Recommendation must distinguish required remediation from optional improvement.
- AI-drafted Recommendations must remain grounded in Architecture Doctor data.

Trace:

- Vision Philosophy 3.6.
- Vision Section 13: teaches through findings.
- Vision Section 14: AI as documentation author and triage assistant.
- Reference Architecture 3.7.

### 8.4 Severity

Definition:

Severity is the assessed importance of a Finding based on architectural consequence.

Responsibilities:

- Support prioritisation and enforcement.
- Communicate consequence without overstating certainty.

Relationships:

- Belongs to a Finding or Finding Type.
- Is informed by Risk, Confidence, Control criticality, Capability importance, and evidence quality.
- May influence Enforcement Mode.

Lifecycle:

- Proposed.
- Assigned.
- Reassessed.
- Downgraded.
- Upgraded.
- Superseded.

Invariants:

- Severity must not be inflated to drive action.
- Critical Severity requires deterministic or very high-confidence evidence.
- Severity and Confidence are distinct; a high-impact uncertain issue is not the same as a proven critical finding.

Trace:

- Vision Principle 1.
- Vision Principle 2.
- Reference Architecture 3.3.

---

## 9. Governance Entities

### 9.1 Governance Event

Definition:

A Governance Event is an attributable event that records a decision, review, approval, rejection, amendment, escalation, enforcement change, baseline, exception, or ownership action.

Responsibilities:

- Preserve human judgment.
- Create audit memory.
- Explain why the governance state changed.

Relationships:

- Has an Actor.
- Has timestamp, rationale, scope, and affected entities.
- May apply to Findings, Policies, Rules, Capabilities, Baselines, Exceptions, Enforcement Modes, Plugins, or Owners.
- Becomes Knowledge Node material.

Lifecycle:

- Proposed.
- Recorded.
- Effective.
- Superseded.
- Audited.

Invariants:

- Governance Events must be attributable.
- Governance Events must have rationale.
- Consequential Governance Events require human authority.
- Governance Events are append-only historical memory; later events supersede but do not erase earlier events.

Trace:

- Vision Philosophy 3.5.
- Vision Philosophy 3.8.
- Reference Architecture 3.6.

### 9.2 Actor

Definition:

An Actor is the human, accountable group, or system process associated with a Governance Event or automated observation.

Responsibilities:

- Preserve attribution.
- Distinguish human judgment from automated system activity.

Relationships:

- May be an Owner.
- May initiate Governance Events.
- May trigger Verification Runs.
- May represent a Plugin or system process for non-consequential automated events.

Lifecycle:

- Active.
- Delegated.
- Inactive.
- Removed.

Invariants:

- Human decisions must identify a human or accountable human group.
- Automated actors may record observations but may not perform consequential governance decisions.

Trace:

- Vision Philosophy 3.5 and 3.8.
- Vision Non-Goal: not an autonomous agent.

### 9.3 Baseline

Definition:

A Baseline is a temporary human acknowledgment that an open Finding is accepted for a defined period without erasing its truth.

Responsibilities:

- Provide pressure relief without suppressing reality.
- Preserve rationale and review path.
- Keep accepted architectural debt visible.

Relationships:

- Applies to a Finding or Finding Type within scope.
- Has Owner, Actor, rationale, start date, expiry date, review path, and Governance Event.
- May affect Enforcement Mode but does not remove Finding knowledge.

Lifecycle:

- Proposed.
- Accepted.
- Active.
- Expiring.
- Expired.
- Renewed.
- Closed.

Invariants:

- Every Baseline must have expiry.
- Every Baseline must have rationale.
- Every Baseline must have owner.
- Expired Baselines must return findings to normal governance.
- Baselines do not make findings false.

Trace:

- Vision Principle 5.
- Reference Architecture 3.6 and 6.

### 9.4 Exception

Definition:

An Exception is a bounded, attributed, reviewed divergence from a Policy, Rule, Control, or normal enforcement expectation.

Responsibilities:

- Preserve transparent trade-offs.
- Prevent local special cases from becoming undocumented architecture.

Relationships:

- Applies to Policy, Rule, Control, Finding, Capability, Plugin, or System Asset.
- Has Owner, Actor, rationale, scope, expiry or review cadence, and Governance Event.

Lifecycle:

- Requested.
- Approved.
- Active.
- Under Review.
- Expired.
- Revoked.
- Superseded.

Invariants:

- Exceptions must have scope.
- Exceptions must have rationale.
- Exceptions must have owner.
- Exceptions must have expiry or review cadence.
- Exceptions are not precedent unless explicitly converted into Policy through governance.

Trace:

- Vision Philosophy 3.5.
- Vision Principle 5.
- Vision Engineering Value: transparency in trade-offs.

### 9.5 Enforcement Mode

Definition:

Enforcement Mode is the governance posture applied to a Rule, Policy, Finding Type, Plugin output, Capability, or delivery surface.

Allowed modes:

- Observe: collect and learn without notifying broadly.
- Advisory: inform without blocking.
- Warn: warn with stronger visibility but do not block.
- Block: prevent a governed action from proceeding.

Responsibilities:

- Support progressive enforcement.
- Match governance response to confidence, risk, and maturity.

Relationships:

- Applies to Policies, Rules, Finding Types, Plugins, Capabilities, and delivery surfaces.
- Changes through Governance Events.

Lifecycle:

- Observe.
- Advisory.
- Warn.
- Block.
- Relaxed.
- Retired.

Invariants:

- Never block before informing.
- Never enforce before advising.
- Block requires overwhelming evidence and human governance.
- Enforcement changes must be attributable.

Trace:

- Vision Principle 4.
- Reference Architecture 3.6.

---

## 10. Knowledge Graph Entities

### 10.1 Knowledge Node

Definition:

A Knowledge Node is the durable graph-backed representation of Architecture Doctor knowledge.

Responsibilities:

- Preserve architectural memory.
- Make findings, evidence, decisions, ownership, dependencies, and lessons queryable.
- Connect current state to history.

Relationships:

- May represent Capability, Business Loop, System Asset, Evidence, Finding, Recommendation, Policy, Governance Event, Owner, Control, Plugin, Health State, or Lesson.
- Has Knowledge Edges to other nodes.
- May be rendered into Reports.

Lifecycle:

- Proposed.
- Published.
- Updated.
- Superseded.
- Archived.

Invariants:

- Every reportable architectural fact should be representable as a Knowledge Node or Knowledge Edge.
- Knowledge Nodes preserve history; they do not behave like disposable report rows.
- A Finding that is not graph-representable is incomplete.

Trace:

- Vision Principle 8.
- Vision Phase 3.
- Reference Architecture 3.5.

### 10.2 Knowledge Edge

Definition:

A Knowledge Edge is a durable relationship between Knowledge Nodes.

Responsibilities:

- Preserve architectural relationships.
- Support dependency, impact, ownership, governance, and historical reasoning.

Relationship examples:

- Capability owns System Asset.
- System Asset supports Capability.
- Finding affects Capability.
- Evidence supports Claim.
- Claim produces Finding.
- Recommendation addresses Finding.
- Governance Event changes Enforcement Mode.
- Owner accountable for Capability.
- Policy governs Rule.
- Plugin emits Observation.

Lifecycle:

- Proposed.
- Published.
- Updated.
- Superseded.
- Archived.

Invariants:

- Edges must be typed.
- Edges must preserve provenance when derived from Evidence or governance action.
- Contradictory edges must be resolvable through confidence, timestamp, and source rather than silent overwrite.

Trace:

- Vision Philosophy 3.7.
- Vision Principle 8.
- Reference Architecture 3.5.

### 10.3 Lesson

Definition:

A Lesson is durable architectural learning derived from repeated findings, decisions, incidents, remediation outcomes, or historical patterns.

Responsibilities:

- Make learning a first-class output.
- Feed convention evolution and future recommendations.
- Reduce repeated governance mistakes.

Relationships:

- Derived from Findings, Governance Events, Resolutions, Incidents, or historical graph patterns.
- May inform Recommendations, Policies, Rules, and Reports.

Lifecycle:

- Proposed.
- Validated.
- Published.
- Applied.
- Superseded.

Invariants:

- A Lesson must cite its evidence or historical basis.
- A Lesson must not become a Policy without governance.
- AI may surface lesson candidates, but human governance promotes them.

Trace:

- Vision Engineering Value: learning as a first-class output.
- Vision Section 14: AI as historian.

---

## 11. Reasoning Entities

### 11.1 Explanation

Definition:

An Explanation is an audience-specific rendering of what Architecture Doctor knows and why it matters.

Responsibilities:

- Translate structured architectural knowledge into understandable language.
- Preserve technical truth while adapting language to audience.
- Communicate uncertainty honestly.

Relationships:

- May explain Findings, Recommendations, Health States, Policies, Controls, or Governance Events.
- May have technical, business, audit, or leadership variants.
- Must be grounded in Knowledge Nodes, Evidence, and Claims.

Lifecycle:

- Drafted.
- Published.
- Updated.
- Superseded.

Invariants:

- Explanations must not change the underlying truth.
- Business explanations must be grounded in capability impact.
- AI-generated explanations must be traceable to structured data.

Trace:

- Vision Design Goal: explain any finding to a non-technical stakeholder.
- Vision Section 14: AI as interpreter.
- Reference Architecture 3.7 and 3.8.

### 11.2 Impact Assessment

Definition:

An Impact Assessment describes the likely architectural effect of a change, finding, policy, exception, or proposed capability.

Responsibilities:

- Identify affected Capabilities, Business Loops, System Assets, Owners, Controls, Findings, and Risks.
- Support PR-time and prospective architectural decisions.
- State confidence and uncertainty.

Relationships:

- Uses Knowledge Nodes, Evidence, Claims, Dependencies, and Historical Patterns.
- May generate Recommendations.
- May be rendered in developer or leadership surfaces.

Lifecycle:

- Requested.
- Drafted.
- Published.
- Superseded.
- Archived.

Invariants:

- Impact Assessments must state uncertainty.
- Impact Assessments inform human judgment; they do not replace it.
- Future-looking assessments must not present speculation as fact.

Trace:

- Vision Section 10: PR safety and change impact decisions.
- Vision Section 14: AI as simulation partner.
- Reference Architecture 4.2.

### 11.3 Health State

Definition:

Health State is the current architectural condition of a Capability, Business Loop, Control, Policy area, or platform-wide view.

Responsibilities:

- Summarise current architectural posture.
- Make architectural health comparable over time.
- Support leadership, audit, and engineering decisions.

Relationships:

- Derived from Findings, Evidence, Risk, Severity, Governance Events, and Health Trajectory.
- Belongs to Capability, Business Loop, Control, or platform scope.

Lifecycle:

- Calculated.
- Published.
- Superseded by next state.
- Archived.

Invariants:

- Health State must be evidence-backed.
- Health State must not hide open findings.
- Health State without trajectory is incomplete for strategic reporting.

Trace:

- Vision Philosophy 3.4.
- Vision Design Goals.
- Reference Architecture 3.3 and 3.4.

### 11.4 Health Trajectory

Definition:

Health Trajectory is the historical direction, velocity, and projected movement of architectural health.

Responsibilities:

- Show whether architecture is improving or degrading.
- Support debt prioritisation and predictive advice.
- Preserve temporal continuity.

Relationships:

- Uses historical Health States, Findings, Governance Events, Resolutions, and Evidence.
- Belongs to a Capability, Business Loop, Control, or platform scope.

Lifecycle:

- Calculated.
- Published.
- Recalculated.
- Superseded.
- Archived.

Invariants:

- Trajectory must be based on historical data.
- Forecasts must be identified as forecasts.
- Trajectory must preserve cause where known.

Trace:

- Vision Philosophy 3.4.
- Vision Phase 2.
- Reference Architecture 3.3.

---

## 12. Reporting Entities

### 12.1 Report

Definition:

A Report is an audience-specific rendering of graph-backed Architecture Doctor knowledge.

Responsibilities:

- Present architectural knowledge for a decision moment.
- Preserve truth while adapting detail and language to audience.
- Link back to durable knowledge.

Relationships:

- Renders Knowledge Nodes, Findings, Recommendations, Health States, Governance Events, and Impact Assessments.
- May target developer, leadership, audit, governance, or learning audiences.

Lifecycle:

- Generated.
- Published.
- Superseded.
- Archived.

Invariants:

- Reports are not the source of truth.
- Reported facts must trace to Knowledge Nodes or source Evidence.
- Reports must not suppress inconvenient truths.

Trace:

- Vision Principle 1.
- Vision Principle 8.
- Reference Architecture 3.8.

### 12.2 Delivery Surface

Definition:

A Delivery Surface is a place Architecture Doctor knowledge reaches a human decision-maker.

Examples:

- PR comment.
- CI result.
- Editor context.
- Dashboard.
- Compliance export.
- Governance review view.
- Knowledge explorer.

Responsibilities:

- Present the right architectural context at the right decision moment.
- Avoid unnecessary interruption.
- Preserve audience-appropriate explanations.

Relationships:

- Renders Reports, Findings, Recommendations, Impact Assessments, Governance Events, and Health States.
- May have Enforcement Mode.

Lifecycle:

- Proposed.
- Active.
- Degraded.
- Disabled.
- Retired.

Invariants:

- Delivery Surfaces must not become separate sources of truth.
- Delivery Surfaces must respect noise budget.
- Developer surfaces should provide context, not unsupported verdicts.

Trace:

- Vision Philosophy 3.2.
- Vision Section 13.
- Reference Architecture 3.8.

---

## 13. Plugin Entities

### 13.1 Plugin

Definition:

A Plugin is an extension that contributes evidence sources, rules, verification engines, control models, graph enrichers, report renderers, governance integrations, AI reasoning support, or delivery surfaces.

Responsibilities:

- Extend Architecture Doctor without weakening the canonical model.
- Declare scope, evidence type, confidence model, limitations, graph outputs, and governance boundaries.
- Speak the universal domain language.

Relationships:

- May provide Evidence Sources, Rules, Policies, Controls, Finding Types, Knowledge Nodes, Reports, or Delivery Surfaces.
- May emit Observations and Evidence.
- May be governed by Policies and Governance Events.

Lifecycle:

- Proposed.
- Experimental.
- Approved.
- Active.
- Degraded.
- Disabled.
- Deprecated.
- Retired.

Invariants:

- A Plugin must serve the mission.
- A Plugin must operate at capability level or map its observations to capability-level meaning.
- A Plugin must declare limitations.
- A Plugin must declare confidence behavior.
- A Plugin must produce graph-representable knowledge.
- A Plugin must be reversible.
- A Plugin must not bypass human authority.
- A Plugin must not redefine canonical domain terms.

Trace:

- Vision Section 15.
- Reference Architecture 3.9.

### 13.2 Plugin Contract

Definition:

A Plugin Contract is the governed declaration of what a Plugin contributes, what it may observe, what it may emit, and what guarantees it must uphold.

Responsibilities:

- Make plugin behavior understandable without reading source code.
- Define admissible outputs and governance limits.
- Protect the shared architectural language.

Relationships:

- Belongs to a Plugin.
- Declares Evidence Sources, Rule outputs, Finding Types, Confidence model, Risk model, Knowledge Node mappings, limitations, and reversibility.
- May be governed by Policies.

Lifecycle:

- Draft.
- Reviewed.
- Approved.
- Active.
- Amended.
- Revoked.
- Retired.

Invariants:

- No Plugin may be active without a Plugin Contract.
- Plugin Contracts must state what the Plugin cannot know.
- Plugin Contracts must state whether outputs are observational, advisory, warn-capable, or block-capable.
- Contract changes are Governance Events.

Trace:

- Vision Section 15.
- Reference Architecture 3.9.

### 13.3 Noise Budget

Definition:

Noise Budget is the allowable attention cost a Plugin, Rule, Finding Type, Delivery Surface, or Policy may impose before trust is harmed.

Responsibilities:

- Protect engineers from low-value interruptions.
- Support promotion from experimental to default-on governance.
- Force explicit signal-quality accountability.

Relationships:

- Applies to Plugins, Rules, Finding Types, Policies, and Delivery Surfaces.
- Informed by false-positive rate, dismissal rate, recurrence, severity, and owner feedback.

Lifecycle:

- Proposed.
- Assigned.
- Monitored.
- Exceeded.
- Rebalanced.
- Retired.

Invariants:

- A feature that routinely exceeds its noise budget must be revised, relaxed, or disabled.
- Critical findings have very low false-positive tolerance.
- Noise Budget cannot justify suppressing true high-confidence architectural risk.

Trace:

- Vision Section 13: does not interrupt unnecessarily.
- Vision Section 15: earns its noise budget.

---

## 14. Temporal Entities

### 14.1 Timeline

Definition:

A Timeline is the ordered history of domain events for an entity or scope.

Responsibilities:

- Preserve temporal continuity.
- Support trend, audit, and causal analysis.

Relationships:

- May include Verification Runs, Observations, Evidence admissions, Findings, Governance Events, Health States, Baselines, Exceptions, and Resolutions.

Lifecycle:

- Open.
- Extended.
- Archived.

Invariants:

- Timelines must preserve sequence.
- Timeline history must not be overwritten by current state.

Trace:

- Vision Philosophy 3.4 and 3.7.

### 14.2 Lifecycle State

Definition:

A Lifecycle State is the current named state of a domain entity within its governed lifecycle.

Responsibilities:

- Make state transitions explicit.
- Support governance, reporting, and auditability.

Relationships:

- Applies to all major entities.
- Changes through verification outcomes or Governance Events, depending on consequence.

Lifecycle:

- Defined by each entity.

Invariants:

- Consequential state changes must be attributable.
- State transition history must be preserved.

Trace:

- Vision Philosophy 3.5.
- Reference Architecture 6.

---

## 15. Shared Value Objects

### 15.1 Confidence

Definition:

Confidence is the system's stated certainty that a Claim, Evidence admission, Finding, mapping, or assessment is correct.

Responsibilities:

- Communicate uncertainty honestly.
- Calibrate severity and enforcement.
- Protect trust in critical findings.

Relationships:

- Applies to Evidence, Claims, Findings, Recommendations, asset mappings, Impact Assessments, and Health calculations.
- Influences Severity and Enforcement Mode.

Allowed qualitative levels:

- Unknown.
- Low.
- Medium.
- High.
- Very High.
- Deterministic.

Invariants:

- Confidence must not be omitted from claims that affect findings.
- Critical Findings require Very High or Deterministic confidence.
- Low-confidence findings must be clearly marked and cannot block.
- Confidence must reflect source limitations and contradictory evidence.

Trace:

- Vision Principle 2.
- Vision Section 13: honest about uncertainty.

### 15.2 Risk

Definition:

Risk is the potential consequence if a Finding, drift, missing control, or architectural condition remains unresolved.

Responsibilities:

- Translate architecture into consequence.
- Support prioritisation.
- Connect technical issues to business impact.

Risk dimensions:

- Architectural.
- Business.
- Compliance.
- Security-structural.
- Reliability.
- Ownership.
- Operational.
- Financial.
- Learning or knowledge-loss.

Relationships:

- Belongs to Findings, Controls, Impact Assessments, Policies, and Recommendations.
- Informs Severity and prioritisation.

Invariants:

- Risk must state what could happen, who or what is affected, and why the claim is grounded.
- Business risk must be tied to Capability or Business Loop impact.
- Risk must distinguish known consequence from possible consequence.

Trace:

- Vision Purpose.
- Vision Design Goals.
- Reference Architecture 3.7.

### 15.3 Scope

Definition:

Scope defines the boundary within which an entity, decision, rule, policy, exception, or finding applies.

Responsibilities:

- Prevent overgeneralisation.
- Make governance decisions precise.
- Support reversibility.

Relationships:

- Applies to Policies, Rules, Findings, Baselines, Exceptions, Governance Events, Plugins, Reports, and Delivery Surfaces.

Invariants:

- Governance decisions without scope are invalid.
- Plugin scope must be declared before activation.
- Exceptions must never be broader than their rationale.

Trace:

- Vision Philosophy 3.5.
- Vision Section 15: reversibility and understandability.

### 15.4 Provenance

Definition:

Provenance is the record of where knowledge came from, when it was produced, how it was derived, and what limitations apply.

Responsibilities:

- Make knowledge auditable.
- Support confidence and contradiction handling.
- Preserve source accountability.

Relationships:

- Required for Observations, Evidence, Claims, Findings, Reports, Knowledge Nodes, and AI-generated Explanations.

Invariants:

- Evidence without provenance is inadmissible.
- AI output must cite structured data provenance.
- Provenance must survive report rendering.

Trace:

- Vision Principle 1.
- Vision Principle 8.
- Reference Architecture 3.2.

### 15.5 Rationale

Definition:

Rationale is the stated reason for a governance decision, policy, exception, baseline, severity assignment, recommendation, or architectural interpretation.

Responsibilities:

- Preserve why a decision was made.
- Support future archaeology reduction.
- Make trade-offs transparent.

Relationships:

- Required for Governance Events, Baselines, Exceptions, Policy changes, and enforcement changes.

Invariants:

- Consequential decisions without rationale are invalid.
- Rationale must be human-understandable.
- Rationale must not be replaced by an opaque score.

Trace:

- Vision Philosophy 3.5.
- Vision Engineering Value: transparency in trade-offs.

### 15.6 Timepoint

Definition:

Timepoint is the recorded moment at which an observation, decision, state, or publication occurred.

Responsibilities:

- Enable temporal reasoning.
- Support audit and trend analysis.

Relationships:

- Applies to Observations, Evidence, Verification Runs, Findings, Governance Events, Health States, Baselines, Exceptions, Reports, and Knowledge Nodes.

Invariants:

- Time-sensitive domain entities must have Timepoints.
- Expiry and review dates must be explicit for Baselines and Exceptions.

Trace:

- Vision Philosophy 3.4 and 3.5.

---

## 16. Canonical Relationships

The following relationships define the minimum shared graph language:

- Capability has Owner.
- Capability participates in Business Loop.
- Capability depends on Capability.
- Capability expects System Asset.
- System Asset supports Capability.
- System Asset depends on System Asset.
- Evidence Source produces Observation.
- Observation derives Evidence.
- Evidence supports Claim.
- Evidence refutes Claim.
- Rule evaluates Evidence.
- Policy governs Rule.
- Control is verified by Rule.
- Claim produces Finding.
- Finding affects Capability.
- Finding affects Business Loop.
- Finding has Recommendation.
- Finding has Confidence.
- Finding has Risk.
- Finding has Severity.
- Finding has Governance Event.
- Governance Event changes Enforcement Mode.
- Governance Event creates Baseline.
- Governance Event grants Exception.
- Baseline acknowledges Finding.
- Exception modifies Policy, Rule, Control, Finding, or Enforcement Mode within Scope.
- Plugin provides Evidence Source.
- Plugin provides Rule.
- Plugin emits Observation.
- Plugin publishes Knowledge Node.
- Knowledge Node represents domain entity.
- Knowledge Edge relates Knowledge Nodes.
- Report renders Knowledge Node.
- Delivery Surface presents Report.
- Health State summarises Capability.
- Health Trajectory evolves from Health State history.
- Impact Assessment analyses change against Knowledge Nodes.
- Lesson derives from Findings and Governance Events.

Invariants:

- Relationships must be typed.
- Relationships must preserve provenance when derived from observation, evidence, or governance.
- Relationship confidence must be explicit when inferred.
- Contradictory relationships are preserved and reasoned about; they are not silently overwritten.

Trace:

- Vision Principle 8.
- Reference Architecture 3.5.

---

## 17. Canonical Lifecycles

### 17.1 Observation to Evidence

1. Observation is collected.
2. Observation is normalised and classified.
3. Observation is evaluated for relevance, provenance, and limitations.
4. Observation becomes admitted Evidence, rejected observation, or contested candidate.
5. Evidence is linked to Claims and Knowledge Nodes.

Invariant:

- Raw observation is not automatically evidence.

### 17.2 Evidence to Finding

1. Rule evaluates Evidence against Architectural Intent.
2. Claim is produced.
3. Claim confidence is assessed.
4. Finding Candidate is created when the claim indicates a gap, risk, drift, missing control, or ownership issue.
5. Finding Candidate becomes Open Finding only when it satisfies evidence, capability, confidence, risk, and recommendation requirements.

Invariant:

- No Finding may be opened without evidence and recommended action.

### 17.3 Finding to Governance

1. Finding is surfaced to the appropriate Delivery Surface.
2. Owner or accountable human reviews the context.
3. Governance Event records action, rationale, actor, scope, and timestamp.
4. Finding state changes if approved by governance.
5. Knowledge Graph preserves both the Finding and the governance decision.

Invariant:

- Governance changes do not erase architectural truth.

### 17.4 Governance to Knowledge

1. Governance Event is recorded.
2. Related entities are linked.
3. Knowledge Nodes and Edges are published or updated.
4. Reports render the updated knowledge.
5. Future reasoning uses the event as historical memory.

Invariant:

- Governance memory is append-only in meaning, even when current state changes.

### 17.5 Plugin Admission

1. Plugin proposes scope and contract.
2. Plugin declares evidence sources, outputs, limitations, confidence model, risk model, knowledge graph mapping, and reversibility.
3. Governance reviews admission.
4. Plugin starts in experimental or advisory posture.
5. Plugin earns stronger enforcement only through evidence quality, low noise, and human governance.

Invariant:

- Plugins do not become authoritative by installation alone.

Trace:

- Vision Principles 2, 4, 5, 8.
- Vision Section 15.
- Reference Architecture 3.9 and 4.

---

## 18. Domain-Wide Invariants

These invariants apply to the entire Architecture Doctor domain:

- Intent and reality are separate domain concepts.
- Structure is evidence, not architecture by itself.
- Capability is the primary architectural unit.
- Every active Finding links to Capability, Business Loop, or explicit unresolved ownership state.
- Every Finding has Evidence.
- Every Finding has Recommendation.
- Every Evidence item has Provenance.
- Every critical Finding has Very High or Deterministic Confidence.
- Every Governance Event is attributable.
- Every Baseline expires or has explicit review path.
- Every Exception has scope, rationale, owner, and review cadence or expiry.
- Every Policy amendment is a Governance Event.
- Every enforcement escalation follows progressive enforcement.
- Every reportable architectural fact can become graph knowledge.
- Every plugin uses canonical terms.
- Every plugin declares limitations.
- Every plugin output is graph-representable.
- Every AI-generated Explanation or Recommendation is grounded in structured domain knowledge.
- Reports render knowledge; they do not own it.
- Current state never destroys historical truth.
- Human judgment remains the authority ceiling for consequential decisions.

Trace:

- Vision Philosophy 3.1 through 3.8.
- Vision Principles 1 through 8.
- Reference Architecture 6.

---

## 19. Plugin Language Compliance

Every Plugin must map its private domain terms into this canonical model before Architecture Doctor may treat its outputs as architectural knowledge.

Minimum required mappings:

- What does the plugin observe?
- Which Evidence Source does it use?
- What Observations does it emit?
- Which Observations become Evidence?
- Which Capability, Business Loop, System Asset, Control, Policy, Rule, or Claim does the Evidence relate to?
- What Confidence model applies?
- What Risk dimensions can it express?
- What Finding Types can it produce?
- What Recommendations can it generate?
- What Knowledge Nodes and Edges can it publish?
- What limitations must be shown to humans?
- What Governance Events can affect it?
- What Enforcement Modes may apply?
- How is it disabled or rolled back without corrupting knowledge?

Non-compliant plugin behaviors:

- Emitting findings without evidence.
- Emitting findings without capability context.
- Emitting critical findings from heuristic evidence alone.
- Hiding uncertainty.
- Treating reports as primary storage.
- Creating baselines or exceptions autonomously.
- Changing enforcement mode autonomously.
- Redefining canonical terms.
- Producing outputs that cannot become Knowledge Nodes or Edges.

Trace:

- Vision Section 15.
- Reference Architecture 3.9.

---

## 20. Domain Model Summary

Architecture Doctor's canonical domain model exists to keep the platform honest, extensible, temporal, and understandable.

Its central truth is:

Intent is declared through Capabilities, Business Loops, Policies, and Controls. Reality is captured as Observations. Observations become Evidence when they are admissible for reasoning. Evidence supports Claims. Claims may produce Findings. Findings require Confidence, Risk, Recommendation, and ownership-aware capability context. Governance Events preserve human judgment. Knowledge Nodes preserve architectural memory. Reports and delivery surfaces render that memory for decisions. Plugins extend the model only by speaking this shared language.

This model is the required vocabulary for all future Architecture Doctor implementation.
