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

  // Flat soft-green page background — no gradient.
  pageBg: '#F6FBF7',

  // Glass tokens — Tailwind class strings. Use as className={t.glass}.
  glass:     'bg-white/80 backdrop-blur-2xl border border-black/10 shadow-[0_10px_30px_rgba(2,6,23,0.08)]',
  glassSoft: 'bg-white/70 backdrop-blur-2xl border border-black/10 shadow-[0_6px_20px_rgba(2,6,23,0.06)]',

  nav: {
    bg:           'rgba(246,251,247,0.92)',
    border:       'rgba(0,0,0,0.06)',
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
};
