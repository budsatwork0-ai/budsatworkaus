'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type Agent = {
  id: string;
  name: string;
  description: string;
  category: string;
  autonomy: string;
  status: string;
  schedule: string | null;
};

type Run = { id: string; agent_id: string; status: string; summary: string | null; started_at: string; finished_at: string | null };
type Pending = { id: string; agent_id: string; preview: string; created_at: string };
type Insight = { id: string; agent_id: string; page_path: string | null; title: string; severity: string; created_at: string };

const CAT = {
  sales:      { dot: 'bg-emerald-400', hex: '#10b981', color: 'emerald' },
  support:    { dot: 'bg-sky-400',     hex: '#38bdf8', color: 'sky' },
  ops:        { dot: 'bg-violet-400',  hex: '#a78bfa', color: 'violet' },
  hiring:     { dot: 'bg-amber-400',   hex: '#f59e0b', color: 'amber' },
  finance:    { dot: 'bg-rose-400',    hex: '#f43f5e', color: 'rose' },
  compliance: { dot: 'bg-slate-300',   hex: '#94a3b8', color: 'slate' },
} as const;

// Same desk layout as the standalone preview — keyed by agent id.
const POSITIONS: Record<string, { x: number; y: number; emoji: string }> = {
  // SALES / MARKETING
  'quote-triage':         { x: 60,  y: 90,  emoji: '📥' },
  'copy-optimizer':       { x: 170, y: 90,  emoji: '✍️' },
  'conversion-funnel':    { x: 280, y: 90,  emoji: '🪜' },
  'seo-meta':             { x: 60,  y: 170, emoji: '🔎' },
  'ab-test-architect':    { x: 170, y: 170, emoji: '⚖️' },
  'lead-scorer':          { x: 280, y: 170, emoji: '🎯' },
  'content-agent':        { x: 60,  y: 250, emoji: '📝' },
  'lapsed-win-back':      { x: 170, y: 250, emoji: '🔄' },
  'competitor-watcher':   { x: 280, y: 250, emoji: '🕵️' },
  // SUPPORT
  'customer-reply':       { x: 460, y: 90,  emoji: '💬' },
  'reviews':              { x: 570, y: 90,  emoji: '⭐' },
  'phone-transcriber':    { x: 680, y: 90,  emoji: '📞' },
  'internal-qa':          { x: 460, y: 170, emoji: '🧠' },
  // OPS
  'scheduling':           { x: 60,  y: 410, emoji: '🗓️' },
  'crew-briefing':        { x: 170, y: 410, emoji: '📣' },
  'heatmap-analyst':      { x: 280, y: 410, emoji: '🔥' },
  'layout-critic':        { x: 60,  y: 500, emoji: '📐' },
  'photo-qa':             { x: 170, y: 500, emoji: '📷' },
  'yard-map-geo':         { x: 280, y: 500, emoji: '🛰️' },
  // FINANCE
  'reconciliation':       { x: 460, y: 310, emoji: '💰' },
  'cash-flow-forecaster': { x: 460, y: 400, emoji: '💵' },
  'stripe-dispute-manager': { x: 460, y: 490, emoji: '🛡️' },
  // HIRING
  'applicant-screener':   { x: 650, y: 310, emoji: '🧑‍💼' },
  'crew-coach':           { x: 650, y: 400, emoji: '📈' },
  // COMPLIANCE / DESIGN
  'ndis-compliance':      { x: 60,  y: 680, emoji: '📋' },
  'ndis-plan-matcher':    { x: 170, y: 680, emoji: '🤝' },
  'whs-safety-reminder':  { x: 280, y: 680, emoji: '🦺' },
};

interface Props {
  initial: { agents: Agent[]; runs: Run[]; pending: Pending[]; insights: Insight[] };
}

export function LobbyClient({ initial }: Props) {
  const [agents] = useState<Agent[]>(initial.agents);
  const [runs, setRuns] = useState<Run[]>(initial.runs);
  const [pending, setPending] = useState<Pending[]>(initial.pending);
  const [insights, setInsights] = useState<Insight[]>(initial.insights);
  const [events, setEvents] = useState<Array<{ at: string; agentId: string; type: string; text: string }>>([]);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // Subscribe to realtime changes
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const channel = supabase
      .channel('agent-lobby')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_runs' },
        (p) => {
          const r = p.new as Run;
          setRuns((cur) => [r, ...cur].slice(0, 60));
          pushEvent(r.agent_id, 'started', r.summary ?? 'started');
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agent_runs' },
        (p) => {
          const r = p.new as Run;
          setRuns((cur) => cur.map((x) => (x.id === r.id ? r : x)));
          pushEvent(r.agent_id, r.status, r.summary ?? r.status);
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_actions' },
        (p) => {
          const a = p.new as Pending & { status: string };
          if (a.status === 'pending') {
            setPending((cur) => [a, ...cur]);
            pushEvent(a.agent_id, 'queued', a.preview);
          }
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'design_insights' },
        (p) => {
          const i = p.new as Insight;
          setInsights((cur) => [i, ...cur].slice(0, 20));
          pushEvent(i.agent_id, 'insight', `${i.severity}: ${i.title}`);
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  function pushEvent(agentId: string, type: string, text: string) {
    setEvents((cur) =>
      [{ at: new Date().toISOString(), agentId, type, text }, ...cur].slice(0, 60),
    );
  }

  const workingIds = useMemo(() => new Set(runs.filter((r) => r.status === 'running').map((r) => r.agent_id)), [runs]);
  const pendingByAgent = useMemo(() => {
    const m: Record<string, number> = {};
    pending.forEach((p) => { m[p.agent_id] = (m[p.agent_id] ?? 0) + 1; });
    return m;
  }, [pending]);

  const namedAgents = agents.filter((a) => POSITIONS[a.id]);

  return (
    <div className="min-h-screen text-zinc-100" style={{ background: 'radial-gradient(ellipse at top, #0b1020, #1a1f3d)' }}>
      <header className="border-b border-white/5 backdrop-blur-md bg-black/20 sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-4">
          <div className="font-semibold tracking-wide">⏣ <span className="text-teal-300">Buds At Work</span> · Agent Lobby</div>
          <a href="/dashboard/agents" className="text-sm text-zinc-400 hover:text-white">← back to agents</a>
          <div className="ml-auto text-xs text-zinc-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-3 space-y-4">
          <Card title="Team status">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Online" value={namedAgents.filter((a) => a.status === 'enabled').length} />
              <Stat label="Working" value={workingIds.size} />
              <Stat label="Pending" value={pending.length} accent="amber" />
              <Stat label="Insights 24h" value={insights.length} />
            </div>
          </Card>
          <Card title="Top design insights">
            <ul className="space-y-2 text-sm">
              {insights.slice(0, 6).map((i) => (
                <li key={i.id} className={`border-l-2 pl-2 ${sevBorder(i.severity)}`}>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-400">{i.severity} · {agentName(agents, i.agent_id)}</div>
                  <div className="text-zinc-200">{i.title}</div>
                  {i.page_path && <div className="text-[10px] text-zinc-500">{i.page_path}</div>}
                </li>
              ))}
              {insights.length === 0 && <li className="text-zinc-500">No insights yet — run Heatmap Analyst.</li>}
            </ul>
          </Card>
        </aside>

        <section className="col-span-12 lg:col-span-6">
          <div className="relative rounded-2xl border border-white/10 bg-black/30 overflow-hidden" style={{ aspectRatio: '16 / 16' }}>
            <FloorPlan />
            <div className="absolute inset-0">
              {namedAgents.map((a) => {
                const pos = POSITIONS[a.id];
                const cat = CAT[a.category as keyof typeof CAT] ?? CAT.ops;
                const working = workingIds.has(a.id);
                const queued = pendingByAgent[a.id] ?? 0;
                const currentRun = runs.find((r) => r.agent_id === a.id && r.status === 'running');
                return (
                  <div key={a.id} className="absolute" style={{ left: `${(pos.x / 800) * 100}%`, top: `${(pos.y / 800) * 100}%`, width: 92 }}>
                    <div className="relative">
                      <div className="rounded-md" style={{ background: 'linear-gradient(180deg,#3a4378,#2a3060)', height: 14, boxShadow: '0 12px 0 -4px rgba(0,0,0,0.35), 0 24px 32px -16px rgba(0,0,0,0.5)' }} />
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2">
                        <div className={`w-12 h-9 rounded-sm border-2 border-zinc-700 bg-[#0f1a3d] overflow-hidden flex items-center justify-center text-[8px] font-mono px-1 text-center leading-tight ${working ? 'text-teal-300' : 'text-zinc-600'}`}
                             style={working ? { boxShadow: `0 0 0 2px ${cat.hex}55, 0 0 24px ${cat.hex}77` } : undefined}>
                          {working ? (currentRun?.summary ?? '…').slice(0, 28) : '··'}
                        </div>
                        <div className="w-6 h-1 bg-zinc-700 mx-auto" />
                        <div className="w-10 h-1 bg-zinc-700 mx-auto rounded" />
                      </div>
                      <div className="absolute -top-[58px] -left-1" style={{ animation: 'bob 3s ease-in-out infinite' }}>
                        <div className="text-2xl select-none">{pos.emoji}</div>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${cat.dot} ${working ? 'animate-pulse' : ''}`} />
                        <span className="text-[10px] text-zinc-300 leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{a.name}</span>
                      </div>
                      <div className="text-[9px] text-zinc-500 leading-none mt-0.5">
                        {a.autonomy === 'auto' ? '⚡' : a.autonomy === 'manual' ? '👤' : '✋'}
                        {queued > 0 && ` · ${queued} queued`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-400">
            {Object.entries(CAT).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${v.dot}`} /><span className="capitalize">{k}</span></span>
            ))}
            <span className="ml-auto">⚡ auto · ✋ review · 👤 manual</span>
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-3">
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 h-[640px] flex flex-col">
            <div className="text-xs uppercase tracking-widest text-zinc-400 mb-3">Live event feed</div>
            <div className="space-y-1.5 overflow-y-auto pr-1 text-sm">
              {events.length === 0 && <div className="text-zinc-500 text-sm">Waiting for activity…</div>}
              {events.map((e, idx) => (
                <div key={idx} className={`pl-2 py-0.5 border-l-2 ${typeBorder(e.type)}`}>
                  <div className="text-[10px] text-zinc-500">{new Date(e.at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {e.type}</div>
                  <div className="text-zinc-200"><span className="font-medium">{agentName(agents, e.agentId)}</span> · {e.text}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      <style>{`@keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }`}</style>
    </div>
  );
}

function FloorPlan() {
  return (
    <svg viewBox="0 0 800 800" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <defs>
        {(['sales', 'support', 'ops', 'finance', 'hiring', 'compliance'] as const).map((k) => {
          const v = CAT[k];
          return (
            <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={v.hex} stopOpacity=".18" />
              <stop offset="100%" stopColor={v.hex} stopOpacity=".04" />
            </linearGradient>
          );
        })}
      </defs>
      <rect x="20"  y="40"  width="380" height="290" rx="14" fill="url(#grad-sales)"      stroke="rgba(16,185,129,.4)" />
      <rect x="420" y="40"  width="360" height="200" rx="14" fill="url(#grad-support)"    stroke="rgba(56,189,248,.4)" />
      <rect x="20"  y="360" width="380" height="240" rx="14" fill="url(#grad-ops)"        stroke="rgba(167,139,250,.4)" />
      <rect x="420" y="260" width="170" height="340" rx="14" fill="url(#grad-finance)"    stroke="rgba(244,63,94,.4)" />
      <rect x="610" y="260" width="170" height="340" rx="14" fill="url(#grad-hiring)"     stroke="rgba(245,158,11,.4)" />
      <rect x="20"  y="625" width="760" height="155" rx="14" fill="url(#grad-compliance)" stroke="rgba(148,163,184,.4)" />
      <text x="40"  y="62"  fill="#6ee7b7" fontSize="11" letterSpacing="3" fontWeight="600">SALES / MARKETING</text>
      <text x="440" y="62"  fill="#7dd3fc" fontSize="11" letterSpacing="3" fontWeight="600">SUPPORT</text>
      <text x="40"  y="382" fill="#c4b5fd" fontSize="11" letterSpacing="3" fontWeight="600">OPS</text>
      <text x="440" y="282" fill="#fda4af" fontSize="11" letterSpacing="3" fontWeight="600">FINANCE</text>
      <text x="630" y="282" fill="#fcd34d" fontSize="11" letterSpacing="3" fontWeight="600">HIRING</text>
      <text x="40"  y="647" fill="#cbd5e1" fontSize="11" letterSpacing="3" fontWeight="600">COMPLIANCE / DESIGN</text>
    </svg>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
      <div className="text-xs uppercase tracking-widest text-zinc-400 mb-2">{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: 'amber' }) {
  return (
    <div>
      <div className="text-zinc-400 text-[10px] uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-semibold ${accent === 'amber' ? 'text-amber-300' : ''}`}>{value}</div>
    </div>
  );
}

function agentName(agents: Agent[], id: string) {
  return agents.find((a) => a.id === id)?.name ?? id;
}

function sevBorder(sev: string): string {
  return ({ critical: 'border-rose-400/70', high: 'border-amber-400/70', medium: 'border-sky-400/60', low: 'border-zinc-500/40' } as Record<string, string>)[sev] ?? 'border-zinc-500/40';
}
function typeBorder(t: string): string {
  if (t === 'succeeded' || t === 'executed') return 'border-emerald-400/40';
  if (t === 'queued' || t === 'needs_approval') return 'border-amber-400/40';
  if (t === 'failed') return 'border-rose-400/40';
  if (t === 'insight') return 'border-violet-400/40';
  return 'border-sky-400/40';
}
