import type { Metadata } from 'next';
import HomePage from '@/app/ui/home/HomePage';

export const metadata: Metadata = {
  title: 'Home',
  description: 'Quote-first local services in Logan & South Brisbane: home cleaning, window cleaning, yard care, dump runs, car detailing. NDIS-friendly support available.',
  alternates: { canonical: 'https://budsatwork.com' },
  openGraph: {
    title: 'Buds At Work | Your Local Mates for Home Services',
    description: 'Quote-first local services: cleaning, windows, yard care, dump runs, car detailing. NDIS-friendly. Logan & South Brisbane.',
  },
};

export default function Page() {
  const videoSchema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: 'Buds At Work — Good people doing honest work',
    description:
      'Buds At Work is a local crew in Logan & South Brisbane handling home cleaning, window cleaning, yard care, dump runs, and car detailing.',
    thumbnailUrl: 'https://budsatwork.com/images/hero-thumbnail.png',
    uploadDate: '2024-01-01',
    contentUrl: 'https://budsatwork.com/videos/hero.mp4',
    publisher: {
      '@type': 'Organization',
      name: 'Buds At Work',
      url: 'https://budsatwork.com',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema) }}
      />
      <HomePage />
    </>
  );
}
