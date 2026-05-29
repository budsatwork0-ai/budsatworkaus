import { z } from 'zod';

export const QuoteTriageInputSchema = z.object({
  quoteId: z.string().min(1),
  customerId: z.string().min(1),
  lineItems: z.array(
    z.object({
      sku: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
    })
  ).min(1),
  submittedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type QuoteTriageInput = z.infer<typeof QuoteTriageInputSchema>;

export const QuoteTriageResultSchema = z.object({
  quoteId: z.string(),
  decision: z.enum(['approve', 'reject', 'escalate']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
  reviewedAt: z.string().datetime(),
});

export type QuoteTriageResult = z.infer<typeof QuoteTriageResultSchema>;
