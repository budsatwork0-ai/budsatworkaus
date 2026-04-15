# SOP: Refund Process

When and how to issue refunds.

---

## When to Refund
- Customer cancels before work begins
- Work quality issue requiring full or partial remedy
- Duplicate charge (check Stripe for duplicate sessions)

---

## How to Issue a Refund

### Via Stripe Dashboard (preferred)
1. Go to Stripe Dashboard → Payments
2. Find the payment by customer name or order ID
3. Click **Refund** → choose full or partial amount
4. Add a reason note
5. Stripe fires `charge.refunded` webhook automatically

### What happens automatically (webhook handler)
- Full refund: order status → `cancelled`, payment record inserted with `status: refunded`
- Partial refund: payment record inserted with `status: partial_refund`
- Audit log entry created in Supabase `audit_log` table

---

## Checklist

- [ ] Confirm refund reason with customer
- [ ] Issue refund via Stripe Dashboard
- [ ] Verify webhook processed — check Supabase `payments` table for refund record
- [ ] Check `orders` table — status should be `cancelled` for full refund
- [ ] Notify customer if email wasn't automatically sent
- [ ] Note the refund in crew schedule if crew was already assigned

---

## Related
- [[Stripe Checkout]]
- [[New Booking]]
- [[Failed Payment]]
- [[Email Triggers]]
- [[Quote Flow]]
- [[Services Flow Improvements — April 2026]]
