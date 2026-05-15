'use client';

interface Run {
  id: string;
  agent_id: string;
  status: string;
  summary: string | null;
  cost_cents: number | null;
  duration_ms: number | null;
  started_at: string;
  trigger: string;
}

interface Agent { id: string; name: string }

const STATUS_COLOR: Record<string, string> = {
  succeeded: 'text-emerald-700 bg-emerald-50',
  running: 'text-sky-700 bg-sky-50',
  failed: 'text-rose-700 bg-rose-50',
  needs_approval: 'text-amber-700 bg-amber-50',
  cancelled: 'text-zinc-600 bg-zinc-100',
};

export function RecentRuns({ runs, agents }: { runs: Run[]; agents: Agent[] }) {
  const nameById = Object.fromEntries(agents.map((a) => [a.id, a.name]));
  if (runs.length === 0) return <div className="text-sm text-zinc-500">No runs yet.</div>;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-zinc-600">
          <tr>
            <Th>Started</Th>
            <Th>Agent</Th>
            <Th>Trigger</Th>
            <Th>Status</Th>
            <Th>Summary</Th>
            <Th className="text-right">Cost</Th>
            <Th className="text-right">Duration</Th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-zinc-100">
              <Td>{new Date(r.started_at).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short', hour12: false })}</Td>
              <Td className="font-medium">{nameById[r.agent_id] ?? r.agent_id}</Td>
              <Td className="text-zinc-500">{r.trigger}</Td>
              <Td>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[r.status] ?? 'bg-zinc-100'}`}>
                  {r.status.replace('_', ' ')}
                </span>
              </Td>
              <Td className="text-zinc-700 max-w-md truncate">{r.summary ?? '—'}</Td>
              <Td className="text-right text-zinc-500">{r.cost_cents != null ? `$${(r.cost_cents / 100).toFixed(3)}` : '—'}</Td>
              <Td className="text-right text-zinc-500">{r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left text-xs font-medium uppercase tracking-wide px-3 py-2 ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
