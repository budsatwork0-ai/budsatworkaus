# Bug Tracker

Quick-capture for bugs found during ops or testing.  
Format each entry: date, description, severity, status.

---

## Fixed (2026-04-14)

| Bug | Severity | Fix |
|---|---|---|
| Phone scroll-to-invalid used `< 8` digit threshold but validation requires `>= 10` — silent block on 8-9 digit phones | HIGH | Changed threshold to `< 10` in services/page.tsx |
| Commercial niche scope cards never showed as selected — `null === 'office'` always false | MEDIUM | Added `?? ''` null coalescing on `commercialCleaningType` comparison |
| `(S as any).commFrequency` type assertion in quote POST body | MEDIUM | Removed cast — `S.commFrequency` is fully typed |
| No idempotency key on Stripe checkout session creation — retries could create duplicate sessions | CRITICAL | Added `idempotencyKey: {quote.id}-checkout` |
| No try/catch on `stripe.checkout.sessions.create` — unhandled throw gave opaque 500 | HIGH | Wrapped in try/catch with error logging |
| DB update errors after checkout creation were silently swallowed | HIGH | Added `.error` checks with `console.error` logging |
| `payment_intent.payment_failed` not handled — order/quote stuck in bad state | HIGH | Added handler: order → `failed`, quote → `finalized` |
| `checkout.session.expired` not handled — quote stuck in `payment_pending` forever | HIGH | Added handler: quote reset to `finalized` |
| `.single()` in payment_intent backup handler throws on no rows | MEDIUM | Changed to `.maybeSingle()` |
| Refund detection used `charge.refunded` (boolean) instead of `amount_refunded === amount` | HIGH | Fixed comparison for accurate full vs partial refund |
| No server-side `service_type` or `context` validation in `POST /api/quotes` | MEDIUM | Added enum checks with 400 responses |
| No server-side email format validation in `POST /api/quotes` | MEDIUM | Added regex validation |

---

## Open

> Add new bugs here as they're found during ops.

---

## Template

```
| [description] | HIGH/MEDIUM/LOW | [pending/in progress/fixed] |
```

---

## Related
- [[Services Flow Improvements — April 2026]]
- [[Quote Flow]]
- [[Stripe Checkout]]
- [[Checklist Template]]
