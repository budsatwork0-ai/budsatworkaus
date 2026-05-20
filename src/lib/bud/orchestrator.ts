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
import { createIssue, createBranch, budBranchName } from './github-executor';

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

// ── Structured failure analysis ───────────────────────────────────────────────

export interface StructuredFailureReport {
  agentId: string;
  runId: string;
  errorType: string;
  message: string;
  stack: string;
  failedStep: string | null;
  inputSummary: string;
  outputSummary: string | null;
  recommendedFix: string;
}

function classifyFailure(
  errorMsg: string,
  logs: string[],
  status: string | null,
): { errorType: string; recommendedFix: string } {
  const lower = errorMsg.toLowerCase();
  const logsText = logs.join('\n').toLowerCase();

  if (lower.includes('json') || lower.includes('parse') || lower.includes('unexpected token') || lower.includes('syntaxerror')) {
    return {
      errorType: 'parse_error',
      recommendedFix:
        'Agent LLM output is not valid JSON. Update the system prompt to enforce strict JSON output and add a fallback parse path.',
    };
  }
  if (lower.includes('timeout') || lower.includes('exceeded') || lower.includes('timed out')) {
    return {
      errorType: 'timeout',
      recommendedFix:
        'Agent exceeded runtime limit. Reduce the number of LLM calls, parallelise data fetches, or increase AGENT_RUN_TIMEOUT_MS.',
    };
  }
  if (lower.includes('anthropic') || lower.includes('429') || lower.includes('529') || lower.includes('rate limit')) {
    return {
      errorType: 'llm_api_error',
      recommendedFix:
        'Anthropic API error. Check ANTHROPIC_API_KEY, rate-limit headroom, and that retry logic is wired up in the runtime.',
    };
  }
  if (logsText.includes('[bud:schema]') || lower.includes('zod') || lower.includes('schema')) {
    return {
      errorType: 'schema_validation_error',
      recommendedFix:
        'Agent output does not satisfy AgentOutputSchema. Ensure the run() return includes: status, summary, findings[], recommended_actions[], confidence, risk_level.',
    };
  }
  if (lower.includes('supabase') || lower.includes('postgres') || lower.includes('relation') || lower.includes('column')) {
    return {
      errorType: 'database_error',
      recommendedFix:
        'Database query failed. Verify table and column names match the current Supabase schema (check recent migrations).',
    };
  }
  if (lower.includes('config') || lower.includes('env') || lower.includes('undefined') || lower.includes('null')) {
    return {
      errorType: 'config_error',
      recommendedFix:
        'Agent accessed a missing config value or environment variable. Check the agent definition and env vars in Vercel.',
    };
  }
  if (status === 'needs_repair') {
    return {
      errorType: 'schema_validation_error',
      recommendedFix:
        'Agent output was flagged needs_repair by the runtime schema checker. Inspect the output field in agent_runs for the specific validation error.',
    };
  }
  return {
    errorType: 'runtime_error',
    recommendedFix:
      'Unknown runtime error. Inspect the full logs in agent_runs.output.logs and the error field for a stack trace.',
  };
}

function buildFailureReport(
  agentId: string,
  runId: string,
  run: {
    id: string;
    status: string | null;
    summary: string | null;
    output: Record<string, unknown> | null;
    error: string | null;
    started_at: string | null;
  } | null,
): StructuredFailureReport {
  const rawOutput = (run?.output ?? {}) as Record<string, unknown>;
  const logs = Array.isArray(rawOutput.logs) ? (rawOutput.logs as string[]) : [];
  const errorMsg = run?.error ?? run?.summary ?? 'No error message captured';
  const { errorType, recommendedFix } = classifyFailure(errorMsg, logs, run?.status ?? null);

  const diagnosticLines = logs
    .filter((l) => l.includes('Error') || l.includes('[bud:') || l.includes('failed') || l.includes('exception'))
    .slice(0, 10)
    .join('\n');

  return {
    agentId,
    runId,
    errorType,
    message: errorMsg.slice(0, 1000),
    stack: diagnosticLines,
    failedStep: logs.length > 0 ? logs[logs.length - 1].slice(0, 300) : null,
    inputSummary: `Run triggered at ${run?.started_at ?? 'unknown time'}`,
    outputSummary: run?.summary?.slice(0, 500) ?? null,
    recommendedFix,
  };
}

// ── Investigation flow ────────────────────────────────────────────────────────

export async function triggerInvestigation(
  supabase: SupabaseClient,
  runId: string,
  agentId: string,
  agentName: string,
): Promise<BudTask> {
  // Dedup: if an open task for this agent already exists in the last 24h, return it
  // rather than spawning another branch. This prevents the self-investigation loop
  // where each Bud cycle detects the prior failure and creates yet another repair branch.
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: existing } = await supabase
    .from('bud_tasks')
    .select('*')
    .eq('source_agent', agentId)
    .not('status', 'in', '("failed","archived")')
    .gte('created_at', since24h)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    await writeBudActivity(supabase,
      `Bud skipped duplicate investigation for ${agentName} — task already open (${existing.status}).`,
      { event_type: 'investigation', actor: 'bud', target: agentId, metadata: { existing_task_id: existing.id } },
    );
    return existing as BudTask;
  }

  await writeBudActivity(supabase,
    `Bud is investigating ${agentName} — fetching failure data...`,
    { event_type: 'investigation', actor: 'bud', target: agentId },
  );

  const { data: run } = await supabase
    .from('agent_runs')
    .select('id, status, summary, output, error, started_at, cost_cents, input_tokens, output_tokens')
    .eq('id', runId)
    .single();

  const report = buildFailureReport(agentId, runId, run as Parameters<typeof buildFailureReport>[2]);

  const task = await createBudTask(supabase, {
    description: `Investigate ${agentName} — ${report.errorType}: ${report.message.slice(0, 150)}`,
    source_agent: agentId,
    confidence: 0.5,
    risk_level: 'low',
    raw_input: { run_id: runId, agent_id: agentId },
    raw_output: { run: run ?? null, structured_failure: report },
  });

  await updateBudTask(supabase, task.id, { status: 'in_progress' });

  const level = getDefaultAutonomyLevel();
  // Level 2 = "Plan & Issue" → auto-create issues, no approval needed.
  // Level 3 = "Branch & PR"  → auto-create issues AND branches, no approval needed.
  // Only gate at level 0–1 where Bud is read-only or suggest-only.
  const needsApproval = level <= 1;

  if (needsApproval) {
    await queueApproval(supabase, {
      task_id: task.id,
      action_type: 'create_github_issue',
      payload: { ...report },
      requested_by: 'bud',
    });
    await updateBudTask(supabase, task.id, { status: 'awaiting_approval' });
    await writeBudActivity(supabase,
      `Bud awaiting approval to create GitHub issue for ${agentName} (${report.errorType}).`,
      { event_type: 'approval', actor: 'bud', target: agentId, metadata: { task_id: task.id, error_type: report.errorType } },
    );
  } else {
    // Level 2+: auto-create GitHub issue with structured failure data
    try {
      const issue = await createIssue(
        `[Bud] Agent failure: ${agentName} (${report.errorType})`,
        [
          `**Agent:** ${agentName} (\`${agentId}\`)`,
          `**Run ID:** \`${runId}\``,
          `**Error Type:** \`${report.errorType}\``,
          `**Status:** ${run?.status ?? 'failed'}`,
          `**Time:** ${run?.started_at ?? new Date().toISOString()}`,
          '',
          '## Error Message',
          '```',
          report.message,
          '```',
          '',
          '## Failed Step',
          report.failedStep
            ? `\`\`\`\n${report.failedStep}\n\`\`\``
            : '_No step trace available_',
          '',
          '## Diagnostic Logs',
          report.stack
            ? `\`\`\`\n${report.stack}\n\`\`\``
            : '_No diagnostic logs captured_',
          '',
          '## Recommended Fix',
          `> ${report.recommendedFix}`,
          '',
          `_Automatically diagnosed by Bud at autonomy level ${level}._`,
        ].join('\n'),
        ['bud', 'agent-failure', report.errorType],
      );
      await updateBudTask(supabase, task.id, {
        status: 'completed',
        linked_issue: issue.url,
      });
      await writeBudActivity(supabase,
        `Bud created GitHub issue #${issue.number} for ${agentName} (${report.errorType}). Fix: ${report.recommendedFix}`,
        { event_type: 'completion', actor: 'bud', target: agentId, metadata: { issue_url: issue.url, task_id: task.id, error_type: report.errorType } },
      );
    } catch (err) {
      await updateBudTask(supabase, task.id, { status: 'failed' });
      await writeBudActivity(supabase,
        `Bud could not create GitHub issue for ${agentName}: ${err instanceof Error ? err.message : 'unknown error'}`,
        { event_type: 'error', actor: 'bud', target: agentId, metadata: { structured_failure: report } },
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

  const level = getDefaultAutonomyLevel();
  const confidence = task.confidence ?? 0.5;
  const risk_level = task.risk_level ?? 'low';

  if (level >= 3 && ['low', 'medium'].includes(risk_level)) {
    const branchName = budBranchName(task.source_agent ?? 'unknown');
    try {
      await updateBudTask(supabase, taskId, { status: 'in_progress' });

      // Actually create the branch on GitHub
      await createBranch(branchName);

      const repoOwner = process.env.GITHUB_REPO_OWNER ?? '';
      const repoName  = process.env.GITHUB_REPO_NAME ?? '';
      const branchUrl = `https://github.com/${repoOwner}/${repoName}/tree/${branchName}`;

      // Pull the structured failure — present in investigation tasks (structured_failure key)
      // and absent in parse-failure tasks (which use { error, raw }). Fall back to the
      // task description which always has a human-readable summary.
      const rawOut = (task.raw_output ?? {}) as Record<string, unknown>;
      const sf = rawOut.structured_failure as { recommendedFix?: string; errorType?: string } | undefined;
      const recommendedFix = sf?.recommendedFix ?? task.description ?? 'Inspect the task raw_output for details.';
      const errorType      = sf?.errorType ?? 'unknown';

      // Open a GitHub issue scoped to this branch so the fix is actionable
      const issue = await createIssue(
        `[Bud] Repair branch ready: ${task.source_agent ?? 'agent'} (${errorType})`,
        [
          `Bud created branch \`${branchName}\` to address a failure in **${task.source_agent ?? 'agent'}**.`,
          '',
          '## Recommended Fix',
          `> ${recommendedFix}`,
          '',
          `## Branch`,
          `[${branchName}](${branchUrl})`,
          '',
          `_Autonomy level ${level}. Apply the fix to this branch and open a PR when ready._`,
        ].join('\n'),
        ['bud', 'repair-branch', errorType],
      );

      // Record the change request with real URLs
      const { data: cr } = await supabase
        .from('bud_change_requests')
        .insert({
          task_id:   taskId,
          branch_name: branchName,
          issue_url: issue.url,
          status:    'open',
        })
        .select()
        .single();

      await updateBudTask(supabase, taskId, {
        status:       'completed',
        linked_issue: issue.url,
      });

      await writeBudActivity(supabase,
        `Bud created repair branch \`${branchName}\` and opened issue #${issue.number} for ${task.source_agent ?? 'agent'}. Apply the fix and open a PR.`,
        { event_type: 'repair', actor: 'bud', target: task.source_agent ?? undefined, metadata: { branch: branchName, branch_url: branchUrl, issue_url: issue.url, change_request_id: cr?.id } },
      );
    } catch (err) {
      await updateBudTask(supabase, taskId, { status: 'failed' });
      await writeBudActivity(supabase,
        `Bud could not execute repair for ${task.source_agent ?? 'agent'}: ${err instanceof Error ? err.message : 'unknown'}`,
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
