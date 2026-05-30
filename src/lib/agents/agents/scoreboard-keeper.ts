/**
 * Scoreboard Keeper — owns the marketing numbers. Reads the daily metric
 * snapshots, computes 7-day vs prior-7-day deltas and the publish streak,
 * and flags anomalies (e.g. a channel's reach falling off) for the pod.
 *
 * Manual-entry mode now; when platform APIs are connected this is where the
 * auto-pull lands instead of human logging. Lightweight → runs on Haiku.
 */
import type { AgentDefinition, AgentContext } from '../types';

type MetricRow = {
  snapshot_date: string;
  channel: string;
  views: number;
  engagements: number;
  followers: number;
  content_published: number;
};

function sum(rows: MetricRow[], key: keyof MetricRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

export const scoreboardKeeperAgent: AgentDefinition = {
  id: 'scoreboard-keeper',
  name: 'Scoreboard Keeper',
  description: 'Tracks marketing views/engagements/followers/published; computes deltas and streaks; flags what is working.',
  category: 'sales',
  autonomy: 'auto',
  preferredModel: 'claude-haiku-4-5-20251001',
  async run(ctx: AgentContext) {
    const since = new Date(Date.now() - 14 * 24 * 3600_000).toISOString().slice(0, 10);
    const { data } = await ctx.supabase
      .from('marketing_metrics')
      .select('snapshot_date, channel, views, engagements, followers, content_published')
      .gte('snapshot_date', since)
      .order('snapshot_date', { ascending: false });

    const rows = (data ?? []) as MetricRow[];
    if (rows.length === 0) {
      return { summary: 'No marketing metrics logged yet — nothing to score. Log the day\'s numbers in Marketing Studio.' };
    }

    const sevenAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString().slice(0, 10);
    const last7 = rows.filter((r) => r.snapshot_date >= sevenAgo);
    const prev7 = rows.filter((r) => r.snapshot_date < sevenAgo);

    const viewsNow = sum(last7, 'views');
    const viewsPrev = sum(prev7, 'views');
    const engNow = sum(last7, 'engagements');
    const viewsDelta = viewsPrev > 0 ? Math.round(((viewsNow - viewsPrev) / viewsPrev) * 100) : null;
    const engRate = viewsNow > 0 ? Math.round((engNow / viewsNow) * 1000) / 10 : 0;

    // Publish streak: consecutive recent days with any content published.
    const byDate = new Map<string, number>();
    rows.forEach((r) => byDate.set(r.snapshot_date, (byDate.get(r.snapshot_date) ?? 0) + (Number(r.content_published) || 0)));
    let streak = 0;
    for (let i = 0; i < 14; i += 1) {
      const d = new Date(Date.now() - i * 24 * 3600_000).toISOString().slice(0, 10);
      if ((byDate.get(d) ?? 0) > 0) streak += 1; else break;
    }

    // Anomaly: views down sharply week-on-week → tell the pod to fix the hooks.
    if (viewsDelta !== null && viewsDelta <= -30) {
      await ctx.proposeAction({
        action_type: 'flag_for_review',
        target_table: 'marketing_metrics',
        preview: `Reach down ${viewsDelta}% week-on-week — weak hooks? The Attention Seeker should adjust.`,
        payload: { viewsNow, viewsPrev, viewsDelta, engRate },
        confidence: 0.7,
        risk_level: 'low',
      });
    }

    return {
      summary: `7d: ${viewsNow} views (${viewsDelta === null ? 'n/a' : `${viewsDelta >= 0 ? '+' : ''}${viewsDelta}%`}), ${engRate}% engagement, ${streak}-day publish streak.`,
      output: { viewsNow, viewsPrev, viewsDelta, engRate, streak },
      confidenceScore: 0.9,
    };
  },
};
