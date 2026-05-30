/**
 * Job Scheduling agent — assigns crew to confirmed jobs.
 *
 * Live-schema model (matches the admin DayScheduler):
 *   • A job is an `orders` row. "Needs scheduling" = status='confirmed' AND
 *     assigned_crew_id IS NULL.
 *   • Crew are `employees` with status='active'.
 *   • Assigning sets orders.assigned_crew_id + scheduled_date/time + status='scheduled'
 *     (done in the schedule_job effect handler on approval).
 *
 * The model proposes assignments based on service/skill match, suburb proximity
 * (Logan & South Brisbane), and weather; yard/window work reschedules if rain
 * probability >= 60%.
 */
import type { AgentDefinition, AgentContext } from '../types';

const SYSTEM = `You are the Scheduling agent for Buds At Work. You assign
confirmed jobs to crew based on skill match, suburb proximity (Logan & South
Brisbane), and weather. Yard and window work should be rescheduled if rain
probability >= 0.60.
Output strict JSON only:
{
  "assignments": [
    {
      "order_id": "...",
      "crew_id": "...",
      "scheduled_date": "YYYY-MM-DD",
      "scheduled_time": "9:00 AM – 11:00 AM",
      "rationale": "..."
    }
  ],
  "weather_warnings": ["..."],
  "unassigned": ["order_id", ...]
}`;

interface OrderRow {
  id: string;
  service_type: string | null;
  notes: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_duration_minutes: number | null;
  customer_name: string | null;
}
interface CrewRow {
  id: string;
  full_name: string | null;
  services: string[] | null;
  suburb: string | null;
  availability: string[] | null;
}

/** Address is prepended to orders.notes as "Address: ..." at quote submission. */
function addressFromNotes(notes: string | null): string | null {
  const m = notes?.match(/^Address:\s*(.+)/m);
  return m?.[1]?.trim() ?? null;
}

export const schedulingAgent: AgentDefinition = {
  id: 'scheduling',
  name: 'Job Scheduling',
  description: 'Assigns confirmed jobs to available crew and proposes a run sheet.',
  category: 'ops',
  autonomy: 'review',
  preferredModel: 'claude-haiku-4-5-20251001',
  async run(ctx: AgentContext) {
    const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);

    // Confirmed jobs that have no crew yet (DayScheduler's "unassigned" state).
    const { data: orders } = await ctx.supabase
      .from('orders')
      .select('id, service_type, notes, scheduled_date, scheduled_time, estimated_duration_minutes, customer_name')
      .eq('status', 'confirmed')
      .is('assigned_crew_id', null)
      .limit(15);

    const { data: crew } = await ctx.supabase
      .from('employees')
      .select('id, full_name, services, suburb, availability')
      .eq('status', 'active');

    if (!orders?.length) return { summary: 'No confirmed jobs awaiting crew assignment.' };
    if (!crew?.length) return { summary: 'No active crew available — flagging.' };

    const weather = await fetchBrisbaneForecast(tomorrow);

    const jobsForPrompt = (orders as OrderRow[]).map((o) => ({
      order_id: o.id,
      service: o.service_type,
      address: addressFromNotes(o.notes),
      scheduled_date: o.scheduled_date,
      duration_minutes: o.estimated_duration_minutes,
      customer: o.customer_name,
    }));
    const crewForPrompt = (crew as CrewRow[]).map((c) => ({
      crew_id: c.id,
      name: c.full_name,
      services: c.services ?? [],
      suburb: c.suburb,
      availability: c.availability ?? [],
    }));

    const prompt = `Target date (default if a job has no date): ${tomorrow}
Weather: ${JSON.stringify(weather)}
Jobs (${jobsForPrompt.length}):
${JSON.stringify(jobsForPrompt, null, 2)}
Crew (${crewForPrompt.length}):
${JSON.stringify(crewForPrompt, null, 2)}
Produce assignments JSON.`;
    const raw = await ctx.llm(prompt, { system: SYSTEM });

    let plan: {
      assignments: Array<{ order_id: string; crew_id: string; scheduled_date: string; scheduled_time: string; rationale: string }>;
      weather_warnings: string[];
      unassigned: string[];
    };
    try {
      plan = JSON.parse(raw);
    } catch {
      ctx.log('failed to parse scheduling output');
      return { summary: 'Scheduling model returned unparseable output — no assignments proposed.' };
    }

    const validOrderIds = new Set((orders as OrderRow[]).map((o) => o.id));
    const validCrewIds = new Set((crew as CrewRow[]).map((c) => c.id));

    let proposed = 0;
    for (const a of plan.assignments ?? []) {
      // Guard against hallucinated ids before proposing a production write.
      if (!validOrderIds.has(a.order_id) || !validCrewIds.has(a.crew_id)) {
        ctx.log('skipped assignment with unknown id', { order_id: a.order_id, crew_id: a.crew_id });
        continue;
      }
      await ctx.proposeAction({
        action_type: 'schedule_job',
        target_table: 'orders',
        target_id: a.order_id,
        preview: `Assign order ${a.order_id.slice(0, 8)} → crew ${a.crew_id.slice(0, 8)} on ${a.scheduled_date} ${a.scheduled_time}`,
        payload: {
          order_id: a.order_id,
          crew_id: a.crew_id,
          scheduled_date: a.scheduled_date,
          scheduled_time: a.scheduled_time,
          rationale: a.rationale,
        },
      });
      proposed += 1;
    }

    return {
      summary: `Proposed ${proposed} assignment(s). Unassigned: ${(plan.unassigned ?? []).length}. Weather warnings: ${(plan.weather_warnings ?? []).length}.`,
      output: plan,
    };
  },
};

/**
 * Real Brisbane-metro daily forecast via Open-Meteo (keyless, free).
 * `rain_probability` is a 0–1 fraction (>= 0.60 reschedules yard/window work).
 * Falls back to a conservative dry-day estimate if the API is unreachable.
 */
async function fetchBrisbaneForecast(
  date: string,
): Promise<{ rain_probability: number; high_c: number; low_c: number; source: string }> {
  const lat = -27.47;
  const lon = 153.03;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min` +
    `&timezone=Australia%2FBrisbane&start_date=${date}&end_date=${date}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const json = (await res.json()) as {
      daily?: {
        precipitation_probability_max?: (number | null)[];
        temperature_2m_max?: (number | null)[];
        temperature_2m_min?: (number | null)[];
      };
    };
    const pop = json.daily?.precipitation_probability_max?.[0];
    const high = json.daily?.temperature_2m_max?.[0];
    const low = json.daily?.temperature_2m_min?.[0];
    if (pop == null || high == null || low == null) throw new Error('open-meteo: missing daily fields');
    return {
      rain_probability: Math.max(0, Math.min(1, pop / 100)),
      high_c: Math.round(high),
      low_c: Math.round(low),
      source: 'open-meteo',
    };
  } catch {
    return { rain_probability: 0.2, high_c: 26, low_c: 17, source: 'fallback-estimate' };
  }
}
