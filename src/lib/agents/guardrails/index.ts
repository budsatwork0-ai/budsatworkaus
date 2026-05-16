/**
 * Public API for the agent guardrails layer.
 *
 * Usage from runtime.ts:
 *
 *   import { PolicyRunner, type PolicyContext } from './guardrails';
 *
 *   const runner = new PolicyRunner({ disabled: agentRow.config?.policies?.disabled });
 *   await runner.preLLM({ prompt, system, model }, policyCtx);
 *
 * Most callers only need PolicyRunner + the types.
 */
export { PolicyRunner } from './runner';
export type {
  LineageEntry,
  Policy,
  PolicyContext,
  PreActionArgs,
  PreAgentCallArgs,
  PreLLMArgs,
  PostAgentRunArgs,
  PostLLMArgs,
  Verdict,
} from './types';
export { GuardrailBlockedError } from './types';
export {
  DEFAULT_POLICIES,
  callLoopPolicy,
  contextDriftPolicy,
  costBudgetPolicy,
  dangerousActionPolicy,
  hallucinationPolicy,
  intentCompletionPolicy,
  recursionDepthPolicy,
  stableHash,
} from './policies';
