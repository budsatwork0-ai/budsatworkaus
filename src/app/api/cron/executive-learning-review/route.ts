/**
 * GET /api/cron/executive-learning-review
 *
 * Vercel Cron — weekly learning review (Mondays at 07:00 AEST).
 * Synthesises the past week's executive decisions, task completions,
 * and agent run outcomes into a structured weekly review doc.
 *
 * Uses raw fetch against the Anthropic API (same pattern as runtime.ts).
 * Uses an untyped Supabase client for the new executive tables (not yet
 * in the generated database types).
 *
 * Secured by CRON_SECRET env var.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM = `You are the Chief of Staff at Buds At Work producing a weekly review.
Synthesise executive decisions and outcomes from the past week into a structured review.

Return strict JSON:
{
  "summary": string,
  "wins": [{ "title": string, "detail": string }],
  "risks": [{ "title": string, "detail": string, "severity": "low" | "medium" | "high" }],
  "priorities": [{ "title": string, "owner": string, "due": string }],
  "agent_learnings": [{ "agent_id": string, "insight": string }]
}

Rules:
- "summary": 2–3 sentences. What was the week's story?
- "wins": up to 4. Only real, data-backed wins.
- "risks": up to 4. Flag anything that needs attention next week.
- "priorities": up to 4. What must happen next week?
- "agent_learnings": up to 5. One concrete insight per agent that made decisions.
- Be terse. No filler.`;

// Untyped client — used for executive tables not yet in generated DB types.
function createUntypedClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function callAnthropicLlm(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${body}`);
  }

  const json = await res.json() as { content: Array<{ type: string; text: string }> };
  const text = json.content?.find((c) => c.type === 'text')?.text ?? '';
  return text;
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Untyped client for executive tables
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createUntypedClient() as any;

  const since7d = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const weekStartDate = new Date(Date.now() - 7 * 24 * 3600_000);
  weekStartDate.setHours(0, 0, 0, 0);
  const weekStart = weekStartDate.toISOString().slice(0, 10);

  // Idempotency — skip if already generated for this week
  const { data: existing } = await supabase
    .from('executive_weekly_reviews')
    .select('id')
    .eq('week_start', weekStart)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      message: 'Weekly review already generated for this week.',
      week_start: weekStart,
    });
  }

  try {
    const [decisionsRes, tasksRes, runsMetaRes] = await Promise.all([
      supabase
        .from('executive_decisions')
        .select('id, agent_id, title, reasoning, risk_level, status, expected_impact, created_at')
        .gte('created_at', since7d)
        .order('created_at', { ascending: false }),
      supabase
        .from('executive_tasks')
        .select('id, source_agent_id, target_agent_id, title, status, priority, created_at')
        .gte('created_at', since7d)
        .order('created_at', { ascending: false }),
      supabase
        .from('executive_agent_runs_meta')
        .select('agent_id, decisions, tasks, auto_executed, queued_approvals')
        .gte('created_at', since7d),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decisions: any[] = decisionsRes.data ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tasks: any[]     = tasksRes.data ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runsMeta: any[]  = runsMetaRes.data ?? [];

    // Aggregate run stats per exec agent
    const agentStats: Record<string, { decisions: number; tasks: number; auto: number }> = {};
    for (const r of runsMeta) {
      const aid: string = r.agent_id;
      if (!agentStats[aid]) agentStats[aid] = { decisions: 0, tasks: 0, auto: 0 };
      agentStats[aid].decisions += (r.decisions as number) ?? 0;
      agentStats[aid].tasks     += (r.tasks as number) ?? 0;
      agentStats[aid].auto      += (r.auto_executed as number) ?? 0;
    }

    const decisionSummary = decisions.slice(0, 20).map((d) =>
      `[${d.agent_id}] ${d.title} (${d.risk_level}, ${d.status})`,
    ).join('\n');

    const taskSummary = tasks.slice(0, 20).map((t) =>
      `[${t.source_agent_id} → ${t.target_agent_id ?? 'human'}] ${t.title} (${t.status})`,
    ).join('\n');

    const statsSummary = Object.entries(agentStats).map(([aid, s]) =>
      `${aid}: ${s.decisions} decisions, ${s.auto} auto-executed, ${s.tasks} tasks`,
    ).join('\n');

    const prompt = `Week starting ${weekStart}:

Executive decisions (${decisions.length} total):
${decisionSummary || 'None'}

Tasks routed (${tasks.length} total):
${taskSummary || 'None'}

Agent run stats:
${statsSummary || 'None'}`;

    const rawText = await callAnthropicLlm(prompt);

    const parsed = JSON.parse(rawText) as {
      summary: string;
      wins:            Array<{ title: string; detail: string }>;
      risks:           Array<{ title: string; detail: string; severity: string }>;
      priorities:      Array<{ title: string; owner: string; due: string }>;
      agent_learnings: Array<{ agent_id: string; insight: string }>;
    };

    await supabase.from('executive_weekly_reviews').insert({
      week_start:      weekStart,
      summary:         parsed.summary,
      wins:            parsed.wins ?? [],
      risks:           parsed.risks ?? [],
      priorities:      parsed.priorities ?? [],
      agent_learnings: parsed.agent_learnings ?? [],
    });

    return NextResponse.json({
      status: 'ok',
      week_start:         weekStart,
      decisions_reviewed: decisions.length,
      tasks_reviewed:     tasks.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
