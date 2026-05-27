# Quote Flow

End-to-end journey from wizard submission to confirmed booking.

---

## Step 1 — Service Selection (`/services`)
- User picks context: **home** or **commercial**
- User picks service: windows, cleaning, yard, dump, auto, laundry_sneakers
- Selecting a service auto-advances to Step 2 with a default scope

**Key file:** `src/app/(public)/services/page.tsx`  
**State:** `useLocalStorageReducer` + `wizardReducer` — persists across refreshes

---

## Step 2 — Scope & Configuration
- User selects scope card (e.g. "1 Bedroom", "Office", "Full Detail")
- Clicking "Book This" triggers `onAdd()` which sets scope and advances to Step 3
- Commercial cleaning uses `commercialCleaningType` (not just `scope`)
- Pricing engine recalculates live: `src/app/(public)/services/lib/pricing/engine.ts`

---

## Step 3 — Contact Details & Submit
- Fields: Full name, email, phone (min 10 digits), service address, notes, availability
- Turnstile CAPTCHA fires on first field focus
- On submit → `POST /api/quotes`

**Validations before submit:**
- name ≥ 2 chars
- email: regex `[^\s@]+@[^\s@]+\.[^\s@]+`
- phone: ≥ 10 digits (non-numeric stripped)
- address: non-empty

---

## API: `POST /api/quotes`
**File:** `src/app/api/quotes/route.ts`

1. Rate limit: 10 per IP per 15 min
2. Auth optional — anonymous quotes allowed
3. Validates: `service_type` enum, `context` enum, email format, total > 0
4. Inserts quote with `status: 'submitted'`, `payment_status: 'not_requested'`
5. Fires **Quote Received** email via Resend (fire-and-forget)

---

## Quote Lifecycle

```
submitted → finalized → payment_pending → paid
                                        ↘ failed (back to finalized)
```

- `submitted` — customer filled the form
- `finalized` — admin reviewed and approved a total
- `payment_pending` — Stripe checkout session created
- `paid` — webhook confirmed payment
- `failed` — payment failed, reset to finalized for retry

---

## Related
- [[Stripe Checkout]]
- [[Email Triggers]]
- [[New Booking]]
- [[Failed Payment]]
- [[Refund Process]]
- [[Checklist Template]]
- [[Bug Tracker]]
- [[Automations Log]]
- [[Services Flow Improvements — April 2026]]

## Architecture
- [[ServicesPageContent]] — the wizard component driving Steps 1–3
- [[WizardState]] — shared state shape persisted across all steps
- [[Pricing Engine]] — live price calculation on every state change
- [[Quote Pipeline]] — server-side API and lifecycle after form submit
