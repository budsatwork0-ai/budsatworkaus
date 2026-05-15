/**
 * Crew Today Briefing — generates each crew member's morning run sheet
 * message with addresses, gate codes, customer notes, dog/access warnings.
 *
 * This one is set to autonomy='auto' — the SMS goes out without review.
 */
import type { AgentDefinition, AgentContext } from '../types';

export const crewBriefingAgent: AgentDefinition = {
  id: 'crew-briefing',
  name: 'Crew Today Briefing',
  description: "Generates each crew member's morning run sheet message.",
  category: 'ops',
  autonomy: 'auto',
  async run(ctx: AgentContext) {
    const today = new Date().toISOString().slice(0, 10);

    const { data: crew } = await ctx.supabase
      .from('crew_members')
      .select('id, name, phone')
      .eq('active', true);

    if (!crew?.length) return { summary: 'No active crew members.' };

    let sent = 0;
    for (const member of crew) {
      const { data: jobs } = await ctx.supabase
        .from('jobs')
        .select('id, service, suburb, address, scheduled_for, customer_name, customer_notes, gate_code, access_notes')
        .eq('crew_member_id', member.id)
        .gte('scheduled_for', `${today}T00:00:00`)
        .lt('scheduled_for', `${today}T23:59:59`)
        .order('scheduled_for', { ascending: true });

      if (!jobs?.length) continue;

      const lines = jobs.map((j) => {
        const time = j.scheduled_for ? new Date(j.scheduled_for).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Brisbane' }) : '';
        const access = j.gate_code ? ` Code: ${j.gate_code}.` : '';
        const notes = j.customer_notes ? ` Note: ${j.customer_notes}.` : '';
        return `${time} ${j.service} — ${j.address}, ${j.suburb} (${j.customer_name}).${access}${notes}`;
      });

      const body = `G'day ${member.name.split(' ')[0]} — ${jobs.length} job(s) today:\n` + lines.join('\n');

      await ctx.proposeAction({
        action_type: 'send_sms',
        target_table: 'crew_members',
        target_id: member.id,
        preview: `Daily briefing → ${member.name}`,
        payload: { to: member.phone, body },
        requiresApproval: false,
      });
      sent += 1;
    }

    return { summary: `Sent daily briefing to ${sent} crew member(s).`, output: { sent } };
  },
};
