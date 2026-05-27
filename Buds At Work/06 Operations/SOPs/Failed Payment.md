# SOP: Failed Payment

Recovery steps when a customer's payment fails.

---

## What happens automatically
When Stripe fires `payment_intent.payment_failed`:
- Order status → `failed`
- Quote status → reset to `finalized`, payment_status → `not_requested`
- Customer can retry payment — admin re-sends checkout link

---

## Checklist

- [ ] Check Stripe Dashboard for the failure reason (insufficient funds, card declined, etc.)
- [ ] Contact customer if needed with the failure reason
- [ ] Go to `/dashboard` → quote → click "Request Payment" to generate a new checkout link
- [ ] Send the new checkout link to the customer (email or SMS)
- [ ] Monitor Supabase `orders` table — new attempt will create a new payment record on success

---

## Common failure reasons

| Reason | Action |
|---|---|
| Insufficient funds | Ask customer to use a different card |
| Card declined (generic) | Ask customer to contact their bank or try another card |
| Expired card | Customer needs to update card details |
| 3D Secure failed | Ask customer to authenticate with their bank app |
| Duplicate checkout session | Check if payment was actually charged before retrying |

---

## If quote is stuck in `payment_pending` after failed payment
This can happen if the webhook didn't fire. Fix manually:
1. Go to Supabase → `quotes` table
2. Find the quote by ID
3. Set `status = 'finalized'`, `payment_status = 'not_requested'`
4. Re-send checkout link from `/dashboard`

---

## Related
- [[Stripe Checkout]]
- [[Quote Flow]]
- [[Email Triggers]]
- [[New Booking]]
- [[Refund Process]]
- [[Services Flow Improvements — April 2026]]
- [[NDIS Pricing Rewrite & Stripe Hardening — April 2026]] *(rate-limit + idempotency follow-ups still open)*
