/**
 * Guardrail policy types.
 *
 * Modeled after failproofai's hook pattern: every tool-call surface in
 * the agent runtime (LLM call, proposed action, recursive agent call,
 * end-of-run) gets a pre/post hook. Each registered policy returns a
 * Verdict; the runner aggregates them and the strictest verdict wins.
 *
 * Policies are deliberately small, pure functions: easy to unit-test,
 * easy to disable individually via the `policies` config knob on the
 * agent row. No data leaves the server — all checks run locally against
 * Supabase and the lineage we track in-memory.
 */
import type { AgentContext, ProposedAction } from '../types';

/**
 * What a single policy decides about a single hook call.
 *
 * - `allow`  — let the operation through
 * - `warn`   — log a warning, let the operation through. Useful for
 *              policies that aren't yet trusted enough to block.
 * - `modify` — let the operation through but with a rewritten payload
 *              (e.g. cap recipient list length, redact a phone number).
 * - `block`  — refuse the operation, surface `reason` to the run log.
 *              The agent's run is marked failed unless the policy
 *              explicitly opts into `treatAsApprovalNeeded`.
 */
export type Verdict =
  | { kind: 'allow' }
  | { kind: 'warn'; reason: string }
  | { kind: 'modify'; reason: string; modified: unknown }
  | { kind: 'block'; reason: string; treatAsApprovalNeeded?: boolean };

/**
 * Lineage entry — one row per ancestor in a recursive agent call chain.
 * Carried in-memory through nested `ctx.callAgent()` invocations.
 */
export interface LineageEntry {
  runId: string;
  agentId: string;
  /** Stable hash of the input at this level. Used by call-loop detection. */
  inputHash: string;
  /** Stated intent at this level (parent → child). */
  intent: string;
  /** Cents charged so far at this level. */
  costCents: number;
}

/**
 * Context passed to every policy hook. Read-only by convention.
 * Policies should never mutate `ctx` directly — return `modify` instead.
 */
export interface PolicyContext {
  agentId: string;
  runId: string;
  /** Parent → this → (children). Always non-empty; depth = lineage.length. */
  lineage: LineageEntry[];
  /** What this run is meant to accomplish (passed when calling the agent). */
  intent: string;
  /** Cumulative cost of this lineage in cents. */
  cumulativeCostCents: number;
  /** Cumulative cost of this run alone in cents. */
  runCostCents: number;
  /** Service-role Supabase client. */
  supabase: AgentContext['supabase'];
  /** Per-policy config, sourced from agent.config.policies. */
  config: Record<string, unknown>;
}

/** Hook for `ctx.llm(prompt, opts)` before the call is dispatched. */
export interface PreLLMArgs {
  prompt: string;
  system?: string;
  model?: string;
}

/** Hook for `ctx.llm(prompt, opts)` after we have the text response. */
export interface PostLLMArgs extends PreLLMArgs {
  response: string;
  inputTokens: number;
  outputTokens: number;
}

/** Hook for `ctx.proposeAction(action)` before the action is persisted. */
export interface PreActionArgs {
  action: ProposedAction;
}

/** Hook for `ctx.callAgent(childId, input, intent)` before recursing. */
export interface PreAgentCallArgs {
  childAgentId: string;
  childInput: Record<string, unknown>;
  childIntent: string;
}

/** Hook for the top-level `runAgent` once `def.run()` resolves. */
export interface PostAgentRunArgs {
  summary: string;
  output: Record<string, unknown>;
}

/**
 * Policies opt into the hooks they care about. Returning undefined from
 * a hook is treated as `allow`. Async is supported but kept tight — the
 * runner runs every applicable policy serially and the slowest one
 * dominates the per-call latency.
 */
export interface Policy {
  /** Stable id, e.g. "recursion-depth". Used for disable flags + logs. */
  id: string;
  /** Free-form description shown in the agents UI. */
  description: string;
  preLLM?(args: PreLLMArgs, pctx: PolicyContext): Promise<Verdict> | Verdict;
  postLLM?(args: PostLLMArgs, pctx: PolicyContext): Promise<Verdict> | Verdict;
  preAction?(args: PreActionArgs, pctx: PolicyContext): Promise<Verdict> | Verdict;
  preAgentCall?(
    args: PreAgentCallArgs,
    pctx: PolicyContext,
  ): Promise<Verdict> | Verdict;
  postAgentRun?(
    args: PostAgentRunArgs,
    pctx: PolicyContext,
  ): Promise<Verdict> | Verdict;
}

/** Errors thrown when a guardrail blocks an operation. */
export class GuardrailBlockedError extends Error {
  readonly policyId: string;
  readonly hook: string;
  readonly treatAsApprovalNeeded: boolean;
  constructor(
    policyId: string,
    hook: string,
    reason: string,
    treatAsApprovalNeeded = false,
  ) {
    super(`[guardrail:${policyId}] ${hook} blocked: ${reason}`);
    this.name = 'GuardrailBlockedError';
    this.policyId = policyId;
    this.hook = hook;
    this.treatAsApprovalNeeded = treatAsApprovalNeeded;
  }
}
