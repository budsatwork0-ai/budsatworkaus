'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { motion, AnimatePresence } from 'framer-motion';
import type { BudState, BudLobbyState } from '@/lib/bud/types';

const BUD_STATE_CONFIG: Record<BudState, {
  label: string;
  description: string;
  color: string;
  pulseColor: string;
  animate: boolean;
}> = {
  observing:            { label: 'Observing',            description: 'Watching business and agent signals',       color: 'text-emerald-400', pulseColor: 'bg-emerald-400', animate: false },
  thinking:             { label: 'Thinking',             description: 'Analyzing agent workforce status',         color: 'text-blue-400',    pulseColor: 'bg-blue-400',    animate: true },
  investigating:        { label: 'Investigating',        description: 'Deep-diving into agent failures',           color: 'text-amber-400',   pulseColor: 'bg-amber-400',   animate: true },
  planning:             { label: 'Planning',             description: 'Drafting a repair or improvement plan',     color: 'text-violet-400',  pulseColor: 'bg-violet-400',  animate: true },
  repairing:            { label: 'Repairing',            description: 'Executing repair plan',                     color: 'text-orange-400',  pulseColor: 'bg-orange-400',  animate: true },
  testing:              { label: 'Testing',              description: 'Validating changes',                        color: 'text-violet-400',  pulseColor: 'bg-violet-400',  animate: true },
  reviewing:            { label: 'Reviewing',            description: 'Reviewing outputs and decisions',           color: 'text-sky-400',     pulseColor: 'bg-sky-400',     animate: false },
  waiting_for_approval: { label: 'Waiting Approval',     description: 'Repair plan awaiting human sign-off',       color: 'text-yellow-400',  pulseColor: 'bg-yellow-400',  animate: true },
  deploying:            { label: 'Deploying',            description: 'Tracking deployment progress',              color: 'text-emerald-400', pulseColor: 'bg-emerald-400', animate: true },
  learning:             { label: 'Learning',             description: 'Writing operational lessons to memory',     color: 'text-teal-400',    pulseColor: 'bg-teal-400',    animate: false },
  idle:                 { label: 'Idle',                 description: 'Monitoring — all systems nominal',          color: 'text-zinc-400',    pulseColor: 'bg-zinc-400',    animate: false },
  verifying:            { label: 'Verifying',            description: 'Confirming repair was successful',          color: 'text-cyan-400',    pulseColor: 'bg-cyan-400',    animate: true },
  blocked:              { label: 'Blocked',              description: 'Stuck — requires human intervention',       color: 'text-red-400',     pulseColor: 'bg-red-400',     animate: true },
  repaired:             { label: 'Repaired',             description: 'Issue resolved and verified',               color: 'text-green-400',   pulseColor: 'bg-green-400',   animate: false },
  needs_human_approval: { label: 'Needs Approval',       description: 'Repair plan awaiting human sign-off',       color: 'text-yellow-400',  pulseColor: 'bg-yellow-400',  animate: true },
};

const STATUS_GLOW: Record<string, string> = {
  nominal:  'ring-emerald-500/20',
  elevated: 'ring-amber-500/20',
  critical: 'ring-red-500/30',
};

interface Props {
  initialState: BudState;
  initialStatus: 'nominal' | 'elevated' | 'critical';
  initialSummary: string | null;
}

export function BudStateDisplay({ initialState, initialStatus, initialSummary }: Props) {
  const [budState, setBudState] = useState<BudState>(initialState);
  const [opStatus, setOpStatus] = useState(initialStatus);
  const [summary, setSummary]   = useState(initialSummary);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const channel = supabase
      .channel('bud-state-display')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bud_lobby_states' }, (p) => {
        if (p.eventType === 'INSERT' || p.eventType === 'UPDATE') {
          const s = p.new as BudLobbyState;
          if (s.is_current) {
            setBudState(s.bud_state);
            setOpStatus(s.operational_status);
            setSummary(s.summary);
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const cfg = BUD_STATE_CONFIG[budState] ?? BUD_STATE_CONFIG.idle;
  const glow = STATUS_GLOW[opStatus] ?? STATUS_GLOW.nominal;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-black/[0.06] bg-white/90 backdrop-blur ring-1 ${glow} shadow-[0_2px_16px_rgba(2,6,23,0.06)]`}>
      {/* State indicator */}
      <div className="relative flex-shrink-0">
        <span className={`w-2.5 h-2.5 rounded-full ${cfg.pulseColor} block ${cfg.animate ? 'animate-pulse' : ''}`} />
      </div>

      {/* State label */}
      <AnimatePresence mode="wait">
        <motion.div
          key={budState}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-2 min-w-0"
        >
          <span className={`text-[11px] font-semibold ${cfg.color}`}>Bud</span>
          <span className="text-[11px] text-slate-400">·</span>
          <span className={`text-[11px] font-medium ${cfg.color}`}>{cfg.label}</span>
          <span className="text-[10px] text-slate-400 hidden sm:block">—</span>
          <span className="text-[10px] text-slate-500 hidden sm:block truncate">{summary ?? cfg.description}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
