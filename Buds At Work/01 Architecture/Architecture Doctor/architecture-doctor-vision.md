# Architecture Doctor — Vision & Principles

*The constitutional foundation for Architecture Doctor.*
*Every future design decision is subordinate to this document.*

Version: 1.0
Status: Constitutional — requires founding-author approval to amend
Date: 2026-07-09

---

## Preamble

Software systems degrade silently.

Not through dramatic failures — through the accumulation of small, individually reasonable decisions that, in aggregate, produce a system nobody fully understands, nobody can confidently change, and nobody can clearly explain to a business stakeholder.

Architecture Doctor exists because the gap between *what a system is supposed to be* and *what it actually is* grows invisibly, and that gap has real consequences: production incidents, lost revenue, compliance exposure, engineer turnover, and the slow death of engineering velocity.

This document defines what Architecture Doctor is, what it believes, how it should behave, and why it exists. It is not a technical specification. It is a founding manifesto — the document that future Architecture Doctor contributors should read before writing a single line of code, and that should govern every capability decision for the decade ahead.

---

## 1. Mission

**Architecture Doctor's mission is to make the gap between architectural intent and system reality visible, measurable, and closeable — at every stage of the development lifecycle.**

Not just when something breaks. Not just before a release. At every moment, for every engineer, in every context where an architectural decision is made.

---

## 2. Purpose

Architecture Doctor exists to solve a problem that no existing tool addresses directly:

*The difference between what you intend your system to be and what it actually is.*

Every engineering team has an intended architecture. It lives in the minds of senior engineers, in architecture documents, in convention rules, in onboarding guides, in review comments. It is never fully written down. It is never fully enforced. It degrades in proportion to team size, velocity, and time.

The purpose of Architecture Doctor is to externalise that intent — to give it a concrete, verifiable form — and then to continuously verify that the system being built matches it.

This is not code quality analysis. This is *architectural truth verification.*

The problems Architecture Doctor exists to solve are:

**1. Invisible drift.** The system becomes something different from what was intended, gradually and without any single decision being wrong.

**2. Unverifiable ownership.** Nobody knows who is responsible for what, so nobody maintains it. Capabilities without owners decay.

**3. Governance without memory.** Teams make the same mistakes repeatedly because decisions, exceptions, and their rationale are not preserved in a form that survives personnel change.

**4. Business-architecture disconnection.** Engineers understand the technical system. Business stakeholders understand outcomes. Neither group can speak to the other's concerns without translation, and that translation is lost in most governance systems.

**5. Reactive governance.** Architectural problems are discovered in production, in postmortems, or during audits — never at the moment when they could be cheaply prevented.

**6. The audit cliff.** When compliance, security, or a new team member asks "how does the system work?", the answer requires weeks of archaeology. Architecture Doctor should make that answer immediately available.

---

## 3. Philosophy

Architecture Doctor is built on eight philosophical convictions. These are not preferences — they are foundational beliefs about what good engineering governance looks like.

### 3.1 Intent is primary; structure is evidence

What matters is whether a system does what it is supposed to do. Structure — file locations, import graphs, table names, route patterns — is *evidence* for or against intent. Architecture Doctor reasons from evidence to intent, not from structure to structure. A check that verifies a file exists is not an architectural check. A check that verifies the system exhibits the intended capability is.

### 3.2 Governance must move at the speed of development

A governance system that runs quarterly, or only on release branches, or only when an auditor asks for it, is not a governance system. It is archaeology. Architecture Doctor must operate at the same cadence as development — on every commit, on every PR, in real time where possible. Governance that lags development is governance that is always wrong.

### 3.3 The business capability is the unit of architecture

Lines of code are not the unit of architecture. Files are not the unit of architecture. Microservices are not the unit of architecture. The unit of architecture is the business capability — the thing the system does that has value to a customer or to the business. Architecture Doctor reasons in terms of capabilities, maps everything else to them, and attributes all findings to the capability they affect.

### 3.4 Architecture has a temporal dimension

A health score that does not have a direction is less than half the information. A system at 80/100 that was at 85/100 three months ago is a different system than one that was at 70/100. Architecture Doctor must always understand not just the current state but the trajectory — is the system getting healthier or sicker, and at what rate?

### 3.5 All governance decisions must be attributable

Every exception, every accepted finding, every enforcement mode change, every policy amendment is a decision made by a human at a point in time for a stated reason. Architecture Doctor preserves all of these. There is no anonymous governance. There is no undocumented exception. The audit trail is not optional — it is the memory of the governance system.

### 3.6 Findings without recommended actions are alarms, not governance

An alarm that fires without telling you what to do trains people to ignore alarms. Every Architecture Doctor finding must come with enough context — what is at risk, what the remediation path looks like, how long remediation is likely to take — that the engineer receiving the finding can act, not just observe.

### 3.7 The system is a living entity, not a snapshot

Architecture Doctor is not a tool that produces a report. It is a continuous observer that maintains a living model of the system's architectural state. The model is updated on every scan. It has memory. It has history. It has the ability to reason across time. Reports are one output of that model. They are not the model itself.

### 3.8 Human judgment is irreplaceable, not optional

Architecture Doctor amplifies human judgment. It does not replace it. Every baseline acceptance, every enforcement mode change, every exception to a governance rule is a human decision, made with full context, recorded with full attribution. Architecture Doctor's role is to ensure that the human making the decision has the best possible information and that their decision is preserved. The moment Architecture Doctor acts without human approval on consequential decisions, it has exceeded its mandate.

---

## 4. Core Principles

These are the non-negotiable rules that govern every Architecture Doctor capability.

**Principle 1: Truth over comfort.**
Architecture Doctor reports what is true, not what teams want to hear. Health scores are not negotiated upward because a team is proud of their work. Findings are not suppressed because they are inconvenient. The score reflects reality. The governance function derives its value from its honesty.

**Principle 2: Precision over recall in critical findings.**
False positives in critical findings erode trust. Architecture Doctor would rather miss one real problem than report five false alarms. High-severity and critical findings must have a very high confidence threshold. Lower-severity findings can afford broader detection. The system must be calibrated accordingly.

**Principle 3: Blame-free, owner-aware.**
Architecture Doctor attributes findings to capabilities and capability owners, not to individual developers. Its purpose is to understand the system, not to assign fault. Every finding statement is written in terms of "this capability is missing X" not "this developer failed to add X."

**Principle 4: Progressive enforcement.**
Never block before informing. Never enforce before advising. The path from advisory → warn → block is deliberate and irreversible only when the evidence is overwhelming. Teams must have time to understand findings before those findings block work. The enforcement progression exists to build trust, not to bypass it.

**Principle 5: Baselines are temporary acknowledgments, not permanent approvals.**
Every accepted finding has an expiry. Every exception documents why it exists and when it will be reviewed. Architecture Doctor treats unexplained baselines as a governance failure. The baseline system is a pressure release valve, not an escape hatch.

**Principle 6: The Atlas is always slightly wrong.**
The Business Capability Atlas is the declared intent. Like all documentation, it is always slightly behind the system. Architecture Doctor must treat Atlas discrepancies as signals worth investigating, not as the final word on correctness. When the system and the Atlas disagree, both should be questioned.

**Principle 7: Static analysis is the floor, not the ceiling.**
Static analysis of files is the cheapest and fastest form of architectural verification. It is the foundation. But it is not sufficient. Architecture Doctor must evolve toward runtime verification, production state verification, and behavioral verification — while preserving static analysis as the always-on baseline.

**Principle 8: Findings belong to the knowledge graph, not to reports.**
A finding that lives only in a report is ephemeral. A finding that lives in the architecture knowledge graph is permanent, queryable, and can be reasoned about in relation to every other piece of architectural knowledge. Architecture Doctor should ultimately produce knowledge graph nodes, not markdown files. Reports are one rendering of that knowledge, not the knowledge itself.

---

## 5. Engineering Values

Architecture Doctor promotes and embodies these values in its own design and in the engineering culture it cultivates.

**Intentionality over accident.**
Great systems are built by intention. Architecture Doctor makes intentions explicit, verifiable, and permanent. It promotes a culture where "we decided this" replaces "this happened to end up this way."

**Simplicity as a structural property.**
A simpler system is more understandable, more maintainable, and more reliable. Architecture Doctor measures and tracks complexity not as a code metric but as a structural property — the complexity of capability relationships, the complexity of dependency graphs, the complexity of the path from a business question to a code answer.

**Ownership as a commitment, not an assignment.**
Declared ownership without consequence is noise. Architecture Doctor makes ownership consequential — findings route to owners, reviews are attributed to owners, governance decisions require owner sign-off. Ownership is a continuous responsibility, not a one-time label.

**Learning as a first-class output.**
Every Architecture Doctor run should make the engineering team more capable of making good architectural decisions. This means findings include rationale, not just verdicts. It means recurring patterns are named, documented, and added to the convention library. It means the team gets smarter as the system gets healthier.

**Transparency in trade-offs.**
Architecture Doctor never makes trade-offs silently. When a baseline is accepted, the trade-off is stated. When enforcement is relaxed, the risk is documented. When a capability scores poorly, the reason is specific. Engineers should never be surprised by an Architecture Doctor verdict.

---

## 6. Design Goals

When Architecture Doctor is well-designed, it exhibits these qualities:

**A new engineer understands the system from Architecture Doctor alone.**
Without reading the codebase, a developer joining the team can use Architecture Doctor's reports and the Atlas to understand what the system does, who owns what, where the risks are, and what the open questions are. The system is self-documenting through its governance artifacts.

**An auditor can generate a compliance report without human preparation.**
Architecture Doctor has gathered enough evidence — RLS policies, access controls, data classifications, retention policies, control verifications — that a compliance report can be generated automatically. The gap between "audit-ready" and "not audit-ready" is Architecture Doctor output, not manual collection.

**An engineering director can see architecture health in the same view as business outcomes.**
The highest-level view of Architecture Doctor is not technical. It is business-capability-level: which capabilities are healthy, which are at risk, what the trajectory is, and what the cost of not acting is. The technical detail exists below that layer, but the top-level view is business-intelligible.

**A developer making a change understands its architectural impact before merging.**
Architecture Doctor surfaces impact at PR time: which capabilities are affected, what the estimated score change is, what findings will be introduced or resolved, what the ownership implications are. The developer has full architectural context before their change merges.

**The system can explain any finding to a non-technical stakeholder.**
Every finding has two descriptions: a technical description for engineers, and a business-impact description for stakeholders. "This route is missing from the Atlas" means nothing to a business owner. "The quote submission API is undocumented — if it fails, there is no defined recovery path, and the revenue risk is high" is actionable.

---

## 7. Non-Goals

Architecture Doctor is explicitly not these things:

**Not a code quality tool.**
SonarQube, ESLint, and TypeScript already analyse code quality — style, complexity, type correctness. Architecture Doctor does not duplicate them. It reads *above* the code layer, at the level of capabilities, business loops, and architectural patterns. If a finding is best expressed as "this function has too many lines," it belongs in a linter, not Architecture Doctor.

**Not a security scanner.**
Semgrep and CodeQL find security vulnerabilities in code. Architecture Doctor identifies structural security properties — "is RLS enabled?", "is this route behind auth?", "is this table's access pattern consistent with its classification?" — but does not perform vulnerability scanning. It is a structural security verifier, not a penetration test.

**Not an operations monitoring tool.**
Datadog, Grafana, and Vercel Analytics monitor runtime behaviour. Architecture Doctor observes the architecture from which behaviour emerges. It may eventually connect to runtime data to inform its structural analysis, but it is not a monitoring platform.

**Not an autonomous agent.**
Architecture Doctor observes, measures, reports, and advises. It does not deploy code. It does not modify production data. It does not execute remediations without explicit human approval. Its autonomy ceiling is proposing a fix; its authority ceiling is advising a human to act.

**Not a project management tool.**
Architecture Doctor tracks architectural findings, not development tasks. It does not manage sprints, assign tickets, or track delivery timelines. When it produces a finding that requires remediation, that work flows into the team's existing task management system — Architecture Doctor does not own that workflow.

**Not a one-time audit.**
The value of Architecture Doctor is not in a single comprehensive scan. It is in the continuous verification of architectural health over time. A one-time audit produces a point-in-time snapshot that is stale the moment it is delivered. Architecture Doctor's value is precisely that it is never stale.

**Not a replacement for architectural thinking.**
Architecture Doctor cannot reason about the appropriateness of a design decision. It can verify that a design is consistent with declared intent, but it cannot evaluate whether that intent is good. The question "should we build this as a microservice or a module?" is a human question. Architecture Doctor can inform the answer with data, but it cannot give the answer.

---

## 8. Long-Term Vision — 5 to 10 Years

The 10-year vision for Architecture Doctor has three phases:

### Phase 1: Trusted Verifier (Years 1–2)

Architecture Doctor is the authoritative record of architectural intent and the continuous verifier of whether that intent is being honoured. Every finding is attributable, every exception is documented, every score change has a cause. Engineers trust it because it is honest, precise, and always current.

The Business Capability Atlas is the canonical architecture document, automatically synchronised with the system it describes. The architecture health score is a meaningful signal in every engineering and product conversation.

The platform can answer: *Is the system what we said it would be?*

### Phase 2: Predictive Advisor (Years 3–5)

Architecture Doctor has accumulated enough history to reason across time. It understands the rate of change of every capability, the velocity of architectural debt accumulation, and the historical correlation between specific structural signals and production incidents.

Before a team builds a new capability, Architecture Doctor simulates the architectural impact. Before a PR merges, Architecture Doctor predicts the risk of regression. The architecture health score has a direction, a velocity, and a 90-day forecast alongside the current value.

The compliance report generates automatically. The audit trail is queryable by any stakeholder. The technical debt ledger shows the cost in hours and estimated business risk of every open finding.

The platform can answer: *Where are we going, and what will it cost us to get there?*

### Phase 3: Architectural Intelligence (Years 5–10)

Architecture Doctor is no longer a tool — it is the architectural memory of the organisation. Its knowledge graph holds every capability, every decision, every exception, every finding, every resolution, every lesson learned across the full history of the system.

It can answer questions that currently require weeks of archaeology: "Why did we design the pricing engine this way?", "What was the last time this pattern caused a production incident?", "If we extract capability X into a separate service, what breaks?"

It supports prospective architectural design: teams describe what they intend to build and Architecture Doctor returns an impact assessment — not a simulation but an evidence-based analysis grounded in the history of similar architectural decisions in this codebase.

The platform can answer: *What does our architecture know about itself?*

---

## 9. How Architecture Doctor Should Evolve

Architecture Doctor's evolution follows an irreversible progression. It does not leap between phases — it validates each phase before entering the next.

**From reports to knowledge.**
Today Architecture Doctor produces files: JSON, markdown, CI exit codes. The first evolution is making every finding, every capability state, and every governance decision a node in the architecture knowledge graph — persistent, queryable, and connected to everything else that is known about the system. Reports become one rendering of the graph, not the primary artifact.

**From discovery to ownership.**
Today Architecture Doctor discovers what exists. The next evolution is attributing everything that exists to a human owner with ongoing accountability — not a label, but a living relationship that routes findings, requires review, and records decisions.

**From static to temporal.**
Today Architecture Doctor produces a snapshot. The next evolution is maintaining a time-aware model: every finding has a first-detected date, a trend, and a projected trajectory. Every capability has a health history. The question "is this getting better or worse?" has a data-backed answer at all times.

**From structural to behavioural.**
Today Architecture Doctor verifies structure (files exist, RLS is enabled, routes are mapped). The next evolution is verifying behaviour (this route is actually auth-protected in the request path, this business loop is actually observable, this capability is actually reliable under load). Structural analysis remains the always-on baseline; behavioural analysis supplements it at higher cost with higher confidence.

**From local to integrated.**
Today Architecture Doctor runs in isolation. The long-term evolution is deep integration with every system that has architectural implications: the knowledge graph, the agent fleet, the compliance framework, the production monitoring stack, the deployment pipeline. Architecture Doctor becomes the architectural nervous system, not a standalone scanner.

Each transition must be validated before the next begins. Speed of evolution is not a virtue. Trustworthiness of each phase is.

---

## 10. The Decisions It Should Help Engineers Make

Architecture Doctor's value is measured by the quality of decisions it enables. These are the decisions it should make easier, faster, and better-informed:

**Should I take on this technical debt right now?**
Architecture Doctor shows the current debt ledger, the accumulation velocity, and the capability most at risk. The engineer has a factual basis for prioritisation, not just instinct.

**Is this PR safe to merge?**
Architecture Doctor has evaluated the structural impact of the diff, identified affected capabilities, estimated score changes, and flagged any findings that would be introduced. The engineer has a risk assessment before merge.

**Which capability should we invest in next?**
Architecture Doctor shows per-capability health scores, finding counts, ownership, and trajectory. The engineering director can see exactly which capability is most at risk and allocate accordingly.

**Are we ready for this compliance audit?**
Architecture Doctor has tracked control coverage, data classifications, RLS policies, and retention paths continuously. The compliance posture is not prepared for the audit — it is maintained at audit-readiness continuously.

**Why does this part of the system always cause problems?**
Architecture Doctor shows the architectural history: when a capability's score started declining, which findings appeared, what exceptions were accepted and when. The postmortem has a data layer.

**What breaks if we change the pricing engine?**
Architecture Doctor knows which capabilities depend on the pricing engine, which business loops pass through it, which API routes are affected, and what the historical finding pattern for that capability is.

**Is this a one-person system now?**
Architecture Doctor shows which capabilities have a single owner, which files have no associated owner in the Atlas, and which business loops have no redundancy in their team coverage.

**Are our AI agents under control?**
Architecture Doctor shows which agents are executing, which are declared but orphaned, which have cost budgets and whether they're being respected, and whether any agent's permission set has grown beyond its declared scope.

---

## 11. What Makes Architecture Doctor Fundamentally Different

Architecture Doctor is not a better version of existing tools. It is a different kind of tool operating at a different level of abstraction.

**SonarQube** analyses code quality: duplication, complexity, code smells, coverage. Its unit of concern is the file. Its output is a quality grade per repository. It knows nothing about business capabilities, architectural intent, or governance decisions. It cannot tell you whether the system is doing what it is supposed to do.

**CodeQL and Semgrep** find security vulnerabilities in code patterns. They are exceptional at what they do and Architecture Doctor does not compete with them. Architecture Doctor identifies structural security properties — access control patterns, RLS coverage, data classification — not code vulnerabilities. The two are complementary, not alternatives.

**Dependabot** manages dependency version currency. It knows that a library has a newer version or a known CVE. It knows nothing about whether that dependency is appropriate, whether it is used, or whether it connects to a business capability with compliance obligations.

**Lighthouse** evaluates web page performance, accessibility, and SEO. It runs against a rendered URL. Architecture Doctor reasons about structural properties of the code that produces those pages — it operates at a different layer and with different concerns.

**Traditional architecture validators** (custom ADR checkers, import linters, convention scripts) enforce local rules: "no cross-domain imports", "always use this naming pattern." They are rules engines. Architecture Doctor is not a rules engine — it is a *truth verification system*. It asks not "does this follow the rules?" but "is this system what it was intended to be?"

The fundamental difference is the concept of *declared intent.* Architecture Doctor knows what the system is supposed to look like — because the Business Capability Atlas is explicit about that — and it continuously measures the gap between that intent and reality. Existing tools have no model of intent. They measure what *is*, not the gap between what *is* and what *should be.*

The second fundamental difference is *temporal continuity.* Architecture Doctor maintains a continuous model of architectural health across time. It knows not just the current state but the history, the trajectory, and the governance decisions that shaped both. No existing tool in this space has a meaningful temporal dimension.

The third difference is *business language.* Architecture Doctor reasons in terms of business capabilities, business loops, and business impact. SonarQube reasons in terms of files and methods. The gap between these levels of abstraction is the gap between a tool that engineers use and a tool that engineering organisations use.

---

## 12. How Architecture Doctor Fits Within Bud OS and Graphify

Architecture Doctor is not a standalone product. It is one organ within the Bud OS body.

**Graphify is the brain.** Graphify holds the long-term memory of the system: relationships, ownership, architecture decisions, lessons, dependencies, history. Architecture Doctor is one of Graphify's primary inputs — every finding, every capability state, every governance decision should ultimately live as a node in the Graphify knowledge graph. Architecture Doctor produces structured knowledge that Graphify preserves and makes queryable.

**The agent fleet is the operational layer.** Bud OS's agents execute business operations, make decisions, and take actions. Architecture Doctor is the governance layer over that fleet — verifying that agents are declared, permissioned, purposeful, and cost-bounded. The relationship is analogous to its relationship with API routes: agents are another class of system asset that must be accounted for and verified.

**The Business Capability Atlas is the shared source of truth.** The Atlas is the contract between Architecture Doctor and the rest of Bud OS. It declares what the system is supposed to have. Every Bud OS capability addition, route addition, agent addition, or table addition should be reflected in the Atlas, and Architecture Doctor verifies that reflection. The Atlas is not Architecture Doctor's document — it is the platform's document, and Architecture Doctor is one of its consumers.

**The developer workflow is the primary delivery surface.** Architecture Doctor reaches engineers through the tools they already use: CI workflows, PR comments, the VS Code extension, the dashboard. It does not require engineers to visit a separate governance portal. It surfaces architectural context where engineering work happens.

**The dashboard is the strategic view.** The Bud OS dashboard is where business-level architectural health is visible. The Architecture Doctor dashboard tab is not for engineers — it is for engineering leadership and product owners who need to understand architectural risk without reading JSON files.

Architecture Doctor's relationship to Bud OS can be stated simply: *Bud OS is the system. Graphify is its memory. Architecture Doctor is its conscience.*

---

## 13. How Architecture Doctor Supports Human Engineers

Architecture Doctor operates in service of human engineers, not in opposition to them.

**It provides context, not verdicts.**
When a developer makes a change, Architecture Doctor provides architectural context: what capability this touches, what the current health of that capability is, what findings are open, who owns it. It does not tell the developer their change is wrong — it tells them what they are touching and what is at risk.

**It preserves decisions, not just outcomes.**
When a governance decision is made — a finding accepted, a baseline created, a mode changed — Architecture Doctor preserves the decision with its rationale. Future developers are not left guessing why an exception exists. The decision is documented and attributable.

**It teaches through findings.**
Every finding is an opportunity for a developer to understand the architecture better. Architecture Doctor findings should include the rationale — not just "cross-domain dependency detected" but "this import creates a dependency from the crew portal on the finance domain, which means a finance domain change can break crew portal behaviour unexpectedly." The finding should teach, not just judge.

**It reduces archaeology.**
The most expensive developer activity in a mature codebase is understanding context: why does this exist, who owns it, what depends on it, what happens if it breaks. Architecture Doctor makes that context immediately available. The time from "I need to change this" to "I understand what I'm touching" should be minutes, not days.

**It is honest about uncertainty.**
When Architecture Doctor is not confident about a finding — when a check is heuristic rather than definitive, when a score category has known limitations, when a scan has incomplete information — it says so. An uncertain finding presented as a definitive verdict erodes trust. An uncertain finding presented with its confidence level is useful data.

**It does not interrupt unnecessarily.**
Governance systems that interrupt constantly are governance systems that are ignored. Architecture Doctor is silent when the architecture is healthy. It speaks when something changes. The signal-to-noise ratio must be high enough that every notification an engineer receives is worth their attention.

---

## 14. The Future Role of AI Within Architecture Doctor

AI capabilities will become increasingly central to Architecture Doctor over time. Their role must be defined clearly so that this integration strengthens rather than undermines the system's core values.

**AI as an interpreter, not a judge.**
AI will generate natural language explanations of findings, translate technical scores into business impact language, and draft remediation suggestions. It will not determine severity. It will not override governance rules. It will not accept baselines autonomously. The judgment layer remains human; AI improves the quality of information presented to that judgment.

**AI as a historian.**
Architecture Doctor's archive of findings, decisions, and resolutions is a training signal for understanding what patterns lead to problems and what remediation strategies are effective. AI can surface patterns in this history that would not be visible to humans reading sequential reports: "findings of type X in capability Y have historically preceded production incidents within 60 days."

**AI as a simulation partner.**
Before a significant architectural change, AI will help simulate its impact — not by predicting the future with false certainty, but by asking: "Based on similar changes in this codebase and in analogous systems, what are the most likely downstream effects?" This enriches the human decision, not replaces it.

**AI as a documentation author.**
Architecture Doctor generates a significant volume of documentation: reports, summaries, PR comments, compliance attestations. AI should draft these from structured data, in the appropriate register for the appropriate audience, at a quality level indistinguishable from expert human documentation. The data is Architecture Doctor's; the prose is AI's.

**AI as a finding triage assistant.**
As Architecture Doctor matures and finding volume grows, AI will help triage: "These 12 findings are all symptoms of the same underlying structural issue. Resolving this one root cause would close 9 of them." This is pattern recognition at scale, not governance judgment.

**What AI must never do within Architecture Doctor:**
- Accept or close a baseline without human confirmation
- Change an enforcement mode
- Report a finding as critical without a deterministic basis
- Take any action in a production system without an explicit human approval chain
- Reason about the business value of a capability without data to ground that reasoning

The principle is: AI expands the quality and reach of human architectural judgment. It does not substitute for it.

---

## 15. The Principles Every Future Feature Must Satisfy

Before any capability is added to Architecture Doctor, it must satisfy all of the following. A feature that cannot answer "yes" to every question should not be added, regardless of how technically interesting it is.

**1. Does it serve the mission?**
Does it make the gap between architectural intent and system reality more visible, more measurable, or more closeable? If the answer is "it's a useful engineering tool but doesn't specifically address that gap," it belongs elsewhere.

**2. Is the unit of concern a business capability?**
Does the feature reason at the level of capabilities, business loops, and ownership? Or does it reason at the level of files, functions, or code patterns? If the latter, it belongs in a code analysis tool, not Architecture Doctor.

**3. Is it attributable?**
Every finding, every score change, every governance event produced by this feature must be attributable to a specific cause, capable of being explained to a human, and linkable to the capability it affects.

**4. Does it respect the human authority ceiling?**
Does the feature require human approval before taking any consequential action? If it can act without human confirmation, what is the scope of that action and why is autonomous action appropriate at that scope? Autonomous action below a clearly defined threshold is acceptable; autonomous action above it is not.

**5. Does it earn its noise budget?**
Every finding type uses some of the finite attention budget of the engineering team. Is the signal-to-noise ratio of this feature high enough to justify the noise it will introduce? A feature that produces 50 low-quality findings that are routinely dismissed is worse than no feature.

**6. Is it honest about its own limitations?**
Does the feature's implementation know what it does not know? Does it communicate uncertainty accurately? A check that produces false positives at a rate above 5% in realistic conditions should not be promoted to a default-on finding type.

**7. Does it produce knowledge, not just output?**
Will the information produced by this feature live in the architecture knowledge graph as a durable artifact? Or will it produce a report that is discarded? Preference is strongly given to features whose outputs are persistent knowledge, not ephemeral output.

**8. Is it reversible?**
Can the feature be disabled, rolled back, or reconfigured without leaving orphaned findings, corrupt state, or governance gaps? Architecture Doctor itself must be safely evolvable. Features that create irreversible state without explicit human consent are not acceptable.

**9. Does it scale with the architecture?**
Will this feature remain valuable as the system grows — as capabilities double, as agent count triples, as the codebase expands? A feature that works well at 24 capabilities and poorly at 100 is a feature that will eventually need to be removed. Build for the architecture you will have, not the one you have today.

**10. Would a new architect understand it without the source code?**
Could a senior engineer who has never read Architecture Doctor's source code understand what this feature does, why it produces the findings it produces, and how to act on them? If not, the feature is too opaque to be trusted.

---

## Closing

Architecture Doctor is not built once. It is built continuously, over years, as the system it governs grows and as the craft of architectural governance itself advances.

This document is the fixed point. Everything else — the implementations, the finding types, the scoring models, the integrations — will change. These principles, this philosophy, this mission will not.

When a future contributor faces a hard decision about what Architecture Doctor should or should not do, they should return to this document. The right answer is almost always the one that best serves the mission, honours the philosophy, and satisfies the feature admission principles.

Architecture Doctor exists because the best engineering teams are not the ones who make no mistakes. They are the ones who see their mistakes clearly, understand them completely, learn from them systematically, and use that learning to build systems that deserve to be trusted.

That is what Architecture Doctor is here to support.

---

*This document was authored on 2026-07-09 as the founding constitutional document for Architecture Doctor.*
*It requires founding-author approval to amend.*
*All Architecture Doctor design decisions are subordinate to it.*
