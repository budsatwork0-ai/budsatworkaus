# Finance

> Revenue, expenses, cash position, reconciliation, GST, and BAS for Buds At Work.

**Dashboard entry:** Summary cards + Overview tab (press `3`)  
**Quick actions:** Create Invoice · Record Expense

---

## Key Metrics to Watch Daily

| Metric | Source | Target |
|---|---|---|
| Cash / Bank Balance | Summary card | > $0 buffer |
| Outstanding Receivables | Receivables tab | < $2,000 aged >14d |
| Net Profit MTD | Summary card | ≥ 30% margin |
| Gross Margin | Overview → Operations Snapshot | ≥ 40% |
| Average Job Value | Overview → Operations Snapshot | > $150 |

---

## Revenue Streams

| Service | Typical Price Range | Notes |
|---|---|---|
| Window cleaning | $80–$300 | Home + commercial |
| Home cleaning | $100–$400 | Scope-based (bedrooms) |
| Yard care | $80–$250 | Mowing, edges, rubbish |
| Dump runs | $150–$400 | Volume/truck load |
| Car detailing | $120–$350 | Interior + exterior packages |
| Laundry & Sneakers | $30–$120 | Sneaker restoration premium |

---

## Stripe Reconciliation

**Monthly reconciliation checklist:**
- [ ] Log into Stripe → Payouts → confirm all payouts settled
- [ ] Cross-check Stripe payouts against Supabase `payments` table
- [ ] Identify any `partial_refund` payments — match to orders
- [ ] Flag any `charge.refunded` webhooks that didn't update order status
- [ ] Export Stripe CSV → cross-reference with BAS period

**Webhook events that affect accounting:**
- `checkout.session.completed` → revenue confirmed
- `charge.refunded` → revenue reversal (full or partial)
- `payment_intent.payment_failed` → no revenue, quote resets

---

## GST & BAS

- **ABN:** Confirm in `/dashboard/settings`
- **GST registered:** Yes (all prices inclusive of 10% GST)
- **BAS lodgement:** Quarterly (confirm with accountant)
- **Key BAS lines:**
  - G1 Total sales (all Stripe payments)
  - G10 Capital purchases (equipment, tools)
  - G11 Non-capital purchases (supplies, fuel, wages)
- **Export source:** Stripe CSV + Supabase `payments` export

---

## Expense Categories

| Category | Examples |
|---|---|
| Supplies | Cleaning products, microfibre cloths, sneaker cleaners |
| Fuel | Crew vehicle fuel (km tracking → ATO rate or actuals) |
| Wages | Contractor/crew payments (not PAYG unless employed) |
| Equipment | Pressure washers, vacuums, detailing kits |
| Insurance | Public liability, vehicle |
| Software | Supabase, Vercel, Resend, Stripe fees |
| Marketing | Google Ads, flyers, social |

---

## Automation Opportunities

- [ ] Auto-BAS export: scheduled Supabase → CSV every quarter
- [ ] Auto-reconciliation: daily Stripe payout vs. Supabase payments
- [ ] Low-cash-balance alert: notify when cash < $500
- [ ] Weekly P&L email: auto-generate and send Monday mornings

---

## Related
- [[Admin]]
- [[Stripe Checkout]]
- [[Refund Process]]
- [[Quote Flow]]
