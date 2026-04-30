import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { brand } from '../../ui/theme';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Buds At Work privacy policy: how we collect, use, and protect your personal information when you use our home and property services.',
  openGraph: {
    title: 'Privacy Policy | Buds At Work',
    description: 'Learn how Buds At Work keeps your details safe and never sells them to third parties.',
  },
  alternates: { canonical: 'https://budsatwork.com/privacy' },
};

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

        {/* Header */}
        <section className="rounded-3xl border border-white/60 bg-white/80 px-6 py-10 shadow-[0_16px_40px_rgba(15,23,42,0.1)] backdrop-blur-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: brand.muted }}>
            Privacy
          </p>
          <h1 className="mt-4 text-3xl font-bold md:text-4xl" style={{ color: brand.primary }}>
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: brand.muted }}>
            Buds At Work is committed to protecting your personal information and handling it responsibly
            in accordance with the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs).
            This policy explains what we collect, why we keep it, how we protect it, and your rights.
          </p>
          <p className="mt-3 text-xs" style={{ color: brand.muted }}>
            <strong>Business:</strong> Buds At Work &nbsp;|&nbsp;
            <strong>ABN:</strong> 56 890 024 059 &nbsp;|&nbsp;
            <strong>Location:</strong> Logan &amp; South Brisbane, QLD, Australia &nbsp;|&nbsp;
            <strong>Last updated:</strong> 20 March 2026
          </p>
        </section>

        {/* 1. About this policy */}
        <PolicySection title="1. About this policy">
          <PolicyPara>
            This Privacy Policy applies to all personal information collected by Buds At Work (&quot;we&quot;,
            &quot;us&quot;, &quot;our&quot;) through our website at budsatwork.com, our customer and crew portals,
            and in the course of delivering our services.
          </PolicyPara>
          <PolicyPara>
            We may update this policy from time to time. When we do, we will revise the &quot;Last updated&quot;
            date above. Continued use of our site or services after changes are posted constitutes
            acceptance of the revised policy. For significant changes we will provide a more prominent notice.
          </PolicyPara>
          <PolicyPara>
            If you have questions about this policy or want to make a privacy complaint, please contact us
            at <EmailLink />.
          </PolicyPara>
        </PolicySection>

        {/* 2. Information we collect */}
        <PolicySection title="2. Personal information we collect">
          <PolicyPara>We collect the following categories of personal information:</PolicyPara>
          <PolicyList items={[
            'Identity and contact details: name, email address, phone number, and property address when you request a quote, create an account, or make a booking.',
            'Service information: preferred appointment times, accessibility requirements, special instructions, and photos of areas to be serviced that you choose to share.',
            'Payment and financial information: billing details necessary to process payments. Card numbers are handled directly by Stripe and are never stored on our servers.',
            'Account credentials: email address and hashed password if you create a portal account.',
            'Feedback and communications: messages, bug reports, feature ideas, and other content you submit via our feedback form or by email.',
            'Usage and technical data: IP address, browser type, device identifiers, pages visited, and session duration collected automatically when you use our website.',
            'Cookie and analytics data: aggregated behavioural data collected via Google Analytics (GA4) to understand how visitors use our site.',
            'Staff and crew information: if you work with us, we collect employment-related information necessary to manage your engagement, schedule, and payments.',
          ]} />
        </PolicySection>

        {/* 3. How we collect */}
        <PolicySection title="3. How we collect your information">
          <PolicyPara>We collect personal information in the following ways:</PolicyPara>
          <PolicyList items={[
            'Directly from you: when you complete our quote builder, contact form, feedback widget, create an account, or communicate with us by email, phone, or SMS.',
            'Automatically: when you visit our website, our servers collect basic technical data. Google Analytics data is only collected if you accept optional analytics cookies.',
            'From third parties: where you use a third-party payment method (e.g. Apple Pay or Google Pay via Stripe) or sign in via a linked account.',
          ]} />
        </PolicySection>

        {/* 4. Why we collect */}
        <PolicySection title="4. Why we collect and use your information">
          <PolicyPara>We collect and use personal information only for the purposes for which it was collected or related purposes, including:</PolicyPara>
          <PolicyList items={[
            'Providing and managing services: scheduling appointments, coordinating crew, confirming bookings, and delivering the cleaning, yard care, detailing, laundry, and other services you request.',
            'Processing payments: charging for completed work, issuing tax invoices and receipts, and managing refunds or credits.',
            'Communication: sending booking confirmations, appointment reminders, service updates, and responding to your enquiries.',
            'Marketing (with consent): sending promotional emails or SMS messages about our services. You can opt out at any time.',
            'Improving our services: using anonymised analytics data to understand how the site is used and to identify areas for improvement.',
            'Legal and compliance: meeting our obligations under Australian tax law (ATO), employment law, and any other applicable legislation.',
            'Safety: protecting the safety of our staff, customers, and the public.',
          ]} />
        </PolicySection>

        {/* 5. Third-party processors */}
        <PolicySection title="5. Third-party service providers">
          <PolicyPara>
            We share your personal information with trusted third-party service providers who assist us
            in operating our business. These providers are contractually bound to use your information
            only for the purposes we specify and to maintain appropriate security.
          </PolicyPara>
          <PolicyList items={[
            'Stripe (stripe.com) — payment processing. Stripe is PCI-DSS Level 1 certified and processes card payments on our behalf. Your card details are handled directly by Stripe. Data is stored in the United States.',
            'Supabase (supabase.com) — database and authentication. Customer records, quotes, bookings, and account credentials are stored in Supabase infrastructure hosted on AWS (United States and/or other regions).',
            'Google Analytics / GA4 (analytics.google.com) — website analytics. Anonymised usage data is transmitted to Google servers in the United States to help us understand site traffic.',
            'Resend (resend.com) — transactional and notification emails. Your email address and name are processed by Resend to deliver booking confirmations, receipts, and service updates. Data may be processed in the United States.',
            'Crew members and subcontractors — we share only the minimum information required (your name, address, and booking details) with the team member assigned to your job.',
          ]} />
          <PolicyPara>
            We do not sell your personal information to any third party for marketing or commercial purposes.
          </PolicyPara>
        </PolicySection>

        {/* 6. Cross-border transfers */}
        <PolicySection title="6. Overseas disclosure">
          <PolicyPara>
            Some of our third-party providers store and process data outside Australia, primarily in the
            United States. By using our services, you acknowledge that your personal information may be
            transferred to and processed in countries that may not provide the same level of data protection
            as Australia.
          </PolicyPara>
          <PolicyPara>
            We take reasonable steps to ensure overseas recipients handle your information in accordance
            with the Australian Privacy Principles and under appropriate data processing agreements.
          </PolicyPara>
        </PolicySection>

        {/* 7. Cookies */}
        <PolicySection title="7. Cookies and tracking technologies">
          <PolicyPara>
            Our website uses cookies and similar technologies for the following purposes:
          </PolicyPara>
          <PolicyList items={[
            'Analytics cookies (Google Analytics / GA4): help us understand how visitors interact with our site by collecting anonymised usage statistics. These cookies are only set if you accept the cookie banner.',
            'Session and authentication cookies: keep you logged in to your portal account during your session.',
            'Preference storage (localStorage): remembers your cookie consent choice and quote progress so you don\'t have to start over.',
          ]} />
          <PolicyPara>
            You can control cookies through your browser settings or by declining the cookie consent
            banner on your first visit. Note that disabling cookies may affect some site functionality.
            Google Analytics opt-out is also available via the{' '}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline decoration-dotted underline-offset-4"
              style={{ color: brand.primary }}
            >
              Google Analytics Opt-out Browser Add-on
            </a>.
          </PolicyPara>
        </PolicySection>

        {/* 8. Security */}
        <PolicySection title="8. Data security">
          <PolicyList items={[
            'All data transmitted between your browser and our site is encrypted using HTTPS/TLS.',
            'Database access is restricted to authorised personnel and systems using role-based access controls.',
            'Payment card data is processed and stored by Stripe under PCI-DSS Level 1 compliance; we do not store card numbers.',
            'We conduct periodic reviews of our security practices and update them as threats evolve.',
          ]} />
          <PolicyPara>
            While we take reasonable steps to protect your information, no system is completely secure.
            In the event of a data breach that is likely to cause serious harm, we will notify affected
            individuals and the Office of the Australian Information Commissioner (OAIC) as required under
            the Notifiable Data Breaches (NDB) scheme.
          </PolicyPara>
        </PolicySection>

        {/* 9. Retention */}
        <PolicySection title="9. Data retention">
          <PolicyList items={[
            'Financial records (invoices, payments, bookings): retained for seven years as required by the Australian Taxation Office.',
            'Account information: retained while your account is active and for a reasonable period after closure to resolve disputes.',
            'Analytics data: retained in aggregated, anonymised form in accordance with Google Analytics\' retention settings (default 14 months).',
            'Feedback submissions: retained for up to two years to track patterns and improve our services.',
            'Server logs: retained for up to 90 days for security and diagnostic purposes.',
          ]} />
          <PolicyPara>
            When retention periods expire, we securely delete or anonymise personal information.
            You may also request earlier deletion (subject to our legal obligations — see section 11).
          </PolicyPara>
        </PolicySection>

        {/* 10. Data breaches */}
        <PolicySection title="10. Notifiable data breaches">
          <PolicyPara>
            We comply with the Notifiable Data Breaches (NDB) scheme under the <em>Privacy Act 1988</em> (Cth).
            If we become aware of a data breach that is likely to result in serious harm to any affected
            individuals, we will:
          </PolicyPara>
          <PolicyList items={[
            'Contain the breach and assess its nature and scope as quickly as possible.',
            'Notify the Office of the Australian Information Commissioner (OAIC) as soon as practicable.',
            'Notify affected individuals directly, or by public notice if direct notification is not practicable.',
            'Provide guidance on the steps affected individuals can take to protect themselves.',
          ]} />
        </PolicySection>

        {/* 11. Your rights */}
        <PolicySection title="11. Your rights under the Australian Privacy Principles">
          <PolicyPara>
            Under the Australian Privacy Principles you have the right to:
          </PolicyPara>
          <PolicyList items={[
            'Access: request a copy of the personal information we hold about you.',
            'Correction: ask us to correct information that is inaccurate, incomplete, or out of date.',
            'Deletion: request deletion of your personal information where we no longer have a legal obligation to retain it.',
            'Opt-out of marketing: unsubscribe from marketing emails by clicking "Unsubscribe" in any email, or reply "STOP" to any SMS. Transactional messages (booking confirmations, receipts) cannot be opted out of while your account is active.',
            'Complaint: lodge a complaint with us first, and if not resolved, escalate to the OAIC at oaic.gov.au or 1300 363 992.',
          ]} />
          <PolicyPara>
            To exercise any of these rights, email us at <EmailLink />.
            We will respond within five business days for access/correction requests and within 30 days
            for more complex requests.
          </PolicyPara>
        </PolicySection>

        {/* 12. Children */}
        <PolicySection title="12. Children's privacy">
          <PolicyPara>
            Our services and website are intended for individuals aged 18 and over. We do not knowingly
            collect personal information from children under 18 without verifiable parental or guardian
            consent. If you believe we have inadvertently collected information from a minor, please
            contact us immediately at <EmailLink /> and we will promptly delete it.
          </PolicyPara>
        </PolicySection>

        {/* 13. Contact */}
        <PolicySection title="13. Contact us">
          <PolicyPara>
            If you have questions, concerns, or a complaint about how we handle your personal information,
            please contact our Privacy Officer:
          </PolicyPara>
          <PolicyList items={[
            'Email: admin@budsatwork.com',
            'Phone: business number coming soon',
            'Business hours: Monday–Friday, 8 am–5 pm AEST',
          ]} />
          <PolicyPara>
            If you are not satisfied with our response, you may lodge a complaint with the Office of the
            Australian Information Commissioner (OAIC) at{' '}
            <a
              href="https://www.oaic.gov.au"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline decoration-dotted underline-offset-4"
              style={{ color: brand.primary }}
            >
              oaic.gov.au
            </a>{' '}
            or by calling 1300 363 992.
          </PolicyPara>
        </PolicySection>

      </div>
    </main>
  );
}

function PolicySection({ title, children }: { title: string; children: ReactNode }) {
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
        <li key={index} className="flex gap-3">
          <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: brand.primary }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PolicyPara({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-slate-600">{children}</p>;
}

function EmailLink() {
  return (
    <a
      className="font-medium text-slate-900 underline decoration-dotted underline-offset-4"
      href="mailto:admin@budsatwork.com"
    >
      admin@budsatwork.com
    </a>
  );
}
