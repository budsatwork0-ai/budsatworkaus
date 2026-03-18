'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { brand, cx } from '../../ui/theme';

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function HandshakeIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M20.42 4.58a5.4 5.4 0 00-7.65 0l-.77.78-.77-.78a5.4 5.4 0 00-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z" />
      <path d="M12 5.36L8.87 8.5a2.13 2.13 0 000 3l3.13 3.13 3.13-3.13a2.13 2.13 0 000-3L12 5.36z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ToolsIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg {...iconProps} className="h-10 w-10">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

const SPONSOR_OPTS = [
  { icon: <CalendarIcon />, label: 'Fund events or initiatives', description: 'Help us run community events and local programs.' },
  { icon: <ToolsIcon />, label: 'Donate tools or resources', description: 'Equipment, supplies, or in-kind support for our crew.' },
  { icon: <UsersIcon />, label: 'Partner on community projects', description: 'Collaborate on programs that create real impact.' },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SponsorModal({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = name.trim() && isEmail(email) && consent;

  async function handleSubmit() {
    if (!canSubmit) {
      setShowErrors(true);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        role: 'Sponsor',
        full_name: name.trim(),
        email: email.trim(),
        consent,
        quality_business_name: business.trim() || null,
        quality_message: message.trim() || null,
      };
      const res = await fetch('/api/applicants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Submission failed');
      }
      setSubmitted(true);
    } catch {
      // fallback to mailto
      const lines = [
        'Role: Sponsor',
        `Name: ${name}`,
        `Email: ${email}`,
        business.trim() ? `Business: ${business}` : null,
        message.trim() ? `Message: ${message}` : null,
      ].filter(Boolean).join('\r\n');
      window.location.href = `mailto:admin@budsatwork.com?subject=${encodeURIComponent('Sponsorship enquiry')}&body=${encodeURIComponent(lines)}`;
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    onClose();
    // Reset after animation completes
    setTimeout(() => {
      setName('');
      setEmail('');
      setBusiness('');
      setMessage('');
      setConsent(false);
      setShowErrors(false);
      setSubmitted(false);
    }, 300);
  }

  const inputCls = 'mt-1.5 w-full rounded-xl border bg-white/80 backdrop-blur px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1';
  const labelCls = 'text-sm font-medium text-slate-800';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sponsor-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          style={{ background: 'rgba(2,6,23,0.5)', backdropFilter: 'blur(8px)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sponsor-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <motion.div
            key="sponsor-panel"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white/95 backdrop-blur-2xl border border-black/10 shadow-[0_32px_80px_rgba(2,6,23,0.2)]"
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-black/5 hover:bg-black/10 transition-colors"
              style={{ color: brand.muted }}
              aria-label="Close"
            >
              <CloseIcon />
            </button>

            <div className="p-6 sm:p-8">
              {submitted ? (
                /* Success state */
                <div className="py-8 text-center space-y-4">
                  <div className="flex justify-center" style={{ color: '#16a34a' }}>
                    <CheckCircleIcon />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold" style={{ color: brand.text }}>
                      Thank you for your interest!
                    </h2>
                    <p className="mt-2 text-sm" style={{ color: brand.muted }}>
                      {"We'll be in touch soon to explore how we can work together."}
                    </p>
                  </div>
                  <div
                    className="mx-auto max-w-xs rounded-2xl border px-4 py-3 text-sm font-medium text-center"
                    style={{ borderColor: `${brand.primary}30`, backgroundColor: `${brand.primary}08`, color: brand.primary }}
                  >
                    Your support helps us make a bigger difference.
                  </div>
                  <button
                    onClick={handleClose}
                    className="mt-2 text-sm underline underline-offset-2"
                    style={{ color: brand.muted }}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-start gap-4 mb-6">
                    <div
                      className="flex-shrink-0 grid place-items-center rounded-2xl p-3 border border-black/10 bg-white/70 backdrop-blur shadow-[0_10px_26px_rgba(2,6,23,0.06)]"
                      style={{ color: brand.primary }}
                    >
                      <HandshakeIcon />
                    </div>
                    <div>
                      <h2 id="sponsor-modal-title" className="text-xl font-bold" style={{ color: brand.text }}>
                        Support Buds At Work
                      </h2>
                      <p className="mt-1 text-sm" style={{ color: brand.muted }}>
                        Help us grow and reach more people while making a real impact in our community.
                      </p>
                    </div>
                  </div>

                  {/* Sponsorship options */}
                  <div className="mb-6 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: brand.muted }}>
                      Ways to support us
                    </div>
                    {SPONSOR_OPTS.map(({ icon, label, description }) => (
                      <div
                        key={label}
                        className="flex items-start gap-3 rounded-2xl border px-4 py-3"
                        style={{ borderColor: brand.border, backgroundColor: `${brand.primary}06` }}
                      >
                        <div className="flex-shrink-0 mt-0.5" style={{ color: brand.primary }}>
                          {icon}
                        </div>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: brand.text }}>{label}</div>
                          <div className="text-xs mt-0.5" style={{ color: brand.muted }}>{description}</div>
                        </div>
                      </div>
                    ))}
                    <div
                      className="mt-3 rounded-2xl border px-4 py-3 text-sm font-medium text-center"
                      style={{ borderColor: `${brand.primary}30`, backgroundColor: `${brand.primary}08`, color: brand.primary }}
                    >
                      Your support helps us make a bigger difference.
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-black/8 mb-6" />

                  {/* Form */}
                  <div className="space-y-4">
                    <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: brand.muted }}>
                      Get in touch
                    </div>

                    {showErrors && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 space-y-1">
                        {!name.trim() && <p>• Add your full name</p>}
                        {!isEmail(email) && <p>• Add a valid email address</p>}
                        {!consent && <p>• Tick the consent checkbox</p>}
                      </div>
                    )}

                    <div>
                      <label className={labelCls}>
                        Full name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Alex Johnson"
                        className={inputCls}
                        style={{
                          borderColor: showErrors && !name.trim() ? '#ef4444' : brand.border,
                          outlineColor: brand.focus,
                        }}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>
                        Email <span className="text-rose-500">*</span>
                      </label>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@email.com"
                        inputMode="email"
                        className={inputCls}
                        style={{
                          borderColor: showErrors && !isEmail(email) ? '#ef4444' : brand.border,
                          outlineColor: brand.focus,
                        }}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>Business or organisation</label>
                      <input
                        value={business}
                        onChange={(e) => setBusiness(e.target.value)}
                        placeholder="e.g. Sunrise Community Group (optional)"
                        className={inputCls}
                        style={{ borderColor: brand.border, outlineColor: brand.focus }}
                      />
                    </div>

                    <div>
                      <label className={labelCls}>{"How you'd like to help (optional)"}</label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                        placeholder="Tell us about your idea or what kind of support you have in mind."
                        className={inputCls}
                        style={{ borderColor: brand.border, outlineColor: brand.focus, resize: 'none' }}
                      />
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-0.5 h-5 w-5 rounded border-slate-300 text-[#0F3D2E] focus:ring-[#0F3D2E]"
                      />
                      <span className="text-sm text-slate-700">
                        {"It's okay for Buds At Work to contact me about sponsorship opportunities."}
                      </span>
                    </label>

                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="w-full py-3.5 px-5 rounded-2xl font-semibold text-white shadow-[0_12px_30px_rgba(20,83,45,0.25)] transition-all hover:shadow-[0_16px_40px_rgba(20,83,45,0.3)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ backgroundColor: brand.primary }}
                    >
                      {submitting ? 'Sending...' : 'Send enquiry'}
                    </button>

                    <p className="text-xs text-center" style={{ color: brand.muted }}>
                      No pressure — just learn how you can help.
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
