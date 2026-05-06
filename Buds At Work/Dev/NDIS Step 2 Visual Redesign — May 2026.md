# NDIS Step 2 Visual Redesign — May 2026

**Date:** 2026-05-05
**Status:** Implemented
**Scope:** Icon treatment across all selectable tiles and room steppers in the NDIS cleaning/yard quote panel.
**Commit:** `6ae4a76`

---

## Problem

The NDIS step 2 hourly-estimator panel had good structural bones (hero band, violet gradient, section cards, custom slider) but felt like an afterthought compared to the rest of the wizard. Tiles were label-only with no visual cues, room steppers were plain text rows, and condition labels ("Condition") were generic across both cleaning and yard services.

---

## Changes

All changes in `src/app/(public)/services/page.tsx` — within the `ndisStep2Panel` IIFE block.

### 1. Room stepper icons

`Stepper` component gained an optional `icon?: React.ReactNode` prop. A small icon now appears to the left of each room label, colour-shifting from `text-slate-400` to `text-violet-500` when the count is non-zero (matching the tile active state).

Icons:
- Bedrooms → bed silhouette
- Bathrooms → bathtub
- Living rooms → sofa outline
- Kitchens → fork-and-range
- Laundry → washing machine drum
- Storeys → stacked steps

### 2. Condition tiles — contextual icons

Each condition tile now shows an icon badge above the label (8×8 rounded square, `bg-violet-100 text-violet-600` when active, `bg-slate-50 text-slate-400` otherwise).

Cleaning:
- Tidy → sparkle/sun-rays
- Lived-in → house
- Reset → circular refresh arrow

Yard:
- Maintained → leaf
- Standard growth → branching plant
- Overgrown → scissors

### 3. Condition section label — context-aware

Was `"Condition"` for both services. Now:
- Cleaning → `"Property condition"`
- Yard → `"Growth level"`

### 4. Yard size tiles — dot-grid area indicator

Each yard size tile now shows a dot-grid above the label where more dots = bigger area:
- Small: 2×2 grid
- Medium: 3×3 grid
- Large: 4×4 grid
- X-Large: 5×5 grid

Dot colour tracks the active state (`text-violet-500` / `text-slate-300`).

### 5. Schedule tiles — time-of-day icons

Each rate-slot tile now shows an icon badge (same sizing as condition tiles):
- Weekday day → sun with rays
- Saturday → calendar with centre-mark
- Sunday → crescent moon
- Public holiday → 5-point star

---

## Verification

- `npx tsc --noEmit` → clean
- `npx next build` → ✓ compiled successfully (26 s)

---

## Files touched

```
EDIT  src/app/(public)/services/page.tsx
```
