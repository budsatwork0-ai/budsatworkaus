'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon } from './AuthIcons';

interface AuthSplitLayoutProps {
  children: React.ReactNode;
  showBackLink?: boolean;
  /** 'customer' = green lawn panel (default), 'staff' = navy crew panel */
  variant?: 'customer' | 'staff';
}

function LawnIllustration() {
  return (
    <svg viewBox="0 0 280 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-56 h-56 md:w-64 md:h-64">
      {/* Soft background glows */}
      <circle cx="140" cy="148" r="115" fill="white" fillOpacity="0.03" />
      <circle cx="140" cy="148" r="85" fill="white" fillOpacity="0.04" />

      {/* Ground */}
      <ellipse cx="140" cy="248" rx="120" ry="16" fill="#1d7a4e" fillOpacity="0.7" />
      {/* Grass hill behind house */}
      <path d="M25 248 Q90 214 140 222 Q190 214 255 248 Z" fill="#1a6644" fillOpacity="0.8" />

      {/* House body */}
      <rect x="96" y="158" width="88" height="88" rx="3" fill="white" fillOpacity="0.14" />

      {/* Roof */}
      <path d="M86 162 L140 112 L194 162 Z" fill="white" fillOpacity="0.22" />

      {/* Chimney */}
      <rect x="163" y="120" width="13" height="32" rx="2" fill="white" fillOpacity="0.18" />

      {/* Door */}
      <path d="M128 246 L128 200 Q140 193 152 200 L152 246 Z" fill="white" fillOpacity="0.28" />

      {/* Left window */}
      <rect x="101" y="170" width="24" height="18" rx="3" fill="white" fillOpacity="0.22" />
      <line x1="113" y1="170" x2="113" y2="188" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" />
      <line x1="101" y1="179" x2="125" y2="179" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" />

      {/* Right window */}
      <rect x="155" y="170" width="24" height="18" rx="3" fill="white" fillOpacity="0.22" />
      <line x1="167" y1="170" x2="167" y2="188" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" />
      <line x1="155" y1="179" x2="179" y2="179" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" />

      {/* Left tree trunk */}
      <rect x="57" y="198" width="8" height="48" rx="2" fill="white" fillOpacity="0.16" />
      {/* Left tree crown */}
      <circle cx="61" cy="186" r="22" fill="#22a06b" fillOpacity="0.45" />
      <circle cx="61" cy="178" r="16" fill="#2abf7f" fillOpacity="0.45" />
      <circle cx="52" cy="184" r="13" fill="#22a06b" fillOpacity="0.38" />
      <circle cx="70" cy="184" r="13" fill="#22a06b" fillOpacity="0.38" />

      {/* Right tree trunk */}
      <rect x="215" y="198" width="8" height="48" rx="2" fill="white" fillOpacity="0.16" />
      {/* Right tree crown */}
      <circle cx="219" cy="186" r="22" fill="#22a06b" fillOpacity="0.45" />
      <circle cx="219" cy="178" r="16" fill="#2abf7f" fillOpacity="0.45" />
      <circle cx="210" cy="184" r="13" fill="#22a06b" fillOpacity="0.38" />
      <circle cx="228" cy="184" r="13" fill="#22a06b" fillOpacity="0.38" />

      {/* Lawnmower */}
      <rect x="150" y="234" width="38" height="13" rx="6.5" fill="white" fillOpacity="0.2" />
      <circle cx="157" cy="249" r="5.5" fill="white" fillOpacity="0.26" />
      <circle cx="182" cy="249" r="5.5" fill="white" fillOpacity="0.26" />
      <rect x="179" y="225" width="7" height="16" rx="2.5" fill="white" fillOpacity="0.16" />

      {/* Sun */}
      <circle cx="228" cy="55" r="14" fill="#f0c842" fillOpacity="0.32" />
      <circle cx="228" cy="55" r="9" fill="#f0c842" fillOpacity="0.42" />
      <line x1="228" y1="35" x2="228" y2="30" stroke="#f0c842" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
      <line x1="228" y1="75" x2="228" y2="80" stroke="#f0c842" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
      <line x1="208" y1="55" x2="203" y2="55" stroke="#f0c842" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
      <line x1="248" y1="55" x2="253" y2="55" stroke="#f0c842" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
      <line x1="214" y1="41" x2="210" y2="37" stroke="#f0c842" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" />
      <line x1="242" y1="41" x2="246" y2="37" stroke="#f0c842" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" />

      {/* Leaf decor top-left */}
      <path d="M52 65 C52 48 68 46 70 61 C78 46 94 50 88 65 C80 82 54 78 52 65 Z" fill="white" fillOpacity="0.16" />
      <line x1="52" y1="65" x2="70" y2="61" stroke="white" strokeOpacity="0.12" strokeWidth="1.5" />

      {/* Leaf decor top-right (smaller) */}
      <path d="M190 38 C192 26 203 27 202 39 C208 27 220 30 215 43 C209 56 192 50 190 38 Z" fill="white" fillOpacity="0.16" />

      {/* Sparkle star (top) */}
      <path d="M145 28 L147.5 35 L155 35 L149 40 L151.5 47 L145 42.5 L138.5 47 L141 40 L135 35 L142.5 35 Z" fill="white" fillOpacity="0.25" />

      {/* Sparkle star (right) */}
      <path d="M258 148 L260 153.5 L266 153.5 L261.5 157 L263.5 163 L258 159.5 L252.5 163 L254.5 157 L250 153.5 L256 153.5 Z" fill="white" fillOpacity="0.22" />

      {/* Sparkle star (left) */}
      <path d="M22 148 L24 153.5 L30 153.5 L25.5 157 L27.5 163 L22 159.5 L16.5 163 L18.5 157 L14 153.5 L20 153.5 Z" fill="white" fillOpacity="0.22" />

      {/* Decorative dots */}
      <circle cx="36" cy="120" r="3" fill="white" fillOpacity="0.3" />
      <circle cx="244" cy="110" r="3" fill="white" fillOpacity="0.3" />
      <circle cx="42" cy="80" r="2" fill="white" fillOpacity="0.22" />
      <circle cx="238" cy="190" r="2" fill="white" fillOpacity="0.22" />
      <circle cx="20" cy="175" r="2.5" fill="white" fillOpacity="0.2" />
      <circle cx="260" cy="195" r="2" fill="white" fillOpacity="0.18" />
      <circle cx="108" cy="100" r="2" fill="white" fillOpacity="0.2" />
      <circle cx="172" cy="96" r="2" fill="white" fillOpacity="0.2" />

      {/* Diamond/X decorative shapes */}
      <path d="M30 95 L35 100 L30 105 L25 100 Z" fill="white" fillOpacity="0.2" />
      <path d="M250 88 L255 93 L250 98 L245 93 Z" fill="white" fillOpacity="0.2" />
      <path d="M62 260 L66 264 L62 268 L58 264 Z" fill="white" fillOpacity="0.18" />
      <path d="M218 264 L222 268 L218 272 L214 268 Z" fill="white" fillOpacity="0.18" />
    </svg>
  );
}

const PANEL_CONFIG = {
  customer: {
    gradient: 'linear-gradient(155deg, #0F3D2E 0%, #1a5c44 55%, #0c2e21 100%)',
    heading: 'Bookings Simplified.',
    subheading: 'Professional care, booked in minutes.',
    badge: null,
  },
  staff: {
    gradient: 'linear-gradient(155deg, #0f1d3a 0%, #1a2f55 55%, #0b1528 100%)',
    heading: 'Join our crew.',
    subheading: 'Flexible work, real earnings.',
    badge: 'Staff Portal',
  },
} as const;

export function AuthSplitLayout({ children, showBackLink = true, variant = 'customer' }: AuthSplitLayoutProps) {
  const panel = PANEL_CONFIG[variant];
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const mobileLabel = variant === 'customer' ? 'Customer Portal' : 'Staff Portal';
  const mobileBadgeColor = variant === 'customer'
    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
    : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20';

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] py-2">
      <div className="w-full max-w-4xl rounded-3xl overflow-hidden flex shadow-[0_24px_64px_rgba(2,6,23,0.22)]" style={{ minHeight: 580 }}>

        {/* Left: illustration panel — fades in on mount so the colour change feels intentional */}
        <div
          className={`hidden md:flex md:w-[44%] flex-col items-center justify-between relative overflow-hidden py-10 transition-opacity duration-500 ${entered ? 'opacity-100' : 'opacity-0'}`}
          style={{ background: panel.gradient }}
        >
          {/* dot grid overlay */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />

          {/* Staff badge */}
          {panel.badge && (
            <div className="relative z-10 mb-0">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-white/15 bg-white/10 text-white/80">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                </svg>
                {panel.badge}
              </span>
            </div>
          )}

          <div className="relative z-10 flex flex-col items-center flex-1 justify-center w-full">
            <LawnIllustration />
          </div>

          <div className="relative z-10 text-center px-8">
            <p className="text-white font-bold text-lg leading-snug">{panel.heading}</p>
            <p className="text-white/45 text-sm mt-1.5">{panel.subheading}</p>
          </div>
        </div>

        {/* Right: form panel */}
        <div
          className="flex-1 flex flex-col justify-center px-8 py-10 md:px-12"
          style={{ background: '#0F172A' }}
        >
          {/* Mobile-only portal badge — the illustration panel is hidden on small screens */}
          <div className="md:hidden flex justify-center mb-6">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${mobileBadgeColor}`}>
              {mobileLabel}
            </span>
          </div>

          {children}

          {showBackLink && (
            <div className="mt-8 text-center">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                <ArrowLeftIcon />
                Back to home
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
