'use client';

/**
 * Health tab — continuous sandbox monitoring (Phase 1 step 6).
 * Shows last cron run, latest batches, per-agent health trends,
 * failing scenarios, regressions, and the needs-review queue.
 * Data: GET /api/sandbox/health (admin-gated).
 */

import { useCallback, useEffect, useState } from 'react';
import CronCountdownCard from './CronCountdownCard';

type Batch = {
  id: string;
  agent_id: string;
  trigger: string;
  status: string;
  scenario_count: number;
  pass_count: number;
  avg_f1: number | null;
  total_cost_cents: number;
  started_at: string;
  finished_at: string | null;
};

type HealthRow = {
  agent_id: string;
  runs: number;
  pass_rate: number | null;
  avg_f1: number | null;
  baseline_f1: number | null;
  delta_f1: number | null;
  trend: 'improving' | 'stable' | 'degrading';
  computed_at: string;
};

type FailingScenario = {
  scenarioId: string;
  title: string;
  category: string;
  agentId: string;
  f1: number;
  scoredAt: string;
};

type ReviewItem = {
  id: string;
  agent_id: string;
  title: string;
  observation: string;
  severity: string;
  created_at: string;
};

type HealthData = {
  lastCronRun: Batch | null;
  batches: Batch[];
  health: HealthRow[];
  regressions: HealthRow[];
  failingScenarios: FailingScenario[];
  needsReview: ReviewItem[];
};

function TrendChip({ trend }: { trend: HealthRow['trend'] }) {
  const styles =
    trend === 'improving'
      ? 'bg-[#e5f4ec] text-[#1C7C54]'
      : trend === 'degrading'
        ? 'bg-[#fde8e8] text-[#b42318]'
        : 'bg-[#eef2f0] text-[#617269]';
  const arrow = trend === 'improving' ? '▲' : trend === 'degrading' ? '▼' : '—';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${styles}`}>
      {arrow} {trend}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const styles =
    status === 'complete'
      ? 'bg-[#e5f4ec] text-[#1C7C54]'
      : status === 'failed'
        ? 'bg-[#fde8e8] text-[#b42318]'
        : 'bg-[#fff6e0] text-[#9a6700]';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${styles}`}>
      {status}
    </span>
  );
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-[#17392b]">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function fmtF1(v: number | null): string {
  return v === null ? '—' : Number(v).toFixed(2);
}

export default function HealthTab() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sandbox/health', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load health data (${res.status})`);
      setData((await res.json()) as HealthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <p className="text-sm font-semibold text-[#7f9187]">Loading health data...</p>;
  }
  if (error) {
    return <p className="text-sm font-semibold text-[#b42318]">{error}</p>;
  }
  if (!data) return null;

  const refreshButton = (
    <button
      type="button"
      onClick={() => void load()}
      className="rounded-[6px] border border-[#dfe9e2] px-3 py-1.5 text-xs font-bold text-[#617269] hover:border-[#3c8259]"
    >
      Refresh
    </button>
  );

  return (
    <section className="grid gap-5">
      {/* Cron countdown — live client-side timer showing next scheduled runs */}
      <CronCountdownCard lastCronRun={data.lastCronRun} />

      {/* Last cron run */}
      <Panel title="Continuous Monitoring" action={refreshButton}>
        {data.lastCronRun ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="text-[10px] font-black uppercase text-[#7f9187]">Last cron run</p>
              <p className="text-sm font-black text-[#17392b]">
                {new Date(data.lastCronRun.started_at).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-[#7f9187]">Agent</p>
              <p className="text-sm font-black text-[#17392b]">{data.lastCronRun.agent_id}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-[#7f9187]">Result</p>
              <p className="text-sm font-black text-[#17392b]">
                {data.lastCronRun.pass_count}/{data.lastCronRun.scenario_count} passed · avg F1{' '}
                {fmtF1(data.lastCronRun.avg_f1)}
              </p>
            </div>
            <StatusChip status={data.lastCronRun.status} />
          </div>
        ) : (
          <p className="text-sm font-semibold text-[#7f9187]">
            No cron runs yet. The sandbox-runner cron activates on the next deploy — hourly
            (customer), daily 03:00 (ops/finance/ndis/growth), nightly 01:30 (full regression).
          </p>
        )}
      </Panel>

      {/* Needs review */}
      <Panel title={`Needs Review (${data.needsReview.length})`}>
        {data.needsReview.length === 0 ? (
          <p className="text-sm font-semibold text-[#7f9187]">
            Nothing critical in the last 7 days.
          </p>
        ) : (
          <div className="grid gap-2">
            {data.needsReview.map((item) => (
              <div key={item.id} className="rounded-[8px] border border-[#f3c7c3] bg-[#fff8f7] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-black text-[#17392b]">{item.title}</p>
                  <span className="rounded-full bg-[#fde8e8] px-2 py-0.5 text-[10px] font-black uppercase text-[#b42318]">
                    critical
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-[#617269]">{item.observation}</p>
                <p className="mt-1 text-[10px] font-bold text-[#7f9187]">
                  {item.agent_id} — {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Agent health trends */}
      <Panel title="Agent Health">
        {data.health.length === 0 ? (
          <p className="text-sm font-semibold text-[#7f9187]">
            No health snapshots yet — they accumulate as the cron runs.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase text-[#7f9187]">
                  <th className="py-2 pr-4">Agent</th>
                  <th className="py-2 pr-4">Runs (24h)</th>
                  <th className="py-2 pr-4">Pass rate</th>
                  <th className="py-2 pr-4">Avg F1</th>
                  <th className="py-2 pr-4">Baseline</th>
                  <th className="py-2 pr-4">Δ F1</th>
                  <th className="py-2">Trend</th>
                </tr>
              </thead>
              <tbody>
                {data.health.map((h) => (
                  <tr key={h.agent_id} className="border-t border-[#eef2f0]">
                    <td className="py-2 pr-4 font-black text-[#17392b]">{h.agent_id}</td>
                    <td className="py-2 pr-4 font-semibold text-[#617269]">{h.runs}</td>
                    <td className="py-2 pr-4 font-semibold text-[#617269]">
                      {h.pass_rate === null ? '—' : `${Math.round(Number(h.pass_rate) * 100)}%`}
                    </td>
                    <td className="py-2 pr-4 font-semibold text-[#617269]">{fmtF1(h.avg_f1)}</td>
                    <td className="py-2 pr-4 font-semibold text-[#617269]">{fmtF1(h.baseline_f1)}</td>
                    <td
                      className={`py-2 pr-4 font-black ${
                        h.delta_f1 !== null && Number(h.delta_f1) < 0 ? 'text-[#b42318]' : 'text-[#1C7C54]'
                      }`}
                    >
                      {h.delta_f1 === null ? '—' : Number(h.delta_f1) > 0 ? `+${fmtF1(h.delta_f1)}` : fmtF1(h.delta_f1)}
                    </td>
                    <td className="py-2">
                      <TrendChip trend={h.trend} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Regressions */}
      {data.regressions.length > 0 ? (
        <Panel title={`Regressions (${data.regressions.length})`}>
          <div className="grid gap-2">
            {data.regressions.map((r) => (
              <div key={r.agent_id} className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[#f3c7c3] bg-[#fff8f7] px-4 py-3">
                <p className="text-sm font-black text-[#17392b]">{r.agent_id}</p>
                <p className="text-xs font-semibold text-[#617269]">
                  F1 {fmtF1(r.avg_f1)} vs baseline {fmtF1(r.baseline_f1)} (Δ {fmtF1(r.delta_f1)})
                </p>
                <TrendChip trend={r.trend} />
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {/* Failing scenarios */}
      <Panel title={`Failing Scenarios (${data.failingScenarios.length})`}>
        {data.failingScenarios.length === 0 ? (
          <p className="text-sm font-semibold text-[#7f9187]">No failing scenarios. All latest scores ≥ 0.5.</p>
        ) : (
          <div className="grid gap-2">
            {data.failingScenarios.map((s) => (
              <div key={s.scenarioId} className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[#dfe9e2] px-4 py-3">
                <div>
                  <p className="text-sm font-black text-[#17392b]">{s.title}</p>
                  <p className="text-[10px] font-bold uppercase text-[#7f9187]">
                    {s.category} · {s.agentId}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-[#b42318]">F1 {s.f1.toFixed(2)}</p>
                  <p className="text-[10px] font-bold text-[#7f9187]">
                    {new Date(s.scoredAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Latest batches */}
      <Panel title="Latest Batches">
        {data.batches.length === 0 ? (
          <p className="text-sm font-semibold text-[#7f9187]">No batches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase text-[#7f9187]">
                  <th className="py-2 pr-4">Started</th>
                  <th className="py-2 pr-4">Agent</th>
                  <th className="py-2 pr-4">Trigger</th>
                  <th className="py-2 pr-4">Passed</th>
                  <th className="py-2 pr-4">Avg F1</th>
                  <th className="py-2 pr-4">Cost</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.batches.map((b) => (
                  <tr key={b.id} className="border-t border-[#eef2f0]">
                    <td className="py-2 pr-4 font-semibold text-[#617269]">
                      {new Date(b.started_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 font-black text-[#17392b]">{b.agent_id}</td>
                    <td className="py-2 pr-4 font-semibold text-[#617269]">{b.trigger}</td>
                    <td className="py-2 pr-4 font-semibold text-[#617269]">
                      {b.pass_count}/{b.scenario_count}
                    </td>
                    <td className="py-2 pr-4 font-semibold text-[#617269]">{fmtF1(b.avg_f1)}</td>
                    <td className="py-2 pr-4 font-semibold text-[#617269]">{b.total_cost_cents}¢</td>
                    <td className="py-2">
                      <StatusChip status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </section>
  );
}
