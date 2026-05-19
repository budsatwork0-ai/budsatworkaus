import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { classifyBudCommand } from '@/lib/bud/command';
import { createBudTask, queueApproval, writeBudActivity } from '@/lib/bud/orchestrator';
import type { BudCommandIntent } from '@/lib/bud/command';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

type BudIntelligenceResponse = {
  message: string;
  plan: string[];
  bud_state: string;
};

async function callBudIntelligence(
  command: string,
  intent: BudCommandIntent,
  ctx: { agents: number; failed: number; approvals: number; tasks: number },
): Promise<BudIntelligenceResponse | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const intentLabel: Record<BudCommandIntent, string> = {
    investigate: 'Investigate a problem',
    fix: 'Fix or repair something',
    improve: 'Improve or redesign something',
    schedule: 'Manage scheduling or jobs',
    quote: 'Review quotes or pricing',
    review: 'Audit or review something',
    deploy: 'Deploy or release changes',
    general: 'General operating request',
  };

  const systemPrompt = `You are Bud, the AI operating system for Buds At Work. You speak directly to the admin in first person, present tense. You are precise, confident, and useful. Never say "I will" — say what you're doing right now. Return only valid JSON.`;

  const userPrompt = `Admin command: "${command}"
Detected intent: ${intentLabel[intent]}
System: ${ctx.agents} active agents, ${ctx.failed} failed runs in last 24h, ${ctx.approvals} pending approvals, ${ctx.tasks} open tasks.

Respond as Bud. Write 2 sentences maximum for message. Be specific about what you're doing and why. Do not be vague.
Return JSON only, no markdown:
{ "message": string, "plan": ["step 1", "step 2", "step 3"], "bud_state": "thinking"|"investigating"|"planning"|"repairing"|"waiting_for_approval" }`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { content?: Array<{ text: string }> };
    const text = body.content?.[0]?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as BudIntelligenceResponse;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { command?: string };
  const command = body.command?.trim();
  if (!command) {
    return NextResponse.json({ error: 'command required' }, { status: 400 });
  }

  const classified = classifyBudCommand(command);
  const supabase = adminClient();

  try {
    const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
    const [taskRes, approvalRes, failedRunRes, activeAgentRes] = await Promise.all([
      supabase.from('bud_tasks').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_progress', 'awaiting_approval']),
      supabase.from('bud_approval_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('agent_runs').select('id', { count: 'exact', head: true }).gte('started_at', since24h).eq('status', 'failed'),
      supabase.from('agents').select('id', { count: 'exact', head: true }).eq('status', 'enabled'),
    ]);

    const [task, budResponse] = await Promise.all([
      createBudTask(supabase, {
        description: classified.description,
        source_agent: 'bud',
        target_agent: classified.intent === 'improve' ? 'admin-ux-designer' : undefined,
        confidence: 0.62,
        risk_level: classified.risk_level,
        autonomy_level: classified.autonomy_level,
        raw_input: { command, intent: classified.intent },
      }),
      callBudIntelligence(command, classified.intent, {
        agents: activeAgentRes.count ?? 0,
        failed: failedRunRes.count ?? 0,
        approvals: approvalRes.count ?? 0,
        tasks: taskRes.count ?? 0,
      }),
    ]);

    let approvalId: string | null = null;
    if (classified.needs_approval) {
      approvalId = await queueApproval(supabase, {
        task_id: task.id,
        action_type: classified.action_type,
        payload: {
          command,
          intent: classified.intent,
          capability_note: 'Bud will draft and recommend. PR creation, deployment, and self-redesign remain gated.',
        },
        requested_by: user.id,
      });
      await supabase
        .from('bud_tasks')
        .update({ status: 'awaiting_approval', updated_at: new Date().toISOString() })
        .eq('id', task.id);
    }

    await writeBudActivity(supabase, budResponse?.message ?? `Bud accepted command: ${command}`, {
      event_type: classified.intent === 'deploy' ? 'deployment' : classified.intent === 'fix' ? 'repair' : 'delegation',
      actor: 'bud',
      target: classified.intent,
      metadata: { task_id: task.id, approval_id: approvalId, command },
    });

    return NextResponse.json({
      ok: true,
      task_id: task.id,
      intent: classified.intent,
      approval_id: approvalId,
      status: approvalId ? 'awaiting_approval' : 'pending',
      bud_response: budResponse,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
