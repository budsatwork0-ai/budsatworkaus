'use client';

import { useEffect, useState } from 'react';
import { SANDBOX_CRONS, formatCountdown, nextCronRun } from '@/lib/sandbox/cron-schedule';
import type { Batch, TrendDirection } from '../_lib/types';
import { fmtF1 } from '../_lib/format';
import { CommandMetric } from './ui';

export function ExecutiveCommandStrip({
  fleetHealth,
  fleetScore,
  fleetScoreTrend,
  passingAgents,
  totalAgents,
  passingScenarios,
  passingScenariosTrend,
  totalScenarios,
  activeRootCauses,
  rootCausesTrend,
  readyToPromote,
  readyToPromoteTrend,
  lastCronRun,
  loading,
  busy,
  onRunFullPack,
  onRunScenario,
}: {
  fleetHealth: 'Healthy' | 'Investigate' | 'Blocked';
  fleetScore: number;
  fleetScoreTrend: TrendDirection;
  passingAgents: number;
  totalAgents: number;
  passingScenarios: number;
  passingScenariosTrend: TrendDirection;
  totalScenarios: number;
  activeRootCauses: number;
  rootCausesTrend: TrendDirection;
  readyToPromote: number;
  readyToPromoteTrend: TrendDirection;
  lastCronRun: Batch | null;
  loading: boolean;
  busy: boolean;
  onRunFullPack: () => void;
  onRunScenario: () => void;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const nextRows = now
    ? SANDBOX_CRONS.map((cron) => ({ ...cron, next: nextCronRun(cron.schedule, now) })).sort((a, b) => a.next.getTime() - b.next.getTime())
    : [];
  const nextCron = nextRows[0];
  const statusStyles =
    fleetHealth === 'Healthy'
      ? 'border-[#b5d6c5] bg-[#e5f4ec] text-[#1C7C54]'
      : fleetHealth === 'Investigate'
        ? 'border-amber-300 bg-amber-50 text-amber-800'
        : 'border-red-200 bg-red-50 text-red-700';

  return (
    <section className="sticky top-0 z-20 rounded-[8px] border border-[#dfe9e2] bg-white/95 px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.09)] backdrop-blur">
      <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <CommandMetric label="Fleet score" loading={loading} value={`${fleetScore}%`} subValue={fleetHealth} trend={fleetScoreTrend} className={statusStyles} />
          <CommandMetric label="Agents passing" loading={loading} value={`${passingAgents}/${totalAgents}`} />
          <CommandMetric label="Scenarios passing" loading={loading} value={`${passingScenarios}/${totalScenarios}`} trend={passingScenariosTrend} />
          <CommandMetric label="Active root causes" loading={loading} value={String(activeRootCauses)} trend={rootCausesTrend} tone={activeRootCauses > 0 ? 'warning' : 'normal'} />
          <CommandMetric label="Ready to promote" loading={loading} value={String(readyToPromote)} trend={readyToPromoteTrend} tone={readyToPromote > 0 ? 'success' : 'normal'} />
          <CommandMetric
            label="Next cron"
            loading={!now}
            value={nextCron ? `${nextCron.label} ${formatCountdown(nextCron.next.getTime() - now!.getTime())}` : 'No scheduled cron'}
            subValue={nextCron ? nextCron.categories : undefined}
          />
          <CommandMetric
            label="Last cron result"
            loading={loading}
            value={lastCronRun ? `${lastCronRun.pass_count}/${lastCronRun.scenario_count} passed` : 'No runs'}
            subValue={lastCronRun ? `${lastCronRun.status} - ${fmtF1(lastCronRun.avg_f1)} F1` : 'Waiting for cron'}
          />
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onRunFullPack}
            className="rounded-[6px] bg-[#1C7C54] px-4 py-2 text-sm font-black text-white transition hover:bg-[#17392b] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Run All Scenarios
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onRunScenario}
            className="rounded-[6px] border border-[#dfe9e2] px-4 py-2 text-sm font-black text-[#17392b] transition hover:border-[#3c8259] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Choose Scenario
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold text-[#617269]">
        Safety: sandbox rows stay in <code>environment=&quot;sandbox&quot;</code>; proposed actions are captured, not dispatched. Health separates manual pack results, cron health, unresolved historical issues, and current failures.
      </p>
    </section>
  );
}

export function ExecutiveSummary({ summary, fleetHealth }: { summary: string; fleetHealth: 'Healthy' | 'Investigate' | 'Blocked' }) {
  const tone =
    fleetHealth === 'Healthy'
      ? 'border-[#b5d6c5] bg-[#f5fbf7]'
      : fleetHealth === 'Investigate'
        ? 'border-amber-300 bg-amber-50'
        : 'border-red-200 bg-red-50';
  return (
    <section className={`rounded-[8px] border px-4 py-3 ${tone}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#617269]">Executive summary</p>
      <p className="mt-1 text-sm font-black text-[#17392b]">{summary}</p>
    </section>
  );
}

export function PackRunConfirmationDialog({
  label,
  count,
  onCancel,
  onConfirm,
}: {
  label: string;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/35" onClick={onCancel} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pack-run-confirmation-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel();
        }}
        className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[8px] bg-white px-5 py-5 shadow-[0_24px_80px_rgba(15,61,46,0.24)]"
      >
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#7f9187]">Confirm sandbox run</p>
        <h2 id="pack-run-confirmation-title" className="mt-1 text-xl font-black text-[#17392b]">
          Run {label} now?
        </h2>
        <p className="mt-2 text-sm font-semibold text-[#617269]">
          This will execute {count} sandbox scenario{count === 1 ? '' : 's'} sequentially. Runs stay in <code>environment=&quot;sandbox&quot;</code> and proposed actions are captured, not dispatched.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[6px] border border-[#dfe9e2] px-4 py-2 text-sm font-black text-[#17392b] transition hover:border-[#3c8259]"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className="rounded-[6px] bg-[#1C7C54] px-4 py-2 text-sm font-black text-white transition hover:bg-[#17392b]"
          >
            Run sandbox pack
          </button>
        </div>
      </section>
    </>
  );
}
