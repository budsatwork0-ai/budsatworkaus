import type { Metadata } from 'next';
import HomePage from '@/app/ui/home/HomePage';

export const metadata: Metadata = {
  title: 'Buds at Work',
  description:
    'Quote-first local services: cleaning, windows, yard care, dump runs, car detailing, and more.',
};

export default function Page() {
  return <HomePage />;
}
