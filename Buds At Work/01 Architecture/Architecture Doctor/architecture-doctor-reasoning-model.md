# Architecture Doctor - Reasoning Model

Version: 1.0
Status: Constitutional Reasoning Model
Date: 2026-07-09
Constitutional authority: Architecture Doctor - Vision & Principles v1.0
Architectural authority: Architecture Doctor - Reference Architecture v1.0
Domain authority: Architecture Doctor - Canonical Domain Model v1.0

---

## 1. Purpose

This document defines how Architecture Doctor thinks.

It is the constitutional reasoning model for every future plugin, engine, AI capability, governance workflow, reporting surface, and knowledge graph integration. It does not redesign Architecture Doctor. It defines the reasoning discipline that all Architecture Doctor components must follow when turning architectural intent and observed system reality into evidence-backed knowledge, recommendations, governance memory, and organisational learning.

The reasoning model exists to preserve four properties:

- Truth: conclusions reflect reality, not preference.
- Traceability: every conclusion traces to explicit evidence and provenance.
- Humility: uncertainty, contradiction, and limitation are represented honestly.
- Human authority: reasoning informs human judgment but does not replace it.

Trace:

- Vision Mission: make the gap between architectural intent and system reality visible, measurable, and closeable.
- Vision Philosophy 3.1: intent is primary; structure is evidence.
- Vision Philosophy 3.5: governance decisions must be attributable.
- Vision Philosophy 3.8: human judgment is irreplaceable.
- Vision Principle 1: truth over comfort.
- Vision Principle 2: precision over recall in critical findings.
- Vision Principle 8: findings belong to the knowledge graph, not to reports.
- Reference Architecture 3.7: Reasoning Layer.
- Canonical Domain Model: Observation, Evidence, Claim, Finding, Recommendation, Governance Event, Knowledge Node, Lesson, Confidence, Risk, Provenance.

---

## 2. Reasoning Commitments

Architecture Doctor reasons under these permanent commitments:

- Intent and reality are separate until evidence relates them.
- Observed structure is not architecture by itself; it is evidence for or against architectural intent.
- The business capability is the unit of architectural meaning.
- Raw observation is not automatically evidence.
- Evidence is not automatically fact.
- Claims are not automatically findings.
- Findings are not complete without recommendations.
- Governance decisions change governance state, not historical truth.
- Knowledge is durable, queryable, and graph-backed.
- Lessons emerge from repeated evidence-backed patterns, not anecdotes.
- Confidence is always explicit where a conclusion affects a finding, recommendation, governance decision, or report.
- Contradiction is preserved and reasoned about; it is not erased.
- AI may interpret, summarise, triage, simulate, and draft, but may not judge, enforce, approve, or override.

Trace:

- Vision Philosophy 3.1 through 3.8.
- Vision Principles 1 through 8.
- Canonical Domain Model 18: Domain-Wide Invariants.

---

## 3. The Architectural Reasoning Lifecycle

Architecture Doctor reasoning follows a canonical lifecycle:

Intent -> Observation -> Evidence -> Claim -> Finding -> Recommendation -> Governance -> Knowledge -> Learning

Each stage has a different epistemic status. The status must not be collapsed. A plugin, engine, report, or AI capability that skips stages must explicitly preserve the missing stage as unknown, not pretend it has been completed.

### 3.1 Intent

Intent is what the system is declared to be, do, own, protect, expose, or avoid.

Reasoning role:

- Provides the target against which reality is evaluated.
- Defines what evidence is relevant.
- Anchors reasoning at the capability, business loop, policy, control, or ownership level.

Reasoning constraints:

- Intent has authority, scope, and provenance.
- Intent is not automatically correct.
- Intent may be stale, incomplete, ambiguous, or contradicted by reality.
- When intent and reality disagree, both must be questioned.

Reasoning output:

- A reasoned expectation that can be tested against observations.

### 3.2 Observation

Observation is what Architecture Doctor saw.

Reasoning role:

- Records raw system reality before interpretation.
- Preserves collection context and source limitations.
- Supplies candidate material for evidence.

Reasoning constraints:

- Observation must not be treated as conclusion.
- Observation must retain source, timepoint, collection method, and limitations.
- Observation may be incomplete, noisy, stale, duplicated, or irrelevant.

Reasoning output:

- A raw record eligible for evidence admission.

### 3.3 Evidence

Evidence is observation admitted for architectural reasoning.

Reasoning role:

- Supports or refutes a claim.
- Provides the factual basis for findings, recommendations, governance decisions, and knowledge.
- Makes reasoning auditable.

Reasoning constraints:

- Evidence must have provenance.
- Evidence must declare the claim it supports or refutes.
- Evidence must carry confidence.
- Evidence must preserve contradictions.
- Evidence may be admissible for one claim but insufficient for another.

Reasoning output:

- A bounded, sourced, confidence-bearing basis for a claim.

### 3.4 Claim

A Claim is a specific assertion Architecture Doctor makes or evaluates about architectural reality.

Reasoning role:

- Converts evidence into a testable assertion.
- Keeps reasoning explicit before producing a finding.
- Provides the point where confidence, contradiction, and scope are assessed.

Reasoning constraints:

- A claim must identify subject, predicate, evidence, scope, confidence, and uncertainty.
- A claim may be supported, refuted, contested, or unresolved.
- A claim is not a finding unless it indicates an architectural gap, risk, drift, missing control, or ownership issue.

Reasoning output:

- A supported, refuted, contested, or unresolved assertion.

### 3.5 Finding

A Finding is a verified architectural concern that matters because it affects a capability, business loop, governance obligation, or declared intent.

Reasoning role:

- Makes architectural drift, risk, missing control, or unresolved ownership visible.
- Connects evidence-backed claims to business and architectural consequence.
- Triggers recommendation and possible governance.

Reasoning constraints:

- A finding must have evidence.
- A finding must have capability or business-loop context, or explicit unresolved ownership state.
- A finding must have confidence, risk, severity, and recommendation.
- A finding must not blame an individual developer.
- A critical finding requires very high or deterministic confidence.

Reasoning output:

- An actionable, evidence-backed architectural concern.

### 3.6 Recommendation

A Recommendation is the action context that makes a finding closeable.

Reasoning role:

- Converts a finding from alarm into governance.
- Explains remediation path, rationale, expected risk reduction, and verification criteria.
- Teaches architectural intent.

Reasoning constraints:

- Recommendation must distinguish required remediation from optional improvement.
- Recommendation must cite evidence and policy or intent where relevant.
- Recommendation must include uncertainty where the path is not deterministic.
- Recommendation may be AI-drafted only when grounded in structured knowledge.

Reasoning output:

- A closeable path for a human or team to act on.

### 3.7 Governance

Governance is attributable human decision-making over findings, baselines, exceptions, enforcement, ownership, and policy.

Reasoning role:

- Applies human judgment to evidence-backed architectural context.
- Records trade-offs, approvals, deferrals, exceptions, and enforcement changes.
- Preserves institutional memory.

Reasoning constraints:

- Consequential governance requires human authority.
- Governance decisions must have actor, rationale, scope, timepoint, and review path where applicable.
- Governance may change current state but must not erase prior truth.
- Baselines and exceptions do not make findings false.

Reasoning output:

- Attributed governance memory.

### 3.8 Knowledge

Knowledge is durable, graph-backed architectural memory.

Reasoning role:

- Preserves findings, evidence, claims, decisions, ownership, relationships, health, and history.
- Makes reasoning queryable and reusable.
- Provides historical context for future reasoning.

Reasoning constraints:

- Knowledge nodes and relationships must preserve provenance.
- Knowledge must distinguish fact, claim, finding, decision, recommendation, and lesson.
- Knowledge must preserve contradictions and superseded states.

Reasoning output:

- Durable architectural memory.

### 3.9 Learning

Learning is organisational understanding derived from repeated evidence-backed patterns, decisions, outcomes, and resolutions.

Reasoning role:

- Turns historical knowledge into better future recommendations, policies, controls, and design awareness.
- Reduces repeated mistakes.
- Improves the team's architectural judgment.

Reasoning constraints:

- Lessons must cite evidence or historical basis.
- Lessons are not policies until governed.
- Lessons must avoid overfitting to isolated events.
- AI may surface lesson candidates; humans promote them.

Reasoning output:

- Evidence-backed organisational learning.

Trace:

- Canonical Domain Model 17: Canonical Lifecycles.
- Vision Engineering Value: learning as a first-class output.

---

## 4. Epistemic Distinctions

Architecture Doctor must preserve the following distinctions.

### 4.1 Observation

An Observation is a raw recorded fact about what was seen.

It answers: "What did Architecture Doctor observe?"

It does not answer:

- Whether the observation is architecturally relevant.
- Whether it supports a claim.
- Whether it is sufficient for a finding.
- Whether the architecture is healthy or unhealthy.

### 4.2 Evidence

Evidence is observation admitted for reasoning.

It answers: "What admissible observed reality supports or refutes this claim?"

It does not answer:

- Whether the claim is fully settled.
- Whether the finding should be opened.
- Whether governance should act.

### 4.3 Claim

A Claim is a specific assertion about architecture.

It answers: "What does the evidence appear to say?"

It does not answer:

- Whether the issue is severe.
- Whether it should be enforced.
- Whether a human should accept an exception.

### 4.4 Fact

A Fact is a claim treated as settled within a defined scope because it has sufficient evidence, confidence, and provenance, and no unresolved contradiction material to that scope.

It answers: "What can Architecture Doctor treat as established for this reasoning context?"

Constraints:

- A fact is scoped, not universal.
- A fact may later be revised if new evidence arrives.
- A fact must preserve provenance.
- A fact must not be created from convenience, consensus, or repetition alone.

### 4.5 Knowledge

Knowledge is durable graph-backed memory that may include observations, evidence, claims, facts, findings, governance events, recommendations, relationships, and lessons.

It answers: "What does Architecture Doctor remember, and how is it connected?"

Constraints:

- Knowledge is broader than fact.
- Knowledge may include contested claims and superseded decisions.
- Knowledge must identify the epistemic status of what it stores.

### 4.6 Lesson

A Lesson is durable learning derived from repeated evidence-backed patterns, decisions, remediations, or outcomes.

It answers: "What should the organisation learn from this history?"

Constraints:

- A lesson is not a policy by default.
- A lesson must cite its evidence base.
- A lesson must identify scope and limits.

### 4.7 Recommendation

A Recommendation is actionable guidance for closing or reducing a finding.

It answers: "What should a human consider doing next, and why?"

Constraints:

- A recommendation must not pretend to be a governance decision.
- A recommendation must distinguish evidence-backed remediation from advisory preference.
- A recommendation must remain traceable to finding, risk, evidence, and intent.

Trace:

- Canonical Domain Model 3: Universal Language Rules.
- Vision Philosophy 3.6.

---

## 5. Uncertainty Representation

Architecture Doctor represents uncertainty explicitly instead of hiding it inside prose or scores.

Uncertainty may attach to:

- Asset-to-capability mapping.
- Observation completeness.
- Evidence admissibility.
- Claim support.
- Finding validity.
- Severity.
- Risk.
- Recommendation effectiveness.
- Impact assessment.
- Historical pattern relevance.
- Forecast.
- AI-generated interpretation.

### 5.1 Confidence Levels

Architecture Doctor uses the canonical confidence levels:

- Unknown: insufficient basis to evaluate.
- Low: weak or incomplete support; useful only for exploration.
- Medium: plausible support; requires caution and should not block.
- High: strong support; suitable for normal findings.
- Very High: strong, corroborated, low-ambiguity support; required for critical findings unless deterministic.
- Deterministic: directly established by authoritative evidence under a defined scope.

### 5.2 Uncertainty Dimensions

Confidence must consider the following dimensions:

- Source reliability: whether the source is authoritative for the claim.
- Observation freshness: whether the observation is current enough for the reasoning context.
- Scope fit: whether evidence covers the entity, capability, environment, branch, or time period being reasoned about.
- Extraction certainty: whether the observation was collected without ambiguity.
- Semantic certainty: whether the meaning of the observation is clear.
- Corroboration: whether independent evidence supports the same claim.
- Contradiction: whether evidence exists against the claim.
- Policy clarity: whether the relevant intent, policy, or control is clear.
- Historical stability: whether similar evidence has remained stable over time.
- Known limitations: whether source or plugin limitations reduce confidence.

### 5.3 Propagation Rules

Uncertainty propagates forward unless explicitly resolved.

Mandatory propagation rules:

- A claim cannot have higher confidence than its evidence basis unless corroborating evidence justifies it.
- A finding cannot have higher confidence than its supporting claim set.
- A recommendation must inherit the uncertainty of the finding and add any uncertainty about remediation effectiveness.
- An impact assessment must preserve uncertainty from dependency mapping and historical analogy.
- A report must render uncertainty honestly for its audience.
- A governance decision may accept risk despite uncertainty, but may not remove uncertainty from the record.
- AI-generated interpretation must not increase confidence; it may only explain, group, or suggest where confidence should be reviewed.

Trace:

- Vision Principle 2.
- Vision Section 13: honest about uncertainty.
- Canonical Domain Model 15.1: Confidence.

---

## 6. Evidence Admission

Observation becomes evidence only when it passes an admissibility test.

Evidence admission asks:

- What claim would this observation support or refute?
- Is the source authoritative for that claim?
- Is the observation fresh enough?
- Is the observation within scope?
- Is the extraction method reliable enough?
- Are limitations known and recorded?
- Is there contradictory evidence?
- Is the confidence sufficient for the reasoning use?

Evidence may be:

- Admitted: usable for the claim and scope.
- Admitted with limitations: usable only with explicit uncertainty.
- Contested: relevant but contradicted or ambiguous.
- Rejected: not suitable for architectural reasoning.
- Superseded: replaced by fresher or more authoritative evidence.
- Archived: preserved historically but not current.

Evidence admission is claim-specific. The same observation may be high-confidence evidence for one claim and inadmissible for another.

Trace:

- Canonical Domain Model 6.2 and 6.3.
- Reference Architecture 3.2.

---

## 7. Contradictory Evidence

Contradictory evidence is a first-class reasoning condition.

Architecture Doctor must never silently discard contradiction because it is inconvenient, noisy, or hard to explain.

### 7.1 Forms of Contradiction

Contradiction may occur when:

- Declared intent conflicts with observed system reality.
- Two evidence sources disagree.
- Current evidence conflicts with historical evidence.
- Plugin output conflicts with another plugin's output.
- Human governance accepts a baseline that leaves the finding true.
- Documentation states one thing and the system exhibits another.
- A capability owner disputes the interpretation of evidence.

### 7.2 Contradiction Handling

When contradiction appears, Architecture Doctor must:

- Preserve both sides with provenance.
- Identify the claim under dispute.
- Identify the scope of the contradiction.
- Compare source authority and freshness.
- Compare evidence confidence.
- Identify whether the contradiction affects finding validity, severity, recommendation, or governance posture.
- Degrade confidence where contradiction is material.
- Escalate to human review when the contradiction affects consequential governance.
- Record the resolution as a governance event or revised knowledge state.

### 7.3 Contradiction Outcomes

Contradiction may resolve as:

- Evidence error: one side is invalidated.
- Scope difference: both sides are true in different scopes.
- Temporal difference: one side was true at a different time.
- Intent drift: the Atlas or policy is stale.
- Reality drift: the system changed away from intent.
- Governance exception: divergence is accepted temporarily.
- Unresolved contradiction: confidence remains limited and human review is needed.

Invariants:

- Contradictory evidence must remain queryable.
- Contradiction must lower confidence unless scope, time, or authority explains it.
- A critical finding must not rely on unresolved contradictory evidence.
- Resolving contradiction must not erase the historical record.

Trace:

- Vision Principle 1.
- Vision Principle 6.
- Canonical Domain Model 16: contradictory relationships are preserved.

---

## 8. Confidence Calculation and Revision

Confidence is the explicit estimate of how strongly Architecture Doctor can rely on a claim, finding, mapping, recommendation, or assessment.

This document does not prescribe a numeric formula. It defines the conceptual factors and revision rules that every confidence model must honour.

### 8.1 Confidence Inputs

Confidence is based on:

- Evidence quality.
- Source authority.
- Provenance completeness.
- Observation freshness.
- Scope alignment.
- Extraction reliability.
- Semantic clarity.
- Corroboration.
- Contradiction.
- Historical stability.
- Plugin maturity.
- Known limitations.
- Human-governed clarification.

### 8.2 Confidence Revision

Confidence must be revised when:

- New evidence arrives.
- Existing evidence is invalidated.
- Contradictory evidence appears.
- Scope changes.
- Intent changes.
- Policy changes.
- A plugin declares new limitations.
- A source is degraded or disabled.
- Human governance clarifies ownership, intent, or exception.
- Historical outcomes confirm or weaken a reasoning pattern.

### 8.3 Confidence Boundaries

Confidence must obey these boundaries:

- Confidence cannot exceed the authority of the evidence source for the claim.
- Confidence cannot exceed scope fit.
- Confidence cannot ignore material contradiction.
- Confidence cannot be raised by repetition from the same weak source alone.
- Confidence cannot be raised by AI phrasing.
- Confidence cannot be raised by stakeholder preference.
- Confidence can be raised by independent corroboration.
- Confidence can be raised by human clarification of intent, but not of observed reality unless the human provides evidence.
- Confidence can be lowered by stale evidence, partial scans, source degradation, or unresolved contradiction.

### 8.4 Confidence and Severity

Confidence and severity are distinct.

- Severity describes consequence.
- Confidence describes certainty.

A severe but low-confidence issue may justify investigation but not blocking. A lower-severity high-confidence issue may justify normal governance but not urgent escalation. Critical findings require both material consequence and very high or deterministic confidence.

Trace:

- Vision Principle 2.
- Canonical Domain Model 8.4 and 15.1.

---

## 9. Root-Cause Analysis

Root-cause analysis identifies the architectural condition that explains multiple findings or repeated failures better than treating each finding independently.

Architecture Doctor performs root-cause reasoning to improve recommendations, reduce noise, and produce learning.

### 9.1 Root-Cause Inputs

Root-cause analysis may use:

- Finding clusters.
- Shared capabilities.
- Shared owners.
- Shared system assets.
- Shared policies or controls.
- Shared evidence sources.
- Shared dependency paths.
- Shared timelines.
- Repeated governance decisions.
- Recurring exceptions.
- Health trajectory changes.
- Historical resolution outcomes.

### 9.2 Root-Cause Reasoning Process

Root-cause reasoning asks:

- Which findings share the same capability, loop, asset, owner, policy, control, or dependency?
- Did the findings appear after the same change, decision, exception, or drift event?
- Would resolving one underlying condition close or reduce multiple findings?
- Are the findings symptoms of missing intent, stale intent, missing ownership, unclear policy, weak evidence, structural drift, or actual implementation divergence?
- Is the apparent root cause supported by evidence, or only by correlation?
- What uncertainty remains?

### 9.3 Root-Cause Outputs

Root-cause analysis may produce:

- Architectural Insight.
- Finding Group.
- Root-Cause Hypothesis.
- Root-Cause Finding.
- Recommendation Set.
- Lesson Candidate.
- Governance Review Prompt.

### 9.4 Root-Cause Constraints

- Correlation is not causation.
- Root cause must remain a hypothesis unless evidence supports it.
- AI may suggest root-cause candidates but may not declare root cause as governed truth.
- A root-cause recommendation must preserve links to affected findings.
- Grouping findings must not hide individual findings.

Trace:

- Vision Section 14: AI as finding triage assistant.
- Reference Architecture 3.7.
- Canonical Domain Model 10.3: Lesson.

---

## 10. Higher-Level Architectural Insights

An Architectural Insight is a higher-level conclusion derived from multiple findings, claims, health states, governance events, or historical patterns.

It answers: "What is the architecture telling us beyond the individual finding?"

### 10.1 Insight Types

Architecture Doctor may produce these insight types:

- Capability Risk Insight: a capability is accumulating risk across multiple findings.
- Ownership Insight: ownership is missing, concentrated, disputed, or ineffective.
- Drift Insight: observed reality is moving away from declared intent.
- Policy Insight: a policy is unclear, repeatedly exceptioned, or poorly matched to reality.
- Control Insight: a control is failing across multiple assets or capabilities.
- Dependency Insight: architectural coupling is creating recurring risk.
- Temporal Insight: health is improving or degrading at a meaningful rate.
- Governance Insight: repeated baselines or exceptions indicate a governance pattern.
- Learning Insight: recurring findings suggest a new convention, policy, or design lesson.

### 10.2 Insight Requirements

An insight must:

- Cite the findings, claims, evidence, or governance events it derives from.
- State its scope.
- State confidence.
- State uncertainty.
- Identify whether it is descriptive, diagnostic, predictive, or advisory.
- Preserve underlying findings.
- Avoid overstating causality.

### 10.3 Insight Lifecycle

Insight lifecycle:

- Candidate: pattern detected but not yet sufficiently supported.
- Supported: evidence-backed and reportable.
- Governed: reviewed or accepted through governance where consequential.
- Superseded: replaced by newer evidence or interpretation.
- Converted to Lesson: matured into organisational learning.
- Retired: no longer relevant but preserved historically.

Trace:

- Vision Philosophy 3.4 and 3.7.
- Vision Engineering Value: learning as a first-class output.
- Reference Architecture 3.7.

---

## 11. Historical Knowledge and Bias Control

Historical knowledge improves reasoning, but it must not trap Architecture Doctor in old assumptions.

### 11.1 Valid Uses of History

Historical knowledge may:

- Provide context for current findings.
- Identify repeated patterns.
- Inform confidence through stability or recurrence.
- Support impact assessment.
- Suggest likely remediation paths.
- Surface lessons from prior resolutions.
- Show trajectory and rate of architectural change.

### 11.2 Invalid Uses of History

Historical knowledge must not:

- Treat past failure as proof of current failure.
- Treat past stability as proof of current safety.
- Override current evidence.
- Bias severity upward because a capability has a bad reputation.
- Bias findings downward because a team previously accepted risk.
- Convert one-off incidents into general lessons without evidence.
- Use historical correlation as deterministic prediction.

### 11.3 Bias Controls

Architecture Doctor controls historical bias by:

- Separating current evidence from historical context.
- Labelling historical reasoning as historical.
- Requiring current evidence for current findings.
- Requiring confidence and uncertainty on historical analogies.
- Preserving positive and negative outcomes.
- Distinguishing recurrence from causation.
- Requiring human governance before turning lessons into policy.

Trace:

- Vision Phase 2 and Phase 3.
- Vision Principle 1.
- Vision Section 14: AI as historian and simulation partner.

---

## 12. AI in the Reasoning Model

AI participates in Architecture Doctor reasoning only below the human authority ceiling.

### 12.1 Permitted AI Roles

AI may act as:

- Interpreter: translate structured findings into technical, business, audit, or leadership language.
- Historian: surface patterns from graph-backed history.
- Simulation Partner: suggest possible downstream effects from analogous evidence.
- Documentation Author: draft reports, summaries, explanations, and recommendations from structured data.
- Triage Assistant: group related findings and propose root-cause hypotheses.

### 12.2 Prohibited AI Roles

AI must not:

- Accept or close a baseline.
- Grant or revoke an exception.
- Change enforcement mode.
- Determine critical severity without deterministic basis.
- Override a policy.
- Suppress a finding.
- Treat generated prose as evidence.
- Convert a lesson into policy.
- Take production action.
- Reason about business value without grounded data.

### 12.3 AI Output Status

AI output is never automatically fact, evidence, governance, or policy.

AI output may be:

- Explanation draft.
- Recommendation draft.
- Pattern candidate.
- Root-cause hypothesis.
- Impact hypothesis.
- Lesson candidate.
- Report draft.

AI output must:

- Cite the structured data it used.
- Preserve uncertainty.
- Distinguish fact from interpretation.
- Avoid increasing confidence.
- Remain reviewable by humans.

Trace:

- Vision Section 14.
- Reference Architecture 3.7.
- Canonical Domain Model 11.1, 11.2, and 18.

---

## 13. Explainability, Auditability, Reproducibility, and Determinism

Architecture Doctor reasoning must be explainable, auditable, reproducible, and deterministic wherever possible.

### 13.1 Explainability

Every conclusion must answer:

- What is the conclusion?
- What intent, policy, control, or capability does it relate to?
- What evidence supports it?
- What evidence refutes or complicates it?
- What confidence applies?
- What risk applies?
- What uncertainty remains?
- What action is recommended?
- Who or what is affected?

### 13.2 Auditability

Every conclusion must preserve:

- Evidence provenance.
- Source identity.
- Timepoint.
- Scope.
- Rule or reasoning basis.
- Confidence basis.
- Governance history where applicable.
- Report or delivery surface where rendered.

### 13.3 Reproducibility

A reasoning outcome should be reproducible when:

- The same intent is used.
- The same observations and evidence are used.
- The same rules and policies are active.
- The same plugin contracts and limitations apply.
- The same governance state applies.

When reproducibility is not possible because reasoning included AI interpretation, changing external evidence, or human judgment, that limitation must be explicit.

### 13.4 Determinism

Deterministic reasoning is preferred for:

- Evidence admission rules.
- Critical finding thresholds.
- Enforcement eligibility.
- Baseline expiry.
- Exception review requirements.
- Policy applicability.
- Provenance requirements.

Non-deterministic or heuristic reasoning may support:

- Triage.
- Grouping.
- Explanation drafting.
- Impact hypotheses.
- Pattern discovery.
- Lesson candidates.

Non-deterministic reasoning must not be the sole basis for critical findings, blocking, enforcement escalation, or consequential governance.

Trace:

- Vision Principle 2.
- Vision Section 13.
- Vision Section 14.
- Canonical Domain Model 15.4: Provenance.

---

## 14. Evidence and Provenance Traceability

Every conclusion must trace back to explicit evidence and provenance.

Traceability requires:

- The conclusion being made.
- The claim or claims behind the conclusion.
- The evidence supporting each claim.
- The observations behind the evidence.
- The source of each observation.
- The timepoint of each observation.
- The rule, policy, control, or reasoning basis used.
- The confidence assigned and why.
- The risk assigned and why.
- Contradictory or limiting evidence.
- Any governance event that changed state.
- Any AI-generated interpretation used in presentation.

Traceability failures:

- Unsupported conclusion.
- Missing provenance.
- Missing scope.
- Missing confidence.
- Hidden contradiction.
- Unclear distinction between fact and recommendation.
- AI prose treated as evidence.
- Report-only knowledge.

If traceability fails, the conclusion must be downgraded, withheld, or marked as exploratory.

Trace:

- Vision Principle 1.
- Vision Principle 8.
- Reference Architecture 6.

---

## 15. Plugin Participation in Reasoning

Plugins participate in reasoning by contributing canonical domain objects and bounded reasoning, not by inventing private logic.

### 15.1 Plugin Reasoning Contract

Every plugin that participates in reasoning must declare:

- What it observes.
- What observations it emits.
- Which observations may become evidence.
- Which claims it can support or refute.
- Which rules or policies it evaluates.
- Which finding types it can produce.
- Which confidence model it uses.
- Which risk dimensions it can express.
- Which limitations apply.
- Which contradictions it can detect.
- Which knowledge nodes and edges it can publish.
- Which reasoning steps are deterministic, heuristic, or AI-assisted.
- Which outputs are exploratory, advisory, warn-capable, or block-capable.

### 15.2 Plugin Reasoning Constraints

Plugins must:

- Use canonical terms.
- Preserve provenance.
- Emit observations before evidence where applicable.
- Declare confidence and limitations.
- Map technical observations to capability-level meaning.
- Preserve contradictory evidence.
- Produce graph-representable knowledge.
- Respect progressive enforcement.
- Respect human authority.

Plugins must not:

- Emit findings without evidence.
- Emit findings without recommendation.
- Emit critical findings from heuristic evidence alone.
- Raise confidence through private logic that cannot be explained.
- Hide source limitations.
- Suppress contradictory evidence.
- Create baselines, exceptions, or enforcement changes autonomously.
- Treat plugin-specific terminology as canonical without mapping.

Trace:

- Vision Section 15.
- Reference Architecture 3.9.
- Canonical Domain Model 19: Plugin Language Compliance.

---

## 16. Belief Revision

Architecture Doctor maintains beliefs as revisable knowledge, not immutable conclusions.

A belief is any current accepted reasoning state, including:

- Asset-to-capability mapping.
- Evidence admission.
- Claim support.
- Finding status.
- Confidence level.
- Risk assessment.
- Recommendation.
- Health state.
- Root-cause hypothesis.
- Insight.
- Lesson candidate.

### 16.1 Revision Triggers

Beliefs must be reconsidered when:

- New observations arrive.
- Evidence is admitted, invalidated, superseded, or contested.
- Intent changes.
- Atlas state changes.
- Policy changes.
- Governance events occur.
- Plugin limitations change.
- Source reliability changes.
- Contradictory evidence appears.
- Resolution outcomes confirm or disprove expected remediation.
- Historical patterns mature or weaken.

### 16.2 Revision Rules

When revising beliefs, Architecture Doctor must:

- Preserve prior state historically.
- Identify what changed.
- Identify why the change matters.
- Recalculate confidence where needed.
- Reassess risk where needed.
- Reopen findings if resolved assumptions become false.
- Supersede recommendations if evidence changes.
- Notify governance surfaces when consequential state changes.
- Publish revised knowledge to the graph.

### 16.3 Non-Destructive Revision

Revision does not erase history.

If a finding is resolved, it remains historical knowledge. If a claim is refuted, the original claim remains part of reasoning history. If a baseline expires, the baseline remains a governance event. If a lesson is superseded, it remains part of organisational learning history with superseded status.

Trace:

- Vision Philosophy 3.4 and 3.7.
- Vision Principle 8.
- Canonical Domain Model 14 and 18.

---

## 17. Knowledge Maturation into Organisational Learning

Architectural knowledge matures over time.

### 17.1 Maturity Stages

Knowledge may mature through these stages:

- Observation: something was seen.
- Evidence: the observation became admissible for reasoning.
- Claim: the evidence supported or refuted an assertion.
- Finding: the claim revealed an architectural concern.
- Governed Decision: humans decided how to handle the concern.
- Resolution Outcome: remediation, acceptance, exception, or expiry produced a result.
- Pattern: similar evidence or findings recurred.
- Insight: the pattern revealed higher-level architectural meaning.
- Lesson Candidate: Architecture Doctor proposes what should be learned.
- Lesson: humans accept evidence-backed learning.
- Policy or Convention Candidate: a lesson suggests a change to governance.
- Governed Policy or Convention: humans promote learning into durable expectation.

### 17.2 Learning Requirements

A Lesson must:

- Cite evidence or historical basis.
- Identify scope.
- Identify confidence.
- Identify limitations.
- Distinguish pattern from causation.
- Explain what future reasoning should do differently.
- Remain separate from policy until governed.

### 17.3 Learning Feedback

Lessons may influence future reasoning by:

- Improving recommendations.
- Identifying recurring root causes.
- Informing policy candidates.
- Improving onboarding and explanations.
- Suggesting new controls.
- Improving plugin confidence models.
- Highlighting architectural patterns that deserve attention.

Lessons must not:

- Override current evidence.
- Create findings without current evidence.
- Become enforcement rules without governance.
- Bias severity without evidence.

Trace:

- Vision Engineering Value: learning as a first-class output.
- Vision Phase 3: architectural memory.
- Canonical Domain Model 10.3.

---

## 18. Reasoning Invariants

Every reasoning engine, plugin, AI capability, governance workflow, and reporting surface must satisfy these invariants:

- Reasoning starts from declared intent or observed reality and preserves the distinction between them.
- Raw observations are not evidence until admitted.
- Evidence must have provenance.
- Evidence must identify the claim it supports or refutes.
- Claims must have scope, confidence, evidence basis, and uncertainty.
- Findings must have evidence, confidence, risk, recommendation, and capability or business-loop context.
- Critical findings require very high or deterministic confidence.
- Contradictory evidence must be preserved.
- Contradiction must affect confidence unless resolved by scope, time, or source authority.
- Recommendations must be actionable and traceable.
- Governance decisions must be attributable and must not erase historical truth.
- Knowledge must be graph-backed or graph-representable.
- Reports render knowledge; they do not own knowledge.
- Historical knowledge may inform reasoning but must not override current evidence.
- AI may assist interpretation, triage, simulation, documentation, and pattern discovery, but may not make consequential governance decisions.
- Plugin reasoning must use canonical domain language.
- Plugin-specific logic must declare limitations, confidence behavior, and provenance.
- Beliefs must be revisable when new evidence arrives.
- Revisions must preserve prior state historically.
- Lessons must be evidence-backed and scoped.
- Lessons do not become policy without governance.
- Every conclusion must trace to explicit evidence and provenance.
- Reasoning must be deterministic wherever the consequence is enforcement, critical severity, baseline expiry, exception review, or policy applicability.
- Heuristic reasoning must be labelled and must not be the sole basis for blocking or critical findings.
- The business capability remains the unit of architectural meaning.
- Human judgment remains the authority ceiling.

Trace:

- Vision Philosophy 3.1 through 3.8.
- Vision Principles 1 through 8.
- Reference Architecture 3.7 and 6.
- Canonical Domain Model 18.

---

## 19. Reasoning Model Summary

Architecture Doctor thinks by preserving the chain from intent to learning.

It observes reality, admits evidence, forms claims, opens findings, recommends action, records governance, publishes knowledge, and matures repeated patterns into organisational learning. At every step it carries uncertainty, provenance, contradiction, scope, confidence, and human authority forward.

Its reasoning is not a private judgment engine. It is an explainable, auditable, evidence-backed discipline for turning architectural reality into durable organisational knowledge.

Every future Architecture Doctor capability must follow this model.
