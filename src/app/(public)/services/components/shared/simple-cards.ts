/** Simple step 2 service cards (approved 31 Oct 2026). Set false to restore the old detailed cards. */
export const SIMPLE_SERVICE_CARDS = true;

/**
 * Menu-style cards (31 Oct 2026): photo on top, bold name, one-line
 * description, "From $X · ~time", small + in the corner.
 * Set false to go back to the plain simple cards from PR #267.
 */
export const MENU_SERVICE_CARDS = true;

/** Real photos in /public for each card. Cards without one get a soft green tile with an icon. */
export const CARD_PHOTOS: Record<string, string> = {
  windows_full: '/images/window-clean-after.webp',
  windows_interior: '/images/window-clean-after.webp',
  windows_exterior: '/images/window-clean-after.webp',
  windows_tracks: '/images/window-clean-before.webp',
};

/** One short line per card. Falls back to the card's own description. */
export const CARD_LINES: Record<string, string> = {
  windows_full: 'Inside and out, tracks and screens',
  windows_interior: 'Inside panes, frames and sills',
  windows_exterior: 'Outside panes and screens',
  windows_tracks: 'Tracks vacuumed and wiped',
  clean_std: 'Kitchen, bathrooms, floors and dusting',
  clean_deep: 'Top-to-bottom clean, inside the details',
  clean_move: 'Move in or move out, bond-ready',
  yard_mow: 'Mow, edge and tidy',
  yard_hedge: 'Hedges shaped and cleaned up',
  yard_leaves: 'Weeding, leaves and garden tidy',
  blast_and_shine: 'Driveways, paths and patios',
  gutter_clean: 'Gutters cleared and checked',
  dump_runs: 'We load it and take it to the tip',
  bin_cleans: 'Bins washed and deodorised',
  dump_delivery: 'Pick up and drop off',
  dump_transport: 'Move items between places',
  auto_express: 'Wash, vacuum and windows',
  auto_interior: 'Deep interior clean and deodorise',
  auto_full: 'Inside and out, clay bar and polish',
  laundry: 'Washed, dried and folded',
  sneaker_care: 'Sneakers cleaned like new',
};

/**
 * One card per service (1 Nov 2026). Variant cards are folded into a single
 * card with a toggle inside it. Set false to show every variant as its own card.
 */
export const ONE_CARD_PER_SERVICE = true;

export type CardGroup = {
  label: string;
  line: string;
  /** Fixed starting price from existing code (not computed). */
  from: number;
  photo?: string;
  /** Variant scope keys, first is the default. */
  variants: { key: string; label: string }[];
  /** Hide the toggle when the card's own panel already has one (windows calculator). */
  hideToggle?: boolean;
};

/** Keyed by service; cleaning applies to non-commercial only. */
export const CARD_GROUPS: Record<string, CardGroup> = {
  windows: {
    label: 'Window Cleaning',
    line: 'Inside, outside, tracks and screens',
    from: 150, // job minimum from the window price list
    photo: '/images/window-clean-after.webp',
    variants: [
      { key: 'windows_full', label: 'Both sides' },
      { key: 'windows_interior', label: 'Inside only' },
      { key: 'windows_exterior', label: 'Outside only' },
      { key: 'windows_tracks', label: 'Tracks only' },
    ],
    hideToggle: true,
  },
  cleaning: {
    label: 'House Cleaning',
    line: 'Regular, deep or move in / out',
    from: 99, // starting price on the Cleaning service tile
    variants: [
      { key: 'general', label: 'Standard' },
      { key: 'weekly', label: 'Weekly' },
      { key: 'deep', label: 'Deep' },
      { key: 'endoflease', label: 'Move in / out' },
    ],
  },
  auto: {
    label: 'Car Detailing',
    line: 'Express, interior or full detail',
    from: 99, // starting price on the Car Detailing service tile
    variants: [
      { key: 'auto_express', label: 'Express' },
      { key: 'auto_interior', label: 'Interior' },
      { key: 'auto_full', label: 'Full' },
    ],
  },
};
