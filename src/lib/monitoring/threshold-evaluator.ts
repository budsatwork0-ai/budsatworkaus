import { dispatchSlackAlert } from './alerting-config';

const AGENT_ERROR_THRESHOLD = Number(process.env.AGENT_ERROR_THRESHOLD ?? 10);
const WINDOW_MS = 60 * 60 * 1000; // 60 minutes

// Map of agentName -> array of error timestamps (ms)
const errorWindows = new Map<string, number[]>();

function pruneWindow(agentName: string): number[] {
  const now = Date.now();
  const timestamps = (errorWindows.get(agentName) ?? []).filter(
    (ts) => now - ts < WINDOW_MS
  );
  errorWindows.set(agentName, timestamps);
  return timestamps;
}

export async function recordAgentFailure(agentName: string): Promise<void> {
  const timestamps = pruneWindow(agentName);
  timestamps.push(Date.now());
  errorWindows.set(agentName, timestamps);

  if (timestamps.length >= AGENT_ERROR_THRESHOLD) {
    await dispatchSlackAlert({
      agentName,
      errorCount: timestamps.length,
      timestamp: new Date().toISOString(),
    });
  }
}

export function getAgentErrorCount(agentName: string): number {
  return pruneWindow(agentName).length;
}
