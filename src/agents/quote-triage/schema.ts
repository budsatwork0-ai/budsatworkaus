import { z } from 'zod';

export const QuoteTriageInputSchema = z.object({
  quoteId: z.string().min(1),
  customerId: z.string().min(1),
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().positive(),
      unitPrice: z.number().nonnegative(),
    })
  ).min(1),
  requestedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type QuoteTriageInput = z.infer<typeof QuoteTriageInputSchema>;

export const QuoteTriageLLMOutputSchema = z.object({
  recommendation: z.enum(['approve', 'reject', 'escalate', 'review']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  flags: z.array(z.string()).optional(),
});

export type QuoteTriageLLMOutput = z.infer<typeof QuoteTriageLLMOutputSchema>;

export type FailureReason = 'schema_validation' | 'llm_schema' | 'timeout' | '5xx' | 'unknown';
