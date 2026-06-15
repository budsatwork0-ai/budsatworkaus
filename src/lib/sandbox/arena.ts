/**
 * Sandbox Arena
 *
 * Wraps `runAgent()` with a sandbox interceptor so that:
 *   1. All `proposeAction` calls are captured but NEVER dispatched to
 *      resend, Stripe, Twilio, or any other side-effect system.
 *   2. All DB writes are tagged `environment = 'sandbox'` so they never
 *      surface in production dashboard views.
 *   3. Scoring is computed after the run and written to sandbox_decision_scores.
 *   4. A leaderboard query aggregates f1 scores per agent across all runs.
 *
 * No production code is modified. This file is the only entry point for
 * arena-mode execution.
 */

import { createClient } from '@supabase/supabase-js';
import type { AgentContext, ProposedAction } from '@/lib/agents/types';
import { AGENT_REGISTRY } from '@/lib/agents/registry';
import { buildMemoryContext } from '@/lib/memory/context';
import { getDefaultAutonomyLevel } from '@/lib/bud/autonomy';
import type { SandboxScenarioTemplate } from './scenarios';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const DEFAULT_MODEL = process.env.AGENT_DEFAULT_MODEL ?? 'claude-sonnet-4-6';

// Hard cap for sandbox runs — shorter than production to keep costs low.
const SANDBOX_TIMEOUT_MS = 60_000;
const SANDBOX_MAX_LLM_ATTEMPTS = 2;

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

// ── Rough per-million-token pricing (USD cents) ────────────────────────────
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
};

// ── Minimal LLM call (no circuit breaker, no workspace logging) ────────────
async function sandboxCallModel(
  prompt: string,
  opts: { model?: string; system?: string } = {},
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const model = opts.model ?? DEFAULT_MODEL;
  const systemBlock = opts.system
    ? [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }]
    : undefined;

  let attempt = 0;
  let lastErr: Error | null = null;

  while (attempt < SANDBOX_MAX_LLM_ATTEMPTS) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: systemBlock,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (res.ok) {
      const json = (await res.json()) as {
        content: Array<{ type: string; text?: string }>;
        usage: { input_tokens: number; output_tokens: number };
      };
      const text = json.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('\n');
      return { text, inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens };
    }

    const body = await res.text();
    lastErr = new Error(`Anthropic API ${res.status}: ${body}`);
    attempt += 1;
    if (attempt < SANDBOX_MAX_LLM_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  throw lastErr ?? new Error('sandboxCallModel: exhausted retries');
}

// ── Scoring ────────────────────────────────────────────────────────────────

function scoreResponse(
  proposedActionTypes: string[],
  expectedActionTypes: string[],
): { precisionScore: number; recallScore: number; f1Score: number; hit: boolean } {
  if (expectedActionTypes.length === 0) {
    return { precisionScore: 1, recallScore: 1, f1Score: 1, hit: true };
  }

  const expectedSet = new Set(expectedActionTypes);
  const hits = proposedActionTypes.filter((t) => expectedSet.has(t)).length;

  const precisionScore =
    proposedActionTypes.length === 0 ? 0 : hits / proposedActionTypes.length;
  const recallScore = hits / expectedActionTypes.length;
  const f1Score =
    precisionScore + recallScore === 0
      ? 0
      : (2 * precisionScore * recallScore) / (precisionScore + recallScore);

  return {
    precisionScore: Math.round(precisionScore * 10000) / 10000,
    recallScore: Math.round(recallScore * 10000) / 10000,
    f1Score: Math.round(f1Score * 10000) / 10000,
    hit: hits > 0,
  };
}

// ── Public types ───────────────────────────────────────────────────────────

export interface ArenaRunResult {
  trainingRunId: string;
  agentRunId: string | null;
  status: 'complete' | 'failed';
  summary: string;
  proposedActions: ProposedAction[];
  llmCalls: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  score: {
    precisionScore: number;
    recallScore: number;
    f1Score: number;
    hit: boolean;
  };
  durationMs: number;
}

export interface ArenaPackResult {
  scenarioSlug: string;
  result: ArenaRunResult;
}

export interface ArenaLeaderboardRow {
  agentId: string;
  scenarioCount: number;
  avgF1: number;
  avgPrecision: number;
  avgRecall: number;
  hitRate: number;
  totalCostCents: number;
}

// ── Core run ───────────────────────────────────────────────────────────────

/**
 * Executes a single sandbox scenario against its configured agent.
 * The sandbox interceptor:
 *   - captures all proposed actions without executing them
 *   - never calls resend.emails.send, stripe.*, or any Twilio endpoint
 *   - tags all DB writes with environment='sandbox'
 */
export async function runSandboxScenario(
  scenario: SandboxScenarioTemplate,
  opts: { triggeredBy?: string; batchId?: string; trigger?: 'manual' | 'cron' | 'eval' } = {},
): Promise<ArenaRunResult> {
  const supabase = adminClient();
  const startedAt = Date.now();

  // Resolve scenario DB id (needed for FK references).
  const { data: scenarioRow } = await supabase
    .from('sandbox_scenarios')
    .select('id')
    .eq('slug', scenario.slug)
    .maybeSingle();
  const scenarioDbId: string | null = scenarioRow?.id ?? null;

  const def = AGENT_REGISTRY[scenario.agentId];
  if (!def) {
    return {
      trainingRunId: '',
      agentRunId: null,
      status: 'failed',
      summary: `Agent not found in registry: ${scenario.agentId}`,
      proposedActions: [],
      llmCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0,
      score: { precisionScore: 0, recallScore: 0, f1Score: 0, hit: false },
      durationMs: Date.now() - startedAt,
    };
  }

  // Create training run row.
  const { data: trainingRun, error: trErr } = await supabase
    .from('sandbox_training_runs')
    .insert({
      scenario_id: scenarioDbId,
      triggered_by: opts.triggeredBy ?? null,
      trigger: opts.trigger ?? 'manual',
      status: 'running',
      environment: 'sandbox',
      batch_id: opts.batchId ?? null,
    })
    .select('id')
    .single();

  if (trErr || !trainingRun) {
    throw new Error(`Failed to create training run: ${trErr?.message}`);
  }
  const trainingRunId: string = trainingRun.id;

  // Interceptor state.
  const capturedActions: ProposedAction[] = [];
  let llmCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let costCents = 0;
  const logs: string[] = [];

  // Build the sandboxed AgentContext — proposeAction logs but never dispatches.
  const ctx: AgentContext = {
    runId: trainingRunId,
    agentId: scenario.agentId,
    trigger: 'manual',
    dryRun: false, // we want the agent to produce real output
    input: scenario.input,
    config: {},
    intent: `Sandbox: ${scenario.title}`,
    depth: 1,
    supabase,
    memory: buildMemoryContext({ supabase, agentId: scenario.agentId, runId: trainingRunId }),

    // SANDBOX INTERCEPTOR — captures actions, never dispatches them.
    proposeAction: async (action: ProposedAction) => {
      logs.push(`[sandbox] captured action: ${action.action_type} — ${action.preview}`);
      capturedActions.push(action);
      // No executeApprovedAction call. No DB mutation. No email. No Stripe.
    },

    llm: async (prompt, llmOpts = {}) => {
      llmCalls += 1;
      const out = await sandboxCallModel(prompt, {
        model: llmOpts.model ?? (def as typeof def).preferredModel ?? DEFAULT_MODEL,
        system: llmOpts.system,
      });
      inputTokens += out.inputTokens;
      outputTokens += out.outputTokens;
      const model = llmOpts.model ?? (def as typeof def).preferredModel ?? DEFAULT_MODEL;
      const pricing = PRICING_PER_MTOK[model] ?? { input: 3, output: 15 };
      costCents += Math.round(
        ((out.inputTokens / 1_000_000) * pricing.input +
          (out.outputTokens / 1_000_000) * pricing.output) * 100,
      );
      return out.text;
    },

    callAgent: async (childAgentId, childInput, childIntent) => {
      logs.push(`[sandbox] callAgent intercepted: ${childAgentId} (not executed in sandbox)`);
      // Nested agent calls are stubbed out in the sandbox to prevent cascading
      // cost and unintended side effects. Return a plausible no-op result.
      return {
        runId: trainingRunId,
        status: 'succeeded' as const,
        summary: `[sandbox stub] ${childAgentId}: ${childIntent}`,
      };
    },

    log: (msg, data) => {
      logs.push(data ? `${msg} ${JSON.stringify(data)}` : msg);
    },
  };

  let summary = '';
  let runStatus: 'complete' | 'failed' = 'complete';
  let agentRunId: string | null = null;

  try {
    const result = await Promise.race([
      (def as typeof def).run(ctx),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Sandbox run exceeded ${SANDBOX_TIMEOUT_MS / 1000}s timeout`)),
          SANDBOX_TIMEOUT_MS,
        ),
      ),
    ]);
    summary = result.summary;
  } catch (err) {
    summary = err instanceof Error ? err.message : String(err);
    runStatus = 'failed';
  }

  const durationMs = Date.now() - startedAt;

  // Write the agent response row.
  const proposedActionTypes = capturedActions.map((a) => a.action_type);
  const score = scoreResponse(proposedActionTypes, scenario.expectedActionTypes);

  const { data: responseRow } = await supabase
    .from('sandbox_agent_responses')
    .insert({
      training_run_id: trainingRunId,
      scenario_id: scenarioDbId,
      agent_id: scenario.agentId,
      summary,
      output: { logs },
      proposed_actions: capturedActions,
      llm_calls: llmCalls,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_cents: costCents,
      environment: 'sandbox',
    })
    .select('id')
    .single();

  if (responseRow) {
    agentRunId = responseRow.id;

    // Write decision score.
    if (scenarioDbId) {
      await supabase.from('sandbox_decision_scores').insert({
        response_id: responseRow.id,
        scenario_id: scenarioDbId,
        agent_id: scenario.agentId,
        precision_score: score.precisionScore,
        recall_score: score.recallScore,
        f1_score: score.f1Score,
        hit: score.hit,
        notes: `Expected: [${scenario.expectedActionTypes.join(', ')}]. Got: [${proposedActionTypes.join(', ')}].`,
        environment: 'sandbox',
      });
    }

    // If score is poor (f1 < 0.5), auto-generate a lesson.
    if (score.f1Score < 0.5 && scenarioDbId) {
      await supabase.from('sandbox_lessons_learned').insert({
        agent_id: scenario.agentId,
        scenario_id: scenarioDbId,
        title: `Low F1 on "${scenario.title}"`,
        observation: `Agent proposed [${proposedActionTypes.join(', ') || 'nothing'}] but expected [${scenario.expectedActionTypes.join(', ')}]. F1=${score.f1Score}.`,
        recommendation: score.hit
          ? 'Agent hit the right action type but also proposed unexpected actions (low precision). Review agent prompt to reduce false positives.'
          : 'Agent missed the expected action type entirely. Review agent system prompt and scenario input for coverage gaps.',
        severity: score.f1Score === 0 ? 'critical' : 'warning',
        source: 'auto',
        environment: 'sandbox',
      });
    }
  }

  // Settle the training run row.
  await supabase
    .from('sandbox_training_runs')
    .update({
      status: runStatus,
      agent_run_id: agentRunId,
      duration_ms: durationMs,
      cost_cents: costCents,
      finished_at: new Date().toISOString(),
    })
    .eq('id', trainingRunId);

  return {
    trainingRunId,
    agentRunId,
    status: runStatus,
    summary,
    proposedActions: capturedActions,
    llmCalls,
    inputTokens,
    outputTokens,
    costCents,
    score,
    durationMs,
  };
}

/**
 * Run a pack of scenarios. Executes them sequentially to keep LLM costs
 * predictable and avoids rate-limit contention.
 */
export async function runSandboxPack(
  scenarios: SandboxScenarioTemplate[],
  opts: { triggeredBy?: string } = {},
): Promise<ArenaPackResult[]> {
  const results: ArenaPackResult[] = [];
  for (const scenario of scenarios) {
    const result = await runSandboxScenario(scenario, opts);
    results.push({ scenarioSlug: scenario.slug, result });
  }
  return results;
}

/**
 * Replay the scenario that was run in a given training_run_id by re-executing
 * it fresh. Useful for comparing before/after an agent prompt change.
 */
export async function replaySandboxRun(
  trainingRunId: string,
  scenarios: SandboxScenarioTemplate[],
  opts: { triggeredBy?: string } = {},
): Promise<ArenaRunResult> {
  const supabase = adminClient();
  const { data: runRow } = await supabase
    .from('sandbox_training_runs')
    .select('scenario_id')
    .eq('id', trainingRunId)
    .single();

  if (!runRow?.scenario_id) {
    throw new Error(`Training run ${trainingRunId} not found or has no scenario_id`);
  }

  const { data: scenarioRow } = await supabase
    .from('sandbox_scenarios')
    .select('slug')
    .eq('id', runRow.scenario_id)
    .single();

  if (!scenarioRow?.slug) {
    throw new Error(`Scenario for run ${trainingRunId} not found`);
  }

  const template = scenarios.find((s) => s.slug === scenarioRow.slug);
  if (!template) {
    throw new Error(`No template found for slug: ${scenarioRow.slug}`);
  }

  return runSandboxScenario(template, opts);
}

/**
 * Build a leaderboard by aggregating sandbox_decision_scores per agent.
 * Returns agents sorted by avg F1 descending.
 */
export async function getSandboxLeaderboard(): Promise<ArenaLeaderboardRow[]> {
  const supabase = adminClient();

  const { data, error } = await supabase
    .from('sandbox_decision_scores')
    .select('agent_id, f1_score, precision_score, recall_score, hit, cost_cents:sandbox_agent_responses(cost_cents)')
    .eq('environment', 'sandbox');

  if (error) throw new Error(`Leaderboard query failed: ${error.message}`);
  if (!data) return [];

  // Aggregate manually (no GROUP BY in the JS client without RPC).
  const byAgent = new Map<
    string,
    { f1s: number[]; precisions: number[]; recalls: number[]; hits: number; costs: number }
  >();

  for (const row of data as Array<{
    agent_id: string;
    f1_score: number;
    precision_score: number;
    recall_score: number;
    hit: boolean;
    cost_cents: Array<{ cost_cents: number }> | null;
  }>) {
    if (!byAgent.has(row.agent_id)) {
      byAgent.set(row.agent_id, { f1s: [], precisions: [], recalls: [], hits: 0, costs: 0 });
    }
    const entry = byAgent.get(row.agent_id)!;
    entry.f1s.push(Number(row.f1_score));
    entry.precisions.push(Number(row.precision_score));
    entry.recalls.push(Number(row.recall_score));
    if (row.hit) entry.hits += 1;
    // cost_cents is joined as a single object (many-to-one FK) or array — handle both
    const costRaw = row.cost_cents;
    const cost = Array.isArray(costRaw)
      ? Number((costRaw[0] as { cost_cents: number })?.cost_cents ?? 0)
      : Number((costRaw as { cost_cents: number } | null)?.cost_cents ?? 0);
    entry.costs += Number(cost ?? 0);
  }

  const leaderboard: ArenaLeaderboardRow[] = [];
  for (const [agentId, entry] of byAgent) {
    const n = entry.f1s.length;
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    leaderboard.push({
      agentId,
      scenarioCount: n,
      avgF1: Math.round(avg(entry.f1s) * 10000) / 10000,
      avgPrecision: Math.round(avg(entry.precisions) * 10000) / 10000,
      avgRecall: Math.round(avg(entry.recalls) * 10000) / 10000,
      hitRate: Math.round((entry.hits / n) * 10000) / 10000,
      totalCostCents: entry.costs,
    });
  }

  return leaderboard.sort((a, b) => b.avgF1 - a.avgF1);
}

/**
 * Return the most recent lessons learned, optionally filtered by agent.
 */
export async function getSandboxLessons(
  opts: { agentId?: string; limit?: number } = {},
): Promise<Array<{
  id: string;
  agentId: string;
  title: string;
  observation: string;
  recommendation: string | null;
  severity: string;
  source: string;
  createdAt: string;
}>> {
  const supabase = adminClient();

  let query = supabase
    .from('sandbox_lessons_learned')
    .select('id, agent_id, title, observation, recommendation, severity, source, created_at')
    .eq('environment', 'sandbox')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 50);

  if (opts.agentId) {
    query = query.eq('agent_id', opts.agentId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Lessons query failed: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    title: row.title,
    observation: row.observation,
    recommendation: row.recommendation ?? null,
    severity: row.severity,
    source: row.source,
    createdAt: row.created_at,
  }));
}

/**
 * Readiness score: percentage of scenarios (across all categories) where the
 * most recent run achieved f1 >= 0.5. Used by the UI to show fleet readiness.
 */
export async function getSandboxReadiness(): Promise<{
  overallReadiness: number;
  byCategory: Record<string, { ready: number; total: number }>;
  totalScenarios: number;
  readyScenarios: number;
}> {
  const supabase = adminClient();

  // Get most recent score per scenario.
  // 500 rows is generous for ~40 scenarios; keeps payload bounded.
  const { data: scores, error: scoresErr } = await supabase
    .from('sandbox_decision_scores')
    .select('scenario_id, agent_id, f1_score, scored_at')
    .eq('environment', 'sandbox')
    .order('scored_at', { ascending: false })
    .limit(500);

  if (scoresErr) throw new Error(`Readiness query failed: ${scoresErr.message}`);

  // Get scenario categories.
  const { data: scenarios } = await supabase
    .from('sandbox_scenarios')
    .select('id, category')
    .eq('environment', 'sandbox');

  const categoryByScenario = new Map<string, string>();
  for (const s of scenarios ?? []) {
    categoryByScenario.set(s.id, s.category);
  }

  // Deduplicate: keep only the latest score per scenario.
  const latestByScenario = new Map<string, number>();
  for (const row of scores ?? []) {
    if (!latestByScenario.has(row.scenario_id)) {
      latestByScenario.set(row.scenario_id, Number(row.f1_score));
    }
  }

  const byCategory: Record<string, { ready: number; total: number }> = {};
  let readyScenarios = 0;

  for (const [scenarioId, f1] of latestByScenario) {
    const category = categoryByScenario.get(scenarioId) ?? 'unknown';
    if (!byCategory[category]) byCategory[category] = { ready: 0, total: 0 };
    byCategory[category].total += 1;
    if (f1 >= 0.5) {
      byCategory[category].ready += 1;
      readyScenarios += 1;
    }
  }

  const totalScenarios = latestByScenario.size;
  const overallReadiness =
    totalScenarios === 0
      ? 0
      : Math.round((readyScenarios / totalScenarios) * 100);

  return { overallReadiness, byCategory, totalScenarios, readyScenarios };
}
