import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Services',
  description: 'Book local services in Logan & South Brisbane: home cleaning, end-of-lease cleaning, window cleaning, yard care, dump runs, and car detailing. Get an instant quote.',
  openGraph: {
    title: 'Our Services | Buds At Work',
    description: 'Home cleaning, window cleaning, yard care, dump runs, and car detailing. Quote-first approach with transparent pricing.',
  },
  keywords: ['home cleaning Logan', 'window cleaning Brisbane', 'yard care', 'dump runs', 'car detailing', 'end of lease cleaning', 'NDIS cleaning services'],
  alternates: { canonical: 'https://budsatwork.com/services' },
};

export default function ServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
