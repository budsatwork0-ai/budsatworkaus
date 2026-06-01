---
tags: [claude-memory, anti-patterns, design-system, rules]
---

# Anti-Patterns

Known patterns that have caused bugs or regressions in this project. Claude Code must not reproduce these.

---

## glass / glassSoft as objects

`glass` and `glassSoft` (imported from `@/app/ui/theme`) are **strings** — Tailwind class lists joined with spaces. They are NOT CSS objects.

```tsx
// CORRECT
className={glass}
className={`${glass} extra-class`}

// WRONG — glass is a string, not an object
style={{...glass}}      // TypeError: spread of string
style={glass}           // Ignored by React
{...glass}              // Spreads individual characters, not CSS properties
```

**Why:** These constants are constructed with `[...classes].join(' ')`. They are meant to be passed to `className`, not `style`.

---

## Wrong import path for theme tokens

```tsx
// CORRECT
import { glass, glassSoft, brand } from '@/app/ui/theme';

// WRONG
import { glass } from '../theme';
import { glass } from '@/app/ui/theme.ts';  // no extension
import { glass } from '@/app/ui';            // no re-export
```

**Why:** TypeScript path aliases resolve `@/app/ui/theme` — relative paths break when files move, and the `.ts` extension is not valid in imports.

---

## brand.primary for button backgrounds

```tsx
// CORRECT — CTAs and action buttons
style={{ background: brand.accent }}   // #1C7C54

// WRONG — brand.primary is for page backgrounds only
style={{ background: brand.primary }}  // #0f3d2e — too dark for buttons
```

**Why:** `brand.primary` is the deep green used for page-level backgrounds and the nav. Using it for buttons makes them visually recede. `brand.accent` is the actionable green.

---

## Operational logic in React components

```tsx
// WRONG — business logic embedded in a UI component
function DashboardTab() {
  const profit = orders.reduce((sum, o) => sum + o.total, 0) - expenses;
  // ...
}

// CORRECT — logic lives in the runtime layer
// Use deriveGlobalTruth() or MissionControlHealth
```

**Why:** The architectural principle is "UI visualises operational intelligence. Runtime owns it." See [[../Systems/Bud Core Runtime|Bud Core Runtime]].

---

## Direct Supabase client in components

```tsx
// WRONG — never import supabase client in a React component
import { createClient } from '@supabase/supabase-js';

// CORRECT — use the server utility in API routes only
import { createServiceClientSafe } from '@/lib/supabase/server';
```

**Why:** The service role key (used in `createServiceClient`) bypasses RLS and must never reach the browser bundle.

---

## Zod v3 API on a Zod v4 repo

This repo runs **Zod v4** (`zod: ^4.x`). Generated/edited code must use the v4 API.

```ts
// CORRECT — Zod v4 requires a key schema
z.record(z.string(), z.unknown())

// WRONG — Zod v3 single-argument form; fails tsc with
// "TS2554: Expected 2-3 arguments, but got 1"
z.record(z.unknown())
```

**Why:** This caused every autonomous `bud/**` branch to fail the CI typecheck (the
only thing `.github/workflows/ci.yml` runs), so every improvement was rolled back.
The improvement pipeline's patch prompt now derives version rules from the installed
`package.json` (`buildToolchainNotes`), and the pre-flight gate (`src/lib/bud/preflight.ts`,
rule A1) auto-fixes the single-arg form. **General rule:** agent-generated code must
match the repo's *installed* major versions, not the model's default assumptions.

---

## Test files placed under `src/`

```
// CORRECT — excluded from the typecheck (tsconfig `exclude: ["tests/**/*"]`)
tests/lib/foo.test.ts

// WRONG — gets type-checked by `tsc --noEmit` and usually breaks CI
src/lib/agents/agents/foo.test.ts
```

**Why:** `tsconfig.json` only excludes `tests/**/*`. A `*.test.ts` under `src/` is
compiled with the project and its `vitest` imports/globals fail the CI typecheck.
Enforced by pre-flight rule A3.

---

## Auto-merging pricing / payments / auth changes

The autonomous improvement pipeline must **never auto-merge** a patch that touches
pricing, Stripe/payments, or auth/session files — even when CI, taste, and browser
gates all pass. Those changes require human approval (see [[Convention Rules]]).

**Why:** A patch can type-check, pass taste, and still silently change a pricing
formula. The guard lives in `src/lib/bud/sensitive-paths.ts` (single source of truth)
and forces such PRs to a draft with a `[HumanReview]` tag in `improvement-executor.ts`.

---

## Related Systems
- [[../Components/Brand|Brand]]
- [[../Systems/Bud Core Runtime|Bud Core Runtime]]
- [[../Systems/createServiceClient|createServiceClient]]
- [[Convention Rules]]
