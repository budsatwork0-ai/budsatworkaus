import Link from 'next/link';
import { SERVICES } from '../../lib/service-data';

/**
 * Lightweight first-paint shell for /services while the quote wizard hydrates.
 * Uses existing service names and /services?service=<id> links. No prices.
 */
export function ServicesFirstPaint() {
  return (
    <div className="mx-auto max-w-3xl px-6 md:px-8 py-12 md:py-16">
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
        Book a service
      </h1>
      <p className="mt-2 text-base text-slate-500">
        Choose a service and we&apos;ll take you through the details.
      </p>
      <ul className="mt-8 grid gap-3">
        {SERVICES.map((service) => (
          <li key={service.key}>
            <Link
              href={`/services?service=${service.key}`}
              data-cta="book-service-card"
              className="flex items-center gap-4 rounded-2xl border border-black/10 bg-white px-4 py-4 shadow-sm transition hover:border-black/20"
            >
              <span className="shrink-0 text-slate-700" aria-hidden>
                {service.icon}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900">{service.label}</span>
                <span className="block text-sm text-slate-500">{service.subtitle}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
