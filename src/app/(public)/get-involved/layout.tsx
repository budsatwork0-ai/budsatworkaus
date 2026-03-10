import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get Involved',
  description: 'Join the Buds At Work team: casual crew, support workers, quality partners, and innovation partners. Work with a growing local services company in Logan.',
  openGraph: {
    title: 'Get Involved | Buds At Work',
    description: 'Join our team as casual crew, support worker, or partner. Help us deliver reliable local services across Logan and South Brisbane.',
  },
  alternates: { canonical: 'https://budsatwork.com/get-involved' },
};

export default function GetInvolvedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
