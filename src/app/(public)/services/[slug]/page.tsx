import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { brand, glass, glassSoft, cx } from '@/app/ui/theme';

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M5 12h12M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

const services = {
  windows: {
    title: 'Window Cleaning Logan & South Brisbane',
    tagline: 'Crystal clear results, inside and out',
    description:
      'Our window cleaning crew handles everything from ground-floor panes to multi-storey properties across Logan and South Brisbane. We clean frames, tracks, sills, and screens — leaving every surface streak-free.',
    inclusions: [
      'Interior & exterior glass cleaning',
      'Frame, track, and sill cleaning',
      'Screen removal and clean',
      'Multi-storey and hard-to-reach windows',
    ],
    from: '$79',
    schemaDescription: 'Professional window cleaning services in Logan and South Brisbane, QLD. Interior and exterior panes, tracks, sills, and screens.',
  },
  cleaning: {
    title: 'Home Cleaning Services Logan',
    tagline: 'Professional house cleaning with no surprise fees',
    description:
      'From weekly maintenance cleans to deep cleans and end-of-lease cleans, our vetted crew delivers consistent results across homes and units in Logan and South Brisbane. Quote upfront, pay once — no hidden extras.',
    inclusions: [
      'Vacuuming, mopping, and surface wipe-downs',
      'Bathroom and kitchen cleaning',
      'End-of-lease and bond cleans available',
      'NDIS-friendly options with tailored support',
    ],
    from: '$99',
    schemaDescription: 'Professional home and end-of-lease cleaning in Logan and South Brisbane, QLD. NDIS-friendly options available.',
  },
  yard: {
    title: 'Yard & Garden Care Logan',
    tagline: 'Mowing, hedging, and garden tidy-ups done right',
    description:
      'Keep your property looking its best year-round. Our yard care team covers lawn mowing, edge trimming, hedging, garden bed maintenance, and full yard clean-ups across Logan and surrounding suburbs.',
    inclusions: [
      'Lawn mowing and edge trimming',
      'Hedge and shrub shaping',
      'Garden bed weeding and mulching',
      'Full yard clean-up and green waste removal',
    ],
    from: '$89',
    schemaDescription: 'Yard and garden care services in Logan and South Brisbane, QLD. Mowing, hedging, garden tidy-ups, and green waste removal.',
  },
  dump: {
    title: 'Rubbish Removal & Dump Runs Logan',
    tagline: 'We haul it away — recycling, green waste, and more',
    description:
      'Whether it\'s a garage clear-out, construction debris, or old furniture, our team handles the heavy lifting and responsible disposal. We cover Logan and South Brisbane with transparent per-load pricing.',
    inclusions: [
      'Household rubbish and junk removal',
      'Green waste and garden clean-up loads',
      'Furniture, appliances, and bulky items',
      'Responsible recycling where possible',
    ],
    from: '$119',
    schemaDescription: 'Rubbish removal and dump run services in Logan and South Brisbane, QLD. Household junk, green waste, furniture, and appliances.',
  },
  auto: {
    title: 'Car Detailing Logan & South Brisbane',
    tagline: 'Showroom finish, on your driveway',
    description:
      'From express washes to full detail packages, our mobile car detailing service comes to you. We cover interior vacuuming, exterior wash and wax, glass polish, and more — no need to leave home.',
    inclusions: [
      'Exterior hand wash and dry',
      'Interior vacuum and wipe-down',
      'Glass and mirror polish',
      'Full detail packages with wax and trim dressing',
    ],
    from: '$69',
    schemaDescription: 'Mobile car detailing services in Logan and South Brisbane, QLD. Express and full-detail packages at your home or workplace.',
  },
  laundry_sneakers: {
    title: 'Laundry & Sneaker Care Logan',
    tagline: 'Wash, fold, and sneaker cleaning done with care',
    description:
      'Drop off or arrange collection — we handle washing, drying, folding, and sneaker restoration. Perfect for busy households, NDIS participants, or anyone who just wants one less thing to worry about.',
    inclusions: [
      'Wash, dry, and fold laundry service',
      'Sneaker cleaning and restoration',
      'NDIS-friendly options available',
      'Collection and drop-off on request',
    ],
    from: '$49',
    schemaDescription: 'Laundry and sneaker care services in Logan and South Brisbane, QLD. Wash, fold, and sneaker cleaning with NDIS-friendly options.',
  },
} as const;

type Slug = keyof typeof services;

const SLUGS: Slug[] = ['windows', 'cleaning', 'yard', 'dump', 'auto', 'laundry_sneakers'];

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const svc = services[slug as Slug];
  if (!svc) return {};
  return {
    title: svc.title,
    description: svc.schemaDescription,
    alternates: { canonical: `https://budsatwork.com/services/${slug}` },
    openGraph: {
      title: svc.title,
      description: svc.schemaDescription,
      url: `https://budsatwork.com/services/${slug}`,
    },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const svc = services[slug as Slug];
  if (!svc) notFound();

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: svc.title,
    description: svc.schemaDescription,
    provider: {
      '@type': 'LocalBusiness',
      '@id': 'https://budsatwork.com/#organization',
      name: 'Buds At Work',
    },
    areaServed: [
      'Logan', 'South Brisbane', 'Springwood', 'Beenleigh', 'Browns Plains',
      'Loganholme', 'Daisy Hill', 'Slacks Creek',
    ].map((name) => ({ '@type': 'City', name })),
    offers: {
      '@type': 'Offer',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: svc.from.replace('$', ''),
        priceCurrency: 'AUD',
        description: 'Starting price — final price based on scope',
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
          style={{
            background:
              'radial-gradient(900px circle at 25% 10%, rgba(20,83,45,0.10) 0, transparent 55%), radial-gradient(1100px circle at 80% 0%, rgba(125,211,252,0.12) 0, transparent 55%)',
          }}
        />

        <div className="mx-auto max-w-3xl space-y-12 pb-16 pt-4 px-6 md:px-8">
          {/* Breadcrumb */}
          <nav className="text-sm" aria-label="Breadcrumb">
            <ol className="flex items-center gap-1.5" style={{ color: brand.muted }}>
              <li><Link href="/" className="hover:underline">Home</Link></li>
              <li aria-hidden>/</li>
              <li><Link href="/services" className="hover:underline">Services</Link></li>
              <li aria-hidden>/</li>
              <li style={{ color: brand.text }} aria-current="page">{svc.title.split(' ')[0]} {svc.title.split(' ')[1]}</li>
            </ol>
          </nav>

          {/* Hero */}
          <section>
            <p className="text-sm font-medium mb-3" style={{ color: brand.primary }}>
              Logan &amp; South Brisbane
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: brand.text }}>
              {svc.title}
            </h1>
            <p className="text-lg font-medium mb-4" style={{ color: brand.primary }}>
              {svc.tagline}
            </p>
            <p className="text-base leading-relaxed" style={{ color: brand.muted }}>
              {svc.description}
            </p>
          </section>

          {/* Inclusions */}
          <section className={cx('rounded-2xl p-7', glass)}>
            <h2 className="font-semibold text-lg mb-5" style={{ color: brand.text }}>
              What&apos;s included
            </h2>
            <ul className="space-y-3">
              {svc.inclusions.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: `${brand.primary}20`, color: brand.primary }}
                  >
                    <CheckIcon />
                  </span>
                  <span className="text-sm" style={{ color: brand.text }}>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Pricing hint + CTA */}
          <section className={cx('rounded-3xl p-8 text-center', glassSoft)}>
            <p className="text-sm mb-1" style={{ color: brand.muted }}>Starting from</p>
            <p className="text-4xl font-bold mb-1" style={{ color: brand.text }}>{svc.from}</p>
            <p className="text-xs mb-6" style={{ color: brand.muted }}>
              Final price is calculated in the quote builder based on your job scope.
            </p>
            <Link
              href={`/services?service=${slug}`}
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
              style={{ background: brand.primary, color: '#fff' }}
            >
              Get a free quote <ArrowRightIcon />
            </Link>
            <p className="mt-4 text-xs" style={{ color: brand.muted }}>
              No payment until you review and confirm — price locked for 7 days.
            </p>
          </section>

          {/* Trust */}
          <section className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {['NDIS-Ready', 'Fully Insured', 'Vetted Crew', 'No Surprise Fees'].map((badge) => (
              <span key={badge} className="flex items-center gap-1.5 text-sm" style={{ color: brand.muted }}>
                <span style={{ color: brand.primary }}><CheckIcon /></span>
                {badge}
              </span>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
