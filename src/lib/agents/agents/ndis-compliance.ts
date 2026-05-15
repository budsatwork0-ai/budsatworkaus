/**
 * NDIS Compliance — make sure every NDIS job has the right paperwork
 * before invoicing. Flags missing service agreements, participant plans,
 * or formatting issues on invoices.
 */
import type { AgentDefinition, AgentContext } from '../types';

const REQUIRED_DOCS = ['service_agreement', 'participant_plan', 'plan_manager_details'];

export const ndisComplianceAgent: AgentDefinition = {
  id: 'ndis-compliance',
  name: 'NDIS Compliance',
  description: 'Ensures NDIS jobs have required paperwork before invoicing.',
  category: 'compliance',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const { data: jobs } = await ctx.supabase
      .from('jobs')
      .select('id, customer_id, ndis_participant_id, status, ready_to_invoice_at')
      .eq('ndis', true)
      .eq('status', 'completed')
      .is('invoiced_at', null);

    if (!jobs?.length) return { summary: 'No NDIS jobs awaiting invoice.' };

    let flagged = 0;
    let cleared = 0;

    for (const job of jobs) {
      const { data: docs } = await ctx.supabase
        .from('ndis_documents')
        .select('doc_type')
        .eq('participant_id', job.ndis_participant_id);

      const present = new Set((docs ?? []).map((d) => d.doc_type));
      const missing = REQUIRED_DOCS.filter((d) => !present.has(d));

      if (missing.length === 0) {
        cleared += 1;
        await ctx.supabase
          .from('jobs')
          .update({ ready_to_invoice_at: new Date().toISOString() })
          .eq('id', job.id);
        continue;
      }

      flagged += 1;
      await ctx.proposeAction({
        action_type: 'flag_for_review',
        target_table: 'jobs',
        target_id: job.id,
        preview: `NDIS job ${job.id} missing: ${missing.join(', ')}`,
        payload: { job_id: job.id, missing },
      });
    }

    return {
      summary: `Reviewed ${jobs.length} NDIS job(s): ${cleared} cleared, ${flagged} flagged for missing docs.`,
      output: { cleared, flagged, total: jobs.length },
    };
  },
};
