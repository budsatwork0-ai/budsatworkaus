'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { brand } from './theme';

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

function TruckIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
      stroke="currentColor" className={className}
    >
      <path strokeWidth={1.8} d="M3 16V7a2 2 0 0 1 2-2h8v11m0-6h4l3 3v3h-3" />
      <circle cx="7" cy="17.5" r="1.2" /><circle cx="17" cy="17.5" r="1.2" />
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Belt-and-braces: never render on dashboard routes,
  // even if someone accidentally imports this in the app group.
  if (pathname?.startsWith('/dashboard')) return null;

  // Broadcast a reset the Services page can listen for.
  // Trigger when heading to Services (fresh start) or leaving Services to another tab.
  const broadcastReset = () => {
    try {
      window.dispatchEvent(new CustomEvent('svc:reset'));
    } catch { /* no-op in case of odd runtimes */ }
  };

  const handleNavClick = (targetHref: string) => {
    const onServices = pathname?.startsWith('/services');
    const goingToServices = targetHref === '/services';
    if (goingToServices || onServices) {
      broadcastReset();
    }
  };

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + '/');

  const linkBase =
    'hover:underline transition-[color,opacity] duration-150';

  return (
    <header
      className={cx(
        'sticky top-0 z-50 transition-all',
        scrolled
          ? 'bg-white/80 backdrop-blur border-b border-white/70 shadow-[0_10px_30px_rgba(15,23,42,0.08)]'
          : 'bg-transparent border-b border-transparent'
      )}
      style={{ color: brand.text }}
    >
      <div className="mx-auto max-w-6xl px-6 md:px-8 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="font-bold text-xl"
          onClick={() => handleNavClick('/')}
          style={{ color: brand.primary }}
        >
          Buds at Work
        </Link>

        <nav className="hidden md:flex items-center gap-6" aria-label="Main">
          <Link
            href="/about"
            className={linkBase}
            onClick={() => handleNavClick('/about')}
            aria-current={isActive('/about') ? 'page' : undefined}
          >
            About
          </Link>
          <Link
            href="/services"
            className={linkBase}
            onClick={() => handleNavClick('/services')}
            aria-current={isActive('/services') ? 'page' : undefined}
          >
            Services
          </Link>
          <Link
            href="/get-involved"
            className={linkBase}
            onClick={() => handleNavClick('/get-involved')}
            aria-current={isActive('/get-involved') ? 'page' : undefined}
          >
            Get involved
          </Link>
          <Link
            href="/shop"
            className={linkBase}
            onClick={() => handleNavClick('/shop')}
            aria-current={isActive('/shop') ? 'page' : undefined}
          >
            Shop
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/cart"
            aria-label="Cart"
            className="p-2 rounded-xl border hover:bg-gray-50 flex"
            onClick={() => handleNavClick('/cart')}
            style={{ borderColor: brand.border, color: brand.primary }}
          >
            <TruckIcon />
          </Link>
          <Link
            href="/account"
            aria-label="Profile"
            className="p-2 rounded-xl border hover:bg-gray-50"
            onClick={() => handleNavClick('/account')}
            style={{ borderColor: brand.border, color: brand.primary }}
          >
            <svg xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24" fill="none"
              stroke="currentColor" className="h-5 w-5"
            >
              <circle cx="12" cy="8" r="4" strokeWidth={1.8} />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" strokeWidth={1.8} />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
