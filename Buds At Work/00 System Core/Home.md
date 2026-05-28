# Buds At Work — Operations Hub

Local services platform (Logan & South Brisbane): cleaning, windows, yard care, dump runs, car detailing, laundry & sneakers.

> **→ [[Buds OS Dashboard]]** is the canonical operational view. Start there.

---

## Admin Command Centre

→ [[06 Operations/Team Areas/Admin|Admin]] — master index for all 12 operational domains

| Domain | Note |
|---|---|
| 💰 Finance | [[06 Operations/Team Areas/Finance\|Finance]] |
| ⚙️ Operations | [[06 Operations/Team Areas/Operations\|Operations]] |
| 📈 Sales Pipeline | [[06 Operations/Team Areas/Sales Pipeline\|Sales Pipeline]] |
| 👥 HR & Crew | [[06 Operations/Team Areas/HR & Crew\|HR & Crew]] |
| 🎧 Customer Support | [[06 Operations/Team Areas/Customer Support\|Customer Support]] |
| 📊 Data & Analytics | [[06 Operations/Team Areas/Data & Analytics\|Data & Analytics]] |
| 🔧 Engineering | [[06 Operations/Team Areas/Engineering\|Engineering]] |
| 🗺️ Product Management | [[06 Operations/Team Areas/Product Management\|Product Management]] |
| ⚖️ Legal | [[06 Operations/Team Areas/Legal\|Legal]] |
| 🎨 Design System | [[06 Operations/Team Areas/Design System\|Design System]] |
| 🔍 Enterprise Search | [[06 Operations/Team Areas/Enterprise Search\|Enterprise Search]] |
| ✅ Productivity | [[06 Operations/Team Areas/Productivity\|Productivity]] |

---

## Processes
- [[Quote Flow]] — how a customer goes from wizard → API → database
- [[Stripe Checkout]] — checkout creation, webhook events, order lifecycle
- [[Email Triggers]] — what fires when, via Resend

## SOPs
- [[New Booking]] — steps to take when a booking is confirmed
- [[Refund Process]] — when and how to trigger refunds
- [[Failed Payment]] — recovery steps for failed checkouts

## Automation
- [[Automations Log]] — which automation recipes are currently live
- [[Checklist Template]] — end-to-end test checklist for payment flow
- [[05 Automation/Graph Maintenance|Graph Maintenance]] — scheduled graph health pass

---

## Dev

- [[Bug Tracker]] — quick-capture for bugs found during ops
- [[ADR-Index]] — all Architectural Decision Records
- [[Dev/Projects/|→ Dev/Projects/]] — all project change docs (Services Flow, NDIS, Admin, etc.)

**Recent logs:**
- [[Dev/Dev Log 2026-05-27|Dev Log 2026-05-27]]
- [[Dev/Dev Log 2026-05-26|Dev Log 2026-05-26]]
- [[Dev/Dev Log 2026-05-25|Dev Log 2026-05-25]]
- [[Dev/Dev Log 2026-05-24|Dev Log 2026-05-24]]
- [[Dev/Dev Log 2026-05-23|Dev Log 2026-05-23]]

## Active Refactors
- [[../03 Active Refactors/Vault Restructure Plan|Vault Restructure Plan]] — Batches 0–4 shipped; Batch 5 gated on code refactor
- [[../03 Active Refactors/Services Core Extraction|Services Core Extraction]] — pricing, routing, estimation out of services/page.tsx
- [[../03 Active Refactors/Next Safe Refactor Batches|Next Safe Refactor Batches]] — pre-scoped, risk-assessed batch queue
- [[../03 Active Refactors/Known Unsafe Areas|Known Unsafe Areas]] — read before touching any of these

---

## Architecture
- [[Bud Core Runtime]] — operational truth engine powering the admin dashboard
- [[Agent Runtime]] — AI agent execution layer (30+ agents, guardrails, cron)
- [[Quote Pipeline]] — server-side quote → checkout → webhook lifecycle
- [[ServicesPageContent]] — the public quote wizard
- [[Mission Control]] — aggregated operational health state
- [[Graphify]] — live codebase knowledge graph
- [[Graph-Health-Agent]] — graph connectivity, orphan detection, hub health
- [[Agents/README|Agent Workspaces]] — all agent workspaces, findings, decisions, and issues

---

## Quick Links
- Admin dashboard: `/dashboard`
- Crew portal: `/crew`
- Client portal: `/portal`
- Services wizard: `/services`
- Stripe dashboard: https://dashboard.stripe.com
- Resend dashboard: https://resend.com
- Supabase dashboard: https://supabase.com/dashboard
- Google Reviews: https://g.page/r/CYTORrk6H3xmEAI/review
