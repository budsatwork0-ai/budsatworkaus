# Data & Analytics

> Business intelligence, KPI tracking, reporting, and insights for Buds At Work.

**Dashboard entry:** Reports tab (press `7`) · Overview tab (press `3`)  
**Domain card shows:** Gross margin % · Average job value

---

## North Star Metrics

| Metric | Definition | Target |
|---|---|---|
| Monthly Revenue | Total Stripe payments confirmed | $15,000/mo |
| Jobs Completed | Completed orders per month | 30+/mo |
| Gross Margin | (Revenue − COGS) ÷ Revenue | ≥ 40% |
| Average Job Value | Total revenue ÷ jobs completed | > $150 |
| Quote Conversion Rate | Paid quotes ÷ submitted quotes | > 60% |
| Labour % | Crew payments ÷ revenue | < 35% |

---

## Dashboard Data Sources

| Data | Source Table | API |
|---|---|---|
| Revenue | `payments` (status: completed) | `/api/dashboard` |
| Expenses | `bills` / manual entries | `/api/dashboard` |
| Outstanding invoices | `quotes` (status: finalized, payment_pending) | `/api/dashboard` |
| Jobs completed | `orders` (status: completed) | `/api/dashboard` |
| Revenue by service | `orders` JOIN `quotes`.service_type | `/api/dashboard` |
| Activity feed | `audit_log` | `/api/dashboard` |

---

## Reports Tab

**File:** `src/app/(app)/dashboard/components/tabs/ReportsTab.tsx`

Currently includes:
- Revenue vs expenses 6-month trend (line chart)
- Revenue by service type (pie chart)
- Expenses by category (bar chart)
- Monthly goals progress
- Overdue + due-soon alerts

**Missing / to build:**
- Conversion funnel (wizard visits → quotes → payments)
- Service profitability by type
- Crew utilisation rate
- Geographic revenue map (Logan postcodes)
- Customer LTV (lifetime value) and repeat booking rate

---

## Key SQL Queries (Supabase)

**Revenue MTD:**
```sql
SELECT SUM(amount) FROM payments
WHERE status = 'completed'
AND created_at >= date_trunc('month', NOW());
```

**Quote conversion rate:**
```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'paid') AS paid,
  COUNT(*) AS total,
  ROUND(COUNT(*) FILTER (WHERE status = 'paid')::numeric / COUNT(*) * 100, 1) AS conversion_pct
FROM quotes
WHERE created_at >= date_trunc('month', NOW());
```

**Revenue by service (MTD):**
```sql
SELECT o.service_type, SUM(p.amount) AS revenue
FROM payments p
JOIN orders o ON o.id = p.order_id
WHERE p.status = 'completed'
AND p.created_at >= date_trunc('month', NOW())
GROUP BY o.service_type
ORDER BY revenue DESC;
```

---

## Visitors Tab

**File:** `src/app/(app)/dashboard/components/tabs/VisitorsTab.tsx`

Tracks site visitors — useful for funnel analysis. Check weekly for:
- Spike on any service page (organic vs paid?)
- Drop-off on services wizard steps
- Mobile vs desktop breakdown

---

## Automation Opportunities

- [ ] Weekly KPI email: auto-generate and send Monday 8am
- [ ] Monthly PDF report: revenue, jobs, margin — save to Supabase Storage
- [ ] Conversion funnel tracking via PostHog or Plausible
- [ ] Alert when conversion rate drops below 50% for 3+ consecutive days
- [ ] Cohort analysis: repeat customers by first-service-type

---

## Related
- [[Admin]]
- [[Finance]]
- [[Sales Pipeline]]
- [[Engineering]]
