import { z } from 'zod';

export const QuoteTriageInputSchema = z.object({
  quoteId: z.string().min(1),
  customerId: z.string().min(1),
  lineItems: z.array(
    z.object({
      sku: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative(),
    })
  ).min(1),
  totalValue: z.number().nonnegative(),
  requestedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export type QuoteTriageInput = z.infer<typeof QuoteTriageInputSchema>;

export const TRIAGE_CATEGORIES = ['auto-approve', 'review-required', 'reject'] as const;
export type TriageCategory = typeof TRIAGE_CATEGORIES[number];

export interface QuoteTriageResult {
  quoteId: string;
  category: TriageCategory;
  reason: string;
  triageAt: string;
}
