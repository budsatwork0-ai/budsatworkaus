import type { MarketingServiceKey } from './marketing-services';

export type LocalLandingPage = {
  slug: string;
  serviceKey: MarketingServiceKey;
  title: string;
  description: string;
  eyebrow: string;
  headline: string;
  subhead: string;
  bullets: string[];
  ctaLabel: string;
  secondaryCtaLabel: string;
};

export const LOCAL_LANDING_PAGES: Record<string, LocalLandingPage> = {
  'cleaning-logan': {
    slug: 'cleaning-logan',
    serviceKey: 'cleaning',
    title: 'Home Cleaning Logan',
    description:
      'Quote-first home cleaning in Logan. Build a transparent quote online for general, deep, and end-of-lease cleaning.',
    eyebrow: 'Home cleaning · Logan',
    headline: 'Get a clear home cleaning quote before you book.',
    subhead:
      'Choose your rooms, scope, and extras online. We review the quote, confirm details, and keep the price clear before work starts.',
    bullets: ['General, deep, and end-of-lease options', 'NDIS-friendly support available', 'No payment until the quote is reviewed'],
    ctaLabel: 'Build my cleaning quote',
    secondaryCtaLabel: 'Support the mission',
  },
  'window-cleaning-logan': {
    slug: 'window-cleaning-logan',
    serviceKey: 'windows',
    title: 'Window Cleaning Logan',
    description:
      'Quote-first window cleaning in Logan and South Brisbane. Price panes, tracks, screens, and storeys online.',
    eyebrow: 'Window cleaning · Logan',
    headline: 'Window cleaning with the scope shown upfront.',
    subhead:
      'Select interior, exterior, tracks, screens, and access details so we can confirm a fair quote before the job.',
    bullets: ['Interior and exterior options', 'Tracks, sills, and screens available', 'Single and multi-storey jobs assessed before booking'],
    ctaLabel: 'Build my window quote',
    secondaryCtaLabel: 'Support the mission',
  },
  'yard-care-logan': {
    slug: 'yard-care-logan',
    serviceKey: 'yard',
    title: 'Yard Care Logan',
    description:
      'Quote-first yard care in Logan. Get estimates for mowing, edging, hedging, garden tidy-ups, and pressure washing.',
    eyebrow: 'Yard care · Logan',
    headline: 'Yard care priced around the work actually needed.',
    subhead:
      'Use the quote builder to map or describe the job so mowing, hedging, tidy-ups, and green waste are scoped clearly.',
    bullets: ['Mowing, edging, and garden tidy-ups', 'Map-based yard quoting tools', 'Clear scope before scheduling'],
    ctaLabel: 'Build my yard quote',
    secondaryCtaLabel: 'Support the mission',
  },
  'dump-runs-logan': {
    slug: 'dump-runs-logan',
    serviceKey: 'dump',
    title: 'Dump Runs Logan',
    description:
      'Quote-first dump runs and small rubbish removal in Logan. Price single items, bulky items, and load-based jobs.',
    eyebrow: 'Dump runs · Logan',
    headline: 'Need it gone? Start with a clear dump run quote.',
    subhead:
      'Tell us what needs moving, where it is, and how much help you need. We confirm disposal and pricing before work starts.',
    bullets: ['Single items, bulky items, and small loads', 'Pickup and loading help available', 'Distance and load details included in the quote'],
    ctaLabel: 'Build my dump run quote',
    secondaryCtaLabel: 'Support the mission',
  },
  'car-detailing-logan': {
    slug: 'car-detailing-logan',
    serviceKey: 'auto',
    title: 'Car Detailing Logan',
    description:
      'Quote-first mobile car detailing in Logan and South Brisbane. Choose express, interior, or full detail options online.',
    eyebrow: 'Car detailing · Logan',
    headline: 'Mobile car detailing quoted before we arrive.',
    subhead:
      'Choose the detail package and vehicle type so the quote reflects the work needed before we schedule the job.',
    bullets: ['Express, interior, and full detail options', 'Vehicle-size-aware estimates', 'Rego-assisted lookup where available'],
    ctaLabel: 'Build my detailing quote',
    secondaryCtaLabel: 'Support the mission',
  },
  'ndis-cleaning-logan': {
    slug: 'ndis-cleaning-logan',
    serviceKey: 'cleaning',
    title: 'NDIS Cleaning Logan',
    description:
      'NDIS-friendly cleaning support in Logan. Build a quote with plan-management routing and clear service details.',
    eyebrow: 'NDIS-friendly cleaning · Logan',
    headline: 'Cleaning support with clearer quoting for NDIS participants.',
    subhead:
      'Build a quote for household tasks, include plan-management details where relevant, and let us review the scope before payment.',
    bullets: ['Self-managed and plan-managed routing options', 'Household task support quoted online', 'Payment link only after review'],
    ctaLabel: 'Build my NDIS quote',
    secondaryCtaLabel: 'Support the mission',
  },
};

export const LOCAL_LANDING_PAGE_LIST = Object.values(LOCAL_LANDING_PAGES);
