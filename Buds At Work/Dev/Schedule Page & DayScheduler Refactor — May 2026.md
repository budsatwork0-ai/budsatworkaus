# Schedule Page & DayScheduler Refactor — May 2026

**Date:** 2026-05-07
**Status:** Implemented
**Scope:** Full redesign of the admin Schedule tab — unified toolbar, lifted date state, crew filter strip, timeline card layout, real-time now indicator, fixed scroll bug.
**Files:** `src/app/(app)/dashboard/schedule/page.tsx`, `src/app/(app)/dashboard/components/DayScheduler.tsx`

---

## What changed

### schedule/page.tsx — Unified toolbar + date ownership

Date state moved from `DayScheduler` up to `SchedulePageContent`. The page now owns `date` and passes it down via `{ date, onDateChange }` props.

A single unified toolbar replaced two separate control bars:
- **View toggle** — Day / Week / List (icon + label pills, active = brand green)
- **Day navigation** — prev/next buttons + clickable day label that opens a hidden `<input type="date">`
- **Week navigation** — prev/next week buttons + "Today" shortcut when offset ≠ 0
- **Unscheduled indicator** — amber badge showing count, visible in Day and Week views
- Date changes sync to URL params: `?view=day&date=2026-05-07` so links are shareable

Week view is now a proper 7-day grid with job pills (colour-coded by service, time label) plus the queue panel sidebar. Clicking any day cell navigates to Day view for that date.

---

### DayScheduler.tsx — Timeline redesign

**API change:** component no longer manages date state internally. Accepts `{ date: string; onDateChange: (d: string) => void }`.

#### Crew filter strip
Appears above the timeline when 2+ active crew members exist. Pill chips toggle crew columns on/off — greyed out (opacity 0.45) when hidden, shows initials avatar + first name. "Off today" tag appears on the chip when a member has availability set but not for the selected day. "Show all" button resets hidden set.

#### Timeline card layout
- Replaced glass morphism (`glass` constant) with a plain white card (`border + background: white`)
- Time axis is sticky left with right-justified time labels; first/last labels clamped to avoid bleed
- Crew columns use `flex: '1 0 200px'` — expand to fill card width, horizontal scroll kicks in only when columns overflow
- **Scroll bug fix:** inner wrapper uses `overflow-x: auto` + explicit `overflow-y: hidden`. Without the `overflow-y: hidden`, CSS computes both axes as `auto` when one triggers overflow, which captured the page's wheel events and broke vertical page scrolling.

#### Real-time now indicator
A red dot + horizontal line is rendered at the current time position when today is selected and the current time falls within the visible hour range. Implemented as an IIFE inside JSX, returns `null` outside range.

#### Queue panel (sidebar)
Moved from a full-width panel below the timeline to a `w-64` right sidebar beside the timeline card, both in a `flex gap-2` container. The panel height is pegged to the timeline height.

#### Placement instruction strip
When a job is selected from the queue, the instruction now appears as a slim inline strip at the top of the timeline card (flush with the top border, colour-matched to service) instead of a floating animated banner below the date picker.

#### UX polish
- Loading: spinner + "Loading schedule…" centred in card
- Empty crew: icon + two-line message
- "Job moved back to unscheduled" → "Job moved back to queue"
- Availability error toast: "on this day" → "today"
- Column header avatar goes slate when crew is unavailable today

---

## Files touched

```
EDIT  src/app/(app)/dashboard/schedule/page.tsx
EDIT  src/app/(app)/dashboard/components/DayScheduler.tsx
```
