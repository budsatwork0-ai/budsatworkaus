# Brand

## Purpose
The design token object (137 connections). Every colour, surface, and text style in the app flows through `brand.*` properties. Imported alongside `glass` and `glassSoft` from the theme module.

## Source file
`src/app/ui/theme.ts` L2

Key values:
- `brand.primary` — `#0f3d2e` (dark green, backgrounds only)
- `brand.accent` — `#1C7C54` (CTAs and action buttons)
- `brand.text` / `brand.muted` — body and label text
- `brand.bg` / `brand.card` / `brand.surface` — page, card, and tinted surfaces
- `brand.border` — consistent border colour

## Why it's a god node
Imported by ~137 components. A change to any `brand.*` value cascades across the entire UI instantly.

## Related Systems

- [[ServicesPageContent]]
- [[Agent Runtime]]
- [[Bud Core Runtime]]
- [[Graphify]]

## Graphify queries
```bash
graphify explain "Brand"
graphify query "brand theme tokens colour"
```
