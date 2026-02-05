export function LocalBusinessSchema() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': 'https://budsatwork.com/#organization',
    name: 'Buds at Work',
    description: 'Quote-first local services in Logan & South Brisbane: home cleaning, window cleaning, yard care, dump runs, car detailing, and NDIS-friendly support.',
    url: 'https://budsatwork.com',
    logo: 'https://budsatwork.com/logo.png',
    image: 'https://budsatwork.com/og-image.png',
    email: 'admin@budsatwork.com',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Logan',
      addressRegion: 'QLD',
      addressCountry: 'AU',
    },
    areaServed: [
      {
        '@type': 'City',
        name: 'Logan',
        containedInPlace: {
          '@type': 'State',
          name: 'Queensland',
        },
      },
      {
        '@type': 'City',
        name: 'South Brisbane',
        containedInPlace: {
          '@type': 'State',
          name: 'Queensland',
        },
      },
    ],
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
      ],
    },
    sameAs: [
      // Add your social media URLs here when available
      // 'https://www.facebook.com/budsatwork',
      // 'https://www.instagram.com/budsatwork',
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
    name: 'Buds at Work',
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
