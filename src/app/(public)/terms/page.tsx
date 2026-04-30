import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { brand } from '../../ui/theme';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Buds At Work terms of service: bookings, quotes, payments, cancellations, and service expectations for home and property services.',
  openGraph: {
    title: 'Terms of Service | Buds At Work',
    description: 'Terms and conditions for Buds At Work services including bookings, payments, and cancellations.',
  },
  alternates: { canonical: 'https://budsatwork.com/terms' },
};

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

        {/* Header */}
        <section className="rounded-3xl border border-white/60 bg-white/80 px-6 py-10 shadow-[0_16px_40px_rgba(15,23,42,0.1)] backdrop-blur-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: brand.muted }}>
            Legal
          </p>
          <h1 className="mt-4 text-3xl font-bold md:text-4xl" style={{ color: brand.primary }}>
            Terms of Service
          </h1>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: brand.muted }}>
            These terms govern your use of the Buds At Work website and the services we provide.
            Please read them carefully. By requesting a quote, making a booking, or using our website
            you agree to be bound by these terms.
          </p>
          <p className="mt-3 text-xs" style={{ color: brand.muted }}>
            <strong>Business:</strong> Buds At Work &nbsp;|&nbsp;
            <strong>ABN:</strong> 56 890 024 059 &nbsp;|&nbsp;
            <strong>Location:</strong> Logan &amp; South Brisbane, QLD, Australia &nbsp;|&nbsp;
            <strong>Last updated:</strong> 20 March 2026
          </p>
        </section>

        {/* 1. About */}
        <PolicySection title="1. About Buds At Work">
          <PolicyPara>
            Buds At Work (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a local services business
            trading in the Logan and South Brisbane area of Queensland, Australia. We provide residential
            and commercial services including cleaning, window washing, yard care, dump runs, car detailing,
            and laundry services.
          </PolicyPara>
          <PolicyPara>
            Our website is located at budsatwork.com. References to &quot;you&quot; or &quot;the customer&quot;
            mean any person or entity who accesses our website or engages our services.
          </PolicyPara>
        </PolicySection>

        {/* 2. Acceptance */}
        <PolicySection title="2. Acceptance of terms">
          <PolicyPara>
            By accessing our website, requesting a quote, creating an account, or engaging our services,
            you confirm that:
          </PolicyPara>
          <PolicyList items={[
            'You are at least 18 years of age, or you have the consent and supervision of a parent or legal guardian.',
            'You have the legal authority to enter into this agreement on behalf of yourself or the entity you represent.',
            'You have read, understood, and agree to these Terms of Service and our Privacy Policy.',
          ]} />
          <PolicyPara>
            If you do not agree with any part of these terms, please do not use our website or services.
          </PolicyPara>
        </PolicySection>

        {/* 3. Services */}
        <PolicySection title="3. Services">
          <PolicyPara>
            We offer the following services subject to availability and the specific scope agreed in
            your quote:
          </PolicyPara>
          <PolicyList items={[
            'Residential and commercial cleaning (general, deep, end-of-lease, and move-in/move-out)',
            'Window and glass cleaning (internal and external)',
            'Yard care (mowing, edging, weeding, garden tidy)',
            'Dump runs and rubbish removal',
            'Car detailing (interior, exterior, full detail)',
            'Laundry services',
          ]} />
          <PolicyPara>
            Service availability depends on crew scheduling, location, and equipment requirements.
            We reserve the right to decline or discontinue any service at our discretion, with
            reasonable notice where possible.
          </PolicyPara>
        </PolicySection>

        {/* 4. Quotes & bookings */}
        <PolicySection title="4. Quotes and bookings">
          <PolicyList items={[
            'Quotes are valid for 14 days from the date issued. A quote does not constitute a confirmed booking.',
            'Online quote estimates generated by our automated quote builder are indicative only. Final pricing may vary based on actual site conditions, scope, and access requirements identified at the time of service.',
            'A booking is confirmed when you approve the quoted scope, pay any requested deposit, and receive written confirmation (email or SMS) from us.',
            'Arrival windows are scheduled based on crew availability. We will contact you by SMS or email before the visit to confirm your slot. Exact arrival times cannot be guaranteed.',
            'You are responsible for providing an accurate service address, ensuring safe access to the property, and disclosing any relevant site conditions (hazards, permit requirements, body corporate rules) at the time of booking.',
            'If access to the site is not possible at the time of the scheduled appointment due to circumstances within your control, a cancellation fee may apply as outlined in section 7.',
          ]} />
        </PolicySection>

        {/* 5. Pricing & GST */}
        <PolicySection title="5. Pricing and GST">
          <PolicyList items={[
            'All prices displayed on our website and in quotes are in Australian Dollars (AUD).',
            'Prices are inclusive of GST where applicable. Tax invoices will clearly identify any GST component.',
            'Add-on services (e.g. dump runs, carpet spot treatments, extra windows) are not included in the base quote and will be confirmed and charged separately, only after your explicit approval.',
            'We reserve the right to adjust pricing with reasonable notice. Confirmed bookings will be honoured at the quoted price.',
          ]} />
        </PolicySection>

        {/* 6. Payment */}
        <PolicySection title="6. Payment">
          <PolicyList items={[
            'Payment is due upon completion of the service unless otherwise agreed in writing prior to the booking.',
            'We accept credit and debit cards (Visa, Mastercard, American Express), Apple Pay, Google Pay, direct bank transfer, and plan-managed invoicing.',
            'For larger jobs we may require a deposit of up to 50% of the quoted value to confirm your booking. Deposits are non-refundable if you cancel with less than 24 hours notice.',
            'If a payment is declined or reversed, you will be liable for any bank charges or administrative fees incurred as a result.',
            'Overdue invoices may incur a late payment fee and may result in suspension of future bookings until the outstanding balance is settled.',
          ]} />
        </PolicySection>

        {/* 7. Cancellations */}
        <PolicySection title="7. Cancellations and rescheduling">
          <PolicyList items={[
            'Cancellations or reschedules made at least 24 hours before the scheduled appointment are free of charge. We will work with you to find an alternative slot within seven days.',
            'Late cancellations made within 24 hours of the scheduled appointment may incur a fee of up to 50% of the quoted service value to cover crew time, travel, and expenses already committed.',
            'If we need to reschedule due to unsafe weather conditions or circumstances beyond our control, we will notify you as soon as practicable and offer an alternative appointment at no additional cost.',
            'Repeated last-minute cancellations (three or more within a 12-month period) may result in a requirement for full prepayment on future bookings.',
          ]} />
        </PolicySection>

        {/* 8. Customer obligations */}
        <PolicySection title="8. Your obligations">
          <PolicyPara>To allow us to safely and effectively perform services, you agree to:</PolicyPara>
          <PolicyList items={[
            'Ensure safe and dry access to all areas to be serviced before our crew arrives.',
            'Clear pathways and remove personal items, vehicles, or obstacles that may impede the work.',
            'Secure pets and remove any safety hazards (including sharp objects, chemicals, and unstable structures) from the work area.',
            'Obtain any required permits, body corporate approvals, or landlord consents before booking.',
            'Provide accurate information about site conditions, including any pre-existing damage, fragile items, or areas that should not be serviced.',
            'Treat our staff and subcontractors with respect. We reserve the right to withdraw services if our team is subjected to unsafe, abusive, or threatening behaviour.',
          ]} />
        </PolicySection>

        {/* 9. Service quality */}
        <PolicySection title="9. Service quality and remedies">
          <PolicyList items={[
            'We take pride in our work and aim to meet or exceed the scope agreed in your quote.',
            'If you have a quality concern, please notify us within 72 hours of the completed service. We will assess the issue and, where the concern is valid, offer a make-good visit, partial credit, or other appropriate remedy at our discretion.',
            'Quality concerns raised after 72 hours may not be accepted, as it becomes difficult to determine causation.',
            'Photos taken before and after the service may be used internally to resolve disputes.',
          ]} />
        </PolicySection>

        {/* 10. ACL */}
        <PolicySection title="10. Australian Consumer Law guarantees">
          <PolicyPara>
            Our services come with guarantees that cannot be excluded under the <em>Australian Consumer Law</em> (ACL),
            which forms Schedule 2 of the <em>Competition and Consumer Act 2010</em> (Cth). These statutory
            consumer guarantees include guarantees that services will be provided:
          </PolicyPara>
          <PolicyList items={[
            'With due care and skill.',
            'Fit for any particular purpose you made known to us.',
            'Within a reasonable time (when no timeframe is agreed).',
          ]} />
          <PolicyPara>
            Nothing in these terms excludes, restricts, or modifies your rights under the ACL.
            Where we are liable for a failure to comply with a consumer guarantee, your remedies may
            include a re-supply of the service or a refund of the amount paid, depending on the nature
            and severity of the failure.
          </PolicyPara>
        </PolicySection>

        {/* 11. Subcontractors */}
        <PolicySection title="11. Subcontractors">
          <PolicyPara>
            We may engage trusted subcontractors to perform or assist with services. All subcontractors
            are vetted, insured, and required to adhere to our standards of quality and conduct.
            Buds At Work remains responsible for the quality of services delivered, whether performed
            by our direct employees or subcontractors.
          </PolicyPara>
        </PolicySection>

        {/* 12. Insurance */}
        <PolicySection title="12. Insurance">
          <PolicyPara>
            Buds At Work holds public liability insurance for the services we provide. Our insurance covers
            accidental damage or injury caused by our crew during the performance of services.
          </PolicyPara>
          <PolicyPara>
            Our insurance does not cover:
          </PolicyPara>
          <PolicyList items={[
            'Pre-existing damage to property that was not caused by our crew.',
            'Damage resulting from inaccurate information provided by you (e.g. undisclosed fragile surfaces).',
            'Loss or theft of items not secured before our crew arrived.',
            'Consequential, indirect, or economic losses.',
          ]} />
          <PolicyPara>
            If you believe our crew has caused damage, please notify us within 24 hours with photographic
            evidence so we can assess the situation promptly.
          </PolicyPara>
        </PolicySection>

        {/* 13. Liability */}
        <PolicySection title="13. Limitation of liability">
          <PolicyPara>
            To the fullest extent permitted by law (and subject to the ACL consumer guarantees in
            section 10), our total liability to you for any claim arising from or related to our services
            is limited to the amount you paid for the specific service giving rise to the claim.
          </PolicyPara>
          <PolicyPara>
            We are not liable for any indirect, incidental, special, consequential, or economic loss
            (including loss of profit, loss of data, or business interruption) arising from your use
            of our services or website, even if we have been advised of the possibility of such loss.
          </PolicyPara>
          <PolicyPara>
            We may suspend or cancel services at any time if the site is unsafe, requires additional
            permits, or if payment terms have been materially breached, with or without prior notice
            depending on the severity of the situation.
          </PolicyPara>
        </PolicySection>

        {/* 14. IP */}
        <PolicySection title="14. Intellectual property">
          <PolicyPara>
            All content on budsatwork.com — including text, images, logos, graphics, and software — is
            owned by or licensed to Buds At Work and is protected by Australian and international
            intellectual property laws.
          </PolicyPara>
          <PolicyPara>
            You may not reproduce, distribute, modify, or create derivative works from any content on
            our website without our prior written consent. You may share links to our website for
            personal, non-commercial purposes.
          </PolicyPara>
        </PolicySection>

        {/* 15. Force majeure */}
        <PolicySection title="15. Force majeure">
          <PolicyPara>
            We are not liable for any delay or failure to perform our obligations if that delay or
            failure arises from events outside our reasonable control, including but not limited to:
            extreme weather, natural disasters, pandemics, government restrictions, power outages,
            or supply chain disruptions.
          </PolicyPara>
          <PolicyPara>
            In such cases we will notify you as soon as practicable and use reasonable efforts to
            reschedule the service at a mutually convenient time.
          </PolicyPara>
        </PolicySection>

        {/* 16. Governing law */}
        <PolicySection title="16. Governing law and dispute resolution">
          <PolicyPara>
            These terms are governed by the laws of Queensland, Australia. Any dispute arising from
            or in connection with these terms or our services shall be resolved as follows:
          </PolicyPara>
          <PolicyList items={[
            'In the first instance, by good-faith negotiation between the parties. Please contact us at admin@budsatwork.com to raise a concern.',
            'If not resolved within 14 days, either party may escalate to the Queensland Civil and Administrative Tribunal (QCAT) or a Queensland court of competent jurisdiction.',
          ]} />
        </PolicySection>

        {/* 17. Amendments */}
        <PolicySection title="17. Amendments to these terms">
          <PolicyPara>
            We may update these terms from time to time. When we do, we will revise the &quot;Last updated&quot;
            date at the top of this page. For material changes we will endeavour to provide prominent
            notice on our website.
          </PolicyPara>
          <PolicyPara>
            Your continued use of our website or services after changes are posted constitutes acceptance
            of the revised terms. If you do not agree with the revised terms, please stop using our
            services and contact us to discuss any outstanding obligations.
          </PolicyPara>
        </PolicySection>

        {/* 18. Severability */}
        <PolicySection title="18. Severability and waiver">
          <PolicyList items={[
            'If any provision of these terms is found to be invalid, unlawful, or unenforceable, that provision will be deemed severed from the remaining terms, which will continue in full force and effect.',
            'Our failure to enforce any right or provision of these terms does not constitute a waiver of that right or provision. A waiver is only effective if made in writing.',
          ]} />
        </PolicySection>

        {/* 19. Contact */}
        <PolicySection title="19. Contact us">
          <PolicyPara>
            If you have questions about these terms or want to discuss your booking:
          </PolicyPara>
          <PolicyList items={[
            'Email: admin@budsatwork.com',
            'Phone: business number coming soon',
            'Business hours: Monday–Friday, 8 am–5 pm AEST',
          ]} />
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
