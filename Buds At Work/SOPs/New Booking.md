# SOP: New Booking

What to do when a booking is confirmed (payment received).

---

## Trigger
Stripe fires `checkout.session.completed` → order status → `confirmed` → Booking Confirmed email sent automatically.

## Checklist

- [ ] Check Supabase `orders` table — status should be `confirmed`
- [ ] Check Supabase `payments` table — payment record should exist with `status: completed`
- [ ] Check Supabase `quotes` table — status should be `paid`
- [ ] Verify customer received **Booking Confirmed** email (check Resend dashboard)
- [ ] Assign crew member via `/dashboard` → Schedule tab
- [ ] Add job to crew schedule in `/crew` portal
- [ ] Confirm service address is correct (from quote notes — prefixed with `Address:`)
- [ ] Check for any customer notes or special requests in quote notes
- [ ] If commercial job — confirm `context: commercial` and check `scope` for niche type

---

## If email didn't send
1. Go to Resend dashboard → Logs
2. Check `hello@budsatwork.com` domain is verified
3. If not verified — add DNS records from Resend and wait for propagation
4. Manually send a confirmation if urgent

---

## Related
- [[Stripe Checkout]]
- [[Quote Flow]]
- [[Email Triggers]]
- [[Refund Process]]
- [[Failed Payment]]
- [[Checklist Template]]
- [[Services Flow Improvements — April 2026]]

## Architecture
- [[Quote Pipeline]] — the code path that fires when payment completes
- [[Mission Control]] — operational state that reflects the new confirmed booking
