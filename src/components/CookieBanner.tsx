'use client';

import { useEffect, useState } from 'react';
import { publicTheme } from '@/lib/design-system/themes';

const STORAGE_KEY = 'cookie-consent';

export type CookieConsent = 'accepted' | { analytics: boolean };

function saveConsent(value: CookieConsent) {
  localStorage.setItem(STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value));
  window.dispatchEvent(new Event('cookie-consent-change'));
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analytics, setAnalytics] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  const acceptAll = () => {
    saveConsent('accepted');
    setVisible(false);
  };

  const savePreferences = () => {
    saveConsent({ analytics });
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className={`fixed bottom-0 left-0 right-0 z-50 ${publicTheme.glassSoft}`}
    >
      <div className="mx-auto max-w-7xl px-6 py-4">
        {!showPrefs ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <p className="text-sm" style={{ color: publicTheme.color.text }}>
              We use optional analytics cookies to understand site traffic. See our{' '}
              <a href="/privacy" className="underline hover:no-underline" style={{ color: publicTheme.color.primary }}>
                Privacy Policy
              </a>
              .
            </p>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => setShowPrefs(true)}
                className="text-sm font-medium px-4 py-2 rounded-full border transition-colors hover:bg-black/5"
                style={{ borderColor: publicTheme.color.border, color: publicTheme.color.muted }}
              >
                Manage preferences
              </button>
              <button
                onClick={acceptAll}
                className="text-sm font-semibold px-4 py-2 rounded-full text-white transition-opacity hover:opacity-90"
                style={{ background: publicTheme.color.primary }}
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <PreferenceRow
                label="Essential cookies"
                description="Required for the site to function. Cannot be disabled."
                enabled={true}
                locked
              />
              <PreferenceRow
                label="Analytics cookies"
                description="Help us understand how visitors use the site (Google Analytics)."
                enabled={analytics}
                onChange={setAnalytics}
              />
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowPrefs(false)}
                className="text-sm font-medium px-4 py-2 rounded-full border transition-colors hover:bg-black/5"
                style={{ borderColor: publicTheme.color.border, color: publicTheme.color.muted }}
              >
                Back
              </button>
              <button
                onClick={savePreferences}
                className="text-sm font-semibold px-4 py-2 rounded-full text-white transition-opacity hover:opacity-90"
                style={{ background: publicTheme.color.primary }}
              >
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PreferenceRow({
  label,
  description,
  enabled,
  locked,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  locked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b last:border-0" style={{ borderColor: publicTheme.color.border }}>
      <div>
        <p className="text-sm font-medium" style={{ color: publicTheme.color.text }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: publicTheme.color.muted }}>{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        disabled={locked}
        onClick={() => onChange?.(!enabled)}
        className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{ background: enabled ? publicTheme.color.primary : publicTheme.color.border }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: enabled ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}
