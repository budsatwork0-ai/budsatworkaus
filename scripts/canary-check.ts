/**
 * Canary health-check for the quote-triage agent.
 *
 * Queries Supabase for agent errors in a rolling time window and exits
 * with a non-zero code if the error count exceeds the configured threshold.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/canary-check.ts
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

// ─── Configuration (tune these constants) ─────────────────────────────────────
const AGENT_NAME = 'quote-triage';
const ERROR_THRESHOLD = 5;          // max errors allowed in the window
const WINDOW_MINUTES = 5;           // rolling window in minutes
// ──────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[canary-check] Missing required environment variables: ' +
    'NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run(): Promise<void> {
  const windowStart = new Date(
    Date.now() - WINDOW_MINUTES * 60 * 1000
  ).toISOString();

  console.log(
    `[canary-check] Checking ${AGENT_NAME} errors since ${windowStart} ` +
    `(threshold: ${ERROR_THRESHOLD} errors / ${WINDOW_MINUTES} min)`
  );

  const { data, error, count } = await supabase
    .from('agent_events')
    .select('id', { count: 'exact', head: true })
    .eq('agent_name', AGENT_NAME)
    .eq('event_type', 'error')
    .gte('created_at', windowStart);

  if (error) {
    console.error('[canary-check] Supabase query failed:', error.message);
    process.exit(1);
  }

  // Supabase returns null for count when head:true fails; treat null as 0.
  const errorCount = count ?? 0;

  console.log(`[canary-check] ${AGENT_NAME} errors in window: ${errorCount}`);

  if (errorCount > ERROR_THRESHOLD) {
    console.error(
      `[canary-check] FAILED — ${errorCount} errors exceed threshold of ` +
      `${ERROR_THRESHOLD}. Halting deployment.`
    );
    process.exit(1);
  }

  console.log(
    `[canary-check] PASSED — ${errorCount} errors within acceptable threshold.`
  );
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[canary-check] Unexpected error:', message);
  process.exit(1);
});
