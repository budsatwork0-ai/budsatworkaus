# Design System

> Brand identity, UI components, tokens, and accessibility standards for Buds At Work.

**Dashboard entry:** `/dashboard/settings` (reference)  
**Domain card shows:** "Brand system live" · Components · Tokens

---

## Brand Identity

| Token | Value | Usage |
|---|---|---|
| `brand.primary` | `#0F3D2E` | Deep green — headings, nav logo, promises card |
| `brand.accent` | `#10b981` | Emerald — all CTA buttons, "from $XX" prices, hover states |
| `brand.text` | `#111827` | Body text |
| `brand.muted` | `#475569` | Secondary text, labels |
| `brand.bg` | `#F7F7F5` | Card/component background |
| `brand.card` | `#FFFFFF` | White card surface |
| `brand.border` | `#E5E7EB` | Card borders, dividers |
| `brand.focus` | `#7DD3FC` | Focus ring / glow |

**Rule:** All quote/CTA buttons use `brand.accent` (#10b981). Never use `brand.primary` for button backgrounds.  
**File:** `src/app/ui/theme.ts` — all tokens exported from `brand` object.

---

## Typography

| Scale | Usage |
|---|---|
| `text-xl font-semibold` | Page headings |
| `text-sm font-medium` | Labels, nav items |
| `text-xs` | Meta text, timestamps, hints |
| `text-[11px] uppercase tracking-wider` | Section labels |
| `text-[10px]` | Keyboard shortcut hints, badges |

Font: System default (Inter via Tailwind / Next.js default). No custom font loaded — keeps performance fast.

---

## Core UI Components

| Component | File | Usage |
|---|---|---|
| SummaryCard | `components/shared/index.tsx` | Financial KPI cards |
| Panel | `components/shared/index.tsx` | Content containers |
| StatRow | `components/shared/index.tsx` | Key-value rows |
| StatusChip | `components/shared/index.tsx` | Status badges |
| DomainCommandPanel | `components/DomainCommandPanel.tsx` | 12-domain grid |
| QuickActions | `components/QuickActions.tsx` | Action bar + modals |
| SearchBar | `components/SearchBar.tsx` | In-page search |
| ActivityFeed | `components/ActivityFeed.tsx` | Event log |
| SideNavItem | `_components/SideNavItem.tsx` | Nav items |

---

## Component Patterns

**Rounded corners:** `rounded-xl` (inputs) · `rounded-2xl` (cards, modals, panels)  
**Borders:** `border border-black/[0.06]` (light) · `border border-slate-200` (inputs)  
**Shadows:** `shadow-sm` (default) · `shadow-xl` (modals/dropdowns)  
**Transitions:** `transition-all` + `hover:shadow-md` on interactive cards  
**Animations:** Framer Motion — `initial/animate/exit` with `[0.22, 1, 0.36, 1]` easing  
**Focus states:** `focus:ring-2 focus:ring-[color]/20 focus:border-[color]` on all inputs

---

## Accessibility Standards (WCAG 2.1 AA)

- [ ] All interactive elements have accessible labels or `aria-label`
- [ ] Keyboard navigation: Tab order logical, Escape closes modals
- [ ] Colour contrast: brand green on white passes AA (confirm with contrast checker)
- [ ] Focus indicators visible on keyboard navigation
- [ ] Error messages describe the problem + how to fix
- [ ] Form labels use `<label>` + `htmlFor` — not just placeholder text
- [ ] Modal uses `role` semantics + focus trap on open

**Known gaps:**
- Modal focus trap not fully implemented — add `focus-trap-react` or custom hook
- Some icon buttons need `aria-label` audit

---

## Mobile Responsiveness

- Sidebar collapses on mobile (hamburger → slide-in drawer)
- Domain Command Panel: 2-col mobile → 3-col tablet → 4-col → 6-col desktop
- Summary cards: 1-col → 2-col → 4-col
- All tab grids: 4-col → 8-col at `sm:`

---

## Automation Opportunities

- [ ] Storybook component library (document all shared components)
- [ ] Automated accessibility audit on deploy (axe-core CI)
- [ ] Brand token export → Figma sync
- [ ] Dark mode support (CSS variables ready — just needs dark: classes)

---

## Anti-patterns (recurring AI mistakes)

These are known patterns that break when an AI assistant doesn't know the project conventions.

| What broke | Wrong | Right |
|---|---|---|
| `glass` is a string, not an object | `style={{...glass}}` | `className={glass}` |
| glass with extra classes | `className={glass + " p-4"}` | `` className={`${glass} p-4`} `` |
| Importing theme tokens | `import { glass } from '../theme'` | `import { glass } from '@/app/ui/theme'` |
| Button background colour | `background: brand.primary` | `background: brand.accent` |
| Inline CSS for layout | `style={{ padding: '16px' }}` | `className="p-4"` |

**When changing a pattern:** grep for all usages first — `grep -r "glass" src/` — because changes to shared tokens cascade across all dashboard tabs and portals.

**Capture new rules:** `npx tsx scripts/vault-convention.ts` — saves to CLAUDE.md, this vault, and the Continuous Learning Loop dashboard.

---

## Related
- [[Admin]]
- [[Engineering]]
- [[Product Management]]
