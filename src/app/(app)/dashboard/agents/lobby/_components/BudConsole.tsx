'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { WORKFLOWS } from '@/lib/agents/workflows';
import type { AgentLifecycleState } from '@/lib/agents/agents/bud';
import type { BudState } from '@/lib/bud/types';

// ── Domain types ─────────────────────────────────────────────────────────────

type OperationalStatus = 'nominal' | 'elevated' | 'critical';
type ViewMode = 'sections' | 'workflows';

interface LobbySection {
  id: string;
  label: string;
  priority: number;
  visible: boolean;
  agent_ids: string[];
  workflow_ids: string[];
  status: 'nominal' | 'elevated' | 'critical';
  reason?: string;
}

interface WorkflowStatus {
  id: string;
  label: string;
  domain: string;
  type: string;
  active: boolean;
  bottleneck_agent_id: string | null;
  chain: string[];
  runs_24h: number;
  active_agents: string[];
}

interface LobbyKPIs {
  agents_active: number;
  agents_degraded: number;
  agents_awaiting_review: number;
  pending_approvals: number;
  total_runs_24h: number;
  total_cost_cents_24h: number;
  active_workflows: number;
}

interface BudLobbyState {
  id: string;
  generated_at: string;
  operational_status: OperationalStatus;
  bud_state: BudState;
  summary: string;
  sections: LobbySection[];
  workflows: WorkflowStatus[];
  kpis: LobbyKPIs;
  agent_states: Record<string, AgentLifecycleState>;
}

interface AgentRow {
  id: string;
  name: string;
  description: string;
  category: string;
  autonomy: string;
  status: string;
}

interface RunRow {
  id: string;
  agent_id: string;
  status: string;
  summary: string | null;
  started_at: string;
  finished_at: string | null;
}

interface ActionRow {
  id: string;
  agent_id: string;
  preview: string;
  created_at: string;
}

interface InsightRow {
  id: string;
  agent_id: string | null;
  workflow_id: string | null;
  category: string;
  severity: string;
  title: string;
  created_at: string;
}

interface LiveEvent {
  id: string;
  at: string;
  agent_id: string;
  type: string;
  text: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initial: {
    lobbyState: BudLobbyState | null;
    agents: AgentRow[];
    runs: RunRow[];
    pending: ActionRow[];
    insights: InsightRow[];
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function agentName(agents: AgentRow[], id: string): string {
  return agents.find((a) => a.id === id)?.name ?? id;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000)  return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86400_000) return `${Math.floor(ms / 3600_000)}h ago`;
  return `${Math.floor(ms / 86400_000)}d ago`;
}

function eventSeverity(type: string): LiveEvent['severity'] {
  if (type === 'succeeded' || type === 'executed') return 'success';
  if (type === 'failed') return 'critical';
  if (type === 'needs_approval' || type === 'queued') return 'warning';
  return 'info';
}

const LIFECYCLE_CONFIG: Record<AgentLifecycleState, { label: string; dot: string; border: string; bg: string }> = {
  active:          { label: 'Active',          dot: 'bg-emerald-400 animate-pulse', border: 'border-emerald-500/40', bg: 'bg-emerald-950/30' },
  idle:            { label: 'Idle',            dot: 'bg-zinc-500',                  border: 'border-zinc-700',       bg: '' },
  awaiting_review: { label: 'Awaiting review', dot: 'bg-amber-400',                 border: 'border-amber-500/50',   bg: 'bg-amber-950/20' },
  degraded:        { label: 'Degraded',        dot: 'bg-rose-400 animate-pulse',    border: 'border-rose-500/50',    bg: 'bg-rose-950/20' },
  blocked:         { label: 'Blocked',         dot: 'bg-orange-400',                border: 'border-orange-500/50',  bg: 'bg-orange-950/20' },
  overloaded:      { label: 'Overloaded',      dot: 'bg-amber-400 animate-pulse',   border: 'border-amber-500/60',   bg: 'bg-amber-950/25' },
  dormant:         { label: 'Dormant',         dot: 'bg-zinc-600',                  border: 'border-zinc-700/50',    bg: '' },
  retired:         { label: 'Retired',         dot: 'bg-zinc-700',                  border: 'border-zinc-800',       bg: '' },
};

const STATUS_CONFIG: Record<OperationalStatus, { label: string; dot: string; text: string; ring: string }> = {
  nominal:  { label: 'Nominal',  dot: 'bg-emerald-400', text: 'text-emerald-400', ring: 'ring-emerald-500/20' },
  elevated: { label: 'Elevated', dot: 'bg-amber-400',   text: 'text-amber-400',   ring: 'ring-amber-500/20' },
  critical: { label: 'Critical', dot: 'bg-rose-400 animate-pulse', text: 'text-rose-400', ring: 'ring-rose-500/30' },
};

const SECTION_STATUS_STYLE: Record<string, string> = {
  nominal:  'border-zinc-800',
  elevated: 'border-amber-700/40 bg-amber-950/10',
  critical: 'border-rose-700/50 bg-rose-950/15',
};

const CATEGORY_COLOR: Record<string, string> = {
  sales:      'text-emerald-400',
  support:    'text-sky-400',
  ops:        'text-violet-400',
  hiring:     'text-amber-400',
  finance:    'text-rose-400',
  compliance: 'text-zinc-400',
};

const DOMAIN_DOT: Record<string, string> = {
  customer:   'bg-emerald-400',
  operations: 'bg-violet-400',
  finance:    'bg-rose-400',
  growth:     'bg-sky-400',
  compliance: 'bg-zinc-400',
  talent:     'bg-amber-400',
};

// ── Root component ────────────────────────────────────────────────────────────

export function BudConsole({ initial }: Props) {
  const [lobbyState, setLobbyState] = useState<BudLobbyState | null>(initial.lobbyState);
  const [runs, setRuns]             = useState<RunRow[]>(initial.runs);
  const [pending, setPending]       = useState<ActionRow[]>(initial.pending);
  const [events, setEvents]         = useState<LiveEvent[]>([]);
  const [viewMode, setViewMode]     = useState<ViewMode>('sections');
  const [budRunning, setBudRunning] = useState(false);
  const [dormantOpen, setDormantOpen] = useState(false);
  const [clock, setClock]           = useState('');
  const eventIdRef = useRef(0);

  // Brisbane clock
  useEffect(() => {
    function tick() {
      setClock(new Date().toLocaleTimeString('en-AU', { timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Push a live event
  const pushEvent = useCallback((agentId: string, type: string, text: string) => {
    const id = String(++eventIdRef.current);
    setEvents((cur) => [
      { id, at: new Date().toISOString(), agent_id: agentId, type, text, severity: eventSeverity(type) },
      ...cur,
    ].slice(0, 80));
  }, []);

  // Realtime subscriptions
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const channel = supabase
      .channel('bud-console')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_runs' },
        (p) => {
          const r = p.new as RunRow;
          setRuns((cur) => [r, ...cur].slice(0, 100));
          pushEvent(r.agent_id, 'started', r.summary ?? 'started');
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'agent_runs' },
        (p) => {
          const r = p.new as RunRow;
          setRuns((cur) => cur.map((x) => (x.id === r.id ? r : x)));
          if (r.status !== 'running') pushEvent(r.agent_id, r.status, r.summary ?? r.status);
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_actions' },
        (p) => {
          const a = p.new as ActionRow & { status: string };
          if (a.status === 'pending') {
            setPending((cur) => [a, ...cur]);
            pushEvent(a.agent_id, 'queued', a.preview);
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bud_lobby_states' },
        (p) => {
          if (p.eventType === 'INSERT' || p.eventType === 'UPDATE') {
            const s = p.new as BudLobbyState & { is_current: boolean };
            if (s.is_current) {
              setLobbyState(s);
              pushEvent('bud', 'briefing', s.summary ?? 'Bud briefing updated');
            }
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pushEvent]);

  // Derive live agent states: merge Bud snapshot with real-time running state
  const agentStates = useMemo((): Record<string, AgentLifecycleState> => {
    const states: Record<string, AgentLifecycleState> = { ...(lobbyState?.agent_states ?? {}) };
    const running  = new Set(runs.filter((r) => r.status === 'running').map((r) => r.agent_id));
    const penByAgent = new Map<string, number>();
    pending.forEach((p) => penByAgent.set(p.agent_id, (penByAgent.get(p.agent_id) ?? 0) + 1));

    for (const id of running)      states[id] = 'active';
    for (const [id, n] of penByAgent) {
      if (states[id] !== 'active') {
        states[id] = n >= 5 ? 'overloaded' : 'awaiting_review';
      }
    }
    return states;
  }, [lobbyState, runs, pending]);

  const pendingByAgent = useMemo(() => {
    const m = new Map<string, number>();
    pending.forEach((p) => m.set(p.agent_id, (m.get(p.agent_id) ?? 0) + 1));
    return m;
  }, [pending]);

  const lastRunByAgent = useMemo(() => {
    const m = new Map<string, string>();
    runs.forEach((r) => {
      if (!m.has(r.agent_id) || r.started_at > m.get(r.agent_id)!) m.set(r.agent_id, r.started_at);
    });
    return m;
  }, [runs]);

  const kpis = useMemo((): LobbyKPIs => {
    const base = lobbyState?.kpis ?? {
      agents_active: 0, agents_degraded: 0, agents_awaiting_review: 0,
      pending_approvals: 0, total_runs_24h: 0, total_cost_cents_24h: 0, active_workflows: 0,
    };
    return {
      ...base,
      agents_active:          Object.values(agentStates).filter((s) => s === 'active').length,
      agents_awaiting_review: pending.length > 0 ? Object.values(agentStates).filter((s) => s === 'awaiting_review').length : base.agents_awaiting_review,
      pending_approvals:      pending.length > 0 ? pending.length : base.pending_approvals,
    };
  }, [lobbyState, agentStates, pending]);

  const status: OperationalStatus = lobbyState?.operational_status ?? 'nominal';
  const statusCfg = STATUS_CONFIG[status];

  const sections = useMemo(
    () => (lobbyState?.sections ?? []).filter((s) => s.visible && (s.id !== 'dormant' || dormantOpen || s.agent_ids.length > 0)),
    [lobbyState, dormantOpen],
  );

  const wfStatuses: WorkflowStatus[] = lobbyState?.workflows ?? [];

  async function handleActivateBud() {
    setBudRunning(true);
    try {
      await fetch('/api/agents/bud', { method: 'POST' });
    } finally {
      setBudRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* ── Command bar ── */}
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-5 py-2.5 flex items-center gap-4 min-w-0">
          {/* Status */}
          <div className={`flex items-center gap-2 shrink-0 ring-1 rounded-md px-2.5 py-1 ${statusCfg.ring}`}>
            <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
            <span className={`text-xs font-medium tracking-wide ${statusCfg.text}`}>{statusCfg.label}</span>
          </div>

          {/* Bud summary */}
          <p className="text-xs text-zinc-400 leading-snug line-clamp-1 min-w-0 flex-1">
            {lobbyState?.summary ?? 'Waiting for Bud briefing…'}
          </p>

          {/* KPI pills */}
          <div className="hidden lg:flex items-center gap-3 shrink-0">
            <KPIPill value={kpis.agents_active}    label="active"   accent={kpis.agents_active > 0 ? 'emerald' : 'neutral'} />
            <KPIPill value={kpis.pending_approvals} label="pending"  accent={kpis.pending_approvals > 0 ? 'amber' : 'neutral'} />
            <KPIPill value={kpis.total_runs_24h}   label="runs 24h" accent="neutral" />
            <KPIPill value={`$${(kpis.total_cost_cents_24h / 100).toFixed(2)}`} label="cost 24h" accent="neutral" />
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 rounded-md p-0.5 shrink-0">
            {(['sections', 'workflows'] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === m ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleActivateBud}
              disabled={budRunning}
              className="px-3 py-1.5 text-xs rounded-md bg-emerald-900/60 hover:bg-emerald-800/60 border border-emerald-700/50 text-emerald-300 disabled:opacity-50 transition-colors"
            >
              {budRunning ? 'Activating…' : 'Activate Bud'}
            </button>
            <a href="/dashboard/agents" className="text-xs text-zinc-500 hover:text-zinc-300">← Agents</a>
            <span className="text-xs text-zinc-600 font-mono">{clock}</span>
          </div>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="flex-1 max-w-[1600px] mx-auto w-full px-5 py-5 grid grid-cols-12 gap-4">

        {/* ── Content area ── */}
        <main className="col-span-12 lg:col-span-9 space-y-4">

          {/* Bud not yet activated */}
          {!lobbyState && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <p className="text-zinc-400 text-sm mb-3">No briefing available. Activate Bud to generate the operational view.</p>
              <button
                onClick={handleActivateBud}
                disabled={budRunning}
                className="px-4 py-2 text-sm rounded-md bg-emerald-900/60 hover:bg-emerald-800/60 border border-emerald-700/50 text-emerald-300 disabled:opacity-50"
              >
                {budRunning ? 'Activating…' : 'Activate Bud'}
              </button>
            </div>
          )}

          {/* ── SECTIONS VIEW ── */}
          {viewMode === 'sections' && lobbyState && (
            <>
              {sections.map((section) => (
                <OperationalSection
                  key={section.id}
                  section={section}
                  agents={initial.agents}
                  agentStates={agentStates}
                  pendingByAgent={pendingByAgent}
                  lastRunByAgent={lastRunByAgent}
                  wfStatuses={wfStatuses}
                  isOpen={section.id !== 'dormant' || dormantOpen}
                  onToggle={section.id === 'dormant' ? () => setDormantOpen((v) => !v) : undefined}
                />
              ))}

              {/* Dormant toggle (if not already in sections) */}
              {!sections.find((s) => s.id === 'dormant') && (() => {
                const dormant = lobbyState.sections.find((s) => s.id === 'dormant');
                if (!dormant || dormant.agent_ids.length === 0) return null;
                return (
                  <button
                    onClick={() => setDormantOpen(true)}
                    className="w-full py-2 text-xs text-zinc-600 hover:text-zinc-400 border border-dashed border-zinc-800 rounded-lg transition-colors"
                  >
                    {dormant.agent_ids.length} dormant agents hidden — click to expand
                  </button>
                );
              })()}
            </>
          )}

          {/* ── WORKFLOWS VIEW ── */}
          {viewMode === 'workflows' && (
            <div className="space-y-4">
              {WORKFLOWS.map((wf) => {
                const status = wfStatuses.find((s) => s.id === wf.id);
                return (
                  <WorkflowChain
                    key={wf.id}
                    workflow={wf}
                    status={status}
                    agents={initial.agents}
                    agentStates={agentStates}
                    pendingByAgent={pendingByAgent}
                  />
                );
              })}
            </div>
          )}
        </main>

        {/* ── Event stream ── */}
        <aside className="col-span-12 lg:col-span-3">
          <EventStream events={events} agents={initial.agents} kpis={kpis} />
        </aside>
      </div>
    </div>
  );
}

// ── KPI Pill ─────────────────────────────────────────────────────────────────

function KPIPill({ value, label, accent }: { value: number | string; label: string; accent: 'emerald' | 'amber' | 'neutral' }) {
  const color = accent === 'emerald' ? 'text-emerald-400' : accent === 'amber' ? 'text-amber-400' : 'text-zinc-300';
  return (
    <div className="text-right">
      <span className={`text-sm font-semibold tabular-nums ${color}`}>{value}</span>
      <span className="text-xs text-zinc-600 ml-1">{label}</span>
    </div>
  );
}

// ── Operational Section ───────────────────────────────────────────────────────

function OperationalSection({
  section,
  agents,
  agentStates,
  pendingByAgent,
  lastRunByAgent,
  wfStatuses,
  isOpen,
  onToggle,
}: {
  section: LobbySection;
  agents: AgentRow[];
  agentStates: Record<string, AgentLifecycleState>;
  pendingByAgent: Map<string, number>;
  lastRunByAgent: Map<string, string>;
  wfStatuses: WorkflowStatus[];
  isOpen: boolean;
  onToggle?: () => void;
}) {
  const sectionAgents = section.agent_ids
    .map((id) => agents.find((a) => a.id === id))
    .filter((a): a is AgentRow => a !== undefined);

  const isAttention = section.status === 'elevated' || section.status === 'critical';

  return (
    <div className={`rounded-lg border ${SECTION_STATUS_STYLE[section.status]} overflow-hidden`}>
      {/* Section header */}
      <div
        className={`flex items-center gap-3 px-4 py-2.5 ${isAttention ? 'bg-amber-950/20' : 'bg-zinc-900/60'} ${onToggle ? 'cursor-pointer select-none hover:bg-zinc-900/80' : ''}`}
        onClick={onToggle}
      >
        {isAttention && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        )}
        <h2 className={`text-xs font-semibold uppercase tracking-widest ${isAttention ? 'text-amber-300' : 'text-zinc-400'}`}>
          {section.label}
        </h2>
        <span className="text-xs text-zinc-600">{sectionAgents.length}</span>
        {section.reason && (
          <span className="text-xs text-amber-500/80 ml-1">{section.reason}</span>
        )}
        {onToggle && (
          <span className="ml-auto text-zinc-600 text-xs">{isOpen ? '▲' : '▼'}</span>
        )}
      </div>

      {/* Agent grid */}
      {isOpen && (
        <div className="p-3">
          {sectionAgents.length === 0 ? (
            <p className="text-xs text-zinc-600 py-2">No agents in this section.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
              {sectionAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  lifecycle={agentStates[agent.id] ?? 'idle'}
                  pendingCount={pendingByAgent.get(agent.id) ?? 0}
                  lastRunAt={lastRunByAgent.get(agent.id) ?? null}
                />
              ))}
            </div>
          )}

          {/* Workflow mini-chains for this section */}
          {section.workflow_ids.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-800/60 space-y-1.5">
              {section.workflow_ids.map((wfId) => {
                const wf = WORKFLOWS.find((w) => w.id === wfId);
                if (!wf) return null;
                return (
                  <MiniWorkflowChain
                    key={wfId}
                    label={wf.label}
                    chain={wf.chain}
                    agentStates={agentStates}
                    agents={[]}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Agent Card (operational) ──────────────────────────────────────────────────

function AgentCard({
  agent,
  lifecycle,
  pendingCount,
  lastRunAt,
}: {
  agent: AgentRow;
  lifecycle: AgentLifecycleState;
  pendingCount: number;
  lastRunAt: string | null;
}) {
  const cfg = LIFECYCLE_CONFIG[lifecycle] ?? LIFECYCLE_CONFIG.idle;
  const catColor = CATEGORY_COLOR[agent.category] ?? 'text-zinc-500';

  return (
    <a
      href={`/dashboard/agents/${agent.id}`}
      className={`block rounded-md border ${cfg.border} ${cfg.bg} bg-zinc-900 p-2.5 hover:bg-zinc-800/80 transition-colors group`}
    >
      {/* Header row */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
        <span className={`text-[10px] font-medium uppercase tracking-wide ${catColor}`}>{agent.category}</span>
        {pendingCount > 0 && (
          <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 leading-none">
            {pendingCount}
          </span>
        )}
      </div>

      {/* Name */}
      <div className="text-xs font-medium text-zinc-100 leading-tight line-clamp-2 mb-1.5 group-hover:text-white">
        {agent.name}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[10px] ${lifecycle === 'idle' ? 'text-zinc-600' : 'text-zinc-400'}`}>
          {cfg.label}
        </span>
        <span className="text-[10px] text-zinc-600">
          {lastRunAt ? relativeTime(lastRunAt) : 'never'}
        </span>
      </div>
    </a>
  );
}

// ── Mini workflow chain (inline in sections) ──────────────────────────────────

function MiniWorkflowChain({
  label,
  chain,
  agentStates,
  agents,
}: {
  label: string;
  chain: string[];
  agentStates: Record<string, AgentLifecycleState>;
  agents: AgentRow[];
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
      <span className="text-[10px] text-zinc-600 shrink-0 mr-1">{label}</span>
      {chain.map((agentId, i) => {
        const ls = agentStates[agentId] ?? 'idle';
        const cfg = LIFECYCLE_CONFIG[ls];
        return (
          <div key={agentId} className="flex items-center gap-1 shrink-0">
            {i > 0 && <span className="text-zinc-700 text-[9px]">→</span>}
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} title={agentId} />
          </div>
        );
      })}
    </div>
  );
}

// ── Workflow Chain (full, workflows view) ─────────────────────────────────────

function WorkflowChain({
  workflow,
  status,
  agents,
  agentStates,
  pendingByAgent,
}: {
  workflow: typeof WORKFLOWS[0];
  status?: WorkflowStatus;
  agents: AgentRow[];
  agentStates: Record<string, AgentLifecycleState>;
  pendingByAgent: Map<string, number>;
}) {
  const domainDot = DOMAIN_DOT[workflow.domain] ?? 'bg-zinc-500';
  const isActive  = status?.active ?? false;

  return (
    <div className={`rounded-lg border ${isActive ? 'border-zinc-700' : 'border-zinc-800'} bg-zinc-900/40 overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800">
        <span className={`w-2 h-2 rounded-full shrink-0 ${domainDot} ${isActive ? 'animate-pulse' : 'opacity-50'}`} />
        <div>
          <span className="text-xs font-semibold text-zinc-200">{workflow.label}</span>
          <span className="text-[10px] text-zinc-600 ml-2">{workflow.description}</span>
        </div>
        <div className="ml-auto flex items-center gap-4 text-[10px] text-zinc-500">
          {status && <span className="tabular-nums">{status.runs_24h} runs 24h</span>}
          <span className="uppercase tracking-wide">{workflow.type}</span>
          {isActive && <span className="text-emerald-400 font-medium">Active</span>}
        </div>
      </div>

      {/* Chain */}
      <div className="px-4 py-3 overflow-x-auto">
        <div className="flex items-center gap-0 min-w-max">
          {workflow.chain.map((agentId, i) => {
            const agent    = agents.find((a) => a.id === agentId);
            const ls       = agentStates[agentId] ?? 'idle';
            const cfg      = LIFECYCLE_CONFIG[ls];
            const isBottle = status?.bottleneck_agent_id === agentId;
            const pending  = pendingByAgent.get(agentId) ?? 0;

            return (
              <div key={agentId} className="flex items-center gap-0">
                {/* Connector */}
                {i > 0 && (
                  <div className="flex items-center">
                    <div className={`w-6 h-px ${isBottle ? 'bg-amber-500' : 'bg-zinc-700'}`} />
                    <div className={`w-0 h-0 border-t-[3px] border-b-[3px] border-l-4 border-transparent ${isBottle ? 'border-l-amber-500' : 'border-l-zinc-700'}`} />
                  </div>
                )}

                {/* Node */}
                <a
                  href={`/dashboard/agents/${agentId}`}
                  className={`relative block rounded-md border ${cfg.border} ${cfg.bg} bg-zinc-900 px-3 py-2 hover:bg-zinc-800 transition-colors text-center min-w-[90px] max-w-[120px] ${isBottle ? 'ring-1 ring-amber-500/40' : ''}`}
                >
                  {isBottle && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-amber-400 uppercase tracking-wide bg-zinc-900 px-1">
                      bottleneck
                    </span>
                  )}
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                    {pending > 0 && (
                      <span className="text-[9px] font-bold text-amber-300">{pending}</span>
                    )}
                  </div>
                  <div className="text-[10px] font-medium text-zinc-200 leading-tight line-clamp-2">
                    {agent?.name ?? agentId}
                  </div>
                  <div className="text-[9px] text-zinc-600 mt-0.5">{cfg.label}</div>
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Event Stream ──────────────────────────────────────────────────────────────

const SEV_STYLE: Record<LiveEvent['severity'], { bar: string; text: string; time: string }> = {
  success:  { bar: 'border-emerald-500/40', text: 'text-zinc-200', time: 'text-zinc-500' },
  info:     { bar: 'border-sky-500/30',     text: 'text-zinc-300', time: 'text-zinc-600' },
  warning:  { bar: 'border-amber-500/50',   text: 'text-zinc-200', time: 'text-zinc-500' },
  critical: { bar: 'border-rose-500/60',    text: 'text-zinc-100', time: 'text-zinc-400' },
};

function EventStream({
  events,
  agents,
  kpis,
}: {
  events: LiveEvent[];
  agents: AgentRow[];
  kpis: LobbyKPIs;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<LiveEvent['severity'] | 'all'>('all');

  const filtered = filter === 'all' ? events : events.filter((e) => e.severity === filter);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 flex flex-col h-[calc(100vh-110px)] sticky top-[52px]">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">Event stream</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-zinc-600">live</span>
          </span>
        </div>
        <div className="flex gap-1">
          {(['all', 'critical', 'warning', 'success'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${filter === f ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Events */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 text-xs">
        {filtered.length === 0 && (
          <p className="text-zinc-600 text-center py-6">Waiting for activity…</p>
        )}
        {filtered.map((e) => {
          const cfg = SEV_STYLE[e.severity];
          return (
            <div key={e.id} className={`border-l-2 pl-2.5 py-0.5 ${cfg.bar}`}>
              <div className={`${cfg.time} text-[10px] leading-none mb-0.5`}>
                {new Date(e.at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                <span className="ml-1.5 uppercase tracking-wide">{e.type}</span>
              </div>
              <div className={cfg.text}>
                <span className="font-medium">{agentName(agents, e.agent_id)}</span>
                <span className="text-zinc-500 mx-1">·</span>
                <span className="text-zinc-400">{e.text}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer KPIs */}
      <div className="shrink-0 border-t border-zinc-800 px-4 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
        <MiniStat label="Active"   value={kpis.agents_active}    accent={kpis.agents_active > 0} />
        <MiniStat label="Pending"  value={kpis.pending_approvals} accent={kpis.pending_approvals > 0} />
        <MiniStat label="Degraded" value={kpis.agents_degraded}   accent={kpis.agents_degraded > 0} warn />
        <MiniStat label="Workflows" value={kpis.active_workflows} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent, warn }: { label: string; value: number; accent?: boolean; warn?: boolean }) {
  return (
    <div>
      <div className={`text-sm font-semibold tabular-nums ${warn && accent ? 'text-rose-400' : accent ? 'text-amber-300' : 'text-zinc-300'}`}>
        {value}
      </div>
      <div className="text-[10px] text-zinc-600 uppercase tracking-wide">{label}</div>
    </div>
  );
}
