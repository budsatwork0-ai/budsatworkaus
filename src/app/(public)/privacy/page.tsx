import type { ReactNode } from 'react';
import { brand } from '../../ui/theme';

const infoPoints = [
  'Contact details (name, email, phone, address) when you request a quote or schedule a visit.',
  'Service context such as preferred times, accessibility notes, and photos so we can arrive prepared.',
  'Payment and invoicing details required to confirm a booking and issue receipts.',
  'Usage data (page views, device information, and logs) to keep the site reliable and secure.',
];

const usagePoints = [
  'Answer questions, send confirmations, and keep you updated about appointments.',
  'Deliver services by coordinating crew members, partners, and support workers with the minimal data they need.',
  'Improve Buds at Work through anonymized analytics and diagnostics.',
  'Share safety reminders, privacy updates, and other critical notices by email or SMS when requested.',
];

const sharingPoints = [
  'Verified team members, contractors, and vetted partners—only the data they require to fulfil the job.',
  'Service providers such as accounting, scheduling, and analytics platforms that maintain industry-standard safeguards.',
  'Law enforcement or courts if we are required to comply with legal process or to protect property and people.',
];

const choicePoints = [
  'Review, correct, or request the deletion of your data by emailing hello@budsatwork.com.',
  'Opt-out of marketing emails and SMS replies by clicking “unsubscribe” or replying “STOP.”',
  'Ask us to stop sharing your data for optional add-ons once a job, warranty, or legal obligation no longer applies.',
];

export default function PrivacyPolicyPage() {
  return (
    <main className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 z-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(750px circle at 20% 12%, #e6f6ef 0, transparent 50%), radial-gradient(950px circle at 80% 5%, #e8f4ec 0, transparent 55%)',
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl space-y-10 px-6 py-12 md:px-8">
        <section className="rounded-3xl border border-white/60 bg-white/80 px-6 py-10 shadow-[0_16px_40px_rgba(15,23,42,0.1)] backdrop-blur-2xl">
          <p
            className="text-xs font-semibold uppercase tracking-[0.3em]"
            style={{ color: brand.muted }}
          >
            Privacy
          </p>
          <h1 className="mt-4 text-3xl font-bold md:text-4xl" style={{ color: brand.primary }}>
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: brand.muted }}>
            Buds at Work keeps your details safe, shares them only when required, and never sells them
            to third parties. This page explains what we collect, why we keep it, and how to reach us
            when you have questions.
          </p>
        </section>

        <PolicySection title="What we collect">
          <PolicyList items={infoPoints} />
        </PolicySection>

        <PolicySection title="How we use the information">
          <PolicyList items={usagePoints} />
        </PolicySection>

        <PolicySection title="Sharing & retention">
          <PolicyList items={sharingPoints} />
          <p className="mt-4 text-sm text-slate-600">
            We retain records for up to seven years to keep servicing jobs, comply with Australian tax
            rules, and preserve warranties. Security measures include encrypted storage, limited staff
            access, and periodic reviews.
          </p>
        </PolicySection>

        <PolicySection title="Your choices & rights">
          <PolicyList items={choicePoints} />
          <p className="mt-3 text-sm text-slate-600">
            Prefer a direct conversation? Email us at{' '}
            <a
              className="font-medium text-slate-900 underline decoration-dotted underline-offset-4"
              href="mailto:hello@budsatwork.com"
            >
              hello@budsatwork.com
            </a>
            , and we’ll respond within two business days.
          </p>
        </PolicySection>
      </div>
    </main>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/60 bg-white/80 px-6 py-8 shadow-[0_16px_40px_rgba(15,23,42,0.1)] backdrop-blur-2xl">
      <h2 className="text-2xl font-semibold" style={{ color: brand.text }}>
        {title}
      </h2>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function PolicyList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3 text-sm text-slate-600">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-3">
          <span
            className="mt-1 h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: brand.primary }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
