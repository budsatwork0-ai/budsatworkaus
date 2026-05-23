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
  bg: '#F6FBF7',
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
