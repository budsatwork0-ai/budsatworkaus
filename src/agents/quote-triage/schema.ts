import { z } from 'zod';

export const QuoteTriageInputSchema = z.object({
  quoteId: z.string().min(1),
  customerId: z.string().min(1),
  lineItems: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPriceCents: z.number().int().nonnegative(),
      })
    )
    .min(1),
  requestedAt: z.string().datetime().optional(),
});

export type QuoteTriageInput = z.infer<typeof QuoteTriageInputSchema>;

export const QuoteTriageResultSchema = z.object({
  quoteId: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assignedTo: z.string().nullable(),
  triageNotes: z.string().optional(),
  processedAt: z.string().datetime(),
});

export type QuoteTriageResult = z.infer<typeof QuoteTriageResultSchema>;
