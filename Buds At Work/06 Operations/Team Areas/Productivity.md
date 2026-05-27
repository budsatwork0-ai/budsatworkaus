# Productivity

> Daily admin routines, automations, and workflow efficiency for Buds At Work.

**Dashboard entry:** `/dashboard/automations` · `/dashboard/pipelines`  
**Domain card shows:** "Automations dashboard" · Recipes · Triggers · Workflows

---

## Daily Admin Routine (15 min)

**Morning (8–9am):**
- [ ] Open `/dashboard` → check notification bell for new quotes/applicants
- [ ] Review Schedule tab → confirm today's jobs are assigned
- [ ] Check Dispatch tab → any jobs without crew?
- [ ] Scan Domain Command Panel → any red badges (overdue, urgent)?
- [ ] Reply to any customer enquiries from overnight

**Midday:**
- [ ] Review Quotes page → any new submissions to finalize?
- [ ] Check Stripe dashboard → any failed payments or disputes?
- [ ] Send day-before reminders for tomorrow's jobs (manual until cron is live)

**Evening:**
- [ ] Mark completed jobs as `completed` in the dashboard
- [ ] Review Resend logs → any failed emails?
- [ ] Update Automations Log if any recipes were changed

---

## Active Automations

| Automation | Status | Type | Trigger |
|---|---|---|---|
| Booking Confirmed email | ✅ Live | Webhook | `checkout.session.completed` |
| Quote Received email | ✅ Live | API call | `POST /api/quotes` |
| Quote Finalized email | ✅ Live | API call | `POST /api/quotes/[id]/checkout` |
| Service Scheduled email | ✅ Live | API call | `POST /api/orders/[id]/assign` |
| Checkout Expired reset | ✅ Live | Webhook | `checkout.session.expired` |
| Payment Failed reset | ✅ Live | Webhook | `payment_intent.payment_failed` |
| Refund processed | ✅ Live | Webhook | `charge.refunded` |
| Quote reminder (24h) | ⚠️ Manual | API call | Manual trigger in dashboard |
| Day-before reminder | ⚠️ Manual | API call | Manual trigger in Dispatch tab |

---

## Automation Backlog (Priority Order)

1. **Auto cron: 24h quote reminder** — runs nightly, hits `POST /api/quotes/[id]/remind` for all `finalized` quotes > 20h old
2. **Auto cron: day-before reminder** — runs 6pm daily, sends day-before email for all jobs scheduled tomorrow
3. **Auto-complete jobs** — mark `in_progress` → `completed` after scheduled time + 4h (with cancellation escape hatch)
4. **Weekly KPI email** — Monday 8am: revenue, jobs, margin, conversion rate → admin email
5. **Stripe reconciliation alert** — daily: flag any payments not matched in Supabase
6. **Low cash alert** — notify if cash balance < $500
7. **New Google Review notification** — scan and notify admin of new reviews

---

## Workflow Management

**Dashboard:** `/dashboard/pipelines`  
Pipelines allow visual kanban-style workflow management for custom processes (e.g., lead nurturing, crew onboarding stages).

---

## Keyboard Shortcuts (Dashboard)

| Shortcut | Action |
|---|---|
| `1` | Switch to Schedule tab |
| `2` | Switch to Dispatch tab |
| `3` | Switch to Overview tab |
| `4` | Switch to Receivables tab |
| `5` | Switch to Payables tab |
| `6` | Switch to Jobs tab |
| `7` | Switch to Reports tab |
| `8` | Switch to Visitors tab |
| `R` | Refresh dashboard data |
| `⌘K` | Open command palette / enterprise search |
| `Esc` | Close drawer / modal |

---

## Time Savers

- **Quick actions bar:** Create Invoice · Record Expense · Schedule Job · Send Reminder · Add Crew — all accessible in 2 clicks from dashboard home
- **Domain Command Panel:** 12 domains at a glance — click any card to deep-dive
- **Notification bell:** Shows pending quotes, orders, and applicants — check it first
- **R key refresh:** Instantly refresh all dashboard metrics without mouse

---

## Related
- [[Admin]]
- [[Automations Log]]
- [[Operations]]
- [[Engineering]]
