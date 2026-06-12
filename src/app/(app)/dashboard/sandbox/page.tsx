'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type SandboxData = {
  mode: 'sandbox';
  status: {
    activeCustomers: number;
    activeLeads: number;
    activeJobs: number;
    activeInitiatives: number;
    activeApprovals: number;
  };
  metrics: {
    leadsGenerated: number;
    quotesGenerated: number;
    jobsCompleted: number;
    reviewsGenerated: number;
    initiativesCreated: number;
    agentActionsCreated: number;
  };
};

type ActionKey =
  | 'new_lead'
  | 'customer_journey'
  | 'job'
  | 'complaint'
  | 'review'
  | 'agent_initiative'
  | 'reset';

const QUICK_ACTIONS: Array<{ key: ActionKey; label: string; tone?: 'danger' }> = [
  { key: 'new_lead', label: 'Generate New Lead' },
  { key: 'customer_journey', label: 'Generate Customer Journey' },
  { key: 'job', label: 'Generate Job' },
  { key: 'complaint', label: 'Generate Complaint' },
  { key: 'review', label: 'Generate Review' },
  { key: 'agent_initiative', label: 'Generate Agent Initiative' },
  { key: 'reset', label: 'Reset Sandbox', tone: 'danger' },
];

const SCENARIOS = [
  'Lead -> Quote -> Accepted -> Job Completed',
  'Lead -> No Response',
  'Lead -> Quote -> Rejected',
  'Customer Complaint',
  'Late Job',
  'Price Dispute',
  'Agent Suggests Improvement',
  'Approval Queue Growth',
];

export default function SandboxPage() {
  const [data, setData] = useState<SandboxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<ActionKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch('/api/sandbox', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Failed to load sandbox');
    setData(payload);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [load]);

  const statusCards = useMemo(() => {
    const status = data?.status;
    return [
      ['Active sandbox customers', status?.activeCustomers ?? 0],
      ['Active sandbox leads', status?.activeLeads ?? 0],
      ['Active sandbox jobs', status?.activeJobs ?? 0],
      ['Active sandbox initiatives', status?.activeInitiatives ?? 0],
      ['Active sandbox approvals', status?.activeApprovals ?? 0],
    ];
  }, [data]);

  const metricCards = useMemo(() => {
    const metrics = data?.metrics;
    return [
      ['Leads generated', metrics?.leadsGenerated ?? 0],
      ['Quotes generated', metrics?.quotesGenerated ?? 0],
      ['Jobs completed', metrics?.jobsCompleted ?? 0],
      ['Reviews generated', metrics?.reviewsGenerated ?? 0],
      ['Initiatives created', metrics?.initiativesCreated ?? 0],
      ['Agent actions created', metrics?.agentActionsCreated ?? 0],
    ];
  }, [data]);

  async function runAction(action: ActionKey) {
    setBusyAction(action);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Sandbox action failed');
      setNotice(payload.message || `${labelFor(action)} completed.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="grid gap-5 px-1 pb-8 sm:px-2">
      <section className="rounded-[8px] border border-amber-300 bg-amber-100 px-4 py-3 text-amber-950 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white">
            SANDBOX
          </span>
          <div>
            <h1 className="text-xl font-black">Sandbox Environment</h1>
            <p className="text-sm font-semibold">
              Training mode is isolated from production customers, jobs, approvals, revenue metrics, and agent decisions.
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#17392b]">Sandbox Status</h2>
            <p className="text-sm font-semibold text-[#7f9187]">All counts are sandbox-only.</p>
          </div>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-amber-800">
            Production excluded
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {statusCards.map(([label, value]) => (
            <StatCard key={label} label={label as string} value={value as number} loading={loading} />
          ))}
        </div>
      </section>

      <section className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
        <h2 className="text-lg font-black text-[#17392b]">Quick Actions</h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={busyAction !== null}
              onClick={() => runAction(action.key)}
              className={
                action.tone === 'danger'
                  ? 'rounded-[8px] bg-amber-600 px-4 py-3 text-left text-sm font-black text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60'
                  : 'rounded-[8px] border border-[#dfe9e2] bg-[#f4faf6] px-4 py-3 text-left text-sm font-black text-[#17392b] transition hover:border-[#3c8259] hover:bg-white disabled:cursor-not-allowed disabled:opacity-60'
              }
            >
              {busyAction === action.key ? 'Working...' : action.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
          <h2 className="text-lg font-black text-[#17392b]">Sandbox Metrics</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {metricCards.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-[8px] bg-[#f4faf6] px-3 py-2">
                <span className="text-sm font-bold text-[#617269]">{label}</span>
                <span className="text-lg font-black text-[#17392b]">{loading ? '-' : value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
          <h2 className="text-lg font-black text-[#17392b]">Scenario Simulator</h2>
          <div className="grid gap-2">
            {SCENARIOS.map((scenario) => (
              <div key={scenario} className="rounded-[8px] bg-[#f4faf6] px-3 py-2 text-sm font-bold text-[#617269]">
                {scenario}
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
        <h2 className="font-black">Isolation Rules</h2>
        <p className="mt-1 font-semibold">
          Sandbox rows are written with <code>environment=&quot;sandbox&quot;</code> and legacy <code>is_test=true</code>.
          Production dashboards default to production-only data; sandbox reporting is opt-in through the Sandbox page or
          <code> environment=sandbox</code>.
        </p>
      </section>
    </div>
  );
}

function StatCard({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,61,46,0.06)]">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7f9187]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#17392b]">{loading ? '-' : value}</p>
    </div>
  );
}

function labelFor(action: ActionKey) {
  return QUICK_ACTIONS.find((item) => item.key === action)?.label || action;
}
