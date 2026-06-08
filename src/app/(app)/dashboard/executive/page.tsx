/**
 * Executive HQ — server component.
 * Fetches data server-side and passes it to the client component.
 */
import { createServiceClient } from '@/lib/supabase/server';
import { ExecutiveHQClient } from './ExecutiveHQClient';
import type {
  ExecutiveDecision,
  ExecutiveTask,
  ExecutiveMetricsSnapshot,
  ExecutiveWeeklyReview,
} from '@/lib/agents/executive/types';

async function fetchExecutiveData() {
  const supabase = createServiceClient();
  const since30d = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

  const [decisionsRes, tasksRes, snapshotsRes, weeklyRes] = await Promise.all([
    supabase
      .from('executive_decisions')
      .select('*')
      .gte('created_at', since30d)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('executive_tasks')
      .select('*')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('executive_metrics_snapshots')
      .select('*')
      .order('captured_at', { ascending: false })
      .limit(8),
    supabase
      .from('executive_weekly_reviews')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    decisions:     (decisionsRes.data ?? []) as ExecutiveDecision[],
    tasks:         (tasksRes.data ?? []) as ExecutiveTask[],
    snapshots:     (snapshotsRes.data ?? []) as ExecutiveMetricsSnapshot[],
    latestReview:  weeklyRes.data as ExecutiveWeeklyReview | null,
  };
}

export default async function ExecutivePage() {
  const data = await fetchExecutiveData();
  return <ExecutiveHQClient {...data} />;
}
