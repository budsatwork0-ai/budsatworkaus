'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { publicTheme } from '@/lib/design-system/themes';;
import { M } from '../utils/motion';
import { AssistantQuestion } from './AssistantQuestion';
import { AssistantPriceBanner } from './AssistantPriceBanner';
import { AssistantRegoBanner } from './AssistantRegoBanner';
import type { AssistantAPI } from './types';

interface Props {
  assistant: AssistantAPI;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

// Progress dots
function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            height: 6,
            width: i < current ? 20 : 6,
            background: i < current ? publicTheme.color.accent : publicTheme.color.border,
          }}
        />
      ))}
    </div>
  );
}

export function QuoteAssistantPanel({ assistant }: Props) {
  const isMobile = useIsMobile();

  const slideProps = isMobile
    ? {
        initial: { y: '100%', opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit:    { y: '100%', opacity: 0 },
      }
    : {
        initial: { x: '100%', opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit:    { x: '100%', opacity: 0 },
      };

  const panelClass = isMobile
    ? 'fixed inset-0 z-50 flex flex-col bg-white'
    : 'fixed right-0 top-0 bottom-0 z-50 flex w-[420px] flex-col bg-white shadow-2xl';

  const inServicePick = assistant.service === null;
  const contextIntro = {
    home: {
      label: "Let's get started",
      sub: 'What are you looking for today?',
      complete: "We've built your estimate. Review it and confirm — or adjust anything before booking.",
    },
    commercial: {
      label: 'Commercial quote',
      sub: 'Choose the site service you need.',
      complete: "We've built a commercial estimate. Review access, timing, and site details before submitting.",
    },
    ndis: {
      label: 'NDIS quote',
      sub: 'Choose the participant support needed.',
      complete: "We've built an NDIS estimate. Review routing and participant details before submitting.",
    },
  }[assistant.context];
  const headerLabel = inServicePick
    ? contextIntro.label
    : 'Quote Assistant';
  const headerSub = inServicePick
    ? contextIntro.sub
    : `Step ${assistant.currentStep} of ${assistant.totalSteps}`;

  return (
    <AnimatePresence>
      {assistant.open && (
        <>
          {/* Backdrop — desktop only (subtle), mobile uses full-screen */}
          {!isMobile && (
            <M.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(2,6,23,0.15)' }}
              onClick={assistant.handlers.onClose}
            />
          )}

          {/* Panel */}
          <M.div
            {...slideProps}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
            className={panelClass}
          >
            {/* Header */}
            <div
              className="flex items-start justify-between px-5 py-4"
              style={{ borderBottom: `1px solid ${publicTheme.color.border}` }}
            >
              <div className="flex-1">
                <div
                  className="text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: publicTheme.color.accent }}
                >
                  {headerLabel}
                </div>
                <div className="mt-0.5 text-[13px]" style={{ color: publicTheme.color.muted }}>
                  {headerSub}
                </div>
                {!inServicePick && assistant.totalSteps > 0 && (
                  <div className="mt-2">
                    <ProgressDots
                      current={assistant.currentStep}
                      total={assistant.totalSteps}
                    />
                  </div>
                )}
              </div>

              <button
                onClick={assistant.handlers.onClose}
                aria-label="Close assistant"
                className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm transition-colors hover:bg-black/5"
                style={{ color: publicTheme.color.muted }}
              >
                ✕
              </button>
            </div>

            {/* Question scroll area */}
            <div className="flex-1 overflow-y-auto px-5 py-6">
              {/*
                Persisted rego banner — visible on every auto step AFTER the
                rego lookup resolves. Hidden on the rego-lookup step itself
                (that screen already renders its own vehicle-found card).
              */}
              {assistant.service === 'auto' &&
                assistant.currentQuestion?.id !== 'auto_rego_lookup' && (
                  <div className="mb-4">
                    <AssistantRegoBanner
                      answers={assistant.answers}
                      onChange={assistant.handlers.onJumpToRegoLookup}
                      onAnswer={assistant.handlers.onAnswer}
                    />
                  </div>
                )}

              {assistant.currentQuestion && (
                <AssistantQuestion
                  question={assistant.currentQuestion}
                  answers={assistant.answers}
                  onAnswer={assistant.handlers.onAnswer}
                />
              )}

              {assistant.isComplete && (
                <div className="space-y-3 text-center">
                  <div
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl"
                    style={{ background: publicTheme.color.accentSoft }}
                  >
                    ✓
                  </div>
                  <p className="text-[17px] font-semibold" style={{ color: publicTheme.color.text }}>
                    Your quote is ready
                  </p>
                  <p className="text-[13px]" style={{ color: publicTheme.color.muted }}>
                    {contextIntro.complete}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-5 py-4 space-y-3"
              style={{ borderTop: `1px solid ${publicTheme.color.border}` }}
            >
              {/* Live estimate */}
              {assistant.liveEstimate && (
                <AssistantPriceBanner estimate={assistant.liveEstimate} />
              )}

              {/* Navigation */}
              <div className="flex items-center gap-3">
                {assistant.canGoBack && (
                  <button
                    onClick={assistant.handlers.onBack}
                    className="flex-shrink-0 text-[13px] font-medium underline underline-offset-2 transition-opacity hover:opacity-70"
                    style={{ color: publicTheme.color.muted }}
                  >
                    Back
                  </button>
                )}

                {assistant.isComplete ? (
                  <button
                    onClick={assistant.handlers.onHandoff}
                    className="flex-1 rounded-2xl py-3 text-[14px] font-semibold text-white transition-all active:scale-[0.98]"
                    style={{ background: publicTheme.color.primary }}
                  >
                    Review & confirm quote →
                  </button>
                ) : !inServicePick ? (
                  <button
                    onClick={assistant.handlers.onNext}
                    disabled={!assistant.canAdvance}
                    className="flex-1 rounded-2xl py-3 text-[14px] font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-40"
                    style={{ background: publicTheme.color.primary }}
                  >
                    Next
                  </button>
                ) : null}
              </div>

              {/* Skip */}
              <button
                onClick={assistant.handlers.onDismiss}
                className="block w-full text-center text-[12px] transition-opacity hover:opacity-70"
                style={{ color: publicTheme.color.muted }}
              >
                Skip assistant — I'll do it myself
              </button>
            </div>
          </M.div>
        </>
      )}
    </AnimatePresence>
  );
}
