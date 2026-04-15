# Checklist: Payment Flow End-to-End Test

Use this before any deploy that touches the services wizard, API routes, or Stripe integration.

---

## Pre-Test Setup
- [ ] Stripe CLI running: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- [ ] Dev server running: `npm run dev`
- [ ] Test Stripe keys active (check `.env.local`)

---

## Step 1 — Wizard Flow
- [ ] Go to `/services`
- [ ] Select context: Home
- [ ] Select service: Cleaning (or any service)
- [ ] Step 2 loads with scope cards
- [ ] Click a scope card — advances to Step 3
- [ ] Fill in: name (2+ chars), email (valid), phone (10+ digits), address
- [ ] Submit quote → success toast shown, quote ID returned

---

## Step 2 — Admin Review
- [ ] Go to `/dashboard`
- [ ] Find submitted quote
- [ ] Set a reviewed total
- [ ] Finalize the quote (status → `finalized`)

---

## Step 3 — Checkout Creation
- [ ] Click "Request Payment" on the quote
- [ ] Stripe checkout URL returned
- [ ] Quote status → `payment_pending` in Supabase
- [ ] Order record created in `orders` table
- [ ] **Quote Finalized** email received by customer (check Resend)

---

## Step 4 — Payment
- [ ] Open checkout URL
- [ ] Use test card: `4242 4242 4242 4242`, any expiry, any CVC
- [ ] Payment completes → redirected to `/services/checkout/success`
- [ ] Webhook fires: `checkout.session.completed`
- [ ] Order status → `confirmed` in Supabase
- [ ] Quote status → `paid` in Supabase
- [ ] Payment record inserted in `payments` table
- [ ] **Booking Confirmed** email received (check Resend)

---

## Step 5 — Failure Scenario
- [ ] Create a new test quote and checkout
- [ ] Use declined card: `4000 0000 0000 0002`
- [ ] Payment fails → webhook fires `payment_intent.payment_failed`
- [ ] Order status → `failed`
- [ ] Quote status → `finalized` (reset for retry)

---

## Step 6 — Expired Session Scenario
- [ ] Create a checkout session via Stripe CLI: `stripe trigger checkout.session.expired`
- [ ] Quote status → `finalized` (reset for retry)

---

## Step 7 — Refund Scenario
- [ ] Issue full refund via Stripe Dashboard
- [ ] Webhook fires: `charge.refunded`
- [ ] Payment record inserted with `status: refunded`
- [ ] Order status → `cancelled`

---

## Related
- [[Stripe Checkout]]
- [[Quote Flow]]
- [[Email Triggers]]
- [[New Booking]]
- [[Failed Payment]]
- [[Refund Process]]
- [[Bug Tracker]]
- [[Services Flow Improvements — April 2026]]
