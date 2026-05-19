import { z } from 'zod';

export const AgentOutputSchema = z.object({
  status: z.enum(['success', 'partial', 'failed', 'needs_repair']),
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
  'thinking',
  'investigating',
  'repairing',
  'testing',
  'reviewing',
  'deploying',
  'learning',
  'idle',
]);

export type BudState = z.infer<typeof BudStateSchema>;

export const BudTaskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'awaiting_approval',
  'completed',
  'failed',
  'archived',
]);

export const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const AutonomyLevelSchema = z.number().int().min(0).max(5);
