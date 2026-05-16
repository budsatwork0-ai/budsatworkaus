/**
 * Policy runner.
 *
 * Wires the registered policies into the five hook points exposed by the
 * agent runtime. The runner is deliberately stateless — all state lives
 * in `PolicyContext` (lineage, costs) which is passed down through
 * `ctx.callAgent` so recursive agents inherit it.
 *
 * Aggregation rules:
 *   • If any policy returns `block` → the whole hook blocks. The first
 *     blocking policy's reason wins; the runner emits a `guardrail_event`
 *     row so the dashboard can show it.
 *   • Otherwise, `modify` verdicts compose (last writer wins on the
 *     payload).
 *   • `warn` verdicts are logged but never block.
 *   • `allow` (or undefined return) is a no-op.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  GuardrailBlockedError,
  type Policy,
  type PolicyContext,
  type PostAgentRunArgs,
  type PostLLMArgs,
  type PreActionArgs,
  type PreAgentCallArgs,
  type PreLLMArgs,
  type Verdict,
} from './types';
import { DEFAULT_POLICIES } from './policies';

export interface RunnerOptions {
  /** Override the default policy set (e.g. for tests). */
  policies?: Policy[];
  /** Policy ids to skip entirely. Sourced from agent.config.policies.disabled. */
  disabled?: string[];
  /** When true, never persist guardrail events. Used in tests. */
  silent?: boolean;
}

export class PolicyRunner {
  private readonly policies: Policy[];
  private readonly silent: boolean;

  constructor(opts: RunnerOptions = {}) {
    const disabled = new Set(opts.disabled ?? []);
    this.policies = (opts.policies ?? DEFAULT_POLICIES).filter(
      (p) => !disabled.has(p.id),
    );
    this.silent = opts.silent ?? false;
  }

  /** Returns the active policy ids. Handy for logging on run start. */
  activeIds(): string[] {
    return this.policies.map((p) => p.id);
  }

  async preLLM(args: PreLLMArgs, pctx: PolicyContext): Promise<PreLLMArgs> {
    return this.applyPre('preLLM', args, pctx);
  }

  async postLLM(args: PostLLMArgs, pctx: PolicyContext): Promise<void> {
    await this.applyPost('postLLM', args, pctx);
  }

  async preAction(
    args: PreActionArgs,
    pctx: PolicyContext,
  ): Promise<PreActionArgs> {
    return this.applyPre('preAction', args, pctx);
  }

  async preAgentCall(
    args: PreAgentCallArgs,
    pctx: PolicyContext,
  ): Promise<PreAgentCallArgs> {
    return this.applyPre('preAgentCall', args, pctx);
  }

  async postAgentRun(
    args: PostAgentRunArgs,
    pctx: PolicyContext,
  ): Promise<void> {
    await this.applyPost('postAgentRun', args, pctx);
  }

  // --------------------------------------------------------------------

  /**
   * Run every applicable policy and roll up verdicts into a (possibly
   * modified) args payload. Throws GuardrailBlockedError on the first
   * `block` verdict.
   */
  private async applyPre<A>(
    hook: 'preLLM' | 'preAction' | 'preAgentCall',
    args: A,
    pctx: PolicyContext,
  ): Promise<A> {
    let current: A = args;
    for (const policy of this.policies) {
      const fn = policy[hook] as
        | undefined
        | ((args: A, pctx: PolicyContext) => Promise<Verdict> | Verdict);
      if (!fn) continue;
      const verdict = await fn.call(policy, current, pctx);
      await this.handleVerdict(policy.id, hook, verdict, pctx);
      if (verdict?.kind === 'modify') {
        current = verdict.modified as A;
      }
    }
    return current;
  }

  private async applyPost<A>(
    hook: 'postLLM' | 'postAgentRun',
    args: A,
    pctx: PolicyContext,
  ): Promise<void> {
    for (const policy of this.policies) {
      const fn = policy[hook] as
        | undefined
        | ((args: A, pctx: PolicyContext) => Promise<Verdict> | Verdict);
      if (!fn) continue;
      const verdict = await fn.call(policy, args, pctx);
      // Post hooks don't throw — they log and move on. Blocks at this
      // stage mean "the run already happened" so we only emit an event.
      await this.handleVerdict(policy.id, hook, verdict, pctx, {
        nonThrowing: true,
      });
    }
  }

  private async handleVerdict(
    policyId: string,
    hook: string,
    verdict: Verdict | void,
    pctx: PolicyContext,
    opts: { nonThrowing?: boolean } = {},
  ): Promise<void> {
    if (!verdict || verdict.kind === 'allow') return;

    await this.emitEvent(policyId, hook, verdict, pctx);

    if (verdict.kind === 'block' && !opts.nonThrowing) {
      throw new GuardrailBlockedError(
        policyId,
        hook,
        verdict.reason,
        verdict.treatAsApprovalNeeded === true,
      );
    }
  }

  private async emitEvent(
    policyId: string,
    hook: string,
    verdict: Verdict,
    pctx: PolicyContext,
  ): Promise<void> {
    if (this.silent) return;
    if (verdict.kind === 'allow') return;
    try {
      await safeInsertGuardrailEvent(pctx.supabase, {
        run_id: pctx.runId,
        agent_id: pctx.agentId,
        policy_id: policyId,
        hook,
        verdict: verdict.kind,
        reason: 'reason' in verdict ? verdict.reason : null,
        lineage_depth: pctx.lineage.length,
      });
    } catch {
      // Never let event persistence break a run. The verdict itself is
      // what enforces the policy.
    }
  }
}

/**
 * Insert into the `agent_guardrail_events` table when it exists. If the
 * table hasn't been migrated yet, swallow the "relation does not exist"
 * error so the runner still works on day one — you can add the table
 * later without touching the runtime.
 */
async function safeInsertGuardrailEvent(
  supabase: SupabaseClient,
  row: {
    run_id: string;
    agent_id: string;
    policy_id: string;
    hook: string;
    verdict: string;
    reason: string | null;
    lineage_depth: number;
  },
): Promise<void> {
  const { error } = await supabase.from('agent_guardrail_events').insert(row);
  if (!error) return;
  if (/relation .* does not exist/i.test(error.message)) return;
  // Anything else — log to console but don't throw.
  console.warn('[guardrails] failed to insert guardrail event', error);
}
