# Buds At Work — Operations Hub

Local services platform (Logan & South Brisbane): cleaning, windows, yard care, dump runs, car detailing, laundry & sneakers.

---

## Admin Command Centre

→ [[Admin/Admin|Admin]] — master index for all 12 operational domains

| Domain | Note |
|---|---|
| 💰 Finance | [[Admin/Finance\|Finance]] |
| ⚙️ Operations | [[Admin/Operations\|Operations]] |
| 📈 Sales Pipeline | [[Admin/Sales Pipeline\|Sales Pipeline]] |
| 👥 HR & Crew | [[Admin/HR & Crew\|HR & Crew]] |
| 🎧 Customer Support | [[Admin/Customer Support\|Customer Support]] |
| 📊 Data & Analytics | [[Admin/Data & Analytics\|Data & Analytics]] |
| 🔧 Engineering | [[Admin/Engineering\|Engineering]] |
| 🗺️ Product Management | [[Admin/Product Management\|Product Management]] |
| ⚖️ Legal | [[Admin/Legal\|Legal]] |
| 🎨 Design System | [[Admin/Design System\|Design System]] |
| 🔍 Enterprise Search | [[Admin/Enterprise Search\|Enterprise Search]] |
| ✅ Productivity | [[Admin/Productivity\|Productivity]] |

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
- [[Automation/Graph Maintenance|Graph Maintenance]] — scheduled graph health pass (orphan detection, hub strengthening, fragmentation repair)

## Dev
- [[Bug Tracker]] — quick-capture for bugs found during ops
- [[NDIS Participant Matching — May 2026]] — participant support profiles, rule-based job matching, admin publish workflow, safety flags (2026-05-14)
- [[Services Flow Improvements — April 2026]] — full funnel changes log (Phase 1 & 2)
- [[Services Flow Improvements — April 2026 Phase 3]] — home page redesign, email re-engagement, step 3 mobile sticky bar (2026-04-15)
- [[Services Flow Improvements — April 2026 Phase 4]] — rego lookup assistant, commercial preset tiles, window/auto/dump assistant steps (2026-04-17)
- [[Homepage UI Polish — April 2026]] — header cleanup, CTA colour unification, remove green bg, floating button fix (2026-04-17)
- [[Services Flow Improvements — April 2026 Phase 5]] — portal tightening, Pay Now button, profile page, Stripe saved cards, subscription change requests (2026-04-18)
- [[Services Flow Improvements — April 2026 Phase 6]] — rego banner, delivery + transport dump subtypes, auto interior pricing rework (2026-04-20)
- [[Infrastructure & Integrations — April 2026]] — Sentry, Vercel Cron (24h quote reminders), Google Ads conversions, dashboard forms wired to real APIs (2026-04-20)
- [[Bud Leads]] — lead workspace, dark theme tokens, Messenger webhook ingest, `lead_conversations` + `lead_follow_ups` tables (2026-05-24)
- [[Services Page Apple Redesign — April 2026]] — Step 1 redesign, UI refinements, Step 2 price bar fixes (2026-04-17)
- [[Design System — April 2026]] — CSS design token layer from Claude Design handoff bundle (2026-04-21)
- [[Admin Dashboard Improvements — April 2026]] — Today's schedule widget, Crew today widget, 8 structural fixes (2026-04-21)
- [[NDIS Pricing Rewrite & Stripe Hardening — April 2026]] — quarter-hour rounding, full Price Guide rate table, Stripe P0 fixes (2026-04-29)
- [[Crew Pipeline Fix & Approval Flow — May 2026]] — crew pipeline load fix, admin onboarding approval flow (2026-05-01)
- [[NDIS Step 2 Visual Redesign — May 2026]] — icon treatment across all selectable tiles and room steppers (2026-05-05)
- [[Schedule Page & DayScheduler Refactor — May 2026]] — unified toolbar, crew filter strip, timeline card layout, now indicator (2026-05-07)
- [[Price Optimizer Agent — May 2026]] — market-capacity pricing recommendations landing in the agent approval queue
- [[GitHub-Automation]] — GitHub → Obsidian automation, captures events as structured notes indexed in Supabase
- [[ADR-Index]] — all Architectural Decision Records

## Dev Logs
- [[Dev/Dev Log 2026-05-18|Dev Log 2026-05-18]]
- [[Dev/Dev Log 2026-05-19|Dev Log 2026-05-19]]
- [[Dev/Dev Log 2026-05-20|Dev Log 2026-05-20]]
- [[Dev/Dev Log 2026-05-21|Dev Log 2026-05-21]]
- [[Dev/Dev Log 2026-05-22|Dev Log 2026-05-22]]
- [[Dev/Dev Log 2026-05-23|Dev Log 2026-05-23]]
- [[Dev/Dev Log 2026-05-24|Dev Log 2026-05-24]]
- [[Dev/Dev Log 2026-05-25|Dev Log 2026-05-25]]

## Refactor Plans
- [[Refactor Plans/Services Core Extraction|Services Core Extraction]] — extract pricing, routing, and estimation logic out of `services/page.tsx` into lib/

---

## Architecture
- [[Bud Core Runtime]] — operational truth engine powering the admin dashboard
- [[Agent Runtime]] — AI agent execution layer (30+ agents, guardrails, cron)
- [[Quote Pipeline]] — server-side quote → checkout → webhook lifecycle
- [[ServicesPageContent]] — the public quote wizard
- [[Mission Control]] — aggregated operational health state
- [[Graphify]] — live codebase knowledge graph
- [[Graph-Health-Agent]] — graph connectivity, orphan detection, hub health (scheduled maintenance)
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
