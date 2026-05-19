/**
 * Bud Orchestrator
 *
 * Core coordination logic for Bud's autonomous operating system.
 * Handles task creation, activity feed, investigation flows, and repair chains.
 *
 * Node.js only — all functions receive a Supabase admin client.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BudTask, BudActivityEvent, BudActivityEventType, AutonomyLevel } from './types';
import { getDefaultAutonomyLevel, requiresApproval } from './autonomy';
import { createIssue, budBranchName } from './github-executor';

// ── Activity feed ─────────────────────────────────────────────────────────────

export async function writeBudActivity(
  supabase: SupabaseClient,
  narrative: string,
  opts: {
    event_type?: BudActivityEventType;
    actor?: string;
    target?: string;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  await supabase.from('bud_activity_feed').insert({
    event_type: opts.event_type ?? 'delegation',
    narrative,
    actor: opts.actor ?? 'bud',
    target: opts.target ?? null,
    metadata: opts.metadata ?? {},
  });
}

// ── Task management ───────────────────────────────────────────────────────────

export async function createBudTask(
  supabase: SupabaseClient,
  params: {
    description: string;
    source_agent?: string;
    target_agent?: string;
    confidence?: number;
    risk_level?: BudTask['risk_level'];
    autonomy_level?: AutonomyLevel;
    raw_input?: Record<string, unknown>;
    raw_output?: Record<string, unknown>;
  },
): Promise<BudTask> {
  const { data, error } = await supabase
    .from('bud_tasks')
    .insert({
      description: params.description,
      source_agent: params.source_agent ?? null,
      target_agent: params.target_agent ?? null,
      confidence: params.confidence ?? null,
      risk_level: params.risk_level ?? 'low',
      autonomy_level: params.autonomy_level ?? getDefaultAutonomyLevel(),
      raw_input: params.raw_input ?? null,
      raw_output: params.raw_output ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create bud_task: ${error.message}`);
  return data as BudTask;
}

export async function updateBudTask(
  supabase: SupabaseClient,
  taskId: string,
  updates: Partial<Pick<BudTask, 'status' | 'linked_issue' | 'linked_pr' | 'linked_deployment' | 'linked_memory_note' | 'confidence' | 'risk_level'>>,
): Promise<void> {
  await supabase
    .from('bud_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', taskId);
}

// ── Approval queue ────────────────────────────────────────────────────────────

export async function queueApproval(
  supabase: SupabaseClient,
  params: {
    task_id: string;
    action_type: string;
    payload: Record<string, unknown>;
    requested_by?: string;
  },
): Promise<string> {
  const { data, error } = await supabase
    .from('bud_approval_queue')
    .insert({
      task_id: params.task_id,
      action_type: params.action_type,
      payload: params.payload,
      status: 'pending',
      requested_by: params.requested_by ?? 'bud',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to queue approval: ${error.message}`);
  return data.id as string;
}

// ── Investigation flow ────────────────────────────────────────────────────────

export async function triggerInvestigation(
  supabase: SupabaseClient,
  runId: string,
  agentId: string,
  agentName: string,
): Promise<BudTask> {
  await writeBudActivity(supabase,
    `Bud is investigating ${agentName} failure...`,
    { event_type: 'investigation', actor: 'bud', target: agentId },
  );

  const { data: run } = await supabase
    .from('agent_runs')
    .select('id, status, summary, output, error, started_at, cost_cents')
    .eq('id', runId)
    .single();

  const task = await createBudTask(supabase, {
    description: `Investigate ${agentName} failure — run ${runId}`,
    source_agent: agentId,
    confidence: 0.5,
    risk_level: 'low',
    raw_input: { run_id: runId, agent_id: agentId },
    raw_output: run ? { run } : undefined,
  });

  await updateBudTask(supabase, task.id, { status: 'in_progress' });

  const level = getDefaultAutonomyLevel();
  const needsApproval = requiresApproval(level, 0.5, 'low', 'create_github_issue');

  if (needsApproval) {
    await queueApproval(supabase, {
      task_id: task.id,
      action_type: 'create_github_issue',
      payload: {
        agent_id: agentId,
        agent_name: agentName,
        run_id: runId,
        summary: run?.summary ?? '(no summary)',
      },
      requested_by: 'bud',
    });
    await updateBudTask(supabase, task.id, { status: 'awaiting_approval' });
    await writeBudActivity(supabase,
      `Bud is awaiting approval before creating GitHub issue for ${agentName}.`,
      { event_type: 'approval', actor: 'bud', target: agentId, metadata: { task_id: task.id } },
    );
  } else {
    // Level 2+: auto-create GitHub issue
    try {
      const issue = await createIssue(
        `[Bud] Agent failure: ${agentName}`,
        [
          `**Agent:** ${agentName} (\`${agentId}\`)`,
          `**Run ID:** ${runId}`,
          `**Status:** ${run?.status ?? 'failed'}`,
          `**Time:** ${run?.started_at ?? new Date().toISOString()}`,
          '',
          '## Error Output',
          '```',
          run?.summary ?? '(no summary captured)',
          '```',
          '',
          `> Automatically generated by Bud at autonomy level ${level}.`,
        ].join('\n'),
        ['bud', 'agent-failure'],
      );
      await updateBudTask(supabase, task.id, {
        status: 'completed',
        linked_issue: issue.url,
      });
      await writeBudActivity(supabase,
        `Bud created GitHub issue #${issue.number} for ${agentName} failure.`,
        { event_type: 'completion', actor: 'bud', target: agentId, metadata: { issue_url: issue.url, task_id: task.id } },
      );
    } catch (err) {
      await updateBudTask(supabase, task.id, { status: 'failed' });
      await writeBudActivity(supabase,
        `Bud could not create GitHub issue for ${agentName}: ${err instanceof Error ? err.message : 'unknown error'}`,
        { event_type: 'error', actor: 'bud', target: agentId },
      );
    }
  }

  return task;
}

// ── Repair plan execution ─────────────────────────────────────────────────────

export async function executeRepairPlan(
  supabase: SupabaseClient,
  taskId: string,
  approved: boolean,
): Promise<void> {
  const { data: task } = await supabase
    .from('bud_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (!task) throw new Error(`Bud task ${taskId} not found`);

  if (!approved) {
    await updateBudTask(supabase, taskId, { status: 'failed' });
    await writeBudActivity(supabase,
      `Bud repair plan for ${task.source_agent ?? 'unknown agent'} was rejected.`,
      { event_type: 'completion', actor: 'bud', target: task.source_agent ?? undefined },
    );
    return;
  }

  const level = (task.autonomy_level ?? 2) as AutonomyLevel;
  const confidence = task.confidence ?? 0.5;
  const risk_level = task.risk_level ?? 'low';

  if (level >= 3 && confidence >= 0.8 && ['low', 'medium'].includes(risk_level)) {
    // Create repair branch
    const branchName = budBranchName(task.source_agent ?? 'unknown');
    try {
      // Record change request
      const { data: cr } = await supabase
        .from('bud_change_requests')
        .insert({
          task_id: taskId,
          branch_name: branchName,
          status: 'open',
        })
        .select()
        .single();

      await updateBudTask(supabase, taskId, { status: 'in_progress' });
      await writeBudActivity(supabase,
        `Bud prepared repair branch \`${branchName}\` for ${task.source_agent ?? 'agent'}.`,
        { event_type: 'repair', actor: 'bud', target: task.source_agent ?? undefined, metadata: { branch: branchName, change_request_id: cr?.id } },
      );

      await updateBudTask(supabase, taskId, { status: 'completed' });
      await writeBudActivity(supabase,
        `Bud completed repair plan for ${task.source_agent ?? 'agent'}.`,
        { event_type: 'completion', actor: 'bud', target: task.source_agent ?? undefined },
      );
    } catch (err) {
      await updateBudTask(supabase, taskId, { status: 'failed' });
      await writeBudActivity(supabase,
        `Bud could not create repair branch: ${err instanceof Error ? err.message : 'unknown'}`,
        { event_type: 'error', actor: 'bud' },
      );
    }
  } else {
    // Just mark complete with documentation
    await updateBudTask(supabase, taskId, { status: 'completed' });
    await writeBudActivity(supabase,
      `Bud documented repair plan for ${task.source_agent ?? 'agent'} (autonomy level ${level} — branch creation requires level 3+).`,
      { event_type: 'completion', actor: 'bud', target: task.source_agent ?? undefined },
    );
  }
}

// ── Parse failure handler ─────────────────────────────────────────────────────

export async function handleParseFailure(
  supabase: SupabaseClient,
  agentId: string,
  agentName: string,
  runId: string,
  errorMessage: string,
  rawOutput: unknown,
): Promise<void> {
  await writeBudActivity(supabase,
    `Bud detected malformed output from ${agentName}. Repair task created.`,
    { event_type: 'detection', actor: 'bud', target: agentId, metadata: { run_id: runId } },
  );

  const task = await createBudTask(supabase, {
    description: `Parse failure in ${agentName}: ${errorMessage.slice(0, 200)}`,
    source_agent: agentId,
    confidence: 0,
    risk_level: 'low',
    raw_input: { run_id: runId, agent_id: agentId },
    raw_output: { error: errorMessage, raw: rawOutput },
  });

  // Write a bud_insight for persistent tracking
  await supabase.from('bud_insights').insert({
    agent_id: agentId,
    category: 'anomaly',
    severity: 'warning',
    title: `Output parse failure: ${agentName}`,
    body: `Run ${runId} produced output that failed Zod validation.\n\nError: ${errorMessage}`,
    metadata: { task_id: task.id, run_id: runId },
  });
}
