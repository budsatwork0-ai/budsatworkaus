import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about Buds At Work — bookings, pricing, services, payments, and more. Serving Logan & South Brisbane.',
  openGraph: {
    title: 'FAQ | Buds At Work',
    description: 'Got questions? We have answers. Find out everything about our services, pricing, and how we work.',
  },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children;
}
