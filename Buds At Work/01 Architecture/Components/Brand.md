---
tags: [component, design-system, theme, god-node]
---

# Brand

## Purpose
The design token object (137 connections). Every colour, surface, and text style in the app flows through `brand.*` properties. Imported alongside `glass` and `glassSoft` from the theme module.

## Source file
`src/app/ui/theme.ts` L2

Key values:
- `brand.primary` — `#0f3d2e` (dark green, backgrounds only — NOT for button backgrounds)
- `brand.accent` — `#1C7C54` (CTAs and action buttons)
- `brand.text` / `brand.muted` — body and label text
- `brand.bg` / `brand.card` / `brand.surface` — page, card, and tinted surfaces
- `brand.border` — consistent border colour

## Why it's a god node
Imported by ~137 components. A change to any `brand.*` value cascades across the entire UI instantly.

## Claude should know
- **`glass` and `glassSoft` are strings** — Tailwind class lists joined with spaces. Never spread them as objects (`style={{...glass}}` is wrong).
- Always import from `@/app/ui/theme` — never from a re-export path or with a file extension.
- CTAs must use `brand.accent`, not `brand.primary` — `brand.primary` is for backgrounds only.
- Before changing any `brand.*` value, run `grep -r "brand\." src/` to understand the blast radius.
- See [[Claude Memory/Anti-Patterns]] for the full glass/glassSoft anti-pattern reference.

## Related files/components
- `src/app/ui/theme.ts`

## Related Systems
- [[ServicesPageContent]]
- [[Agent Runtime]]
- [[Bud Core Runtime]]
- [[Claude Memory/Anti-Patterns|Anti-Patterns]]

## Graphify queries
```bash
graphify explain "Brand"
graphify query "brand theme tokens colour"
```
