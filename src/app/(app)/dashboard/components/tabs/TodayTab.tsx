'use client';

/**
 * TodayTab
 * --------
 * Merges the Schedule and Dispatch tabs into a single "Today" view — matching
 * the Operations Obsidian morning checklist flow:
 *   1. Open Schedule tab → review today's jobs
 *   2. Open Dispatch tab → confirm all jobs have crew assigned + address confirmed
 *
 * Default view is the split-pane so both are visible simultaneously. The admin
 * can switch to full-width if they need more space on either panel.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ScheduleTab from './ScheduleTab';
import DispatchTab from './DispatchTab';

type TodayView = 'split' | 'schedule' | 'dispatch';

const VIEWS: { key: TodayView; label: string; icon: string }[] = [
  { key: 'split',    label: 'Split view',     icon: '⊞' },
  { key: 'schedule', label: 'Schedule',       icon: '📅' },
  { key: 'dispatch', label: 'Dispatch queue', icon: '📋' },
];

export default function TodayTab() {
  const [view, setView] = useState<TodayView>('split');

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                view === v.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>{v.icon}</span>
              <span>{v.label}</span>
            </button>
          ))}
        </div>

        {view === 'split' && (
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Schedule left · Dispatch queue right
          </p>
        )}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {view === 'split' ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Schedule panel */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Schedule</span>
                  <div className="flex-1 h-px bg-black/5" />
                </div>
                <ScheduleTab />
              </div>

              {/* Dispatch panel */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Dispatch Queue</span>
                  <div className="flex-1 h-px bg-black/5" />
                </div>
                <DispatchTab />
              </div>
            </div>
          ) : view === 'schedule' ? (
            <ScheduleTab />
          ) : (
            <DispatchTab />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
