'use client';

import React from 'react';
import { brand } from '@/app/ui/theme';
import { useRegoLookup } from '@/app/ui/car/useRegoLookup';
import { classifyVehicle } from '@/lib/rego/classify';
import type { RegoState, VehicleCategory } from '@/lib/rego/types';
import type { AssistantAnswerId, AssistantAnswers, QuestionDef } from './types';

const STATES: RegoState[] = ['QLD'];

type Props = {
  question: QuestionDef;
  answers: AssistantAnswers;
  onAnswer: (id: AssistantAnswerId, value: string | number) => void;
};

type DetectedVehicle = {
  make: string;
  model: string;
  year: number | null;
  bodyStyle: string;
  doors: number | null;
  seats: number | null;
} | null;

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

function mapDetectedCategory(category: string | null | undefined): VehicleCategory | null {
  const key = String(category ?? '').trim().toLowerCase();
  switch (key) {
    case 'sedan':
      return 'sedan';
    case 'hatch':
      return 'hatch';
    case 'suv':
      return 'suv';
    case 'ute':
      return 'ute';
    case 'van':
      return 'van';
    case '4wd':
    case '4x4':
    case 'awd':
      return '4wd';
    case 'luxury':
      return 'luxury';
    case 'muscle':
      return 'muscle';
    default:
      return null;
  }
}

function readDetectedVehicle(answers: AssistantAnswers): DetectedVehicle {
  const make = String(answers.auto_detected_make ?? '').trim();
  const model = String(answers.auto_detected_model ?? '').trim();
  if (!make || !model) return null;

  const readNullableNumber = (value: string | number | undefined) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  return {
    make,
    model,
    year: readNullableNumber(answers.auto_detected_year),
    bodyStyle: String(answers.auto_detected_body_style ?? ''),
    doors: readNullableNumber(answers.auto_detected_doors),
    seats: readNullableNumber(answers.auto_detected_seats),
  };
}

export function AssistantRegoLookup({ question, answers, onAnswer }: Props) {
  const { loading, error, meta, lookup, reset } = useRegoLookup();
  const detectedVehicle = React.useMemo(() => readDetectedVehicle(answers), [answers]);
  const detectedCategory = String(answers.auto_vehicle_size ?? answers.auto_detected_category ?? '').trim();
  const [rego, setRego] = React.useState(String(answers.auto_rego_plate ?? ''));
  const [state, setState] = React.useState<RegoState>(
    (answers.auto_rego_state as RegoState | undefined) ?? 'QLD',
  );

  const clearDetectedAnswers = React.useCallback(() => {
    DETECTED_ANSWER_IDS.forEach((id) => onAnswer(id, ''));
    onAnswer('auto_rego_lookup', '');
    onAnswer('auto_vehicle_size', '');
  }, [onAnswer]);

  const handleLookup = React.useCallback(async () => {
    const cleanedRego = rego.trim().toUpperCase();
    const vehicle = await lookup({ registrationNumber: cleanedRego, state });
    if (!vehicle) return;

    const classification = classifyVehicle(vehicle);
    const inferredCategory =
      mapDetectedCategory(vehicle.category) ??
      (classification.category !== 'unknown' ? classification.category : null);
    const sizeCategory = vehicle.sizeCategory ?? classification.sizeCategory ?? null;

    onAnswer('auto_rego_lookup', 'detected');
    onAnswer('auto_rego_plate', cleanedRego);
    onAnswer('auto_rego_state', state);
    onAnswer('auto_detected_make', vehicle.make);
    onAnswer('auto_detected_model', vehicle.model);
    onAnswer('auto_detected_year', vehicle.year ?? '');
    onAnswer('auto_detected_body_style', vehicle.bodyStyle ?? '');
    onAnswer('auto_detected_doors', vehicle.doors ?? '');
    onAnswer('auto_detected_seats', vehicle.seats ?? '');
    onAnswer('auto_detected_category', inferredCategory ?? '');
    onAnswer('auto_detected_size_category', sizeCategory ?? '');
    if (inferredCategory) {
      onAnswer('auto_vehicle_size', inferredCategory);
    }
  }, [lookup, onAnswer, rego, state]);

  const handleManual = React.useCallback(() => {
    reset();
    clearDetectedAnswers();
    onAnswer('auto_rego_lookup', 'manual');
    onAnswer('auto_rego_plate', rego.trim().toUpperCase());
    onAnswer('auto_rego_state', state);
  }, [clearDetectedAnswers, onAnswer, rego, reset, state]);

  const handleReset = React.useCallback(() => {
    reset();
    clearDetectedAnswers();
    setRego('');
  }, [clearDetectedAnswers, reset]);

  const categoryLabel =
    detectedCategory === '4wd'
      ? '4WD'
      : detectedCategory
      ? detectedCategory.charAt(0).toUpperCase() + detectedCategory.slice(1)
      : null;
  const sourceLabel =
    meta?.source === 'memory' || meta?.source === 'session'
      ? 'Saved result'
      : meta?.source === 'cache'
      ? 'Fast cache hit'
      : meta?.source === 'mock'
      ? 'Demo result'
      : 'Live lookup';
  const speedLabel = meta?.durationMs ? `${(meta.durationMs / 1000).toFixed(meta.durationMs < 1000 ? 1 : 0)}s` : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[17px] font-semibold leading-snug" style={{ color: brand.text }}>
          {question.prompt}
        </p>
        {question.hint && (
          <p className="mt-1 text-[13px]" style={{ color: brand.muted }}>
            {question.hint}
          </p>
        )}
      </div>

      {detectedVehicle ? (
        <div
          className="rounded-2xl border px-4 py-4"
          style={{ borderColor: brand.accent, background: 'rgba(15,61,46,0.04)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: brand.accent }}>
                Vehicle Found
              </div>
              <div className="mt-1 text-[18px] font-semibold" style={{ color: brand.text }}>
                {detectedVehicle.make} {detectedVehicle.model}
              </div>
              <div className="mt-1 text-[13px]" style={{ color: brand.muted }}>
                {[
                  detectedVehicle.year,
                  detectedVehicle.bodyStyle,
                  detectedVehicle.doors && `${detectedVehicle.doors} door`,
                  detectedVehicle.seats && `${detectedVehicle.seats} seats`,
                ].filter(Boolean).join(' • ')}
              </div>
              {detectedCategory && (
                <div className="mt-2 rounded-xl px-3 py-2 text-[12px] font-medium" style={{ color: brand.accent, background: 'rgba(15,61,46,0.06)' }}>
                  Vehicle type set to {categoryLabel}. Next step: choose your detailing package.
                </div>
              )}
              <div className="mt-2 text-[12px]" style={{ color: brand.muted }}>
                {sourceLabel}{speedLabel ? ` · ${speedLabel}` : ''}
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-black/5"
              style={{ borderColor: brand.border, color: brand.muted }}
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              className="flex-1 rounded-2xl border px-4 py-3 text-[14px] font-semibold uppercase tracking-wider outline-none transition-all focus:ring-2"
              style={{
                borderColor: brand.border,
                color: brand.text,
                boxShadow: 'none',
              }}
              placeholder="Enter rego (e.g. ABC123)"
              value={rego}
              onChange={(e) => setRego(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleLookup();
                }
              }}
              disabled={loading}
            />

            <select
              className="rounded-2xl border px-3 py-3 text-[14px] outline-none transition-all focus:ring-2"
              style={{ borderColor: brand.border, color: brand.text, background: brand.card }}
              value={state}
              onChange={(e) => setState(e.target.value as RegoState)}
              disabled={loading}
            >
              {STATES.map((regoState) => (
                <option key={regoState} value={regoState}>
                  {regoState}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleLookup}
            disabled={loading || !rego.trim()}
            className="w-full rounded-2xl py-3 text-[14px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-40"
            style={{ background: brand.primary }}
          >
            {loading ? 'Looking up vehicle...' : 'Look up vehicle'}
          </button>

          {loading && (
            <div
              className="rounded-2xl px-3 py-2 text-[12px]"
              style={{ background: 'rgba(15,61,46,0.05)', color: brand.muted }}
            >
              Checking rego and matching your vehicle type. Repeat lookups now use saved results when available.
            </div>
          )}

          <button
            type="button"
            onClick={handleManual}
            className="w-full rounded-2xl border py-3 text-[13px] font-medium transition-colors hover:bg-black/5"
            style={{ borderColor: brand.border, color: brand.muted }}
          >
            Skip lookup and choose vehicle type manually
          </button>

          {error && (
            <div
              className="rounded-2xl px-3 py-2 text-[12px]"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
