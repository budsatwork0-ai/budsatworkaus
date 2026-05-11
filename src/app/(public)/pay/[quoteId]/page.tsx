'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type QuoteDetails = {
  id: string;
  customer_name: string;
  service_label: string;
  context: string;
  amount: number;
  stripe_checkout_url: string | null;
  is_paid: boolean;
  is_cancelled: boolean;
  is_ready: boolean;
  paid_at: string | null;
};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paypal?: any;
  }
}

const PRIMARY = '#0f3d2e';
const MUTED = '#6b7280';

function formatAUD(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);
}

function PayPalButton({
  quoteId,
  amount,
  onSuccess,
  onError,
}: {
  quoteId: string;
  amount: number;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  useEffect(() => {
    if (rendered.current || !containerRef.current || !window.paypal) return;
    rendered.current = true;

    window.paypal
      .Buttons({
        style: {
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'paypal',
          height: 48,
        },
        createOrder: async () => {
          const res = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quote_id: quoteId }),
          });
          const data = await res.json() as { order_id?: string; error?: string };
          if (!res.ok || !data.order_id) throw new Error(data.error ?? 'Failed to create PayPal order');
          return data.order_id;
        },
        onApprove: async (data: { orderID: string }) => {
          const res = await fetch(`/api/paypal/capture-order/${data.orderID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quote_id: quoteId }),
          });
          const result = await res.json() as { success?: boolean; error?: string };
          if (!res.ok || !result.success) throw new Error(result.error ?? 'Payment capture failed');
          onSuccess();
        },
        onError: (err: Error) => {
          onError(err?.message ?? 'PayPal encountered an error. Please try again.');
        },
        onCancel: () => {
          // Customer cancelled — no action needed
        },
      })
      .render(containerRef.current);

    return () => {
      rendered.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ minHeight: 50 }} />;
}

export default function PayPage() {
  const params = useParams();
  const quoteId = typeof params?.quoteId === 'string' ? params.quoteId : '';
  const router = useRouter();

  const [quote, setQuote] = useState<QuoteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const paypalMode = process.env.NEXT_PUBLIC_PAYPAL_MODE === 'live' ? '' : '-sandbox';

  // Load quote details
  useEffect(() => {
    if (!quoteId) return;
    fetch(`/api/pay/${quoteId}`)
      .then((r) => r.json())
      .then((data: QuoteDetails & { error?: string }) => {
        if (data.error) { setError(data.error); return; }
        setQuote(data);
        if (data.is_paid) setPaid(true);
      })
      .catch(() => setError('Could not load payment details. Please try again.'))
      .finally(() => setLoading(false));
  }, [quoteId]);

  // Load PayPal SDK
  useEffect(() => {
    if (!clientId || !quoteId) return;
    if (window.paypal) { setPaypalReady(true); return; }

    const script = document.createElement('script');
    script.src = `https://www.paypal${paypalMode}.com/sdk/js?client-id=${clientId}&currency=AUD&components=buttons`;
    script.async = true;
    script.onload = () => setPaypalReady(true);
    script.onerror = () => {}; // PayPal unavailable — silent, Stripe still works
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, [clientId, quoteId, paypalMode]);

  const handlePaypalSuccess = () => {
    setPaid(true);
    router.push(`/services/checkout/success?paypal=1&quote_id=${quoteId}`);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f8f7' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${PRIMARY}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'radial-gradient(900px 500px at 30% -10%, #dff3ea 0%, transparent 60%), #f6f8f7',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '48px 16px 80px',
  };

  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: 20,
    border: '1px solid #e5e7eb',
    boxShadow: '0 12px 40px rgba(15,61,46,0.10)',
    maxWidth: 480,
    width: '100%',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    padding: '24px 28px 20px',
    borderBottom: '1px solid #f0f0f0',
  };

  const bodyStyle: React.CSSProperties = { padding: '24px 28px 32px' };

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>
            <span style={{ fontSize: 17, fontWeight: 700, color: PRIMARY, fontFamily: 'system-ui, sans-serif' }}>Buds At Work</span>
          </div>
          <div style={{ ...bodyStyle, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <p style={{ fontSize: 15, color: '#374151', marginBottom: 8 }}>We couldn&apos;t load your payment page.</p>
            <p style={{ fontSize: 13, color: MUTED, marginBottom: 24 }}>{error}</p>
            <a href="mailto:admin@budsatwork.com" style={{ color: PRIMARY, fontWeight: 600, fontSize: 14 }}>
              Contact us → admin@budsatwork.com
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!quote) return null;

  if (paid || quote.is_paid) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>
            <span style={{ fontSize: 17, fontWeight: 700, color: PRIMARY, fontFamily: 'system-ui, sans-serif' }}>Buds At Work</span>
          </div>
          <div style={{ ...bodyStyle, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: PRIMARY, margin: '0 0 8px', fontFamily: 'system-ui, sans-serif' }}>Payment received!</h1>
            <p style={{ fontSize: 14, color: MUTED, margin: '0 0 24px' }}>
              Thanks {quote.customer_name}. We&apos;ll be in touch to confirm your booking.
            </p>
            <Link href="/portal" style={{ display: 'inline-block', background: PRIMARY, color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '10px 22px', fontWeight: 600, fontSize: 14 }}>
              View your bookings →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (quote.is_cancelled) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={headerStyle}>
            <span style={{ fontSize: 17, fontWeight: 700, color: PRIMARY, fontFamily: 'system-ui, sans-serif' }}>Buds At Work</span>
          </div>
          <div style={{ ...bodyStyle, textAlign: 'center' }}>
            <p style={{ fontSize: 15, color: '#374151', marginBottom: 8 }}>This quote has been cancelled.</p>
            <a href="mailto:admin@budsatwork.com" style={{ color: PRIMARY, fontWeight: 600, fontSize: 14 }}>
              Contact us if you need help → admin@budsatwork.com
            </a>
          </div>
        </div>
      </div>
    );
  }

  const contextLabel = quote.context === 'commercial' ? 'Commercial' : quote.context === 'ndis' ? 'NDIS' : 'Residential';

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: PRIMARY, fontFamily: 'system-ui, sans-serif' }}>Buds At Work</span>
            <span style={{ fontSize: 11, background: '#ecfdf5', color: '#065f46', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>Secure checkout</span>
          </div>
        </div>

        <div style={bodyStyle}>
          {/* Quote summary */}
          <div style={{ background: '#f8fbf9', borderRadius: 14, padding: '16px 18px', marginBottom: 24 }}>
            <p style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px', fontFamily: 'system-ui, sans-serif' }}>Your booking</p>
            <p style={{ fontSize: 15, fontWeight: 600, color: PRIMARY, margin: '0 0 2px', fontFamily: 'system-ui, sans-serif' }}>
              {contextLabel} {quote.service_label}
            </p>
            <p style={{ fontSize: 12, color: MUTED, margin: '0 0 12px' }}>For {quote.customer_name}</p>
            <p style={{ fontSize: 11, color: MUTED, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total due</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: PRIMARY, margin: 0, fontFamily: 'system-ui, sans-serif' }}>{formatAUD(quote.amount)}</p>
          </div>

          {/* Stripe option */}
          {quote.stripe_checkout_url && (
            <div style={{ marginBottom: 16 }}>
              <a
                href={quote.stripe_checkout_url}
                style={{
                  display: 'block',
                  background: PRIMARY,
                  color: '#fff',
                  textDecoration: 'none',
                  borderRadius: 12,
                  padding: '14px 20px',
                  fontWeight: 600,
                  fontSize: 15,
                  textAlign: 'center',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                Pay with Card, Afterpay or Zip
              </a>
              <p style={{ fontSize: 11, color: MUTED, textAlign: 'center', margin: '6px 0 0' }}>
                Also accepts Apple Pay &amp; Google Pay
              </p>
            </div>
          )}

          {/* Divider */}
          {quote.stripe_checkout_url && clientId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
              <span style={{ fontSize: 12, color: MUTED }}>or</span>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            </div>
          )}

          {/* PayPal option */}
          {clientId && (
            <div>
              {paypalReady ? (
                <PayPalButton
                  quoteId={quote.id}
                  amount={quote.amount}
                  onSuccess={handlePaypalSuccess}
                  onError={(msg) => setPaypalError(msg)}
                />
              ) : (
                <div style={{ height: 48, background: '#f0f4ff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 13, color: MUTED }}>Loading PayPal…</span>
                </div>
              )}
              {paypalError && (
                <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8, textAlign: 'center' }}>{paypalError}</p>
              )}
            </div>
          )}

          <p style={{ fontSize: 11, color: MUTED, textAlign: 'center', marginTop: 20, marginBottom: 0 }}>
            Questions? Email us at{' '}
            <a href="mailto:admin@budsatwork.com" style={{ color: PRIMARY }}>admin@budsatwork.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
