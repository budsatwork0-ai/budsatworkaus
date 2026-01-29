// theme.ts
export type Brand = {
  bg: string;
  card: string;
  border: string;
  primary: string; // Accent used for filled buttons & highlights
  text: string;
  muted: string;
  focus: string;
};

export const brand: Brand = {
  bg: '#F7F7F5',
  card: '#FFFFFF',
  border: '#E5E7EB',
  primary: '#0F3D2E',   // deep green accent (kept as-is)
  text: '#111827',      // slate-900-ish
  muted: '#475569',     // slate-600-ish
  focus: '#7DD3FC',     // subtle focus ring / glow
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
