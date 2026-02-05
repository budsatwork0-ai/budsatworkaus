import type { Metadata } from 'next';
import HomePage from '@/app/ui/home/HomePage';

export const metadata: Metadata = {
  title: 'Home',
  description: 'Quote-first local services in Logan & South Brisbane: home cleaning, window cleaning, yard care, dump runs, car detailing. NDIS-friendly support available.',
  openGraph: {
    title: 'Buds at Work | Your Local Mates for Home Services',
    description: 'Quote-first local services: cleaning, windows, yard care, dump runs, car detailing. NDIS-friendly. Logan & South Brisbane.',
  },
};

export default function Page() {
  return <HomePage />;
}
