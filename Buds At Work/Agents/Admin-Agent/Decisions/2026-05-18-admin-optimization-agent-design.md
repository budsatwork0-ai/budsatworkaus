---
type: "decision"
workspace: "admin-agent"
status: "accepted"
impact: "high"
systems:
  - "admin-optimization"
  - "/dashboard"
  - "/dashboard/quotes"
  - "/dashboard/crew"
  - "/dashboard/schedule"
tags:
  - "decision"
  - "admin-agent"
  - "architecture"
  - "admin-optimization"
created: "2026-05-18T00:00:00Z"
---

# Decision: Introduce Admin Optimization as a Dedicated Operational Intelligence Agent

## Context

The admin surface lacked a systematic mechanism to detect and score workflow friction. Operational
pain points were discovered reactively (reported during use) rather than proactively audited. The
existing agent set optimised for outbound actions (scheduling, quoting, crew coaching) but nothing
measured *how hard it is to do the admin work itself*.

Key signals driving this decision:
- No cross-run comparison of admin friction — the same pain points recurred without detection
- No quantitative friction scoring — severity was subjective
- No automation gap analysis — the automations page existed but had no agent to identify what
  should be added to it
- Landscape-first layout philosophy had no enforcement mechanism

## Rationale

`admin-optimization` runs weekly (Wednesday 7 am) and:
- Pulls real operational metrics (quote pipeline shape, job scheduling gaps, onboarding timelines,
  agent health) to ground LLM analysis in data, not speculation
- Uses a deterministic friction score (clicks × 2 + context switches × 3 + manual steps × 2 +
  error prone × 3) so severity is comparable across runs and over time
- Detects automation candidates with estimated weekly time savings — feeding directly into the
  `/dashboard/automations` recipe list
- Applies the design philosophy (landscape-first, minimal clicks, low noise, rapid scanning)
  as a rubric in every proposed change
- Writes high-friction findings to `memory_documents` (category `admin`) so future runs can
  detect recurrence and escalate severity

## Consequences

- `admin-optimization` is the primary source of admin UX/workflow intelligence; it does not
  replace action-oriented agents (`scheduling`, `quote-triage`) but audits the *experience* of
  using them
- P0 and critical-band findings surface to the approval queue (`requiresApproval: true`)
- Friction scores accumulate in `admin_optimization_findings` — a new Supabase table (see
  migration 049)
- Automation shortlist feeds into `/dashboard/automations` recipe proposals

## Related

- [[scheduling]]
- [[quote-triage]]
- [[crew-briefing]]
- [[/dashboard]]
- [[/dashboard/quotes]]
- [[/dashboard/crew]]
