# Services Flow Improvements — April 2026 Phase 3

**Date:** 2026-04-15 (Phase 3a) · Updated 2026-04-15 (Phase 3b — balance pass)
**Status:** Implemented
**Scope:** Home page redesign (balance pass), email engagement loop, services step 3 sticky bar, two new API routes

**Related:** [[Quote Flow]] · [[Email Triggers]] · [[Stripe Checkout]] · [[New Booking]] · [[Services Flow Improvements — April 2026]]

---

## Why This Was Done

Phase 1 & 2 built a solid, functional funnel. Phase 3 focuses on:
- **Conversion aesthetics** — home page redesign to match craft.do / Claude.ai design language
- **Re-engagement** — missing email touchpoints for unpaid quotes and day-before service reminders
- **Mobile UX** — step 3 had no sticky summary bar on mobile; added one

---

## Changes by Layer

### Layer 1b — Home Page Balance Pass (Phase 3b)

A targeted balance fix on top of the Phase 3a redesign. Issues fixed:

| Problem | Fix |
|---------|-----|
| Stats band overlapping hero with `-mt-8` (clashing, floating) | Moved flush below hero — `pt-14` inside the content well, no negative margin |
| Stats and content inside different max-width containers | Unified under one `max-w-5xl` parent with `px-5 sm:px-8` |
| Hero overlay too light, video didn't feel full-screen | **Two-layer overlay**: base `rgba(0,0,0,0.46)` (uniform, always legible) + directional vignette gradient (darker top/bottom) — see note below |
| Tools sub-card below "How It Works" created bloat | Integrated tool hints as inline footer rows inside each step card |
| "See all services" CTA under services grid was redundant | Removed (all 6 services are already clickable cards) |
| Two consecutive CTA sections ("Join crew" + "Final CTA") felt heavy | Merged "Join the crew" into the final dark CTA as the secondary button |
| About section: left column (text) vs right column (card) felt unequal | Right column now uses `BRAND.surface` background + `items-stretch` on the grid |
| Testimonials quote icon felt like visual noise | Removed; kept stars + body + footer rule — cleaner |
| Section headings inconsistent sizing | Unified to a single `SectionH2` component with consistent `clamp` |
| `space-y-28` rhythm too loose | Tightened to `space-y-24` |

**Note — why two overlay layers instead of one gradient:**
The video `div` uses `top: -100px` to extend behind the navbar. This means a single `linear-gradient(to bottom, ...)` peaks its "light" zone exactly where the hero text is centered (~50% viewport), making text sit over ~35% opacity — too low. The fix: a **base uniform overlay** (`rgba(0,0,0,0.46)`) ensures constant readability, with a **separate vignette gradient** adding extra dark at the top and bottom edges only. Combined: ~76% dark at top, ~46% at center, ~81% at bottom.

---

### Layer 1a — Home Page Redesign (`/app/ui/home/HomePage.tsx`)

Complete rewrite of the home page to match the Craft.do / Claude.ai aesthetic:

**Design changes:**
- **Hero** — kept video background, lightened overlay (from 60% to 50% → more cinematic, less muddy), added animated shimmer effect. Headline: `clamp(2.8rem, 7.5vw, 5.5rem)`, tight tracking (-0.05 letter-spacing), single `color: #10b981` accent on "looked after."
- **Pill label** — frosted glass chip above headline ("Logan & South Brisbane · Locally owned")
- **CTAs** — primary CTA now uses brand accent (`#10b981` emerald) instead of dark green; secondary is ghost
- **Stats band** — unchanged shape, grid 2×2 on mobile / 4 on desktop
- **Background blobs** — three radial gradient orbs (Claude-style) in the main content well; opacity ≤ 10%
- **Services grid** — clean white cards with `1px border` (no glassmorphism); "Popular" badge; hover shows "Get quote →" reveal; from prices visible always
- **How It Works** — 3 panels in a bordered grid (Craft-style); middle panel uses `surfaceAlt` for visual rhythm; tools card below with icon+text pairs
- **About section** — 2-col split; promises list with checkmark chips
- **Testimonials** — white bordered cards; decorative open-quote icon; name/suburb/service in footer with top border rule
- **Join CTA** — soft green band with accent border
- **Final CTA** — full-bleed dark green rounded section with two Claude-style gradient orbs; white on dark; emerald CTA button

**New design token system:**
```ts
const BRAND = {
  primary: '#0f3d2e',   // deep green (unchanged)
  accent:  '#10b981',   // emerald — now used as primary CTA colour
  accentLight: '#d1fae5',
  text:    '#0a0a0a',
  muted:   '#6b7280',
  border:  '#e5e7eb',
  bg:      '#ffffff',
  surface: '#f9fafb',
  surfaceAlt: '#f0fdf4',
};
```

**Removed:** `AnimatePresence`, `glassSoft`, `cx`, `brand` import from old theme

---

### Layer 2 — New Email Templates (`/lib/email/templates.ts`)

Two new templates added at the end of `templates.ts`:

#### `quoteReminderEmail` (template 6 — 24h nudge)
- **When:** Quote is finalized but customer hasn't paid in ~24h
- **Trigger:** `POST /api/quotes/[id]/remind`
- **Subject:** "Still thinking? Your quote is ready to go"
- **Tone:** Non-pushy, reassuring, helpful
- **CTA:** "Pay & confirm my booking" → direct Stripe checkout URL

#### `dayBeforeReminderEmail` (template 7 — day-before reminder)
- **When:** Evening before a confirmed booking
- **Trigger:** `POST /api/orders/[id]/remind-day-before`
- **Subject:** "Reminder: we're coming tomorrow — {date}"
- **Content:** Date/time, crew name, address, prep checklist
- **Checklist:** Access, pets, gate codes, driveway clearing

---

### Layer 3 — New API Routes

#### `POST /api/quotes/[id]/remind`
**File:** `src/app/api/quotes/[id]/remind/route.ts`
- Auth: admin or employee only
- Guards: quote must be `finalized` or `payment_pending` and not yet `paid`
- In-memory rate limit: 5 sends per quote per hour
- Updates `last_reminder_sent_at` on the quote (column may not exist yet — graceful fallback)
- Returns: `{ success: true, sent_to: string }`

#### `POST /api/orders/[id]/remind-day-before`
**File:** `src/app/api/orders/[id]/remind-day-before/route.ts`
- Auth: admin or employee only
- Guards: order must be `confirmed` or `scheduled`; `day_before_reminder_sent !== true` (idempotency)
- Joins `job_assignments → employees` to get crew first name
- Extracts address from `notes` field (`Address: ...` prefix)
- Marks `day_before_reminder_sent: true` after send (graceful if column missing)

---

### Layer 4 — Services Page Step 3 Sticky Bar (`services/page.tsx`)

**Problem:** On mobile, step 3 had no persistent CTA — users had to scroll down to find the submit button inside the sidebar card.

**Fix:** Added a `lg:hidden` fixed sticky bar that appears on step 3 (mobile only):
- Shows: service label, live `priceLabel`, and two buttons ("← Back", "Submit quote →")
- "Submit quote →" scrolls to and focuses `#step3-submit-btn` (added id to the existing submit button)
- Style matches existing step-2 sticky bar (same glass card, `z-40`, bottom offset with safe-area)

---

## Email Flow — Full Map (Updated)

| # | Template | Trigger | When |
|---|----------|---------|------|
| 1 | Quote Received | `POST /api/quotes` | Immediately on quote submission |
| 2 | Quote Finalized | `POST /api/quotes/[id]/checkout` | Admin creates checkout link |
| 3 | Booking Confirmed | `checkout.session.completed` webhook | Stripe payment succeeds |
| 4 | Service Scheduled | `POST /api/orders/[id]/assign` | Admin assigns crew + date |
| 5 | Checkout Expired | `checkout.session.expired` webhook | Link expires (24h) |
| **6** | **Quote Reminder** | **`POST /api/quotes/[id]/remind`** | **Admin triggers 24h after finalization** |
| **7** | **Day-Before Reminder** | **`POST /api/orders/[id]/remind-day-before`** | **Evening before service** |

---

## Verification Checklist

- [ ] **Home page** — open `/`, confirm clean white design, blob orbs, emerald CTAs, Craft-style step grid
- [ ] **Service grid** — confirm "Popular" badge, "from $X" price, hover reveal of "Get quote →"
- [ ] **Quote reminder** — POST `/api/quotes/[id]/remind` with admin token; confirm email arrives with payment link
- [ ] **Day-before reminder** — POST `/api/orders/[id]/remind-day-before` with admin token; confirm email shows date, crew name, address, checklist
- [ ] **Idempotency: reminder** — call `/remind` twice; confirm second call is rate-limited (429) after 5 attempts
- [ ] **Idempotency: day-before** — call `/remind-day-before` twice; confirm second call returns `{ skipped: true }`
- [ ] **Step 3 sticky bar** — mobile view, step 3; confirm sticky bar appears with price label and "Submit quote →" button
- [ ] **Step 3 submit scroll** — tap "Submit quote →" on mobile sticky bar; confirm page scrolls to submit button

---

## Key Files Modified

| File | Change |
|------|--------|
| `src/app/ui/home/HomePage.tsx` | Full redesign — Craft.do / Claude.ai aesthetic |
| `src/lib/email/templates.ts` | Added `quoteReminderEmail` + `dayBeforeReminderEmail` |
| `src/app/api/quotes/[id]/remind/route.ts` | **NEW** — 24h nudge route |
| `src/app/api/orders/[id]/remind-day-before/route.ts` | **NEW** — day-before reminder route |
| `src/app/(public)/services/page.tsx` | Step 3 sticky bar + `id` on submit button |
