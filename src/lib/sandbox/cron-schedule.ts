export type SandboxCronPack = 'hourly' | 'daily' | 'full';

export interface SandboxCronEntry {
  pack: SandboxCronPack;
  schedule: string;
  label: string;
  categories: string;
}

/** Matches the three sandbox-runner entries in config/vercel.json */
export const SANDBOX_CRONS: SandboxCronEntry[] = [
  { pack: 'hourly', schedule: '0 * * * *',  label: 'Hourly', categories: 'customer' },
  { pack: 'daily',  schedule: '0 3 * * *',  label: 'Daily',  categories: 'ops · finance · ndis · growth' },
  { pack: 'full',   schedule: '30 1 * * *', label: 'Full',   categories: 'all categories' },
];

/**
 * Returns the next time a cron expression fires, strictly after `from`.
 * Supports the subset used by sandbox crons: "M H * * *" (daily) and "M * * * *" (hourly).
 */
export function nextCronRun(cronExpr: string, from: Date): Date {
  const parts = cronExpr.trim().split(/\s+/);
  const cronMinute = parts[0] === '*' ? null : parseInt(parts[0], 10);
  const cronHour   = parts[1] === '*' ? null : parseInt(parts[1], 10);

  const candidate = new Date(from.getTime());

  if (cronHour === null) {
    // Hourly: fires at cronMinute of every hour
    const m = cronMinute ?? 0;
    candidate.setUTCMinutes(m, 0, 0);
    if (candidate.getTime() <= from.getTime()) {
      candidate.setUTCHours(candidate.getUTCHours() + 1);
    }
    return candidate;
  }

  // Daily: fires at cronHour:cronMinute UTC every day
  candidate.setUTCHours(cronHour, cronMinute ?? 0, 0, 0);
  if (candidate.getTime() <= from.getTime()) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}

/**
 * Returns the most recent past occurrence of a cron expression before `from`.
 * This is next run minus one interval (1 h for hourly, 24 h for daily patterns).
 */
export function prevCronRun(cronExpr: string, from: Date): Date {
  const next = nextCronRun(cronExpr, from);
  const isHourly = cronExpr.trim().split(/\s+/)[1] === '*';
  const intervalMs = isHourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return new Date(next.getTime() - intervalMs);
}

/** Format milliseconds as HH:MM:SS countdown string. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
