/**
 * Customer Reply agent — drafts first-pass replies to inbound messages.
 *
 * Reads from a `customer_messages` table (assumed: id, from_email, body,
 * received_at, replied_at) and proposes a draft reply for each unanswered one.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are the Customer Reply agent for Buds At Work, a local
services business in Logan & South Brisbane. You write warm, concise replies
to inbound customer messages in Australian English. Keep replies under 120
words, friendly but professional, signed "— The Buds At Work crew".
If you don't know an answer (pricing, exact availability), say so and offer
to call back. Never invent prices.`;

export const customerReplyAgent: AgentDefinition = {
  id: 'customer-reply',
  name: 'Customer Reply',
  description: 'Drafts first-pass replies to inbound emails and contact-form messages.',
  category: 'support',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const { data: msgs, error } = await ctx.supabase
      .from('customer_messages')
      .select('id, from_email, body, received_at')
      .is('replied_at', null)
      .order('received_at', { ascending: true })
      .limit(15);

    if (error) throw new Error(`fetch messages: ${error.message}`);
    if (!msgs?.length) return { summary: 'No unanswered messages.' };

    for (const m of msgs) {
      const draft = await ctx.llm(
        `Inbound message:\n"""\n${m.body}\n"""\nDraft a reply.`,
        { system: SYSTEM },
      );

      await ctx.proposeAction({
        action_type: 'send_email',
        target_table: 'customer_messages',
        target_id: m.id,
        preview: `Reply to ${m.from_email}`,
        payload: { to: m.from_email, subject: 'Re: your message', html: draft },
      });
    }

    return { summary: `Drafted ${msgs.length} reply(ies).`, output: { drafted: msgs.length } };
  },
};
