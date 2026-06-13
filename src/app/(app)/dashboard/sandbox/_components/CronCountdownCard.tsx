'use client';

import { useEffect, useState } from 'react';
import { SANDBOX_CRONS, nextCronRun, prevCronRun, formatCountdown } from '@/lib/sandbox/cron-schedule';

type BatchSummary = {
  agent_id: string;
  trigger: string;
  status: string;
  started_at: string;
};

interface Props {
  lastCronRun: BatchSummary | null;
}

/** Formats next run as local time (day label + time) with UTC shown subtly. */
function fmtNextRun(next: Date, now: Date): { local: string; utc: string } {
  const todayStr     = now.toDateString();
  const tomorrowStr  = new Date(now.getTime() + 86_400_000).toDateString();
  const localTime    = next.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const dayLabel =
    next.toDateString() === todayStr    ? 'Today'    :
    next.toDateString() === tomorrowStr ? 'Tomorrow' :
    next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const utc = `${String(next.getUTCHours()).padStart(2, '0')}:${String(next.getUTCMinutes()).padStart(2, '0')} UTC`;
  return { local: `${dayLabel} ${localTime}`, utc };
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === 'complete' ? 'bg-[#e5f4ec] text-[#1C7C54]' :
    status === 'failed'   ? 'bg-[#fde8e8] text-[#b42318]' :
                            'bg-[#fff6e0] text-[#9a6700]';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${cls}`}>
      {status}
    </span>
  );
}

export default function CronCountdownCard({ lastCronRun }: Props) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Skip render until client hydrated (avoids toLocaleString mismatch)
  if (!now) return null;

  const rows = SANDBOX_CRONS.map((cron) => {
    const next    = nextCronRun(cron.schedule, now);
    const prev    = prevCronRun(cron.schedule, now);
    const msUntil = next.getTime() - now.getTime();

    // Overdue: no cron has ever run, OR last batch started before prev expected run (10-min grace)
    const isOverdue =
      lastCronRun === null ||
      new Date(lastCronRun.started_at).getTime() < prev.getTime() - 10 * 60 * 1000;

    const { local, utc } = fmtNextRun(next, now);
    return { ...cron, next, msUntil, isOverdue, local, utc };
  });

  // Packs that fire at the same soonest time
  const soonestTime = Math.min(...rows.map((r) => r.next.getTime()));
  const nextPacks   = rows.filter((r) => r.next.getTime() === soonestTime);

  const localNow = now.toLocaleTimeString(undefined, { timeZoneName: 'short' });
  const utcNow   = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')} UTC`;

  return (
    <div className="grid gap-3 rounded-[8px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black text-[#17392b]">Cron Countdown</h2>
        <span className="text-right text-xs font-bold text-[#617269]">
          {localNow}
          <span className="ml-1.5 text-[#bfcfc4]">({utcNow})</span>
        </span>
      </div>

      {/* Per-cron rows */}
      <div className="grid gap-1.5">
        {rows.map((row) => {
          const urgent  = row.msUntil < 5 * 60 * 1000; // < 5 min
          const warning = row.isOverdue;

          const rowBg =
            warning ? 'border border-amber-300 bg-amber-50' :
            urgent  ? 'border border-[#b5d6c5] bg-[#f0faf5]' :
                      'bg-[#f4faf6]';

          return (
            <div
              key={row.pack}
              className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[6px] px-3 py-2 ${rowBg}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                {warning && (
                  <span className="text-amber-600" title="Overdue or no data">⚠</span>
                )}
                <span className="w-14 shrink-0 text-[10px] font-black uppercase tracking-[0.15em] text-[#617269]">
                  {row.label}
                </span>
                <span className="truncate text-xs font-semibold text-[#7f9187]">{row.categories}</span>
              </div>

              <div className="flex items-center gap-3 text-right">
                <span className="text-xs font-semibold text-[#617269]">
                  {row.local}
                  <span className="ml-1 text-[10px] text-[#bfcfc4]">({row.utc})</span>
                </span>
                <span
                  className={`min-w-[72px] font-black tabular-nums ${
                    urgent  ? 'text-[#1C7C54]'  :
                    warning ? 'text-amber-700'   :
                              'text-[#17392b]'
                  } text-sm`}
                >
                  {formatCountdown(row.msUntil)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Simultaneous indicator */}
      {nextPacks.length > 1 && (
        <p className="text-xs font-semibold text-[#617269]">
          <span className="mr-1 font-black text-[#17392b]">⚡ Simultaneous:</span>
          {nextPacks.map((p) => p.label).join(' + ')} fire together at {nextPacks[0].utc}
        </p>
      )}

      {/* Footer: last batch + next pack */}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2 border-t border-[#eef2f0] pt-3">
        <div>
          <p className="text-[10px] font-black uppercase text-[#7f9187]">Last batch</p>
          {lastCronRun ? (
            <p className="text-sm font-black text-[#17392b]">
              {lastCronRun.agent_id}
              <span className="ml-1.5 text-xs font-semibold text-[#617269]">
                {new Date(lastCronRun.started_at).toLocaleString()}
              </span>
            </p>
          ) : (
            <p className="text-sm font-semibold text-amber-700">Waiting for first run</p>
          )}
        </div>

        {lastCronRun && (
          <div>
            <p className="text-[10px] font-black uppercase text-[#7f9187]">Last status</p>
            <StatusChip status={lastCronRun.status} />
          </div>
        )}

        <div>
          <p className="text-[10px] font-black uppercase text-[#7f9187]">Next pack</p>
          <p className="text-sm font-black text-[#17392b]">
            {nextPacks.map((p) => p.label).join(' + ')}
            <span className="ml-1.5 text-xs font-semibold text-[#617269]">
              ({nextPacks.map((p) => p.categories).join(', ')})
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
