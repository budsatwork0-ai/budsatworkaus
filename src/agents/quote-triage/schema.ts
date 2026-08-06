import { z } from 'zod';

export const QuoteTriageInputSchema = z.object({
  quoteId: z.string().uuid(),
  customerId: z.string().uuid(),
  items: z.array(
    z.object({
      sku: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
    })
  ).min(1),
  requestedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type QuoteTriageInput = z.infer<typeof QuoteTriageInputSchema>;

export const QuoteTriageLLMOutputSchema = z.object({
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  reason: z.string().min(1),
  suggestedActions: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
});

export type QuoteTriageLLMOutput = z.infer<typeof QuoteTriageLLMOutputSchema>;
