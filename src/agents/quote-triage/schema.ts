import { z } from 'zod';

export const QuoteTriageInputSchema = z.object({
  quoteId: z.string().min(1),
  customerId: z.string().min(1),
  items: z.array(
    z.object({
      sku: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
    })
  ).min(1),
  requestedAt: z.string().datetime().optional(),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type QuoteTriageInput = z.infer<typeof QuoteTriageInputSchema>;

export interface QuoteTriageResult {
  quoteId: string;
  status: 'accepted' | 'rejected' | 'pending' | 'error';
  reason?: string;
  processedAt: string;
}
