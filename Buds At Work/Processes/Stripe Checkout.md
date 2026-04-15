# Stripe Checkout

How payment sessions are created and how Stripe events are handled.

---

## Creating a Checkout Session

**File:** `src/app/api/quotes/[id]/checkout/route.ts`

**Who can call it:** Authenticated users (customer must own the quote, or admin/employee)

**Flow:**
1. Load quote — must be `finalized` or `payment_pending`
2. If quote already has `converted_order_id` → update existing order
3. If not → insert new order with `status: 'pending'`
4. Create Stripe session with **idempotency key** `{quote.id}-checkout`  
   (prevents duplicate sessions if request is retried)
5. Update order with `stripe_checkout_session_id`
6. Update quote: `status → payment_pending`, `payment_status → pending_payment`
7. Fire **Quote Finalized** email with payment link (fire-and-forget)
8. Return `{ url, session_id, order_id }`

**Stripe settings:**
- `mode: 'payment'`
- `currency: 'aud'`
- `automatic_payment_methods: { enabled: true }` → Apple Pay, Google Pay, Link

---

## Webhook Events Handled

**File:** `src/app/api/webhooks/stripe/route.ts`

| Event | What happens |
|---|---|
| `checkout.session.completed` | Order → `confirmed`, payment record inserted, quote → `paid`, **Booking Confirmed** email sent |
| `checkout.session.expired` | Quote reset to `finalized` / `not_requested` so customer can retry |
| `payment_intent.payment_failed` | Order → `failed`, quote reset to `finalized` for retry, audit log |
| `payment_intent.succeeded` | Backup handler — inserts payment record only if not already recorded |
| `charge.refunded` | Payment record inserted (full or partial), order → `cancelled` if full refund |

---

## Order Lifecycle

```
pending → confirmed → cancelled (if fully refunded)
        ↘ failed (payment failed)
```

---

## Metadata on Stripe Sessions

| Key | Value |
|---|---|
| `order_id` | UUID of the order |
| `quote_id` | UUID of the quote |
| `service_type` | e.g. `cleaning`, `windows` |
| `context` | `home` or `commercial` |
| `customer_name` | truncated to 255 chars |

---

## Testing with Stripe CLI

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger specific events:
stripe trigger checkout.session.completed
stripe trigger checkout.session.expired
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded
```

Use test card `4242 4242 4242 4242` for successful payments.

---

## Related
- [[Quote Flow]]
- [[New Booking]]
- [[Refund Process]]
- [[Failed Payment]]
- [[Email Triggers]]
- [[Checklist Template]]
- [[Services Flow Improvements — April 2026]]
