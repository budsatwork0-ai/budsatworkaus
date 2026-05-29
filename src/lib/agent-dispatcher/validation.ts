import { z } from 'zod';

// --- Schemas ---

export const QuoteTriageInputSchema = z.object({
  quoteId: z.string().min(1),
  customerId: z.string().min(1),
  requestedAt: z.string().datetime().optional(),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative().optional(),
      })
    )
    .min(1),
  notes: z.string().optional(),
});

export const CustomerReplyInputSchema = z.object({
  threadId: z.string().min(1),
  customerId: z.string().min(1),
  messageBody: z.string().min(1),
  receivedAt: z.string().datetime().optional(),
  channel: z.enum(['email', 'chat', 'sms']).optional(),
});

export type QuoteTriageInput = z.infer<typeof QuoteTriageInputSchema>;
export type CustomerReplyInput = z.infer<typeof CustomerReplyInputSchema>;

// --- Validation error ---

export class ValidationError extends Error {
  public readonly issues: z.ZodIssue[];

  constructor(agentType: string, issues: z.ZodIssue[]) {
    super(
      `ValidationError for agent "${agentType}": ${
        issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      }`
    );
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

// --- Dispatcher validation entry point ---

export type AgentType = 'quote-triage' | 'customer-reply';

/**
 * Validates an incoming payload against the schema that corresponds to
 * `agentType`. Throws a `ValidationError` when validation fails so the
 * caller's existing try/catch (and `recordAgentFailure`) can handle it
 * without any malformed data ever reaching the LLM.
 */
export function validateAgentInput(
  agentType: AgentType,
  payload: unknown
): QuoteTriageInput | CustomerReplyInput {
  switch (agentType) {
    case 'quote-triage': {
      const result = QuoteTriageInputSchema.safeParse(payload);
      if (!result.success) {
        throw new ValidationError(agentType, result.error.issues);
      }
      return result.data;
    }
    case 'customer-reply': {
      const result = CustomerReplyInputSchema.safeParse(payload);
      if (!result.success) {
        throw new ValidationError(agentType, result.error.issues);
      }
      return result.data;
    }
    default: {
      // Exhaustiveness guard — TypeScript narrows `agentType` to `never` here.
      const _exhaustive: never = agentType;
      throw new ValidationError(_exhaustive, [
        {
          code: z.ZodIssueCode.custom,
          path: [],
          message: `Unknown agent type: ${String(_exhaustive)}`,
        },
      ]);
    }
  }
}
