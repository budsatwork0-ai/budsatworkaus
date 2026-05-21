/**
 * Lapsed Win-back — finds customers with no booking in 90+ days,
 * segments by last service, drafts a personalised win-back.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `Write a warm, short win-back message (≤ 110 words) in
Australian English. Lead with what they last had done, mention the
specific service in plain terms, and offer one reason to come back now
(seasonal, top-up, recurring discount). Sign "— Jackson at Buds At Work".
Strict JSON:
{ "subject": "...", "body": "...", "offer_summary": "..." }`;

export const lapsedWinBackAgent: AgentDefinition = {
  id: 'lapsed-win-back',
  name: 'Lapsed Win-back',
  description: "Finds customers who haven't booked in 90+ days; drafts personalised win-back.",
  category: 'sales',
  autonomy: 'review',
  preferredModel: 'claude-haiku-4-5-20251001',
  async run(ctx: AgentContext) {
    const lapsedDays = Number((ctx.config?.lapsed_after_days as number) ?? 90);
    const cutoff = new Date(Date.now() - lapsedDays * 24 * 3600_000).toISOString();

    // Customers whose most recent completed job is older than the cutoff,
    // and who we haven't already pinged in the last 60 days.
    type LapsedRow = { customer_id: string; email: string; name: string; last_service: string; last_job_at: string };
    const { data: raw_candidates } = await ctx.supabase.rpc('lapsed_customers', {
      cutoff_ts: cutoff,
      ping_cooldown_days: 60,
    });
    const candidates = raw_candidates as LapsedRow[] | null;

    if (!candidates?.length) return { summary: 'No lapsed customers eligible for outreach.' };

    let count = 0;
    for (const c of candidates.slice(0, 30)) {
      const days = Math.floor((Date.now() - new Date(c.last_job_at).getTime()) / 86_400_000);
      const raw = await ctx.llm(
        `Customer: ${c.name}\nLast service: ${c.last_service}\nDays since: ${days}`,
        { system: SYSTEM },
      );
      let parsed: { subject: string; body: string; offer_summary: string };
      try { parsed = JSON.parse(raw); } catch { continue; }

      const { data: row } = await ctx.supabase.from('lapsed_outreach').insert({
        customer_id: c.customer_id,
        last_job_at: c.last_job_at,
        days_lapsed: days,
        segment: c.last_service,
        drafted_body: parsed.body,
      }).select('id').single();

      await ctx.proposeAction({
        action_type: 'send_email',
        target_table: 'lapsed_outreach',
        target_id: row?.id,
        preview: `Win-back → ${c.email} (${days}d lapsed, last: ${c.last_service})`,
        payload: { to: c.email, subject: parsed.subject, html: parsed.body, offer: parsed.offer_summary },
      });
      count += 1;
    }
    return { summary: `Drafted ${count} win-back outreach email(s).`, output: { drafted: count } };
  },
};
