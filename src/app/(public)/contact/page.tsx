import type { Metadata } from 'next';
import Link from 'next/link';
import { brand, cx, glass, glassSoft } from '../../ui/theme';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with Buds at Work. We\'re here to help with your home cleaning, window cleaning, yard care, dump runs, and car detailing needs in Logan & South Brisbane.',
  openGraph: {
    title: 'Contact Buds at Work',
    description: 'Reach out for a quote or to ask any questions about our services.',
  },
};

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function MailIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 6L2 7" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg {...iconProps} className="h-4 w-4">
      <path d="M5 12h12" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

const contactMethods = [
  {
    icon: <MailIcon />,
    title: 'Email',
    value: 'admin@budsatwork.com',
    href: 'mailto:admin@budsatwork.com',
    description: 'We typically respond within 24 hours',
  },
  {
    icon: <MapPinIcon />,
    title: 'Service Area',
    value: 'Logan & South Brisbane',
    description: 'Covering the greater Logan region',
  },
  {
    icon: <ClockIcon />,
    title: 'Hours',
    value: 'Mon–Sat, 7am–5pm',
    description: 'Flexible scheduling available',
  },
];

export default function ContactPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'radial-gradient(900px circle at 25% 10%, rgba(20,83,45,0.12) 0, transparent 55%), radial-gradient(1100px circle at 80% 0%, rgba(125,211,252,0.14) 0, transparent 55%), radial-gradient(900px circle at 50% 90%, rgba(191,232,209,0.18) 0, transparent 60%)',
        }}
      />

      <div className="mx-auto max-w-5xl space-y-16 pb-12">
        {/* HERO */}
        <section className="text-center pt-4">
          <p className="text-sm font-medium" style={{ color: brand.primary }}>
            Get in touch
          </p>

          <h1
            className="mt-4 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]"
            style={{ color: brand.text }}
          >
            Let&apos;s chat about
            <br />
            <span style={{ color: brand.primary }}>what you need.</span>
          </h1>

          <p
            className="mt-5 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            style={{ color: brand.muted }}
          >
            Whether you need a quote, have a question, or want to discuss a custom job —
            we&apos;re here to help.
          </p>
        </section>

        {/* CONTACT METHODS */}
        <section className="grid sm:grid-cols-3 gap-4">
          {contactMethods.map((method, i) => (
            <div
              key={i}
              className={cx('rounded-2xl p-6 text-center', glass)}
            >
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 mx-auto"
                style={{ background: `${brand.primary}15`, color: brand.primary }}
              >
                {method.icon}
              </div>
              <h3 className="font-semibold text-sm uppercase tracking-wide mb-1" style={{ color: brand.muted }}>
                {method.title}
              </h3>
              {method.href ? (
                <a
                  href={method.href}
                  className="text-lg font-semibold hover:underline"
                  style={{ color: brand.primary }}
                >
                  {method.value}
                </a>
              ) : (
                <p className="text-lg font-semibold" style={{ color: brand.text }}>
                  {method.value}
                </p>
              )}
              <p className="mt-1 text-xs" style={{ color: brand.muted }}>
                {method.description}
              </p>
            </div>
          ))}
        </section>

        {/* CONTACT FORM */}
        <section className={cx('rounded-3xl p-8 md:p-10', glassSoft)}>
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold" style={{ color: brand.text }}>
                Send us a message
              </h2>
              <p className="mt-2 text-base" style={{ color: brand.muted }}>
                Fill out the form below and we&apos;ll get back to you soon
              </p>
            </div>

            <form
              action="https://formsubmit.co/admin@budsatwork.com"
              method="POST"
              className="space-y-6"
            >
              {/* Honeypot for spam prevention */}
              <input type="text" name="_honey" style={{ display: 'none' }} />
              {/* Disable captcha */}
              <input type="hidden" name="_captcha" value="false" />
              {/* Success redirect */}
              <input type="hidden" name="_next" value="https://budsatwork.com/contact?success=true" />
              {/* Subject */}
              <input type="hidden" name="_subject" value="New contact form submission from Buds at Work" />

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium mb-2"
                    style={{ color: brand.text }}
                  >
                    Your name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    placeholder="John Smith"
                    className="w-full px-4 py-3 rounded-xl border bg-white/80 focus:outline-none focus:ring-2 transition-shadow"
                    style={{
                      borderColor: brand.border,
                      color: brand.text,
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium mb-2"
                    style={{ color: brand.text }}
                  >
                    Email address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 rounded-xl border bg-white/80 focus:outline-none focus:ring-2 transition-shadow"
                    style={{
                      borderColor: brand.border,
                      color: brand.text,
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium mb-2"
                  style={{ color: brand.text }}
                >
                  Phone number <span style={{ color: brand.muted }}>(optional)</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  placeholder="0400 000 000"
                  className="w-full px-4 py-3 rounded-xl border bg-white/80 focus:outline-none focus:ring-2 transition-shadow"
                  style={{
                    borderColor: brand.border,
                    color: brand.text,
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="service"
                  className="block text-sm font-medium mb-2"
                  style={{ color: brand.text }}
                >
                  What service are you interested in?
                </label>
                <select
                  id="service"
                  name="service"
                  className="w-full px-4 py-3 rounded-xl border bg-white/80 focus:outline-none focus:ring-2 transition-shadow"
                  style={{
                    borderColor: brand.border,
                    color: brand.text,
                  }}
                >
                  <option value="">Select a service (optional)</option>
                  <option value="home-cleaning">Home Cleaning</option>
                  <option value="window-cleaning">Window Cleaning</option>
                  <option value="yard-care">Yard Care</option>
                  <option value="dump-runs">Dump Runs</option>
                  <option value="car-detailing">Laundry &amp; Sneaker Care</option>
                  <option value="ndis">NDIS Support</option>
                  <option value="other">Other / General Enquiry</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium mb-2"
                  style={{ color: brand.text }}
                >
                  Your message
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  placeholder="Tell us about what you need..."
                  className="w-full px-4 py-3 rounded-xl border bg-white/80 focus:outline-none focus:ring-2 transition-shadow resize-none"
                  style={{
                    borderColor: brand.border,
                    color: brand.text,
                  }}
                />
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                style={{ background: brand.primary, color: '#fff' }}
              >
                Send message <SendIcon />
              </button>
            </form>
          </div>
        </section>

        {/* ALTERNATIVE CTA */}
        <section
          className="rounded-3xl p-8 md:p-10 text-center"
          style={{ background: `${brand.primary}08` }}
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: brand.text }}>
            Ready for a quote?
          </h2>
          <p className="text-base max-w-lg mx-auto mb-6" style={{ color: brand.muted }}>
            If you already know what you need, head to our services page
            to get an instant estimate.
          </p>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
            style={{ background: brand.primary, color: '#fff' }}
          >
            Get a quote <ArrowRightIcon />
          </Link>
        </section>
      </div>
    </div>
  );
}
