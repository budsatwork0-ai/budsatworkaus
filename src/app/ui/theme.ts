// theme.ts
export type Brand = {
  bg: string;
  card: string;
  border: string;
  primary: string;
  accent: string;
  accentSoft: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  muted: string;
  focus: string;
};

export const brand: Brand = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  border: '#D7E7DD',
  primary: '#0F3D2E',   // deep green
  accent: '#1C7C54',    // action green with accessible contrast on white
  accentSoft: '#DDF3E4',
  surface: '#F1F7F3',
  surfaceAlt: '#EAF6EE',
  text: '#12261E',
  muted: '#4C6157',
  focus: '#8BC8A8',
};

// Handy exports for components (optional to use)
export const ACCENT = brand.primary;

// Glass tokens tuned for readability on a light background.
// These match the tokens used in ServicesPage.
export const glass = [
  'bg-white/80',
  'backdrop-blur-2xl',
  'border',
  'border-black/10',
  'shadow-[0_10px_30px_rgba(2,6,23,0.08)]',
].join(' ');

export const glassSoft = [
  'bg-white/70',
  'backdrop-blur-2xl',
  'border',
  'border-black/10',
  'shadow-[0_6px_20px_rgba(2,6,23,0.06)]',
].join(' ');

// Slightly opinionated UI tokens; use if you like.
// (Not required by ServicesPage but handy elsewhere.)
export const ui = {
  radius: {
    card: 'rounded-2xl',
    chip: 'rounded-full',
  },
  text: {
    default: 'text-slate-900',
    muted: 'text-slate-600',
    subtle: 'text-slate-700',
    onAccent: 'text-white',
  },
  motion: {
    hover: { scale: 1.01 },
    tap: { scale: 0.99 },
  },
};

// Tiny utility (optional)
export const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

// -----------------------------------------------------------------------------
// Bud Leads — dark cinematic palette
// Scoped to the /dashboard/insights "leads" tab only. Reuses brand.accent
// (#1C7C54) as the action green so cross-app CTA consistency holds.
// All values are strings to match the glass/glassSoft contract.
// -----------------------------------------------------------------------------
export type Night = {
  bg: string;          // deepest page background
  panel: string;       // raised card surface
  panelAlt: string;    // tinted card surface
  border: string;      // hairline border for separation on dark
  divider: string;     // 1px row divider
  text: string;        // primary copy on dark
  muted: string;       // secondary copy on dark
  subtle: string;      // tertiary copy / placeholders
  accent: string;      // brand.accent re-export
  hot: string;         // HOT lead red/orange
  warm: string;        // WARM lead amber
  cold: string;        // COLD lead blue
  lost: string;        // LOST lead grey
};

export const night: Night = {
  bg: '#07100C',
  panel: '#0E1B16',
  panelAlt: '#11241D',
  border: 'rgba(255,255,255,0.06)',
  divider: 'rgba(255,255,255,0.05)',
  text: '#E9F1EC',
  muted: '#9FB4A8',
  subtle: '#6B7F75',
  accent: brand.accent,
  hot: '#FF5A45',
  warm: '#F5B945',
  cold: '#4FA5FF',
  lost: '#6B7F75',
};

// String tokens (Tailwind class lists joined with spaces) — match the glass
// contract. Always use as className={nightPanel} or template-literal compose.
export const nightSurface = [
  'bg-[#07100C]',
  'text-[#E9F1EC]',
].join(' ');

export const nightCard = [
  'rounded-[20px]',
  'border',
  'border-white/[0.06]',
  'bg-[#0E1B16]',
  'shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)]',
].join(' ');

export const nightPanel = [
  'rounded-2xl',
  'border',
  'border-white/[0.06]',
  'bg-[#0E1B16]',
  'shadow-[0_18px_40px_-24px_rgba(0,0,0,0.7)]',
].join(' ');

export const nightPanelAlt = [
  'rounded-2xl',
  'border',
  'border-white/[0.05]',
  'bg-[#11241D]/70',
  'backdrop-blur-sm',
].join(' ');

export const nightChip = [
  'inline-flex',
  'items-center',
  'gap-1.5',
  'rounded-full',
  'border',
  'border-white/10',
  'bg-white/[0.04]',
  'px-2.5',
  'py-1',
  'text-[11px]',
  'font-medium',
  'text-[#9FB4A8]',
].join(' ');

export const nightDivider = 'border-t border-white/[0.05]';

// Temperature -> tone mapping for Lead badges and pulse rings.
export const tempTone: Record<'HOT' | 'WARM' | 'COLD' | 'LOST', {
  text: string;
  bg: string;
  ring: string;
  glow: string;
}> = {
  HOT:  { text: '#FF8A78', bg: 'rgba(255,90,69,0.12)',  ring: 'rgba(255,90,69,0.45)',  glow: '0 0 0 0 rgba(255,90,69,0.55)' },
  WARM: { text: '#FFD089', bg: 'rgba(245,185,69,0.12)', ring: 'rgba(245,185,69,0.35)', glow: '0 0 0 0 rgba(245,185,69,0.45)' },
  COLD: { text: '#9FC6FF', bg: 'rgba(79,165,255,0.10)', ring: 'rgba(79,165,255,0.30)', glow: 'none' },
  LOST: { text: '#9FB4A8', bg: 'rgba(255,255,255,0.04)', ring: 'rgba(255,255,255,0.10)', glow: 'none' },
};

// -----------------------------------------------------------------------------
// Core 2.0 design system — single source of truth for the admin workspace look.
// Calm, white, rounded, friendly. Colour used lightly; semantic colours only
// carry meaning, never decoration. See: Buds At Work/00 System Core/Design System/
// Core 2.0 Design System.md
// -----------------------------------------------------------------------------
export const core2 = {
  color: {
    primary: '#0F3D2E',        // deep Buds green — headings, primary buttons, big numbers
    accent: '#1C7C54',         // muted action green — active states, deltas, highlights
    accentSoft: '#E3F1EA',     // soft green fill — pills, hovers
    secondary: '#C8932B',      // warm mustard/gold — used sparingly for emphasis
    secondarySoft: '#F6EBD2',  // soft gold fill
    bg: '#FAF7F0',             // soft cream / off-white page background
    surface: '#FFFFFF',        // white card surface
    border: 'rgba(15,61,46,0.08)',
    text: '#16201B',           // near-black main text
    textSecondary: '#5C6B62',  // medium grey
    textMuted: '#8A978F',      // soft grey (meta, placeholders)
    success: '#1C7C54',
    warning: '#B8860B',
    error: '#D9534F',
    info: '#5B7A8C',           // blue-grey
  },
  // Radii scale: chips/inputs → buttons/rows → cards → feature panels.
  radius: { sm: '10px', md: '14px', lg: '20px', xl: '26px' },
  // Very soft elevation only — no harsh dark shadows.
  shadow: {
    card: '0 8px 26px rgba(2,6,23,0.05)',
    hover: '0 12px 32px rgba(2,6,23,0.08)',
    modal: '0 24px 60px rgba(2,6,23,0.18)',
  },
  // Type scale (px / weight / line-height). Sentence case, never all caps.
  type: {
    pageTitle:      { size: '30px', weight: 600, leading: '1.2' },
    sectionHeading: { size: '20px', weight: 600, leading: '1.3' },
    cardTitle:      { size: '16px', weight: 600, leading: '1.35' },
    body:           { size: '15px', weight: 400, leading: '1.55' },
    meta:           { size: '12.5px', weight: 400, leading: '1.5' },
  },
} as const;
