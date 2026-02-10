import Link from 'next/link';
import { brand, cx, glass } from './ui/theme';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for could not be found.',
};

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function HomeIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.5 10v11h13V10" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

const quickLinks = [
  { href: '/', label: 'Home', icon: <HomeIcon /> },
  { href: '/services', label: 'Services', icon: <SearchIcon /> },
  { href: '/about', label: 'About Us' },
  { href: '/contact', label: 'Contact' },
];

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16" style={{ background: '#F7F7F5' }}>
      {/* Background gradient */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'radial-gradient(900px circle at 25% 10%, rgba(20,83,45,0.08) 0, transparent 55%), radial-gradient(1100px circle at 80% 90%, rgba(125,211,252,0.1) 0, transparent 55%)',
        }}
      />

      <div className="max-w-lg w-full text-center">
        {/* 404 Number */}
        <div
          className="text-8xl md:text-9xl font-bold tracking-tight"
          style={{ color: `${brand.primary}20` }}
        >
          404
        </div>

        {/* Main content */}
        <div className={cx('rounded-3xl p-8 md:p-10 -mt-8', glass)}>
          <h1
            className="text-2xl md:text-3xl font-bold mb-3"
            style={{ color: brand.text }}
          >
            Page not found
          </h1>
          <p
            className="text-base mb-8"
            style={{ color: brand.muted }}
          >
            Sorry, we couldn&apos;t find the page you&apos;re looking for.
            It may have been moved or no longer exists.
          </p>

          {/* Quick Links */}
          <div className="space-y-3 mb-8">
            <p className="text-sm font-medium" style={{ color: brand.text }}>
              Try one of these instead:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors hover:bg-white/80"
                  style={{
                    borderColor: brand.border,
                    color: brand.text,
                  }}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Back button */}
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
            style={{ background: brand.primary, color: '#fff' }}
          >
            <ArrowLeftIcon />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
