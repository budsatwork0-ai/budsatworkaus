import { z } from "zod";

// Input schema: what the quote-triage agent accepts
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
  metadata: z.record(z.unknown()).optional(),
});

export type QuoteTriageInput = z.infer<typeof QuoteTriageInputSchema>;

// LLM output schema: what we expect the model to return
export const QuoteTriageLLMOutputSchema = z.object({
  priority: z.enum(["low", "medium", "high", "urgent"]),
  recommendedAction: z.string().min(1),
  flagged: z.boolean(),
  notes: z.string().optional(),
});

export type QuoteTriageLLMOutput = z.infer<typeof QuoteTriageLLMOutputSchema>;

// Full agent result
export const QuoteTriageResultSchema = z.object({
  input: QuoteTriageInputSchema,
  output: QuoteTriageLLMOutputSchema,
  processedAt: z.string().datetime(),
});

export type QuoteTriageResult = z.infer<typeof QuoteTriageResultSchema>;
