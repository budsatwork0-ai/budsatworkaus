/**
 * Stanley Henry — Creative Director. Turns the active campaign and real recent
 * jobs into a premium ad concept + brief, then hands it to the Content Agent to
 * draft. Guards the warm Australian tradie brand voice and the premium bar.
 * Proposes; a human approves before anything ships.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are Stanley Henry, Creative Director for Buds At Work
(cleaning, yard, window, detailing — Logan & South Brisbane). Voice: warm
Australian tradie, premium but never corporate or cheesy. Build ONE campaign-
ready ad concept from the brief. Strict JSON:
{
  "concept": "one-line creative idea",
  "hero_format": "instagram_reel"|"tiktok"|"facebook"|"gbp",
  "hook": "first 3 seconds / first line",
  "shot_list": ["...","...","..."],
  "caption_angle": "...",
  "offer": "the CTA / promise"
}`;

export const stanleyHenryAgent: AgentDefinition = {
  id: 'stanley-henry',
  name: 'Stanley Henry',
  description: 'Creative Director — premium ad concepts and campaign briefs from real jobs; guards the brand voice.',
  category: 'sales',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    // Prefer an active campaign, else the next one in planning.
    const { data: campaigns } = await ctx.supabase
      .from('marketing_campaigns')
      .select('id, name, service_type, hook, status')
      .in('status', ['active', 'planning'])
      .order('starts_on', { ascending: true })
      .limit(1);
    const campaign = campaigns?.[0] ?? null;

    // A real recent completed job to anchor the creative in something true.
    const { data: jobs } = await ctx.supabase
      .from('jobs')
      .select('id, service, suburb, completed_at')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1);
    const job = jobs?.[0] ?? null;

    const brief = [
      campaign ? `Campaign: ${campaign.name} (${campaign.status})${campaign.hook ? ` — "${campaign.hook}"` : ''}` : 'No active campaign — make an evergreen brand spot.',
      job ? `Anchor job: ${job.service} in ${job.suburb}` : 'No recent job — keep it brand/team focused.',
    ].join('\n');

    const raw = await ctx.llm(`${brief}\nReturn the ad concept JSON.`, { system: SYSTEM });
    let concept: Record<string, unknown>;
    try { concept = JSON.parse(raw); } catch { return { summary: 'Could not parse the ad concept.' }; }

    await ctx.proposeAction({
      action_type: 'flag_for_review',
      target_table: 'marketing_campaigns',
      target_id: campaign?.id,
      preview: `Stanley: ${(concept.concept as string) ?? 'ad concept'} — ${(concept.hero_format as string) ?? ''}`,
      payload: { campaign_id: campaign?.id ?? null, concept },
      confidence: 0.6,
      risk_level: 'low',
    });

    // Delegate the actual per-channel drafting to the Content Agent (guardrails apply).
    let delegated = false;
    try {
      await ctx.callAgent(
        'content-agent',
        { campaign_id: campaign?.id ?? null, brief: concept },
        `Draft posts for Stanley's concept: ${(concept.concept as string) ?? 'campaign'}`,
      );
      delegated = true;
    } catch {
      // Content Agent unavailable or guardrail-blocked — the concept still stands for review.
    }

    return {
      summary: `Built a premium concept${campaign ? ` for ${campaign.name}` : ''}${delegated ? ' and handed it to the Content Agent' : ''}.`,
      output: { campaign: campaign?.name ?? null, delegated },
      confidenceScore: 0.6,
    };
  },
};
