# Product Management

> Roadmap, sprint planning, feature prioritisation, and release tracking for Buds At Work.

**Dashboard entry:** `/dashboard/pipelines` (Workflows)  
**Domain card shows:** "Roadmap & workflows" · Links to pipelines

---

## Current Product Phases

### Phase 1 — Core booking flow ✅ Done
- Services wizard (home + commercial)
- Stripe checkout + webhooks
- Email automation (7 transactional emails)
- Admin dashboard (orders, quotes, crew, dispatch)

### Phase 2 — Operational depth ✅ Done
- Quote finalization + reminder flow
- Re-engagement (checkout expired, 24h nudge)
- Crew portal (`/crew`)
- Customer portal (`/portal`)
- Audit log + role-based access

### Phase 3 — Growth & automation 🔄 In progress (April 2026)
- Mobile sticky bar on services wizard (step 3)
- Home page redesign
- Email re-engagement sequences
- Domain Command Panel on admin dashboard ✅ (2026-04-15)
- Subscriptions / recurring bookings (partial)

### Phase 4 — Scale 🗺️ Planned
- Auto-assign crew based on availability
- ✅ Google Ads conversion tracking *(2026-04-20 — fires on quote submit + payment confirmed)*
- Customer LTV dashboard
- Automated BAS export
- Multi-location support (expand beyond Logan/South Brisbane)
- Public API for partner integrations

---

## Feature Prioritisation Framework

Use **ICE scoring** (Impact × Confidence × Ease, each 1–10):

| Feature | Impact | Confidence | Ease | Score | Status |
|---|---|---|---|---|---|
| Auto-assign crew | 9 | 7 | 4 | 252 | Planned |
| Cron auto-remind 24h | 8 | 9 | 8 | 576 | ✅ Done (2026-04-20) |
| Google Ads tracking | 8 | 8 | 7 | 448 | ✅ Done (2026-04-20) |
| Invoice real insert | 7 | 9 | 8 | 504 | ✅ Done (2026-04-20) |
| Weekly KPI email | 7 | 8 | 7 | 392 | Planned |
| Sentry error tracking | 6 | 9 | 9 | 486 | ✅ Done (2026-04-20) |

---

## Sprint Cadence

- **Cycle:** 2 weeks (informal — solo/small team)
- **Review:** End of each sprint → update this page
- **Planning trigger:** Previous sprint closes or major user feedback received

---

## User Personas

**Admin (Jackson):** Needs to process 10–30 bookings/week with minimal friction. Wants full visibility across finance, ops, crew — zero tab-switching.

**Crew member:** Needs to see their schedule, address, and customer contact for the day. Mobile-first, zero admin burden.

**Customer:** Wants a quote in < 2 min, a clear payment link, and to know when the crew is arriving. Reassurance at every step.

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-15 | Added Domain Command Panel to dashboard | Admin needed full-spectrum visibility, not just finance |
| 2026-04-15 | Added "Send Reminder" + "Add Crew" quick actions | Highest-frequency ops tasks missing from quick bar |
| 2026-04-15 | Upgraded subtitle to "Full-spectrum operations command centre" | Reflects actual scope of dashboard |
| 2026-04-20 | Wired dashboard quick-action forms to real APIs | Invoice, Expense, Schedule Job were all mock; now hit Supabase |
| 2026-04-20 | Installed Sentry + Vercel Cron | Error visibility + automated 24h quote reminders — no more manual nudges |
| 2026-04-20 | Added Google Ads conversion tracking | Fires on quote submit & payment confirmed; uses env-var conversion labels |

---

## Related
- [[Admin]]
- [[Engineering]]
- [[Operations]]
- [[Automations Log]]
- [[Services Flow Improvements — April 2026]]
