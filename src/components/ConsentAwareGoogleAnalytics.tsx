'use client';

import { GoogleAnalytics } from '@next/third-parties/google';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cookie-consent';

function analyticsAllowed(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  if (raw === 'accepted') return true;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && parsed.analytics === true;
  } catch {
    return false;
  }
}

export function ConsentAwareGoogleAnalytics({ gaId }: { gaId?: string }) {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const syncConsent = () => setAccepted(analyticsAllowed());
    syncConsent();
    window.addEventListener('cookie-consent-change', syncConsent);
    return () => window.removeEventListener('cookie-consent-change', syncConsent);
  }, []);

  if (!gaId || !accepted) return null;

  return <GoogleAnalytics gaId={gaId} />;
}
