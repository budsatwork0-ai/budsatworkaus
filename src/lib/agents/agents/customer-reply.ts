/**
 * Customer Reply agent — drafts first-pass replies to inbound messages.
 *
 * Data source (live schema): inbound rows in `lead_conversations`
 * (direction='inbound'), joined to `leads` for the recipient email. A lead is
 * treated as "unanswered" when `leads.first_response_at IS NULL` — i.e. nobody
 * has replied to it yet — which keeps the agent from double-replying.
 *
 * (The original version read a `customer_messages` table that does not exist in
 * this database; see the schema-drift report.)
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are the Customer Reply agent for Buds At Work, a local
services business in Logan & South Brisbane. You write warm, concise replies
to inbound customer messages in Australian English. Keep replies under 120
words, friendly but professional, signed "— The Buds At Work crew".
If you don't know an answer (pricing, exact availability), say so and offer
to call back. Never invent prices.`;

type ConversationRow = {
  id: string;
  lead_id: string | null;
  body: string | null;
  channel: string | null;
  created_at: string;
};

type LeadRow = {
  id: string;
  customer_email: string | null;
  customer_name: string | null;
  first_response_at: string | null;
};

export const customerReplyAgent: AgentDefinition = {
  id: 'customer-reply',
  name: 'Customer Reply',
  description: 'Drafts first-pass replies to inbound emails and contact-form messages.',
  category: 'support',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    // Most-recent inbound messages across leads.
    const { data: inbound, error } = await ctx.supabase
      .from('lead_conversations')
      .select('id, lead_id, body, channel, created_at')
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) throw new Error(`fetch lead_conversations: ${error.message}`);
    if (!inbound?.length) return { summary: 'No inbound messages.' };

    const leadIds = Array.from(
      new Set((inbound as ConversationRow[]).map((m) => m.lead_id).filter((id): id is string => Boolean(id))),
    );
    if (leadIds.length === 0) return { summary: 'No inbound messages linked to a lead.' };

    // Only reply to leads nobody has responded to yet.
    const { data: leads, error: leadsErr } = await ctx.supabase
      .from('leads')
      .select('id, customer_email, customer_name, first_response_at')
      .in('id', leadIds)
      .is('first_response_at', null);

    if (leadsErr) throw new Error(`fetch leads: ${leadsErr.message}`);
    if (!leads?.length) return { summary: 'No unanswered leads — all inbound messages already have a response.' };

    const leadById = new Map<string, LeadRow>((leads as LeadRow[]).map((l) => [l.id, l]));

    // Keep the newest inbound message per unanswered lead (inbound is already
    // sorted newest-first, so the first one we see per lead is the latest).
    const seen = new Set<string>();
    const targets: Array<{ conv: ConversationRow; lead: LeadRow }> = [];
    for (const conv of inbound as ConversationRow[]) {
      if (!conv.lead_id || seen.has(conv.lead_id)) continue;
      const lead = leadById.get(conv.lead_id);
      if (!lead || !lead.customer_email || !conv.body) continue;
      seen.add(conv.lead_id);
      targets.push({ conv, lead });
      if (targets.length >= 15) break;
    }

    if (targets.length === 0) return { summary: 'No unanswered messages with a usable email.' };

    for (const { conv, lead } of targets) {
      const draft = await ctx.llm(
        `Inbound message (${conv.channel ?? 'unknown channel'}):\n"""\n${conv.body}\n"""\nDraft a reply.`,
        { system: SYSTEM },
      );

      await ctx.proposeAction({
        action_type: 'send_email',
        target_table: 'leads',
        target_id: lead.id,
        preview: `Reply to ${lead.customer_name ?? lead.customer_email}`,
        payload: {
          to: lead.customer_email,
          subject: 'Re: your message',
          html: draft,
          meta: { lead_id: lead.id, conversation_id: conv.id },
        },
      });
    }

    return { summary: `Drafted ${targets.length} reply(ies).`, output: { drafted: targets.length } };
  },
};
