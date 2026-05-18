/**
 * Design token library — Buds At Work
 *
 * Single source of truth that extends src/app/ui/theme.ts with an exhaustive
 * named constant set. Consumed by:
 *   · Components (via direct import)
 *   · Design System Agent (embedded as audit context)
 *   · Obsidian vault documentation (written by the agent on first run)
 *
 * Rule: every value that appears in more than one component file MUST be
 * represented as a named export here. Inline literals in components are a
 * design drift signal.
 */

// ── Re-export brand tokens from theme ────────────────────────────────────────

export { brand, glass, glassSoft, ui, cx, type Brand } from '@/app/ui/theme';

// ── Color palette ─────────────────────────────────────────────────────────────

export const COLOR = {
  // Base
  bg:          '#F6FBF7',   // --bg         page background
  card:        '#FFFFFF',   // --card        card surface
  border:      '#D7E7DD',   // --border      default border
  // Brand
  primary:     '#0F3D2E',   // --primary     deep green — headings, nav, branding
  accent:      '#1C7C54',   // --accent      action green — CTAs, prices, active states
  accentSoft:  '#DDF3E4',   // --accent-soft soft accent fill
  // Surfaces
  surface:     '#F1F7F3',   // --surface     light tinted surface
  surfaceAlt:  '#EAF6EE',   // --surface-alt slightly deeper tint
  // Text
  text:        '#12261E',   // --text        primary body text
  muted:       '#4C6157',   // --muted       secondary text
  focus:       '#8BC8A8',   // --focus       keyboard focus ring
  // On-dark
  onDark:      '#F8FCF9',
  mutedOnDark: 'rgba(248,252,249,0.82)',
  subtleOnDark:'rgba(248,252,249,0.62)',
  // Semantic
  red:    { bg: '#FEF2F2', fg: '#B91C1C' },
  amber:  { bg: '#FFFBEB', fg: '#B45309' },
  blue:   { bg: '#EFF6FF', fg: '#1D4ED8' },
  emerald:{ bg: '#ECFDF5', fg: '#047857' },
  star:            '#F59E0B',
} as const;

// ── Typography ────────────────────────────────────────────────────────────────

export const TYPE = {
  // Font families
  sans:    'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, Helvetica, sans-serif',
  mono:    'var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, monospace',

  // Size scale (fluid for h-hero, h-cta, h-section)
  sizeHero:    'clamp(3rem, 8vw, 5.75rem)',   // --h-hero
  sizeCta:     'clamp(2.2rem, 5vw, 3.75rem)', // --h-cta
  sizeSection: 'clamp(1.7rem, 3.8vw, 2.5rem)',// --h-section
  sizePage:    '2.25rem',                      // --h-page  (36px)
  sizeCard:    '1.05rem',                      // --h-card  (~17px)
  sizeBase:    '15px',                         // --text-base
  sizeSm:      '13.5px',                       // --text-sm
  sizeXs:      '12px',                         // --text-xs
  sizeEyebrow: '11px',                         // --text-eyebrow

  // Inline pixel sizes (use sparingly; prefer the scale above)
  size10: '10px',
  size11: '11px',
  size12: '12px',
  size13: '13px',
  size14: '14px',
  size15: '15px',

  // Letter spacing
  lsEyebrow: '0.14em',
  lsHero:    '-0.02em',
  lsTight:   '-0.01em',
  lsNormal:  '0em',

  // Line heights
  lhHero:    1.04,
  lhTight:   1.1,
  lhBody:    1.5,
  lhRelaxed: 1.6,

  // Font weights
  w400: 400,
  w500: 500,
  w600: 600,
  w700: 700,

  // Utility CSS classes (from globals.css)
  class: {
    h1:      'bw-h1',      // hero heading
    h2:      'bw-h2',      // section heading
    h3:      'bw-h3',      // card heading
    eyebrow: 'bw-eyebrow', // label/category text above headings
    p:       'bw-p',       // body paragraph
    muted:   'bw-muted',   // secondary text
    meta:    'bw-meta',    // timestamp / small label
    code:    'bw-code',    // inline code
  },
} as const;

// ── Spacing scale ─────────────────────────────────────────────────────────────
// Mirrors Tailwind default but explicitly named for design intent.

export const SPACE = {
  px1:  '1px',
  s1:   '4px',    // --space-1  (Tailwind: 1)
  s2:   '8px',    // --space-2  (Tailwind: 2)
  s3:   '12px',   // --space-3  (Tailwind: 3)
  s4:   '16px',   // --space-4  (Tailwind: 4)
  s5:   '20px',   // --space-5  (Tailwind: 5)
  s6:   '24px',   // --space-6  (Tailwind: 6)
  s8:   '32px',   // --space-8  (Tailwind: 8)
  s10:  '40px',   // --space-10 (Tailwind: 10)
  s12:  '48px',   // --space-12 (Tailwind: 12)
  s16:  '64px',   // --space-16 (Tailwind: 16)
  s20:  '80px',   // --space-20 (Tailwind: 20)
  s24:  '96px',   // --space-24 (Tailwind: 24)
} as const;

// ── Border radius ─────────────────────────────────────────────────────────────

export const RADIUS = {
  sm:   '8px',      // --radius-sm   rounded-lg (badges, inputs, chips)
  md:   '12px',     // --radius-md   rounded-xl (inner cards, small surfaces)
  lg:   '16px',     // --radius-lg   rounded-2xl (standard cards)
  xl:   '20px',     // --radius-xl   rounded-[20px] (large cards — use sparingly)
  xxl:  '24px',     // --radius-2xl  rounded-3xl (tiles)
  tile: '30px',     // rounded-[30px] (feature service tiles — per design spec)
  pill: '9999px',   // --radius-pill rounded-full (chips, badges, buttons)

  // Tailwind class names for direct use
  class: {
    badge: 'rounded-lg',       // 8px — small status badges, input borders
    chip:  'rounded-full',     // 9999px — inline chips, frequency tags
    input: 'rounded-xl',       // 12px — form inputs
    card:  'rounded-2xl',      // 16px — standard glass cards
    tile:  'rounded-3xl',      // 24px — service selection tiles
    feature: 'rounded-[30px]', // 30px — feature/hero service tiles
  },
} as const;

// ── Shadow scale ──────────────────────────────────────────────────────────────

export const SHADOW = {
  chip:      '0 4px 14px rgba(15,61,46,0.20)',   // --shadow-chip
  card:      '0 6px 20px rgba(2,6,23,0.06)',      // --shadow-card
  cardLg:    '0 10px 30px rgba(2,6,23,0.08)',     // --shadow-card-lg
  hover:     '0 14px 36px rgba(15,61,46,0.11)',   // --shadow-hover
  stat:      '0 16px 44px rgba(15,61,46,0.22)',   // --shadow-stat
  dashboard: '0 12px 30px rgba(15,23,42,0.06)',   // --shadow-dashboard
  // Active/focused tile
  tile:      '0 4px 20px rgba(15,61,46,0.12)',
  // Tailwind arbitrary shadow classes for Tailwind v4 usage
  class: {
    card:      'shadow-[0_6px_20px_rgba(2,6,23,0.06)]',
    cardLg:    'shadow-[0_10px_30px_rgba(2,6,23,0.08)]',
    hover:     'shadow-[0_14px_36px_rgba(15,61,46,0.11)]',
    tile:      'shadow-[0_4px_20px_rgba(15,61,46,0.12)]',
    dashboard: 'shadow-[0_12px_30px_rgba(15,23,42,0.06)]',
    glass:     'shadow-[0_10px_30px_rgba(2,6,23,0.08)]',
  },
} as const;

// ── Glass morphism variants ───────────────────────────────────────────────────
// Three clearly-scoped variants. Components MUST use one of these — never
// construct custom glass from scratch.

export const GLASS_VARIANTS = {
  /**
   * Full — primary surfaces (quote wizard cards, admin panels, modals)
   * CSS class: .bw-glass
   * Tailwind: bg-white/80 backdrop-blur-2xl border border-black/10 shadow-[0_10px_30px_rgba(2,6,23,0.08)]
   */
  full: 'bg-white/80 backdrop-blur-2xl border border-black/10 shadow-[0_10px_30px_rgba(2,6,23,0.08)]',

  /**
   * Soft — secondary surfaces (nested cards, summary rows, review panels)
   * CSS class: .bw-glass-soft
   * Tailwind: bg-white/70 backdrop-blur-2xl border border-black/10 shadow-[0_6px_20px_rgba(2,6,23,0.06)]
   */
  soft: 'bg-white/70 backdrop-blur-2xl border border-black/10 shadow-[0_6px_20px_rgba(2,6,23,0.06)]',

  /**
   * Step3 — checkout step sidebar cards (slightly more opaque, tighter padding)
   * Use S3_Card component. bg-white/80 border-black/10 — NO backdrop-blur (performance on step 3)
   */
  step3: 'border border-black/10 bg-white/80',

  /**
   * KPI — data display tiles inside glass cards
   * NOT a full glass card — just white 70% with subtle border
   * bg-white/70 border-white/50
   */
  kpi: 'border border-white/50 bg-white/70',
} as const;

// ── Motion ────────────────────────────────────────────────────────────────────

export const MOTION = {
  easeOutQuart: 'cubic-bezier(0.22, 1, 0.36, 1)',
  ease:         'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  // Duration (ms)
  fast:    150,
  med:     250,
  slow:    500,
  // Framer Motion standard values
  hover: { scale: 1.01 },
  tap:   { scale: 0.99 },
  // Tile/card transitions (inline style — not Tailwind, matches 180ms spec)
  tileTransition: 'box-shadow 180ms cubic-bezier(0.25,0.46,0.45,0.94), border-color 180ms cubic-bezier(0.25,0.46,0.45,0.94), background 180ms cubic-bezier(0.25,0.46,0.45,0.94)',
} as const;

// ── Responsive breakpoints ────────────────────────────────────────────────────

export const BREAKPOINT = {
  // Pixel values
  xs:   375,
  sm:   390,
  md:   414,
  tab:  768,
  lg:  1024,
  xl:  1280,
  xxl: 1440,
  // Tailwind prefix strings
  prefix: {
    sm:  'sm:',   // 640px
    md:  'md:',   // 768px
    lg:  'lg:',   // 1024px
    xl:  'xl:',   // 1280px
    xxl: '2xl:',  // 1536px
  },
} as const;

// ── Icon standards ────────────────────────────────────────────────────────────

export const ICON = {
  // SVG viewBox and stroke props that ALL inline icons must use
  strokeWidth: 1.75,        // non-negotiable — thinner icons look weak, thicker look heavy
  strokeLinecap:  'round',
  strokeLinejoin: 'round',
  fill: 'none',
  // Common sizes
  size: {
    xs: 14,
    sm: 16,
    md: 20,   // default
    lg: 24,
    xl: 28,
  },
} as const;

// ── CTA button patterns ───────────────────────────────────────────────────────

export const CTA = {
  // Primary button — full accent background
  primary: {
    base: 'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all',
    colors: 'bg-[var(--accent)] text-white',
    hover:  'hover:opacity-90 hover:shadow-[0_6px_20px_rgba(28,124,84,0.32)]',
    focus:  'focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2',
    height: { sm: 'h-9 px-4 text-sm', md: 'h-11 px-6 text-[15px]', lg: 'h-13 px-8 text-base' },
  },
  // Secondary button — border only
  secondary: {
    base: 'inline-flex items-center justify-center gap-2 font-semibold rounded-full border transition-all',
    colors: 'border-[var(--accent)] text-[var(--accent)] bg-transparent',
    hover:  'hover:bg-[var(--accent-soft)]',
    focus:  'focus-visible:outline-2 focus-visible:outline-[var(--focus)] focus-visible:outline-offset-2',
  },
  // Ghost button — for less prominent actions
  ghost: {
    base: 'inline-flex items-center justify-center gap-1.5 font-medium rounded-full transition-all',
    colors: 'text-[var(--accent)] bg-transparent',
    hover:  'hover:bg-[var(--accent-soft)]',
  },
  // Min touch target (WCAG)
  minTouchPx: 44,
} as const;

// ── Sticky footer ─────────────────────────────────────────────────────────────

export const STICKY_FOOTER = {
  // Required CSS for notched devices
  safeAreaBottom: 'env(safe-area-inset-bottom)',
  // Required z-index tier
  zIndex: 50,
  // Tailwind classes for correct sticky bar implementation
  classes: 'fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]',
  // Glass variant to use
  glassVariant: 'full',
} as const;

// ── Duplication register ──────────────────────────────────────────────────────
// Known component duplicates that the Design System Agent must track.
// When these are consolidated, remove the entry.

export const KNOWN_DUPLICATES = [
  {
    id: 'glass-card-variants',
    description: 'Five ways to create a glass card exist. Must consolidate to 3 explicit variants.',
    instances: [
      { component: 'glassCard()', file: 'src/app/(public)/services/components/shared/UIComponents.tsx', variant: 'bg-white/75' },
      { component: 'GlassCard', file: 'src/app/(public)/services/components/shared/GlassUI.tsx', variant: 'bg-white/60' },
      { component: 'S3_Card', file: 'src/app/(public)/services/components/shared/GlassUI.tsx', variant: 'bg-white/80 (no blur)' },
      { component: 'bw-glass (CSS)', file: 'src/app/globals.css', variant: 'bg-white/80' },
      { component: 'bw-glass-soft (CSS)', file: 'src/app/globals.css', variant: 'bg-white/70' },
    ],
    resolution: 'Use GLASS_VARIANTS exports. Components should import from @/lib/design-system/tokens.',
    status: 'open',
  },
  {
    id: 'key-value-row-variants',
    description: 'Two near-identical key-value row components.',
    instances: [
      { component: 'Row', file: 'src/app/(public)/services/components/shared/GlassUI.tsx' },
      { component: 'S3_Row', file: 'src/app/(public)/services/components/shared/GlassUI.tsx' },
    ],
    resolution: 'Merge into single Row with optional variant prop.',
    status: 'open',
  },
  {
    id: 'chip-variants',
    description: 'Two near-identical inline chip components.',
    instances: [
      { component: 'Chip', file: 'src/app/(public)/services/components/shared/GlassUI.tsx' },
      { component: 'S3_Chip', file: 'src/app/(public)/services/components/shared/GlassUI.tsx' },
    ],
    resolution: 'Merge into single Chip with optional density prop.',
    status: 'open',
  },
  {
    id: 'class-concat-utilities',
    description: 'Multiple className concatenation utilities across codebase.',
    instances: [
      { component: 'cls()', file: 'src/app/(public)/services/utils/formatting.ts' },
      { component: 'cx()', file: 'src/app/ui/theme.ts' },
    ],
    resolution: 'Use cx() from @/app/ui/theme universally. Remove cls().',
    status: 'open',
  },
] as const;

// ── Apple simplicity principles ───────────────────────────────────────────────
// Design philosophy rules enforced by the Design System Agent.

export const SIMPLICITY_RULES = [
  'One primary CTA per page section — never two equal-weight calls to action.',
  'Maximum three visual layers: page background → card surface → content.',
  'No glass-within-glass: never nest a glass card inside another glass card.',
  'Icon stroke weight must be 1.75 uniformly — thicker = heavy, thinner = weak.',
  'White space is a feature: prefer generous padding over information density.',
  'Colour hierarchy: primary (text) → accent (action) → muted (meta) — never reverse.',
  'Typography: h1/h2/h3 use the .bw-h* classes or CSS vars — no inline font-size on headings.',
  'Buttons: always rounded-full — pill shape enforces Apple-style softness.',
  'Animations: use the standard motion values (hover: scale 1.01, tap: scale 0.99) — no custom springs.',
  'Border radius: cards=rounded-2xl, tiles=rounded-3xl, feature-tiles=rounded-[30px], everything else rounded-xl.',
] as const;
