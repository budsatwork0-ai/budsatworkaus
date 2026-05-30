# Agent ↔ Database Schema-Drift Report

**Date:** 2026-05-29 (revised)
**Trigger:** Bud OS reported 33 failed runs / 2 broken agents.
**Root cause:** Code↔schema drift. The agents were written against an **older, simpler schema**; the live database has since been refactored/renamed. The data exists — the agents just query the old names. This is **not** an env, API-key, or missing-data problem, and (correcting the first draft of this report) the tables are **not missing — they were renamed/normalised**.

---

## Correct mapping: what agents expect → what the DB actually has

| Agents query | Real table(s) | Notes |
|---|---|---|
| `jobs` | `orders` (+ `job_assignments`, `job_completions`) | `orders` has service_type, scheduled_date/time, status, `assigned_crew_id`, final_price. Job address is embedded in `orders.notes` as `Address: …`. |
| `crew_members` | `employees` | name field is `full_name`; skills → `services[]`; has `suburb`, `availability[]`, `status` (active), `roster_active`. |
| `reviews` (table) | `ratings` | order_id, rating, comment. |
| `customer_messages` | `lead_conversations` | direction, channel, body, lead_id; recipient email via `leads`. |
| `ndis_documents` | `ndis_participants` / `participant_support_profiles` | NDIS data is normalised across these. |
| `quotes.suburb` / `quotes.service` | `quotes.service_address` / `quotes.service_type` | `suburb` itself lives on `leads`. |
| quote status `'new'` | `'submitted'` | live statuses: submitted, payment_pending, … |

**App assignment convention** (followed by fixes): the admin `DayScheduler` assigns a job by setting `orders.assigned_crew_id` + `scheduled_date/time` + `status='scheduled'`; crew options come from `employees` where `status='active'`. (A separate `/api/orders/[id]/assign` route also writes `job_assignments` for the crew portal — two coexisting mechanisms.)

---

## Fixed and live

| Agent | Change |
|---|---|
| `quote-triage` | `quotes`: `suburb→service_address`, `service→service_type`, status `'new'→'submitted'`. |
| `customer-reply` | Repointed `customer_messages` → `lead_conversations` + `leads`; "unanswered" = `leads.first_response_at IS NULL`. |
| `yard-map-geo` | `quotes` columns → `service_address`/`service_type`; gated on `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. |
| `whs-safety-reminder` | `crew_members` → `employees` (`name→full_name`). Re-enabled. |
| `scheduling` | Reads `orders` (status='confirmed', `assigned_crew_id IS NULL`) + `employees` (status='active'); proposes `assigned_crew_id` + date/time. **`schedule_job` effect** now updates `orders` (was writing the non-existent `jobs`). Re-enabled. |

All pass ESLint. Validated against live data where possible (e.g. quote-triage now matches 2 real submitted quotes).

---

## Still disabled — remaining remap work

Each still queries `jobs`/etc. and needs the orders model wired in. Disabled so they can't error.

| Agent | Needs |
|---|---|
| `admin-optimization` | `jobs`→`orders` (ops metrics). |
| `efficiency-architect` | `jobs`→`orders`. |
| `content-agent` | `jobs`→`orders`/`job_completions` + `job_photos`. |
| `lead-scorer` | `jobs`→`orders` + `quotes` column drift; likely also read `leads`. |
| `crew-coach` | `jobs`→`orders`+`job_completions`, `crew_members`→`employees`, `reviews`→`ratings`. |
| `ndis-compliance` | `jobs`→`orders` + `ndis_documents`→`ndis_participants`/`participant_support_profiles`. |
| `stripe-dispute-manager` | `jobs`→`orders`, `customer_messages`→`lead_conversations`. |
| `reviews` | `jobs`→`orders` **AND** needs review-tracking columns (`review_requested_at` / `_responded_at` / `_follow_up_at`) which `orders` lacks. Naive repoint would re-email customers every run — **needs a tracking column (schema change, approval) or a separate tracking table** before re-enabling. |
| `price-optimizer` | `jobs`→`orders`, `crew_members`→`employees`, `quotes` drift — **and it's pricing-gated; keep off until explicitly reviewed.** |

`foreman` stays disabled (code deleted; superseded by Bud).

---

## Recommended order for the rest
1. `admin-optimization` + `efficiency-architect` (read-only analytics over `orders` — low risk).
2. `lead-scorer`, `content-agent`, `crew-coach`, `ndis-compliance`, `stripe-dispute-manager` (read-mostly remaps).
3. `reviews` — only after adding review-tracking (decide: columns on `orders` vs. a `review_requests` table).
4. `price-optimizer` — separate, pricing-gated review.

Data is currently sparse (1 order, 1 employee, 0 assignments/ratings/whs), so repointed agents will mostly no-op until real volume arrives — the goal is correctness + readiness.
