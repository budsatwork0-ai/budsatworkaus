/**
 * Crew Portal theme — Buds At Work
 *
 * Edit this file to change the design of the crew portal ONLY.
 * Changes here do not affect the admin dashboard or public site.
 *
 * Import: import { crewTheme } from '@/lib/design-system/themes';
 */

import type { Theme } from './_theme';

export const crewTheme: Theme = {
  name: 'Crew Portal',
  context: 'crew',

  // Radial gradient — gives the crew hub its warmer, friendlier feel.
  pageBg: [
    'radial-gradient(1200px 600px at 20% -10%, #dff3ea 0%, transparent 60%),',
    'radial-gradient(900px 500px at 120% 10%, #e8efe7 0%, transparent 50%),',
    '#f6f8f7',
  ].join(' '),

  // Frosted glass — crew portal uses blur more heavily than the dashboard.
  glass:     'bg-white/85 backdrop-blur-2xl border border-black/8 shadow-[0_8px_24px_rgba(2,6,23,0.07)]',
  glassSoft: 'bg-white/75 backdrop-blur-xl border border-black/6 shadow-[0_4px_16px_rgba(2,6,23,0.05)]',

  // Frosted sticky nav — matches the crew layout header.
  nav: {
    bg:           'rgba(255,255,255,0.88)',
    border:       'rgba(0,0,0,0.06)',
    activeText:   '#0F3D2E',
    activeBg:     'rgba(15,61,46,0.08)',
    inactiveText: '#4C6157',
  },

  color: {
    // Brand — same family as dashboard, independently editable.
    primary:       '#0F3D2E',
    accent:        '#1C7C54',
    accentSoft:    '#DDF3E4',
    secondary:     '#C8932B',
    secondarySoft: '#F6EBD2',
    // Surfaces — slightly warmer than dashboard.
    bg:            '#F6F8F7',
    card:          '#FFFFFF',
    surface:       '#F2F6F3',
    surfaceAlt:    '#EAF0EB',
    border:        '#D8E8DE',
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

  // Slightly smaller type scale — crew hub is more mobile-first, denser content.
  type: {
    pageTitle:      { size: '26px', weight: 600, leading: '1.25' },
    sectionHeading: { size: '18px', weight: 600, leading: '1.3'  },
    cardTitle:      { size: '15px', weight: 600, leading: '1.35' },
    body:           { size: '14px', weight: 400, leading: '1.55' },
    meta:           { size: '12px', weight: 400, leading: '1.5'  },
  },

  // Slightly tighter radius than dashboard — more compact feel on mobile.
  radius: {
    sm: '8px',
    md: '12px',
    lg: '18px',
    xl: '22px',
  },

  shadow: {
    card:  '0 6px 20px rgba(2,6,23,0.06)',
    hover: '0 10px 28px rgba(2,6,23,0.09)',
    modal: '0 20px 50px rgba(2,6,23,0.15)',
  },
};
