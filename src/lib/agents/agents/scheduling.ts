/**
 * Job Scheduling agent — builds tomorrow's run sheet.
 *
 * Pulls confirmed jobs without a scheduled crew, the available crew + their
 * skills/vehicles for tomorrow, and the Brisbane weather forecast. Asks the
 * model to propose an assignment, then queues each assignment for review.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are the Scheduling agent for Buds At Work. You assign
confirmed jobs to crew for a specific date based on skill match, suburb
proximity (Logan & South Brisbane), vehicle/equipment needs, and weather.
Yard and window work should be rescheduled if rain probability >= 60%.
Output strict JSON only:
{
  "assignments": [
    {
      "job_id": "...",
      "crew_member_id": "...",
      "start_time": "HH:MM",
      "rationale": "..."
    }
  ],
  "weather_warnings": ["..."],
  "unassigned": ["job_id", ...]
}`;

interface JobRow {
  id: string;
  service: string;
  suburb: string;
  scheduled_for: string;
  estimated_minutes?: number;
}
interface CrewRow {
  id: string;
  name: string;
  skills: string[];
  available_tomorrow: boolean;
}

export const schedulingAgent: AgentDefinition = {
  id: 'scheduling',
  name: 'Job Scheduling',
  description: 'Builds the next-day run sheet from confirmed jobs and crew availability.',
  category: 'ops',
  autonomy: 'review',
  async run(ctx: AgentContext) {
    const tomorrow = new Date(Date.now() + 24 * 3600_000);
    const yyyyMmDd = tomorrow.toISOString().slice(0, 10);

    const { data: jobs } = await ctx.supabase
      .from('jobs')
      .select('id, service, suburb, scheduled_for, estimated_minutes')
      .eq('status', 'confirmed')
      .is('crew_member_id', null)
      .gte('scheduled_for', `${yyyyMmDd}T00:00:00`)
      .lt('scheduled_for', `${yyyyMmDd}T23:59:59`);

    const { data: crew } = await ctx.supabase
      .from('crew_members')
      .select('id, name, skills, available_tomorrow')
      .eq('available_tomorrow', true);

    if (!jobs?.length) return { summary: 'No unassigned jobs for tomorrow.' };
    if (!crew?.length) return { summary: 'No crew available tomorrow — flagging.' };

    // Fetch weather (cheap stub — replace with your provider).
    const weather = await fetchBrisbaneForecast(yyyyMmDd);

    const prompt = `Date: ${yyyyMmDd}
Weather: ${JSON.stringify(weather)}
Jobs (${(jobs as JobRow[]).length}):
${JSON.stringify(jobs, null, 2)}
Crew (${(crew as CrewRow[]).length}):
${JSON.stringify(crew, null, 2)}
Produce assignments JSON.`;
    const raw = await ctx.llm(prompt, { system: SYSTEM });
    const plan = JSON.parse(raw) as {
      assignments: Array<{ job_id: string; crew_member_id: string; start_time: string; rationale: string }>;
      weather_warnings: string[];
      unassigned: string[];
    };

    for (const a of plan.assignments) {
      await ctx.proposeAction({
        action_type: 'schedule_job',
        target_table: 'jobs',
        target_id: a.job_id,
        preview: `Assign job ${a.job_id} → crew ${a.crew_member_id} @ ${a.start_time}`,
        payload: a,
      });
    }

    return {
      summary: `Proposed ${plan.assignments.length} assignment(s). Unassigned: ${plan.unassigned.length}. Weather warnings: ${plan.weather_warnings.length}.`,
      output: plan,
    };
  },
};

async function fetchBrisbaneForecast(date: string): Promise<{ rain_probability: number; high_c: number; low_c: number }> {
  // Plug into BOM or OpenWeather here. Returning a stub keeps the agent runnable in dev.
  void date;
  return { rain_probability: 0.2, high_c: 26, low_c: 17 };
}
