/**
 * Content Agent — drafts weekly social + local-blog posts from real
 * recent jobs, using photos already cleared by Photo QA for marketing.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are the Buds At Work content writer. Voice: warm Australian
tradie. Logan / South Brisbane local. Never corporate. Draft for the requested
channel using a real recent job. Strict JSON:
{
  "drafts": [
    {
      "channel": "instagram"|"facebook"|"gbp"|"blog",
      "title": "...",
      "body": "...",
      "hashtags": ["..."],
      "photo_ids": ["uuid",...]
    }
  ]
}
Caption rules:
- Instagram ≤ 220 chars, 5-8 hashtags, ends with CTA
- Facebook 1-2 short paragraphs, no hashtags
- GBP ≤ 1500 chars, plain text, suburb-keyworded
- Blog 350-500 words, H1 + 2 H2s`;

export const contentAgent: AgentDefinition = {
  id: 'content-agent',
  name: 'Content Agent',
  description: 'Drafts weekly social posts and local blog content from real jobs.',
  category: 'sales',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const { data: jobs } = await ctx.supabase
      .from('jobs')
      .select('id, service, suburb, completed_at, customer_notes')
      .eq('status', 'completed')
      .gte('completed_at', since)
      .limit(8);
    if (!jobs?.length) return { summary: 'No recent completed jobs to write about.' };

    const channels = (ctx.config?.channels as string[] | undefined) ?? ['instagram', 'facebook', 'gbp', 'blog'];
    let drafted = 0;

    for (const job of jobs.slice(0, 3)) {
      const { data: photos } = await ctx.supabase
        .from('job_photos')
        .select('id, kind, tags')
        .eq('job_id', job.id)
        .eq('marketing_ok', true)
        .limit(4);

      const raw = await ctx.llm(
        `Job: ${job.service} in ${job.suburb}\nNotes: ${job.customer_notes ?? ''}\nPhotos available: ${photos?.length ?? 0}\nChannels: ${channels.join(',')}\nReturn drafts JSON.`,
        { system: SYSTEM },
      );

      let parsed: { drafts: Array<{ channel: string; title?: string; body: string; hashtags?: string[]; photo_ids?: string[] }> };
      try { parsed = JSON.parse(raw); } catch { continue; }

      for (const d of parsed.drafts ?? []) {
        await ctx.supabase.from('content_drafts').insert({
          agent_id: 'content-agent',
          run_id: ctx.runId,
          channel: d.channel,
          title: d.title,
          body: d.body,
          hashtags: d.hashtags ?? [],
          photo_ids: (photos ?? []).slice(0, 3).map((p) => p.id),
        });
        await ctx.proposeAction({
          action_type: 'flag_for_review',
          target_table: 'content_drafts',
          target_id: undefined,
          preview: `${d.channel} draft: ${(d.title ?? d.body).slice(0, 60)}…`,
          payload: { channel: d.channel, body: d.body },
        });
        drafted += 1;
      }
    }

    return { summary: `Drafted ${drafted} piece(s) of content.`, output: { drafted } };
  },
};
