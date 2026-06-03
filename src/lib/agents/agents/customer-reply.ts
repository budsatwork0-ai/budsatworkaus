/**
 * Customer Reply agent — drafts first-pass replies to inbound messages.
 *
 * Branches on leads.reply_channel (added in Phase 5D):
 *   email     → proposes send_email  (Resend delivery)
 *   messenger → proposes send_messenger (Graph API, approval-gated)
 *   instagram → proposes flag_for_review (outbound not implemented yet)
 *   phone     → proposes flag_for_review (human callback required)
 *   sms       → skipped (Twilio not wired)
 *   null      → skipped
 *
 * Data source: lead_conversations (direction='inbound'), joined to leads
 * where first_response_at IS NULL (no reply sent yet).
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
  reply_channel: string | null;
  messenger_psid: string | null;
};

type DraftTarget = {
  kind: 'send_email' | 'send_messenger';
  conv: ConversationRow;
  lead: LeadRow;
};

type FlagTarget = {
  kind: 'flag_for_review';
  conv: ConversationRow;
  lead: LeadRow;
  reason: string;
};

type Target = DraftTarget | FlagTarget;

export const customerReplyAgent: AgentDefinition = {
  id: 'customer-reply',
  name: 'Customer Reply',
  description: 'Drafts first-pass replies to inbound emails and contact-form messages.',
  category: 'support',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const { data: inbound, error } = await ctx.supabase
      .from('lead_conversations')
      .select('id, lead_id, body, channel, created_at')
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(40);

    if (error) throw new Error(`fetch lead_conversations: ${error.message}`);
    if (!inbound?.length) return { summary: 'No inbound messages.' };

    const leadIds = Array.from(
      new Set(
        (inbound as ConversationRow[])
          .map((m) => m.lead_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (leadIds.length === 0) return { summary: 'No inbound messages linked to a lead.' };

    const { data: leads, error: leadsErr } = await ctx.supabase
      .from('leads')
      .select('id, customer_email, customer_name, first_response_at, reply_channel, messenger_psid')
      .in('id', leadIds)
      .is('first_response_at', null);

    if (leadsErr) throw new Error(`fetch leads: ${leadsErr.message}`);
    if (!leads?.length) return { summary: 'No unanswered leads — all inbound messages already have a response.' };

    // Prevent re-drafting leads that already have a pending reply of any kind.
    const { data: pendingActions, error: actionsErr } = await ctx.supabase
      .from('agent_actions')
      .select('target_id')
      .eq('agent_id', ctx.agentId)
      .in('action_type', ['send_email', 'send_messenger', 'flag_for_review'])
      .eq('target_table', 'leads')
      .eq('status', 'pending')
      .in('target_id', leadIds);

    if (actionsErr) throw new Error(`fetch pending replies: ${actionsErr.message}`);

    const leadsWithPendingReply = new Set(
      (pendingActions ?? [])
        .map((a) => a.target_id)
        .filter((id): id is string => Boolean(id)),
    );

    const leadById = new Map<string, LeadRow>(
      (leads as LeadRow[]).map((l) => [l.id, l]),
    );

    const seen = new Set<string>();
    const targets: Target[] = [];

    for (const conv of inbound as ConversationRow[]) {
      if (!conv.lead_id || seen.has(conv.lead_id)) continue;

      const lead = leadById.get(conv.lead_id);
      if (!lead || !conv.body) continue;
      if (leadsWithPendingReply.has(lead.id)) continue;

      const channel = lead.reply_channel;
      let target: Target | null = null;

      if (channel === 'email') {
        if (lead.customer_email) {
          target = { kind: 'send_email', conv, lead };
        }
        // no email on an email lead — skip silently
      } else if (channel === 'messenger') {
        if (lead.messenger_psid) {
          target = { kind: 'send_messenger', conv, lead };
        } else {
          target = { kind: 'flag_for_review', conv, lead, reason: 'messenger_lead_missing_psid' };
        }
      } else if (channel === 'instagram') {
        target = { kind: 'flag_for_review', conv, lead, reason: 'instagram_reply_not_implemented' };
      } else if (channel === 'phone') {
        target = { kind: 'flag_for_review', conv, lead, reason: 'phone_lead_requires_manual_callback' };
      }
      // sms and null: skip

      if (target) {
        seen.add(conv.lead_id);
        targets.push(target);
        if (targets.length >= 15) break;
      } else {
        seen.add(conv.lead_id);
      }
    }

    if (targets.length === 0) return { summary: 'No actionable inbound messages.' };

    let draftedEmail = 0;
    let draftedMessenger = 0;
    let flagged = 0;

    for (const target of targets) {
      if (target.kind === 'flag_for_review') {
        await ctx.proposeAction({
          action_type: 'flag_for_review',
          target_table: 'leads',
          target_id: target.lead.id,
          preview: `Manual reply needed — ${target.reason.replace(/_/g, ' ')} (${target.lead.customer_name ?? 'unknown'})`,
          payload: {
            reason: target.reason,
            lead_id: target.lead.id,
            channel: target.lead.reply_channel,
            conversation_id: target.conv.id,
          },
        });
        flagged++;
        continue;
      }

      const isMessenger = target.kind === 'send_messenger';
      const promptSuffix = isMessenger
        ? '\n\nIMPORTANT: Reply as plain text only — no HTML, markdown, or formatting. Under 120 words.'
        : '';

      const draft = await ctx.llm(
        `Inbound message (${target.conv.channel ?? 'unknown channel'}):\n"""\n${target.conv.body}\n"""\nDraft a reply.${promptSuffix}`,
        { system: SYSTEM },
      );

      if (isMessenger) {
        await ctx.proposeAction({
          action_type: 'send_messenger',
          target_table: 'leads',
          target_id: target.lead.id,
          preview: `Messenger reply to ${target.lead.customer_name ?? target.lead.messenger_psid}`,
          payload: {
            lead_id: target.lead.id,
            conversation_id: target.conv.id,
            messenger_psid: target.lead.messenger_psid,
            drafted_message: draft,
            customer_name: target.lead.customer_name ?? null,
            source: 'messenger',
          },
        });
        draftedMessenger++;
      } else {
        await ctx.proposeAction({
          action_type: 'send_email',
          target_table: 'leads',
          target_id: target.lead.id,
          preview: `Reply to ${target.lead.customer_name ?? target.lead.customer_email}`,
          payload: {
            to: target.lead.customer_email,
            subject: 'Re: your message',
            html: draft,
            meta: { lead_id: target.lead.id, conversation_id: target.conv.id },
          },
        });
        draftedEmail++;
      }
    }

    const parts: string[] = [];
    if (draftedEmail)    parts.push(`${draftedEmail} email reply(ies)`);
    if (draftedMessenger) parts.push(`${draftedMessenger} Messenger reply(ies)`);
    if (flagged)         parts.push(`${flagged} flagged for manual review`);
    const summary = parts.length ? `Drafted ${parts.join(', ')}.` : 'No actions taken.';

    return {
      summary,
      output: { drafted_email: draftedEmail, drafted_messenger: draftedMessenger, flagged },
    };
  },
};
