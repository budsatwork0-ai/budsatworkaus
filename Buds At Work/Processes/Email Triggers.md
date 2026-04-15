# Email Triggers

Seven transactional emails are wired into the platform via Resend.

---

## Setup

**FROM address:** `hello@budsatwork.com`  
**Must be verified** in the Resend dashboard before emails will send.

**Files:**
- Client: `src/lib/email/resend.ts`
- Templates: `src/lib/email/templates.ts`

---

## 1. Quote Received

**Trigger:** `POST /api/quotes` — immediately on quote submission  
**File:** `src/app/api/quotes/route.ts`  
**Recipient:** Customer email from wizard  
**Content:** Confirmation the quote was received, service type, quoted total, quote ID

---

## 2. Quote Finalized

**Trigger:** `POST /api/quotes/[id]/checkout` — when admin creates checkout link  
**File:** `src/app/api/quotes/[id]/checkout/route.ts`  
**Recipient:** Customer email on the quote  
**Content:** Payment link (Stripe checkout URL), service label, total, quote ID

---

## 3. Booking Confirmed

**Trigger:** `checkout.session.completed` Stripe webhook  
**File:** `src/app/api/webhooks/stripe/route.ts`  
**Recipient:** `session.customer_email` or `session.customer_details?.email`  
**Content:** Order confirmed, service label, amount paid, order ID, **Google review CTA**

---

## 4. Service Scheduled

**Trigger:** `POST /api/orders/[id]/assign` — when admin assigns crew + date in Dispatch tab  
**File:** `src/app/api/orders/[id]/assign/route.ts`  
**Recipient:** Customer email on the order  
**Content:** Scheduled date (human-readable), time window, crew first name, service address, order ref, portal link

---

## 5. Checkout Expired (re-engagement)

**Trigger:** `checkout.session.expired` Stripe webhook  
**File:** `src/app/api/webhooks/stripe/route.ts`  
**Recipient:** Customer email from quote  
**Content:** Payment link expired notice, prompt to re-request via portal

---

## 6. Quote Reminder — 24h nudge (re-engagement)

**Trigger:** `POST /api/quotes/[id]/remind` — manually by admin (or future cron)  
**File:** `src/app/api/quotes/[id]/remind/route.ts`  
**When to use:** Quote is finalized but customer hasn't paid ~24h after receiving the payment link  
**Recipient:** Customer email on the quote  
**Content:** "Still thinking?" nudge with direct payment link, checkout takes 30s messaging  
**Rate limit:** 5 per quote per hour (in-memory)  
**Idempotency:** Updates `last_reminder_sent_at` on the quote after sending

---

## 7. Day-Before Service Reminder

**Trigger:** `POST /api/orders/[id]/remind-day-before` — manually from Dispatch tab or future cron  
**File:** `src/app/api/orders/[id]/remind-day-before/route.ts`  
**When to use:** Evening before a confirmed booking  
**Recipient:** Customer email on the order  
**Content:** Date/time, crew first name, service address, prep checklist (pets, access, gate codes, driveway)  
**Idempotency:** `day_before_reminder_sent` flag on order prevents double-sending

---

## Tone notes
- **Quote received** — warm and human: "Your quote came through — nice one for reaching out." Written like a real person, not a bot.
- **Booking confirmed** — celebratory, includes Google review nudge block at peak satisfaction moment.
- All other emails: direct and informative.

---

## All emails are fire-and-forget

Emails are sent with `.catch(() => {})` — they won't block the response if Resend is down.  
Check Resend dashboard logs if emails are not arriving.

---

## Related
- [[Quote Flow]]
- [[Stripe Checkout]]
