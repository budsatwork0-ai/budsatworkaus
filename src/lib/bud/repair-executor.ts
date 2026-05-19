import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SupabaseClient } from '@supabase/supabase-js';
import { writeMemory } from '@/lib/memory/write';

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
  const gitStatus = await runCommand('git', ['status', '--short'], 30_000);
  await log(supabase, executionId, reproduceStep, 'info', 'Captured git status.', gitStatus);
  await finishStep(supabase, reproduceStep, gitStatus.exitCode === 0 ? 'passed' : 'failed', { git_status: gitStatus });
  if (gitStatus.exitCode !== 0) {
    await updateExecution(supabase, executionId, { status: 'failed', finished_at: new Date().toISOString() });
    await updateTaskState(supabase, typedTask.id, 'failed');
    return { executionId, status: 'failed' };
  }

  const analyzeStep = await startStep(supabase, executionId, 'analyzing', 'Classified root cause from stored failure evidence.');
  const rootCause = classifyRootCause(typedTask);
  await updateExecution(supabase, executionId, {
    root_cause_type: rootCause.type,
    root_cause_summary: rootCause.summary,
    confidence: rootCause.confidence,
  });
  await finishStep(supabase, analyzeStep, 'passed', { root_cause: rootCause }, rootCause.confidence);

  const planningStep = await startStep(supabase, executionId, 'planning', 'Generated deterministic repair strategy.');
  const strategy = buildStrategy(typedTask, rootCause);
  await updateExecution(supabase, executionId, { repair_strategy: strategy });
  await finishStep(supabase, planningStep, 'passed', strategy, rootCause.confidence);

  const dirtyWorktree = gitStatus.stdout.trim().length > 0;
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

  await finishStep(supabase, patchStep, 'blocked', {
    unavailable: true,
    reason: 'AI patch invocation is intentionally not wired until provider-specific patch application is implemented.',
  });
  await updateExecution(supabase, executionId, { status: 'blocked', verification_status: 'blocked', finished_at: new Date().toISOString() });
  await updateTaskState(supabase, typedTask.id, 'blocked');
  await writeRepairLearning(supabase, executionId, typedTask, rootCause, 'blocked', 'AI provider exists, but patch application is not implemented yet.');
  return { executionId, status: 'blocked', blockedReason: 'patch application not implemented' };
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
  await supabase.from('bud_repair_learnings').insert({
    execution_id: executionId,
    task_id: task.id,
    memory_doc_id: memoryDocId,
    root_cause_type: rootCause.type,
    fix_pattern: fixPattern,
    outcome,
    evidence: { memory_write: memory },
  });
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
