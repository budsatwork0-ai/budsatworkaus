/**
 * Theme interface — Buds At Work
 *
 * Every context (dashboard, crew, public) implements this shape.
 * Values may differ per context. Changing one context's theme file
 * never affects the others.
 *
 * Usage:
 *   import { dashboardTheme } from '@/lib/design-system/themes';
 *   const t = dashboardTheme;
 *   style={{ color: t.color.primary }}
 */

export interface ThemeColor {
  // ── Brand ────────────────────────────────────────────────────────────────
  /** Deep green — headings, big numbers, primary nav text. Never button bg. */
  primary: string;
  /** Action green — CTA button backgrounds, active states, deltas. */
  accent: string;
  /** Soft accent fill — pill backgrounds, hover fills. */
  accentSoft: string;
  /** Warm gold — used sparingly for emphasis only. */
  secondary: string;
  /** Soft gold fill — pill/badge backgrounds for secondary tone. */
  secondarySoft: string;

  // ── Surfaces ─────────────────────────────────────────────────────────────
  /** Page background (solid colour — use Theme.pageBg for gradient contexts). */
  bg: string;
  /** Card / panel white surface. */
  card: string;
  /** Lightly tinted surface — alternating rows, inner panels. */
  surface: string;
  /** Slightly deeper tint — alt panel backgrounds. */
  surfaceAlt: string;
  /** Default border colour. */
  border: string;

  // ── Text ─────────────────────────────────────────────────────────────────
  /** Primary body text. */
  text: string;
  /** Secondary text — labels, meta, supporting copy. */
  muted: string;
  /** Keyboard focus ring colour. */
  focus: string;

  // ── Semantic ─────────────────────────────────────────────────────────────
  success: string;
  warning: string;
  error: string;
  info: string;

  // ── On-dark (reversed) ───────────────────────────────────────────────────
  /** Primary text on dark/primary-coloured backgrounds. */
  onDark: string;
  /** Secondary text on dark backgrounds. */
  mutedOnDark: string;
  /** Tertiary / placeholder text on dark backgrounds. */
  subtleOnDark: string;
}

export interface ThemeTypeStep {
  size: string;
  weight: number;
  leading: string;
}

export interface ThemeType {
  /** Page-level h1 — largest heading, used once per page. */
  pageTitle: ThemeTypeStep;
  /** Section h2 — panel and tab headings. */
  sectionHeading: ThemeTypeStep;
  /** Card h3 — inline card and widget headings. */
  cardTitle: ThemeTypeStep;
  /** Standard body copy. */
  body: ThemeTypeStep;
  /** Supporting meta — timestamps, counts, helper labels. */
  meta: ThemeTypeStep;
}

export interface ThemeRadius {
  /** 1st stop — chips, tags, input borders. */
  sm: string;
  /** 2nd stop — buttons, table rows, tight cards. */
  md: string;
  /** 3rd stop — standard cards and panels. */
  lg: string;
  /** 4th stop — feature panels, hero cards. */
  xl: string;
}

export interface ThemeShadow {
  /** Resting card elevation. */
  card: string;
  /** Lifted / hover elevation. */
  hover: string;
  /** Modal / drawer elevation. */
  modal: string;
}

export interface ThemeNav {
  /** Navigation bar background — may include rgba/blur for frosted effect. */
  bg: string;
  /** Navigation bar bottom border. */
  border: string;
  /** Active nav item text colour. */
  activeText: string;
  /** Active nav item background. */
  activeBg: string;
  /** Inactive nav item text colour. */
  inactiveText: string;
}

export interface Theme {
  /** Human-readable context label shown in the Design System viewer. */
  name: string;
  /** Machine context key — used to scope the viewer and future CSS vars. */
  context: 'dashboard' | 'crew' | 'public';
  /**
   * Full CSS value for the page background.
   * May be a radial gradient (crew), solid colour (dashboard),
   * or white (public). Use directly in style={{ background: t.pageBg }}.
   */
  pageBg: string;
  /**
   * Glass morphism token — full Tailwind class string.
   * Always use as className={t.glass}. Never spread as style object.
   */
  glass: string;
  /**
   * Softer glass variant — Tailwind class string.
   * Always use as className={t.glassSoft}. Never spread as style object.
   */
  glassSoft: string;
  /** Navigation bar styling for this context's layout. */
  nav: ThemeNav;
  color: ThemeColor;
  type: ThemeType;
  radius: ThemeRadius;
  shadow: ThemeShadow;
}
