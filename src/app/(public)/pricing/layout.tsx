import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Transparent pricing for Buds At Work services: home cleaning, window cleaning, yard care, dump runs, and car detailing. Get a quote before work begins.',
  openGraph: {
    title: 'Pricing | Buds At Work',
    description: 'Transparent, indicative price ranges for all our services. Final price confirmed before work begins.',
  },
  alternates: { canonical: 'https://budsatwork.com/pricing' },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
