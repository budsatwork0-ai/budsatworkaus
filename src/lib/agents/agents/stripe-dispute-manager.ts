/**
 * Stripe Dispute Manager — for each unresolved dispute, assembles an
 * evidence package (booking, photos, customer communications, signed
 * terms, payment timeline) and drafts the response narrative in the
 * shape Stripe accepts.
 *
 * Submission stays human-approved (`review` autonomy) because the
 * consequences of getting this wrong are real money.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You write a Stripe dispute response. Given the booking, the
customer's complaint reason, supporting evidence summaries, and signed
terms, produce a calm, factual, chronological narrative (Stripe's
"product_description" and "uncategorized_text" fields). Strict JSON:
{
  "product_description": "...",
  "service_documentation_summary": "...",
  "customer_communication_summary": "...",
  "uncategorized_text": "...",
  "recommended_evidence_attachments": ["..."]
}`;

export const stripeDisputeManagerAgent: AgentDefinition = {
  id: 'stripe-dispute-manager',
  name: 'Stripe Dispute Manager',
  description: 'Assembles dispute evidence and drafts a Stripe-shaped response.',
  category: 'finance',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const { data: disputes } = await ctx.supabase
      .from('stripe_disputes')
      .select('id, charge_id, customer_id, amount_cents, reason, status, evidence_due_at')
      .in('status', ['warning_needs_response', 'needs_response'])
      .is('agent_drafted_at', null)
      .limit(10);

    if (!disputes?.length) return { summary: 'No disputes awaiting evidence.' };

    let drafted = 0;
    for (const d of disputes) {
      // Pull the booking & comms tied to the customer/charge
      const [jobs, photos, msgs] = await Promise.all([
        ctx.supabase.from('jobs').select('id, service, suburb, completed_at, signed_quote_url').eq('customer_id', d.customer_id).limit(5),
        ctx.supabase.from('job_photos').select('id, job_id, kind, storage_path').in('job_id', []), // hydrated below
        ctx.supabase.from('customer_messages').select('id, direction, subject, body, received_at').eq('customer_id', d.customer_id).limit(20),
      ]);

      const jobIds = (jobs.data ?? []).map((j) => j.id);
      const { data: relatedPhotos } = await ctx.supabase
        .from('job_photos').select('id, job_id, kind, storage_path').in('job_id', jobIds).limit(20);

      const evidenceBundle = {
        dispute: { id: d.id, reason: d.reason, amount: d.amount_cents },
        jobs: jobs.data,
        photos: relatedPhotos,
        communications: msgs.data,
      };

      const raw = await ctx.llm(JSON.stringify(evidenceBundle), { system: SYSTEM });
      let parsed: { product_description: string; service_documentation_summary: string; customer_communication_summary: string; uncategorized_text: string; recommended_evidence_attachments: string[] };
      try { parsed = JSON.parse(raw); } catch { continue; }

      await ctx.supabase.from('stripe_disputes').update({
        evidence_package: { ...parsed, _bundle: evidenceBundle },
        agent_drafted_at: new Date().toISOString(),
      }).eq('id', d.id);

      await ctx.proposeAction({
        action_type: 'flag_for_review',
        target_table: 'stripe_disputes',
        target_id: d.id,
        preview: `Dispute ${d.id} ($${(d.amount_cents ?? 0) / 100}) evidence drafted — review before submit`,
        payload: { dispute_id: d.id, recommended: parsed.recommended_evidence_attachments },
      });
      drafted += 1;
    }

    return { summary: `Drafted evidence for ${drafted} dispute(s).`, output: { drafted } };
  },
};
