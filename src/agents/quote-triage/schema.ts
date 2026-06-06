import { z } from 'zod';

export const QuoteTriageInputSchema = z.object({
  quoteId: z.string().min(1),
  serviceKey: z.string().min(1),
  customerId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

export type QuoteTriageInput = z.infer<typeof QuoteTriageInputSchema>;
