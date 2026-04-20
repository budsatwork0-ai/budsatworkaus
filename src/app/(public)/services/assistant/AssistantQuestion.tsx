'use client';

import React from 'react';
import { brand } from '@/app/ui/theme';
import { AssistantRegoLookup } from './AssistantRegoLookup';
import type { QuestionDef, AssistantAnswers, AssistantAnswerId } from './types';

interface Props {
  question: QuestionDef;
  answers: AssistantAnswers;
  onAnswer: (id: AssistantAnswerId, value: string | number) => void;
}

export function AssistantQuestion({ question, answers, onAnswer }: Props) {
  const currentValue = answers[question.id];

  // Must be declared before any conditional return (Rules of Hooks).
  // Sets the stepper default on first render for the current question.
  React.useEffect(() => {
    if (question.kind === 'stepper' && currentValue === undefined && question.defaultValue !== undefined) {
      onAnswer(question.id, question.defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  if (question.kind === 'rego-lookup') {
    return <AssistantRegoLookup question={question} answers={answers} onAnswer={onAnswer} />;
  }

  if (question.kind === 'button-grid') {
    return (
      <div className="space-y-3">
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
        <div className="grid grid-cols-2 gap-2">
          {question.options?.map((opt) => {
            const selected = currentValue === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onAnswer(question.id, opt.value)}
                className="flex flex-col items-start rounded-2xl border px-4 py-3 text-left transition-all duration-150 active:scale-[0.98]"
                style={{
                  borderColor: selected ? brand.primary : brand.border,
                  background: selected ? brand.primary : brand.card,
                  color: selected ? '#fff' : brand.text,
                  boxShadow: selected
                    ? '0 2px 8px rgba(15,61,46,0.18)'
                    : '0 1px 3px rgba(2,6,23,0.04)',
                }}
              >
                <span className="text-[14px] font-medium leading-snug">{opt.label}</span>
                {opt.sublabel && (
                  <span
                    className="mt-0.5 text-[11px] leading-tight"
                    style={{ color: selected ? 'rgba(255,255,255,0.72)' : brand.muted }}
                  >
                    {opt.sublabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Stepper
  const min = question.min ?? 0;
  const max = question.max ?? 99;
  const val = currentValue !== undefined ? Number(currentValue) : (question.defaultValue ?? min);

  const decrement = () => {
    const next = Math.max(min, val - 1);
    onAnswer(question.id, next);
  };

  const increment = () => {
    const next = Math.min(max, val + 1);
    onAnswer(question.id, next);
  };

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

      <div className="flex items-center justify-center gap-6 py-4">
        <button
          onClick={decrement}
          disabled={val <= min}
          className="flex h-12 w-12 items-center justify-center rounded-full border text-xl font-light transition-all disabled:opacity-30"
          style={{ borderColor: brand.border, color: brand.primary }}
          aria-label="Decrease"
        >
          −
        </button>

        <span
          className="min-w-[56px] text-center text-[40px] font-bold tabular-nums leading-none"
          style={{ color: brand.text }}
        >
          {val}
        </span>

        <button
          onClick={increment}
          disabled={val >= max}
          className="flex h-12 w-12 items-center justify-center rounded-full border text-xl font-light transition-all disabled:opacity-30"
          style={{ borderColor: brand.border, color: brand.primary }}
          aria-label="Increase"
        >
          +
        </button>
      </div>
    </div>
  );
}
