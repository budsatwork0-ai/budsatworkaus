import type { Metadata } from 'next';
import Link from 'next/link';
import { brand, glass, glassSoft } from '../../ui/theme';

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Shop cleaning supplies, gift cards, and service bundles from Buds At Work. Coming soon to Logan & South Brisbane.',
  openGraph: {
    title: 'Shop | Buds At Work',
    description: 'Shop cleaning supplies, gift cards, and service bundles. Coming soon.',
  },
  alternates: { canonical: 'https://budsatwork.com/shop' },
};

const upcomingItems = [
  {
    emoji: '🎁',
    title: 'Gift Cards',
    description: 'Give the gift of a clean home, a tidy yard, or a detailed car. Perfect for any occasion.',
  },
  {
    emoji: '🧴',
    title: 'Cleaning Supplies',
    description: 'The products our crew uses every day — available to order for home use.',
  },
  {
    emoji: '📦',
    title: 'Service Bundles',
    description: 'Pre-packaged combinations like "Spring Clean" or "Move-Out Ready" at a bundled price.',
  },
];

export default function ShopPage() {
  return (
    <main className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 z-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(750px circle at 20% 12%, rgba(20,83,45,0.10) 0, transparent 50%), radial-gradient(950px circle at 80% 5%, rgba(125,211,252,0.12) 0, transparent 55%), radial-gradient(900px circle at 50% 100%, rgba(20,83,45,0.07) 0, transparent 60%)',
        }}
      />
      <div className="relative z-10 mx-auto max-w-4xl px-6 md:px-8 py-12 space-y-12">

        {/* Header */}
        <section className="text-center">
          <p className="text-sm font-medium" style={{ color: brand.primary }}>Coming soon</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight" style={{ color: brand.text }}>
            The Buds At Work Shop
          </h1>
          <p className="mt-4 text-base md:text-lg max-w-xl mx-auto" style={{ color: brand.muted }}>
            We&apos;re putting together something good — gift cards, the supplies we swear by, and bundle deals.
            Check back soon.
          </p>
        </section>

        {/* Upcoming items */}
        <section className="grid sm:grid-cols-3 gap-4">
          {upcomingItems.map((item) => (
            <div key={item.title} className={`${glass} rounded-2xl p-6 text-center`}>
              <div className="text-4xl mb-3">{item.emoji}</div>
              <h3 className="font-semibold mb-2" style={{ color: brand.text }}>{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: brand.muted }}>{item.description}</p>
            </div>
          ))}
        </section>

        {/* CTA - redirect to services in the meantime */}
        <section className={`${glassSoft} rounded-3xl p-8 md:p-10 text-center`}>
          <h2 className="text-xl md:text-2xl font-bold mb-3" style={{ color: brand.text }}>
            Need a service right now?
          </h2>
          <p className="text-sm md:text-base max-w-md mx-auto mb-6" style={{ color: brand.muted }}>
            The shop is on the way, but our booking system is live and ready.
            Get a free quote on any of our services today.
          </p>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
            style={{ background: brand.primary, color: '#fff' }}
          >
            Get a free quote
          </Link>
        </section>

      </div>
    </main>
  );
}
