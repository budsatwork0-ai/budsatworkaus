/**
 * WHS Safety Reminder — watches crew compliance records (induction,
 * WWCC, first-aid, licence, equipment checks) and sends reminders
 * at configurable intervals before they lapse.
 *
 * Auto autonomy because reminders are low-risk and high-value.
 */
import type { AgentDefinition, AgentContext } from '../types';
import { detectSandboxWhsScenario, sandboxEmail, sandboxId } from '../sandbox-input';

export const whsSafetyReminderAgent: AgentDefinition = {
  id: 'whs-safety-reminder',
  name: 'WHS Safety Reminder',
  description: 'Tracks crew compliance expiries (induction, WWCC, first-aid, licence, equipment).',
  category: 'compliance',
  autonomy: 'auto',
  preferredModel: 'claude-haiku-4-5-20251001',
  schema_dependencies: ['whs_records', 'employees'],
  async run(ctx: AgentContext) {
    // ── Sandbox path ──────────────────────────────────────────────────────────
    const sandboxWhs = detectSandboxWhsScenario(
      (ctx.input ?? {}) as Record<string, unknown>,
    );
    if (sandboxWhs) {
      if (sandboxWhs.kind === 'reminder') {
        // → send_email: compliance reminder to crew
        await ctx.proposeAction({
          action_type: 'send_email',
          target_table: 'whs_records',
          target_id: sandboxId('whs-record'),
          preview: `WHS reminder: ${sandboxWhs.reminderType} due ${sandboxWhs.dueDate} — ${sandboxWhs.crewCount} crew affected`,
          payload: {
            to: sandboxEmail('crew'),
            subject: `Compliance reminder: ${sandboxWhs.reminderType.replace(/-/g, ' ')}`,
            html: `<p>Hi team, this is a reminder that your <strong>${sandboxWhs.reminderType.replace(/-/g, ' ')}</strong> compliance is due by ${sandboxWhs.dueDate}. Please ensure all ${sandboxWhs.crewCount} affected crew members complete the renewal. Thanks, Buds At Work.</p>`,
          },
          requiresApproval: false,
        });
        return {
          summary: `Sandbox WHS reminder: ${sandboxWhs.reminderType} due ${sandboxWhs.dueDate}, ${sandboxWhs.crewCount} crew.`,
          output: { sandbox: true, ...sandboxWhs },
        };
      }
      // incident → flag_for_review
      await ctx.proposeAction({
        action_type: 'flag_for_review',
        target_table: 'whs_records',
        target_id: sandboxWhs.jobId,
        preview: `WHS incident: ${sandboxWhs.incidentType} (${sandboxWhs.severity}) — ${sandboxWhs.crewName}`,
        payload: { sandbox: true, ...sandboxWhs },
        requiresApproval: true,
      });
      return {
        summary: `Sandbox WHS incident flagged: ${sandboxWhs.incidentType} (${sandboxWhs.severity}) involving ${sandboxWhs.crewName}.`,
        output: { sandbox: true, ...sandboxWhs },
      };
    }
    // ── Production path ───────────────────────────────────────────────────────
    const remindAt = (ctx.config?.remind_days_before as number[] | undefined) ?? [30, 14, 7, 1];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const horizon = new Date(today.getTime() + Math.max(...remindAt) * 86_400_000).toISOString().slice(0, 10);

    const { data: records } = await ctx.supabase
      .from('whs_records')
      .select('id, crew_member_id, record_type, reference, expires_at')
      .lte('expires_at', horizon);

    if (!records?.length) return { summary: 'All crew compliance up to date.' };

    let reminders = 0;
    let lapsed = 0;

    for (const r of records) {
      const daysOut = Math.floor((new Date(r.expires_at).getTime() - today.getTime()) / 86_400_000);

      if (daysOut < 0) {
        lapsed += 1;
        await ctx.proposeAction({
          action_type: 'flag_for_review',
          target_table: 'whs_records',
          target_id: r.id,
          preview: `LAPSED ${r.record_type} for crew ${r.crew_member_id} (${-daysOut}d overdue)`,
          payload: { record_id: r.id, lapsed_days: -daysOut },
          requiresApproval: true,
        });
        continue;
      }

      if (!remindAt.includes(daysOut)) continue;

      // Live schema: crew live in `employees` (name field is `full_name`).
      const { data: member } = await ctx.supabase
        .from('employees').select('full_name, phone, email').eq('id', r.crew_member_id).single();
      if (!member) continue;

      await ctx.proposeAction({
        action_type: 'send_sms',
        target_table: 'whs_records',
        target_id: r.id,
        preview: `${r.record_type} expiry reminder → ${member.full_name} (${daysOut}d)`,
        payload: {
          to: member.phone,
          body: `Hey ${member.full_name.split(' ')[0]}, your ${r.record_type.replace('_', ' ')} expires in ${daysOut} day${daysOut === 1 ? '' : 's'} (${r.expires_at}). Can you sort the renewal? Cheers, Buds.`,
        },
        requiresApproval: false,
      });
      reminders += 1;
    }

    return {
      summary: `${reminders} reminder(s) sent · ${lapsed} record(s) already lapsed.`,
      output: { reminders, lapsed },
    };
  },
};
