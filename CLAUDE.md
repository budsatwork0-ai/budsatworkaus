# Bud OS — Constitution & Operating Rules

## What this is

Buds at Work is a **live production platform** serving real customers in Logan and South Brisbane.
Services: cleaning, yard care, window cleaning, car detailing, dump runs, laundry, NDIS support.

Real orders are in flight. Real payments process. Real crew depend on this for income.

**Treat every change as if production is watching.**

---

## Core Philosophy

- **Surgical changes only.** Minimal footprint. Maximum precision.
- **Preserve pricing integrity.** Pricing bugs = lost revenue or customer trust.
- **Preserve UX consistency.** Customers and crew remember inconsistency.
- **No broad rewrites.** Stable systems stay stable.
- **Read before writing.** Search graphify, find existing patterns, then act.

---

## Stack

- Next.js 15 / React 19 / TypeScript
- Supabase (auth + database)
- Stripe (payments + webhooks)
- Resend (transactional email)
- Vercel (hosting + cron)
- Tailwind v4

---

## Architecture Principles

1. Business logic is extracted from UI — keep components thin.
2. Pricing logic has one source of truth — never duplicated across files.
3. Shared helpers are reused before new ones are created.
4. Backwards compatibility is preserved unless explicitly broken.
5. Implementation happens in small, isolated, reviewable batches.
6. `src/lib/agents/` is a production service layer — treat it like one.
7. `Bud` (the orchestrator agent) monitors the fleet — do not break its data contracts.

---

## Pricing Protection Rules

Pricing consistency is critical to business survival.

**Never:**
- Silently change pricing formulas or multipliers
- Alter hourly rate assumptions
- Remove or modify price caps
- Duplicate pricing logic across files
- Modify quote calculations without explicit approval

**Every pricing-related change must state:**
- Which services are affected
- Which helpers/functions change
- What the before/after pricing impact is
- What the regression risk is

Pricing changes require human approval before implementation.

---

## UX Rules (Bud Taste)

Follow Apple-style clarity:
- One primary action per screen — minimal cognitive load
- Clear spacing hierarchy — no visual clutter
- Concise copy — say it in half the words
- Sticky footer consistency — CTA placement stays predictable
- Mobile-first — all layouts must work at 375px

**Avoid:**
- Giant walls of text in UI
- Inconsistent card layouts between dashboard tabs
- Abrupt visual changes to established flows
- Inventing new colour values — use `brand.*` tokens only

---

## Design System Anti-patterns

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

---

## Before Changing a Shared Pattern

- Run `grep -r "glass" src/` before touching glass usage — changes cascade
- Shared components (`SummaryCard`, `Panel`, `StatRow`, `StatusChip` in `components/shared/index.tsx`) are used across all dashboard tabs — update all call sites
- If a pattern change affects more than one file, fix all affected files in the same commit

---

## Development Rules

**Always:**
- Search graphify before writing new code: `graphify query "<question>"`
- Reuse existing patterns and helpers — grep before inventing
- Run `tsc --noEmit`, `eslint src/`, `next build` before marking work done
- Run `graphify update .` after modifying code to keep the graph current

**Never:**
- Edit `.env` files or expose secrets
- Alter Vercel / deployment config without approval
- Add npm dependencies without stating why and getting agreement
- Push directly to production
- Create framework-scale rewrites

---

## Preferred Refactor Strategy

Work in this order — stop when the problem is solved:

1. Extract duplicated helpers into shared utils
2. Extract duplicated logic into services
3. Extract isolated UI panels into components
4. Reduce orchestration complexity
5. Introduce a shared services layer
6. Stabilise before expanding

Never jump to step 4–6 when steps 1–2 solve it.

---

## Human Approval Required For

Stop and confirm before proceeding with any of these:

- Any pricing formula change
- Database schema changes (new tables, column changes, index drops)
- Stripe configuration changes
- Auth / session changes
- Vercel / deployment configuration
- Any communication sent to real customers
- Any bulk data mutation affecting more than 10 rows
- Autonomous production writes from agents

---

## Memory Sources (Read In This Order)

1. `graphify query "<question>"` — scoped subgraph, fastest, use first
2. `graphify-out/wiki/index.md` — broad navigation
3. `graphify-out/GRAPH_REPORT.md` — architecture overview, use sparingly
4. `Buds At Work/00 System Core/Claude Memory/` — anti-patterns and convention rules
5. `Buds At Work/01 Architecture/` — Obsidian vault architecture notes
6. `Buds At Work/Dev/` — recent dev logs (Dev/Projects/ for project history)

---

## Convention Capture

When you correct a mistake or discover a new anti-pattern, run:
```bash
npx tsx scripts/vault-convention.ts
```
This saves the rule to CLAUDE.md, the vault, and the Continuous Learning Loop in the dashboard.

---

## graphify

Knowledge graph at `graphify-out/`. Rules:
- For codebase questions, first run `graphify query "<question>"` — scoped subgraph, much smaller than raw grep
- Use `graphify path "<A>" "<B>"` for relationship questions
- Use `graphify explain "<concept>"` for focused concepts
- After modifying code: `graphify update .`
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture review
- If `graphify-out/wiki/index.md` exists, use it for navigation over raw source browsing
