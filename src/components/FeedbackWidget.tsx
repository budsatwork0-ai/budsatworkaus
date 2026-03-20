'use client';

import { useState } from 'react';
import { brand } from '@/app/ui/theme';
import FeedbackModal from '@/app/(public)/get-involved/FeedbackModal';

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open feedback form"
          className="flex flex-col items-center gap-2 rounded-l-xl px-2 py-4 text-white shadow-lg transition-opacity hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: brand.primary }}
        >
          {/* Chat bubble icon */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 flex-shrink-0"
          >
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>

          {/* Rotated label */}
          <span
            className="text-xs font-semibold tracking-wide"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Feedback
          </span>
        </button>
      </div>

      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
