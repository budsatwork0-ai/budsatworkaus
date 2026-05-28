# Services Page Apple Redesign — April 2026

**Date:** 2026-04-17  
**Status:** Implemented  
**Scope:** Services page Step 1 redesign, UI refinements, Step 2 price bar fixes

**Related:** [[Homepage UI Polish — April 2026]] · [[Services Flow Improvements — April 2026 Phase 3]]

---

## Why This Was Done

The services page landing experience felt dense and visually noisy — too much information compressed into a single glass card, competing elements at every level. Goal: make the page feel calm, deliberate, and Apple-like through hierarchy, spacing, and interaction — not decoration.

---

## Phase 1 — Step 1 Structural Redesign

### What changed

| Before | After |
|--------|-------|
| Heavy glass card wrapping all of Step 1 | Card removed — content sits directly on page background |
| "Who is this for?" pill buttons (separate, bordered) | Apple-style segmented control (single pill container, sliding active state) |
| Emoji badge strip (⚡ Instant pricing, ✓ No hidden fees, ⏱ Under 60 seconds) | Removed entirely |
| Horizontal service tiles (icon left, text right) | Vertical tiles (icon top, title, subtitle, price below) |
| Step indicator: 32px numbered circles + heavy connector | 18–22px dots, thin 1px line, minimal labels |
| Sticky nudge bar at bottom of Step 1 | Removed entirely |
| `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` with `gap-4` | `grid-cols-2 sm:grid-cols-3` with `gap-3.5` |

### Key files
- `src/app/(public)/services/page.tsx` — Step 1 section (lines ~4233–4345)
- `src/app/(public)/services/components/shared/UIComponents.tsx` — Tile component rewrite

---

## Phase 2 — UI Refinements (Interaction & Hierarchy)

Subtle polish pass targeting clarity, motion, and visual competition.

### Segmented control
- Active state: brand green fill (`var(--accent)`) + white text — was white bg + green text (inverted)
- `scale(1.02)` on active pill
- All four properties (bg, color, shadow, transform) transition at `160ms ease-in-out`
- Container bg: `#eff0f2`

### Service tiles
- Active background: `color-mix(in srgb, var(--accent) 5%, #fff)` — whisper green tint
- Subtitle text: `rgba(100,116,139,0.75)` — pushed back behind title without disappearing
- "from $X" price: promoted to `font-semibold` (was `font-medium`)
- All transitions use iOS cubic-bezier `0.25 0.46 0.45 0.94`
- Icon container bg transitions with the card

### Step indicator
- Active dot: 22px with `box-shadow: 0 2px 8px rgba(15,61,46,0.25)` green glow
- Inactive dot: 18px, `#dde1e7`
- Active label: `font-weight: 600`, `color: var(--accent)`
- Inactive label: `font-weight: 400`, `color: #b0b8c4` (noticeably muted)
- Connector line transitions colour as steps complete (`300ms ease-in-out`)

### LiveOrdersStrip
- "Live orders" label: removed `uppercase` + `tracking-wide`, reduced to `text-[11px] text-slate-500`
- "Updated in real-time" helper: dropped from `text-xs text-slate-500` to `text-[11px] text-slate-400`
- Compact ticker: location + time labels muted to `rgba(148,163,184,0.8–0.9)`

### Spacing & typography
- Header section: `mb-10` → `mb-12`
- Subtitle: `text-slate-500` → `text-slate-400` (hierarchy — secondary to h1)
- Step indicator: `mt-5` → `mt-6`

---

## Phase 3 — Step 2 Price Bar Fixes

### Button sizing
- Both "Back" and "Get My Quote" now use explicit `h-10` height — prevents size mismatch from text wrapping
- `whitespace-nowrap` on both prevents arrow (`→`) dropping to a new line
- "Back" restyled as ghost/secondary (`bg-white/80 border border-black/15`) — differentiates action priority visually

### Layout alignment
- Container changed from `flex items-center` → `flex items-start` — buttons pin to top as disclaimer text grows
- Restructured into two rows:
  - **Row 1:** price + time estimate (left) · buttons (right) — compact, inline
  - **Row 2:** full-width disclaimer text — spans edge to edge, wraps naturally without inflating row 1 height

---

## Design Principles Applied

- No new colours introduced — only brand tokens
- No layout structure changes — all refinements are within existing components
- `prefers-reduced-motion` respected via existing `MotionContext` + `WITH_MOTION` check in `motion.tsx`
- All transitions 150–200ms, iOS-style easing (`cubic-bezier(0.25, 0.46, 0.45, 0.94)`)

---

## Key Files Modified

| File | Change |
|------|--------|
| `src/app/(public)/services/page.tsx` | Step 1 redesign, segmented control, step indicator, step 2 bar |
| `src/app/(public)/services/components/shared/UIComponents.tsx` | Tile rewrite (vertical layout, easing, tint) |
| `src/app/(public)/services/components/shared/LiveOrdersStrip.tsx` | Tone down labels and helper text |
