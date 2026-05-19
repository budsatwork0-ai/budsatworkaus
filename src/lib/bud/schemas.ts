import { z } from 'zod';

export const AgentOutputSchema = z.object({
  status: z.enum([
    'success',
    'partial',
    'failed',
    'needs_repair',
    'needs_action',
    'investigating',
    'repairing',
    'blocked',
    'degraded',
    'attention_required',
  ]),
  summary: z.string(),
  findings: z.array(z.string()).default([]),
  recommended_actions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  risk_level: z.enum(['low', 'medium', 'high', 'critical']),
  structured_failure_reason: z.string().optional(),
  raw_output: z.unknown().optional(),
  next_step: z.string().optional(),
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;

export const BudStateSchema = z.enum([
  'observing',
  'thinking',
  'investigating',
  'planning',
  'repairing',
  'testing',
  'reviewing',
  'waiting_for_approval',
  'deploying',
  'learning',
  'idle',
  'verifying',
  'blocked',
  'repaired',
  'needs_human_approval',
]);

export type BudState = z.infer<typeof BudStateSchema>;

export const BudTaskStatusSchema = z.enum([
  'pending',
  'detected',
  'reproducing',
  'analyzing',
  'planning',
  'in_progress',
  'awaiting_approval',
  'patching',
  'validating',
  'deploying',
  'verifying',
  'monitoring',
  'recovered',
  'rolled_back',
  'blocked',
  'completed',
  'failed',
  'archived',
]);

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const AutonomyLevelSchema = z.number().int().min(0).max(5);
