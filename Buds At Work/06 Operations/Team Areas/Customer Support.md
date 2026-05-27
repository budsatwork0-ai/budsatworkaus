# Customer Support

> Complaint handling, escalations, refunds, and feedback management for Buds At Work.

**Dashboard entry:** `/dashboard/orders` · `/dashboard/feedback`  
**Alerts:** Overdue invoices + due-soon count visible on Domain Command Panel

---

## Support Request Types

| Type | Frequency | Resolution Path |
|---|---|---|
| Payment not confirmed | Medium | Check Stripe + Supabase `payments` |
| Email not received | Medium | Check Resend dashboard logs |
| Reschedule request | Medium | Reassign crew in Dispatch tab |
| Quality complaint | Low-Medium | Immediate callback + remedy |
| Refund request | Low | [[Refund Process]] SOP |
| Failed payment query | Medium | [[Failed Payment]] SOP |
| Portal access issue | Low | Check auth/Supabase user |
| Address error | Low | Update in Supabase `quotes` |

---

## Escalation Matrix

| Severity | Definition | Response Time | Owner |
|---|---|---|---|
| P1 — Critical | Payment charged, no service delivered | Same day | Admin / founder |
| P2 — High | Quality complaint, customer threatening review | Within 4h | Admin |
| P3 — Medium | Reschedule, missed communication | Within 24h | Admin |
| P4 — Low | General enquiry, portal question | Within 48h | Admin |

---

## Response Tone Guidelines

- **Empathy first** — acknowledge the issue before explaining or defending
- **No robot language** — "Hey [name]," not "Dear valued customer"
- **Offer concrete remedy** — partial refund, free re-clean, next job discount
- **Keep it short** — 3–5 sentences is enough for most replies
- **Always end with** a clear next step ("We'll reschedule you for X" or "Refund will appear in 5–10 days")

---

## Common Resolutions

**Quality complaint → Full refund declined:**
> "Hey [name] — really sorry the result wasn't what you expected. We'd love to come back and make it right at no extra charge. Can we lock in [date] to re-do [specific area]?"

**Payment failed — customer confused:**
> "Hey [name] — looks like the payment didn't go through this time. No stress — here's a fresh link to complete the booking: [link]. If you hit any issues, just reply here."

**Refund request — valid:**
> Follow [[Refund Process]] → issue in Stripe → confirm via email.

---

## Feedback Loop

- **Source:** `/dashboard/feedback` page
- **Google Reviews:** Sent in every Booking Confirmed email → monitor weekly
- **Pattern detection:** If 3+ complaints about same issue → treat as product bug → escalate to [[Engineering]]
- **Positive reviews:** Screenshot + share with crew (morale + marketing)

---

## Automation Opportunities

- [ ] Auto-reply acknowledgement email within 5 min of any contact form submission
- [ ] Sentiment analysis on feedback: flag negative reviews for immediate attention
- [ ] Auto-escalate if order status stuck in `pending` > 48h with no crew assigned
- [ ] Weekly feedback digest email to admin every Monday

---

## Related
- [[Admin]]
- [[Refund Process]]
- [[Failed Payment]]
- [[Email Triggers]]
- [[Operations]]
