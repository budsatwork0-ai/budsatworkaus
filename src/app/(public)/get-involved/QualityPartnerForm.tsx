'use client';

import React from 'react';
import { brand, cx } from '../../ui/theme';

const CONTRIBUTION_OPTS = [
  'Training & procedures',
  'Equipment demos',
  'Mentorship',
  'Quality improvement',
  'Other',
] as const;

type Props = {
  businessName: string;
  setBusinessName: (value: string) => void;
  contributionTypes: string[];
  setContributionTypes: (value: string[]) => void;
  message: string;
  setMessage: (value: string) => void;
  showErrors: boolean;
  chipClassName: string;
  labelClassName: string;
  helpClassName: string;
};

export default function QualityPartnerForm({
  businessName,
  setBusinessName,
  contributionTypes,
  setContributionTypes,
  message,
  setMessage,
  showErrors,
  chipClassName,
  labelClassName,
  helpClassName,
}: Props) {
  const toggleContribution = (opt: string) => {
    const next = contributionTypes.includes(opt)
      ? contributionTypes.filter((x) => x !== opt)
      : [...contributionTypes, opt];
    setContributionTypes(next);
  };

  return (
    <>
      <div
        className="rounded-2xl border p-4 bg-white/70 backdrop-blur-2xl shadow-[0_8px_24px_rgba(15,61,46,0.08)]"
        style={{ borderColor: brand.border }}
      >
        <h3 className="text-lg font-semibold" style={{ color: brand.primary }}>
          Help us improve our work
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Tell us how you or your business can help Buds at Work do better cleaning, yard care, or car work. Share
          advice, tips, or honest feedback.
        </p>
        <ul className="mt-3 text-sm text-slate-700 list-disc pl-5 space-y-1">
          <li>Share ideas for safety, tools, or how we work</li>
          <li>Show better ways to clean, care for yards, or detail cars</li>
          <li>Offer mentoring or coaching when you have time</li>
          <li>Tell us how we can listen and learn</li>
        </ul>
      </div>

      <div>
        <label className={labelClassName}>
          Business name<span className="text-rose-600">*</span>
        </label>
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g. ACME Detailing Supplies"
          className="mt-1 w-full rounded-2xl border p-3 bg-white/80 backdrop-blur"
          style={{
            borderColor: showErrors && !businessName.trim() ? '#ef4444' : brand.border,
            color: brand.text,
          }}
          aria-invalid={showErrors && !businessName.trim()}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className={labelClassName}>Contribution type</span>
          <span className="text-xs text-slate-500">{contributionTypes.length} selected</span>
        </div>
        <p className={helpClassName}>Pick the ways you can help.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CONTRIBUTION_OPTS.map((opt) => {
            const active = contributionTypes.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleContribution(opt)}
                className={cx(chipClassName, active && 'border-transparent')}
                style={{
                  borderColor: active ? 'transparent' : brand.border,
                  backgroundColor: active ? '#0F3D2E15' : 'white',
                  color: active ? brand.primary : brand.muted,
                }}
                aria-pressed={active}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className={labelClassName}>Message (optional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Let us know your idea, availability, or links."
          className="mt-1 w-full rounded-2xl border p-3 bg-white/80 backdrop-blur"
          style={{ borderColor: brand.border, color: brand.text }}
        />
      </div>
    </>
  );
}
