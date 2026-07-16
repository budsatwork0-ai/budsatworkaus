# Architecture Doctor v2 - C02 API Route Slice Report

Generated: 2026-07-10T13:36:34.158Z
Mode: advisory
Scope: capability:C02 assetKind:apiRoute

## Capability Intent

- Capability: C02 - Quote Pricing and Checkout
- Declared API routes: 11

## Observations

- Repository API route observations: 242
- Limitation: static route-file presence only; no runtime behaviour verified.

## Evidence

- evidence-presence-api-analytics-quote-funnel: presence for /api/analytics/quote-funnel (Deterministic)
- evidence-presence-api-checkout: presence for /api/checkout (Deterministic)
- evidence-presence-api-geo-mmm: presence for /api/geo/mmm (Deterministic)
- evidence-presence-api-pay-quoteid: presence for /api/pay/[quoteId] (Deterministic)
- evidence-presence-api-paypal-capture-order-orderid: presence for /api/paypal/capture-order/[orderId] (Deterministic)
- evidence-presence-api-paypal-create-order: presence for /api/paypal/create-order (Deterministic)
- evidence-presence-api-quotes: presence for /api/quotes (Deterministic)
- evidence-presence-api-quotes-id: presence for /api/quotes/[id] (Deterministic)
- evidence-presence-api-quotes-id-checkout: presence for /api/quotes/[id]/checkout (Deterministic)
- evidence-presence-api-quotes-id-remind: presence for /api/quotes/[id]/remind (Deterministic)
- evidence-presence-api-rego-lookup: presence for /api/rego-lookup (Deterministic)

## Claims

- claim-c02-declared-observed-api-analytics-quote-funnel: supported - declared C02 API route is observed in repository (Deterministic)
- claim-c02-declared-observed-api-checkout: supported - declared C02 API route is observed in repository (Deterministic)
- claim-c02-declared-observed-api-geo-mmm: supported - declared C02 API route is observed in repository (Deterministic)
- claim-c02-declared-observed-api-pay-quoteid: supported - declared C02 API route is observed in repository (Deterministic)
- claim-c02-declared-observed-api-paypal-capture-order-orderid: supported - declared C02 API route is observed in repository (Deterministic)
- claim-c02-declared-observed-api-paypal-create-order: supported - declared C02 API route is observed in repository (Deterministic)
- claim-c02-declared-observed-api-quotes: supported - declared C02 API route is observed in repository (Deterministic)
- claim-c02-declared-observed-api-quotes-id: supported - declared C02 API route is observed in repository (Deterministic)
- claim-c02-declared-observed-api-quotes-id-checkout: supported - declared C02 API route is observed in repository (Deterministic)
- claim-c02-declared-observed-api-quotes-id-remind: supported - declared C02 API route is observed in repository (Deterministic)
- claim-c02-declared-observed-api-rego-lookup: supported - declared C02 API route is observed in repository (Deterministic)

## Findings

- No advisory findings produced.

## Recommendations

- No recommendations required.

## Governance Event

- governance-adv2-c02-api-routes-2026-07-10t13-36-34z: needs_review by Architecture Doctor v2 phase 9
- Rationale: Validate generic pipeline infrastructure without changing C02 slice.

## Traceability

| Finding | Claims | Evidence | Recommendation |
| --- | --- | --- | --- |
| none | none | none | none |

## Knowledge Trace

- Report content is projected from `SliceKnowledgePublication` nodes and edges.
- Every rendered finding must have `produces_finding`, `has_recommendation`, and `affects_capability` edges.
- Every rendered claim must have at least one `supports_claim` or `refutes_claim` edge from evidence.

## Knowledge Publication

- Knowledge nodes: 279
- Knowledge edges: 34

## Limitations

- Static API-route verification only.
- No runtime behaviour, authentication, payment, database, RLS, or checkout correctness is verified.
- Atlas disagreement is treated as drift requiring review, not automatic proof of code fault.
- No baseline, exception, enforcement change, AI reasoning, plugin admission, or predictive capability is performed.

