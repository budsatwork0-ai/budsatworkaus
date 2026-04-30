export type MarketingServiceKey =
  | 'windows'
  | 'cleaning'
  | 'yard'
  | 'dump'
  | 'auto'
  | 'laundry_sneakers';

export type MarketingService = {
  key: MarketingServiceKey;
  label: string;
  shortLabel: string;
  from: number;
  href: string;
  title: string;
  tagline: string;
  description: string;
  inclusions: string[];
  schemaDescription: string;
};

export const MARKETING_SERVICES: Record<MarketingServiceKey, MarketingService> = {
  windows: {
    key: 'windows',
    label: 'Window cleaning',
    shortLabel: 'Window cleaning',
    from: 79,
    href: '/services?service=windows',
    title: 'Window Cleaning Logan & South Brisbane',
    tagline: 'Crystal clear results, inside and out',
    description:
      'Window cleaning for homes and small properties across Logan and South Brisbane. We quote upfront and confirm the scope before any work begins.',
    inclusions: [
      'Interior and exterior glass options',
      'Frames, tracks, sills, and screens available',
      'Single and multi-storey jobs assessed upfront',
      'Quote-first pricing before you commit',
    ],
    schemaDescription:
      'Professional window cleaning services in Logan and South Brisbane, QLD. Interior and exterior panes, tracks, sills, and screens.',
  },
  cleaning: {
    key: 'cleaning',
    label: 'Home cleaning',
    shortLabel: 'Home cleaning',
    from: 99,
    href: '/services?service=cleaning',
    title: 'Home Cleaning Services Logan',
    tagline: 'Professional house cleaning with no surprise fees',
    description:
      'Home cleaning, deep cleaning, and end-of-lease support across Logan and South Brisbane. Build your quote online and know the expected price before we confirm the job.',
    inclusions: [
      'General, deep, and end-of-lease cleaning options',
      'Bathrooms, kitchens, bedrooms, and living areas',
      'NDIS-friendly options with tailored support',
      'Transparent quote before scheduling',
    ],
    schemaDescription:
      'Professional home and end-of-lease cleaning in Logan and South Brisbane, QLD. NDIS-friendly options available.',
  },
  yard: {
    key: 'yard',
    label: 'Yard & garden',
    shortLabel: 'Yard care',
    from: 79,
    href: '/services?service=yard',
    title: 'Yard & Garden Care Logan',
    tagline: 'Mowing, hedging, and garden tidy-ups done right',
    description:
      'Yard care across Logan and South Brisbane, including mowing, edging, hedging, garden tidy-ups, green waste help, and pressure washing where suitable.',
    inclusions: [
      'Lawn mowing and edge trimming',
      'Hedge and shrub shaping',
      'Garden tidy-ups and green waste support',
      'Map-based quote tools for yard scope',
    ],
    schemaDescription:
      'Yard and garden care services in Logan and South Brisbane, QLD. Mowing, hedging, garden tidy-ups, and green waste removal.',
  },
  dump: {
    key: 'dump',
    label: 'Dump runs',
    shortLabel: 'Dump runs',
    from: 105,
    href: '/services?service=dump',
    title: 'Rubbish Removal & Dump Runs Logan',
    tagline: 'We haul it away with upfront pricing',
    description:
      'Dump runs and small rubbish removals for Logan and South Brisbane. Quote single items, ute loads, bulky items, delivery, and transport jobs before you book.',
    inclusions: [
      'Single-item and load-based dump runs',
      'Furniture, bulky items, and green waste options',
      'Pickup, loading help, and disposal planning',
      'Distance and load details shown before submission',
    ],
    schemaDescription:
      'Rubbish removal and dump run services in Logan and South Brisbane, QLD. Household junk, green waste, furniture, and bulky items.',
  },
  auto: {
    key: 'auto',
    label: 'Car detailing',
    shortLabel: 'Car detailing',
    from: 160,
    href: '/services?service=auto',
    title: 'Car Detailing Logan & South Brisbane',
    tagline: 'Mobile detailing quoted before we arrive',
    description:
      'Mobile car detailing for Logan and South Brisbane. Choose an express, interior, or full detail and get pricing based on the vehicle and scope.',
    inclusions: [
      'Express, interior, and full detail options',
      'Exterior wash, vacuuming, glass, and trim options',
      'Vehicle-size-aware pricing',
      'Rego-assisted vehicle lookup where available',
    ],
    schemaDescription:
      'Mobile car detailing services in Logan and South Brisbane, QLD. Express and full-detail packages at your home or workplace.',
  },
  laundry_sneakers: {
    key: 'laundry_sneakers',
    label: 'Laundry & sneakers',
    shortLabel: 'Laundry',
    from: 40,
    href: '/services?service=laundry_sneakers',
    title: 'Laundry & Sneaker Care Logan',
    tagline: 'Wash, fold, and sneaker cleaning done with care',
    description:
      'Laundry and sneaker care for busy households, NDIS participants, and anyone who wants one less job to manage.',
    inclusions: [
      'Wash, dry, and fold laundry service',
      'Sneaker refresh and deep restore options',
      'Pickup and delivery options shown in quote flow',
      'NDIS-friendly support available',
    ],
    schemaDescription:
      'Laundry and sneaker care services in Logan and South Brisbane, QLD. Wash, fold, and sneaker cleaning with NDIS-friendly options.',
  },
};

export const MARKETING_SERVICE_LIST = Object.values(MARKETING_SERVICES);
