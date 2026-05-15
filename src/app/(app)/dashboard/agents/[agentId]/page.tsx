/**
 * /dashboard/agents/[agentId] — per-agent detail page.
 *
 * Shows the agent's definition, 30-day performance, recent runs (with
 * full input/output/error), proposed actions, and a Run now control.
 */
import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { AgentDetailClient } from './_components/AgentDetailClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function load(agentId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const since30d = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

  const [agentRes, runsRes, actionsRes, statsRes] = await Promise.all([
    supabase.from('agents').select('*').eq('id', agentId).maybeSingle(),
    supabase
      .from('agent_runs')
      .select('id, status, trigger, summary, error, input, output, model, input_tokens, output_tokens, cost_cents, duration_ms, started_at, finished_at, triggered_by')
      .eq('agent_id', agentId)
      .order('started_at', { ascending: false })
      .limit(50),
    supabase
      .from('agent_actions')
      .select('id, run_id, action_type, status, preview, payload, requires_approval, created_at, reviewed_at, executed_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('agent_runs')
      .select('status, cost_cents, duration_ms, started_at')
      .eq('agent_id', agentId)
      .gte('started_at', since30d),
  ]);

  if (!agentRes.data) return null;

  return {
    agent: agentRes.data,
    runs: runsRes.data ?? [],
    actions: actionsRes.data ?? [],
    statsRaw: statsRes.data ?? [],
  };
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const data = await load(agentId);
  if (!data) notFound();
  return <AgentDetailClient initial={data} />;
}
