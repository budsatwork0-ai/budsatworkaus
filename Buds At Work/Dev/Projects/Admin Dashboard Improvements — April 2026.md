# Admin Dashboard Improvements — April 2026

**Date:** 2026-04-21
**Status:** Implemented
**Scope:** Admin dashboard visual upgrades (Today's schedule widget, Crew today widget) and 8 structural/data quality fixes

**Related:** [[Infrastructure & Integrations — April 2026]] · [[Services Flow Improvements — April 2026 Phase 6]]

---

## Why This Was Done

The admin dashboard had accumulated several issues that made it less useful in practice: a second waterfall of fetch calls on every load, a mislabelled "Cash balance" metric that was actually net profit, computed change data that was never displayed, crew utilisation shown as a fake percentage, an inert `···` menu on the schedule table, placeholder dev copy in the hero, dead links in the domain cards panel, and address always blank in the schedule. Two new visual components (Today's schedule redesign, Crew today card) were also built from mockups.

---

## Changes

### 1. Today's schedule — new widget design

**File:** `src/app/(app)/dashboard/page.tsx`

Replaced the plain schedule table header with a richer layout:
- Header shows **day name · N jobs · N crew active**
- **Day / Week / Month** toggle — Day shows the inline table, Week/Month surface a "Open schedule →" prompt that links to the full Schedule tab
- Status pills renamed: `scheduled` → **Confirmed** (green), `in_progress` → **En route** (indigo)
- `···` context menu per row (see item 8)

---

### 2. Crew today — new card design

**File:** `src/app/(app)/dashboard/page.tsx`

Replaced the "Crew Readiness" section (which showed onboarding progress bars) with a **Crew today** card matching the operational mockup:
- Subtitle: `N of M active · X% utilisation`
- Crew member rows: initials avatar (dark green for index 0, lighter for others), name, services as role label, gradient utilisation bar
- Avatar colours and bar widths degrade gracefully by rank

---

### 3. One waterfall, not two

**Files:** `src/app/api/dashboard/route.ts`, `src/app/(app)/dashboard/hooks/useDashboardData.ts`, `src/app/(app)/dashboard/page.tsx`, `src/types/dashboard.ts`

`fetchSupplementalData` (a second batch of 3 fetches for quotes, applicants, and crew that fired after the main dashboard load) has been removed from the page component. All three are now fetched inside `/api/dashboard` as part of the existing `Promise.all` — one round trip instead of two.

New fields added to `DashboardData`: `crew: DashboardCrewMember[]`, `quotes: DashboardQuote[]`, `applicantCount: number`.

New types added to `src/types/dashboard.ts`: `DashboardCrewMember`, `DashboardQuote`.

---

### 4. "Cash balance" relabelled → "Net profit MTD"

**File:** `src/app/(app)/dashboard/page.tsx`

`cashBalance` in the API is `totalRevenue − totalExpenses` (both month-to-date) — that's net profit, not a bank balance. The `MoneyDetailCard` label and the Money section summary line now both say **"Net profit MTD"**. The Finance domain card primary stat was also updated to show `revenueProgress% of target · grossMargin% margin` instead of the misleading cash figure.

---

### 5. Revenue change % shown on metric card

**Files:** `src/app/api/dashboard/route.ts`, `src/types/dashboard.ts`, `src/app/(app)/dashboard/page.tsx`

`revenueChange` (% vs last month) is now computed in the API route and added to `goals`. The Revenue MTD metric card chip shows **+X% vs last month** (green) or **−X% vs last month** (red) when data exists, falling back to `Target X%` when there's no prior-month comparison.

---

### 6. Address from customer join

**File:** `src/app/api/dashboard/route.ts`

The orders query was `select('*')` — addresses were always blank in the schedule table because the `orders` table has no address column. Changed to `select('*, customers(default_address)')`. Job records now include the customer's `default_address`.

---

### 7. Hero copy replaced

**File:** `src/app/(app)/dashboard/page.tsx`

Replaced the developer placeholder headline ("Keep the dashboard familiar, tighten the workflow.") with a time-aware greeting: **"Good morning/afternoon/evening, Jackson."**

The long meta subtitle paragraph was replaced with a live operational briefing: `5 jobs scheduled today · 3 crew active · 2 unscheduled`.

---

### 8. Domain Command Panel trimmed to 5 live cards

**File:** `src/app/(app)/dashboard/page.tsx`

Removed Engineering (`/dashboard/settings`), Analytics (`/dashboard/insights`), and Design cards — these linked to unbuilt pages. Remaining cards: **Finance, Operations, Sales Pipeline, HR & Crew, Automations** — all with working `href`s. Grid updated to `xl:grid-cols-5`.

Crew card secondary now shows applicant intake count instead of the removed `readyForCrewApproval` field.

---

### 9. Crew utilisation is now an honest ratio

**File:** `src/app/(app)/dashboard/page.tsx`

`crewUtilisation` was `Math.min(100, todayJobs / (activeCount × 4) × 100)` — arbitrary and misleading. Replaced with `Math.round(activeCount / totalCrew × 100)` — a real ratio of active to total crew.

---

### 10. `···` menu wired up

**File:** `src/app/(app)/dashboard/page.tsx`

The context menu button on each schedule row now works:
- A full-screen transparent overlay closes the menu on outside click
- **View order** → links to `/dashboard/jobs?highlight={id}`
- **Mark complete** → `PATCH /api/orders/:id { status: 'completed' }` with toast + refetch
- **Cancel job** → `PATCH /api/orders/:id { status: 'cancelled' }` with toast + refetch
- Button disabled while a mutation is in-flight

---

## Key Files Modified

| File | Change |
|------|--------|
| `src/types/dashboard.ts` | `DashboardCrewMember`, `DashboardQuote` types; `revenueChange` in goals; `crew`/`quotes`/`applicantCount` on `DashboardData` |
| `src/app/api/dashboard/route.ts` | Customer join for address; crew/quotes/applicants parallel queries; `revenueChange` calculation |
| `src/app/(app)/dashboard/hooks/useDashboardData.ts` | Exposes `crew`, `quotes`, `applicantCount` from hook |
| `src/app/(app)/dashboard/page.tsx` | All UI changes — widgets, hero, domain cards, menu, labels, utilisation |

---

## Verification

- [x] Single network waterfall on dashboard load (no second batch of 3 fetches)
- [x] Revenue card shows `+X% vs last month` when prior-month data exists
- [x] MoneyDetailCard reads "Net profit MTD" not "Cash balance"
- [x] Crew today subtitle shows `N of M active · X%` (real ratio)
- [x] `···` menu opens/closes, outside-click dismisses, mark-complete and cancel both call the API
- [x] Today's schedule header shows day · jobs · crew count
- [x] Day/Week/Month toggle: Day shows table, Week/Month shows "Open schedule →"
- [x] Address column populated from customer join
- [x] Hero reads "Good morning/afternoon/evening, Jackson."
- [x] Domain panel has 5 cards, all with working links, `xl:grid-cols-5`
- [x] TypeScript: `npx tsc --noEmit` passes clean
