---
tags: [design-system, core-2, ui, tokens, brand]
---

# Core 2.0 Design System

The visual language for the Buds At Work admin workspace. Calm, white, rounded,
friendly, operational. **Use colour lightly — most of the interface stays white.**
Semantic colours carry meaning only, never decoration.

Tokens live in code at `src/app/ui/theme.ts` → `export const core2`. Use those,
don't hardcode values (per the Convention Rules).

---

## Type

### Body & meta
Clean, readable, calm. Avoid dense paragraphs.

- Base body: 14–16px
- Meta text: 12–13px
- Line height: 1.45–1.6
- Meta colour: muted grey

### Display & headings
Confident, not loud. **Sentence case, never all caps.**

- Page title: 28–36px, semibold
- Section heading: 18–22px, semibold
- Card title: 15–17px, semibold

### Eyebrow & trust row
Small labels above major sections to set context.

- Eyebrows: `Prototype`, `Admin workspace`, `Live dashboard`, `Core 2.0 system`
- Trust row: "Sample data only", "Updated 2 min ago", "Admin view"

---

## Colour

### Primary palette
| Role | Token | Value |
|------|-------|-------|
| Primary | `core2.color.primary` | deep Buds green `#0F3D2E` |
| Accent | `core2.color.accent` | muted green `#1C7C54` |
| Secondary | `core2.color.secondary` | warm mustard/gold `#C8932B` (used sparingly) |
| Background | `core2.color.bg` | soft cream / off-white `#FAF7F0` |
| Surface | `core2.color.surface` | white `#FFFFFF` |

### Text & semantic
| Role | Token | Value |
|------|-------|-------|
| Main text | `core2.color.text` | near-black `#16201B` |
| Secondary text | `core2.color.textSecondary` | medium grey `#5C6B62` |
| Muted text | `core2.color.textMuted` | soft grey `#8A978F` |
| Success | `core2.color.success` | green |
| Warning | `core2.color.warning` | amber |
| Error | `core2.color.error` | red |
| Info | `core2.color.info` | blue-grey |

Semantic colours are for meaning (status, alerts), not decoration.

---

## Radii — `core2.radius`
Rounded, friendly, modern.

- `sm` (10px): inputs, chips, badges
- `md` (14px): buttons, list rows
- `lg` (20px): cards
- `xl` (26px): feature panels / dashboard blocks

## Shadows & elevation — `core2.shadow`
Very soft shadows only — no harsh dark shadows.

- `card`: subtle border + light shadow on sidebar/cards
- `hover`: slight lift
- `modal`: stronger shadow

---

## Components

### Buttons
- **Primary:** dark green background, white text
- **Secondary:** white surface, light border
- **Ghost:** transparent, subtle hover
- **Danger:** red, only when needed

Rounded (`md`), calm, clear.

### Cards
Soft containers: white background, light border, large radius (`lg`), generous
padding, clear title, small supporting meta. Avoid clutter inside.

### Chips & badges
Soft background, small text, rounded pill (`sm`). For status / filters / counts /
roles — `Active`, `Admin`, `New`, `2 alerts`, `Completed`, `Pending`.

### Form inputs
White background, light border, rounded (`sm`), clear label, helpful placeholder,
error message below the input. **Focus state uses the primary green.** Spacious.

### Avatars
Initials when no photo. Circular, soft background, centred initials. Small in
lists, larger in profile/header areas.

### Icons
Thin, rounded, consistent size. Sidebar 18–20px, card 20–24px. Icons support
labels, never replace them.

### Logo / wordmark
Warm, local, trustworthy. Simple typography, not overly playful, paired with
Buds green, with breathing room. Works in dark green, white, and single-colour.

---

## Overall feel
Rounded, friendly, modern, calm. White-dominant with green used as the accent and
gold reserved for occasional emphasis. Operational clarity over visual noise.
