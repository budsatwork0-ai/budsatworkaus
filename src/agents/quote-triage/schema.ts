import { z } from 'zod';

export const QuoteTriageInputSchema = z.object({
  quoteId: z.string(),
  customerId: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});

export type QuoteTriageInput = z.infer<typeof QuoteTriageInputSchema>;

export interface QuoteTriageResult {
  quoteId: string;
  status: 'accepted' | 'rejected' | 'pending';
  reason?: string;
}
