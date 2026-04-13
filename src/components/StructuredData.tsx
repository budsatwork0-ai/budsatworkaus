export function LocalBusinessSchema() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': 'https://budsatwork.com/#organization',
    name: 'Buds At Work',
    description: 'Quote-first local services in Logan & South Brisbane: home cleaning, window cleaning, yard care, dump runs, car detailing, and NDIS-friendly support.',
    url: 'https://budsatwork.com',
    logo: 'https://budsatwork.com/logo.png',
    image: 'https://budsatwork.com/og-image.png',
    email: 'admin@budsatwork.com',
    identifier: {
      '@type': 'PropertyValue',
      name: 'ABN',
      value: '56 890 024 059',
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Logan',
      addressRegion: 'QLD',
      addressCountry: 'AU',
    },
    areaServed: [
      'Logan', 'South Brisbane', 'Springwood', 'Beenleigh', 'Browns Plains',
      'Loganholme', 'Daisy Hill', 'Slacks Creek',
    ].map((name) => ({ '@type': 'City', name, containedInPlace: { '@type': 'State', name: 'Queensland' } })),
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5.0',
      reviewCount: '24',
      bestRating: '5',
      worstRating: '1',
    },
    priceRange: '$$',
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '07:00',
        closes: '18:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Saturday'],
        opens: '08:00',
        closes: '16:00',
      },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Home & Property Services',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Home Cleaning',
            description: 'Professional home and end-of-lease cleaning services',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Window Cleaning',
            description: 'Single and multi-storey window cleaning',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Yard Care',
            description: 'Mowing, edging, garden care, and light maintenance',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Dump Runs',
            description: 'Rubbish removal and item disposal services',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Car Detailing',
            description: 'Car cleaning and detailing packages',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Laundry & Sneaker Care',
            description: 'Wash, fold, and sneaker cleaning services',
          },
        },
      ],
    },
    sameAs: [
      'https://www.facebook.com/people/Buds-At-Work/61579013228527/',
      'https://www.instagram.com/budsatwork_aus',
      'https://www.tiktok.com/@buds.at.work',
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

export function WebsiteSchema() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Buds At Work',
    url: 'https://budsatwork.com',
    description: 'Quote-first local services in Logan & South Brisbane',
    publisher: {
      '@id': 'https://budsatwork.com/#organization',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
