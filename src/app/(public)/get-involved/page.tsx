'use client';
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { brand, ui, cx, glass, glassSoft } from '../../ui/theme';
import QualityPartnerForm from './QualityPartnerForm';
import SponsorModal from './SponsorModal';
import FeedbackForm from './FeedbackForm';

const STORAGE_KEY = 'getInvolvedForm.simplified.final2';

/* helpers */
const enc = (s: string) => encodeURIComponent(s);
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/* Icons */
const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function BriefcaseIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
      <path d="M12 12v.01" />
    </svg>
  );
}

function HeartHandIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3.332.892-4.5 2.273A5.824 5.824 0 007.5 3 5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7 7-7z" />
      <path d="M12 5L9.04 7.96a2.5 2.5 0 000 3.54L12 14.5l2.96-2.96a2.5 2.5 0 000-3.54L12 5z" />
    </svg>
  );
}

function BadgeCheckIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M12 2l2.4 2.4h3.4v3.4L20 10l-2.2 2.2v3.4h-3.4L12 18l-2.4-2.4H6.2v-3.4L4 10l2.2-2.2V4.4h3.4L12 2z" />
      <path d="M9 10l2 2 4-4" />
    </svg>
  );
}

function HandshakeIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M20.42 4.58a5.4 5.4 0 00-7.65 0l-.77.78-.77-.78a5.4 5.4 0 00-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z" />
      <path d="M12 5.36L8.87 8.5a2.13 2.13 0 000 3l3.13 3.13 3.13-3.13a2.13 2.13 0 000-3L12 5.36z" />
    </svg>
  );
}

/* Volunteering type icons */
function ChatIcon() {
  return (
    <svg {...iconProps} className="h-4 w-4">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function GraduateIcon() {
  return (
    <svg {...iconProps} className="h-4 w-4">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg {...iconProps} className="h-4 w-4">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 10-16 0" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 7l-10 5L2 7" />
    </svg>
  );
}

function IconWrap({ children, size = 'md' }: { children: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'p-2', md: 'p-3', lg: 'p-4' };
  return (
    <div
      className={cx(
        'grid place-items-center rounded-2xl border border-black/10 bg-white/70 backdrop-blur shadow-[0_10px_26px_rgba(2,6,23,0.06)]',
        sizeClasses[size]
      )}
      style={{ color: brand.primary }}
    >
      {children}
    </div>
  );
}

const VOLUNTEER_TYPES = [
  { icon: <ChatIcon />, label: 'Share advice', description: 'Tips, feedback, or industry knowledge' },
  { icon: <GraduateIcon />, label: 'Mentor our team', description: 'Coaching or guidance on your terms' },
  { icon: <WrenchIcon />, label: 'Test & review', description: 'Try new approaches and tell us what works' },
];

export default function GetInvolvedPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [qualityBusinessName, setQualityBusinessName] = useState('');
  const [qualityContributionTypes, setQualityContributionTypes] = useState<string[]>([]);
  const [qualityMessage, setQualityMessage] = useState('');

  const [consent, setConsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showSponsorModal, setShowSponsorModal] = useState(false);

  /* persistence */
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return;
      const d = JSON.parse(raw);
      setName(d.name ?? '');
      setEmail(d.email ?? '');
      setQualityBusinessName(d.qualityBusinessName ?? '');
      setQualityContributionTypes(Array.isArray(d.qualityContributionTypes) ? d.qualityContributionTypes : []);
      setQualityMessage(d.qualityMessage ?? '');
      setConsent(Boolean(d.consent));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const d = { name, email, qualityBusinessName, qualityContributionTypes, qualityMessage, consent };
      if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch {}
  }, [name, email, qualityBusinessName, qualityContributionTypes, qualityMessage, consent]);

  /* validation */
  const qualityBusinessOk = qualityBusinessName.trim().length > 0;

  const canSubmit = useMemo(() => {
    if (!name.trim()) return false;
    if (!isEmail(email)) return false;
    if (!consent) return false;
    if (!qualityBusinessOk) return false;
    return true;
  }, [name, email, consent, qualityBusinessOk]);

  /* submit */
  function buildBody() {
    const lines: string[] = [];
    lines.push('Role: Quality partner');
    lines.push('Name: ' + name);
    lines.push('Email: ' + email);
    lines.push('Business name: ' + qualityBusinessName);
    if (qualityContributionTypes.length) lines.push('Contribution types: ' + qualityContributionTypes.join(', '));
    if (qualityMessage.trim()) lines.push('Message: ' + qualityMessage.trim());
    lines.push('');
    lines.push('I consent to Buds At Work contacting me about suitable opportunities.');
    return enc(lines.join('\r\n'));
  }

  function openEmailDraft() {
    if (!canSubmit) { setShowErrors(true); return; }
    const subject = enc('Expression of interest');
    window.location.href = `mailto:admin@budsatwork.com?subject=${subject}&body=${buildBody()}`;
  }

  async function submitToApi() {
    if (!canSubmit) { setShowErrors(true); return; }
    setSubmitting(true);
    try {
      const payload = {
        role: 'Quality partner',
        full_name: name.trim(),
        email: email.trim(),
        consent,
        quality_business_name: qualityBusinessName.trim() || null,
        quality_contribution_types: qualityContributionTypes.length ? qualityContributionTypes : null,
        quality_message: qualityMessage.trim() || null,
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
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    } catch {
      openEmailDraft();
    } finally {
      setSubmitting(false);
    }
  }

  /* styles */
  const labelCls = 'text-sm font-medium text-slate-800';
  const helpCls = 'text-xs text-slate-500 leading-relaxed';
  const inputCls = 'mt-1.5 w-full rounded-xl border bg-white/80 backdrop-blur px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-offset-1';
  const chip = cx(
    ui.radius.chip,
    'flex min-h-[44px] items-center justify-center px-4 py-2 border text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2'
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'radial-gradient(900px circle at 20% 5%, rgba(20,83,45,0.12) 0, transparent 50%), radial-gradient(1000px circle at 85% 20%, rgba(125,211,252,0.14) 0, transparent 50%), radial-gradient(800px circle at 40% 80%, rgba(191,232,209,0.18) 0, transparent 55%)',
        }}
      />

      <div className="mx-auto max-w-6xl px-6 md:px-8 py-12 md:py-16 space-y-12">
        {/* Hero */}
        <header className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
            <span className="h-2 w-2 rounded-full" style={{ background: brand.primary }} />
            <span style={{ color: brand.primary }}>Get involved</span>
            <span className="text-slate-600">Share your expertise or support our mission</span>
          </div>

          <h1
            className="mt-6 text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.1]"
            style={{ color: brand.text }}
          >
            Work with purpose.
            <span className="block" style={{ color: brand.primary }}>
              Make a difference.
            </span>
          </h1>

          <p className="mt-5 text-base md:text-lg leading-relaxed max-w-2xl" style={{ color: brand.muted }}>
            {"Help us improve our work or support our mission — no obligation, just real impact. Looking for paid work? Sign up below."}
          </p>
        </header>

        {/* Work Redirect Cards */}
        <section>
          <div className="text-sm font-semibold mb-4" style={{ color: brand.text }}>
            Looking for paid work?
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: <BriefcaseIcon />, title: 'Join the crew', tagline: 'Paid work on your terms', description: 'Pick the work you like and set your own availability.' },
              { icon: <HeartHandIcon />, title: 'Support others', tagline: 'Help crew members thrive', description: 'Drive and support crew members with flexible scheduling.' },
            ].map(({ icon, title, tagline, description }) => (
              <Link
                key={title}
                href="/account/join"
                className="group flex items-start gap-4 rounded-3xl p-5 border border-black/10 bg-white/60 shadow-[0_10px_30px_rgba(2,6,23,0.06)] hover:bg-white/80 hover:shadow-[0_16px_40px_rgba(2,6,23,0.1)] transition-all backdrop-blur"
              >
                <div className="inline-flex rounded-2xl p-3 bg-white/70 flex-shrink-0" style={{ color: brand.primary }}>
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-base font-semibold" style={{ color: brand.text }}>{title}</div>
                    <svg className="h-4 w-4 flex-shrink-0 opacity-40 group-hover:opacity-70 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="text-xs font-medium mt-0.5" style={{ color: brand.primary }}>{tagline}</div>
                  <p className="text-xs text-slate-500 mt-1">{description}</p>
                  <span className="inline-block mt-2 text-xs font-semibold underline underline-offset-2" style={{ color: brand.primary }}>Create a staff account →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Volunteer & Sponsor Feature Section */}
        <section>
          <div className="text-sm font-semibold mb-4" style={{ color: brand.text }}>
            Or contribute your expertise
          </div>
          <div className={cx('rounded-3xl p-6 sm:p-8', glass)}>
            <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">

              {/* Volunteer — dominant left block */}
              <div className="lg:col-span-2">
                <div className="flex items-center gap-4">
                  <IconWrap size="lg"><BadgeCheckIcon /></IconWrap>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight" style={{ color: brand.text }}>
                      Improve our work
                    </h2>
                    <p className="text-sm font-medium mt-0.5" style={{ color: brand.primary }}>
                      Volunteer your expertise
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-relaxed" style={{ color: brand.muted }}>
                  Share advice, mentor, or give feedback to help us deliver better cleaning, yard care, and car detailing.
                </p>

                {/* Feature items */}
                <div className="mt-5 grid sm:grid-cols-3 gap-3">
                  {VOLUNTEER_TYPES.map(({ icon, label, description }) => (
                    <div
                      key={label}
                      className="rounded-2xl border p-3"
                      style={{ borderColor: `${brand.primary}20`, backgroundColor: `${brand.primary}06` }}
                    >
                      <div className="flex items-center gap-2 mb-1" style={{ color: brand.primary }}>
                        {icon}
                        <span className="text-sm font-semibold">{label}</span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: brand.muted }}>{description}</p>
                    </div>
                  ))}
                </div>

                {/* Microcopy */}
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
                  {['Takes just a few minutes', 'No accounts needed', 'Your input makes a real difference'].map((t) => (
                    <span key={t} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="h-1 w-1 rounded-full flex-shrink-0" style={{ background: brand.primary }} />
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Sponsor — secondary right block */}
              <div className="lg:col-span-1 flex flex-col justify-between rounded-2xl border p-5"
                style={{ borderColor: brand.border, backgroundColor: 'rgba(255,255,255,0.6)' }}
              >
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="grid place-items-center rounded-xl border border-black/10 bg-white/70 backdrop-blur p-2 shadow-[0_6px_16px_rgba(2,6,23,0.06)]"
                      style={{ color: brand.primary }}
                    >
                      <HandshakeIcon />
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: brand.text }}>Support Buds At Work</div>
                      <div className="text-xs font-medium" style={{ color: brand.primary }}>Support our mission</div>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: brand.muted }}>
                    Help us grow and reach more people while making a real impact in our community.
                  </p>
                  <p className="text-[11px] mt-2 italic" style={{ color: brand.muted }}>
                    No pressure — just learn how you can help.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSponsorModal(true)}
                  className="mt-4 w-full py-2.5 px-4 rounded-2xl text-sm font-semibold border transition-all hover:shadow-[0_8px_20px_rgba(20,83,45,0.15)] active:scale-[0.98]"
                  style={{ borderColor: brand.primary, color: brand.primary, backgroundColor: `${brand.primary}08` }}
                >
                  Learn how to support →
                </button>
              </div>

            </div>
          </div>
        </section>

        {/* Main Form */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form Column */}
          <div className="lg:col-span-2 space-y-8">

            {/* Your Details */}
            <div className={cx('rounded-3xl p-6', glassSoft)}>
              <div className="flex items-center gap-3 mb-6">
                <IconWrap size="sm"><UserIcon /></IconWrap>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: brand.text }}>Your details</h3>
                  <p className="text-xs text-slate-500">{"We'll use this to get in touch"}</p>
                </div>
              </div>

              <div className="grid gap-5">
                <div>
                  <label className={labelCls}>
                    Full name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jackson Taylor"
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
              </div>
            </div>

            {/* Volunteer Form */}
            <div className={cx('rounded-3xl p-6', glassSoft)}>
              <div className="flex items-center gap-3 mb-6">
                <IconWrap size="sm"><BadgeCheckIcon /></IconWrap>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: brand.text }}>How you want to help</h3>
                  <p className="text-xs text-slate-500">Share advice, tips, or feedback</p>
                </div>
              </div>
              <QualityPartnerForm
                businessName={qualityBusinessName}
                setBusinessName={setQualityBusinessName}
                contributionTypes={qualityContributionTypes}
                setContributionTypes={setQualityContributionTypes}
                message={qualityMessage}
                setMessage={setQualityMessage}
                showErrors={showErrors}
                chipClassName={chip}
                labelClassName={labelCls}
                helpClassName={helpCls}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className={cx('rounded-3xl p-6 sticky top-6', glass)}>
              <div className="flex items-center gap-3 mb-4">
                <IconWrap size="sm"><MailIcon /></IconWrap>
                <h2 className="text-lg font-semibold" style={{ color: brand.text }}>
                  Send your details
                </h2>
              </div>

              <p className="text-sm text-slate-600 mb-4">
                No accounts needed. We&apos;ll save your expression of interest and get in touch.
              </p>

              {/* Status indicator */}
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium mb-5"
                style={{
                  borderColor: canSubmit ? '#16a34a40' : '#f59e0b40',
                  backgroundColor: canSubmit ? '#16a34a10' : '#f59e0b10',
                  color: canSubmit ? '#15803d' : '#b45309',
                }}
              >
                <span
                  className="h-2 w-2 rounded-full animate-pulse"
                  style={{ backgroundColor: canSubmit ? '#16a34a' : '#f59e0b' }}
                />
                {canSubmit ? 'Ready to send' : 'Complete required fields'}
              </div>

              {/* Steps */}
              <ol className="space-y-3 mb-5">
                {[
                  { step: 1, text: 'Fill in the form above' },
                  { step: 2, text: 'Hit submit when ready' },
                  { step: 3, text: 'We review and get in touch' },
                ].map(({ step, text }) => (
                  <li key={step} className="flex items-start gap-3">
                    <span
                      className="flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold"
                      style={{ backgroundColor: '#0F3D2E15', color: brand.primary }}
                    >
                      {step}
                    </span>
                    <span className="text-sm text-slate-700 pt-0.5">{text}</span>
                  </li>
                ))}
              </ol>

              {/* Errors */}
              {showErrors && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 space-y-1">
                  {!name.trim() && <p>• Add your full name</p>}
                  {!isEmail(email) && <p>• Add a valid email</p>}
                  {!qualityBusinessName.trim() && <p>• Add your business name</p>}
                  {!consent && <p>• Tick the consent checkbox</p>}
                </div>
              )}

              {/* Consent */}
              <label className="flex items-start gap-3 cursor-pointer mb-5">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-slate-300 text-[#0F3D2E] focus:ring-[#0F3D2E]"
                />
                <span className="text-sm text-slate-700">
                  {"It's okay for Buds At Work to contact me about work or opportunities."}
                </span>
              </label>

              {/* Actions */}
              {submitted ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                  <p className="text-sm font-semibold text-emerald-800">Thank you!</p>
                  <p className="text-xs text-emerald-700 mt-1">
                    Your expression of interest has been received. We&apos;ll be in touch soon.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-3">
                    <button
                      onClick={submitToApi}
                      disabled={submitting}
                      className="w-full py-3.5 px-5 rounded-2xl font-semibold text-white shadow-[0_12px_30px_rgba(20,83,45,0.25)] transition-all hover:shadow-[0_16px_40px_rgba(20,83,45,0.3)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ backgroundColor: brand.primary }}
                    >
                      {submitting ? 'Submitting...' : 'Submit expression of interest'}
                    </button>
                    <button
                      type="button"
                      onClick={openEmailDraft}
                      className="w-full py-3 px-5 rounded-2xl font-semibold border bg-white/70 backdrop-blur hover:bg-white transition-colors"
                      style={{ borderColor: brand.border, color: brand.text }}
                    >
                      Or send via email instead
                    </button>
                  </div>

                  <p className="mt-4 text-xs text-slate-500">
                    Trouble submitting? Send an email directly to{' '}
                    <a href="mailto:admin@budsatwork.com" className="underline underline-offset-2">
                      admin@budsatwork.com
                    </a>
                  </p>
                </>
              )}

              <div className="mt-6 pt-5 border-t border-black/10">
                <p className="text-xs text-slate-500">
                  We only keep what we need and never sell your details. Ask us to delete them anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Website Feedback & Ideas */}
      <section className="mx-auto w-full max-w-2xl px-4 pb-16">
        <div
          className="rounded-3xl border bg-white/70 backdrop-blur-xl p-6 sm:p-8 shadow-[0_16px_48px_rgba(2,6,23,0.06)]"
          style={{ borderColor: brand.border }}
        >
          <div className="flex items-start gap-4 mb-6">
            <div
              className="flex-shrink-0 grid place-items-center rounded-2xl p-3 border border-black/10 bg-white/70 backdrop-blur shadow-[0_10px_26px_rgba(2,6,23,0.06)]"
              style={{ color: brand.primary }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: brand.text }}>
                Share feedback or an idea
              </h2>
              <p className="mt-1 text-sm" style={{ color: brand.muted }}>
                Found something broken? Got a cool idea to trial? Send it through and we&apos;ll take a look.
              </p>
            </div>
          </div>
          <FeedbackForm />
        </div>
      </section>

      <SponsorModal open={showSponsorModal} onClose={() => setShowSponsorModal(false)} />
    </div>
  );
}
