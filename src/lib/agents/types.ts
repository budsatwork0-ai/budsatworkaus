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
  /** Service-role Supabase client. */
  supabase: import('@supabase/supabase-js').SupabaseClient;
  /** Adds a proposed action to the run; respects the agent's autonomy. */
  proposeAction: (action: ProposedAction) => Promise<void>;
  /** Calls the LLM. Wraps cost / token accounting. */
  llm: (
    prompt: string,
    opts?: { model?: string; jsonSchema?: unknown; system?: string },
  ) => Promise<string>;
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
