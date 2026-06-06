import { z } from 'zod';

/**
 * Zod v4-compatible input schema for quote-triage payloads.
 * Malformed inputs are rejected at entry with a typed validation error.
 */
export const QuoteTriageInputSchema = z.object({
  quoteId: z.string().min(1),
  serviceType: z.string().min(1),
  /** Freeform customer description or auto-generated payload text */
  description: z.string().min(1),
  /** Optional confidence score 0–1 from upstream; triggers human_review below threshold */
  confidence: z.number().min(0).max(1).optional(),
  /** Arbitrary extra fields passed through unchanged */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type QuoteTriageInput = z.infer<typeof QuoteTriageInputSchema>;

export const CONFIDENCE_THRESHOLD = 0.4;
