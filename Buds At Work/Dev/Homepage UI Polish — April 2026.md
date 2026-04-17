# Homepage UI Polish — April 2026

**Date:** 2026-04-17  
**Scope:** Public homepage + global header + floating CTA widget

---

## Changes Made

### Header (`src/app/ui/Header.tsx`)
- **Removed sticky "Get a free quote" CTA button** from desktop and mobile header. Unauthenticated users now see only a "Log in" ghost pill.
- **"Log in" restyled** as a ghost outline pill (1.5px border, 38px height, same radius as old CTA) so the header right side has proper visual weight without a fill button.
- **Border/line removed** — dropped `border-b` entirely. The `bg-white/90 backdrop-blur` frosted glass provides header separation on its own with no visible line.
- **Removed `ctaHidden` state + `home:cta-*` event listeners** from Header — no longer needed since the CTA button is gone.

### Floating CTA Widget (`src/components/FeedbackWidget.tsx`)
- **Color changed** from `brand.primary` (dark `#0F3D2E`) to `brand.accent` (`#10b981`) on both desktop pill and mobile sticky bar.
- **Hide animation restored** — the widget still animates out when the homepage's "Ready to get started" section scrolls into view (via `home:cta-enter`/`home:cta-leave` custom events).

### Homepage (`src/app/ui/home/HomePage.tsx`)
- **Restored `IntersectionObserver`** on the final CTA section to dispatch `home:cta-enter`/`home:cta-leave` events for the FeedbackWidget.
- **Service card "Get quote" hover text** changed from `BRAND.primary` → `BRAND.accent` so all quote-related CTAs are consistently light green.

### Theme (`src/app/ui/theme.ts`)
- **Added `brand.accent: '#10b981'`** — was missing, caused FeedbackWidget button to render with `background: undefined` (invisible). Now a first-class token.

### Public Layout (`src/app/(public)/layout.tsx`)
- **Removed green radial gradient background** and green blob orbs from layout backdrop. Page background is now plain `#ffffff`. The greenish vertical stripe on the left side of the viewport is gone.

---

## Update — 2026-04-17 (Session 2)

### "looked after" headline colour
- Changed from `BRAND.accentSoft` (`#DDF3E4` — too pale, invisible on light bg) → `BRAND.primary` (`#0F3D2E` — too dark/heavy) → `BRAND.accent` (`#1C7C54` — final, accessible medium green)
- Matches the CTA button colour — creates a cohesive visual echo across the hero

### Rotating headline words
- The word "home" in "Your home, looked after." now cycles through a word list every 2.6s
- **Word list:** home → garden → car → yard → laundry → bins → delivery → shoes
- **Animation:** vertical clip slide — old word exits upward, new word enters from below, clipped by `overflow: hidden` wrapper
- **Easing:** `[0.22, 1, 0.36, 1]` — same iOS spring used on the hero entrance animation
- **Duration:** 380ms per transition
- **Implementation:** `AnimatePresence mode="wait"` + `motion.span` with `y: 100% → 0% → -100%`
- Rotating word colour matches "Your" (`BRAND.onDark`) — same white, no colour accent on the noun
- `AnimatePresence` added to framer-motion import (was missing)
- `ROTATING_WORDS` constant defined at module scope above `HomePage`

### Key files
| File | Change |
|------|--------|
| `src/app/ui/home/HomePage.tsx` | Rotating words, colour fix, AnimatePresence import |

---

## Design Decisions
- CTA buttons site-wide use `brand.accent` (#1C7C54 / `#10b981`). `brand.primary` (#0F3D2E) is for text, logo, and structural elements only.
- Header has no visible border/shadow — glass blur is sufficient separation.
- No sticky quote button in the nav — the floating FeedbackWidget handles persistent CTA on scroll.
- Rotating headline noun reinforces the breadth of services without needing a list — each word maps to a real service offered.
