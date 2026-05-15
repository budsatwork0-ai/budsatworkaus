/**
 * Payment Reconciliation — compares Stripe + PayPal payments against
 * orders/invoices and flags mismatches or overdue payables.
 */
import type { AgentDefinition, AgentContext } from '../types';

export const reconciliationAgent: AgentDefinition = {
  id: 'reconciliation',
  name: 'Payment Reconciliation',
  description: 'Reconciles Stripe + PayPal payments with orders and flags overdue payables.',
  category: 'finance',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

    const { data: payments } = await ctx.supabase
      .from('payments')
      .select('id, provider, amount_cents, currency, order_id, status, created_at')
      .gte('created_at', since);

    const { data: orders } = await ctx.supabase
      .from('orders')
      .select('id, total_cents, status, due_date')
      .or('status.eq.invoiced,status.eq.partially_paid');

    const ordersById = new Map((orders ?? []).map((o) => [o.id, o]));
    const mismatches: Array<{ payment_id: string; reason: string }> = [];
    const overdue: Array<{ order_id: string; days_overdue: number }> = [];

    for (const p of payments ?? []) {
      const order = ordersById.get(p.order_id as string);
      if (!order) {
        mismatches.push({ payment_id: p.id, reason: 'No matching order' });
        continue;
      }
      if (order.total_cents !== p.amount_cents && order.status === 'invoiced') {
        mismatches.push({ payment_id: p.id, reason: `Amount mismatch: paid ${p.amount_cents}, owed ${order.total_cents}` });
      }
    }

    const now = Date.now();
    for (const o of orders ?? []) {
      if (!o.due_date) continue;
      const days = Math.floor((now - new Date(o.due_date).getTime()) / (24 * 3600_000));
      if (days > 0) overdue.push({ order_id: o.id, days_overdue: days });
    }

    if (mismatches.length === 0 && overdue.length === 0) {
      return { summary: 'Reconciliation clean: no mismatches or overdue payables.' };
    }

    for (const m of mismatches) {
      await ctx.proposeAction({
        action_type: 'flag_for_review',
        target_table: 'payments',
        target_id: m.payment_id,
        preview: `Mismatch: ${m.reason}`,
        payload: m,
      });
    }
    for (const o of overdue) {
      await ctx.proposeAction({
        action_type: 'flag_for_review',
        target_table: 'orders',
        target_id: o.order_id,
        preview: `Overdue ${o.days_overdue}d — ${o.order_id}`,
        payload: o,
      });
    }

    return {
      summary: `${mismatches.length} mismatch(es), ${overdue.length} overdue order(s).`,
      output: { mismatches, overdue },
    };
  },
};
