/**
 * Bud-Observer Health Check — dead-man's switch
 *
 * Pings HEALTHCHECK_URL (e.g. a Healthchecks.io or Cronitor endpoint) after
 * each observer run so that missed pings trigger external alerts independently
 * of any in-process logging.
 *
 * Safe to import from cron scripts or CI — has zero dependencies beyond fetch.
 */

export async function pingHealthcheck(): Promise<void> {
  const url = process.env.HEALTHCHECK_URL;
  if (!url) return; // not configured — silently skip
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.warn(`[bud-observer/health-check] ping returned ${res.status}`);
    }
  } catch (err) {
    // Never throw — a healthcheck failure must not mask the actual observer result
    console.error('[bud-observer/health-check] ping failed', String(err).slice(0, 200));
  }
}

/**
 * Standalone cron-safe export.
 * Usage:  npx ts-node -e "require('./health-check').cronPing()"
 * or from a cron wrapper that only needs to confirm the observer ran.
 */
export async function cronPing(): Promise<void> {
  await pingHealthcheck();
}
