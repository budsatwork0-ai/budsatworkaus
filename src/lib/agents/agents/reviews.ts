/**
 * Reviews & Reputation — post-job review requests, follow-ups, and
 * negative feedback flagging.
 */
import type { AgentDefinition, AgentContext } from '../types';
import { detectSandboxReviewCase } from '../sandbox-input';

const SYSTEM = `You write short, warm post-service review requests for Buds At
Work customers in Australian English. ≤ 80 words. Always include a clear
single CTA link placeholder {{REVIEW_URL}} the system will fill in.`;

export const reviewsAgent: AgentDefinition = {
  id: 'reviews',
  name: 'Reviews & Reputation',
  description: 'Sends post-job review requests, one follow-up, flags negative feedback.',
  category: 'support',
  autonomy: 'review',
  preferredModel: 'claude-haiku-4-5-20251001',
  async run(ctx: AgentContext) {
    // ── Sandbox scenario path ───────────────────────────────────────────
    // Arena scenarios inject the review/customer via ctx.input — the jobs
    // queries below would return nothing. Build a synthetic case instead.
    // Synthetic IDs are sandbox- prefixed; no production writes occur.
    const sandboxCase = detectSandboxReviewCase(ctx.input);
    if (sandboxCase) {
      if (sandboxCase.kind === 'negative_review') {
        await ctx.proposeAction({
          action_type: 'flag_for_review',
          target_table: 'ratings',
          target_id: sandboxCase.reviewId,
          preview: `${sandboxCase.rating}-star ${sandboxCase.platform} review flagged for review`,
          payload: {
            reason: 'negative_public_review',
            resource_type: 'review',
            review_id: sandboxCase.reviewId,
            platform: sandboxCase.platform,
            rating: sandboxCase.rating,
            review_text: sandboxCase.reviewText,
            internal_note:
              'Negative public review. Do not auto-reply — owner should respond personally and investigate the job before posting.',
          },
        });
        return {
          summary: `Sandbox: flagged ${sandboxCase.rating}-star ${sandboxCase.platform} review for human review.`,
          output: { sandbox: true, flagged: 1 },
        };
      }

      // Satisfied customer → friendly review request email.
      let msg: string | null = null;
      try {
        const raw = await ctx.llm(
          `Customer: ${sandboxCase.customerName}. Service completed: ${sandboxCase.service}.`,
          { system: SYSTEM },
        );
        msg = raw && raw.trim().length > 0 ? raw.trim() : null;
      } catch (err) {
        ctx.log('sandbox: LLM draft failed, using fallback', { error: String(err) });
      }
      const html =
        msg ??
        `Hi ${sandboxCase.customerName}, thanks for having us out for your ${sandboxCase.service}! If you have 30 seconds, a quick review would mean the world to our crew: {{REVIEW_URL}}. Cheers — the Buds At Work crew.`;

      await ctx.proposeAction({
        action_type: 'send_email',
        target_table: 'jobs',
        target_id: sandboxCase.jobId,
        preview: `Review request → ${sandboxCase.email}`,
        payload: {
          to: sandboxCase.email,
          subject: 'How did we do?',
          html,
          kind: 'review_initial',
        },
      });
      return {
        summary: 'Sandbox: queued 1 review request email.',
        output: { sandbox: true, initial: 1, used_fallback: msg === null },
      };
    }

    const followUpDays = Number((ctx.config?.follow_up_after_days as number) ?? 3);
    const cutoff = new Date(Date.now() - followUpDays * 24 * 3600_000).toISOString();

    // Initial requests
    const { data: needsInitial } = await ctx.supabase
      .from('jobs')
      .select('id, customer_id, customer_email, customer_name, completed_at')
      .eq('status', 'completed')
      .is('review_requested_at', null)
      .not('customer_email', 'is', null)
      .limit(20);

    // Follow-ups (initial sent, no response, > N days ago)
    const { data: needsFollow } = await ctx.supabase
      .from('jobs')
      .select('id, customer_email, customer_name, review_requested_at, review_responded_at')
      .lt('review_requested_at', cutoff)
      .is('review_responded_at', null)
      .is('review_follow_up_at', null)
      .limit(20);

    let count = 0;

    for (const job of needsInitial ?? []) {
      const msg = await ctx.llm(`Customer: ${job.customer_name}. Service completed.`, { system: SYSTEM });
      await ctx.proposeAction({
        action_type: 'send_email',
        target_table: 'jobs',
        target_id: job.id,
        preview: `Review request → ${job.customer_email}`,
        payload: { to: job.customer_email, subject: 'How did we do?', html: msg, kind: 'review_initial' },
      });
      count += 1;
    }

    for (const job of needsFollow ?? []) {
      await ctx.proposeAction({
        action_type: 'send_email',
        target_table: 'jobs',
        target_id: job.id,
        preview: `Review follow-up → ${job.customer_email}`,
        payload: {
          to: job.customer_email,
          subject: 'Quick favour?',
          html: `Hey ${job.customer_name ?? 'there'}, just bumping this up — would mean a lot if you could leave us a quick review: {{REVIEW_URL}}. Cheers, the Buds At Work crew.`,
          kind: 'review_follow_up',
        },
      });
      count += 1;
    }

    return { summary: `Queued ${count} review email(s).`, output: { initial: needsInitial?.length ?? 0, follow_ups: needsFollow?.length ?? 0 } };
  },
};
