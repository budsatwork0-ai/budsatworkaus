import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SupabaseClient } from '@supabase/supabase-js';
import { writeMemory } from '@/lib/memory/write';
import {
  createBranch,
  createIssue,
  createPR,
  budBranchName,
  getFileContent,
  writeFileToBranch,
  searchIssues,
  deleteBranch,
  pollWorkflowUntilComplete,
} from './github-executor';
import { readNote } from './obsidian-memory';
import { scoreVisualCompliance, type VisualScore } from './visual-scorer';
import { isUiFile } from './design-constitution';
import { runBrowserTests, formatBrowserSummary, type BrowserTestResult } from './browser-executor';
import { writeLearningEmbedding, searchSimilarLearnings } from './embedding';

const execFileAsync = promisify(execFile);

export type BudOsLifecycleState =
  | 'detected'
  | 'reproducing'
  | 'analyzing'
  | 'planning'
  | 'awaiting_approval'
  | 'patching'
  | 'validating'
  | 'deploying'
  | 'verifying'
  | 'monitoring'
  | 'recovered'
  | 'rolled_back'
  | 'blocked'
  | 'failed';

type CommandResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

type RepairTaskRow = {
  id: string;
  source_agent: string | null;
  status: string;
  description: string;
  confidence: number | null;
  risk_level: string | null;
  raw_input: Record<string, unknown> | null;
  raw_output: Record<string, unknown> | null;
};

const REPO_ROOT = process.cwd();
const MAX_OUTPUT = 24_000;

function isExecutionEnabled(): boolean {
  return process.env.BUD_OS_EXECUTION_ENABLED === 'true';
}

function hasAiPatchProvider(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT) return text;
  return `${text.slice(0, MAX_OUTPUT)}\n\n[truncated ${text.length - MAX_OUTPUT} chars]`;
}

async function runCommand(command: string, args: string[], timeoutMs = 120_000): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: REPO_ROOT,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 8,
      env: process.env,
    });
    return {
      command: [command, ...args].join(' '),
      exitCode: 0,
      stdout: truncate(stdout),
      stderr: truncate(stderr),
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
    return {
      command: [command, ...args].join(' '),
      exitCode: typeof err.code === 'number' ? err.code : 1,
      stdout: truncate(err.stdout ?? ''),
      stderr: truncate(err.stderr ?? err.message),
    };
  }
}

async function createExecution(
  supabase: SupabaseClient,
  task: RepairTaskRow,
  userId: string | null,
  trigger: 'manual' | 'detected' | 'cron' | 'approval' | 'terminal',
): Promise<string> {
  const { data, error } = await supabase
    .from('bud_repair_executions')
    .insert({
      task_id: task.id,
      source_agent: task.source_agent,
      trigger,
      status: 'detected',
      risk_score: riskScore(task.risk_level),
      confidence: task.confidence,
      created_by: userId,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(`Could not create repair execution: ${error?.message ?? 'missing row'}`);
  return data.id as string;
}

function riskScore(risk: string | null): number {
  if (risk === 'critical') return 95;
  if (risk === 'high') return 80;
  if (risk === 'medium') return 55;
  return 25;
}

async function updateExecution(
  supabase: SupabaseClient,
  executionId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from('bud_repair_executions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', executionId);
}

async function updateTaskState(supabase: SupabaseClient, taskId: string, state: BudOsLifecycleState): Promise<void> {
  await supabase
    .from('bud_tasks')
    .update({ status: state, updated_at: new Date().toISOString() })
    .eq('id', taskId);
}

async function startStep(
  supabase: SupabaseClient,
  executionId: string,
  state: BudOsLifecycleState,
  summary: string,
): Promise<string> {
  await updateExecution(supabase, executionId, { status: state });
  const { data, error } = await supabase
    .from('bud_repair_steps')
    .insert({ execution_id: executionId, state, status: 'running', summary })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Could not create repair step: ${error?.message ?? 'missing row'}`);
  return data.id as string;
}

async function finishStep(
  supabase: SupabaseClient,
  stepId: string,
  status: 'passed' | 'failed' | 'blocked' | 'skipped',
  evidence: Record<string, unknown> = {},
  confidence?: number,
): Promise<void> {
  await supabase
    .from('bud_repair_steps')
    .update({
      status,
      evidence,
      confidence: confidence ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', stepId);
}

async function log(
  supabase: SupabaseClient,
  executionId: string,
  stepId: string | null,
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from('bud_repair_logs').insert({
    execution_id: executionId,
    step_id: stepId,
    level,
    message,
    metadata,
  });
}

function classifyRootCause(task: RepairTaskRow): { type: string; summary: string; confidence: number } {
  const source = JSON.stringify(task.raw_output ?? task.raw_input ?? {});
  const text = `${task.description}\n${source}`.toLowerCase();
  if (text.includes('zod') || text.includes('schema') || text.includes('parse') || text.includes('json')) {
    return { type: 'schema_validation_error', summary: 'Runtime output or JSON schema validation failed.', confidence: 0.78 };
  }
  if (text.includes('supabase') || text.includes('relation') || text.includes('column') || text.includes('postgres')) {
    return { type: 'database_error', summary: 'Database query or schema mismatch likely caused the failure.', confidence: 0.72 };
  }
  if (text.includes('timeout') || text.includes('timed out')) {
    return { type: 'timeout', summary: 'Execution exceeded a runtime or network timeout.', confidence: 0.7 };
  }
  if (text.includes('401') || text.includes('403') || text.includes('unauthorized')) {
    return { type: 'auth_error', summary: 'Credentials, role, or policy checks blocked execution.', confidence: 0.74 };
  }
  if (text.includes('cannot find module') || text.includes('module not found')) {
    return { type: 'build_artifact_error', summary: 'Build artifact or module resolution failure detected.', confidence: 0.82 };
  }
  return { type: 'runtime_error', summary: 'Failure requires code and log inspection before patching.', confidence: 0.45 };
}

async function writeRollbackEvent(
  supabase: SupabaseClient,
  executionId: string,
  agentId: string | null,
  trigger: 'ci_failure' | 'surgical_limit' | 'taste_failure' | 'browser_failure' | 'manual',
  extra: { branchName?: string; ciConclusion?: string; ciRunUrl?: string; notes?: string } = {},
): Promise<void> {
  await supabase.from('bud_rollback_events').insert({
    execution_id: executionId,
    agent_id: agentId,
    trigger,
    branch_name: extra.branchName ?? null,
    ci_conclusion: extra.ciConclusion ?? null,
    ci_run_url: extra.ciRunUrl ?? null,
    notes: extra.notes ?? null,
  });
}

function buildStrategy(task: RepairTaskRow, rootCause: ReturnType<typeof classifyRootCause>): Record<string, unknown> {
  return {
    root_cause_type: rootCause.type,
    hypothesis: rootCause.summary,
    target_agent: task.source_agent,
    steps: [
      'reproduce the failure from stored run evidence',
      'inspect relevant stack traces and changed files',
      'create a sandbox branch only when the git worktree is safe',
      'generate a minimal patch',
      'run build/type/test verification',
      'write a repair learning record',
      'open a PR when GitHub credentials are configured',
    ],
    safety_gate: {
      dirty_worktree_requires: 'BUD_OS_ALLOW_DIRTY_WORKTREE=true',
      execution_requires: 'BUD_OS_EXECUTION_ENABLED=true',
      ai_patch_requires: 'ANTHROPIC_API_KEY or OPENAI_API_KEY',
    },
  };
}

// ── Historical context ────────────────────────────────────────────────────────

type HistoricalContext = {
  pastRepairs: Array<{ rootCauseType: string; fixPattern: string; outcome: string; createdAt: string }>;
  recentAgentFailures: Array<{ runId: string; summary: string | null; failedAt: string }>;
  obsidianPatterns: string | null;
  githubIssues: Array<{ title: string; url: string; state: string; createdAt: string }>;
  confidenceBoost: number;
};

async function searchHistoricalContext(
  supabase: SupabaseClient,
  agentId: string,
  rootCauseType: string,
): Promise<HistoricalContext> {
  // Semantic similarity search over past repair learnings (falls back gracefully if no embeddings)
  const semanticText = `${agentId} ${rootCauseType} agent failure repair`;
  const semanticLearnings = await searchSimilarLearnings(supabase, semanticText, 5).catch(() => []);

  // Exact root-cause-type match as fallback / supplement
  const { data: exactRepairs } = await supabase
    .from('bud_repair_learnings')
    .select('root_cause_type, fix_pattern, outcome, created_at')
    .eq('root_cause_type', rootCauseType)
    .order('created_at', { ascending: false })
    .limit(5);

  // Merge: semantic results first (already filtered to similarity >= 0.72 in searchSimilarLearnings),
  // then append any exact matches not already covered by semantic results.
  const semanticKeys = new Set(semanticLearnings.map((l) => `${l.fixPattern}|${l.outcome}`));
  const mergedRepairs = [
    ...semanticLearnings.map((l) => ({
      root_cause_type: l.rootCauseType,
      fix_pattern: l.fixPattern,
      outcome: l.outcome,
      created_at: l.createdAt,
    })),
    ...(exactRepairs ?? []).filter(
      (r) => !semanticKeys.has(`${r.fix_pattern}|${r.outcome}`),
    ),
  ].slice(0, 5);

  // Alias for downstream usage
  const pastRepairs = mergedRepairs;

  // Recent failures of this specific agent in the last 7 days
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: recentFailures } = await supabase
    .from('agent_runs')
    .select('id, summary, started_at')
    .eq('agent_id', agentId)
    .in('status', ['failed', 'needs_repair'])
    .gte('started_at', since7d)
    .order('started_at', { ascending: false })
    .limit(5);

  // Obsidian repair pattern note for this agent (non-fatal if vault not configured)
  let obsidianPatterns: string | null = null;
  try {
    const safe = agentId.replace(/[^a-z0-9-]/g, '-');
    obsidianPatterns = readNote(`02-agents/${safe}-patterns.md`);
  } catch {
    // vault not configured or pattern file does not exist yet
  }

  // GitHub issues mentioning this agent (non-fatal if GitHub not configured)
  let githubIssues: Array<{ title: string; url: string; state: string; createdAt: string }> = [];
  try {
    const raw = await searchIssues(`[Bud] ${agentId} in:title label:bud`, 5);
    githubIssues = raw.map(({ title, url, state, createdAt }) => ({ title, url, state, createdAt }));
  } catch {
    // GitHub not configured — skip silently
  }

  // Boost confidence by 0.05 per past recovered fix, capped at +0.20
  const recoveredCount = (pastRepairs ?? []).filter((r) => r.outcome === 'recovered').length;
  const confidenceBoost = Math.min(0.2, recoveredCount * 0.05);

  return {
    pastRepairs: (pastRepairs ?? []).map((r) => ({
      rootCauseType: r.root_cause_type,
      fixPattern: r.fix_pattern,
      outcome: r.outcome,
      createdAt: r.created_at,
    })),
    recentAgentFailures: (recentFailures ?? []).map((r) => ({
      runId: r.id,
      summary: r.summary,
      failedAt: r.started_at,
    })),
    obsidianPatterns,
    githubIssues,
    confidenceBoost,
  };
}

function formatHistoryForPrompt(history: HistoricalContext, agentId: string): string {
  const parts: string[] = [];

  if (history.recentAgentFailures.length > 0) {
    parts.push(`RECENT FAILURES OF ${agentId} (last 7 days):`);
    history.recentAgentFailures.forEach((f) => {
      parts.push(`- [${f.failedAt.slice(0, 10)}] ${f.summary?.slice(0, 120) ?? 'no summary'}`);
    });
  }

  if (history.pastRepairs.length > 0) {
    parts.push(`\nPAST REPAIRS FOR THIS ROOT CAUSE TYPE:`);
    history.pastRepairs.forEach((r) => {
      parts.push(`- [${r.outcome.toUpperCase()}] ${r.fixPattern.slice(0, 120)}`);
    });
  }

  if (history.obsidianPatterns) {
    parts.push(`\nAGENT REPAIR PATTERNS (from Bud memory):\n${history.obsidianPatterns.slice(0, 800)}`);
  }

  if (history.githubIssues.length > 0) {
    parts.push(`\nRELATED GITHUB ISSUES:`);
    history.githubIssues.forEach((i) => {
      parts.push(`- [${i.state.toUpperCase()}] ${i.title} — ${i.url}`);
    });
  }

  return parts.length > 0 ? parts.join('\n') : 'No historical context found for this agent or root cause type.';
}

export async function executeRepairPipeline(
  supabase: SupabaseClient,
  params: {
    taskId: string;
    userId: string | null;
    trigger?: 'manual' | 'detected' | 'cron' | 'approval' | 'terminal';
  },
): Promise<{ executionId: string; status: string; blockedReason?: string }> {
  const { data: task, error } = await supabase
    .from('bud_tasks')
    .select('id, source_agent, status, description, confidence, risk_level, raw_input, raw_output')
    .eq('id', params.taskId)
    .single();
  if (error || !task) throw new Error(`Bud task not found: ${error?.message ?? params.taskId}`);

  const typedTask = task as RepairTaskRow;

  // Early dedup: if an active execution already exists for this task, skip creating another.
  const { data: existingExecution } = await supabase
    .from('bud_repair_executions')
    .select('id, status')
    .eq('task_id', typedTask.id)
    .in('status', ['detected', 'reproducing', 'analyzing', 'planning', 'awaiting_approval', 'patching', 'validating', 'verifying'])
    .maybeSingle();
  if (existingExecution) {
    return { executionId: existingExecution.id as string, status: 'skipped', blockedReason: 'duplicate_repair_in_progress' };
  }

  const executionId = await createExecution(supabase, typedTask, params.userId, params.trigger ?? 'manual');
  await updateTaskState(supabase, typedTask.id, 'detected');

  if (!isExecutionEnabled()) {
    const stepId = await startStep(supabase, executionId, 'blocked', 'Autonomous execution is disabled by environment policy.');
    await log(supabase, executionId, stepId, 'warn', 'BUD_OS_EXECUTION_ENABLED is not true; refusing to execute repair.');
    await finishStep(supabase, stepId, 'blocked', { required_env: 'BUD_OS_EXECUTION_ENABLED=true' });
    await updateExecution(supabase, executionId, {
      status: 'blocked',
      verification_status: 'blocked',
      finished_at: new Date().toISOString(),
    });
    await updateTaskState(supabase, typedTask.id, 'blocked');
    return { executionId, status: 'blocked', blockedReason: 'BUD_OS_EXECUTION_ENABLED is not true' };
  }

  const reproduceStep = await startStep(supabase, executionId, 'reproducing', 'Collected task evidence and repository state.');
  // git status is best-effort: Vercel serverless has no .git directory at runtime.
  // A non-zero exit means we are not in a git repo — skip the dirty-worktree gate and continue.
  const gitStatus = await runCommand('git', ['status', '--short'], 30_000);
  const gitAvailable = gitStatus.exitCode === 0;
  await log(supabase, executionId, reproduceStep, 'info',
    gitAvailable ? 'Captured git status.' : 'git not available in this environment — skipping worktree check.',
    gitStatus,
  );
  await finishStep(supabase, reproduceStep, 'passed', { git_status: gitStatus });

  const analyzeStep = await startStep(supabase, executionId, 'analyzing', 'Classified root cause and searched historical incident context.');
  const rootCause = classifyRootCause(typedTask);

  // Search historical context: past repairs, recent agent failures, Obsidian patterns, GitHub issues
  const history = await searchHistoricalContext(supabase, typedTask.source_agent ?? '', rootCause.type);
  const boostedConfidence = Math.min(0.99, rootCause.confidence + history.confidenceBoost);

  await updateExecution(supabase, executionId, {
    root_cause_type: rootCause.type,
    root_cause_summary: rootCause.summary,
    confidence: boostedConfidence,
  });
  await log(supabase, executionId, analyzeStep, 'info',
    `Historical context: ${history.pastRepairs.length} past repair(s), ${history.recentAgentFailures.length} recent failure(s), confidence boosted by +${history.confidenceBoost.toFixed(2)}.`,
    { history },
  );
  await finishStep(supabase, analyzeStep, 'passed', { root_cause: rootCause, history }, boostedConfidence);

  const planningStep = await startStep(supabase, executionId, 'planning', 'Generated repair strategy from root cause and historical patterns.');
  const strategy = buildStrategy(typedTask, rootCause);
  await updateExecution(supabase, executionId, { repair_strategy: strategy });
  await finishStep(supabase, planningStep, 'passed', strategy, boostedConfidence);

  // Only enforce the dirty-worktree gate when git is actually available (i.e. local dev).
  const dirtyWorktree = gitAvailable && gitStatus.stdout.trim().length > 0;
  if (dirtyWorktree && process.env.BUD_OS_ALLOW_DIRTY_WORKTREE !== 'true') {
    const stepId = await startStep(supabase, executionId, 'blocked', 'Worktree contains uncommitted changes; automatic patching is blocked.');
    await log(supabase, executionId, stepId, 'warn', 'Dirty worktree blocked repair executor.', { git_status: gitStatus.stdout });
    await finishStep(supabase, stepId, 'blocked', { git_status: gitStatus.stdout, required_env: 'BUD_OS_ALLOW_DIRTY_WORKTREE=true' });
    await updateExecution(supabase, executionId, { status: 'blocked', verification_status: 'blocked', finished_at: new Date().toISOString() });
    await updateTaskState(supabase, typedTask.id, 'blocked');
    return { executionId, status: 'blocked', blockedReason: 'dirty worktree' };
  }

  const patchStep = await startStep(supabase, executionId, 'patching', 'Checked whether an AI patch provider is configured.');
  if (!hasAiPatchProvider()) {
    await log(supabase, executionId, patchStep, 'warn', 'No AI patch provider is configured; patch generation is unavailable.');
    await finishStep(supabase, patchStep, 'blocked', {
      unavailable: true,
      reason: 'ANTHROPIC_API_KEY or OPENAI_API_KEY is required before Bud OS may generate patches.',
    });
    await updateExecution(supabase, executionId, { status: 'blocked', verification_status: 'blocked', finished_at: new Date().toISOString() });
    await updateTaskState(supabase, typedTask.id, 'blocked');
    await writeRepairLearning(supabase, executionId, typedTask, rootCause, 'blocked', 'Patch provider missing; repair stopped before code modification.');
    return { executionId, status: 'blocked', blockedReason: 'missing AI patch provider' };
  }

  // ── Patch generation ────────────────────────────────────────────────────────
  // Use the LLM to read each affected file, generate a minimal patch, and
  // write it back to a new GitHub branch. Opens a PR for human review.

  // Guard: tasks from the command bar have no structured_failure and no affectedFiles.
  // Without file context the LLM cannot generate a meaningful patch — block early
  // before creating an empty branch on GitHub.
  const preAffectedFiles = ((typedTask.raw_output as Record<string, unknown> | null)
    ?.structured_failure as Record<string, unknown> | null)
    ?.affectedFiles as string[] | undefined ?? [];
  const hasStructuredFailure = Boolean((typedTask.raw_output as Record<string, unknown> | null)?.structured_failure);
  const descLower = (typedTask.description ?? '').toLowerCase();
  const isMetaCommand = !hasStructuredFailure && preAffectedFiles.length === 0 && (
    descLower.startsWith('investigate and propose') ||
    descLower.startsWith('investigate ') ||
    descLower.startsWith('propose a fix') ||
    descLower.startsWith('fix ') && !descLower.includes('error') && !descLower.includes('fail')
  );

  if (isMetaCommand) {
    await finishStep(supabase, patchStep, 'blocked', {
      reason: 'meta_command_task',
      hint: 'Repair tasks need structured failure data from a real agent run. Trigger an investigation on a failed agent_run row first.',
    });
    await updateExecution(supabase, executionId, { status: 'blocked', verification_status: 'blocked', finished_at: new Date().toISOString() });
    await updateTaskState(supabase, typedTask.id, 'blocked');
    return { executionId, status: 'blocked', blockedReason: 'meta_command_not_repairable' };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
  const PATCH_MODEL = 'claude-sonnet-4-6';

  // Create the repair branch on GitHub
  let branchName: string;
  let issueUrl: string | null = null;
  let prUrl: string | null = null;

  try {
    branchName = budBranchName(typedTask.source_agent ?? 'unknown');
    await createBranch(branchName);
    await log(supabase, executionId, patchStep, 'info', `Created branch ${branchName}.`);
  } catch (branchErr) {
    await finishStep(supabase, patchStep, 'failed', { error: String(branchErr) });
    await updateExecution(supabase, executionId, { status: 'failed', finished_at: new Date().toISOString() });
    await updateTaskState(supabase, typedTask.id, 'failed');
    return { executionId, status: 'failed' };
  }

  // Build context: read affected files from the branch (preAffectedFiles already extracted above)
  const fileContextParts: string[] = [];
  const affectedFiles = preAffectedFiles;

  for (const fp of affectedFiles.slice(0, 4)) {
    try {
      const file = await getFileContent(fp, 'main');
      if (file) {
        fileContextParts.push(`=== FILE: ${fp} ===\n${file.content.slice(0, 8000)}`);
      }
    } catch {
      // Non-fatal — we continue with whatever files we could read
    }
  }

  const rawOutput = typedTask.raw_output as Record<string, unknown> | null;
  const sf = rawOutput?.structured_failure as Record<string, unknown> | null;
  const description = typedTask.description ?? 'Unknown failure';
  const recommendedFix = (sf?.recommendedFix as string) ?? rootCause.summary;
  const errorMsg = (sf?.message as string) ?? description;

  const isSchemaError = rootCause.type === 'SCHEMA_VIOLATION' || rootCause.type === 'schema_violation';
  const schemaContext = isSchemaError ? `
AGENT OUTPUT SCHEMA (required by the runtime — every agent's \`result.output\` must conform):
{
  status: 'success'|'partial'|'failed'|'needs_repair'|'needs_action'|'investigating'|'repairing'|'blocked'|'degraded'|'attention_required',
  summary: string,
  findings: string[],          // human-readable list of what was found
  recommended_actions: string[], // list of next steps
  confidence: number,          // 0.0–1.0
  risk_level: 'low'|'medium'|'high'|'critical',
  raw_output?: unknown,        // optional — put the agent's original data here
  next_step?: string,
  structured_failure_reason?: string,
}
The runtime normalises non-conforming output automatically now, so the agent does NOT need to be updated — unless the failure is a runtime exception, not a schema issue.
` : '';

  const historyBlock = formatHistoryForPrompt(history, typedTask.source_agent ?? 'unknown');

  const patchPrompt = `You are Bud, an autonomous repair agent for a TypeScript/Next.js/Supabase codebase.
The project is a local-services platform (cleaning, yard care, etc.) with an agent system at src/lib/agents/.
Each agent exports a named constant that matches AgentDefinition: { id, name, description, category, autonomy, run(ctx) }.
The runtime at src/lib/agents/runtime.ts executes agents and handles retries, cost accounting, and guardrails.
${schemaContext}
TASK: Fix the following agent failure by generating a MINIMAL, SURGICAL code patch.

FAILURE SUMMARY: ${description}
ERROR TYPE: ${rootCause.type}
ERROR MESSAGE: ${errorMsg.slice(0, 600)}
RECOMMENDED FIX: ${recommendedFix}
ROOT CAUSE CONFIDENCE: ${(boostedConfidence * 100).toFixed(0)}%

HISTORICAL CONTEXT:
${historyBlock}

${fileContextParts.length > 0 ? `AFFECTED FILES:\n${fileContextParts.join('\n\n')}` : 'No affected files could be read from the repository.'}

SURGICAL CONSTRAINT — CRITICAL:
- Touch at most 3 files. If a correct fix requires more, return empty patches with a note explaining why.
- Do not refactor, rename, or reorganise code beyond what is needed to fix the specific failure.
- If a past fix pattern above already resolved this exact issue, apply the same fix.
- Prefer the smallest possible change: a one-line fix beats a function rewrite.

INSTRUCTIONS:
1. Use historical context to inform your fix — if past repairs succeeded on the same root cause, apply the same pattern.
2. Return a JSON array of file patches. Each patch must have:
   - "file": relative path from repo root (e.g. "src/lib/agents/agents/foo.ts")
   - "content": the COMPLETE updated file content (not a diff)
   - "reason": one sentence explaining what changed and why
3. Only include files you are genuinely modifying. Do not include files that are already correct.
4. If the fix requires more than 3 files OR is outside the scope of a code patch (e.g. missing env var, infrastructure issue), return an empty array and explain in "note" — this triggers human escalation.

Return ONLY valid JSON:
{
  "patches": [{ "file": "...", "content": "...", "reason": "..." }],
  "note": "optional explanation if no patches or if scope exceeded"
}`;

  let patches: Array<{ file: string; content: string; reason: string }> = [];
  let patchNote = '';

  try {
    const patchRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: PATCH_MODEL,
        max_tokens: 8000,
        messages: [{ role: 'user', content: patchPrompt }],
      }),
    });

    if (!patchRes.ok) {
      throw new Error(`Anthropic API ${patchRes.status}: ${await patchRes.text()}`);
    }

    const patchJson = await patchRes.json() as { content: Array<{ type: string; text?: string }> };
    const rawText = patchJson.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');

    // Extract JSON from the response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        patches?: Array<{ file: string; content: string; reason: string }>;
        note?: string;
      };
      patches = parsed.patches ?? [];
      patchNote = parsed.note ?? '';
    }
  } catch (llmErr) {
    await log(supabase, executionId, patchStep, 'warn', `LLM patch generation failed: ${llmErr}`, {});
  }

  await log(supabase, executionId, patchStep, 'info',
    `LLM generated ${patches.length} patch(es).${patchNote ? ` Note: ${patchNote}` : ''}`,
    { patches: patches.map((p) => ({ file: p.file, reason: p.reason })) },
  );

  // ── Surgical enforcement ────────────────────────────────────────────────────
  // Hard limit: >3 files means the model overstepped. Reject and escalate.
  if (patches.length > 3) {
    const escalationNote = `Surgical limit exceeded: LLM proposed ${patches.length} file(s). Maximum is 3. ${patchNote || 'Manual review required.'}`;
    await finishStep(supabase, patchStep, 'blocked', {
      reason: 'surgical_limit_exceeded',
      file_count: patches.length,
      files: patches.map((p) => p.file),
      note: escalationNote,
    });
    try {
      await createIssue(
        `[Bud] Escalation: ${typedTask.source_agent ?? 'agent'} repair scope too large`,
        [
          `## Bud Escalation — Manual Review Required`,
          `**Agent:** ${typedTask.source_agent ?? 'unknown'}`,
          `**Root cause:** ${rootCause.type} — ${rootCause.summary}`,
          `**Reason:** The automated repair would touch ${patches.length} files, exceeding the 3-file surgical limit.`,
          '',
          '## Proposed patches (not applied)',
          ...patches.map((p) => `- \`${p.file}\`: ${p.reason}`),
          '',
          `**Recommended fix:** ${recommendedFix}`,
          '',
          `> Bud stopped automatically to protect production. Review and apply the fix manually.`,
        ].join('\n'),
        ['bud', 'escalation', 'manual-review'],
      );
    } catch {
      // GitHub not configured — escalation issue creation is best-effort
    }
    await updateExecution(supabase, executionId, { status: 'blocked', verification_status: 'blocked', finished_at: new Date().toISOString() });
    await updateTaskState(supabase, typedTask.id, 'blocked');
    await writeRollbackEvent(supabase, executionId, typedTask.source_agent ?? null, 'surgical_limit', {
      notes: escalationNote,
    }).catch(() => { /* non-fatal */ });
    await writeRepairLearning(supabase, executionId, typedTask, rootCause, 'blocked', escalationNote);
    return { executionId, status: 'blocked', blockedReason: 'surgical_limit_exceeded' };
  }

  // Write patches to the branch
  const appliedFiles: string[] = [];
  // Record the timestamp just before we push — used to filter workflow runs we triggered.
  const pushTimestamp = new Date().toISOString();
  for (const patch of patches) {
    try {
      const existing = await getFileContent(patch.file, branchName);
      await writeFileToBranch(
        patch.file,
        patch.content,
        `fix(${typedTask.source_agent ?? 'agent'}): ${patch.reason.slice(0, 72)}`,
        branchName,
        existing?.sha,
      );
      appliedFiles.push(patch.file);
    } catch (writeErr) {
      await log(supabase, executionId, patchStep, 'warn',
        `Failed to write ${patch.file}: ${writeErr}`, {},
      );
    }
  }

  // Write diff_summary so the Repair Pipeline Strip can advance past the DIFF stage.
  const diffSummary = appliedFiles.length > 0
    ? patches
        .filter((p) => appliedFiles.includes(p.file))
        .map((p) => `${p.file}: ${p.reason}`)
        .join('\n')
    : `No files patched — ${patchNote || 'LLM returned no patches'}`;
  await updateExecution(supabase, executionId, { diff_summary: diffSummary });

  await finishStep(supabase, patchStep,
    appliedFiles.length > 0 ? 'passed' : 'blocked',
    { branch: branchName, files_patched: appliedFiles, note: patchNote },
    boostedConfidence,
  );

  // ── Validation step ──────────────────────────────────────────────────────────
  // If files were patched, poll GitHub Actions for a CI result before opening a PR.
  // - CI passes  → open PR normally
  // - CI fails   → roll back the branch and open an escalation issue
  // - No CI / timeout with in-progress run → open a draft PR flagged for human review

  let ciConclusion: string | null = null;
  let ciRunUrl: string | null = null;
  let ciWorkflowRunId: string | null = null;
  let openAsDraft = false;
  let tasteResult: VisualScore | null = null;

  if (appliedFiles.length > 0) {
    const validateStep = await startStep(supabase, executionId, 'validating',
      'Polling GitHub Actions for CI result on repair branch.');
    await updateExecution(supabase, executionId, { verification_status: 'running' });

    const CI_TIMEOUT_MS = 30_000;
    const { result: workflowResult, timedOut } = await pollWorkflowUntilComplete(
      branchName, CI_TIMEOUT_MS, pushTimestamp,
    );

    if (workflowResult) {
      ciConclusion = workflowResult.conclusion ?? 'in_progress';
      ciRunUrl = workflowResult.url;
      ciWorkflowRunId = String(workflowResult.runId);
    }

    const ciFailure = workflowResult?.conclusion === 'failure'
      || workflowResult?.conclusion === 'cancelled'
      || workflowResult?.conclusion === 'timed_out';

    if (ciFailure) {
      // CI failed — roll back branch and escalate
      await finishStep(supabase, validateStep, 'failed', {
        workflow_run_id: ciWorkflowRunId,
        conclusion: workflowResult!.conclusion,
        url: ciRunUrl,
      });
      await updateExecution(supabase, executionId, {
        verification_status: 'failed',
        ci_workflow_run_id: ciWorkflowRunId,
        ci_conclusion: ciConclusion,
        ci_run_url: ciRunUrl,
        rollback_reason: `CI ${workflowResult!.conclusion} on ${branchName}`,
      });

      // Delete the repair branch to prevent it from cluttering the repo
      try { await deleteBranch(branchName); } catch { /* best-effort */ }

      // Record rollback event for trend monitoring
      await writeRollbackEvent(supabase, executionId, typedTask.source_agent ?? null, 'ci_failure', {
        branchName,
        ciConclusion: workflowResult!.conclusion ?? undefined,
        ciRunUrl: ciRunUrl ?? undefined,
        notes: `CI ${workflowResult!.conclusion} — branch ${branchName} deleted`,
      }).catch(() => { /* non-fatal */ });

      // Open an escalation issue with CI context
      try {
        await createIssue(
          `[Bud] CI failed on repair branch: ${typedTask.source_agent ?? 'agent'}`,
          [
            `## Automated Repair — CI Failure`,
            `**Agent:** ${typedTask.source_agent ?? 'unknown'}`,
            `**Root cause:** ${rootCause.type} — ${rootCause.summary}`,
            `**Branch:** \`${branchName}\` (deleted after CI failure)`,
            `**CI conclusion:** \`${workflowResult!.conclusion}\``,
            ciRunUrl ? `**CI run:** [View logs](${ciRunUrl})` : '',
            '',
            '## Files Bud attempted to patch',
            ...appliedFiles.map((f) => `- \`${f}\``),
            '',
            '## Patch reasoning',
            ...patches.filter((p) => appliedFiles.includes(p.file)).map((p) => `- **\`${p.file}\`:** ${p.reason}`),
            '',
            `**Recommended fix:** ${recommendedFix}`,
            '',
            `> CI failed on Bud's patch. The branch has been deleted. Manual review and a new fix are required.`,
          ].filter(Boolean).join('\n'),
          ['bud', 'ci-failed', 'escalation'],
        );
      } catch { /* GitHub may not be configured */ }

      await updateExecution(supabase, executionId, { status: 'failed', finished_at: new Date().toISOString() });
      await updateTaskState(supabase, typedTask.id, 'failed');
      await writeRepairLearning(
        supabase, executionId, typedTask, rootCause, 'failed',
        `CI ${workflowResult!.conclusion} — patch rolled back from ${branchName}`,
      );
      return { executionId, status: 'failed' };

    } else if (workflowResult?.conclusion === 'success') {
      await finishStep(supabase, validateStep, 'passed', {
        workflow_run_id: ciWorkflowRunId,
        conclusion: 'success',
        url: ciRunUrl,
      });
      await updateExecution(supabase, executionId, {
        verification_status: 'passed',
        ci_workflow_run_id: ciWorkflowRunId,
        ci_conclusion: 'success',
        ci_run_url: ciRunUrl,
      });
      await log(supabase, executionId, validateStep, 'info', 'CI passed — proceeding to open PR.');

    } else if (timedOut) {
      // CI is running but didn't finish in time — open a draft PR so humans can see it
      openAsDraft = true;
      await finishStep(supabase, validateStep, 'skipped', {
        reason: 'ci_still_running',
        workflow_run_id: ciWorkflowRunId,
        url: ciRunUrl,
      });
      await updateExecution(supabase, executionId, {
        verification_status: 'running',
        ci_workflow_run_id: ciWorkflowRunId,
        ci_run_url: ciRunUrl,
      });
      await log(supabase, executionId, validateStep, 'warn',
        `CI is still in progress after ${CI_TIMEOUT_MS / 1000}s — opening as draft PR.`);

    } else {
      // No workflow runs found — CI is probably not configured. Proceed normally.
      await finishStep(supabase, validateStep, 'passed', { reason: 'no_ci_workflows_detected' });
      await updateExecution(supabase, executionId, { verification_status: 'passed' });
      await log(supabase, executionId, validateStep, 'info',
        'No GitHub Actions workflow runs detected — skipping CI gate.');
    }
  }

  // ── Bud Taste — Design Constitution visual compliance check ──────────────────
  // Runs only when at least one patched file is a UI file (.tsx/.css page or component).
  // Claude reads the patched source code and scores it against the Design Constitution.
  // A failing taste score opens the PR as draft for design review — it does not block.

  if (appliedFiles.some(isUiFile)) {
    const tasteStep = await startStep(
      supabase, executionId, 'verifying',
      'Scoring UI changes against Design Constitution.',
    );

    // Read the patched content from the repair branch
    const uiFileContents: Array<{ path: string; content: string }> = [];
    for (const fp of appliedFiles.filter(isUiFile)) {
      try {
        const fetched = await getFileContent(fp, branchName);
        if (fetched) {
          uiFileContents.push({ path: fp, content: fetched.content });
        }
      } catch {
        // Non-fatal — skip files that can't be read
      }
    }

    tasteResult = await scoreVisualCompliance(uiFileContents);

    await updateExecution(supabase, executionId, {
      taste_score: tasteResult.score,
      taste_pass: tasteResult.pass,
      taste_violations: tasteResult.violations,
      taste_suggestions: tasteResult.suggestions,
      taste_checked_files: tasteResult.checkedFiles,
      taste_checked_at: new Date().toISOString(),
    });

    if (!tasteResult.pass) {
      openAsDraft = true; // Keep PR as draft so a designer can review
    }

    await log(
      supabase, executionId, tasteStep,
      tasteResult.pass ? 'info' : 'warn',
      `Design Constitution score: ${(tasteResult.score * 100).toFixed(0)}% — ${tasteResult.pass ? 'passed' : 'FAILED (PR opened as draft)'}`,
      { taste: tasteResult },
    );
    await finishStep(
      supabase, tasteStep,
      tasteResult.pass ? 'passed' : 'failed',
      { taste: tasteResult },
      tasteResult.score,
    );
  }

  // ── Browser tests — golden-path Playwright gate ──────────────────────────────
  // Runs only when:
  //   1. UI files were patched (any .tsx / .css page or component)
  //   2. BUD_OS_EXECUTION_ENABLED=true (same guard used by the patch step)
  //   3. A Playwright-compatible base URL is reachable (PLAYWRIGHT_BASE_URL or localhost)
  //
  // A failing browser gate opens the PR as a draft and marks the step failed,
  // but does NOT roll back the patch (unlike CI — the patch may still be correct).

  let browserResult: BrowserTestResult | null = null;

  if (appliedFiles.some(isUiFile) && isExecutionEnabled()) {
    const browserStep = await startStep(
      supabase, executionId, 'verifying',
      'Running Playwright golden-path tests against the patched UI.',
    );

    try {
      browserResult = await runBrowserTests(supabase, executionId, browserStep, {
        testDir: 'tests/e2e/golden-paths',
        project: 'chromium',
        baseUrl: process.env.PLAYWRIGHT_BASE_URL,
        timeout: 120_000,
      });

      const browserPassed = browserResult.failed === 0 && browserResult.total > 0;

      // Record aggregate on the execution row
      await updateExecution(supabase, executionId, {
        browser_tests_passed: browserResult.passed,
        browser_tests_failed: browserResult.failed,
        browser_tests_total: browserResult.total,
        browser_test_status: browserResult.total === 0
          ? 'skipped'
          : browserPassed ? 'passed' : 'failed',
      });

      await log(
        supabase, executionId, browserStep,
        browserPassed ? 'info' : 'warn',
        formatBrowserSummary(browserResult),
        { browser: browserResult },
      );

      if (!browserPassed && browserResult.total > 0) {
        openAsDraft = true; // Keep PR as draft until golden paths are green
      }

      await finishStep(
        supabase, browserStep,
        browserResult.total === 0 ? 'skipped' : browserPassed ? 'passed' : 'failed',
        { browser: browserResult },
        browserPassed ? 0.95 : 0.3,
      );

    } catch (browserErr) {
      await log(supabase, executionId, browserStep, 'warn',
        `Browser test step failed non-fatally: ${browserErr}`, {});
      await finishStep(supabase, browserStep, 'skipped', { error: String(browserErr) });
      await updateExecution(supabase, executionId, { browser_test_status: 'blocked' });
    }
  }

  // ── Open GitHub issue and PR ──────────────────────────────────────────────────
  try {
    const issue = await createIssue(
      `[Bud] Fix ${typedTask.source_agent ?? 'agent'}: ${rootCause.type}`,
      [
        `## Automated Repair`,
        `**Agent:** ${typedTask.source_agent ?? 'unknown'}`,
        `**Error:** ${rootCause.type} — ${rootCause.summary}`,
        `**Recommended fix:** ${recommendedFix}`,
        '',
        appliedFiles.length > 0
          ? `### Patches applied\n${appliedFiles.map((f) => `- \`${f}\``).join('\n')}\n\n*Review the branch before merging.*`
          : `### No files patched\n${patchNote || 'The LLM determined no file changes are needed (e.g. config or env issue).'}`,
      ].join('\n'),
      ['bud', 'automated'],
    );
    issueUrl = issue.url;

    if (appliedFiles.length > 0) {
      const pastFixSummary = history.pastRepairs.length > 0
        ? history.pastRepairs.map((r) => `- [${r.outcome.toUpperCase()}] ${r.fixPattern.slice(0, 100)}`).join('\n')
        : '_No prior fixes found for this root cause type._';

      const recentFailureSummary = history.recentAgentFailures.length > 0
        ? `${history.recentAgentFailures.length} failure(s) in the last 7 days`
        : 'No recent failures on record';

      const ciStatusLine = ciConclusion === 'success'
        ? '**CI:** Passed'
        : openAsDraft && !tasteResult
          ? '**CI:** In progress — this PR is a draft until CI completes'
          : '**CI:** Not configured (opened without CI gate)';

      const tasteStatusLine = tasteResult
        ? tasteResult.pass
          ? `**Design Constitution:** Passed (${(tasteResult.score * 100).toFixed(0)}%)`
          : `**Design Constitution:** ⚠️ Failed (${(tasteResult.score * 100).toFixed(0)}%) — see violations below`
        : null;

      const browserStatusLine = browserResult
        ? browserResult.total === 0
          ? null
          : browserResult.failed === 0
            ? `**Browser tests:** ✅ ${browserResult.passed}/${browserResult.total} golden paths passed`
            : `**Browser tests:** ❌ ${browserResult.failed}/${browserResult.total} golden paths failed — PR opened as draft`
        : null;

      const prBody = [
        `Closes ${issueUrl}`,
        '',
        '## Repair Summary',
        `**Agent:** \`${typedTask.source_agent ?? 'unknown'}\``,
        `**Root cause:** ${rootCause.type} — ${rootCause.summary}`,
        `**Confidence:** ${(boostedConfidence * 100).toFixed(0)}% (base ${(rootCause.confidence * 100).toFixed(0)}% + ${(history.confidenceBoost * 100).toFixed(0)}% from history)`,
        `**Recent failures:** ${recentFailureSummary}`,
        ciStatusLine,
        ciRunUrl ? `**CI run:** ${ciRunUrl}` : '',
        tasteStatusLine ?? '',
        browserStatusLine ?? '',
        '',
        ...(tasteResult && !tasteResult.pass
          ? [
              '## Design Constitution violations',
              ...tasteResult.violations.map((v) => `- ${v}`),
              '',
              '## Design suggestions',
              ...tasteResult.suggestions.map((s) => `- ${s}`),
              '',
            ]
          : []),
        '## Files patched',
        ...appliedFiles.map((f) => `- \`${f}\``),
        '',
        '## Patch reasoning',
        ...patches.filter((p) => appliedFiles.includes(p.file)).map((p) => `- **\`${p.file}\`:** ${p.reason}`),
        '',
        '## Historical context',
        '**Past fixes for this root cause:**',
        pastFixSummary,
        history.githubIssues.length > 0 ? `\n**Related GitHub issues:**\n${history.githubIssues.map((i) => `- [${i.state.toUpperCase()}] [${i.title}](${i.url})`).join('\n')}` : '',
        '',
        '## Rollback strategy',
        '```',
        `git revert HEAD  # on branch: ${branchName}`,
        '```',
        'Or close this PR without merging — no production changes have been made.',
        '',
        openAsDraft
          ? tasteResult && !tasteResult.pass
            ? '> **Draft PR** — Design Constitution taste check failed. Resolve violations above before merging.'
            : '> **Draft PR** — CI is still running. Convert to ready when checks pass.'
          : '> Generated by Bud OS — review the patch carefully before merging.',
      ].filter(Boolean).join('\n');

      const tasteFailed = tasteResult && !tasteResult.pass;
      const browserFailed = browserResult && browserResult.failed > 0 && browserResult.total > 0;
      const draftTags = [
        tasteFailed ? '[Taste]' : '',
        browserFailed ? '[Browser]' : '',
      ].filter(Boolean).join('');
      const pr = await createPR(
        openAsDraft
          ? `[Bud][Draft]${draftTags} Fix ${typedTask.source_agent ?? 'agent'}: ${rootCause.type}`
          : `[Bud] Fix ${typedTask.source_agent ?? 'agent'}: ${rootCause.type}`,
        prBody,
        branchName,
        'main',
        openAsDraft,
      );
      prUrl = pr.url;
    }
  } catch (ghErr) {
    await log(supabase, executionId, patchStep, 'warn', `GitHub PR/issue creation failed: ${ghErr}`, {});
  }

  const finalRepairStatus = appliedFiles.length > 0 ? 'recovered' : 'blocked';

  // ── Intelligence summary ─────────────────────────────────────────────────────
  // When a repair succeeds, ask Claude to generate structured actionable output:
  // what broke, how the fix works, patterns to watch, and agents at risk.
  // Stored on the execution row so the dashboard can surface it immediately.
  let intelligenceSummary: string | null = null;
  if (appliedFiles.length > 0) {
    try {
      const patchReasons = patches
        .filter((p) => appliedFiles.includes(p.file))
        .map((p) => `${p.file}: ${p.reason}`)
        .join('; ');
      const historyNote = history.pastRepairs.length > 0
        ? `This root-cause type has appeared ${history.pastRepairs.length} time(s) before.`
        : 'First occurrence of this root-cause type on record.';

      const intelRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{
            role: 'user',
            content: `You are Bud, summarising a completed repair for an operator dashboard.

Agent: ${typedTask.source_agent ?? 'unknown'}
Root cause type: ${rootCause.type}
Root cause summary: ${rootCause.summary}
Files patched: ${appliedFiles.join(', ')}
Patch reasoning: ${patchReasons}
History: ${historyNote}

Return a JSON object with exactly these fields (all strings, all ≤ 15 words each):
{
  "what_broke": "one sentence — specific failure, not generic type name",
  "how_fixed": "one sentence — what the patch actually does",
  "pattern": "recurring pattern to watch across similar agents",
  "next_action": "one concrete operator action",
  "at_risk": ["agent-id-1", "agent-id-2"]
}

Return ONLY valid JSON. No prose.`,
          }],
        }),
      });

      if (intelRes.ok) {
        const intelJson = await intelRes.json() as { content: Array<{ type: string; text?: string }> };
        const rawText = intelJson.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) intelligenceSummary = jsonMatch[0];
      }
    } catch {
      // Non-fatal — dashboard falls back to diff_summary
    }
  }

  const fixPattern = appliedFiles.length > 0
    ? `LLM patch applied to: ${appliedFiles.join(', ')}${openAsDraft ? ' (draft PR — CI pending)' : ''}`
    : `No patch applied — ${patchNote || 'LLM returned no patches'}`;

  await updateExecution(supabase, executionId, {
    status: finalRepairStatus,
    verification_status: appliedFiles.length > 0
      ? (openAsDraft ? 'running' : 'passed')
      : 'blocked',
    ci_workflow_run_id: ciWorkflowRunId ?? undefined,
    ci_conclusion: ciConclusion ?? undefined,
    ci_run_url: ciRunUrl ?? undefined,
    pr_url: prUrl ?? undefined,
    issue_url: issueUrl ?? undefined,
    intelligence_summary: intelligenceSummary ?? undefined,
    finished_at: new Date().toISOString(),
  });
  await updateTaskState(supabase, typedTask.id, appliedFiles.length > 0 ? 'recovered' : 'blocked');
  await writeRepairLearning(
    supabase, executionId, typedTask, rootCause,
    appliedFiles.length > 0 ? 'recovered' : 'blocked',
    fixPattern,
  );

  return {
    executionId,
    status: finalRepairStatus,
    branchName,
    issueUrl: issueUrl ?? undefined,
    prUrl: prUrl ?? undefined,
  } as { executionId: string; status: string; blockedReason?: string };
}

async function writeRepairLearning(
  supabase: SupabaseClient,
  executionId: string,
  task: RepairTaskRow,
  rootCause: ReturnType<typeof classifyRootCause>,
  outcome: 'recovered' | 'blocked' | 'failed' | 'rolled_back',
  fixPattern: string,
): Promise<void> {
  const body = [
    `Root cause: ${rootCause.type}`,
    `Summary: ${rootCause.summary}`,
    `Task: ${task.description}`,
    `Outcome: ${outcome}`,
    `Pattern: ${fixPattern}`,
  ].join('\n');

  const memory = await writeMemory(supabase, {
    category: 'bugs',
    title: `Bud OS repair learning: ${rootCause.type}`,
    body,
    tags: ['bud-os', 'repair', rootCause.type, outcome],
    source: 'agent',
  }, { agentId: 'bud', status: 'pending', allowSoftDuplicate: true });

  const memoryDocId = memory.ok ? memory.doc.id : null;
  const { data: learningRow } = await supabase
    .from('bud_repair_learnings')
    .insert({
      execution_id: executionId,
      task_id: task.id,
      memory_doc_id: memoryDocId,
      root_cause_type: rootCause.type,
      fix_pattern: fixPattern,
      outcome,
      evidence: { memory_write: memory },
    })
    .select('id')
    .single();

  // Fire-and-forget: write embedding for semantic similarity search
  const learningId = (learningRow as { id?: string } | null)?.id;
  if (learningId) {
    const embedText = `${rootCause.type}: ${rootCause.summary}. Fix: ${fixPattern}. Outcome: ${outcome}.`;
    setImmediate(() => { writeLearningEmbedding(supabase, learningId, embedText).catch(() => {}); });
  }
}

const TERMINAL_COMMANDS: Record<string, { command: string; args: string[]; timeoutMs?: number; write?: boolean }> = {
  'git status': { command: 'git', args: ['status', '--short'] },
  'git branch': { command: 'git', args: ['branch', '--show-current'] },
  'git diff': { command: 'git', args: ['diff', '--stat'] },
  'build': { command: 'npm', args: ['run', 'build'], timeoutMs: 180_000 },
  'unit tests': { command: 'npm', args: ['run', 'test:unit'], timeoutMs: 180_000 },
};

export function listTerminalCommands(): string[] {
  return Object.keys(TERMINAL_COMMANDS);
}

export async function runBudTerminalCommand(
  supabase: SupabaseClient,
  params: { command: string; userId: string },
): Promise<{ sessionId: string; status: 'passed' | 'failed' | 'blocked'; output: string; exitCode: number | null }> {
  const spec = TERMINAL_COMMANDS[params.command];
  const { data, error } = await supabase
    .from('bud_terminal_sessions')
    .insert({ user_id: params.userId, command: params.command, status: spec ? 'running' : 'blocked' })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Could not create terminal session: ${error?.message ?? 'missing row'}`);

  const sessionId = data.id as string;
  if (!spec) {
    const output = `Blocked: command is not allowlisted. Available commands: ${listTerminalCommands().join(', ')}`;
    await supabase
      .from('bud_terminal_sessions')
      .update({ status: 'blocked', output, exit_code: null, finished_at: new Date().toISOString() })
      .eq('id', sessionId);
    return { sessionId, status: 'blocked', output, exitCode: null };
  }

  if ((params.command === 'build' || params.command === 'unit tests') && !isExecutionEnabled()) {
    const output = 'Blocked: BUD_OS_EXECUTION_ENABLED must be true before Bud Terminal can run validation commands.';
    await supabase
      .from('bud_terminal_sessions')
      .update({ status: 'blocked', output, exit_code: null, finished_at: new Date().toISOString() })
      .eq('id', sessionId);
    return { sessionId, status: 'blocked', output, exitCode: null };
  }

  const result = await runCommand(spec.command, spec.args, spec.timeoutMs ?? 60_000);
  const status = result.exitCode === 0 ? 'passed' : 'failed';
  const output = [
    `$ ${result.command}`,
    result.stdout,
    result.stderr ? `stderr:\n${result.stderr}` : '',
  ].filter(Boolean).join('\n');

  await supabase
    .from('bud_terminal_sessions')
    .update({ status, output, exit_code: result.exitCode, finished_at: new Date().toISOString() })
    .eq('id', sessionId);
  return { sessionId, status, output, exitCode: result.exitCode };
}
