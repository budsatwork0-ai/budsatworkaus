/**
 * Design System Rules — structured audit rubrics for the Design System Agent.
 *
 * Each audit area has:
 *   · A weight (how much it contributes to the overall consistency score)
 *   · Pass/fail criteria
 *   · Known violations to check
 *   · Remediation guidance
 *
 * The agent reads these rules, cross-references against component snapshots
 * stored in Supabase/memory, then scores each area 0–100.
 */
import { GLASS_VARIANTS, SIMPLICITY_RULES, KNOWN_DUPLICATES } from './tokens';

// ── Audit area definitions ────────────────────────────────────────────────────

export interface AuditArea {
  id: string;
  label: string;
  weight: number;          // 0–1, must sum to 1 across all areas
  description: string;
  passCriteria: string[];
  commonViolations: string[];
  remediation: string;
}

export const AUDIT_AREAS: AuditArea[] = [
  {
    id: 'glass-consistency',
    label: 'Glass Morphism Consistency',
    weight: 0.15,
    description:
      'All glass surfaces must use one of the three defined variants (full, soft, step3). ' +
      'No hand-rolled bg-white/N or custom backdrop-blur values outside the token system.',
    passCriteria: [
      'All glass surfaces use bg-white/80, bg-white/70, or bg-white/80 (no-blur) matching GLASS_VARIANTS',
      'No components use bg-white/60 or bg-white/75 (off-spec variants)',
      'All glass cards use backdrop-blur-2xl (not blur-xl or blur-lg)',
      'border-black/10 is the only glass border token — no border-white/* on full glass cards',
      'Shadow is always shadow-[0_10px_30px_rgba(2,6,23,0.08)] (full) or shadow-[0_6px_20px_rgba(2,6,23,0.06)] (soft)',
    ],
    commonViolations: [
      'GlassUI.tsx GlassCard uses bg-white/60 — off-spec (should be /70 soft variant)',
      'UIComponents.tsx glassCard() uses bg-white/75 — off-spec (should be /80 full or /70 soft)',
      'Nested glass cards (glass-within-glass) — violates Apple simplicity rule',
      'S3_Card uses backdrop-blur-2xl inconsistently — step3 variant should NOT have backdrop-blur',
    ],
    remediation:
      'Replace all off-spec glass classes with GLASS_VARIANTS imports from @/lib/design-system/tokens. ' +
      'Update GlassCard to use glass-soft, glassCard() function to use glass-full.',
  },
  {
    id: 'typography-hierarchy',
    label: 'Typography Hierarchy',
    weight: 0.15,
    description:
      'Headings and body text must use the CSS variable scale or .bw-* utility classes. ' +
      'Inline text-[Npx] on headings is a drift signal.',
    passCriteria: [
      'h1-level headings use .bw-h1 or font-size: var(--h-hero) / var(--h-cta)',
      'Section headings use .bw-h2 or var(--h-section)',
      'Card headings use .bw-h3 or var(--h-card)',
      'Body text uses .bw-p or text-[15px] / var(--text-base)',
      'Muted/meta text uses .bw-muted or .bw-meta — never ad-hoc text-slate-* classes on semantic content',
      'Eyebrow labels use .bw-eyebrow (uppercase, 0.14em tracking)',
      'Font weights: 700=headings, 600=labels/CTAs, 500=emphasis, 400=body — no 300 or 800',
    ],
    commonViolations: [
      'text-[22px] inline on Tile feature label — should use var(--h-card) or a named token',
      'text-[14px] on GlassUI.tsx Tile subtitle — should use var(--text-sm)',
      'text-[10px] scattered in multiple components — below minimum legible size (12px floor)',
      'font-size: var(--text-eyebrow) used inline without uppercase + tracking combo',
      'Multiple text-slate-600 and text-slate-700 used interchangeably — muted should always be text-slate-600',
    ],
    remediation:
      'Migrate heading inline sizes to .bw-h* classes. Floor all text at 11px minimum. ' +
      'Standardise muted text to text-slate-600 only. Use TYPE exports from tokens.ts.',
  },
  {
    id: 'color-literals',
    label: 'Color Token Compliance',
    weight: 0.10,
    description:
      'All colors must use CSS vars (var(--*)) or brand token exports. Hardcoded hex values ' +
      'or rgba() inline are drift signals unless they are shadow compositions.',
    passCriteria: [
      'All text colors reference CSS vars or Tailwind text-slate-* (acceptable)',
      'All background fills reference CSS vars (var(--accent), var(--surface), etc.)',
      'color-mix(in srgb, var(--accent) N%, #fff) is acceptable for tinted fills if isolated',
      'rgba() only permitted in box-shadow values — not in background, border, or text',
      'No hardcoded hex values for brand colors outside tokens.ts / theme.ts',
    ],
    commonViolations: [
      'Tile active fill uses color-mix inline — should be a named token e.g. accentTint5',
      'Icon fill/stroke uses currentColor (acceptable) but some use hardcoded #fff inside strokes',
      'border-[color:var(--accent)] vs ring-[color:var(--accent)] inconsistency — pick one',
      'rgba(100,116,139,0.75) inline for Tile subtitle — should use var(--muted) or Tailwind token',
    ],
    remediation:
      'Define color-mix tints as named exports in tokens.ts. ' +
      'Replace all inline rgba() fills with CSS var references. ' +
      'Standardise active border to border-[color:var(--accent)] universally.',
  },
  {
    id: 'component-duplication',
    label: 'Component Duplication',
    weight: 0.20,
    description:
      'Near-duplicate components increase maintenance burden and visual inconsistency. ' +
      'The agent compares component signatures and identifies consolidation candidates.',
    passCriteria: [
      'Only one glass card base component — not three',
      'Only one Row/KV component with a density variant — not two separate components',
      'Only one Chip component with a density variant',
      'Only one className concatenation utility (cx from theme.ts)',
      'No icon SVGs defined inline when they match an already-defined icon in HomePage.tsx or a shared icons file',
    ],
    commonViolations: KNOWN_DUPLICATES.map(
      (d) => `${d.id}: ${d.description}`,
    ),
    remediation:
      'Follow KNOWN_DUPLICATES resolutions in @/lib/design-system/tokens.ts. ' +
      'Create src/components/ui/ shared primitives: GlassCard, Row, Chip, Icon.',
  },
  {
    id: 'spacing-consistency',
    label: 'Spacing & Layout Consistency',
    weight: 0.10,
    description:
      'Padding and gap values must align to the 4px grid. Arbitrary pixel values (gap-[11px], p-[13px]) ' +
      'are drift signals. Component padding should follow tier rules.',
    passCriteria: [
      'All spacing values are multiples of 4px (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80)',
      'Cards use p-4 (16px) minimum or p-5 (20px) — not p-3 (12px) unless explicitly a compact variant',
      'Feature tiles use px-7 py-8 (28/32) — not arbitrary values',
      'Gap values use standard Tailwind scale: gap-1 through gap-10',
      'Section padding uses space-12 (48px) or space-16 (64px) on desktop',
    ],
    commonViolations: [
      'py-6 px-5 on standard Tile (24px/20px) — correct but undocumented',
      'gap-1.5 on QtyChips — 6px is off-grid (should be gap-2=8px or gap-1=4px)',
      'px-2.5 on Chip — 10px is off-grid (prefer px-3=12px)',
      'p-[3px] or similar tiny arbitrary values in badge overlays',
    ],
    remediation:
      'Align all spacing to the 4px grid. Use SPACE exports from tokens.ts. ' +
      'Document standard component padding in rules.ts.',
  },
  {
    id: 'cta-interactive-patterns',
    label: 'CTA & Interactive Patterns',
    weight: 0.15,
    description:
      'All interactive elements must follow the CTA token system. Focus rings, hover states, ' +
      'and touch targets must comply with WCAG 2.1 AA standards.',
    passCriteria: [
      'Primary CTAs are rounded-full — no square or only-rounded-xl CTAs',
      'All buttons have visible focus ring (focus-visible:outline or .bw-focusable)',
      'Focus ring color is always var(--focus) — not accent, not blue',
      'Hover state on primary CTA: opacity-90 + shadow lift',
      'All interactive elements ≥44px touch target height on mobile',
      'Disabled states use opacity-40 (not opacity-50 or opacity-60)',
      'Keyboard handlers present on custom button-role elements (Enter + Space)',
    ],
    commonViolations: [
      'glassCard() active state uses ring-1 / ring-2 without specifying focus-visible — could confuse always-visible ring',
      'Some icon buttons lack aria-label or are below 44px on mobile',
      'Hover states on Tile use shadow only — no opacity change, inconsistent with primary CTAs',
      'asButtonProps helper in GlassUI.tsx not used consistently — some divs acting as buttons lack role="button"',
    ],
    remediation:
      'Apply CTA token patterns. Add .bw-focusable to all interactive elements. ' +
      'Audit all role="button" elements for aria-label and keyboard handlers.',
  },
  {
    id: 'sticky-footer',
    label: 'Sticky Footer Compliance',
    weight: 0.08,
    description:
      'Sticky bars at the bottom of the viewport must account for notched devices via ' +
      'env(safe-area-inset-bottom) and use z-50 consistently.',
    passCriteria: [
      'All sticky-bottom bars include pb-[env(safe-area-inset-bottom)]',
      'Sticky elements use z-50 — not z-40, z-30, or higher values like z-100',
      'No content is obscured by a sticky bar (content has matching bottom padding)',
      'Sticky bars use the glass-full variant — consistent with page surface',
      'Single sticky bar rule: only one fixed-bottom element per page',
    ],
    commonViolations: [
      'Services page sticky quote bar may lack safe-area padding on iOS',
      'Multiple agent approval queue elements may stack z-indices unpredictably',
      'Cookie banner and sticky quote bar may both appear simultaneously on first visit',
    ],
    remediation:
      'Audit all fixed-bottom elements. Add pb-[env(safe-area-inset-bottom)] to each. ' +
      'Document z-index tier in a single file. Ensure cookie banner dismissal before wizard sticky bar shows.',
  },
  {
    id: 'apple-simplicity',
    label: 'Apple-Inspired Simplicity',
    weight: 0.07,
    description:
      'Visual complexity must stay within the three-layer maximum. ' +
      'The agent scores information density, CTA count per section, and motion entropy.',
    passCriteria: SIMPLICITY_RULES as unknown as string[],
    commonViolations: [
      'Step 2 (service configuration) has high information density — multiple nested sections with independent headings',
      'Quote wizard has two CTAs of similar weight on some steps ("Back" vs "Next" vs "Save")',
      'Glass cards nested inside glass-backgrounds create 4-layer stacking in some views',
      'Motion: some buttons use spring animations while others use tween — inconsistent feel',
      'Icon stroke widths vary: some icons at 2.0, most at 1.75 — standardise to 1.75 universally',
    ],
    remediation:
      'Audit Step 2 for density. Merge competing CTAs. Remove glass nesting. ' +
      'Audit all SVGs for strokeWidth and standardise to 1.75.',
  },
];

// ── Component standards ───────────────────────────────────────────────────────
// Canonical definition of each component and its required implementation.

export interface ComponentStandard {
  name: string;
  description: string;
  file: string;
  requiredProps?: string[];
  forbiddenPatterns: string[];
  canonicalImplementation: string;
}

export const COMPONENT_STANDARDS: ComponentStandard[] = [
  {
    name: 'GlassCard (full)',
    description: 'Primary glass surface for service selection cards, wizard sections, modal panels.',
    file: 'src/components/ui/GlassCard.tsx (to be created)',
    forbiddenPatterns: ['bg-white/60', 'bg-white/75', 'bg-white/65', 'backdrop-blur-xl', 'backdrop-blur-lg'],
    canonicalImplementation:
      'className="rounded-2xl bg-white/80 backdrop-blur-2xl border border-black/10 shadow-[0_10px_30px_rgba(2,6,23,0.08)]"',
  },
  {
    name: 'GlassCard (soft)',
    description: 'Secondary glass surface for nested panels, review sections, step summaries.',
    file: 'src/components/ui/GlassCard.tsx (variant="soft")',
    forbiddenPatterns: ['bg-white/60', 'bg-white/80', 'bg-white/75'],
    canonicalImplementation:
      'className="rounded-2xl bg-white/70 backdrop-blur-2xl border border-black/10 shadow-[0_6px_20px_rgba(2,6,23,0.06)]"',
  },
  {
    name: 'Chip',
    description: 'Inline tag for frequency, service category, status badges.',
    file: 'src/components/ui/Chip.tsx (to be created)',
    forbiddenPatterns: ['bg-white/60 border-white/40', 'rounded-xl', 'px-2.5'],
    canonicalImplementation:
      'className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] bg-white/70 border border-white/50 text-slate-800"',
  },
  {
    name: 'Row (key-value)',
    description: 'Label : value pair for quote summaries, pricing breakdowns, KPI displays.',
    file: 'src/components/ui/Row.tsx (to be created)',
    forbiddenPatterns: ['py-0', 'py-0.5'],
    canonicalImplementation:
      '<div className="flex items-center justify-between py-1"><span className="text-sm text-slate-600">{label}</span><span className="text-sm font-semibold text-slate-900">{value}</span></div>',
  },
  {
    name: 'PrimaryButton',
    description: 'Main call-to-action button. One per section maximum.',
    file: 'src/components/ui/Button.tsx (to be created)',
    requiredProps: ['aria-label or visible text', 'type attribute'],
    forbiddenPatterns: ['rounded-xl', 'rounded-2xl', 'rounded-lg'],
    canonicalImplementation:
      'className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full font-semibold bg-[var(--accent)] text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2 transition-all"',
  },
  {
    name: 'Tile (service selection)',
    description: 'Service category selection card — step 1 of the quote wizard.',
    file: 'src/app/(public)/services/components/shared/UIComponents.tsx',
    forbiddenPatterns: ['rounded-xl', 'rounded-2xl', 'bg-white/'],
    canonicalImplementation:
      'Pure white bg (not glass), rounded-3xl or rounded-[30px], border-black/[0.07] inactive, border-[var(--accent)] active.',
  },
];

// ── Responsive standards ──────────────────────────────────────────────────────

export const RESPONSIVE_STANDARDS = {
  gridCols: {
    services:   { mobile: 2, tablet: 3, desktop: 6 },
    quoteScopeCards: { mobile: 1, tablet: 2, desktop: 2 },
    dashboardStats: { mobile: 2, tablet: 3, desktop: 4 },
  },
  fontScaling: {
    minInputFontSize: '16px',  // below 16px triggers iOS zoom — non-negotiable
    minBodyFontSize:  '14px',
    minLabelFontSize: '12px',
    minBadgeFontSize: '10px',  // absolute floor
  },
  touchTargets: {
    minHeight: 44,  // px — WCAG 2.1 Level AA
    minWidth:  44,
    comfortable: 48,
  },
  safeAreas: {
    bottom: 'env(safe-area-inset-bottom)',
    top:    'env(safe-area-inset-top)',
  },
} as const;

// ── Design system health scoring ──────────────────────────────────────────────

export function computeOverallScore(areaScores: Record<string, number>): number {
  let total = 0;
  let weightUsed = 0;

  for (const area of AUDIT_AREAS) {
    const score = areaScores[area.id];
    if (score !== undefined) {
      total += score * area.weight;
      weightUsed += area.weight;
    }
  }

  return weightUsed > 0 ? Math.round(total / weightUsed) : 0;
}

export function scoreLabel(score: number): 'critical' | 'poor' | 'fair' | 'good' | 'excellent' {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 55) return 'fair';
  if (score >= 35) return 'poor';
  return 'critical';
}

// Export canonical context string for LLM prompts
export function buildAuditContext(): string {
  return [
    '## Design Audit Areas',
    AUDIT_AREAS.map((a) =>
      `### ${a.label} (weight: ${Math.round(a.weight * 100)}%)\n` +
      `${a.description}\n\n` +
      `**Pass criteria:**\n${a.passCriteria.map((c) => `- ${c}`).join('\n')}\n\n` +
      `**Common violations:**\n${a.commonViolations.map((v) => `- ${v}`).join('\n')}`,
    ).join('\n\n'),
    '',
    '## Known Duplicates',
    KNOWN_DUPLICATES.map(
      (d) => `### ${d.id}\n${d.description}\nResolution: ${d.resolution}`,
    ).join('\n\n'),
    '',
    '## Apple Simplicity Rules',
    SIMPLICITY_RULES.map((r) => `- ${r}`).join('\n'),
  ].join('\n');
}
