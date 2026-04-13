'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import type { User } from '@supabase/supabase-js';
import { brand } from './theme';
import { ServicesAuthBar } from '@/components/ServicesAuthBar';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

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

function portalLink(user: User) {
  const role = user.app_metadata?.role as string | undefined;
  if (role === 'admin') return { href: '/dashboard', label: 'My dashboard' };
  if (role === 'employee') return { href: '/crew', label: 'My crew' };
  return { href: '/portal', label: 'My portal' };
}

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [user, setUser] = React.useState<User | null>(null);

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

  // Track auth state
  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // onAuthStateChange fires INITIAL_SESSION immediately with the current session,
    // so a separate getUser() call is redundant and causes a double state-set on mount.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (pathname?.startsWith('/dashboard')) return null;

  const onServices = pathname?.startsWith('/services');

  const broadcastReset = (silent = false) => {
    try {
      window.dispatchEvent(new CustomEvent('svc:reset', { detail: { silent } }));
    } catch { /* no-op */ }
  };

  const handleNavClick = (targetHref: string) => {
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

  // Derived user display info (only used when not on /services)
  const firstName = (user?.user_metadata?.full_name as string)?.split(' ')[0];
  const initials = firstName
    ? firstName.slice(0, 2).toUpperCase()
    : (user?.email ?? '').slice(0, 2).toUpperCase() || '?';
  const portal = user ? portalLink(user) : null;

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
            {onServices ? (
              /* Services page: ServicesAuthBar handles auth inline */
              <ServicesAuthBar inline />
            ) : user ? (
              /* Authenticated: show user pill */
              <div className="hidden md:flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-black/10 bg-white/90 backdrop-blur shadow-sm">
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ background: brand.primary }}
                >
                  {initials}
                </div>
                <span className="text-xs font-medium" style={{ color: brand.text }}>
                  {firstName}
                </span>
                <Link
                  href={portal!.href}
                  className="text-xs font-semibold ml-0.5 hover:underline"
                  style={{ color: brand.primary }}
                >
                  {portal!.label} →
                </Link>
              </div>
            ) : (
              /* Not authenticated: Log in + Sign up */
              <>
                <Link
                  href="/account"
                  aria-label="Log in"
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
                  Log in
                </Link>
                <Link
                  href="/account/sign-up"
                  className={cx(
                    'hidden md:inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
                    showLight && !menuOpen
                      ? 'bg-white/20 hover:bg-white/30 text-white border border-white/40'
                      : 'text-white hover:opacity-90'
                  )}
                  onClick={() => handleNavClick('/account/sign-up')}
                  style={showLight && !menuOpen ? undefined : { background: brand.primary }}
                >
                  Sign up
                </Link>
              </>
            )}

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

            {/* Mobile auth row */}
            <div className="flex items-center gap-3 mt-3 pt-3">
              {user ? (
                <>
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                    style={{ background: brand.primary }}
                  >
                    {initials}
                  </div>
                  <span className="text-sm font-medium" style={{ color: brand.text }}>{firstName}</span>
                  <Link
                    href={portal!.href}
                    onClick={() => setMenuOpen(false)}
                    className="ml-auto text-sm font-semibold hover:underline"
                    style={{ color: brand.primary }}
                  >
                    {portal!.label} →
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 text-base font-medium transition-colors"
                    style={{ color: brand.muted }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5" strokeWidth={1.8}>
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                    </svg>
                    Log in
                  </Link>
                  <Link
                    href="/account/sign-up"
                    onClick={() => setMenuOpen(false)}
                    className="ml-auto inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
                    style={{ background: brand.primary }}
                  >
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
