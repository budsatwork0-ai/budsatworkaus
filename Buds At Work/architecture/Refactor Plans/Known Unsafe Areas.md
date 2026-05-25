---
tags: [refactor, risk, safety, constraints]
---

# Known Unsafe Areas

Areas of the codebase where changes have a high risk of breakage or cascading failure. Read this before any refactor that touches these systems.

---

## ServicesPageContent — Step 2 IIFE

**File:** `src/app/(public)/services/page.tsx`  
**Risk:** CRITICAL  
**What:** The entire Step 2 UI is rendered inside `{S.step === 2 && (() => { ... })()}`.  
**Why unsafe:** This IIFE was chosen deliberately to avoid prop-drilling across deeply nested sub-steps. Refactoring it into a component requires threading every sub-step prop through the tree.  
**Rule:** Do not touch this pattern unless you have mapped every prop the IIFE closure captures.

---

## createServiceClient signature

**File:** `src/lib/supabase/server.ts`  
**Risk:** CRITICAL (218 import sites)  
**What:** The function signature and return type of `createServiceClient()` and `createServiceClientSafe()`.  
**Why unsafe:** Every API route imports one of these two functions. A signature change breaks every route simultaneously with no incremental migration path.  
**Rule:** Only change with a grep-verified list of all call sites and a plan to update them atomically.

---

## Brand token values

**File:** `src/app/ui/theme.ts`  
**Risk:** HIGH (137 import sites)  
**What:** Any `brand.*` colour or surface value.  
**Why unsafe:** Changing a single token affects every component that references it — visual regressions are invisible until you check every page.  
**Rule:** Before changing any `brand.*` value, screenshot every major page section. Run `graphify query "brand theme tokens"` to see the blast radius.

---

## Agent guardrails

**File:** `src/lib/agents/guardrails/`  
**Risk:** HIGH  
**What:** The 7 guardrail policy implementations.  
**Why unsafe:** Guardrails prevent dangerous agent actions (bulk deletes, mass emails, large financial transactions). Weakening them without understanding the policy interactions could allow runaway agent behaviour.  
**Rule:** Any change to a policy must be accompanied by an updated test in `tests/lib/agent-guardrails.test.ts`.

---

## Stripe webhook handler

**File:** `src/app/api/webhooks/stripe/route.ts`  
**Risk:** HIGH  
**What:** Event handling for `checkout.session.completed`, `payment_intent.succeeded`, `charge.refunded`, `checkout.session.expired`.  
**Why unsafe:** Webhook events are delivered once. A bug here means lost payment confirmations or emails that never fire.  
**Rule:** Test with Stripe CLI (`stripe listen --forward-to localhost:3000/api/webhooks/stripe`) before deploying any change. Use the [[Automation/Checklist Template|Checklist Template]] end-to-end flow.

---

## Pricing Engine — NDIS overrides

**File:** `src/app/(public)/services/lib/pricing/ndis.ts`  
**Risk:** MEDIUM  
**What:** NDIS rate override logic applied on top of base pricing.  
**Why unsafe:** NDIS rates are legislated — a miscalculation results in incorrect billing for participants. Changes must be checked against current NDIS price guide.  
**Rule:** Never change NDIS rates without a reference to the current NDIS pricing catalogue.

---

## Related Systems
- [[Services Core Extraction]]
- [[Next Safe Refactor Batches]]
- [[../Components/ServicesPageContent|ServicesPageContent]]
- [[../Systems/createServiceClient|createServiceClient]]
- [[../Components/Brand|Brand]]
- [[../Systems/Agent Runtime|Agent Runtime]]
- [[../Systems/Quote Pipeline|Quote Pipeline]]
- [[../Systems/NDIS Matching|NDIS Matching]]
