# Buds At Work — Claude Code Rules

These rules are always loaded. Follow them without being asked.

## Anti-patterns

### glass / glassSoft
`glass` and `glassSoft` (from `@/app/ui/theme`) are **strings** — Tailwind class lists joined with spaces. They are not CSS objects.

```tsx
// CORRECT
className={glass}
className={`${glass} extra-class`}

// WRONG — glass is a string, not an object
style={{...glass}}
style={glass}
{...glass}
```

### Imports — theme tokens
Always import from `@/app/ui/theme` (no file extension):
```tsx
import { glass, glassSoft, brand } from '@/app/ui/theme';
```
Never from `../theme`, `@/app/ui/theme.ts`, or any re-export path.

### Brand tokens
- CTAs and action buttons: `brand.accent` (#1C7C54) — never `brand.primary` for button backgrounds
- Body text: `brand.text` — secondary/labels: `brand.muted`
- Surfaces: `brand.bg` (page), `brand.card` (white card), `brand.surface` (tinted)
- All values live in `src/app/ui/theme.ts`

### Styling
- Tailwind utilities only — no arbitrary inline CSS for layout, spacing, or colour
- Use existing `brand.*`, `glass`, `glassSoft` tokens — don't invent new colour values

## Before changing a shared pattern
- Run `grep -r "glass" src/` before touching glass usage — changes cascade
- Shared components (`SummaryCard`, `Panel`, `StatRow`, `StatusChip` in `components/shared/index.tsx`) are used across all dashboard tabs — update all call sites
- If a pattern change affects more than one file, fix all affected files in the same commit

## Convention capture
When you correct a mistake or discover a new anti-pattern, run:
```bash
npx tsx scripts/vault-convention.ts
```
This saves the rule to CLAUDE.md, the vault, and the Continuous Learning Loop in the dashboard.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
