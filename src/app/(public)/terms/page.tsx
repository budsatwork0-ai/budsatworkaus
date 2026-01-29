import type { ReactNode } from 'react';
import { brand } from '../../ui/theme';

const termsSections = [
  {
    title: 'Bookings & quotes',
    points: [
      'Quotes are valid for 14 days and are confirmed once you approve the scope and pay any requested deposit.',
      'Requested arrival windows depend on crew availability; we always follow up with an SMS or email before the visit.',
      'You are responsible for providing accurate address, access, and permit information so we can reach your site safely.',
    ],
  },
  {
    title: 'Payments & adjustments',
    points: [
      'Payment is due at the job completion unless otherwise agreed in writing; we accept cards, bank transfers, and plan-managed invoices.',
      'Add-ons (dump runs, extra windows, carpet spot treatments) will be charged in addition to the base quote after your approval.',
      'Bank or card fees resulting from failed transactions are passed to the customer and help cover administrative time.',
    ],
  },
  {
    title: 'Cancellations & rescheduling',
    points: [
      'Cancellations or reschedules made with at least 24 hours notice are free; we will work with you to find a new slot within seven days.',
      'Late cancellations (inside 24 hours) may incur 50% of the quoted value to cover crew time and travel already scheduled.',
      'We keep an eye on weather; if a job is unsafe we will reschedule at no extra cost and notify you as soon as we can.',
    ],
  },
  {
    title: 'Expectations & safety',
    points: [
      'Please ensure safe, dry access, clear pathways, and that pets or hazards are secured before our crew arrives.',
      'If you spot a quality concern within 72 hours, tell us and we will review it to make it right or issue a credit.',
      'Our team is insured and trained; we expect respectful behaviour from both sides so the job can finish smoothly.',
    ],
  },
  {
    title: 'Liability & updates',
    points: [
      'To the fullest extent permitted by law, liability is limited to the value of the service and does not cover indirect issues.',
      'We may suspend or cancel services if the site is unsafe, needs additional permits, or if payment terms are breached.',
      'These terms form part of your agreement with Buds at Work—continued use of the site or services means you accept them.',
    ],
  },
];

export default function TermsPage() {
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
            Terms
          </p>
          <h1 className="mt-4 text-3xl font-bold md:text-4xl" style={{ color: brand.primary }}>
            Terms of Service
          </h1>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: brand.muted }}>
            These terms explain how bookings work, what payments cover, and how we keep everyone safe.
            They apply to every request, quote, and service supplied by Buds at Work.
          </p>
        </section>

        {termsSections.map((section) => (
          <PolicySection key={section.title} title={section.title}>
            <PolicyList items={section.points} />
          </PolicySection>
        ))}

        <PolicySection title="Questions?">
          <p className="text-sm text-slate-600">
            Email us at{' '}
            <a
              className="font-medium text-slate-900 underline decoration-dotted underline-offset-4"
              href="mailto:hello@budsatwork.com"
            >
              hello@budsatwork.com
            </a>{' '}
            if anything in these terms needs clarification—happy to talk it through.
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
