# Services Flow Improvements — April 2026

**Date:** 2026-04-14 (Phase 1) · Updated 2026-04-14 (Phase 2)
**Status:** Implemented
**Scope:** Full funnel — wizard (Steps 1–3), Stripe payment pipeline, post-payment admin workflow, UX engagement & review loop

**Related:** [[Quote Flow]] · [[Email Triggers]] · [[Stripe Checkout]] · [[New Booking]] · [[Bug Tracker]] · [[Checklist Template]]

---

## Why This Was Done

The services funnel had a solid foundation but several gaps creating customer friction and manual admin overhead:
- Step 2 had no guard preventing users from advancing without configuring anything
- Phone validation rejected `+61` country codes
- Stripe webhooks could double-process the same payment
- After a customer paid, there was no way for admin to assign crew or notify the customer of scheduling
- Email failures were silently swallowed with no logging

---

## Changes by Layer

### Layer 1 — Quote Submission API (`/api/quotes/route.ts`)

- **Server-side context/service guard** — rejects combinations like auto detailing + commercial context, matching the client-side `ALLOWED_SERVICES_BY_CONTEXT` constant
- **Email error logging** — `.catch(() => {})` replaced with `console.error('[email] quote_received send failed:', err)`

---

### Layer 2 — Step 2 Wizard (`services/page.tsx`)

- **`hasMinimumWork` computed value** added after `hasWork` (~line 3716). Per-service rules:
  - `cleaning` → delegates to existing `hasWork`
  - `windows` → at least one pane count (int or ext) > 0
  - `yard` → at least one job added AND every job has a drawn polygon
  - `auto` → `carModelType != null`
  - `dump` → at least one of dumpRun / dumpDelivery / dumpTransport selected
  - `laundry_sneakers` → `laundryLoads >= 1`
- **"Get My Quote →" button** is now dimmed + blocked when `!hasMinimumWork`; tooltip explains why
- **Yard polygon validation** is enforced via `hasMinimumWork` — can't advance without drawn polygon on every site

---

### Layer 3 — Step 3 Contact Form (`services/page.tsx`)

- **Phone +61 fix** — `onChange` now strips `+61` prefix before formatting, normalises to leading `0`. Validation check also uses the normalised value
- **`required` + `aria-required="true"`** added to name, email, and phone inputs
- **CAPTCHA expiry** — new `captchaExpired` state; `onExpire` sets it to `true`; shows distinct "Verification expired — please re-verify" message separate from the initial "please complete" message
- **Notes `maxLength={2000}`** + live character counter (turns amber at 1800 chars)

---

### Layer 4 — Post-Payment Admin Workflow

#### New email template (`/lib/email/templates.ts`)
`serviceScheduledEmail` — sent when admin assigns a job. Contains:
- Scheduled date (human-readable)
- Time window
- Crew first name
- Service address
- Order reference

#### Updated assign route (`/api/orders/[id]/assign/route.ts`)
Now accepts optional `scheduled_date` and `scheduled_time` in the POST body:
- Updates order `status` → `'scheduled'`
- Sets `scheduled_date` / `scheduled_time` on the order record
- Fires `serviceScheduledEmail` to the customer (fire-and-forget with error logging)
- Returns crew member first names via join on `employees` table

#### New Dispatch tab (`/dashboard/components/tabs/DispatchTab.tsx`)
Surfaced as tab #2 in the admin dashboard ("Dispatch", shortcut key `2`).
- Fetches all `confirmed` orders without an assignment
- Shows: customer name, service, address (extracted from notes), price, order ref
- Admin selects an order → picks date/time + crew member(s) → submits
- On success: removes order from queue, shows confirmation banner, customer email fires

**Files touched:**
- `src/types/dashboard.ts` — added `'dispatch'` to `TabKey`, added tab to `tabs[]` array, shifted shortcuts 2→8
- `src/app/(app)/dashboard/components/tabs/index.ts` — exported `DispatchTab`
- `src/app/(app)/dashboard/page.tsx` — imported + rendered `DispatchTab`, updated grid to 8 cols, updated shortcut hint

---

### Layer 5 — Stripe & Payment Pipeline

#### Checkout route (`/api/quotes/[id]/checkout/route.ts`)
- Added `customer_email` to Stripe session metadata (reduces DB fallback dependency in webhook)
- Fixed silent email catch → `console.error('[email] quote_finalized send failed:', err)`

#### Stripe webhook (`/api/webhooks/stripe/route.ts`)
- **Idempotency check** — before updating order on `checkout.session.completed`, queries current order status; skips processing if already `'confirmed'` (handles duplicate webhook delivery)
- **`checkout.session.expired`** — now fetches quote data and sends a re-quote notification email to the customer ("Your payment link expired — re-request via your portal")
- Added `quoteReceivedEmail` import for the expired-session email
- Fixed silent booking confirmation email catch → `console.error('[email] booking_confirmed send failed:', err)`

---

## Verification Checklist

- [ ] **Step 2 guard** — select a service, configure nothing, confirm "Get My Quote →" is dimmed and unclickable
- [ ] **Yard polygon** — add a yard site without drawing, confirm can't advance
- [ ] **Phone +61** — enter `+61 412 345 678`, confirm it passes and normalises to `0412 345 678`
- [ ] **Notes counter** — type 1801+ chars, confirm counter turns amber
- [ ] **CAPTCHA expiry** — trigger `onExpire` in dev; confirm "Verification expired" message appears
- [ ] **Server-side guard** — POST `/api/quotes` with `service_type: 'auto'` and `context: 'commercial'`; expect `400 Service not available for this context`
- [ ] **Stripe idempotency** — replay a `checkout.session.completed` webhook twice; confirm second call logs "already confirmed" and skips
- [ ] **Dispatch tab** — after a test payment completes, open Dashboard → Dispatch; confirm order appears; assign it; confirm `job_assignments` row created and customer email fires
- [ ] **Scheduling email** — assign with a date; confirm customer receives email with date, time, crew name, and address
- [ ] **Popular badge** — open Step 1, confirm "Popular" chip appears on Cleaning and Yard tiles
- [ ] **From prices** — confirm "from $79" / "from $99" etc. visible under each service tile subtitle
- [ ] **Progress bar** — walk through Steps 1→2→3, confirm dots fill and connector lines turn green
- [ ] **Trust signals** — on Step 3, confirm "Secure payment · No lock-in contracts · Local Logan & South Brisbane" shows below submit CTA
- [ ] **Review CTA (success page)** — complete a test payment, confirm amber Google review card appears
- [ ] **Review CTA (email)** — check booking confirmed email includes the Google review block
- [ ] **Quote received email** — submit a quote, confirm new warmer copy lands in inbox

---

## Phase 2 — UX Engagement & Review Loop (2026-04-14)

### Why
The funnel was functionally solid but lacked signals that build trust and drive conversion at key moments. No price anchoring on Step 1, no visible progress, no review capture, and emails felt generic.

### Changes

| Layer | What changed |
|-------|-------------|
| **Tile component** (`UIComponents.tsx`) | `popular` prop now renders a green "Popular" badge; new `from` prop renders "from $X" price hint in emerald below subtitle |
| **SERVICES array** (`service-data.tsx`) | Added `from` price to all 6 services: windows $79, cleaning $99, yard $79, dump $99, auto $99, laundry $74 |
| **Step progress bar** (`services/page.tsx`) | 3-step indicator (Choose service → Configure → Your details) below the h1; dots fill on completion, connector lines animate green |
| **Step 3 trust signals** (`services/page.tsx`) | "Secure payment · No lock-in contracts · Local Logan & South Brisbane" row directly under submit CTA |
| **Checkout success page** (`checkout/success/page.tsx`) | Amber Google review card after payment confirmed — peak satisfaction moment |
| **Booking confirmed email** (`templates.ts`) | Google review nudge block added ("⭐ Leave a Google review" CTA) |
| **Quote received email** (`templates.ts`) | Rewritten with warmer, human tone; subject changed to "Got your quote — we'll be in touch soon" |

---

## Key Files Modified

| File | Change |
|------|--------|
| `src/app/(public)/services/page.tsx` | hasMinimumWork, phone fix, CAPTCHA expiry, notes limit, aria attrs, step progress bar, trust signals |
| `src/app/(public)/services/lib/service-data.tsx` | Added `from` price to SERVICES array |
| `src/app/(public)/services/components/shared/UIComponents.tsx` | Popular badge + from price rendered in Tile |
| `src/app/(public)/services/checkout/success/page.tsx` | Google review CTA after payment |
| `src/app/api/quotes/route.ts` | Context/service guard, email logging |
| `src/app/api/quotes/[id]/checkout/route.ts` | Metadata enrichment, email logging |
| `src/app/api/webhooks/stripe/route.ts` | Idempotency, expired session email, logging |
| `src/app/api/orders/[id]/assign/route.ts` | Scheduling fields, scheduling email trigger |
| `src/lib/email/templates.ts` | serviceScheduledEmail, booking confirmed review CTA, warmer quote received copy |
| `src/app/(app)/dashboard/components/tabs/DispatchTab.tsx` | New file |
| `src/app/(app)/dashboard/components/tabs/index.ts` | Export DispatchTab |
| `src/app/(app)/dashboard/page.tsx` | Import + render DispatchTab, 8-tab grid |
| `src/types/dashboard.ts` | Added `'dispatch'` TabKey + tab config |
