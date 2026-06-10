import { z } from 'zod';

/**
 * Output schema for the quote-triage agent.
 * Validates that the agent returns a non-empty triage decision.
 */
export const outputSchema = z.object({
  quoteId: z.string().min(1),
  decision: z.enum(['approve', 'reject', 'escalate', 'needs_info']),
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type QuoteTriageOutput = z.infer<typeof outputSchema>;
