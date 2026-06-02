/**
 * Agent runtime: load an agent definition, set up its context,
 * call its `run` function, capture results, persist tokens/cost,
 * and respect its autonomy level when handling proposed actions.
 *
 * This is intentionally model-agnostic — swap `callModel` to whichever
 * provider you prefer. Defaults to Anthropic's Messages API.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { AGENT_REGISTRY } from './registry';
import { AgentOutputSchema } from '@/lib/bud/schemas';
import type {
  AgentContext,
  AgentDefinition,
  AgentRunStatus,
  ProposedAction,
} from './types';
import { buildMemoryContext } from '@/lib/memory/context';
import { getDefaultAutonomyLevel, requiresApproval as budRequiresApproval } from '@/lib/bud/autonomy';
import { logAgentRun, getWorkspaceForAgent } from '@/lib/memory/agents/workspace';
import {
  GuardrailBlockedError,
  PolicyRunner,
  stableHash,
  type LineageEntry,
  type PolicyContext,
} from './guardrails';
import {
  CircuitOpenError,
  getCircuitState,
  recordLlmSuccess,
  recordLlmFailure,
} from './resilience';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const DEFAULT_MODEL = process.env.AGENT_DEFAULT_MODEL ?? 'claude-sonnet-4-6';

// Hard cap on how long any single agent run is allowed to take. After this,
// the run is marked failed and `runAgent` returns. The agent's own promise
// keeps executing (we can't actually cancel JS), so this is mostly to make
// the dashboard accurate and prevent rows being stuck in 'running' forever.
// Keep this <= the platform's serverless function maxDuration.
const RUN_TIMEOUT_MS = Number(process.env.AGENT_RUN_TIMEOUT_MS ?? 5 * 60 * 1000);

// How aggressively we retry transient Anthropic errors (429 / 529 / 503).
// 4 attempts with exponential backoff = up to ~15s of waiting before giving
// up, which is comfortably less than typical Anthropic overload windows.
const MAX_LLM_ATTEMPTS = 4;

// Rough per-million-token pricing (USD). Update as your contract changes.
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
};

function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

interface CallModelResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

async function callGemini(
  prompt: string,
  opts: { model?: string; system?: string } = {},
): Promise<CallModelResult> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const modelName = opts.model && opts.model.startsWith('gemini') ? opts.model : 'gemini-2.5-flash';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.2
    }
  };

  if (opts.system) {
    requestBody.systemInstruction = {
      parts: [{ text: opts.system }]
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errText}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };

  const candidate = json.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text ?? '';

  const inputTokens = json.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0;

  return {
    text,
    inputTokens,
    outputTokens,
    cacheReadTokens: 0,
    cacheCreationTokens: 0
  };
}

async function callModel(
  prompt: string,
  opts: { model?: string; system?: string } = {},
): Promise<CallModelResult> {
  const model = opts.model ?? DEFAULT_MODEL;

  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const isGeminiModel = model.startsWith('gemini');

  if (isGeminiModel && hasGeminiKey) {
    return callGemini(prompt, opts);
  }

  // Gate on circuit breaker before the first attempt for Anthropic.
  let circuitActive = false;
  try {
    const { state: circuitState, resetsAt } = await getCircuitState();
    if (circuitState === 'open') {
      if (hasGeminiKey) {
        console.warn('Anthropic circuit open. Falling back to Gemini.');
        return callGemini(prompt, opts);
      }
      throw new CircuitOpenError(resetsAt);
    }
    circuitActive = true;
  } catch (err) {
    if (!circuitActive && hasGeminiKey) {
      return callGemini(prompt, opts);
    }
    throw err;
  }

  // Wrap the system prompt in a cache_control block so Anthropic can reuse
  // it across runs of the same agent.
  const systemBlock = opts.system
    ? [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }]
    : undefined;

  let attempt = 0;
  let lastErr: Error | null = null;

  while (attempt < MAX_LLM_ATTEMPTS) {
    try {
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
          max_tokens: 2048,
          system: systemBlock,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          content: Array<{ type: string; text?: string }>;
          usage: {
            input_tokens: number;
            output_tokens: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
          };
        };

        const text = json.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text ?? '')
          .join('\n');

        // Record success so half_open circuits can close after 2 good probes
        recordLlmSuccess().catch(() => {});

        return {
          text,
          inputTokens: json.usage.input_tokens,
          outputTokens: json.usage.output_tokens,
          cacheReadTokens: json.usage.cache_read_input_tokens ?? 0,
          cacheCreationTokens: json.usage.cache_creation_input_tokens ?? 0,
        };
      }

      const body = await res.text();
      lastErr = new Error(`Anthropic API ${res.status}: ${body}`);

      // Retry only on transient errors.
      const transient = res.status === 429 || res.status === 529 || res.status === 503;
      if (!transient) {
        if (hasGeminiKey) {
          console.warn('Anthropic API failed with non-transient error. Falling back to Gemini:', lastErr);
          return callGemini(prompt, opts);
        }
        throw lastErr;
      }

      // Record each transient failure so the circuit tracks the streak.
      await recordLlmFailure();

      attempt += 1;
      if (attempt >= MAX_LLM_ATTEMPTS) break;

      const retryAfter = Number(res.headers.get('retry-after'));
      const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 1000 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    } catch (err) {
      if (hasGeminiKey) {
        console.warn('Anthropic API fetch failed. Falling back to Gemini:', err);
        return callGemini(prompt, opts);
      }
      throw err;
    }
  }

  if (hasGeminiKey) {
    console.warn('Anthropic API exhausted retries. Falling back to Gemini.');
    return callGemini(prompt, opts);
  }

  throw lastErr ?? new Error('Anthropic API: exhausted retries with no response');
}

export interface RunAgentArgs {
  agentId: string;
  trigger: 'cron' | 'manual' | 'webhook' | 'event';
  input?: Record<string, unknown>;
  triggeredBy?: string; // auth user id
  /**
   * What this run is meant to accomplish. Guardrails use this for
   * drift + completion checks. If omitted, falls back to a generic
   * "Run agent <id>" and the drift/completion policies degrade to warn.
   */
  intent?: string;
  /**
   * Lineage carried over from a parent run when invoked via
   * `ctx.callAgent`. Top-level callers leave this undefined.
   */
  lineage?: LineageEntry[];
  /** Cents already spent in the parent lineage. Internal use only. */
  parentCumulativeCostCents?: number;
}

export interface RunAgentResult {
  runId: string;
  status: AgentRunStatus | 'succeeded' | 'failed' | 'needs_approval';
  summary: string;
}

/**
 * Public entry point. Persists a run row, executes the agent, then
 * settles status + cost.
 */
export async function runAgent(args: RunAgentArgs): Promise<RunAgentResult> {
  const def = AGENT_REGISTRY[args.agentId];
  if (!def) throw new Error(`Unknown agent: ${args.agentId}`);

  const supabase = adminClient();

  const { data: agentRow, error: agentErr } = await supabase
    .from('agents')
    .select('id, status, autonomy, config')
    .eq('id', args.agentId)
    .single();

  if (agentErr || !agentRow) {
    throw new Error(`Agent ${args.agentId} not found in DB: ${agentErr?.message}`);
  }
  if (!['enabled', 'idle', 'watch'].includes(agentRow.status as string)) {
    throw new Error(`Agent ${args.agentId} is ${agentRow.status}`);
  }

  const startedAt = Date.now();

  const { data: run, error: runErr } = await supabase
    .from('agent_runs')
    .insert({
      agent_id: args.agentId,
      trigger: args.trigger,
      triggered_by: args.triggeredBy ?? null,
      status: 'running',
      input: args.input ?? {},
      model: (def as AgentDefinition).preferredModel ?? DEFAULT_MODEL,
    })
    .select('id')
    .single();

  if (runErr || !run) throw new Error(`Failed to create run: ${runErr?.message}`);
  const runId: string = run.id;

  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;
  let llmModel = (def as AgentDefinition).preferredModel ?? DEFAULT_MODEL;
  let runCostCents = 0;
  let cumulativeCostCents = args.parentCumulativeCostCents ?? 0;
  let needsApproval = false;
  const logs: string[] = [];

  // --- guardrail wiring ---
  const agentConfig = (agentRow.config as Record<string, unknown>) ?? {};
  const policiesCfg =
    (agentConfig.policies as Record<string, unknown> | undefined) ?? {};
  const disabledPolicies = Array.isArray(policiesCfg.disabled)
    ? (policiesCfg.disabled as string[])
    : [];

  const intent =
    args.intent?.trim() ||
    `Run agent ${args.agentId} (trigger=${args.trigger})`;

  // Build the lineage entry for this run. Parent (if any) is already
  // included in args.lineage; we append ourselves so children we spawn
  // see the full chain.
  const parentLineage = args.lineage ?? [];
  const selfLineageEntry: LineageEntry = {
    runId,
    agentId: args.agentId,
    inputHash: stableHash({ agentId: args.agentId, input: args.input ?? {} }),
    intent,
    costCents: 0, // updated on each LLM call
  };
  const lineage: LineageEntry[] = [...parentLineage, selfLineageEntry];

  function pctx(): PolicyContext {
    // Keep the lineage entry's costCents in sync so policies reading the
    // lineage see live per-level totals.
    selfLineageEntry.costCents = runCostCents;
    return {
      agentId: args.agentId,
      runId,
      lineage,
      intent,
      cumulativeCostCents,
      runCostCents,
      supabase,
      config: (policiesCfg.config as Record<string, unknown>) ?? policiesCfg,
    };
  }

  const policies = new PolicyRunner({ disabled: disabledPolicies });
  logs.push(
    `[guardrails] active policies: ${policies.activeIds().join(', ') || '(none)'}`,
  );

  const ctx: AgentContext = {
    runId,
    agentId: args.agentId,
    trigger: args.trigger,
    input: args.input ?? {},
    config: agentConfig,
    intent,
    depth: lineage.length,
    supabase,
    memory: buildMemoryContext({ supabase, agentId: args.agentId, runId }),

    proposeAction: async (action: ProposedAction) => {
      // Guardrails get the first look. A `block` with
      // treatAsApprovalNeeded gets demoted to "force-review" rather than
      // failing the run.
      try {
        const checked = await policies.preAction({ action }, pctx());
        action = checked.action;
      } catch (err) {
        if (
          err instanceof GuardrailBlockedError &&
          err.treatAsApprovalNeeded
        ) {
          action = { ...action, requiresApproval: true };
          logs.push(
            `[guardrails:${err.policyId}] forced review on action ${action.action_type}: ${err.message}`,
          );
        } else {
          throw err;
        }
      }

      // An action is auto-approved when BOTH conditions hold:
      // 1. The agent's own autonomy is 'auto' (not 'review' or 'manual')
      // 2. The Bud OS autonomy level permits it — levels 0–1 always require
      //    approval; levels 2–5 gate on action confidence and risk_level.
      const budLevel = getDefaultAutonomyLevel();
      const actionConf = action.confidence ?? 0.7;
      const actionRisk = action.risk_level ?? 'medium';
      const agentAutoOk = agentRow.autonomy === 'auto';
      const budAutoOk = !budRequiresApproval(budLevel, actionConf, actionRisk, action.action_type);
      const autoOk = agentAutoOk && budAutoOk && action.requiresApproval !== true;
      const requires = !autoOk;
      if (requires) needsApproval = true;

      await supabase.from('agent_actions').insert({
        run_id: runId,
        agent_id: args.agentId,
        action_type: action.action_type,
        target_table: action.target_table ?? null,
        target_id: action.target_id ?? null,
        payload: action.payload,
        preview: action.preview,
        requires_approval: requires,
        status: requires ? 'pending' : 'approved',
      });
    },

    llm: async (prompt, opts = {}) => {
      const pre = await policies.preLLM(
        { prompt, system: opts.system, model: opts.model },
        pctx(),
      );
      // Prefer: explicit opts.model > guardrail override > agent definition model > env default
      llmModel = pre.model ?? opts.model ?? (def as AgentDefinition).preferredModel ?? DEFAULT_MODEL;
      const out = await callModel(pre.prompt, {
        model: llmModel,
        system: pre.system,
      });
      inputTokens += out.inputTokens;
      outputTokens += out.outputTokens;
      cacheReadTokens += out.cacheReadTokens;
      cacheCreationTokens += out.cacheCreationTokens;
      const pricing = PRICING_PER_MTOK[llmModel] ?? { input: 0, output: 0 };
      // Cache reads cost ~10% of input price; creation costs ~125% (first write only).
      const callCostCents = Math.round(
        ((out.inputTokens / 1_000_000) * pricing.input +
          (out.outputTokens / 1_000_000) * pricing.output +
          (out.cacheReadTokens / 1_000_000) * pricing.input * 0.1 +
          (out.cacheCreationTokens / 1_000_000) * pricing.input * 1.25) *
          100,
      );
      runCostCents += callCostCents;
      cumulativeCostCents += callCostCents;
      await policies.postLLM(
        {
          prompt: pre.prompt,
          system: pre.system,
          model: llmModel,
          response: out.text,
          inputTokens: out.inputTokens,
          outputTokens: out.outputTokens,
        },
        pctx(),
      );
      return out.text;
    },

    callAgent: async (childAgentId, childInput, childIntent) => {
      // Guardrail check first — depth, loop, drift.
      await policies.preAgentCall(
        { childAgentId, childInput, childIntent },
        pctx(),
      );
      const childResult = await runAgent({
        agentId: childAgentId,
        trigger: 'event',
        input: childInput,
        intent: childIntent,
        triggeredBy: args.triggeredBy,
        lineage,
        parentCumulativeCostCents: cumulativeCostCents,
      });
      // The child's spend is already reflected because it inserts its
      // own runs row; we approximate the lineage delta by re-reading the
      // child's cost_cents. Cheaper than wiring a return value all the
      // way through.
      const { data: childRow } = await supabase
        .from('agent_runs')
        .select('cost_cents')
        .eq('id', childResult.runId)
        .single();
      if (childRow?.cost_cents) {
        cumulativeCostCents += childRow.cost_cents as number;
      }
      return childResult;
    },

    log: (msg, data) => {
      logs.push(data ? `${msg} ${JSON.stringify(data)}` : msg);
    },
  };

  try {
    const result = await Promise.race([
      (def as AgentDefinition).run(ctx),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Agent run exceeded ${Math.round(RUN_TIMEOUT_MS / 1000)}s timeout`,
              ),
            ),
          RUN_TIMEOUT_MS,
        ),
      ),
    ]);
    const durationMs = Date.now() - startedAt;
    const pricing = PRICING_PER_MTOK[llmModel] ?? { input: 0, output: 0 };
    const costCents = Math.round(
      ((inputTokens / 1_000_000) * pricing.input +
        (outputTokens / 1_000_000) * pricing.output) *
        100,
    );

    // Post-run guardrail: intent-completion (and anything else hooked
    // into postAgentRun). Non-throwing — warnings land in logs.
    await policies.postAgentRun(
      { summary: result.summary, output: result.output ?? {} },
      pctx(),
    );

    // Normalise output to Bud's structured schema. Agents that predate the
    // schema (or don't set all fields) get their raw payload preserved in
    // raw_output so nothing is lost, while required fields get sensible
    // defaults. This prevents agents from being mis-tagged needs_repair for
    // a schema concern that is Bud's responsibility, not the agent's.
    if (result.output && args.agentId !== 'bud') {
      const check = AgentOutputSchema.safeParse(result.output);
      if (!check.success) {
        const raw = result.output;
        result.output = {
          status: 'success',
          summary: typeof raw.summary === 'string' ? raw.summary : result.summary,
          findings: Array.isArray(raw.findings) && (raw.findings as unknown[]).every((f) => typeof f === 'string')
            ? (raw.findings as string[])
            : [],
          recommended_actions: Array.isArray(raw.recommended_actions) && (raw.recommended_actions as unknown[]).every((a) => typeof a === 'string')
            ? (raw.recommended_actions as string[])
            : [],
          confidence: typeof raw.confidence === 'number' ? raw.confidence : 0.7,
          risk_level: (['low', 'medium', 'high', 'critical'] as const).includes(raw.risk_level as 'low')
            ? (raw.risk_level as 'low' | 'medium' | 'high' | 'critical')
            : 'low',
          raw_output: raw,
        };
        logs.push(`[bud:schema] output normalised (was missing required fields)`);
      }
    }

    const finalStatus = needsApproval ? 'needs_approval' : 'succeeded';

    await supabase
      .from('agent_runs')
      .update({
        status: finalStatus,
        output: { ...(result.output ?? {}), logs },
        summary: result.summary,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_cents: costCents,
        duration_ms: durationMs,
        finished_at: new Date().toISOString(),
        model: llmModel,
        cache_read_tokens: cacheReadTokens,
        cache_creation_tokens: cacheCreationTokens,
        confidence_score: result.confidenceScore ?? null,
        evidence_payload: result.evidencePayload ?? null,
      })
      .eq('id', runId);

    // Fire-and-forget: generate a summary embedding for semantic search.
    // Only fires when OPENAI_API_KEY is present and the summary is non-empty.
    // Uses text-embedding-3-small (1536 dims, matches the migration).
    if (result.summary && process.env.OPENAI_API_KEY && finalStatus === 'succeeded') {
      setImmediate(() => {
        fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({ input: result.summary, model: 'text-embedding-3-small' }),
        })
          .then((r) => r.json())
          .then((j: { data?: Array<{ embedding?: number[] }> }) => {
            const vec = j.data?.[0]?.embedding;
            if (!vec) return;
            return supabase
              .from('agent_runs')
              .update({ summary_embedding: JSON.stringify(vec) })
              .eq('id', runId);
          })
          .catch(() => {/* non-fatal */});
      });
    }

    // Fire-and-forget: log run + any structured output to the agent workspace vault.
    // Never awaited — workspace logging must never block or fail the run.
    const workspace = getWorkspaceForAgent(args.agentId);
    if (workspace && process.env.OBSIDIAN_VAULT_PATH) {
      const output = result.output as Record<string, unknown> | undefined;
      setImmediate(() => {
        logAgentRun({
          runId,
          agentId:     args.agentId,
          workspaceId: workspace.id,
          status:      finalStatus,
          summary:     result.summary,
          durationMs,
          costCents,
          findings:   output?.findings   as import('@/lib/memory/agents/types').AgentFinding[]   | undefined,
          tasks:      output?.tasks      as import('@/lib/memory/agents/types').AgentTask[]      | undefined,
          decisions:  output?.decisions  as import('@/lib/memory/agents/types').AgentDecision[]  | undefined,
          issues:     output?.issues     as import('@/lib/memory/agents/types').AgentIssue[]     | undefined,
        });
      });
    }

    return { runId, status: finalStatus, summary: result.summary };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const msg = err instanceof Error ? err.message : String(err);
    const isGuardrail = err instanceof GuardrailBlockedError;
    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error: msg,
        summary: msg,
        output: {
          logs,
          ...(isGuardrail
            ? { guardrail: { policy: err.policyId, hook: err.hook } }
            : {}),
        },
        duration_ms: durationMs,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId);

    const failWorkspace = getWorkspaceForAgent(args.agentId);
    if (failWorkspace && process.env.OBSIDIAN_VAULT_PATH) {
      setImmediate(() => {
        logAgentRun({
          runId,
          agentId:     args.agentId,
          workspaceId: failWorkspace.id,
          status:      'failed',
          summary:     msg,
          durationMs,
        });
      });
    }

    return { runId, status: 'failed', summary: msg };
  }
}

/**
 * Executes an action that's been approved. Routes to the right
 * effect handler based on `action_type`.
 */
export async function executeApprovedAction(actionId: string): Promise<void> {
  const supabase = adminClient();
  const { data: action, error } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('id', actionId)
    .eq('status', 'approved')
    .single();

  if (error || !action) throw new Error('Action not approved or missing');

  try {
    await dispatchEffect(action.action_type, action.payload);
    await supabase
      .from('agent_actions')
      .update({ status: 'executed', executed_at: new Date().toISOString() })
      .eq('id', actionId);
  } catch (err) {
    await supabase
      .from('agent_actions')
      .update({
        status: 'failed',
        review_notes: err instanceof Error ? err.message : String(err),
      })
      .eq('id', actionId);
    throw err;
  }
}

/**
 * Effect dispatch table. Each handler calls the existing Buds At Work
 * libraries (resend for email, supabase for direct writes, etc.).
 */
async function dispatchEffect(
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (type) {
    case 'send_email':
      return sendEmailEffect(payload);
    case 'send_sms':
      return sendSmsEffect(payload);
    case 'create_quote':
      return createQuoteEffect(payload);
    case 'schedule_job':
      return scheduleJobEffect(payload);
    case 'flag_for_review':
      return flagForReviewEffect(payload);
    case 'ux_fix_required':
      return flagForReviewEffect(payload);
    case 'update_service_price':
      return updateServicePriceEffect(payload);
    case 'write_theme_file':
      return writeThemeFileEffect(payload);
    default:
      throw new Error(`No handler for action_type=${type}`);
  }
}

/**
 * Price Optimizer effect: write the approved price to service_pricing as a
 * NEW row (we keep history via effective_from) and mark the originating
 * recommendation as 'applied'.
 */
async function updateServicePriceEffect(
  payload: Record<string, unknown>,
): Promise<void> {
  const supabase = adminClient();

  const recId = payload.recommendation_id as string | undefined;
  const newPrice = Number(payload.new_price_aud);
  const oldRowId = payload.service_pricing_id as string | undefined;
  const rationale = (payload.rationale as string | undefined) ?? null;

  if (!Number.isFinite(newPrice) || newPrice <= 0) {
    throw new Error(`updateServicePriceEffect: invalid new_price_aud (${payload.new_price_aud})`);
  }
  if (!oldRowId) {
    throw new Error('updateServicePriceEffect: missing service_pricing_id');
  }

  const { data: existing, error: readErr } = await supabase
    .from('service_pricing')
    .select('service, suburb, price_unit')
    .eq('id', oldRowId)
    .single();
  if (readErr || !existing) {
    throw new Error(`updateServicePriceEffect: cannot load source row: ${readErr?.message}`);
  }

  const { error: insertErr } = await supabase.from('service_pricing').insert({
    service: existing.service,
    suburb: existing.suburb,
    price_unit: existing.price_unit,
    price_aud: newPrice,
    set_reason: rationale ? `price-optimizer: ${rationale}`.slice(0, 500) : 'price-optimizer',
  });
  if (insertErr) throw new Error(`updateServicePriceEffect: insert failed: ${insertErr.message}`);

  if (recId) {
    await supabase
      .from('pricing_recommendations')
      .update({ status: 'applied' })
      .eq('id', recId);
  }
}

// ---------------------------------------------------------------------
// Effect handlers — call the existing Buds At Work libraries
// ---------------------------------------------------------------------

async function sendEmailEffect(payload: Record<string, unknown>): Promise<void> {
  const { getResendClient, FROM_ADDRESS } = await import('@/lib/email/resend');
  const p = payload as { to: string; subject: string; html: string };
  if (!p.to || !p.subject || !p.html) throw new Error('send_email: missing to/subject/html');

  const resend = getResendClient();
  if (!resend) {
    // No RESEND_API_KEY configured — log and treat as a no-op rather than
    // failing approved actions. Agents are still useful as drafters.
    console.warn('[agent] send_email skipped — RESEND_API_KEY not set', { to: p.to });
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: p.to,
    subject: p.subject,
    html: p.html,
  });
  if (error) throw new Error(`resend: ${error.message ?? JSON.stringify(error)}`);
}

async function sendSmsEffect(payload: Record<string, unknown>): Promise<void> {
  const p = payload as { to: string; body: string };
  if (!p.to || !p.body) throw new Error('send_sms: missing to/body');

  // Twilio is the most common path; wire it up if you have an account.
  // Required env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    console.warn('[agent] send_sms skipped — TWILIO_* env vars not set', { to: p.to });
    return;
  }

  const body = new URLSearchParams({ From: from, To: p.to, Body: p.body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`twilio ${res.status}: ${await res.text()}`);
}

async function createQuoteEffect(payload: Record<string, unknown>): Promise<void> {
  // Most quote-triage actions are actually send_email actions targeting an
  // existing quote, so this path is rarely hit. When it IS hit (agent
  // proposes a brand-new quote from a phone call, say), insert through
  // the service-role Supabase client to bypass RLS.
  //
  // Source attribution: agent-created quotes default to 'phone' since the
  // typical trigger is an inbound call the agent transcribed. Callers can
  // override by including `source` on the payload — coerceLeadSource keeps
  // it consistent with the CHECK constraint.
  const { coerceLeadSource } = await import('@/lib/leads/source');
  const explicitSource = coerceLeadSource(payload.source);
  const sourced = { ...payload, source: explicitSource ?? 'phone' };

  const supabase = adminClient();
  const { error } = await supabase.from('quotes').insert(sourced);
  if (error) throw new Error(`create_quote: ${error.message}`);
}

async function scheduleJobEffect(payload: Record<string, unknown>): Promise<void> {
  // A "job" is an `orders` row. Assigning crew mirrors the admin DayScheduler:
  // set assigned_crew_id + scheduled_date/time and move status to 'scheduled'.
  const p = payload as {
    order_id: string;
    crew_id: string;
    scheduled_date?: string;
    scheduled_time?: string;
  };
  if (!p.order_id || !p.crew_id) throw new Error('schedule_job: missing order_id/crew_id');

  const supabase = adminClient();
  const update: Record<string, unknown> = {
    assigned_crew_id: p.crew_id,
    status: 'scheduled',
  };
  if (p.scheduled_date) update.scheduled_date = p.scheduled_date;
  if (p.scheduled_time) update.scheduled_time = p.scheduled_time;
  const { error } = await supabase.from('orders').update(update).eq('id', p.order_id);
  if (error) throw new Error(`schedule_job: ${error.message}`);
}

async function flagForReviewEffect(payload: Record<string, unknown>): Promise<void> {
  // "flag for review" actions don't need to do anything when approved —
  // the human has already seen them in the approval queue. We mark them
  // executed for auditability. If you have an /alerts table you'd like
  // these to land in, drop them in here.
  const supabase = adminClient();
  const { error } = await supabase.from('agent_alerts').insert({
    payload,
    created_at: new Date().toISOString(),
  });
  // Silently ignore "relation does not exist" if you haven't created
  // agent_alerts yet — the flag was already visible in the dashboard.
  if (error && !/relation .* does not exist/.test(error.message)) {
    throw new Error(`flag_for_review: ${error.message}`);
  }
}

async function writeThemeFileEffect(payload: Record<string, unknown>): Promise<void> {
  const theme = payload.theme as string | undefined;
  const content = payload.content as string | undefined;

  if (!theme || !content) {
    throw new Error('write_theme_file: missing theme or content');
  }

  const allowedThemes = ['dashboard', 'crew', 'public'];
  if (!allowedThemes.includes(theme)) {
    throw new Error(`write_theme_file: invalid theme "${theme}". Must be one of: ${allowedThemes.join(', ')}`);
  }

  const themesDir = path.join(process.cwd(), 'src/lib/design-system/themes');
  const filePath = path.join(themesDir, `${theme}.ts`);

  // Double check directory traversal by ensuring the resolved file path starts with themesDir
  const resolvedPath = path.resolve(filePath);
  const resolvedThemesDir = path.resolve(themesDir);
  if (!resolvedPath.startsWith(resolvedThemesDir)) {
    throw new Error('write_theme_file: path traversal detected');
  }

  try {
    await fs.promises.writeFile(resolvedPath, content, 'utf-8');
  } catch (err) {
    throw new Error(`write_theme_file: failed to write file: ${err instanceof Error ? err.message : String(err)}`);
  }
}

