import { dispatchSlackAlert } from './alerting-config';

const WINDOW_MS = 60 * 60 * 1000; // 60 minutes
const DEFAULT_THRESHOLD = 5;

// Map of agentId -> list of error timestamps (ms since epoch)
const errorTimestamps = new Map<string, number[]>();

function pruneWindow(timestamps: number[], now: number): number[] {
  return timestamps.filter((t) => now - t < WINDOW_MS);
}

export async function recordAgentFailure(agentId: string): Promise<void> {
  const threshold =
    parseInt(process.env.AGENT_ERROR_THRESHOLD ?? '', 10) || DEFAULT_THRESHOLD;

  const now = Date.now();
  const existing = pruneWindow(errorTimestamps.get(agentId) ?? [], now);
  existing.push(now);
  errorTimestamps.set(agentId, existing);

  if (existing.length >= threshold) {
    await dispatchSlackAlert({
      agentId,
      errorCount: existing.length,
      threshold,
      windowMinutes: 60,
      timestamp: new Date(now).toISOString(),
    });
    // Reset after alerting to avoid repeated floods for the same burst
    errorTimestamps.set(agentId, []);
  }
}

export function getAgentErrorCount(agentId: string): number {
  const now = Date.now();
  const pruned = pruneWindow(errorTimestamps.get(agentId) ?? [], now);
  errorTimestamps.set(agentId, pruned);
  return pruned.length;
}
