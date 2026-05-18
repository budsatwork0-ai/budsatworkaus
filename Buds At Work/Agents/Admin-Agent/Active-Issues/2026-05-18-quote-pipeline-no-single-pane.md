---
type: "issue"
workspace: "admin-agent"
status: "open"
severity: "high"
systems:
  - "/dashboard/quotes"
  - "Quote Pipeline"
tags:
  - "issue"
  - "admin-agent"
  - "quote-management"
  - "admin-optimization"
created: "2026-05-18T00:00:00Z"
---

# Issue: Quote Pipeline — No Single-Pane View (Multiple Navigation Hops to Action)

## Description

The current quotes table on `/dashboard/quotes` requires the admin to open each quote row in a
separate expanded view (or navigate to a detail page) to see: customer notes, suburb, service
type, AI-estimated value, and agent triage status together. There is no way to act on a quote
(send, accept, follow up) directly from the table row.

Friction score: **14/20 (high)** — approximately 6 clicks and 2 context switches per quote action.

With typical quote volume of 5–15/day, this represents 30–90 clicks daily on a single workflow.

## Steps to Reproduce

1. Open `/dashboard/quotes`
2. Attempt to find the suburb, service, estimated value, and agent triage status for a quote
3. Note which columns require row expansion or detail page navigation
4. Count clicks to send the draft email to the customer

## Impact

Priority P1 — affects quote response time. Each extra navigation hop adds latency; slower
responses are correlated with lower quote-to-accept conversion rates.

## Related

- [[/dashboard/quotes]]
- [[Quote Pipeline]]
- [[quote-triage]]
- [[Admin Optimization Agent Design Decision]]
