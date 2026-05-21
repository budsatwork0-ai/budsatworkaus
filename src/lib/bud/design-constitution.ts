export type ConstitutionRuleSeverity = 'required' | 'recommended' | 'nice-to-have';
export type ConstitutionRuleCategory =
  | 'color'
  | 'glass'
  | 'typography'
  | 'spacing'
  | 'component'
  | 'accessibility'
  | 'anti-pattern';

export type ConstitutionRule = {
  id: string;
  category: ConstitutionRuleCategory;
  severity: ConstitutionRuleSeverity;
  name: string;
  description: string;
  check: string;
};

// The canonical set of visual rules for Buds At Work.
// Brand: clean, airy, natural, professional — light green + glass morphism.
// Source of truth: src/app/ui/theme.ts
export const DESIGN_CONSTITUTION: ConstitutionRule[] = [
  // ── Color ────────────────────────────────────────────────────────────────────
  {
    id: 'color-primary',
    category: 'color',
    severity: 'required',
    name: 'Brand primary green',
    description:
      'Primary actions, headings, and key accents must use brand.primary (#0F3D2E) or the brand.primary token from @/app/ui/theme. Arbitrary greens (green-700, green-800, emerald-*, teal-*) without the brand token are a violation.',
    check:
      'Look for hardcoded #0f3d2e alternatives or arbitrary Tailwind green/emerald/teal color classes on heading, primary-action, or accent elements.',
  },
  {
    id: 'color-accent',
    category: 'color',
    severity: 'recommended',
    name: 'Action accent green',
    description:
      'Interactive elements (buttons, links, focus rings) should use brand.accent (#1C7C54). Arbitrary greens that are lighter than the brand primary are acceptable only in hover states.',
    check: 'Check button and link background/text color classes for brand accent alignment.',
  },
  {
    id: 'color-background',
    category: 'color',
    severity: 'required',
    name: 'Light green-tinted background',
    description:
      'Page and section backgrounds use brand.bg (#F6FBF7) or white. Dark solid backgrounds (bg-gray-900, bg-black, bg-slate-800+) on layout wrappers violate the light/airy garden aesthetic.',
    check: 'Look for dark solid background classes on top-level layout wrappers or full-page sections.',
  },
  {
    id: 'color-text',
    category: 'color',
    severity: 'recommended',
    name: 'Text colour hierarchy',
    description:
      'Primary text: brand.text (#12261E) or text-slate-900. Secondary/muted text: brand.muted (#4C6157) or text-slate-600. White text only on dark/accent-coloured backgrounds.',
    check: 'Check text colour classes against the hierarchy — very light grays on white backgrounds are a violation.',
  },

  // ── Glass morphism ──────────────────────────────────────────────────────────
  {
    id: 'glass-backdrop',
    category: 'glass',
    severity: 'required',
    name: 'Glass card backdrop blur',
    description:
      'Cards and panels must use the `glass` or `glassSoft` token from @/app/ui/theme, or equivalent classes: bg-white/80 + backdrop-blur-2xl + border border-black/10 + shadow. Flat opaque white cards without backdrop-blur on card surfaces violate the design.',
    check:
      'Find card/panel JSX elements. Check whether they include backdrop-blur-* classes. bg-white without /opacity and without backdrop-blur on a card container is a violation.',
  },
  {
    id: 'glass-opacity',
    category: 'glass',
    severity: 'required',
    name: 'Semi-transparent white surfaces',
    description:
      'Card surfaces should use bg-white/70 through bg-white/95. Fully opaque bg-white (no opacity modifier) on a card or floating surface removes the layered depth effect.',
    check: 'Look for bg-white without an opacity modifier (/70, /80, /90, /95) on card or floating-surface elements.',
  },
  {
    id: 'glass-border',
    category: 'glass',
    severity: 'recommended',
    name: 'Subtle glass border',
    description:
      'Glass cards use border border-black/10 or border-white/20. Thick, solid, or brightly coloured borders on cards are too heavy for the glass aesthetic.',
    check: 'Check border and border-color classes on card elements for contrast with the glass surface.',
  },

  // ── Typography ──────────────────────────────────────────────────────────────
  {
    id: 'type-scale',
    category: 'typography',
    severity: 'recommended',
    name: 'Typography scale',
    description:
      'Headings: text-2xl through text-4xl. Sub-headings: text-lg through text-xl. Body: text-sm through text-base. Avoid text-xs for body copy — it harms readability.',
    check: 'Check font-size classes on heading and body text elements.',
  },
  {
    id: 'type-weight',
    category: 'typography',
    severity: 'nice-to-have',
    name: 'Font weight discipline',
    description:
      'Headings: font-semibold or font-bold. Body: font-normal or font-medium. Avoid font-black or font-extrabold on body paragraphs.',
    check: 'Check font-weight classes across headings and body text.',
  },

  // ── Spacing ─────────────────────────────────────────────────────────────────
  {
    id: 'spacing-padding',
    category: 'spacing',
    severity: 'recommended',
    name: 'Generous internal padding',
    description:
      'Cards and sections use p-4 through p-8. Avoid p-1 or p-2 on card surfaces — the design should breathe and feel premium.',
    check: 'Check padding classes on card and section container elements.',
  },
  {
    id: 'spacing-gap',
    category: 'spacing',
    severity: 'nice-to-have',
    name: 'Consistent layout gap',
    description:
      'Grid and flex layouts use gap-4 through gap-8 for section-level spacing. gap-1 or gap-2 on top-level section layouts feels cramped.',
    check: 'Check gap classes in section-level grid/flex containers.',
  },

  // ── Components ──────────────────────────────────────────────────────────────
  {
    id: 'component-radius',
    category: 'component',
    severity: 'required',
    name: 'Rounded corners',
    description:
      'Cards: rounded-2xl or rounded-xl. Chips, badges, and pills: rounded-full. Sharp corners (rounded-none or no border-radius) on cards are a violation of the soft, organic feel.',
    check: 'Check border-radius classes on card, chip, and badge elements.',
  },
  {
    id: 'component-button',
    category: 'component',
    severity: 'recommended',
    name: 'Button style',
    description:
      'Primary buttons use brand primary/accent as background with white text, and rounded-xl or rounded-full. Flat grey or unstyled buttons without brand colours are a violation.',
    check: 'Check button elements for brand-aligned background, text colour, and border-radius.',
  },
  {
    id: 'component-hover',
    category: 'component',
    severity: 'recommended',
    name: 'Hover and transition states',
    description:
      'Interactive elements (buttons, cards, links) must have hover: Tailwind classes or CSS transitions. Missing hover states makes the UI feel static and unresponsive.',
    check: 'Look for hover: modifier classes or transition-* classes on interactive elements.',
  },
  {
    id: 'component-shadow',
    category: 'component',
    severity: 'nice-to-have',
    name: 'Subtle depth shadows',
    description:
      'Floating elements and cards use shadow-sm through shadow-xl, ideally with low-opacity rgba. Heavy drop-shadows or no shadow at all on floating panels both feel wrong.',
    check: 'Check shadow classes on floating and card elements.',
  },

  // ── Accessibility ────────────────────────────────────────────────────────────
  {
    id: 'a11y-contrast',
    category: 'accessibility',
    severity: 'required',
    name: 'Sufficient text contrast',
    description:
      'Text on light backgrounds must maintain WCAG AA contrast. Very light grays (text-gray-300 and lighter) on white/light-green backgrounds fail contrast requirements.',
    check: 'Look for very light text-color classes on light backgrounds.',
  },
  {
    id: 'a11y-focus',
    category: 'accessibility',
    severity: 'recommended',
    name: 'Focus ring indicators',
    description:
      'Buttons, inputs, and links should have focus:ring or focus-visible:ring classes so keyboard users can see the focused element.',
    check: 'Check for focus: or focus-visible: ring classes on interactive elements.',
  },

  // ── Anti-patterns ────────────────────────────────────────────────────────────
  {
    id: 'anti-hardcoded-hex',
    category: 'anti-pattern',
    severity: 'required',
    name: 'No hardcoded hex colours',
    description:
      'Do not hardcode hex colours in className arbitrary values (e.g. bg-[#ff0000]) or style={{ color: "#..." }} when brand tokens exist. Import and use brand.* from @/app/ui/theme instead.',
    check: 'Look for hex colour literals in style={{ }} props or Tailwind arbitrary-value classes that match non-brand colours.',
  },
  {
    id: 'anti-flat-cards',
    category: 'anti-pattern',
    severity: 'recommended',
    name: 'No flat opaque cards',
    description:
      'Cards with bg-white or bg-gray-* without any glass treatment (backdrop-blur, opacity modifier, shadow) undermine the design language. Every card surface should participate in the glass system.',
    check: 'Find divs/sections with bg-white or bg-gray-* that lack backdrop-blur and shadow — these are likely regressions from the glass system.',
  },
  {
    id: 'anti-inline-styles',
    category: 'anti-pattern',
    severity: 'nice-to-have',
    name: 'Prefer Tailwind over inline styles',
    description:
      'Presentational styling should use Tailwind className rather than style={{ }}. Inline styles for layout, colour, or spacing are harder to maintain and skip the design token system.',
    check: 'Count style={{ }} props that could be replaced with Tailwind classes.',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

export function constitutionToPrompt(): string {
  const categoryLabel: Record<ConstitutionRuleCategory, string> = {
    color: 'Colour',
    glass: 'Glass Morphism',
    typography: 'Typography',
    spacing: 'Spacing',
    component: 'Components',
    accessibility: 'Accessibility',
    'anti-pattern': 'Anti-patterns',
  };

  const byCategory = new Map<ConstitutionRuleCategory, ConstitutionRule[]>();
  for (const rule of DESIGN_CONSTITUTION) {
    const existing = byCategory.get(rule.category) ?? [];
    existing.push(rule);
    byCategory.set(rule.category, existing);
  }

  const sections: string[] = [
    '# Buds At Work Design Constitution',
    '',
    '## Brand Identity',
    'Buds At Work is a local garden and home-services business in Brisbane / Logan, Australia.',
    'Design language: clean, airy, natural, professional.',
    'Primary colour: #0F3D2E (deep forest green). Action accent: #1C7C54.',
    'Background: #F6FBF7 (very light green-tinted white). Text: #12261E.',
    'Pattern: glass morphism — light semi-transparent card surfaces, backdrop blur, subtle shadows.',
    '',
  ];

  for (const [cat, rules] of byCategory) {
    sections.push(`## ${categoryLabel[cat]}`);
    for (const rule of rules) {
      const badge =
        rule.severity === 'required'
          ? '⛔ REQUIRED'
          : rule.severity === 'recommended'
            ? '⚠️ RECOMMENDED'
            : '💡 NICE-TO-HAVE';
      sections.push(`[${badge}] **${rule.name}** (id: ${rule.id})`);
      sections.push(`  ${rule.description}`);
      sections.push(`  → Check: ${rule.check}`);
      sections.push('');
    }
  }

  return sections.join('\n');
}

// Returns true for file paths that can affect visual output and should be scored.
export function isUiFile(path: string): boolean {
  if (!path) return false;
  const lower = path.toLowerCase();
  // Exclude server-only files that never render HTML
  if (lower.includes('/api/')) return false;
  if (lower.endsWith('.test.ts') || lower.endsWith('.test.tsx') || lower.endsWith('.spec.ts') || lower.endsWith('.spec.tsx')) return false;
  return (
    lower.endsWith('.tsx') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.css') ||
    lower.endsWith('.module.css')
  );
}

// Score weights by severity — used in the visual scorer for consistent arithmetic.
export const VIOLATION_WEIGHTS: Record<ConstitutionRuleSeverity, number> = {
  required: 0.25,
  recommended: 0.08,
  'nice-to-have': 0.03,
};

export const TASTE_PASS_THRESHOLD = 0.70;
