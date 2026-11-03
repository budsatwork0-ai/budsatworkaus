import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BUDS_STREET_WINDOWS } from '@/app/ui/home/flags';
import { BudsStreet } from '@/app/ui/street/BudsStreet';

export const metadata: Metadata = {
  title: 'Buds Street · Windows | Buds At Work',
  robots: { index: false, follow: false },
};

export default function StreetPage() {
  if (!BUDS_STREET_WINDOWS) notFound();
  return <BudsStreet />;
}
