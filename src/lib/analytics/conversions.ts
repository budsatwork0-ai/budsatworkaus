// Google Ads conversion tracking.
// Set NEXT_PUBLIC_GOOGLE_ADS_ID in .env.local (format: AW-XXXXXXXXXX).
// Set NEXT_PUBLIC_GOOGLE_ADS_QUOTE_LABEL and NEXT_PUBLIC_GOOGLE_ADS_PAYMENT_LABEL
// from your Google Ads conversion actions.

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gtag?: (...args: any[]) => void;
  }
}

function gtag(...args: unknown[]) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args);
  }
}

export function trackQuoteSubmitted(value?: number) {
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_QUOTE_LABEL;
  if (!adsId || !label) return;
  gtag('event', 'conversion', {
    send_to: `${adsId}/${label}`,
    value: value ?? 0,
    currency: 'AUD',
  });
}

export function trackPaymentCompleted(value?: number) {
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_PAYMENT_LABEL;
  if (!adsId || !label) return;
  gtag('event', 'conversion', {
    send_to: `${adsId}/${label}`,
    value: value ?? 0,
    currency: 'AUD',
  });
}
