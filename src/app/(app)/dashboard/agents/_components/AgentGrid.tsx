'use client';
import { useState } from 'react';

interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  autonomy: string;
  schedule: string | null;
}

interface Stat { runs: number; successes: number; failures: number; costCents: number }

const CATEGORY_DOTS: Record<string, string> = {
  sales: 'bg-emerald-500',
  support: 'bg-sky-500',
  ops: 'bg-violet-500',
  hiring: 'bg-amber-500',
  finance: 'bg-rose-500',
  compliance: 'bg-zinc-700',
};

export function AgentGrid({ agents, stats }: { agents: Agent[]; stats: Record<string, Stat> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {agents.map((a) => (
        <AgentCard key={a.id} agent={a} stat={stats[a.id]} />
      ))}
    </div>
  );
}

function AgentCard({ agent, stat }: { agent: Agent; stat?: Stat }) {
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const successRate = stat && stat.runs > 0 ? Math.round((stat.successes / stat.runs) * 100) : null;

  async function runNow() {
    setRunning(true);
    setFlash(null);
    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent_id: agent.id }),
      });
      const json = await res.json();
      setFlash(res.ok ? `✓ ${json.summary ?? 'Done'}` : `✗ ${json.error ?? 'Failed'}`);
    } catch (e) {
      setFlash(`✗ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
      setTimeout(() => setFlash(null), 6000);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 hover:shadow-sm transition-shadow flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${CATEGORY_DOTS[agent.category] ?? 'bg-zinc-400'}`} />
        <span className="text-xs uppercase tracking-wide text-zinc-500">{agent.category}</span>
        <span className="ml-auto">
          <StatusPill status={agent.status} />
        </span>
      </div>

      <h3 className="text-base font-semibold text-zinc-900">{agent.name}</h3>
      <p className="text-sm text-zinc-600 mt-1 line-clamp-2 min-h-[2.5rem]">{agent.description}</p>

      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
        <span title="Autonomy">{badge(agent.autonomy)}</span>
        {agent.schedule && <span className="font-mono">{agent.schedule}</span>}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Mini label="Runs 7d" value={stat?.runs ?? 0} />
        <Mini label="Success" value={successRate != null ? `${successRate}%` : '—'} />
        <Mini label="Cost" value={stat ? `$${(stat.costCents / 100).toFixed(2)}` : '—'} />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={runNow}
          disabled={running || agent.status !== 'enabled'}
          className="px-3 py-1.5 rounded-md bg-zinc-900 text-white text-sm hover:bg-zinc-800 disabled:opacity-40"
        >
          {running ? 'Running…' : 'Run now'}
        </button>
        <a
          href={`/dashboard/agents/${agent.id}`}
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          History →
        </a>
      </div>
      {flash && <div className="mt-2 text-xs text-zinc-600">{flash}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    enabled: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    paused: 'bg-amber-50 text-amber-700 ring-amber-200',
    disabled: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
  };
  return (
    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ring-1 ${map[status] ?? map.disabled}`}>
      {status}
    </span>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-zinc-50 px-2 py-1">
      <div className="text-zinc-900 font-medium">{value}</div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</div>
    </div>
  );
}

function badge(autonomy: string) {
  const map: Record<string, string> = { auto: '⚡ auto', review: '✋ review', manual: '👤 manual' };
  return <span className="text-[11px] text-zinc-500">{map[autonomy] ?? autonomy}</span>;
}
