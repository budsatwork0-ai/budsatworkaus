'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { motion, AnimatePresence } from 'framer-motion';
import type { BudActivityEvent, BudActivityEventType } from '@/lib/bud/types';

const EVENT_CONFIG: Record<BudActivityEventType, { dot: string; label: string }> = {
  investigation: { dot: 'bg-amber-400',   label: 'Investigation' },
  repair:        { dot: 'bg-orange-400',  label: 'Repair' },
  deployment:    { dot: 'bg-emerald-400', label: 'Deployment' },
  learning:      { dot: 'bg-teal-400',    label: 'Learning' },
  approval:      { dot: 'bg-violet-400',  label: 'Approval' },
  delegation:    { dot: 'bg-blue-400',    label: 'Delegation' },
  detection:     { dot: 'bg-red-400',     label: 'Detection' },
  completion:    { dot: 'bg-emerald-500', label: 'Completion' },
  error:         { dot: 'bg-red-500',     label: 'Error' },
};

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

interface Props {
  initial: BudActivityEvent[];
}

export function BudActivityFeed({ initial }: Props) {
  const [events, setEvents] = useState<BudActivityEvent[]>(initial);
  const [filter, setFilter] = useState<BudActivityEventType | 'all'>('all');

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const channel = supabase
      .channel('bud-activity-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bud_activity_feed' }, (p) => {
        const e = p.new as BudActivityEvent;
        setEvents((cur) => [e, ...cur].slice(0, 100));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = filter === 'all' ? events : events.filter((e) => e.event_type === filter);

  const filterTypes: Array<BudActivityEventType | 'all'> = [
    'all', 'investigation', 'repair', 'detection', 'completion', 'learning',
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-4 pb-3 flex-wrap flex-shrink-0">
        {filterTypes.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
              filter === t
                ? 'bg-slate-900 text-white border-slate-900'
                : 'text-slate-500 border-slate-200 hover:border-slate-400'
            }`}
          >
            {t === 'all' ? 'All' : EVENT_CONFIG[t]?.label ?? t}
          </button>
        ))}
      </div>

      {/* Events */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-0">
        {filtered.length === 0 && (
          <p className="text-[11px] text-slate-400 px-4 py-3 italic">
            No activity yet. Activate Bud to start narration.
          </p>
        )}
        <AnimatePresence initial={false}>
          {filtered.map((event) => {
            const cfg = EVENT_CONFIG[event.event_type as BudActivityEventType] ?? { dot: 'bg-slate-400', label: event.event_type };
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2.5 px-4 py-2.5 border-b border-black/[0.04] last:border-0 hover:bg-black/[0.01] transition-colors"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0 mt-1.5`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-700 leading-relaxed">{event.narrative}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{relTime(event.created_at)}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
