---
tags: [claude-memory, conventions, rules, code-style]
---

# Convention Rules

Standing rules for this codebase. These apply to all code Claude Code writes or modifies.

---

## Tailwind utilities only

Use Tailwind utility classes for all layout, spacing, and colour. Do not write arbitrary inline CSS.

```tsx
// CORRECT
<div className="flex gap-4 p-6 rounded-xl">

// WRONG
<div style={{ display: 'flex', gap: '1rem', padding: '1.5rem' }}>
```

**Exception:** Dynamic values that cannot be expressed as Tailwind classes (e.g. computed polygon coordinates for yard maps).

---

## Use brand.* and glass tokens — do not invent colours

All colours must come from `brand.*`, `glass`, or `glassSoft`. No custom hex values in components.

```tsx
// CORRECT
style={{ color: brand.text, background: brand.card }}

// WRONG
style={{ color: '#333', background: '#ffffff' }}
```

---

## Shared components are used everywhere — check all call sites

`SummaryCard`, `Panel`, `StatRow`, `StatusChip` in `components/shared/index.tsx` are used across **all** dashboard tabs. Before modifying a shared component prop or behaviour:

```bash
grep -r "SummaryCard\|Panel\|StatRow\|StatusChip" src/
```

Fix all call sites in the same commit.

---

## Run grep before touching glass usage

Before modifying any `glass` or `glassSoft` usage:

```bash
grep -r "glass" src/
```

Changes cascade. One missed usage becomes a visual regression.

---

## Convention capture

When Claude Code corrects a mistake or discovers a new anti-pattern, run:

```bash
npx tsx scripts/vault-convention.ts
```

This saves the rule to `CLAUDE.md`, the vault, and the Continuous Learning Loop in the dashboard.

---

## Imports follow path alias, not relative

Always use `@/` path alias for cross-directory imports. Relative paths (`../../`) are only acceptable for same-folder imports.

---

## Related Systems
- [[Anti-Patterns]]
- [[../Components/Brand|Brand]]
- [[../Systems/Bud Core Runtime|Bud Core Runtime]]
