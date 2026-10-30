/**
 * Rule-based owner reminders. No AI calls, and nothing is ever sent to a
 * customer: every bot only creates a "flag_for_review" item for the owner
 * to look at in the admin.
 */
import type { AgentContext, AgentDefinition } from '../types';

const DAY = 86_400_000;

function brisbaneDate(offsetDays = 0) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' })
    .format(new Date(Date.now() + offsetDays * DAY));
}

/** Skip if this bot already raised a reminder for this record. */
async function alreadyFlagged(ctx: AgentContext, targetId: string, sinceDays = 365) {
  const { data } = await ctx.supabase
    .from('agent_actions')
    .select('id')
    .eq('agent_id', ctx.agentId)
    .eq('target_id', targetId)
    .gte('created_at', new Date(Date.now() - sinceDays * DAY).toISOString())
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function remind(ctx: AgentContext, table: string, id: string, preview: string, payload: Record<string, unknown>) {
  await ctx.proposeAction({
    action_type: 'flag_for_review',
    target_table: table,
    target_id: id,
    preview,
    payload: { ...payload, owner_only: true },
    requiresApproval: true,
    risk_level: 'low',
  });
}

const base = {
  autonomy: 'review' as const,
  preferredModel: 'none',
};

export const newLeadAlertAgent: AgentDefinition = {
  ...base,
  id: 'new-lead-alert',
  name: 'New Lead Alert',
  description: 'Tells you when a new lead comes in. Never messages the customer.',
  category: 'sales',
  schema_dependencies: ['leads'],
  async run(ctx) {
    const { data } = await ctx.supabase
      .from('leads')
      .select('id, customer_name, service_type, suburb, source, created_at')
      .eq('environment', 'production').eq('is_test', false)
      .eq('response_status', 'awaiting_response')
      .gte('created_at', new Date(Date.now() - 2 * DAY).toISOString());
    let n = 0;
    for (const l of data ?? []) {
      if (await alreadyFlagged(ctx, l.id)) continue;
      await remind(ctx, 'leads', l.id,
        `New lead: ${l.customer_name || 'No name'}${l.service_type ? ` · ${l.service_type}` : ''}${l.suburb ? ` · ${l.suburb}` : ''}`,
        { lead_id: l.id, source: l.source });
      n += 1;
    }
    return { summary: `${n} new lead alert(s).`, output: { alerts: n } };
  },
};

export const quoteFollowUpAgent: AgentDefinition = {
  ...base,
  id: 'quote-follow-up',
  name: 'Quote Follow-up',
  description: 'Reminds you to chase quotes with no answer after 3 days. Never messages the customer.',
  category: 'sales',
  schema_dependencies: ['quotes'],
  async run(ctx) {
    const { data } = await ctx.supabase
      .from('quotes')
      .select('id, customer_name, customer_phone, service_type, total, created_at')
      .eq('environment', 'production').eq('is_test', false)
      .in('status', ['submitted', 'finalized'])
      .neq('payment_status', 'paid')
      .is('converted_order_id', null)
      .lt('created_at', new Date(Date.now() - 3 * DAY).toISOString())
      .gte('created_at', new Date(Date.now() - 30 * DAY).toISOString());
    let n = 0;
    for (const q of data ?? []) {
      if (await alreadyFlagged(ctx, q.id)) continue;
      const first = (q.customer_name || '').split(' ')[0] || 'there';
      await remind(ctx, 'quotes', q.id,
        `Chase quote: ${q.customer_name || 'Customer'}${q.total ? ` · $${q.total}` : ''}`,
        { quote_id: q.id, draft_text: `Hi ${first}, just checking in on the quote we sent for ${q.service_type || 'the job'}. Happy to answer any questions. Cheers, Buds At Work` });
      n += 1;
    }
    return { summary: `${n} quote(s) to chase.`, output: { reminders: n } };
  },
};

export const bookingRunSheetAgent: AgentDefinition = {
  ...base,
  id: 'booking-run-sheet',
  name: 'Booking Reminder & Run Sheet',
  description: "Each morning, lists tomorrow's jobs for you. Never messages the customer.",
  category: 'ops',
  schema_dependencies: ['orders'],
  async run(ctx) {
    const tomorrow = brisbaneDate(1);
    const { data } = await ctx.supabase
      .from('orders')
      .select('id, customer_name, customer_phone, service_type, scheduled_time, notes')
      .eq('environment', 'production').eq('is_test', false)
      .eq('scheduled_date', tomorrow).neq('status', 'cancelled')
      .order('scheduled_time', { ascending: true });
    const jobs = data ?? [];
    if (jobs.length === 0) return { summary: `No jobs on ${tomorrow}.` };
    const key = `run-sheet-${tomorrow}`;
    const { data: prior } = await ctx.supabase.from('agent_actions').select('id')
      .eq('agent_id', ctx.agentId).eq('target_id', key).limit(1);
    if ((prior?.length ?? 0) === 0) {
      await remind(ctx, 'orders', key,
        `Tomorrow (${tomorrow}): ${jobs.length} job(s) · ${jobs.map((j) => `${j.scheduled_time || ''} ${j.customer_name || ''}`.trim()).join(', ')}`,
        { date: tomorrow, jobs });
    }
    return { summary: `Run sheet for ${tomorrow}: ${jobs.length} job(s).`, output: { jobs: jobs.length } };
  },
};

export const invoiceChaserAgent: AgentDefinition = {
  ...base,
  id: 'invoice-chaser',
  name: 'Invoice Chaser',
  description: 'Reminds you about invoices unpaid after 7 days. Never messages the customer.',
  category: 'finance',
  schema_dependencies: ['orders'],
  async run(ctx) {
    const { data } = await ctx.supabase
      .from('orders')
      .select('id, customer_name, final_price, stripe_invoice_number, stripe_invoice_sent_at')
      .eq('environment', 'production').eq('is_test', false)
      .eq('stripe_invoice_status', 'open')
      .lt('stripe_invoice_sent_at', new Date(Date.now() - 7 * DAY).toISOString());
    let n = 0;
    for (const o of data ?? []) {
      if (await alreadyFlagged(ctx, o.id, 7)) continue;
      await remind(ctx, 'orders', o.id,
        `Unpaid 7+ days: ${o.customer_name || 'Customer'} · $${o.final_price}${o.stripe_invoice_number ? ` · ${o.stripe_invoice_number}` : ''}`,
        { order_id: o.id });
      n += 1;
    }
    return { summary: `${n} unpaid invoice reminder(s).`, output: { reminders: n } };
  },
};

export const reviewRebookAgent: AgentDefinition = {
  ...base,
  id: 'review-rebook',
  name: 'Review & Rebook',
  description: 'Reminds you to ask for a review and rebook customers 8 weeks after a job. Never messages the customer.',
  category: 'sales',
  schema_dependencies: ['orders'],
  async run(ctx) {
    const from = new Date(Date.now() - 63 * DAY).toISOString();
    const to = new Date(Date.now() - 56 * DAY).toISOString();
    const { data } = await ctx.supabase
      .from('orders')
      .select('id, customer_id, customer_name, customer_email, service_type, completed_at')
      .eq('environment', 'production').eq('is_test', false)
      .eq('status', 'completed').gte('completed_at', from).lt('completed_at', to);
    let n = 0;
    for (const o of data ?? []) {
      if (await alreadyFlagged(ctx, o.id)) continue;
      // Skip if they already have a newer job booked.
      if (o.customer_email) {
        const { data: newer } = await ctx.supabase.from('orders').select('id')
          .eq('customer_email', o.customer_email).gt('created_at', o.completed_at).neq('status', 'cancelled').limit(1);
        if ((newer?.length ?? 0) > 0) continue;
      }
      await remind(ctx, 'orders', o.id,
        `8 weeks since ${o.customer_name || 'a customer'}'s ${o.service_type || 'job'}: ask for a review and rebook`,
        { order_id: o.id });
      n += 1;
    }
    return { summary: `${n} review & rebook reminder(s).`, output: { reminders: n } };
  },
};

export const OWNER_REMINDER_AGENTS = [
  newLeadAlertAgent, quoteFollowUpAgent, bookingRunSheetAgent, invoiceChaserAgent, reviewRebookAgent,
];
