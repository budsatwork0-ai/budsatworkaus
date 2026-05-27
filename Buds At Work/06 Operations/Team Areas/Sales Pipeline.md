# Sales Pipeline

> Lead capture, quote management, conversion optimisation, and re-engagement for Buds At Work.

**Dashboard entry:** Receivables tab (press `4`) · Quotes page: `/dashboard/quotes`  
**Quick action:** Send Reminder (24h nudge email)

---

## Pipeline Stages

```
Visitor → Services Wizard → Quote Submitted → Finalized → Payment Link Sent → Paid
                                                         ↓ (no action 24h)
                                              Quote Reminder (re-engagement)
                                                         ↓ (link expired)
                                              Checkout Expired → Re-request via portal
```

---

## Conversion Metrics to Track

| Metric | Target | Where to check |
|---|---|---|
| Wizard → Quote submission rate | > 40% | Visitors tab → see drop-off |
| Quote → payment conversion | > 60% | Quotes page: submitted vs paid |
| Average days quote → payment | < 2 days | Supabase `quotes` timestamps |
| Re-engagement email open rate | > 35% | Resend dashboard |
| Checkout expiry rate | < 20% | Stripe dashboard |

---

## Quote Review Process

1. New quote arrives → `/dashboard/quotes` → status: `submitted`
2. Review service type, scope, address, customer notes
3. If pricing looks right → click **Finalize** (sets total, creates checkout link)
4. Customer receives **Quote Finalized** email with payment link
5. If no payment after ~24h → click **Send Reminder** (quick action on dashboard)
6. If Stripe checkout expires → customer can re-request via portal

**Price sanity checks before finalizing:**
- Windows: is address 2-storey? Add $40–80
- Cleaning: bedroom count matches scope card selection?
- Dump run: confirm item types — overstay charge if multiple loads?
- Commercial: always check `context: commercial` + `scope` niche

---

## Re-engagement Triggers

| Trigger | Action | File |
|---|---|---|
| 24h no payment | Send reminder email | `POST /api/quotes/[id]/remind` |
| Checkout expired | Auto-reset quote to `finalized` | Stripe webhook |
| Customer portal visit | Encourage re-checkout | `/portal` |

---

## Lead Sources

- **Organic search** — Google (primary)
- **Google Reviews** — social proof drives repeat + referral
- **Direct referral** — word of mouth (Logan community)
- **Future:** Google Ads (not live yet)

---

## Pricing Engine

**File:** `src/app/(public)/services/lib/pricing/engine.ts`

All prices are calculated client-side from scope × service type × context. Admin can override the final total at finalization before sending the payment link. This is the key trust moment — make the total fair and competitive.

---

## Automation Opportunities

- [ ] Auto-remind at 24h (cron job using `POST /api/quotes/[id]/remind`)
- [ ] Auto-remind at 48h with discount offer
- [ ] Abandoned wizard recovery (email if Turnstile fires but no submit)
- [ ] Google Ads conversion tracking on `checkout.session.completed`
- [ ] Monthly pipeline report: quote volume, conversion %, revenue

---

## Related
- [[Admin]]
- [[Quote Flow]]
- [[Email Triggers]]
- [[Stripe Checkout]]
- [[Finance]]
