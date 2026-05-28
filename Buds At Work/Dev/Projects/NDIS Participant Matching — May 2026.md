# NDIS Participant Matching — May 2026

**Date:** 2026-05-14  
**Status:** Implemented  
**Scope:** Full NDIS-aware job coordination layer — participant support profiles, rule-based job matching, admin publish workflow, safety flags, and filtered crew Find Jobs page.

**Related:** [[06 Operations/Team Areas/HR & Crew|HR & Crew]] · [[06 Operations/Team Areas/Engineering|Engineering]] · [[06 Operations/Team Areas/Operations|Operations]]

---

## Why This Was Done

Buds At Work now employs NDIS participants as crew members (supported workers). A standard job assignment flow doesn't work for these workers — jobs need to be assessed against each participant's support window, physical capacity, transport situation, and whether their support worker will be present.

Previously every confirmed job went to all available crew. There was no way to:
- Limit which participants could see which jobs
- Check whether a job's hours fit inside a participant's funded support window
- Surface safety flags before publishing
- Require a documented override if an admin wanted to proceed despite a flag

---

## What Was Built

### 1. Database (migration `036_ndis_matching.sql`)

Six new tables applied to Supabase:

| Table | Purpose |
|---|---|
| `participant_support_profiles` | NDIS support needs per crew member (window, capacity, transport, support worker) |
| `job_requirements` | NDIS-specific requirements per order (intensity, mode, transport, split shift, etc.) |
| `job_participant_matches` | Cached match scores and flag history per job × participant |
| `job_publications` | Which participants an admin has published a specific job to |
| `shift_segments` | Split shift segments for jobs that exceed a participant's window |
| `transport_arrangements` | Per-job transport logistics |

All tables have RLS:
- Admins can read/write everything
- Employees can only read/write their own profile and jobs published specifically to them

---

### 2. Matching Algorithm (`src/lib/ndis/matching.ts`)

Rule-based scoring — no AI, fully auditable. Max 100 points across 8 criteria:

| Criterion | Points | Logic |
|---|---|---|
| Fits support window | 20 | Job start/end within `support_window_start`–`support_window_end` |
| Duration within shift limit | 20 | Job duration ≤ `max_shift_duration_minutes` |
| Support mode compatible | 15 | `required_support_mode` is `any` or matches participant's mode |
| Transport available | 15 | `transport_required = false` OR participant has transport |
| Physical capacity suitable | 10 | Job intensity ≤ participant's capacity (`low/medium/high`) |
| Service type preferred | 10 | Job's service type is in participant's `preferred_services` (or list is empty) |
| Customer-facing suitable | 5 | `customer_facing_required = false` OR `customer_facing_ok = true` |
| Within travel radius | 5 | Location within `travel_radius_km` (currently defaults to pass if no geocoords) |

**Match grades:** Strong (≥85%) · Good (≥65%) · Partial (≥40%) · Poor (<40%)

**Safety flags** (separate from score):

| Flag | Severity | When raised |
|---|---|---|
| Outside support window | Warning | Job time is outside funded hours |
| Cannot work after funded hours | **Blocker** | Participant has `can_work_after_support_hours = false` AND window exceeded |
| Shift exceeds max duration | Warning | Job is longer than participant's max shift |
| Transport not available | Warning | Transport required but participant has none |
| No support worker assigned | Warning | Participant mode is `supported` but no worker is named |
| Physical intensity too high | Warning | Job intensity exceeds participant's capacity |

**Blocker → override required:** Admin must type a documented reason before publishing a job to a participant with an active blocker flag.

---

### 3. Admin Workflow

**Entry point:** Dashboard → NDIS → **Job Matching** tab (new tab added to existing NDIS page)

The Job Matching tab lists all confirmed/pending orders with:
- Match status (Needs setup / Matching enabled)
- How many participants it's already been published to
- One-click → Match Participants page

**Match Participants page** (`/dashboard/ndis/match/[orderId]`):

1. **Job summary** — service, customer, date, price
2. **Job support requirements editor** — fill in duration, intensity, support mode, transport, location suburb, start/end times, risk notes, split-shift flag
3. **Save & Find Matches** — saves requirements and scores all active employees against them
4. **Ranked participant list** — each card shows:
   - Score badge (number/100 with colour-coded grade)
   - Name, email, suburb
   - Support profile summary (mode, window, max shift)
   - Safety flags (blockers in red, warnings in amber)
   - Expandable score breakdown (criterion by criterion)
   - Supervision/risk notes from participant profile
   - Already-published badge if previously sent
5. **Select participants** → checkbox each one
6. **Publish bar** (sticky bottom) — shows selected count; if any blocker is selected, override note field appears; confirm to publish

Publishing creates both a `job_publications` record **and** a `job_assignments (status=available)` record — the latter ensures the existing My Jobs, Schedule, and Completions pages all work without any changes.

---

### 4. Crew Portal — Support Profile

**URL:** `/crew/support-profile` (new "Support" nav item added to crew sidebar)

Participants fill in:
- Funded support window (start/end time)
- Maximum shift length (minutes)
- Travel radius (km)
- How they work: Independent / With Support Worker / Team Based
- Transport: Own / Needs transport / Arranged
- Support worker name & provider (shown if mode is "With Support Worker")
- Physical capacity: Light / Moderate / Heavy
- Preferred service types (multi-select)
- Customer-facing comfort (checkbox)
- Can work after funded support hours (checkbox)
- Emergency contact

---

### 5. Crew Portal — Find Jobs Updates

Jobs published via the NDIS matching flow now show enriched cards in `/crew/jobs`:

- **"NDIS matched"** badge on published jobs
- Match score badge (e.g. "82% — Strong match")
- Safety flag badges (blockers and warnings)
- Location suburb only (full address withheld for privacy)
- Support requirements chips (mode, transport, time window)
- Estimated duration from `job_requirements` (overrides the old per-service-type estimate)

Accept/Decline flow is unchanged — accepting an NDIS-published job works the same as any other assignment.

---

## Files Changed / Created

### New files
| File | Purpose |
|---|---|
| `src/types/ndis.ts` | All NDIS TypeScript types |
| `src/lib/ndis/matching.ts` | Scoring algorithm |
| `src/app/api/crew/support-profile/route.ts` | GET/PUT support profile |
| `src/app/api/ndis/participants/route.ts` | GET all employees with profiles (admin) |
| `src/app/api/ndis/jobs/[orderId]/requirements/route.ts` | GET/POST job requirements |
| `src/app/api/ndis/jobs/[orderId]/matches/route.ts` | GET computed match scores |
| `src/app/api/ndis/jobs/[orderId]/publish/route.ts` | POST publish / DELETE withdraw |
| `src/app/api/ndis/jobs/pending-match/route.ts` | GET jobs awaiting matching (admin) |
| `src/app/(app)/dashboard/ndis/match/[orderId]/page.tsx` | Admin matching UI |
| `src/app/(app)/crew/support-profile/page.tsx` | Crew support profile editor |
| `supabase/migrations/036_ndis_matching.sql` | DB migration |

### Modified files
| File | Change |
|---|---|
| `src/app/api/crew/jobs/route.ts` | Enriches assignments with NDIS publication + match data |
| `src/app/(app)/crew/jobs/page.tsx` | Shows NDIS badges, flags, match score on job cards |
| `src/app/(app)/crew/layout.tsx` | Added "Support" nav item linking to `/crew/support-profile` |
| `src/app/(app)/dashboard/ndis/page.tsx` | Added "Job Matching" tab with job list + Match buttons |

---

## How to Use (Admin)

1. A customer books and pays → order is `confirmed`
2. Go to **Dashboard → NDIS → Job Matching**
3. Find the job → click **Match participants**
4. Fill in job support requirements (duration, intensity, transport needed, times, location)
5. Click **Save & Find Matches** — all active employees are scored
6. Review the ranked list — check scores, expand breakdowns, read flags
7. Tick the participants who should receive this job
8. If any have blocker flags, type an override reason
9. Click **Publish job** — participants see the job immediately in Find Jobs

## How to Use (Participant)

1. Go to **Crew Hub → Support** and fill in your support profile (one-time setup, can update anytime)
2. When a job is published to you, it appears in **Find Jobs** with a match score and any flags
3. Accept or decline as usual
