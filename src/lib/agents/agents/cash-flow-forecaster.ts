/**
 * Cash Flow Forecaster — builds an 8-week rolling cash forecast.
 * Combines: expected receivables (open invoices + recurring revenue) and
 * expected payables (crew payroll, recurring vendor costs, dump fees).
 */
import type { AgentDefinition, AgentContext } from '../types';

interface WeekBucket { week_start: string; expected_in: number; expected_out: number; balance: number }

export const cashFlowForecasterAgent: AgentDefinition = {
  id: 'cash-flow-forecaster',
  name: 'Cash Flow Forecaster',
  description: 'Combines pipeline, recurring revenue, and payables into an 8-week cash forecast.',
  category: 'finance',
  autonomy: 'review',
  schema_dependencies: ['orders', 'payables', 'subscriptions', 'cash_flow_forecasts'],
  async run(ctx: AgentContext) {
    const horizon = Number((ctx.config?.horizon_weeks as number) ?? 8);
    const floor = Number((ctx.config?.floor_aud as number) ?? 2000);

    const horizonEnd = new Date(Date.now() + horizon * 7 * 86_400_000).toISOString();

    const [orders, payables, recurring] = await Promise.all([
      ctx.supabase
        .from('orders')
        .select('id, total_cents, due_date, status')
        .in('status', ['invoiced', 'partially_paid'])
        .lte('due_date', horizonEnd),
      ctx.supabase
        .from('payables')
        .select('id, amount_cents, due_date, status')
        .neq('status', 'paid')
        .lte('due_date', horizonEnd),
      ctx.supabase
        .from('subscriptions')
        .select('id, customer_id, plan_cents, billing_day, status')
        .eq('status', 'active'),
    ]);

    // Bucketize into weeks
    const weeks: WeekBucket[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monday = new Date(today); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    for (let i = 0; i < horizon; i += 1) {
      const start = new Date(monday); start.setDate(start.getDate() + i * 7);
      weeks.push({ week_start: start.toISOString().slice(0, 10), expected_in: 0, expected_out: 0, balance: 0 });
    }
    const bucketFor = (dateStr: string) => {
      const t = new Date(dateStr).getTime();
      return weeks.findIndex((w, i) => {
        const ws = new Date(w.week_start).getTime();
        const we = i === weeks.length - 1 ? Infinity : new Date(weeks[i + 1].week_start).getTime();
        return t >= ws && t < we;
      });
    };

    for (const o of orders.data ?? []) {
      const idx = bucketFor(o.due_date as string);
      if (idx >= 0) weeks[idx].expected_in += (o.total_cents as number) / 100;
    }
    for (const p of payables.data ?? []) {
      const idx = bucketFor(p.due_date as string);
      if (idx >= 0) weeks[idx].expected_out += (p.amount_cents as number) / 100;
    }
    // Spread recurring revenue across weeks
    const recurringPerWeek = (recurring.data ?? []).reduce((s, r) => s + ((r.plan_cents as number) / 100) / 4, 0);
    for (const w of weeks) w.expected_in += recurringPerWeek;

    let running = 0;
    const warnings: string[] = [];
    for (const w of weeks) {
      running += (w.expected_in - w.expected_out);
      w.balance = Math.round(running);
      if (w.balance < floor) warnings.push(`Week of ${w.week_start}: balance projected at $${w.balance.toFixed(0)} — below floor of $${floor}`);
    }

    await ctx.supabase.from('cash_flow_forecasts').insert({
      run_id: ctx.runId,
      weeks,
      warnings,
    });

    if (warnings.length) {
      await ctx.proposeAction({
        action_type: 'flag_for_review',
        target_table: 'cash_flow_forecasts',
        target_id: undefined,
        preview: `${warnings.length} week(s) below cash floor`,
        payload: { warnings, weeks },
      });
    }

    return {
      summary: `Forecast: ${warnings.length} warning(s). Final week balance ≈ $${weeks[weeks.length - 1].balance}`,
      output: { weeks, warnings },
    };
  },
};
