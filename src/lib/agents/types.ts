/**
 * Shared types for the Buds At Work agent system.
 */

export type AgentCategory =
  | 'sales'
  | 'support'
  | 'ops'
  | 'hiring'
  | 'finance'
  | 'compliance';

export type AgentAutonomy = 'auto' | 'review' | 'manual';
export type AgentStatus = 'enabled' | 'paused' | 'disabled';

export type AgentRunStatus =
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'needs_approval'
  | 'cancelled';

export type AgentActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed';

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  category: AgentCategory;
  autonomy: AgentAutonomy;
  schedule?: string | null;
  config?: Record<string, unknown>;
  /** The actual entry point. Returns a summary + proposed actions. */
  run: (ctx: AgentContext) => Promise<AgentRunResult>;
}

export interface AgentContext {
  runId: string;
  agentId: string;
  trigger: 'cron' | 'manual' | 'webhook' | 'event';
  input: Record<string, unknown>;
  config: Record<string, unknown>;
  /** Obsidian-native memory: search, recall, write, findRelated. */
  memory: import('@/lib/memory/types').MemoryContext;
  /**
   * The stated intent for this run. Set by the caller (parent agent or
   * trigger). Guardrails compare this against summaries and child
   * intents to detect drift / completion. May be empty for legacy
   * triggers — guardrails fall back to a warn-only mode in that case.
   */
  intent: string;
  /**
   * Depth of this run in a recursive lineage. 1 for a top-level run.
   * Increases by 1 each time `ctx.callAgent` recurses.
   */
  depth: number;
  /** Service-role Supabase client. */
  supabase: import('@supabase/supabase-js').SupabaseClient;
  /** Adds a proposed action to the run; respects the agent's autonomy. */
  proposeAction: (action: ProposedAction) => Promise<void>;
  /** Calls the LLM. Wraps cost / token accounting. */
  llm: (
    prompt: string,
    opts?: { model?: string; jsonSchema?: unknown; system?: string },
  ) => Promise<string>;
  /**
   * Recursively run another agent as a child of this run. Guardrails
   * apply (depth caps, loop detection, drift checks). The child's cost
   * is added to the lineage budget.
   */
  callAgent: (
    childAgentId: string,
    input: Record<string, unknown>,
    childIntent: string,
  ) => Promise<{ runId: string; status: AgentRunStatus; summary: string }>;
  log: (msg: string, data?: unknown) => void;
}

export interface ProposedAction {
  action_type: string;
  target_table?: string;
  target_id?: string;
  payload: Record<string, unknown>;
  preview: string;
  /** Override default autonomy rule for this specific action. */
  requiresApproval?: boolean;
}

export interface AgentRunResult {
  summary: string;
  output?: Record<string, unknown>;
}
