import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { brand, glass, glassSoft, cx } from '@/app/ui/theme';
import { MARKETING_SERVICES, type MarketingServiceKey } from '@/lib/marketing-services';
import { LOCAL_LANDING_PAGES, LOCAL_LANDING_PAGE_LIST } from '@/lib/local-landing-pages';

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

const services = MARKETING_SERVICES;

type Slug = MarketingServiceKey;

const SLUGS: Slug[] = ['windows', 'cleaning', 'yard', 'dump', 'auto', 'laundry_sneakers'];

export function generateStaticParams() {
  return [
    ...SLUGS.map((slug) => ({ slug })),
    ...LOCAL_LANDING_PAGE_LIST.map((page) => ({ slug: page.slug })),
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const landing = LOCAL_LANDING_PAGES[slug];
  if (landing) {
    return {
      title: landing.title,
      description: landing.description,
      alternates: { canonical: `https://budsatwork.com/services/${landing.slug}` },
      openGraph: {
        title: `${landing.title} | Buds At Work`,
        description: landing.description,
        url: `https://budsatwork.com/services/${landing.slug}`,
      },
    };
  }

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
  const landing = LOCAL_LANDING_PAGES[slug];
  if (landing) {
    const svc = services[landing.serviceKey];
    return (
      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
          style={{
            background:
              'radial-gradient(900px circle at 20% 0%, rgba(20,83,45,0.12) 0, transparent 55%), radial-gradient(1000px circle at 85% 10%, rgba(125,211,252,0.12) 0, transparent 52%)',
          }}
        />

        <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-4 md:grid-cols-[1.15fr_0.85fr] md:px-8 md:pt-10">
          <section className="flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: brand.primary }}>
              {landing.eyebrow}
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl" style={{ color: brand.text }}>
              {landing.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed" style={{ color: brand.muted }}>
              {landing.subhead}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/services?service=${landing.serviceKey}&utm_content=${landing.slug}`}
                data-track="local_landing_quote_click"
                data-track-label={landing.slug}
                className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold shadow-lg transition-shadow hover:shadow-xl"
                style={{ background: brand.primary, color: '#fff' }}
              >
                {landing.ctaLabel} <ArrowRightIcon />
              </Link>
              <Link
                href="/get-involved"
                data-track="local_landing_donation_click"
                data-track-label={landing.slug}
                className="inline-flex items-center rounded-full border px-7 py-3.5 text-base font-semibold transition-colors hover:bg-white/70"
                style={{ borderColor: brand.border, color: brand.primary }}
              >
                {landing.secondaryCtaLabel}
              </Link>
            </div>
          </section>

          <aside className={cx('rounded-3xl p-7 md:p-8', glass)}>
            <p className="text-sm" style={{ color: brand.muted }}>Starting from</p>
            <p className="mt-1 text-5xl font-bold" style={{ color: brand.text }}>${svc.from}</p>
            <p className="mt-2 text-sm" style={{ color: brand.muted }}>
              Final price depends on scope and is reviewed before payment.
            </p>

            <div className="my-7 h-px" style={{ background: brand.border }} />

            <h2 className="text-lg font-semibold" style={{ color: brand.text }}>Why people click through</h2>
            <ul className="mt-5 space-y-3">
              {landing.bullets.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: `${brand.primary}20`, color: brand.primary }}
                  >
                    <CheckIcon />
                  </span>
                  <span className="text-sm leading-relaxed" style={{ color: brand.text }}>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 rounded-2xl p-4" style={{ background: `${brand.primary}08` }}>
              <p className="text-sm font-semibold" style={{ color: brand.text }}>New local service, honest positioning</p>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: brand.muted }}>
                We&apos;re building from the ground up, so we don&apos;t fake reviews. We focus on clear quoting, useful work, and local support.
              </p>
            </div>
          </aside>
        </div>
      </div>
    );
  }

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
        price: svc.from.toString(),
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
            <p className="text-4xl font-bold mb-1" style={{ color: brand.text }}>${svc.from}</p>
            <p className="text-xs mb-6" style={{ color: brand.muted }}>
              Final price is calculated in the quote builder based on your job scope.
            </p>
            <Link
              href={`/services?service=${slug}`}
              data-track="service_detail_quote_click"
              data-track-label={svc.title}
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
