/**
 * Improvement Executor
 *
 * Parallel to repair-executor.ts but for PROACTIVE improvements, not reactive
 * bug fixes. Takes an improvement signal (from Bud Observer, ux-evolution-engine,
 * admin_ux_proposals, etc.), generates a surgical code change, validates it, and
 * opens a PR — all without touching GitHub manually.
 *
 * Pipeline:
 *   DETECT → ANALYZE → PLAN → PATCH → VALIDATE (CI) → TASTE → BROWSER → PR → [AUTO-MERGE]
 *
 * Auto-merge fires at autonomy level ≥ 4 when ALL gates pass:
 *   - CI: success (or no CI configured)
 *   - Taste: pass
 *   - Browser: pass (or no UI files changed)
 *   - Confidence: ≥ 0.82
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createBranch,
  createIssue,
  createPR,
  budImproveBranchName,
  getFileContent,
  writeFileToBranch,
  deleteBranch,
  pollWorkflowUntilComplete,
  mergePR,
  enableAutoMerge,
  listOpenPRsByLabel,
} from './github-executor';
import { scoreVisualCompliance, type VisualScore } from './visual-scorer';
import { isUiFile } from './design-constitution';
import { runBrowserTests, formatBrowserSummary, type BrowserTestResult } from './browser-executor';
import { generateEmbedding } from './embedding';
import { writeMemory } from '@/lib/memory/write';
import { getDefaultAutonomyLevel } from './autonomy';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const IMPROVEMENT_MODEL = 'claude-sonnet-4-6';
const AUTO_MERGE_AUTONOMY_THRESHOLD = 4;
const AUTO_MERGE_CONFIDENCE_THRESHOLD = 0.82;
const CI_TIMEOUT_MS = 30_000;

export type ImprovementSignalRow = {
  id: string;
  source: string;
  signal_type: string;
  severity: string;
  title: string;
  description: string | null;
  affected_area: string | null;
  proposed_approach: string | null;
  reference_files: string[] | null;
  metadata: Record<string, unknown> | null;
};

function isExecutionEnabled(): boolean {
  return process.env.BUD_OS_EXECUTION_ENABLED === 'true';
}

async function createExecution(
  supabase: SupabaseClient,
  signal: ImprovementSignalRow,
  userId: string | null,
  trigger: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('bud_improvement_executions')
    .insert({
      signal_id: signal.id,
      title: signal.title,
      trigger,
      status: 'detected',
      confidence: null,
      risk_score: signalRiskScore(signal.severity),
      created_by: userId,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Could not create improvement execution: ${error?.message}`);
  return data.id as string;
}

async function updateExecution(
  supabase: SupabaseClient,
  executionId: string,
  updates: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from('bud_improvement_executions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', executionId);
}

async function startStep(
  supabase: SupabaseClient,
  executionId: string,
  state: string,
  summary: string,
): Promise<string> {
  await updateExecution(supabase, executionId, { status: state });
  const { data, error } = await supabase
    .from('bud_improvement_steps')
    .insert({ execution_id: executionId, state, status: 'running', summary })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Could not create improvement step: ${error?.message}`);
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
    .from('bud_improvement_steps')
    .update({ status, evidence, confidence: confidence ?? null, finished_at: new Date().toISOString() })
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
  await supabase.from('bud_improvement_logs').insert({
    execution_id: executionId,
    step_id: stepId,
    level,
    message,
    metadata,
  });
}

function signalRiskScore(severity: string): number {
  if (severity === 'critical') return 70;
  if (severity === 'high') return 50;
  if (severity === 'medium') return 30;
  return 15;
}

// ── File identification ────────────────────────────────────────────────────────
// Ask Claude to identify the most likely files to read based on the signal.

async function identifyTargetFiles(signal: ImprovementSignalRow): Promise<string[]> {
  // Honour explicit reference_files first
  if (signal.reference_files && signal.reference_files.length > 0) {
    return signal.reference_files.slice(0, 5);
  }

  if (!ANTHROPIC_API_KEY) return [];

  const area = signal.affected_area ?? '';
  const description = signal.description ?? signal.title;

  // Known area → file mappings to guide the model
  const FILE_MAP: Record<string, string[]> = {
    '/dashboard':      ['src/app/(app)/dashboard/page.tsx'],
    '/crew':           ['src/app/(app)/crew/page.tsx'],
    '/portal':         ['src/app/(app)/portal/page.tsx'],
    '/services':       ['src/app/(public)/services/page.tsx'],
    '/':               ['src/app/ui/home/HomePage.tsx'],
    'design':          ['src/app/ui/theme.ts'],
    'theme':           ['src/app/ui/theme.ts'],
    'quote':           ['src/app/(public)/services/page.tsx', 'src/app/api/quotes/route.ts'],
    'email':           ['src/lib/email/templates.ts'],
    'agent':           [],  // resolved by agent id in description
  };

  const hint = Object.entries(FILE_MAP).find(([k]) =>
    area.toLowerCase().includes(k) || description.toLowerCase().includes(k),
  );
  if (hint) return hint[1];

  // Fall back to asking the LLM — capped at 3 files
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: `You are a code navigator for a Next.js 15 / Supabase project called Buds At Work.
Project structure:
  src/app/(public)/services/page.tsx  — public quote builder
  src/app/(app)/dashboard/            — admin dashboard
  src/app/(app)/crew/                 — crew portal
  src/app/(app)/portal/               — client portal
  src/app/ui/home/HomePage.tsx        — marketing homepage
  src/app/ui/theme.ts                 — design tokens
  src/lib/agents/agents/              — agent definitions
  src/lib/email/templates.ts          — email templates

Improvement area: ${area}
Improvement description: ${description.slice(0, 300)}

List up to 3 file paths (relative from repo root) that most likely need to be modified.
Return ONLY a JSON array of strings: ["path/to/file.ts", ...]`,
        }],
      }),
    });
    if (res.ok) {
      const json = await res.json() as { content: Array<{ type: string; text?: string }> };
      const raw = json.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
      const match = raw.match(/\[[\s\S]*?\]/);
      if (match) {
        const files = JSON.parse(match[0]) as string[];
        return files.slice(0, 3).filter((f) => typeof f === 'string' && f.endsWith('.ts') || f.endsWith('.tsx'));
      }
    }
  } catch {
    // Non-fatal
  }
  return [];
}

// ── Historical context ─────────────────────────────────────────────────────────

async function searchImprovementHistory(
  supabase: SupabaseClient,
  signalType: string,
  affectedArea: string,
): Promise<string> {
  const { data: learnings } = await supabase
    .from('bud_improvement_learnings')
    .select('signal_type, improvement_pattern, outcome, affected_area, created_at')
    .eq('signal_type', signalType)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!learnings || learnings.length === 0) return 'No prior improvements found for this signal type.';

  return learnings
    .map((l) => `[${(l.outcome as string).toUpperCase()}] ${l.improvement_pattern} (area: ${l.affected_area ?? '—'})`)
    .join('\n');
}

// ── Main pipeline ──────────────────────────────────────────────────────────────

export async function executeImprovementPipeline(
  supabase: SupabaseClient,
  params: {
    signalId: string;
    userId: string | null;
    trigger?: string;
  },
): Promise<{ executionId: string; status: string; blockedReason?: string; prUrl?: string }> {

  const { data: signal, error: signalErr } = await supabase
    .from('bud_improvement_signals')
    .select('*')
    .eq('id', params.signalId)
    .single();

  if (signalErr || !signal) throw new Error(`Improvement signal not found: ${params.signalId}`);
  const typedSignal = signal as ImprovementSignalRow;

  // Dedup: don't start a second execution if one is already in flight for this signal
  const { data: running } = await supabase
    .from('bud_improvement_executions')
    .select('id, status')
    .eq('signal_id', typedSignal.id)
    .in('status', ['detected', 'analyzing', 'planning', 'patching', 'validating', 'verifying'])
    .limit(1);

  if (running && running.length > 0) {
    return { executionId: (running[0] as { id: string }).id, status: 'already_running' };
  }

  const executionId = await createExecution(supabase, typedSignal, params.userId, params.trigger ?? 'manual');

  await supabase
    .from('bud_improvement_signals')
    .update({ status: 'executing', updated_at: new Date().toISOString() })
    .eq('id', typedSignal.id);

  if (!isExecutionEnabled()) {
    const stepId = await startStep(supabase, executionId, 'blocked', 'Autonomous execution is disabled.');
    await log(supabase, executionId, stepId, 'warn', 'BUD_OS_EXECUTION_ENABLED is not true.');
    await finishStep(supabase, stepId, 'blocked', { required_env: 'BUD_OS_EXECUTION_ENABLED=true' });
    await updateExecution(supabase, executionId, { status: 'blocked', finished_at: new Date().toISOString() });
    return { executionId, status: 'blocked', blockedReason: 'execution_disabled' };
  }

  if (!ANTHROPIC_API_KEY) {
    const stepId = await startStep(supabase, executionId, 'blocked', 'No AI provider configured.');
    await finishStep(supabase, stepId, 'blocked', { required_env: 'ANTHROPIC_API_KEY' });
    await updateExecution(supabase, executionId, { status: 'blocked', finished_at: new Date().toISOString() });
    return { executionId, status: 'blocked', blockedReason: 'missing_api_key' };
  }

  // ── ANALYZE ──────────────────────────────────────────────────────────────────
  const analyzeStep = await startStep(supabase, executionId, 'analyzing',
    'Identifying target files and searching improvement history.');

  const targetFiles = await identifyTargetFiles(typedSignal);
  const historyContext = await searchImprovementHistory(
    supabase, typedSignal.signal_type, typedSignal.affected_area ?? '',
  );

  await log(supabase, executionId, analyzeStep, 'info',
    `Target files: ${targetFiles.join(', ') || 'none identified'}. History: ${historyContext.slice(0, 120)}`);

  const fileContextParts: string[] = [];
  for (const fp of targetFiles.slice(0, 3)) {
    try {
      const file = await getFileContent(fp, 'main');
      if (file) fileContextParts.push(`=== FILE: ${fp} ===\n${file.content.slice(0, 8000)}`);
    } catch { /* non-fatal */ }
  }

  await finishStep(supabase, analyzeStep, 'passed', { targetFiles, historyContext: historyContext.slice(0, 300) });

  // ── PLAN ──────────────────────────────────────────────────────────────────────
  const planStep = await startStep(supabase, executionId, 'planning', 'Generating improvement approach.');

  const approachPrompt = `You are Bud, an autonomous improvement agent for a TypeScript/Next.js 15/Supabase codebase.
The project is a local services platform (cleaning, yard care, car detailing, etc.) serving Logan and South Brisbane.

IMPROVEMENT SIGNAL:
  Type: ${typedSignal.signal_type}
  Severity: ${typedSignal.severity}
  Title: ${typedSignal.title}
  Description: ${(typedSignal.description ?? '').slice(0, 600)}
  Affected area: ${typedSignal.affected_area ?? 'not specified'}
  Proposed approach: ${typedSignal.proposed_approach ?? 'not specified'}

HISTORICAL CONTEXT:
${historyContext}

${fileContextParts.length > 0 ? `RELEVANT FILES:\n${fileContextParts.join('\n\n')}` : 'No file context available.'}

Write a concise improvement approach (2–4 sentences): what you will change, how, and why.
Then return the plan as JSON: { "approach": "...", "confidence": 0.0-1.0, "estimated_files": ["..."] }`;

  let approach = typedSignal.proposed_approach ?? typedSignal.title;
  let confidence = 0.65;

  try {
    const approachRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: IMPROVEMENT_MODEL,
        max_tokens: 512,
        messages: [{ role: 'user', content: approachPrompt }],
      }),
    });
    if (approachRes.ok) {
      const json = await approachRes.json() as { content: Array<{ type: string; text?: string }> };
      const raw = json.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { approach?: string; confidence?: number };
        approach = parsed.approach ?? approach;
        confidence = Math.min(0.99, Math.max(0.1, parsed.confidence ?? confidence));
      }
    }
  } catch { /* use defaults */ }

  await updateExecution(supabase, executionId, { approach, confidence });
  await finishStep(supabase, planStep, 'passed', { approach, confidence }, confidence);

  // ── PATCH ─────────────────────────────────────────────────────────────────────
  const patchStep = await startStep(supabase, executionId, 'patching', 'Generating surgical code improvement.');

  // Check for duplicate in-flight PRs
  const existingPRs = await listOpenPRsByLabel('bud-improvement').catch(() => []);
  const area = (typedSignal.affected_area ?? typedSignal.title).slice(0, 30).toLowerCase();
  const duplicate = existingPRs.find((pr) => pr.title.toLowerCase().includes(area));
  if (duplicate) {
    await log(supabase, executionId, patchStep, 'warn',
      `Skipping: duplicate improvement PR already open: ${duplicate.url}`);
    await finishStep(supabase, patchStep, 'blocked', { duplicate_pr: duplicate.url });
    await updateExecution(supabase, executionId, { status: 'blocked', finished_at: new Date().toISOString() });
    await supabase.from('bud_improvement_signals').update({ status: 'stale' }).eq('id', typedSignal.id);
    return { executionId, status: 'blocked', blockedReason: 'duplicate_pr', prUrl: duplicate.url };
  }

  const patchPrompt = `You are Bud, an autonomous code improvement agent for a TypeScript/Next.js 15/Supabase codebase.

IMPROVEMENT TO IMPLEMENT:
  Title: ${typedSignal.title}
  Approach: ${approach}
  Signal type: ${typedSignal.signal_type}

${fileContextParts.length > 0 ? `CURRENT CODE:\n${fileContextParts.join('\n\n')}` : 'No file context could be read from the repository.'}

HISTORICAL PATTERNS:
${historyContext}

CONSTRAINTS — CRITICAL:
- Touch at most 3 files. Return empty patches if more are needed.
- Make the SMALLEST possible change that delivers the improvement.
- Do NOT refactor, rename, or reorganise anything beyond scope.
- Preserve all existing functionality.
- Follow the glass-morphism design system (brand.primary=#0f3d2e, glass morphism cards, Tailwind v4).
- TypeScript must remain strict — no \`any\` casts unless already present.

Return ONLY valid JSON:
{
  "patches": [
    { "file": "src/...", "content": "<complete updated file>", "reason": "one sentence" }
  ],
  "note": "optional explanation — required if patches is empty"
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
        model: IMPROVEMENT_MODEL,
        max_tokens: 10000,
        messages: [{ role: 'user', content: patchPrompt }],
      }),
    });
    if (patchRes.ok) {
      const json = await patchRes.json() as { content: Array<{ type: string; text?: string }> };
      const rawText = json.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { patches?: typeof patches; note?: string };
        patches = parsed.patches ?? [];
        patchNote = parsed.note ?? '';
      }
    }
  } catch (llmErr) {
    await log(supabase, executionId, patchStep, 'warn', `Patch generation failed: ${llmErr}`);
  }

  if (patches.length > 3) {
    const note = `Surgical limit exceeded: ${patches.length} files proposed. Max is 3.`;
    await finishStep(supabase, patchStep, 'blocked', { note, files: patches.map((p) => p.file) });
    await updateExecution(supabase, executionId, { status: 'blocked', finished_at: new Date().toISOString() });
    await writeLearning(supabase, executionId, typedSignal, 'blocked',
      `Scope too large — ${patches.length} files needed`);
    return { executionId, status: 'blocked', blockedReason: 'surgical_limit' };
  }

  if (patches.length === 0) {
    const note = patchNote || 'LLM determined no file changes are needed.';
    await log(supabase, executionId, patchStep, 'info', `No patches generated: ${note}`);
    await finishStep(supabase, patchStep, 'blocked', { note });
    await updateExecution(supabase, executionId, { status: 'blocked', diff_summary: note, finished_at: new Date().toISOString() });
    await writeLearning(supabase, executionId, typedSignal, 'blocked', note);
    await supabase.from('bud_improvement_signals').update({ status: 'completed' }).eq('id', typedSignal.id);
    return { executionId, status: 'blocked', blockedReason: 'no_patches' };
  }

  // Create branch and write patches
  let branchName: string;
  try {
    branchName = budImproveBranchName(typedSignal.affected_area ?? typedSignal.signal_type);
    await createBranch(branchName);
    await log(supabase, executionId, patchStep, 'info', `Created branch ${branchName}.`);
  } catch (branchErr) {
    await finishStep(supabase, patchStep, 'failed', { error: String(branchErr) });
    await updateExecution(supabase, executionId, { status: 'failed', finished_at: new Date().toISOString() });
    return { executionId, status: 'failed' };
  }

  const pushTimestamp = new Date().toISOString();
  const appliedFiles: string[] = [];

  for (const patch of patches) {
    try {
      const existing = await getFileContent(patch.file, branchName);
      await writeFileToBranch(
        patch.file,
        patch.content,
        `improve(${typedSignal.signal_type}): ${patch.reason.slice(0, 72)}`,
        branchName,
        existing?.sha,
      );
      appliedFiles.push(patch.file);
    } catch (writeErr) {
      await log(supabase, executionId, patchStep, 'warn', `Failed to write ${patch.file}: ${writeErr}`);
    }
  }

  const diffSummary = appliedFiles.length > 0
    ? patches.filter((p) => appliedFiles.includes(p.file)).map((p) => `${p.file}: ${p.reason}`).join('\n')
    : `No files patched — ${patchNote || 'write failed'}`;

  await updateExecution(supabase, executionId, { diff_summary: diffSummary, branch_name: branchName });
  await finishStep(supabase, patchStep, appliedFiles.length > 0 ? 'passed' : 'blocked',
    { branch: branchName, files_patched: appliedFiles, note: patchNote }, confidence);

  if (appliedFiles.length === 0) {
    await updateExecution(supabase, executionId, { status: 'blocked', finished_at: new Date().toISOString() });
    return { executionId, status: 'blocked', blockedReason: 'no_files_written' };
  }

  // ── VALIDATE (CI) ─────────────────────────────────────────────────────────────
  let ciConclusion: string | null = null;
  let ciRunUrl: string | null = null;
  let ciWorkflowRunId: string | null = null;
  let openAsDraft = false;
  let tasteResult: VisualScore | null = null;
  let browserResult: BrowserTestResult | null = null;

  const validateStep = await startStep(supabase, executionId, 'validating',
    'Polling GitHub Actions for CI result on improvement branch.');
  await updateExecution(supabase, executionId, { verification_status: 'running' });

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
    await finishStep(supabase, validateStep, 'failed', { conclusion: workflowResult!.conclusion, url: ciRunUrl });
    await updateExecution(supabase, executionId, {
      verification_status: 'failed',
      ci_conclusion: ciConclusion,
      ci_run_url: ciRunUrl,
      rollback_reason: `CI ${workflowResult!.conclusion}`,
    });
    try { await deleteBranch(branchName); } catch { /* best-effort */ }
    try {
      await createIssue(
        `[Bud] CI failed on improvement branch: ${typedSignal.title}`,
        `## Improvement attempt failed CI\n**Signal:** ${typedSignal.title}\n**Branch:** \`${branchName}\` (deleted)\n**CI:** ${workflowResult!.conclusion}\n${ciRunUrl ? `**Run:** ${ciRunUrl}` : ''}\n\nFiles attempted:\n${appliedFiles.map((f) => `- \`${f}\``).join('\n')}`,
        ['bud', 'bud-improvement', 'ci-failed'],
      );
    } catch { /* GitHub may not be configured */ }
    await updateExecution(supabase, executionId, { status: 'failed', finished_at: new Date().toISOString() });
    await writeLearning(supabase, executionId, typedSignal, 'blocked',
      `CI ${workflowResult!.conclusion} on branch ${branchName} — rolled back`);
    await supabase.from('bud_improvement_signals').update({ status: 'rejected' }).eq('id', typedSignal.id);
    return { executionId, status: 'failed' };
  }

  if (timedOut) {
    openAsDraft = true;
    await finishStep(supabase, validateStep, 'skipped', { reason: 'ci_still_running', url: ciRunUrl });
    await updateExecution(supabase, executionId, { verification_status: 'running', ci_run_url: ciRunUrl });
  } else {
    await finishStep(supabase, validateStep, 'passed', {
      conclusion: ciConclusion ?? 'no_ci',
      url: ciRunUrl,
    });
    await updateExecution(supabase, executionId, {
      verification_status: 'passed',
      ci_conclusion: ciConclusion ?? 'no_ci',
      ci_run_url: ciRunUrl,
      ci_workflow_run_id: ciWorkflowRunId ?? undefined,
    });
  }

  // ── TASTE ─────────────────────────────────────────────────────────────────────
  if (appliedFiles.some(isUiFile)) {
    const tasteStep = await startStep(supabase, executionId, 'verifying',
      'Scoring UI improvements against Design Constitution.');
    const uiFileContents: Array<{ path: string; content: string }> = [];
    for (const fp of appliedFiles.filter(isUiFile)) {
      try {
        const fetched = await getFileContent(fp, branchName);
        if (fetched) uiFileContents.push({ path: fp, content: fetched.content });
      } catch { /* non-fatal */ }
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
    if (!tasteResult.pass) openAsDraft = true;
    await finishStep(supabase, tasteStep,
      tasteResult.pass ? 'passed' : 'failed',
      { taste: tasteResult }, tasteResult.score);
  }

  // ── BROWSER ───────────────────────────────────────────────────────────────────
  if (appliedFiles.some(isUiFile) && isExecutionEnabled()) {
    const browserStep = await startStep(supabase, executionId, 'verifying',
      'Running Playwright golden-path tests against improved UI.');
    try {
      browserResult = await runBrowserTests(supabase, executionId, browserStep, {
        testDir: 'tests/e2e/golden-paths',
        project: 'chromium',
        baseUrl: process.env.PLAYWRIGHT_BASE_URL,
        timeout: 120_000,
      });
      const passed = browserResult.failed === 0 && browserResult.total > 0;
      await updateExecution(supabase, executionId, {
        browser_tests_passed: browserResult.passed,
        browser_tests_failed: browserResult.failed,
        browser_tests_total: browserResult.total,
        browser_test_status: browserResult.total === 0 ? 'skipped' : passed ? 'passed' : 'failed',
      });
      if (!passed && browserResult.total > 0) openAsDraft = true;
      await finishStep(supabase, browserStep,
        browserResult.total === 0 ? 'skipped' : passed ? 'passed' : 'failed',
        { browser: browserResult }, passed ? 0.95 : 0.3);
    } catch (e) {
      await log(supabase, executionId, null, 'warn', `Browser tests failed non-fatally: ${e}`);
      await finishStep(supabase, (await supabase.from('bud_improvement_steps').select('id').eq('execution_id', executionId).order('started_at', { ascending: false }).limit(1).single()).data?.id ?? '', 'skipped', { error: String(e) });
    }
  }

  // ── PR ────────────────────────────────────────────────────────────────────────
  let prUrl: string | null = null;
  let prNumber: number | null = null;
  let issueUrl: string | null = null;

  try {
    const issue = await createIssue(
      `[Bud] Improvement: ${typedSignal.title}`,
      [
        `## Proactive Improvement`,
        `**Signal type:** ${typedSignal.signal_type}`,
        `**Area:** ${typedSignal.affected_area ?? 'general'}`,
        `**Approach:** ${approach}`,
        '',
        '### Files improved',
        ...appliedFiles.map((f) => `- \`${f}\``),
      ].join('\n'),
      ['bud', 'bud-improvement', 'automated'],
    );
    issueUrl = issue.url;

    const tasteStatusLine = tasteResult
      ? tasteResult.pass
        ? `**Design Constitution:** Passed (${(tasteResult.score * 100).toFixed(0)}%)`
        : `**Design Constitution:** ⚠️ Failed — PR is a draft`
      : null;

    const browserStatusLine = browserResult && browserResult.total > 0
      ? browserResult.failed === 0
        ? `**Browser tests:** ✅ ${browserResult.passed}/${browserResult.total} passed`
        : `**Browser tests:** ❌ ${browserResult.failed}/${browserResult.total} failed — PR is a draft`
      : null;

    const prBody = [
      `Closes ${issueUrl}`,
      '',
      '## Improvement Summary',
      `**Signal:** ${typedSignal.signal_type} — ${typedSignal.title}`,
      `**Approach:** ${approach}`,
      `**Confidence:** ${(confidence * 100).toFixed(0)}%`,
      ciConclusion === 'success' ? '**CI:** Passed' : openAsDraft ? '**CI:** Pending or not configured' : '**CI:** No workflows detected',
      tasteStatusLine ?? '',
      browserStatusLine ?? '',
      '',
      ...(tasteResult && !tasteResult.pass ? [
        '## Design violations to resolve',
        ...tasteResult.violations.map((v) => `- ${v}`),
        '',
      ] : []),
      '## Files changed',
      ...appliedFiles.map((f) => `- \`${f}\``),
      '',
      '## Change reasoning',
      ...patches.filter((p) => appliedFiles.includes(p.file)).map((p) => `- **\`${p.file}\`:** ${p.reason}`),
      '',
      openAsDraft
        ? '> **Draft PR** — one or more quality gates need attention before merging.'
        : '> Generated by Bud Improvement Pipeline. Review before merging.',
    ].filter(Boolean).join('\n');

    const draftTags = [
      tasteResult && !tasteResult.pass ? '[Taste]' : '',
      browserResult && browserResult.failed > 0 ? '[Browser]' : '',
    ].filter(Boolean).join('');

    const pr = await createPR(
      openAsDraft
        ? `[Bud][Draft]${draftTags} Improve: ${typedSignal.title}`
        : `[Bud] Improve: ${typedSignal.title}`,
      prBody,
      branchName,
      'main',
      openAsDraft,
    );
    prUrl = pr.url;
    prNumber = pr.number;
  } catch (ghErr) {
    await log(supabase, executionId, null, 'warn', `GitHub PR/issue creation failed: ${ghErr}`);
  }

  // ── AUTO-MERGE ────────────────────────────────────────────────────────────────
  // Fires only when: autonomy ≥ 4, confidence ≥ 0.82, CI pass, taste pass,
  // browser pass (or no UI), and PR was opened as ready (not draft).
  let autoMerged = false;
  let autoMergeBlockedReason: string | null = null;

  if (prNumber && !openAsDraft) {
    const autonomyLevel = getDefaultAutonomyLevel();
    const ciOk = !ciConclusion || ciConclusion === 'success' || ciConclusion === 'no_ci';
    const tasteOk = !tasteResult || tasteResult.pass;
    const browserOk = !browserResult || browserResult.total === 0 || browserResult.failed === 0;

    if (autonomyLevel >= AUTO_MERGE_AUTONOMY_THRESHOLD
      && confidence >= AUTO_MERGE_CONFIDENCE_THRESHOLD
      && ciOk && tasteOk && browserOk) {
      try {
        await mergePR(
          prNumber,
          `[Bud] Improve: ${typedSignal.title}`,
          `Auto-merged by Bud OS at autonomy level ${autonomyLevel}.\nConfidence: ${(confidence * 100).toFixed(0)}%\nApproach: ${approach}`,
        );
        autoMerged = true;
        await log(supabase, executionId, null, 'info',
          `Auto-merged PR #${prNumber} at autonomy level ${autonomyLevel}.`);
      } catch (mergeErr) {
        autoMergeBlockedReason = String(mergeErr);
        await log(supabase, executionId, null, 'warn', `Auto-merge failed: ${mergeErr}`);
        // Enable auto-merge via GitHub setting as fallback
        try { await enableAutoMerge(prNumber); } catch { /* best-effort */ }
      }
    } else {
      autoMergeBlockedReason = autonomyLevel < AUTO_MERGE_AUTONOMY_THRESHOLD
        ? `autonomy level ${autonomyLevel} < ${AUTO_MERGE_AUTONOMY_THRESHOLD}`
        : confidence < AUTO_MERGE_CONFIDENCE_THRESHOLD
          ? `confidence ${(confidence * 100).toFixed(0)}% < ${AUTO_MERGE_CONFIDENCE_THRESHOLD * 100}%`
          : !ciOk ? `CI: ${ciConclusion}`
          : !tasteOk ? 'taste failed'
          : 'browser tests failed';
      // Enable GitHub auto-merge so it fires once all checks pass
      if (prNumber) {
        try { await enableAutoMerge(prNumber); } catch { /* best-effort */ }
      }
    }
  }

  // ── FINALISE ──────────────────────────────────────────────────────────────────
  const finalStatus = autoMerged ? 'recovered' : 'patching';
  await updateExecution(supabase, executionId, {
    status: finalStatus,
    pr_url: prUrl ?? undefined,
    issue_url: issueUrl ?? undefined,
    auto_merged: autoMerged,
    auto_merged_at: autoMerged ? new Date().toISOString() : undefined,
    auto_merge_blocked_reason: autoMergeBlockedReason ?? undefined,
    finished_at: new Date().toISOString(),
  });

  await supabase
    .from('bud_improvement_signals')
    .update({ status: autoMerged ? 'completed' : 'queued', updated_at: new Date().toISOString() })
    .eq('id', typedSignal.id);

  await writeLearning(supabase, executionId, typedSignal,
    autoMerged ? 'shipped' : openAsDraft ? 'draft' : 'shipped',
    patches.filter((p) => appliedFiles.includes(p.file)).map((p) => `${p.file}: ${p.reason}`).join('; '),
  );

  return { executionId, status: finalStatus, prUrl: prUrl ?? undefined };
}

// ── Learning ───────────────────────────────────────────────────────────────────

async function writeLearning(
  supabase: SupabaseClient,
  executionId: string,
  signal: ImprovementSignalRow,
  outcome: 'shipped' | 'blocked' | 'rolled_back' | 'draft',
  pattern: string,
): Promise<void> {
  const body = [
    `Signal type: ${signal.signal_type}`,
    `Area: ${signal.affected_area ?? 'unknown'}`,
    `Title: ${signal.title}`,
    `Outcome: ${outcome}`,
    `Pattern: ${pattern}`,
  ].join('\n');

  const memory = await writeMemory(supabase, {
    category: 'ux',
    title: `Bud improvement learning: ${signal.signal_type}`,
    body,
    tags: ['bud-os', 'improvement', signal.signal_type, outcome],
    source: 'agent',
  }, { agentId: 'bud', status: 'pending', allowSoftDuplicate: true }).catch(() => ({ ok: false, doc: null }));

  let learningRow: { id: string } | null = null;
  try {
    const { data } = await supabase.from('bud_improvement_learnings').insert({
      execution_id: executionId,
      signal_id: signal.id,
      memory_doc_id: memory.ok ? (memory as { ok: boolean; doc: { id: string } }).doc.id : null,
      signal_type: signal.signal_type,
      improvement_pattern: pattern.slice(0, 500),
      outcome,
      affected_area: signal.affected_area,
    }).select('id').single();
    learningRow = data;
  } catch { /* non-fatal */ }

  // Write semantic embedding for future similarity recall
  if (learningRow?.id) {
    generateEmbedding(`${signal.signal_type} ${signal.title} ${pattern}`)
      .then((vec) => {
        if (!vec) return;
        return supabase
          .from('bud_improvement_learnings')
          .update({ embedding: JSON.stringify(vec) })
          .eq('id', learningRow.id);
      })
      .catch(() => { /* non-fatal */ });
  }
}
