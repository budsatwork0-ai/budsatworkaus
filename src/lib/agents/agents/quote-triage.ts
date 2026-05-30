/**
 * Quote Triage agent
 *
 * Fetches new quote requests that haven't been touched, classifies them
 * (service type, NDIS vs private, urgency), drafts a quote using your
 * pricing rules, and either auto-sends (under threshold) or queues for
 * review.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are the Quote Triage agent for Buds At Work, a local
home services business in Logan & South Brisbane offering cleaning, window
cleaning, yard care, dump runs, auto detailing, and laundry. You read incoming
quote requests and produce a structured triage decision.

Output strict JSON only, matching this shape:
{
  "service": "windows" | "cleaning" | "yard" | "dump" | "auto" | "laundry_sneakers" | "unknown",
  "ndis": boolean,
  "urgency": "low" | "normal" | "high",
  "estimated_aud": number,
  "confidence": number,           // 0-1
  "draft_message": string,        // friendly Australian English, ≤ 120 words
  "reason": string                // 1-2 sentences explaining the estimate
}`;

export const quoteTriageAgent: AgentDefinition = {
  id: 'quote-triage',
  name: 'Quote Triage',
  description:
    'Classifies incoming quote requests and drafts a first-pass quote.',
  category: 'sales',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    // Schema note: the live `quotes` table uses `service_address` + `service_type`
    // (there is no `suburb`/`service` column), and new requests land as
    // status='submitted' (there is no 'new' status).
    const { data: pending, error } = await ctx.supabase
      .from('quotes')
      .select('id, customer_email, customer_name, service_address, service_type, notes, created_at')
      .eq('status', 'submitted')
      .is('agent_triaged_at', null)
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw new Error(`fetch quotes: ${error.message}`);
    if (!pending || pending.length === 0) {
      return { summary: 'No new quote requests to triage.' };
    }

    const autoSendThreshold =
      Number((ctx.config?.auto_send_under_aud as number) ?? 250);

    let actions = 0;
    let autoSent = 0;

    for (const q of pending) {
      const prompt = `Quote request:
- Customer: ${q.customer_name ?? '(unknown)'}
- Address: ${q.service_address ?? '(unknown)'}
- Service hint: ${q.service_type ?? '(none)'}
- Notes: ${q.notes ?? '(none)'}
Return triage JSON.`;
      const raw = await ctx.llm(prompt, { system: SYSTEM });

      let parsed: {
        service: string;
        ndis: boolean;
        urgency: string;
        estimated_aud: number;
        confidence: number;
        draft_message: string;
        reason: string;
      };
      try {
        parsed = JSON.parse(raw);
      } catch {
        ctx.log('failed to parse model output', { id: q.id });
        continue;
      }

      const autoEligible =
        parsed.confidence >= 0.75 &&
        parsed.estimated_aud <= autoSendThreshold &&
        !parsed.ndis;

      await ctx.proposeAction({
        action_type: 'send_email',
        target_table: 'quotes',
        target_id: q.id,
        requiresApproval: !autoEligible,
        preview: `Quote ${parsed.service} for ${q.customer_name} at ${q.service_address ?? 'unknown address'} — AUD $${parsed.estimated_aud}`,
        payload: {
          to: q.customer_email,
          subject: `Your quote from Buds At Work`,
          html: parsed.draft_message,
          meta: { quote_id: q.id, estimate: parsed.estimated_aud, ndis: parsed.ndis },
        },
      });
      actions += 1;
      if (autoEligible) autoSent += 1;

      await ctx.supabase
        .from('quotes')
        .update({
          agent_triaged_at: new Date().toISOString(),
          agent_estimate_aud: parsed.estimated_aud,
          agent_service: parsed.service,
          agent_ndis: parsed.ndis,
        })
        .eq('id', q.id);
    }

    return {
      summary: `Triaged ${pending.length} quote(s) — ${autoSent} auto-sent, ${actions - autoSent} queued for review.`,
      output: { triaged: pending.length, auto_sent: autoSent },
    };
  },
};
