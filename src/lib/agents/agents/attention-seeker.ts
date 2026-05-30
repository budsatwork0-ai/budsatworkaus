/**
 * The Attention Seeker — Growth & distribution lead. Reads the scoreboard and
 * the draft queue, then proposes a posting schedule, hooks, and hashtags tuned
 * to what's actually pulling reach. Optimises for consistency first (publish
 * streak), reach second. Proposes; a human approves before anything ships.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are The Attention Seeker, growth lead for Buds At Work
(Logan & South Brisbane home services). You chase reach without cheapening the
brand. Given draft posts and recent performance, return a distribution plan.
Strict JSON:
{
  "plan": [
    { "draft_id": "uuid", "channel": "instagram"|"tiktok"|"facebook"|"gbp",
      "post_at": "ISO time today/tomorrow at a local peak",
      "hook": "scroll-stopping first line", "hashtags": ["#..."] }
  ],
  "note": "one line on what to make more of"
}`;

export const attentionSeekerAgent: AgentDefinition = {
  id: 'attention-seeker',
  name: 'The Attention Seeker',
  description: 'Growth & distribution — posting cadence, hooks, hashtags, follower/engagement growth from the scoreboard.',
  category: 'sales',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const { data: drafts } = await ctx.supabase
      .from('content_drafts')
      .select('id, channel, title, body')
      .in('status', ['draft', 'approved'])
      .order('created_at', { ascending: true })
      .limit(8);

    if (!drafts?.length) {
      return { summary: 'No drafts waiting to schedule. Ask Stanley / the Content Agent for fresh material.' };
    }

    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString().slice(0, 10);
    const { data: metrics } = await ctx.supabase
      .from('marketing_metrics')
      .select('channel, views, engagements')
      .gte('snapshot_date', since);

    const perf = (metrics ?? []).reduce<Record<string, { views: number; eng: number }>>((acc, m) => {
      const c = m.channel as string;
      acc[c] = acc[c] || { views: 0, eng: 0 };
      acc[c].views += Number(m.views) || 0;
      acc[c].eng += Number(m.engagements) || 0;
      return acc;
    }, {});

    const raw = await ctx.llm(
      `Drafts:\n${drafts.map((d) => `- ${d.id} [${d.channel}] ${d.title ?? (d.body ?? '').slice(0, 50)}`).join('\n')}\n\nLast 7d performance by channel: ${JSON.stringify(perf)}\n\nReturn the distribution plan JSON.`,
      { system: SYSTEM },
    );

    let parsed: { plan?: Array<{ draft_id: string; channel: string; post_at: string; hook?: string; hashtags?: string[] }>; note?: string };
    try { parsed = JSON.parse(raw); } catch { return { summary: 'Could not parse the distribution plan.' }; }

    let scheduled = 0;
    for (const p of parsed.plan ?? []) {
      if (!drafts.some((d) => d.id === p.draft_id)) continue;
      await ctx.proposeAction({
        action_type: 'schedule_post',
        target_table: 'content_drafts',
        target_id: p.draft_id,
        preview: `Schedule ${p.channel} for ${p.post_at} — hook: ${(p.hook ?? '').slice(0, 50)}`,
        payload: { scheduled_for: p.post_at, channel: p.channel, hook: p.hook, hashtags: p.hashtags ?? [] },
        confidence: 0.65,
        risk_level: 'low',
      });
      scheduled += 1;
    }

    return {
      summary: `Proposed a posting schedule for ${scheduled} draft(s).${parsed.note ? ` ${parsed.note}` : ''}`,
      output: { scheduled, note: parsed.note ?? null },
      confidenceScore: 0.65,
    };
  },
};
