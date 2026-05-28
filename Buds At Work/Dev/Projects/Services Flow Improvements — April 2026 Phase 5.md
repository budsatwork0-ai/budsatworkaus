# Services Flow Improvements — April 2026 Phase 5

**Date:** 2026-04-18
**Status:** Implemented
**Scope:** Full customer portal tightening — 8 improvements to reduce booking friction and improve returning-customer experience

**Related:** [[Services Flow Improvements — April 2026 Phase 4]] · [[Client Portal]] · [[Stripe Checkout]] · [[Quote Flow]]

---

## Why This Was Done

Phase 4 closed the Step 3 phone hydration gap. Phase 5 addresses the broader portal experience: returning customers were not benefiting from saved data, the dashboard had no direct payment path, there was no profile management page, and subscription changes required emailing us directly.

---

## Changes

### 1. Property access fields → Step 3 notes auto-fill

**File:** `src/app/(public)/services/page.tsx`

The property page already stores `gate_code`, `pet_warnings`, `parking`, and `special_instructions`. These are now used in Step 3:

- On **rebook**, if the notes field is empty, they are automatically composed into notes (e.g. `Gate code: 1234\nPets: Two dogs`)
- On **any Step 3 visit** (not just rebook), a "Use saved access details" prompt appears above the textarea when saved access data exists and notes is empty — one tap applies it

---

### 2. Pay Now button on dashboard

**File:** `src/app/(app)/portal/page.tsx`

The dashboard now fetches both `finalized` and `payment_pending` quotes. When a quote has a `stripe_checkout_url` (checkout was already created by admin), the dashboard card becomes a direct `<a href>` link to Stripe with "Pay Now →" copy and the amount shown. Quotes in `finalized` state (no URL yet) still show "Review →" to the quotes page.

---

### 3. Profile completeness nudge on dashboard

**File:** `src/app/(app)/portal/page.tsx`

The dashboard now fetches `/api/portal/profile` on mount. If `phone` is null or empty, an amber nudge card appears: "Add your phone number — speeds up future bookings → Update". Links to the new `/portal/profile` page.

---

### 4. New `/portal/profile` page

**File:** `src/app/(app)/portal/profile/page.tsx` (new)

Three-section form backed by `/api/portal/profile` GET/PUT:
- **Contact details** — full name, email (read-only), phone (with same digit normalisation as the wizard)
- **Business details** — company name, ABN (optional, for commercial quotes)
- **Default service address** — address + region (pre-fills Step 3 and the rebook flow)

Skeleton loading state, load-fail guard, success confirmation on save.

---

### 5. Profile added to portal nav

**File:** `src/app/(app)/portal/layout.tsx`

Added `{ href: '/portal/profile', label: 'Profile' }` to the `NAV` array — appears in both desktop tab strip and mobile dropdown.

---

### 6. Richer rebook deep link

**Files:** `src/app/(public)/services/page.tsx`, `src/app/(app)/portal/orders/page.tsx`

The wizard's rebook effect now reads a `notes` query param and pre-fills the notes field if it's empty. The orders "Book Again" link passes `order.notes` URL-encoded if present. Future orders will arrive with access details and previous instructions pre-filled.

---

### 7. Stripe saved payment methods

**Files:**
- `supabase/migrations/025_stripe_customer_id.sql` — adds `stripe_customer_id TEXT` to `customers` with partial unique index
- `src/app/api/quotes/[id]/checkout/route.ts` — on checkout creation, looks up existing `stripe_customer_id`; if found, passes `customer:` param to Stripe (surfaces saved cards); if not, creates a Stripe Customer and saves the ID back to the DB
- `src/app/api/webhooks/stripe/route.ts` — on `checkout.session.completed`, if the session has a `customer` (Stripe Customer ID), writes it to the customers row so it's available for next time

Returning customers will see "Pay with saved card" on their second and subsequent checkouts. New customers get a Stripe Customer created on first checkout.

---

### 8. Subscription modification request form

**Files:**
- `src/app/api/portal/subscriptions/[id]/request-change/route.ts` (new) — auth-gated POST that validates ownership, sends a formatted email to admin via Resend, and logs the request to the audit table
- `src/app/(app)/portal/subscriptions/page.tsx` — adds "Request a change" button on each non-cancelled subscription card; toggles an inline form with: change type chips (frequency / scope / add-on / pause / other) + textarea + send button

Admin receives an email with customer details, service, frequency, request type, and message. Reply-to is set to the customer's email. The request is also logged to `audit_log` as `change_requested`.

Set `ADMIN_NOTIFY_EMAIL` env var to override the recipient (defaults to `hello@budsatwork.com`).

---

## Key Files Modified / Created

| File | Change |
|------|--------|
| `src/app/(public)/services/page.tsx` | Property access auto-fill, richer rebook notes |
| `src/app/(app)/portal/page.tsx` | Pay Now card, profile phone nudge, expanded fetches |
| `src/app/(app)/portal/layout.tsx` | Profile nav item |
| `src/app/(app)/portal/profile/page.tsx` | **NEW** — profile management page |
| `src/app/(app)/portal/orders/page.tsx` | Rebook URL passes notes |
| `src/app/(app)/portal/subscriptions/page.tsx` | Change request form |
| `src/app/api/portal/subscriptions/[id]/request-change/route.ts` | **NEW** — change request API |
| `src/app/api/quotes/[id]/checkout/route.ts` | Stripe Customer create/reuse |
| `src/app/api/webhooks/stripe/route.ts` | Persist stripe_customer_id on payment |
| `supabase/migrations/025_stripe_customer_id.sql` | **NEW** — stripe_customer_id column |

---

## Env var

| Var | Purpose | Default |
|-----|---------|---------|
| `ADMIN_NOTIFY_EMAIL` | Recipient for subscription change request emails | `hello@budsatwork.com` |

---

## Verification

- [ ] Portal dashboard → phone missing → amber nudge card appears → links to `/portal/profile`
- [ ] `/portal/profile` → loads data, saves changes, phone normalises same as wizard
- [ ] Portal nav → "Profile" tab appears in desktop strip and mobile dropdown
- [ ] Dashboard finalized quotes → if admin has triggered checkout → "Pay Now → $X" direct Stripe link
- [ ] Step 3 → property page has gate_code + pet_warnings → rebook → notes pre-filled
- [ ] Step 3 → property page has access data → "Use saved access details" prompt visible when notes is empty
- [ ] Orders "Book Again" → URL includes `notes=` → Step 3 notes pre-filled
- [ ] Subscriptions page → "Request a change" button → change type chips + textarea → send → toast + admin email received
- [ ] Second checkout for existing customer → Stripe shows saved card
- [ ] Migration 025 applied → `customers.stripe_customer_id` column exists
