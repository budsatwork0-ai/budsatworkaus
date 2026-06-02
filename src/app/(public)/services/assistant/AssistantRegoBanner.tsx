'use client';

import React from 'react';
import { publicTheme } from '@/lib/design-system/themes';;
import type { AssistantAnswers, AssistantAnswerId } from './types';

interface Props {
  answers: AssistantAnswers;
  /**
   * Dispatched when the user clicks "Change" on the banner. Clears the
   * detected-vehicle answers and sends them back to the rego lookup step.
   */
  onChange: () => void;
  /**
   * Used to reset detected-vehicle answers when the user clicks "Change" so
   * the rego lookup step re-renders in its input state.
   */
  onAnswer: (id: AssistantAnswerId, value: string | number) => void;
}

const DETECTED_ANSWER_IDS: AssistantAnswerId[] = [
  'auto_detected_make',
  'auto_detected_model',
  'auto_detected_year',
  'auto_detected_body_style',
  'auto_detected_doors',
  'auto_detected_seats',
  'auto_detected_category',
  'auto_detected_size_category',
];

/**
 * Persisted summary shown on every assistant step AFTER a rego lookup has
 * resolved a vehicle. Gives the user constant visibility that the assistant
 * knows which car they're quoting, with a subtle escape hatch to change it.
 *
 * Renders nothing if the lookup hasn't resolved a vehicle.
 */
export function AssistantRegoBanner({ answers, onChange, onAnswer }: Props) {
  const make = String(answers.auto_detected_make ?? '').trim();
  const model = String(answers.auto_detected_model ?? '').trim();
  const lookupStatus = String(answers.auto_rego_lookup ?? '').trim();

  // Only render when a successful rego lookup produced a real vehicle.
  if (lookupStatus !== 'detected' || !make || !model) return null;

  const plate = String(answers.auto_rego_plate ?? '').trim().toUpperCase();
  const year = String(answers.auto_detected_year ?? '').trim();
  const category = String(
    answers.auto_vehicle_size ?? answers.auto_detected_category ?? '',
  ).trim();
  const categoryLabel =
    category === '4wd'
      ? '4WD'
      : category
      ? category.charAt(0).toUpperCase() + category.slice(1)
      : null;

  const descriptor = [year, `${make} ${model}`, categoryLabel].filter(Boolean).join(' · ');

  const handleChange = () => {
    DETECTED_ANSWER_IDS.forEach((id) => onAnswer(id, ''));
    onAnswer('auto_rego_lookup', '');
    onAnswer('auto_vehicle_size', '');
    onChange();
  };

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2"
      style={{ borderColor: publicTheme.color.accent, background: 'rgba(15,61,46,0.04)' }}
      aria-label="Selected vehicle"
    >
      <div className="min-w-0 flex-1">
        <div
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: publicTheme.color.accent }}
        >
          Vehicle
        </div>
        <div
          className="mt-0.5 truncate text-[13px] font-semibold"
          style={{ color: publicTheme.color.text }}
          title={descriptor}
        >
          {plate ? `${plate} · ${descriptor}` : descriptor}
        </div>
      </div>
      <button
        type="button"
        onClick={handleChange}
        className="flex-shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors hover:bg-black/5"
        style={{ borderColor: publicTheme.color.border, color: publicTheme.color.muted }}
      >
        Change
      </button>
    </div>
  );
}
