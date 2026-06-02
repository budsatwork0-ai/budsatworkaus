/**
 * Public Site theme — Buds At Work
 *
 * Edit this file to change the design of the public/marketing site ONLY.
 * Changes here do not affect the admin dashboard or crew portal.
 *
 * Import: import { publicTheme } from '@/lib/design-system/themes';
 *
 * Note: the public site uses dark hero sections. The `onDark`, `mutedOnDark`,
 * and `subtleOnDark` colour tokens are especially important here — they control
 * all text rendered on the dark green brand.primary background.
 */

import type { Theme } from './_theme';

export const publicTheme: Theme = {
  name: 'Public Site',
  context: 'public',

  // White base — dark hero sections are built using color.primary as bg.
  pageBg: '#FFFFFF',

  // Glass — used in the quote wizard step cards.
  glass:     'bg-white/80 backdrop-blur-2xl border border-black/10 shadow-[0_10px_30px_rgba(2,6,23,0.08)]',
  glassSoft: 'bg-white/70 backdrop-blur-2xl border border-black/10 shadow-[0_6px_20px_rgba(2,6,23,0.06)]',

  // Transparent nav that gains opacity on scroll (handled in layout).
  nav: {
    bg:           'rgba(255,255,255,0.92)',
    border:       'rgba(0,0,0,0.07)',
    activeText:   '#0F3D2E',
    activeBg:     'rgba(15,61,46,0.07)',
    inactiveText: '#4C6157',
  },

  color: {
    // Brand — independently editable from dashboard and crew.
    primary:       '#0F3D2E',
    accent:        '#1C7C54',
    accentSoft:    '#DDF3E4',
    secondary:     '#C8932B',
    secondarySoft: '#F6EBD2',
    // Surfaces — clean white for marketing context.
    bg:            '#FFFFFF',
    card:          '#FFFFFF',
    surface:       '#F6FBF7',
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
    // On-dark — critical for hero sections and dark CTAs.
    onDark:        '#F8FCF9',
    mutedOnDark:   'rgba(248,252,249,0.82)',
    subtleOnDark:  'rgba(248,252,249,0.62)',
  },

  // Marketing scale — bolder and larger than the operational contexts.
  type: {
    pageTitle:      { size: '38px', weight: 700, leading: '1.1'  },
    sectionHeading: { size: '28px', weight: 700, leading: '1.2'  },
    cardTitle:      { size: '18px', weight: 600, leading: '1.3'  },
    body:           { size: '16px', weight: 400, leading: '1.6'  },
    meta:           { size: '13px', weight: 400, leading: '1.5'  },
  },

  // Softer, rounder — consumer-facing tiles feel more inviting.
  radius: {
    sm: '10px',
    md: '14px',
    lg: '20px',
    xl: '30px',
  },

  shadow: {
    card:  '0 6px 20px rgba(2,6,23,0.06)',
    hover: '0 14px 36px rgba(15,61,46,0.11)',
    modal: '0 24px 60px rgba(2,6,23,0.18)',
  },
};
