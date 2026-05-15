'use client';

import { useMemo, useState } from 'react';

interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  autonomy: string;
  status: string;
  schedule: string | null;
  config: Record<string, unknown>;
}

interface Run {
  id: string;
  status: string;
  trigger: string;
  summary: string | null;
  error: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_cents: number | null;
  duration_ms: number | null;
  started_at: string;
  finished_at: string | null;
}

interface Action {
  id: string;
  run_id: string;
  action_type: string;
  status: string;
  preview: string | null;
  payload: Record<string, unknown>;
  requires_approval: boolean;
  created_at: string;
  reviewed_at: string | null;
  executed_at: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  succeeded: 'text-emerald-700 bg-emerald-50',
  running: 'text-sky-700 bg-sky-50',
  failed: 'text-rose-700 bg-rose-50',
  needs_approval: 'text-amber-700 bg-amber-50',
  cancelled: 'text-zinc-600 bg-zinc-100',
  pending: 'text-amber-700 bg-amber-50',
  approved: 'text-emerald-700 bg-emerald-50',
  rejected: 'text-zinc-600 bg-zinc-100',
  executed: 'text-emerald-700 bg-emerald-50',
};

interface Props {
  initial: { agent: Agent; runs: Run[]; actions: Action[]; statsRaw: Array<{ status: string; cost_cents: number | null; duration_ms: number | null; started_at: string }> };
}

export function AgentDetailClient({ initial }: Props) {
  const [agent] = useState(initial.agent);
  const [runs, setRuns] = useState(initial.runs);
  const [actions, setActions] = useState(initial.actions);
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = initial.statsRaw.length;
    const succeeded = initial.statsRaw.filter((r) => r.status === 'succeeded').length;
    const failed = initial.statsRaw.filter((r) => r.status === 'failed').length;
    const needsApproval = initial.statsRaw.filter((r) => r.status === 'needs_approval').length;
    const totalCost = initial.statsRaw.reduce((s, r) => s + (r.cost_cents ?? 0), 0) / 100;
    const avgDuration = (() => {
      const withDur = initial.statsRaw.filter((r) => r.duration_ms != null);
      return withDur.length ? withDur.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / withDur.length : 0;
    })();
    return { total, succeeded, failed, needsApproval, totalCost, avgDuration };
  }, [initial.statsRaw]);

  async function runNow() {
    setRunning(true); setFlash(null);
    try {
      const res = await fetch('/api/agents/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agent_id: agent.id }),
      });
      const json = await res.json();
      setFlash(res.ok ? `Done · ${json.summary ?? ''}` : `Failed · ${json.error ?? ''}`);
      if (res.ok) {
        // Refresh runs list
        const r2 = await fetch(`/api/agents/runs?agent_id=${agent.id}&limit=50`);
        const j2 = await r2.json();
        if (j2.runs) setRuns(j2.runs);
      }
    } catch (e) {
      setFlash(`Failed · ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
      setTimeout(() => setFlash(null), 6000);
    }
  }

  async function decide(actionId: string, decision: 'approve' | 'reject') {
    const res = await fetch(`/api/agents/actions/${actionId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    if (res.ok) {
      setActions((cur) => cur.map((a) => a.id === actionId ? { ...a, status: decision === 'approve' ? 'executed' : 'rejected' } : a));
    }
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      <div className="mb-4">
        <a href="/dashboard/agents" className="text-sm text-zinc-500 hover:text-zinc-900">← all agents</a>
      </div>

      <header className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs ring-1 ${agent.status === 'enabled' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-zinc-100 text-zinc-600 ring-zinc-200'}`}>
              {agent.status}
            </span>
            <span className="text-xs uppercase tracking-wide text-zinc-500">{agent.category}</span>
          </div>
          <p className="text-sm text-zinc-600 mt-2 max-w-2xl">{agent.description}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-500">
            <span>autonomy: <code className="bg-zinc-100 px-1 rounded">{agent.autonomy}</code></span>
            {agent.schedule && <span>schedule: <code className="bg-zinc-100 px-1 rounded">{agent.schedule}</code></span>}
            <span>id: <code className="bg-zinc-100 px-1 rounded">{agent.id}</code></span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={runNow}
            disabled={running || agent.status !== 'enabled'}
            className="px-4 py-2 rounded-md bg-zinc-900 text-white text-sm hover:bg-zinc-800 disabled:opacity-40"
          >
            {running ? 'Running…' : 'Run now'}
          </button>
          {flash && <div className="text-xs text-zinc-600">{flash}</div>}
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Mini label="Runs (30d)" value={stats.total} />
        <Mini label="Succeeded" value={stats.succeeded} tone="emerald" />
        <Mini label="Needs approval" value={stats.needsApproval} tone={stats.needsApproval > 0 ? 'amber' : 'zinc'} />
        <Mini label="Failed" value={stats.failed} tone={stats.failed > 0 ? 'rose' : 'zinc'} />
        <Mini label="Cost (30d)" value={`$${stats.totalCost.toFixed(2)}`} />
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">Configuration</h2>
        <pre className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs overflow-x-auto">{JSON.stringify(agent.config, null, 2)}</pre>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">Pending actions <span className="text-sm text-zinc-500">({actions.filter((a) => a.status === 'pending').length})</span></h2>
        {actions.filter((a) => a.status === 'pending').length === 0 ? (
          <div className="text-sm text-zinc-500 rounded-lg border border-dashed border-zinc-200 p-4 text-center">No actions awaiting approval.</div>
        ) : (
          <ul className="space-y-2">
            {actions.filter((a) => a.status === 'pending').map((a) => (
              <li key={a.id} className="rounded-lg border border-zinc-200 bg-white p-3 flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-mono">{a.action_type}</span>
                    <span>·</span>
                    <span>{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-sm text-zinc-900">{a.preview}</div>
                  <details className="mt-1 text-xs text-zinc-600">
                    <summary className="cursor-pointer">payload</summary>
                    <pre className="mt-1 bg-zinc-50 rounded p-2 overflow-x-auto">{JSON.stringify(a.payload, null, 2)}</pre>
                  </details>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button onClick={() => decide(a.id, 'approve')} className="px-3 py-1 rounded-md bg-emerald-600 text-white text-xs hover:bg-emerald-700">Approve</button>
                  <button onClick={() => decide(a.id, 'reject')} className="px-3 py-1 rounded-md bg-zinc-100 text-zinc-700 text-xs hover:bg-zinc-200">Reject</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Run history <span className="text-sm text-zinc-500">(last {runs.length})</span></h2>
        {runs.length === 0 ? (
          <div className="text-sm text-zinc-500 rounded-lg border border-dashed border-zinc-200 p-4 text-center">No runs yet. Click <b>Run now</b> above to kick one off.</div>
        ) : (
          <ul className="space-y-2">
            {runs.map((r) => {
              const open = openRun === r.id;
              return (
                <li key={r.id} className="rounded-lg border border-zinc-200 bg-white">
                  <button
                    onClick={() => setOpenRun(open ? null : r.id)}
                    className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-zinc-50"
                  >
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[r.status] ?? 'bg-zinc-100'}`}>{r.status.replace('_', ' ')}</span>
                    <span className="text-xs text-zinc-500">{r.trigger}</span>
                    <span className="text-xs text-zinc-500">{new Date(r.started_at).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short', hour12: false })}</span>
                    <span className="text-sm text-zinc-700 flex-1 truncate">{r.summary ?? r.error ?? '—'}</span>
                    <span className="text-xs text-zinc-500">{r.cost_cents != null ? `$${(r.cost_cents / 100).toFixed(3)}` : '—'}</span>
                    <span className="text-xs text-zinc-500">{r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</span>
                    <span className="text-zinc-400">{open ? '▾' : '▸'}</span>
                  </button>
                  {open && (
                    <div className="border-t border-zinc-100 p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Input</div>
                        <pre className="bg-zinc-50 rounded p-2 text-xs overflow-x-auto max-h-64">{JSON.stringify(r.input ?? {}, null, 2)}</pre>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">{r.error ? 'Error' : 'Output'}</div>
                        <pre className={`rounded p-2 text-xs overflow-x-auto max-h-64 ${r.error ? 'bg-rose-50 text-rose-900' : 'bg-zinc-50'}`}>
                          {r.error ?? JSON.stringify(r.output ?? {}, null, 2)}
                        </pre>
                      </div>
                      <div className="md:col-span-2 text-xs text-zinc-500 flex flex-wrap gap-4">
                        {r.model && <span>model: <code>{r.model}</code></span>}
                        {r.input_tokens != null && <span>tokens in: {r.input_tokens}</span>}
                        {r.output_tokens != null && <span>tokens out: {r.output_tokens}</span>}
                        <span>finished: {r.finished_at ? new Date(r.finished_at).toLocaleTimeString() : '—'}</span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Mini({ label, value, tone = 'zinc' }: { label: string; value: number | string; tone?: 'zinc' | 'emerald' | 'amber' | 'rose' }) {
  const toneClass = { zinc: 'text-zinc-900', emerald: 'text-emerald-700', amber: 'text-amber-600', rose: 'text-rose-700' }[tone];
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-zinc-500 mt-0.5">{label}</div>
    </div>
  );
}
