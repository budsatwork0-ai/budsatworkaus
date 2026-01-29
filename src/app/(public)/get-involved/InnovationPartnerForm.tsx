'use client';

import React from 'react';
import { brand, cx } from '../../ui/theme';

const INTEREST_OPTS = [
  'Shadowing new tools',
  'Remote training',
  'Accessibility innovation',
  'Workflow design',
  'Safety & quality',
  'Other',
] as const;

type Props = {
  organisation: string;
  setOrganisation: (value: string) => void;
  interestAreas: string[];
  setInterestAreas: (value: string[]) => void;
  notes: string;
  setNotes: (value: string) => void;
  chipClassName: string;
  labelClassName: string;
  helpClassName: string;
};

export default function InnovationPartnerForm({
  organisation,
  setOrganisation,
  interestAreas,
  setInterestAreas,
  notes,
  setNotes,
  chipClassName,
  labelClassName,
  helpClassName,
}: Props) {
  const toggleInterest = (opt: string) => {
    const next = interestAreas.includes(opt) ? interestAreas.filter((x) => x !== opt) : [...interestAreas, opt];
    setInterestAreas(next);
  };

  return (
    <>
      <div
        className="rounded-2xl border p-4 bg-white/70 backdrop-blur-2xl shadow-[0_8px_24px_rgba(15,61,46,0.08)]"
        style={{ borderColor: brand.border }}
      >
        <h3 className="text-lg font-semibold" style={{ color: brand.primary }}>
          Help us try new ideas
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Tell us if you want to test new ways of training and support. You might give feedback or try new tools. We’ll
          guide you along the way.
        </p>
        <ul className="mt-3 text-sm text-slate-700 list-disc pl-5 space-y-1">
          <li>Shape new training or support ideas that feel right for your team</li>
          <li>Try short sessions and tell us what works or what feels hard</li>
          <li>Explore accessibility or safety improvements</li>
          <li>Help us think about quality, support, and next steps</li>
        </ul>
      </div>

      <div>
        <label className={labelClassName}>Organisation (optional)</label>
        <input
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
          placeholder="e.g. Business / school / community organisation"
          className="mt-1 w-full rounded-2xl border p-3 bg-white/80 backdrop-blur"
          style={{ borderColor: brand.border, color: brand.text }}
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <span className={labelClassName}>Interest areas</span>
          <span className="text-xs text-slate-500">{interestAreas.length} selected</span>
        </div>
        <p className={helpClassName}>Pick the areas you want to explore.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTEREST_OPTS.map((opt) => {
            const active = interestAreas.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleInterest(opt)}
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
        <label className={labelClassName}>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Tell us what you’d like to try or learn."
          className="mt-1 w-full rounded-2xl border p-3 bg-white/80 backdrop-blur"
          style={{ borderColor: brand.border, color: brand.text }}
        />
      </div>
    </>
  );
}
