'use client';
import { useState } from 'react';

interface Action {
  action_id: string;
  agent_id: string;
  agent_name: string;
  action_type: string;
  preview: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export function ApprovalQueue({ actions }: { actions: Action[] }) {
  const [pending, setPending] = useState(actions);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(actionId: string, decision: 'approve' | 'reject') {
    setBusy(actionId);
    try {
      const res = await fetch(`/api/agents/actions/${actionId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) setPending((cur) => cur.filter((a) => a.action_id !== actionId));
    } finally {
      setBusy(null);
    }
  }

  if (pending.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
        Nothing waiting. Agents will queue actions here when they want your sign-off.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pending.map((a) => (
        <div key={a.action_id} className="rounded-lg border border-zinc-200 bg-white p-4 flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="font-medium text-zinc-700">{a.agent_name}</span>
              <span>·</span>
              <span className="font-mono">{a.action_type}</span>
              <span>·</span>
              <span>{new Date(a.created_at).toLocaleString()}</span>
            </div>
            <div className="mt-1 text-sm text-zinc-900">{a.preview}</div>
            <details className="mt-2 text-xs text-zinc-600">
              <summary className="cursor-pointer">Payload</summary>
              <pre className="mt-1 bg-zinc-50 rounded p-2 overflow-x-auto">{JSON.stringify(a.payload, null, 2)}</pre>
            </details>
          </div>
          <div className="flex flex-col gap-2">
            <button
              disabled={busy === a.action_id}
              onClick={() => decide(a.action_id, 'approve')}
              className="px-3 py-1 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={busy === a.action_id}
              onClick={() => decide(a.action_id, 'reject')}
              className="px-3 py-1 rounded-md bg-zinc-100 text-zinc-700 text-sm hover:bg-zinc-200 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
