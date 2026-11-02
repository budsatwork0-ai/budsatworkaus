// Modern home sections below the hero (2 Nov 2026): light stats row, edge-to-edge
// before/after, minimal lists, slim floating quote pill. Set false to restore the old sections.
export const HOME_MODERN_SECTIONS = true;

// Light four-number stats row under the hero (modern sections). Hidden 2 Nov 2026 at
// Jackson's request. Set true to bring it back.
export const HOME_STATS_ROW = false;

// One draggable before/after comparison slider in "See the difference" (2 Nov 2026).
// Set false to restore the two side-by-side photos.
export const HOME_BA_SLIDER = true;

// Serve before/after slider photos as the original files (no Next.js re-compression).
// Sources are only 300x400; a sharp result needs higher-res photos. Set false to revert.
export const HOME_BA_ORIGINAL_FILES = true;

// Full-size before/after photos from Jackson (1200x1600, metadata stripped) in the slider.
// Set false to use the old 300x400 photos.
export const HOME_BA_HD_PHOTOS = true;
