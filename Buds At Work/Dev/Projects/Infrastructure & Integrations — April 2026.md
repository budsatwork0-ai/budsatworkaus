# Infrastructure & Integrations — April 2026

**Date:** 2026-04-20
**Status:** Implemented
**Scope:** Dashboard form wiring, Sentry error tracking, Google Ads conversions, Vercel Cron auto-reminders

---

## Why This Was Done

The four dashboard quick-action forms (Create Invoice, Record Expense, Schedule Job) were all mock — submitting them did nothing. Sentry, Google Ads conversion tracking, and cron-based 24h quote reminders were on the "next sprint" ICE list with scores of 486, 448, and 576 respectively. All were straightforward and done in a single session.

---

## Changes

### 1. Dashboard quick-action forms wired to real APIs

**File:** `src/app/(app)/dashboard/components/QuickActions.tsx`

All three mock forms now hit real endpoints and surface errors via toast:

| Form | Endpoint | Table |
|------|----------|-------|
| Create Invoice | `POST /api/orders` | `orders` (status: `invoiced`) |
| Record Expense | `POST /api/payables` | `payables` |
| Schedule Job | `POST /api/orders` | `orders` (status: `scheduled`) |

**New route:** `src/app/api/payables/route.ts` — inserts into the `payables` table (vendor_name, category, amount, due_date, notes). Admin/employee only.

---

### 2. Sentry error tracking

**Package:** `@sentry/nextjs` installed.

**Config files created:**
- `sentry.client.config.ts` — browser errors + session replay (5% sample, 100% on error)
- `sentry.server.config.ts` — server-side errors
- `sentry.edge.config.ts` — edge runtime errors
- `next.config.ts` — wrapped with `withSentryConfig`

**Env vars required in Vercel:**
- `NEXT_PUBLIC_SENTRY_DSN` — from Sentry project settings (client)
- `SENTRY_DSN` — same value (server)
- `SENTRY_ORG` — Sentry org slug (for source map uploads)
- `SENTRY_PROJECT` — Sentry project name

Only active in `NODE_ENV === 'production'`.

---

### 3. Google Ads conversion tracking

**File:** `src/lib/analytics/conversions.ts`

Two named conversion events:
- `trackQuoteSubmitted(value?)` — fires in `src/app/(public)/services/page.tsx` immediately after a successful quote API response
- `trackPaymentCompleted(value?)` — fires in `src/app/(public)/services/checkout/success/page.tsx` once order data is loaded from the session

Both guard on `NEXT_PUBLIC_GOOGLE_ADS_ID` being set — safe to deploy without the env var (no-ops).

**Env vars required in Vercel:**
- `NEXT_PUBLIC_GOOGLE_ADS_ID` — format: `AW-XXXXXXXXXX`
- `NEXT_PUBLIC_GOOGLE_ADS_QUOTE_LABEL` — from Google Ads conversion action
- `NEXT_PUBLIC_GOOGLE_ADS_PAYMENT_LABEL` — from Google Ads conversion action

---

### 4. Vercel Cron — 24h quote auto-reminders

**Cron route:** `src/app/api/cron/remind-quotes/route.ts`

Runs every hour. Queries for quotes that are:
- Status `finalized` or `payment_pending`
- Not paid (`payment_status != 'paid'`)
- Created more than 24h ago
- `last_reminder_sent_at IS NULL` (not yet reminded)

For each qualifying quote, fires `quoteReminderEmail` via Resend and stamps `last_reminder_sent_at` to prevent double-fire.

**Vercel schedule:** `vercel.json` → `"schedule": "0 * * * *"` (top of every hour)

**Security:** Secured by `Authorization: Bearer <CRON_SECRET>` header — set `CRON_SECRET` in Vercel project env.

---

## Key Files Modified / Created

| File | Change |
|------|--------|
| `src/app/(app)/dashboard/components/QuickActions.tsx` | Wired Create Invoice, Record Expense, Schedule Job to real APIs |
| `src/app/api/payables/route.ts` | **NEW** — POST handler to insert payables |
| `src/app/api/cron/remind-quotes/route.ts` | **NEW** — hourly cron to auto-send 24h nudge emails |
| `src/lib/analytics/conversions.ts` | **NEW** — Google Ads conversion helpers |
| `src/app/(public)/services/page.tsx` | Added `trackQuoteSubmitted` call |
| `src/app/(public)/services/checkout/success/page.tsx` | Added `trackPaymentCompleted` call |
| `sentry.client.config.ts` | **NEW** |
| `sentry.server.config.ts` | **NEW** |
| `sentry.edge.config.ts` | **NEW** |
| `next.config.ts` | Wrapped with `withSentryConfig` |
| `vercel.json` | **NEW** — Vercel Cron schedule |

---

## Verification

- [ ] Record Expense form → submits → row appears in Supabase `payables` table
- [ ] Schedule Job form → submits → row appears in `orders` with status `scheduled`
- [ ] Create Invoice form → submits → row appears in `orders` with status `invoiced`
- [ ] Sentry DSN set → errors in prod appear in Sentry dashboard
- [ ] Google Ads env vars set → quote submit fires conversion in Google Ads
- [ ] Google Ads env vars set → payment confirmed fires conversion in Google Ads
- [ ] Cron fires → finalized unpaid quote >24h old receives reminder email
- [ ] `last_reminder_sent_at` stamped → cron doesn't double-fire
