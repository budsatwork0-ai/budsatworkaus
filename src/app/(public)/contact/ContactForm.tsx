'use client';

import { useState } from 'react';
import { brand } from '../../ui/theme';

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4z" />
    </svg>
  );
}

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch('/api/leads/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name:    data.get('name'),
          email:   data.get('email'),
          phone:   data.get('phone'),
          service: data.get('service'),
          message: data.get('message'),
          _honey:  data.get('_honey'),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? 'Something went wrong');
      }

      setStatus('success');
      form.reset();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-8 py-10 text-center">
        <p className="text-2xl font-bold" style={{ color: brand.text }}>Message sent!</p>
        <p className="mt-2 text-base" style={{ color: brand.muted }}>
          We&apos;ll get back to you within 2 hours.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-6 text-sm underline-offset-2 hover:underline"
          style={{ color: brand.primary }}
        >
          Send another message
        </button>
      </div>
    );
  }

  const sending = status === 'sending';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Honeypot */}
      <input type="text" name="_honey" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

      {status === 'error' && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2" style={{ color: brand.text }}>
            Your name
          </label>
          <input
            type="text" id="name" name="name" required
            placeholder="John Smith" disabled={sending}
            className="w-full px-4 py-3 rounded-xl border bg-white/80 focus:outline-none focus:ring-2 transition-shadow disabled:opacity-60"
            style={{ borderColor: brand.border, color: brand.text }}
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: brand.text }}>
            Email address
          </label>
          <input
            type="email" id="email" name="email" required
            placeholder="john@example.com" disabled={sending}
            className="w-full px-4 py-3 rounded-xl border bg-white/80 focus:outline-none focus:ring-2 transition-shadow disabled:opacity-60"
            style={{ borderColor: brand.border, color: brand.text }}
          />
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium mb-2" style={{ color: brand.text }}>
          Phone number <span style={{ color: brand.muted }}>(optional)</span>
        </label>
        <input
          type="tel" id="phone" name="phone"
          placeholder="0400 000 000" disabled={sending}
          className="w-full px-4 py-3 rounded-xl border bg-white/80 focus:outline-none focus:ring-2 transition-shadow disabled:opacity-60"
          style={{ borderColor: brand.border, color: brand.text }}
        />
      </div>

      <div>
        <label htmlFor="service" className="block text-sm font-medium mb-2" style={{ color: brand.text }}>
          What service are you interested in?
        </label>
        <select
          id="service" name="service" disabled={sending}
          className="w-full px-4 py-3 rounded-xl border bg-white/80 focus:outline-none focus:ring-2 transition-shadow disabled:opacity-60"
          style={{ borderColor: brand.border, color: brand.text }}
        >
          <option value="">Select a service (optional)</option>
          <option value="home-cleaning">Home Cleaning</option>
          <option value="window-cleaning">Window Cleaning</option>
          <option value="yard-care">Yard Care</option>
          <option value="dump-runs">Dump Runs</option>
          <option value="car-detailing">Laundry &amp; Sneaker Care</option>
          <option value="ndis">NDIS Support</option>
          <option value="other">Other / General Enquiry</option>
        </select>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-2" style={{ color: brand.text }}>
          Your message
        </label>
        <textarea
          id="message" name="message" required rows={5}
          placeholder="Tell us about what you need..."
          disabled={sending}
          className="w-full px-4 py-3 rounded-xl border bg-white/80 focus:outline-none focus:ring-2 transition-shadow resize-none disabled:opacity-60"
          style={{ borderColor: brand.border, color: brand.text }}
        />
      </div>

      <button
        type="submit" disabled={sending}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-semibold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
        style={{ background: brand.primary, color: '#fff' }}
      >
        {sending ? 'Sending…' : <><span>Send message</span><SendIcon /></>}
      </button>
    </form>
  );
}
