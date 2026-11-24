'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import type { User } from '@supabase/supabase-js';
import { brand } from './theme';
import { ServicesAuthBar } from '@/components/ServicesAuthBar';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { BOOK_SERVICE_CTA, HOME_HERO_SHEET_TRANSITION, HEADER_LOGO_NOWRAP } from '@/app/ui/home/flags';

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


function BookServiceButton({
  className,
  style,
  onClick,
  tabIndex,
  compact = false,
}: {
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  tabIndex?: number;
  compact?: boolean;
}) {
  return (
    <Link
      href="/services"
      onClick={onClick}
      tabIndex={tabIndex}
      data-cta="book-service"
      className={cx(
        'inline-flex items-center justify-center whitespace-nowrap rounded-full font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        className,
      )}
      style={style}
      aria-label={compact ? 'Book a service' : undefined}
    >
      {compact ? (
        <>
          <span aria-hidden className="min-[400px]:hidden">Book</span>
          <span aria-hidden className="hidden min-[400px]:inline">Book a service</span>
        </>
      ) : 'Book a service'}
    </Link>
  );
}

const navLinks = [
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/faq', label: 'FAQ' },
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

  // On the home page, hide the header Book button while the hero is on screen
  // and fade it in once the user scrolls past it. Other pages show it as normal.
  const [heroOnScreen, setHeroOnScreen] = React.useState(true);
  React.useEffect(() => {
    if (!BOOK_SERVICE_CTA || pathname !== '/') {
      setHeroOnScreen(false);
      return;
    }
    const hero = document.querySelector('[data-home-hero]');
    if (!hero) {
      setHeroOnScreen(false);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => setHeroOnScreen(entry.isIntersecting),
      { threshold: 0 },
    );
    obs.observe(hero);
    return () => obs.disconnect();
  }, [pathname]);

  // Art-directed home (HOME_HERO_SHEET_TRANSITION): the page tells the header
  // whether the canvas behind it is dark, only when that flips (not per pixel).
  const [storyDark, setStoryDark] = React.useState(true);
  React.useEffect(() => {
    if (!HOME_HERO_SHEET_TRANSITION) return;
    const onTone = (e: Event) => setStoryDark(Boolean((e as CustomEvent<{ dark?: boolean }>).detail?.dark));
    window.addEventListener('home:header-tone', onTone);
    return () => window.removeEventListener('home:header-tone', onTone);
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
  const hideHomeBook = isHome && heroOnScreen;
  const storyGlass = HOME_HERO_SHEET_TRANSITION && isHome && scrolled && !menuOpen;
  const lightText = (showLight || (storyGlass && storyDark)) && !menuOpen;

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
            ? (storyGlass ? 'backdrop-blur-md' : 'bg-white/90 backdrop-blur')
            : 'bg-transparent'
        )}
        style={{
          color: lightText ? '#fff' : brand.text,
          background: showLight && !menuOpen
            ? 'rgba(0,0,0,0.12)'
            : storyGlass ? 'rgb(var(--home-canvas, 247 245 240) / 0.74)' : undefined,
        }}
      >
        <div className={HEADER_LOGO_NOWRAP
          ? 'mx-auto max-w-6xl px-5 min-[400px]:px-6 md:px-8 py-5 flex items-center justify-between gap-3'
          : 'mx-auto max-w-6xl px-6 md:px-8 py-5 flex items-center justify-between'}>
          <Link
            href="/"
            className={cx(
              HEADER_LOGO_NOWRAP
                ? 'shrink-0 whitespace-nowrap font-bold text-[22px] min-[400px]:text-2xl transition-colors'
                : 'font-bold text-2xl transition-colors',
              showLight && !menuOpen && 'drop-shadow-md',
            )}
            onClick={() => handleNavClick('/')}
            style={{ color: lightText ? '#fff' : brand.accent }}
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

          <div className={HEADER_LOGO_NOWRAP ? 'flex min-w-0 items-center gap-2 min-[400px]:gap-3' : 'flex items-center gap-3'}>
            {BOOK_SERVICE_CTA && (
              <div
                className={cx(
                  'overflow-hidden transition-[max-width,opacity] duration-300 ease-out',
                  HEADER_LOGO_NOWRAP && onServices && 'hidden md:block',
                  hideHomeBook
                    ? 'max-w-0 opacity-0 pointer-events-none'
                    : 'max-w-[12rem] opacity-100',
                )}
                aria-hidden={hideHomeBook}
              >
                <BookServiceButton
                  onClick={() => handleNavClick('/services')}
                  tabIndex={hideHomeBook ? -1 : undefined}
                  compact={HEADER_LOGO_NOWRAP}
                  style={{
                    background: brand.accent,
                    height: '38px',
                    padding: '0 16px',
                    fontSize: '14px',
                  }}
                />
              </div>
            )}
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
              /* Not authenticated: Log in pill */
              <div className="hidden md:flex items-center gap-3">
                <Link
                  href="/account"
                  aria-label="Log in"
                  className="inline-flex items-center justify-center font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:rounded-full"
                  onClick={() => handleNavClick('/account')}
                  style={{
                    height: '38px',
                    padding: '0 18px',
                    fontSize: '14px',
                    borderRadius: '999px',
                    border: lightText
                      ? '1.5px solid rgba(255,255,255,0.45)'
                      : `1.5px solid ${brand.border}`,
                    color: lightText ? '#fff' : brand.text,
                    background: 'transparent',
                  }}
                >
                  Log in
                </Link>
              </div>
            )}

            {/* Hamburger — mobile only */}
            <button
              className="md:hidden p-2 rounded-xl border transition-colors hover:bg-gray-50"
              style={{
                borderColor: lightText ? 'rgba(255,255,255,0.45)' : brand.border,
                color: lightText ? '#fff' : brand.primary,
              }}
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
                    className="inline-flex items-center justify-center font-semibold transition-colors"
                    style={{
                      height: '40px',
                      padding: '0 20px',
                      fontSize: '14px',
                      borderRadius: '999px',
                      border: `1.5px solid ${brand.border}`,
                      color: brand.text,
                    }}
                  >
                    Log in
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
