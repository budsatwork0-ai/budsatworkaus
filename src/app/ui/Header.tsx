'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { brand } from './theme';

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

function TruckIcon({ className = 'h-6 w-6' }: { className?: string }) {
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

function MenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-6 w-6" strokeWidth={1.8}>
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-6 w-6" strokeWidth={1.8}>
      <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

const navLinks = [
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/faq', label: 'FAQ' },
  { href: '/shop', label: 'Shop' },
  { href: '/get-involved', label: 'Get involved' },
];

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (pathname?.startsWith('/dashboard')) return null;

  const broadcastReset = (silent = false) => {
    try {
      window.dispatchEvent(new CustomEvent('svc:reset', { detail: { silent } }));
    } catch { /* no-op */ }
  };

  const handleNavClick = (targetHref: string) => {
    const onServices = pathname?.startsWith('/services');
    const goingToServices = targetHref === '/services';
    if (goingToServices || onServices) {
      const silent = onServices && goingToServices;
      broadcastReset(silent);
    }
    setMenuOpen(false);
  };

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + '/');

  const isHome = pathname === '/';
  const showLight = isHome && !scrolled;

  const linkBase = 'hover:underline transition-[color,opacity] duration-150';

  return (
    <>
      <header
        className={cx(
          'sticky top-0 z-50 transition-all',
          scrolled || menuOpen
            ? 'bg-white/80 backdrop-blur border-b border-white/70 shadow-[0_10px_30px_rgba(15,23,42,0.08)]'
            : 'bg-transparent border-b border-transparent'
        )}
        style={{ color: showLight && !menuOpen ? '#fff' : brand.text }}
      >
        <div className="mx-auto max-w-6xl px-6 md:px-8 py-5 flex items-center justify-between">
          <Link
            href="/"
            className={cx('font-bold text-2xl transition-colors', showLight && !menuOpen && 'drop-shadow-md')}
            onClick={() => handleNavClick('/')}
            style={{ color: showLight && !menuOpen ? '#fff' : brand.primary }}
          >
            Buds At Work
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-lg font-medium" aria-label="Main">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cx(linkBase, showLight && 'drop-shadow-sm')}
                onClick={() => handleNavClick(link.href)}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/cart"
              aria-label="Cart"
              className={cx(
                'p-2 rounded-xl border flex transition-colors',
                showLight && !menuOpen ? 'border-white/40 hover:bg-white/20' : 'hover:bg-gray-50'
              )}
              onClick={() => handleNavClick('/cart')}
              style={{ borderColor: showLight && !menuOpen ? undefined : brand.border, color: showLight && !menuOpen ? '#fff' : brand.primary }}
            >
              <TruckIcon />
            </Link>
            <Link
              href="/account"
              aria-label="Sign in"
              className={cx(
                'hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors',
                showLight && !menuOpen ? 'border-white/40 hover:bg-white/20 text-white' : 'hover:bg-gray-50'
              )}
              onClick={() => handleNavClick('/account')}
              style={{ borderColor: showLight && !menuOpen ? undefined : brand.border, color: showLight && !menuOpen ? '#fff' : brand.muted }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={1.8}>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
              </svg>
              Sign in
            </Link>

            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2 rounded-xl border transition-colors hover:bg-gray-50"
              style={{ borderColor: brand.border, color: brand.primary }}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav
            className="md:hidden border-t bg-white/95 backdrop-blur px-6 pb-6 pt-4 space-y-1"
            style={{ borderColor: brand.border }}
            aria-label="Mobile"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => handleNavClick(link.href)}
                className={cx(
                  'flex items-center py-3 text-base font-medium border-b transition-colors',
                  isActive(link.href) ? 'font-semibold' : ''
                )}
                style={{
                  borderColor: 'rgba(0,0,0,0.06)',
                  color: isActive(link.href) ? brand.primary : brand.text,
                }}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/account"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 mt-3 pt-3 text-base font-medium transition-colors"
              style={{ color: brand.muted }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={1.8}>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
              </svg>
              Sign in
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}
