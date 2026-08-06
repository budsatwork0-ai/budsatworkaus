/**
 * bud-observer agent
 *
 * Collects a snapshot from each registered data source.
 * A single failing source produces a partial report rather than a crash.
 */

import { createServiceClient } from '@/lib/supabase/server';
import {
  safeSnapshot,
  type SnapshotResult,
  type SnapshotFailure,
} from './safe-snapshot';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ObserverReport {
  ok: boolean;
  partial: boolean;
  degradedSources: SnapshotFailure[];
  sources: SnapshotResult<unknown>[];
  runAt: string;
}

// ─── Data-source fetchers ─────────────────────────────────────────────────────

async function fetchLeadQueueDepth(): Promise<unknown> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from('quote_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
  return { leadQueueDepth: count ?? 0 };
}

async function fetchRecentAgentEvents(): Promise<unknown> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('agent_events')
    .select('id, agent, event_type, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { recentAgentEvents: data ?? [] };
}

async function fetchBookingCount(): Promise<unknown> {
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return { bookingCount: count ?? 0 };
}

// ─── Registered sources ───────────────────────────────────────────────────────

const DATA_SOURCES: Array<{ name: string; fetch: () => Promise<unknown> }> = [
  { name: 'lead_queue_depth', fetch: fetchLeadQueueDepth },
  { name: 'recent_agent_events', fetch: fetchRecentAgentEvents },
  { name: 'booking_count', fetch: fetchBookingCount },
];

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function runBudObserver(): Promise<ObserverReport> {
  const results = await Promise.all(
    DATA_SOURCES.map(({ name, fetch: fn }) => safeSnapshot(name, fn)),
  );

  const degradedSources = results.filter(
    (r): r is SnapshotFailure => !r.ok,
  );

  const partial = degradedSources.length > 0;
  const ok = degradedSources.length < DATA_SOURCES.length; // at least one succeeded

  const report: ObserverReport = {
    ok,
    partial,
    degradedSources,
    sources: results,
    runAt: new Date().toISOString(),
  };

  if (partial) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        agent: 'bud-observer',
        message: 'Observer run completed with degraded sources',
        degradedSources: degradedSources.map((s) => ({
          source: s.source,
          failureKind: s.failureKind,
          message: s.message,
        })),
      }),
    );
  }

  return report;
}
