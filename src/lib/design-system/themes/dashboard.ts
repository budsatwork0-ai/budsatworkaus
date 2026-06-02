/**
 * Admin Dashboard theme — Buds At Work
 *
 * Edit this file to change the design of the admin dashboard ONLY.
 * Changes here do not affect the crew portal or public site.
 *
 * Import: import { dashboardTheme } from '@/lib/design-system/themes';
 */

import type { Theme } from './_theme';

export const dashboardTheme: Theme = {
  name: 'Admin Dashboard',
  context: 'dashboard',

  // Radial gradient — matches the crew portal family but independently editable.
  pageBg: [
    'radial-gradient(1200px 600px at 20% -10%, #dff3ea 0%, transparent 60%),',
    'radial-gradient(900px 500px at 120% 10%, #e8efe7 0%, transparent 50%),',
    '#f6f8f7',
  ].join(' '),

  // Glass tokens — Tailwind class strings. Use as className={t.glass}.
  glass:     'bg-white/80 backdrop-blur-2xl border border-black/10 shadow-[0_10px_30px_rgba(2,6,23,0.08)]',
  glassSoft: 'bg-white/70 backdrop-blur-2xl border border-black/10 shadow-[0_6px_20px_rgba(2,6,23,0.06)]',

  nav: {
    // Sidebar glass — frosted white, softer opacity than the crew top nav.
    bg:           'rgba(255,255,255,0.74)',
    border:       'rgba(215,231,221,0.92)',
    activeText:   '#0F3D2E',
    activeBg:     'rgba(15,61,46,0.08)',
    inactiveText: '#4C6157',
  },

  color: {
    // Brand
    primary:       '#0F3D2E',
    accent:        '#1C7C54',
    accentSoft:    '#DDF3E4',
    secondary:     '#C8932B',
    secondarySoft: '#F6EBD2',
    // Surfaces
    bg:            '#F6FBF7',
    card:          '#FFFFFF',
    surface:       '#F1F7F3',
    surfaceAlt:    '#EAF6EE',
    border:        '#D7E7DD',
    // Text
    text:          '#12261E',
    muted:         '#4C6157',
    focus:         '#8BC8A8',
    // Semantic
    success:       '#1C7C54',
    warning:       '#B8860B',
    error:         '#D9534F',
    info:          '#5B7A8C',
    // On-dark
    onDark:        '#F8FCF9',
    mutedOnDark:   'rgba(248,252,249,0.82)',
    subtleOnDark:  'rgba(248,252,249,0.62)',
  },

  type: {
    pageTitle:      { size: '30px', weight: 600, leading: '1.2'  },
    sectionHeading: { size: '20px', weight: 600, leading: '1.3'  },
    cardTitle:      { size: '16px', weight: 600, leading: '1.35' },
    body:           { size: '15px', weight: 400, leading: '1.55' },
    meta:           { size: '12.5px', weight: 400, leading: '1.5' },
  },

  // Core 2.0 radius scale: chips/inputs → buttons → cards → feature panels.
  radius: {
    sm: '10px',
    md: '14px',
    lg: '20px',
    xl: '26px',
  },

  // Very soft elevation — no harsh dark shadows.
  shadow: {
    card:  '0 8px 26px rgba(2,6,23,0.05)',
    hover: '0 12px 32px rgba(2,6,23,0.08)',
    modal: '0 24px 60px rgba(2,6,23,0.18)',
  },

  // ── Night palette — insights/leads tab dark canvas ─────────────────────
  // Edit these to restyle the leads dark mode without touching any other
  // part of the dashboard.
  night: {
    color: {
      bg:        '#07100C',
      panel:     '#0E1B16',
      panelAlt:  '#11241D',
      border:    'rgba(255,255,255,0.06)',
      divider:   'rgba(255,255,255,0.05)',
      text:      '#E9F1EC',
      muted:     '#9FB4A8',
      subtle:    '#6B7F75',
      accent:    '#1C7C54',
      hot:       '#FF5A45',
      warm:      '#F5B945',
      cold:      '#4FA5FF',
      lost:      '#6B7F75',
    },
    surface:  'bg-[#07100C] text-[#E9F1EC]',
    card:     'rounded-[20px] border border-white/[0.06] bg-[#0E1B16] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)]',
    panel:    'rounded-2xl border border-white/[0.06] bg-[#0E1B16] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.7)]',
    panelAlt: 'rounded-2xl border border-white/[0.05] bg-[#11241D]/70 backdrop-blur-sm',
    chip:     'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-[#9FB4A8]',
    divider:  'border-t border-white/[0.05]',
    tempTone: {
      HOT:  { text: '#FF8A78', bg: 'rgba(255,90,69,0.12)',   ring: 'rgba(255,90,69,0.45)',   glow: '0 0 0 0 rgba(255,90,69,0.55)'  },
      WARM: { text: '#FFD089', bg: 'rgba(245,185,69,0.12)',  ring: 'rgba(245,185,69,0.35)',  glow: '0 0 0 0 rgba(245,185,69,0.45)' },
      COLD: { text: '#9FC6FF', bg: 'rgba(79,165,255,0.10)',  ring: 'rgba(79,165,255,0.30)',  glow: 'none'                          },
      LOST: { text: '#9FB4A8', bg: 'rgba(255,255,255,0.04)', ring: 'rgba(255,255,255,0.10)', glow: 'none'                          },
    },
  },
};
