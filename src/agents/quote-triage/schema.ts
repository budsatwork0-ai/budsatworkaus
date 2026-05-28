import { z } from 'zod';

export const QuoteTriageInputSchema = z.object({
  quoteId: z.string().min(1, 'quoteId is required'),
  customerId: z.string().min(1, 'customerId is required'),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
      })
    )
    .min(1, 'items must contain at least one entry'),
  requestedAt: z.string().datetime({ message: 'requestedAt must be an ISO-8601 datetime string' }),
  metadata: z.record(z.unknown()).optional(),
});

export type QuoteTriageInput = z.infer<typeof QuoteTriageInputSchema>;

export interface QuoteTriageErrorResponse {
  success: false;
  error: string;
  issues?: z.ZodIssue[];
  timestamp: string;
  inputShape?: Record<string, unknown>;
}

export interface QuoteTriageSuccessResponse {
  success: true;
  quoteId: string;
  [key: string]: unknown;
}

export type QuoteTriageResponse = QuoteTriageSuccessResponse | QuoteTriageErrorResponse;
