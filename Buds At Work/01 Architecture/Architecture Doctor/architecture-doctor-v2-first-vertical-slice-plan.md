# Architecture Doctor v2 - First Vertical Slice Plan

Version: 1.0
Status: Implementation Planning
Date: 2026-07-10
Constitutional authority: Architecture Doctor Constitution v1.0

---

## 1. Purpose

This document plans the first executable Architecture Doctor v2 vertical slice.

It does not implement the platform. It defines the smallest complete implementation that proves the constitutional architecture end to end:

Intent -> Observation -> Evidence -> Claim -> Finding -> Recommendation -> Governance Event -> Knowledge publication -> Report generation

The slice must remain advisory-only. It must not add runtime verification, AI reasoning, predictive capability, external plugins, broad enforcement, or a full platform rewrite.

---

## 2. Chosen Capability

The first slice should use:

**C02 - Quote Pricing and Checkout**

Reason:

- It is explicitly declared in the Business Capability Atlas.
- It is business-critical and easy to explain in business language: customers cannot pay if quote and checkout architecture drifts.
- It has concrete static API-route intent in the Atlas.
- It has existing repository route assets that the current v1 scanner already discovers.
- It is narrow enough to prove the reasoning lifecycle without runtime checks.
- It exercises Atlas-versus-repository verification without requiring new business doctrine.

The first asset class should be:

**API routes only**

Reason:

- API routes are already represented in the Atlas.
- API routes are already discoverable through `scanRepository`.
- API route existence is deterministic enough for a first evidence source.
- The slice can prove both supported claims and drift claims.
- It avoids table, RLS, dependency, runtime, and behaviour complexity.

---

## 3. Slice Boundary

This slice verifies only:

- Atlas-declared C02 API routes.
- Repository-observed API route files.
- Whether each C02 Atlas route has a matching repository route.
- Whether selected observed quote/checkout API routes map back to C02 intent.
- Advisory finding creation for missing or unmapped route coverage.
- Human-governance event recording for acknowledgement or baseline.
- Knowledge publication as graph-representable JSON.
- A small markdown report rendered from canonical knowledge.

This slice intentionally does not verify:

- Whether routes behave correctly.
- Whether checkout works.
- Whether Stripe, PayPal, or Supabase calls are correct.
- Whether paid quotes become orders.
- RLS.
- Dependency cycles.
- Ownership quality beyond C02 owner attribution from the Atlas.
- Runtime health.
- Production state.
- AI reasoning.
- Predictive impact.
- Plugin admission.
- Dashboard UI.
- CI blocking.

---

## 4. Detailed Implementation Plan

### Step 1: Establish v2 Slice Boundary

Create a v2 namespace inside the existing Architecture Doctor library so the slice can coexist with v1.x.

Purpose:

- Avoid destabilising the current v1 tool.
- Make v2 canonical concepts explicit.
- Allow tests to prove the new reasoning chain independently.

Outcome:

- A small v2 slice runner can be invoked without changing the existing v1 `architecture-doctor.ts` behaviour.

### Step 2: Define Canonical Slice Types

Define minimal canonical data contracts for this slice only:

- `SliceIntent`
- `SliceObservation`
- `SliceEvidence`
- `SliceClaim`
- `SliceFinding`
- `SliceRecommendation`
- `SliceGovernanceEvent`
- `SliceKnowledgeNode`
- `SliceKnowledgeEdge`
- `SliceReport`
- `SliceVerificationRun`

Purpose:

- Prove the Canonical Domain Model in executable form.
- Keep the first implementation small.
- Avoid importing all future v2 concepts before they are needed.

Constraint:

- These types must map directly to the Canonical Domain Model terms.
- They must not reuse v1 `DriftFinding` as the primary v2 finding shape.
- v1 findings may be used as migration reference only.

### Step 3: Build Intent Extraction for C02 API Routes

Use existing `parseAtlasFile` / `parseAtlas` as the source of declared intent.

The slice extracts:

- Capability id: `C02`
- Capability name: `Quote Pricing and Checkout`
- Owner: Atlas owner field.
- Source path: Atlas file path.
- Declared API routes from C02.
- Intent scope: `capability:C02`, `assetKind:apiRoute`.

Purpose:

- Prove intent is explicit, sourced, scoped, and separate from observation.

### Step 4: Build API Route Observation Collection

Use existing `scanRepository` as the observation source, but wrap its output as raw v2 observations.

The slice records:

- Observed route path.
- Source: repository scan.
- Asset kind: `apiRoute`.
- Timepoint.
- Collection scope.
- Source limitation: static file presence only; no behaviour verified.

Purpose:

- Prove observations are raw records, not evidence or findings.

### Step 5: Admit Evidence

Convert relevant observations into evidence for specific claims.

Evidence examples:

- Observation `/api/quotes` supports claim that C02 declared route `/api/quotes` is present.
- Absence of an observed route for Atlas-declared `/api/checkout` supports claim that C02 declared route `/api/checkout` is not observed.
- Observation `/api/quotes/[id]/checkout` supports claim that repository route maps to C02 declared intent.

Purpose:

- Prove observation-to-evidence admission.
- Attach provenance and confidence before any claim becomes a finding.

Confidence:

- `Deterministic` for exact route-file presence under the static route scanner scope.
- `High` for simple dynamic route pattern matching where pattern semantics are explicit.
- `Medium` or lower for wildcard, narrative, or ambiguous Atlas entries.

### Step 6: Form Claims

Create claims for C02 route coverage.

Claim types:

- `declared_api_route_observed`
- `declared_api_route_not_observed`
- `observed_api_route_declared`
- `observed_api_route_unmapped`

Each claim must include:

- Subject route.
- Capability scope.
- Claim predicate.
- Supporting or refuting evidence.
- Confidence.
- Provenance.
- Uncertainty.

Purpose:

- Prove evidence is interpreted through explicit claims before producing findings.

### Step 7: Create Findings

Create findings only for claims that reveal architectural drift.

Initial finding types:

- `declared_route_missing_observation`
- `observed_route_unmapped_to_intent`

Finding requirements:

- Capability context: C02 or unresolved mapping.
- Evidence links.
- Confidence.
- Risk.
- Severity.
- Recommendation.
- Technical explanation.
- Business impact explanation.
- Advisory enforcement mode.

Recommended severity:

- Missing declared C02 quote/checkout route: `high` when the route is exact and critical to quote/payment flow.
- Unmapped observed quote route: `low` or `medium` depending on naming clarity and confidence.

Purpose:

- Prove findings are not raw scanner output.
- Prove findings are capability-centred and recommendation-backed.

### Step 8: Generate Recommendations

For each finding, generate a deterministic recommendation.

Recommendation examples:

- For missing declared route: "Confirm whether the Atlas intent is stale or restore/document the route. If the route was intentionally removed, update the Atlas through governance."
- For unmapped observed route: "Add this route to C02 in the Atlas or record why it belongs to another capability."

Each recommendation must include:

- Required decision.
- Suggested remediation path.
- Verification criteria.
- Risk reduction.
- Confidence and uncertainty.

Purpose:

- Prove findings are closeable, not alarms.

### Step 9: Record a Governance Event

Create a governance event for the slice output.

For the first executable slice, this should be deterministic and local:

- Event type: `slice_advisory_review_recorded`
- Actor: explicit provided value, defaulting to a required placeholder in tests and CLI planning.
- Rationale: explicit provided value.
- Scope: `capability:C02`, `assetKind:apiRoute`, verification run id.
- Timepoint.
- Affected finding ids.
- Decision: `acknowledged`, `baseline_requested`, `rejected`, or `needs_review`.

Constraint:

- No automatic baseline acceptance.
- No enforcement change.
- No blocking.

Purpose:

- Prove human-governance memory exists even in the smallest slice.

### Step 10: Publish Knowledge

Publish graph-representable knowledge records.

Knowledge nodes:

- Capability node for C02.
- Intent nodes for declared C02 API routes.
- Observation nodes for observed API routes.
- Evidence nodes.
- Claim nodes.
- Finding nodes.
- Recommendation nodes.
- Governance event node.
- Verification run node.

Knowledge edges:

- Capability declares intent.
- Observation derives evidence.
- Evidence supports claim.
- Evidence refutes claim.
- Claim produces finding.
- Finding affects capability.
- Finding has recommendation.
- Governance event reviews finding.
- Report renders knowledge.

Output:

- A deterministic JSON artifact in the Architecture Doctor output directory.

Purpose:

- Prove findings belong to knowledge, not reports.

### Step 11: Generate Report

Render a small markdown report from the knowledge output.

Report sections:

- Verification run summary.
- Capability intent summary.
- Observation summary.
- Evidence summary.
- Claims.
- Findings.
- Recommendations.
- Governance event.
- Traceability table.
- Limitations.

Purpose:

- Prove reports are renderings of knowledge, not the source of truth.

---

## 5. Files to Create or Modify

### Create

`src/lib/architecture-doctor/v2/domain.ts`

- Minimal canonical slice types.
- Confidence, risk, severity, lifecycle, and provenance vocabulary for the slice.

`src/lib/architecture-doctor/v2/c02-route-slice.ts`

- Orchestrates the first vertical slice.
- Composes intent extraction, observation wrapping, evidence admission, claim formation, finding generation, governance event creation, knowledge publication, and report rendering.

`src/lib/architecture-doctor/v2/intent.ts`

- Extracts C02 API-route intent from the parsed Atlas.
- Keeps declared intent separate from observed reality.

`src/lib/architecture-doctor/v2/observations.ts`

- Wraps `scanRepository` API route results as raw observations.
- Does not admit evidence or create findings.

`src/lib/architecture-doctor/v2/evidence.ts`

- Admits route observations as evidence for specific C02 route claims.
- Records confidence, provenance, and limitations.

`src/lib/architecture-doctor/v2/claims.ts`

- Produces explicit route coverage claims.
- Handles supported, refuted, and unresolved claim status.

`src/lib/architecture-doctor/v2/findings.ts`

- Converts drift claims into findings.
- Requires evidence, risk, confidence, capability context, and recommendation.

`src/lib/architecture-doctor/v2/recommendations.ts`

- Produces deterministic recommendations for the initial finding types.

`src/lib/architecture-doctor/v2/governance.ts`

- Creates advisory governance events for the slice.
- Does not accept baselines automatically.

`src/lib/architecture-doctor/v2/knowledge.ts`

- Converts slice entities into graph-representable knowledge nodes and edges.

`src/lib/architecture-doctor/v2/report.ts`

- Renders the slice markdown report from knowledge and canonical entities.

`src/lib/architecture-doctor/v2/index.ts`

- Public entry point for the v2 vertical slice.

`scripts/architecture-doctor-v2-slice.ts`

- CLI runner for the first vertical slice only.
- Reads Atlas and repository.
- Writes v2 slice JSON and markdown artifacts.
- Runs advisory-only.

`tests/lib/architecture-doctor-v2-slice.test.ts`

- Unit and slice tests for the complete lifecycle.

### Modify

`package.json`

- Add a script for the v2 slice runner, for example an advisory-only `architecture:doctor:v2:slice` command.

`tsconfig.json` or existing test config

- Only if the new v2 path needs test alias support beyond the current project setup.

`Buds At Work/01 Architecture/Architecture Doctor/`

- Add generated slice artifacts when the runner is executed:
  - `architecture-doctor-v2-slice-knowledge.json`
  - `architecture-doctor-v2-slice-report.md`

### Do Not Modify in This Slice

- Existing v1 `scripts/architecture-doctor.ts`.
- Existing v1 health report generation.
- Existing enforcement policy behaviour.
- Existing baseline promotion workflow.
- Dashboard UI.
- Runtime API routes.
- Production application code.
- Agent runtime.
- Graphify production integration.

---

## 6. Component Interfaces

These are conceptual interfaces, not final implementation schemas.

### Intent Extractor

Input:

- Parsed `AtlasSpec`.
- Capability id `C02`.
- Asset kind `apiRoute`.

Output:

- `SliceIntent[]`.

Contract:

- Intent must include source path, capability, scope, declared route, owner, and timepoint.
- Missing capability is a planning failure for this slice.

### Observation Collector

Input:

- `ArchitectureInventory` from `scanRepository`.
- Verification run scope.

Output:

- `SliceObservation[]`.

Contract:

- Observations must include route path, source, source method, timepoint, and limitation.
- Observations must not include claim, finding, or recommendation semantics.

### Evidence Admission

Input:

- `SliceIntent[]`.
- `SliceObservation[]`.

Output:

- `SliceEvidence[]`.

Contract:

- Evidence must link to a candidate claim.
- Evidence must include confidence and provenance.
- Evidence must preserve absence evidence for declared routes not observed.

### Claim Engine

Input:

- `SliceIntent[]`.
- `SliceObservation[]`.
- `SliceEvidence[]`.

Output:

- `SliceClaim[]`.

Contract:

- Claims must be explicit assertions.
- Claims must be scoped to C02 API routes.
- Claims must be supported, refuted, contested, or unresolved.

### Finding Engine

Input:

- `SliceClaim[]`.
- `SliceEvidence[]`.
- C02 capability intent.

Output:

- `SliceFinding[]`.

Contract:

- Findings require evidence, confidence, risk, severity, capability context, and recommendation placeholder.
- Findings must remain advisory.

### Recommendation Engine

Input:

- `SliceFinding[]`.
- `SliceClaim[]`.
- `SliceIntent[]`.

Output:

- `SliceRecommendation[]`.

Contract:

- Every finding gets exactly one initial deterministic recommendation.
- Recommendation must include verification criteria.

### Governance Event Recorder

Input:

- Verification run.
- Findings.
- Actor.
- Rationale.
- Decision.

Output:

- `SliceGovernanceEvent`.

Contract:

- Governance event must be attributable.
- No automatic baseline or exception is created.

### Knowledge Publisher

Input:

- Verification run.
- Intent, observations, evidence, claims, findings, recommendations, governance event.

Output:

- Knowledge nodes and edges.

Contract:

- Every finding and reportable conclusion must be graph-representable.
- Knowledge preserves provenance and lifecycle state.

### Report Renderer

Input:

- Knowledge publication.
- Slice entities.

Output:

- Markdown report.

Contract:

- Report must render knowledge.
- Report must not introduce new conclusions.
- Report must include traceability.

---

## 7. Data Flow

1. CLI runner starts a verification run with scope `capability:C02`, `assetKind:apiRoute`, advisory mode.
2. Atlas parser reads the Business Capability Atlas.
3. Intent extractor selects C02 and emits declared API-route intent.
4. Repository scanner discovers API routes.
5. Observation collector wraps discovered routes as raw observations.
6. Evidence admission compares C02 declared routes with observed API routes and emits evidence records.
7. Claim engine creates route coverage claims.
8. Finding engine turns drift claims into advisory findings.
9. Recommendation engine attaches deterministic remediation guidance.
10. Governance recorder records the advisory review event.
11. Knowledge publisher emits graph-representable nodes and edges.
12. Report renderer creates markdown from the knowledge publication.
13. CLI writes JSON knowledge and markdown report artifacts.

Data flow invariant:

No downstream stage may infer facts from raw observations directly. Every conclusion must pass through evidence and claim stages.

---

## 8. Test Strategy

### Unit Tests

Intent extraction:

- Extracts C02 from the real Atlas.
- Captures declared API routes.
- Preserves owner, source path, and scope.
- Fails clearly if C02 is absent.

Observation collection:

- Converts scanner API routes into observations.
- Preserves source method and timepoint.
- Does not produce evidence or findings.

Evidence admission:

- Exact route match creates deterministic/high confidence supporting evidence.
- Missing declared route creates absence evidence with provenance.
- Ambiguous or wildcard route patterns are marked with lower confidence or excluded with limitation.

Claim formation:

- Present declared routes produce supported claims.
- Missing declared routes produce refuted claims.
- Observed unmapped routes produce unmapped claims only within slice scope.

Finding generation:

- Missing declared exact route produces advisory finding.
- Findings cannot be created without evidence.
- Findings cannot be created without recommendation linkage.
- Critical severity is not produced in this slice.

Recommendation generation:

- Each finding receives one deterministic recommendation.
- Recommendation cites the relevant intent/evidence.

Governance event:

- Requires actor, rationale, scope, decision, and timepoint.
- Does not create baseline automatically.

Knowledge publication:

- Emits nodes for each canonical entity.
- Emits typed edges for the reasoning chain.
- Every finding has evidence, recommendation, and capability edges.

Report rendering:

- Report includes traceability table.
- Report renders from entities/knowledge only.
- Report does not create extra findings.

### Golden Slice Tests

Use synthetic Atlas and synthetic inventory fixtures:

1. Happy path: all C02 declared routes observed.
2. Missing route: one declared route absent from inventory.
3. Unmapped route: inventory contains quote-like route not declared in Atlas.
4. Contradiction candidate: route appears under repository but Atlas omits it.
5. Governance event: findings reviewed as `needs_review`.

### Real Repo Smoke Test

Run the slice against:

- `Buds At Work/01 Architecture/Bud OS Business Capability Atlas 2026-07-08.md`
- Current repository inventory.

Expect:

- C02 intent is extracted.
- API route observations are produced.
- Knowledge JSON is produced.
- Markdown report is produced.
- No blocking enforcement occurs.

### Constitutional Tests

Explicit tests should assert:

- Observation is distinct from evidence.
- Evidence is distinct from claim.
- Claim is distinct from finding.
- Finding has recommendation.
- Governance event is attributable.
- Report is not primary knowledge.
- Every conclusion has provenance.

---

## 9. Acceptance Criteria

The slice is accepted when:

- It runs from a single advisory CLI command.
- It only analyses C02 API routes.
- It produces intent, observation, evidence, claim, finding, recommendation, governance event, knowledge, and report outputs.
- It writes a graph-representable knowledge JSON artifact.
- It writes a markdown report rendered from the canonical slice output.
- Every finding has capability context, evidence, confidence, risk, severity, and recommendation.
- Every recommendation has verification criteria.
- Every governance event has actor, rationale, scope, timepoint, and affected finding references.
- Every report conclusion traces back to evidence provenance.
- The same fixture input produces deterministic output apart from explicit timepoint fields.
- The slice remains advisory-only.
- Existing v1 Architecture Doctor behaviour is unchanged.
- Tests cover happy path, missing route, unmapped route, governance event, and report traceability.

---

## 10. Risks

### Risk: The slice becomes a v1 drift report wrapper

Mitigation:

- Do not reuse `DriftFinding` as the v2 primary model.
- Use v1 parser/scanner only as input providers.
- Force every output through canonical v2 entities.

### Risk: Route existence is too shallow to feel meaningful

Mitigation:

- State the limitation clearly.
- Use the slice to prove reasoning architecture, not complete architecture coverage.
- Keep runtime and behaviour checks deferred.

### Risk: Missing Atlas route may be stale intent, not repo failure

Mitigation:

- Model the finding as intent/reality drift.
- Recommendation must ask whether Atlas or repository should change.
- Do not claim the code is wrong without governance.

### Risk: Knowledge publication is overbuilt too early

Mitigation:

- Publish graph-representable JSON nodes and edges first.
- Do not integrate deeply with Graphify in this slice.

### Risk: Governance event becomes fake human judgment

Mitigation:

- Require actor and rationale explicitly.
- Use `needs_review` or `acknowledged` as the default planning decision.
- Do not auto-accept baselines.

### Risk: Scope creeps into tables, RLS, checkout behaviour, or AI

Mitigation:

- Hard-code slice scope to C02 API routes in the runner.
- Add tests that assert unsupported asset kinds are ignored.
- Keep all non-slice engines out of the CLI.

---

## 11. Why This Slice Proves the Constitutional Architecture

This slice proves the constitution because it exercises the complete reasoning lifecycle with the smallest useful architectural surface:

- Intent: C02 API routes from the Atlas.
- Observation: repository API route files from static scan.
- Evidence: route observations admitted for specific route coverage claims.
- Claim: explicit assertions about declared route presence or drift.
- Finding: advisory architectural drift finding with capability context.
- Recommendation: closeable remediation guidance.
- Governance Event: attributed human review record.
- Knowledge publication: graph-representable nodes and edges.
- Report generation: markdown rendered from canonical knowledge.

It also proves the constitutional constraints:

- Business capability is the unit of architecture.
- Static analysis is the floor.
- Atlas disagreement is investigated, not treated as automatic code fault.
- Findings are evidence-backed and recommendation-backed.
- Governance is human-attributed.
- Knowledge exists before report rendering.
- Enforcement is advisory-only.
- No AI, runtime verification, prediction, plugin system, or broad platform complexity is needed.

The slice is intentionally small. Its value is not coverage breadth; its value is proving that Architecture Doctor v2 can think constitutionally in executable form.
