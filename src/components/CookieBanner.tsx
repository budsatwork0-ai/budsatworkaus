'use client';

import { useEffect, useState } from 'react';
import { brand, glassSoft } from '@/app/ui/theme';

const STORAGE_KEY = 'cookie-consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, 'declined');
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className={`fixed bottom-0 left-0 right-0 z-50 ${glassSoft}`}
    >
      <div className="mx-auto max-w-7xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <p className="text-sm" style={{ color: brand.text }}>
          We use cookies to analyse site traffic via Google Analytics. By continuing you agree to our{' '}
          <a href="/privacy" className="underline hover:no-underline" style={{ color: brand.primary }}>
            Privacy Policy
          </a>
          .
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={decline}
            className="text-sm font-medium px-4 py-2 rounded-full border transition-colors hover:bg-black/5"
            style={{ borderColor: brand.border, color: brand.muted }}
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="text-sm font-semibold px-4 py-2 rounded-full text-white transition-opacity hover:opacity-90"
            style={{ background: brand.primary }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
