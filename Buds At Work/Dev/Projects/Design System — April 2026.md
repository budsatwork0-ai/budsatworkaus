# Design System — April 2026

**Date:** 2026-04-21
**Status:** Implemented
**Scope:** Comprehensive CSS design token layer added to `globals.css` from Claude Design handoff bundle

---

## What Was Done

Imported and implemented `colors_and_type.css` from the Buds At Work Design System handoff (claude.ai/design). The file codified every design token already in `theme.ts` as native CSS custom properties, plus new tokens not previously in the codebase, and a set of `.bw-*` utility classes.

---

## Changes

### `src/app/globals.css` — expanded from 25 to ~130 lines

**New CSS custom properties added to `:root`:**

| Group | Variables |
|-------|-----------|
| Base palette | `--bg`, `--card`, `--border`, `--primary`, `--accent`, `--accent-soft`, `--surface`, `--surface-alt`, `--text`, `--muted`, `--focus` |
| On-dark | `--on-dark`, `--muted-on-dark`, `--subtle-on-dark` |
| Status | `--red-bg/fg`, `--amber-bg/fg`, `--blue-bg/fg`, `--emerald-bg/fg`, `--star` |
| Type scale | `--h-hero`, `--h-cta`, `--h-section`, `--h-page`, `--h-card`, `--text-base/sm/xs/eyebrow` |
| Letter-spacing | `--ls-eyebrow`, `--ls-hero`, `--ls-tight` |
| Line-height | `--lh-hero`, `--lh-tight`, `--lh-body`, `--lh-relaxed` |
| Radii | `--radius-sm` through `--radius-pill` |
| Shadows | `--shadow-chip`, `--shadow-card`, `--shadow-card-lg`, `--shadow-hover`, `--shadow-stat`, `--shadow-dashboard` |
| Spacing | `--space-1` through `--space-24` (Tailwind-aligned) |
| Motion | `--ease-out-quart`, `--dur-fast/med/slow` |

**New `.bw-*` utility classes:**

- `bw-h1 / bw-h2 / bw-h3` — fluid heading compositions
- `bw-eyebrow` — uppercase green label (font-size 11px, 0.14em tracking)
- `bw-p / bw-muted / bw-meta / bw-code` — body text variants
- `bw-focusable` — standardised focus ring (2px `--focus` outline, pill radius)
- `bw-glass / bw-glass-soft` — glassmorphism card compositions matching `theme.ts` constants
- `bw-card` — standard white card with `--border` + `--radius-xl`

---

## Notes

- Tailwind `@theme inline` block and `next/font` wiring preserved unchanged
- `body` font-family kept as `Arial, Helvetica` (matches production; Geist loads via next/font for headings)
- `--background` / `--foreground` legacy aliases retained for Tailwind compatibility
- `theme.ts` glass string constants remain as Tailwind class shorthands; CSS vars are the canonical source going forward
