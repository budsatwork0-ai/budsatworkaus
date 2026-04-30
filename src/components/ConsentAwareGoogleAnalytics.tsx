'use client';

import { GoogleAnalytics } from '@next/third-parties/google';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cookie-consent';

export function ConsentAwareGoogleAnalytics({ gaId }: { gaId?: string }) {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const syncConsent = () => {
      setAccepted(localStorage.getItem(STORAGE_KEY) === 'accepted');
    };

    syncConsent();
    window.addEventListener('cookie-consent-change', syncConsent);
    return () => window.removeEventListener('cookie-consent-change', syncConsent);
  }, []);

  if (!gaId || !accepted) return null;

  return <GoogleAnalytics gaId={gaId} />;
}
