'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { publicTheme } from '@/lib/design-system/themes';
import { cx } from '@/app/ui/theme';

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M5 12h12M13 6l6 6-6 6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const faqs: { category: string; items: { q: string; a: React.ReactNode }[] }[] = [
  {
    category: 'Bookings & Quotes',
    items: [
      {
        q: 'How do I get a quote?',
        a: 'Head to our Services page and pick what you need. Our quote builder will walk you through the job — no phone calls or callbacks required. You\'ll get a price before submitting anything.',
      },
      {
        q: 'Is the quote free?',
        a: 'Yes, completely free. You can build and review a quote with no obligation. We only ask for payment once you\'ve reviewed and confirmed the final price.',
      },
      {
        q: 'How long is my quote valid?',
        a: 'Quotes are held for 7 days. After that they may expire if our availability or pricing changes.',
      },
      {
        q: 'Can I cancel or reschedule?',
        a: 'Yes. Contact us at admin@budsatwork.com and we\'ll sort it out. We ask for at least 24 hours notice where possible so we can reallocate the crew.',
      },
      {
        q: 'Will there be any surprise fees?',
        a: 'No. The price in your quote is the price you pay. If we identify anything during the job that would change the scope, we\'ll stop and talk to you first.',
      },
    ],
  },
  {
    category: 'Services',
    items: [
      {
        q: 'What areas do you service?',
        a: 'We cover Logan and South Brisbane — including Springwood, Beenleigh, Browns Plains, Loganholme, Daisy Hill, Slacks Creek, and surrounding suburbs. Not sure if we reach you? Drop us a message.',
      },
      {
        q: 'Do you offer NDIS services?',
        a: 'Yes. We work with NDIS participants and can provide invoices formatted for support coordination. Select the "NDIS" context when building your quote, or contact us to discuss your plan.',
      },
      {
        q: 'Can I book recurring services?',
        a: 'Absolutely. We offer weekly, fortnightly, and monthly schedules for cleaning, yard care, and window cleaning. Recurring bookings get priority scheduling.',
      },
      {
        q: 'Do I need to be home during the service?',
        a: 'Not necessarily. Many customers leave access instructions in their profile. We\'ll confirm the details with you before the day.',
      },
      {
        q: 'Do you bring your own equipment and supplies?',
        a: 'Yes — our crew brings everything needed for the job. If you have specific products you\'d prefer we use (e.g. for allergies), just let us know in the notes.',
      },
    ],
  },
  {
    category: 'Payment',
    items: [
      {
        q: 'When do I pay?',
        a: 'Payment is collected after your quote is finalised and approved — before the job is scheduled. We use Stripe for secure card payments.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'Visa, Mastercard, and American Express via Stripe. We don\'t accept cash or bank transfer at this stage.',
      },
      {
        q: 'Can I get an invoice?',
        a: 'Yes. Receipts and invoices are available in your customer portal under Payment History. NDIS-formatted invoices can be requested by contacting us.',
      },
      {
        q: 'What is your refund policy?',
        a: 'If you\'re not happy with the work, contact us within 48 hours and we\'ll make it right — either a re-do or a refund, depending on the situation.',
      },
    ],
  },
  {
    category: 'The Crew',
    items: [
      {
        q: 'Are your crew members vetted?',
        a: 'Yes. All crew members go through an onboarding process that includes identity checks and induction training before they take on any jobs.',
      },
      {
        q: 'Is your team insured?',
        a: 'Yes. Buds At Work carries public liability insurance for all services we provide.',
      },
      {
        q: 'Can I request the same crew member each time?',
        a: 'We\'ll do our best. Once you\'ve had a good experience with a specific crew member, you can mention it in your booking notes and we\'ll try to match you.',
      },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-0" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-4 text-left gap-4"
      >
        <span className="font-medium text-sm md:text-base" style={{ color: publicTheme.color.text }}>{q}</span>
        <span
          className="shrink-0 transition-transform duration-200"
          style={{ color: publicTheme.color.primary, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <ChevronDownIcon />
        </span>
      </button>
      {open && (
        <p className="pb-4 text-sm leading-relaxed" style={{ color: publicTheme.color.muted }}>
          {a}
        </p>
      )}
    </div>
  );
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.flatMap((section) =>
    section.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: String(item.a),
      },
    }))
  ),
};

export default function FAQPage() {
  return (
    <div className="relative overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'radial-gradient(900px circle at 25% 10%, rgba(20,83,45,0.10) 0, transparent 55%), radial-gradient(1100px circle at 80% 0%, rgba(125,211,252,0.12) 0, transparent 55%)',
        }}
      />

      <div className="mx-auto max-w-3xl space-y-12 pb-16 pt-4 px-6 md:px-8">
        {/* Header */}
        <section className="text-center">
          <p className="text-sm font-medium" style={{ color: publicTheme.color.primary }}>Got questions?</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight" style={{ color: publicTheme.color.text }}>
            Frequently asked questions
          </h1>
          <p className="mt-4 text-base md:text-lg max-w-xl mx-auto" style={{ color: publicTheme.color.muted }}>
            Everything you need to know before booking. Can&apos;t find your answer?{' '}
            <Link href="/contact" className="underline underline-offset-2" style={{ color: publicTheme.color.primary }}>
              Send us a message.
            </Link>
          </p>
        </section>

        {/* FAQ sections */}
        {faqs.map((section) => (
          <section key={section.category}>
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: publicTheme.color.primary }}>
              {section.category}
            </h2>
            <div className={cx('rounded-2xl px-6', publicTheme.glass)}>
              {section.items.map((item) => (
                <FAQItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </section>
        ))}

        {/* CTA */}
        <section className={cx('rounded-3xl p-8 text-center', publicTheme.glassSoft)}>
          <h2 className="text-xl font-bold mb-2" style={{ color: publicTheme.color.text }}>Still have questions?</h2>
          <p className="text-sm mb-6" style={{ color: publicTheme.color.muted }}>
            We&apos;re happy to talk through anything before you book.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow hover:shadow-md transition-shadow"
              style={{ background: publicTheme.color.primary, color: '#fff' }}
            >
              Contact us <ArrowRightIcon />
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold border-2 hover:bg-white/60 transition-colors"
              style={{ borderColor: publicTheme.color.primary, color: publicTheme.color.primary }}
            >
              Get a free quote <ArrowRightIcon />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
