'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/app/ui/theme';

interface SessionWarningModalProps {
  onStaySignedIn: () => void;
}

const COUNTDOWN_S = 60;

export function SessionWarningModal({ onStaySignedIn }: SessionWarningModalProps) {
  const [seconds, setSeconds] = useState(COUNTDOWN_S);

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1));
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-black/10 overflow-hidden"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-warning-title"
      >
        {/* Countdown bar */}
        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-1 transition-all duration-1000"
            style={{
              width: `${(seconds / COUNTDOWN_S) * 100}%`,
              background: seconds > 20 ? brand.primary : '#ef4444',
            }}
          />
        </div>

        <div className="px-6 py-5">
          {/* Icon */}
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(15,61,46,0.08)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={brand.primary} strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>

          <h2 id="session-warning-title" className="text-base font-semibold text-slate-900 mb-1">
            Still there?
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            Your session will lock in{' '}
            <span className="font-semibold" style={{ color: seconds <= 20 ? '#ef4444' : brand.primary }}>
              {seconds}s
            </span>{' '}
            due to inactivity. Your progress is saved.
          </p>

          <button
            onClick={onStaySignedIn}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: brand.primary }}
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
