import { z } from 'zod';

// ── Quote-triage payload ──────────────────────────────────────────────────────
export const QuoteTriagePayloadSchema = z.object({
  quoteId: z.string().min(1),
  customerId: z.string().min(1),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
      })
    )
    .min(1),
  requestedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type QuoteTriagePayload = z.infer<typeof QuoteTriagePayloadSchema>;

// ── Customer-reply payload ────────────────────────────────────────────────────
export const CustomerReplyPayloadSchema = z.object({
  threadId: z.string().min(1),
  customerId: z.string().min(1),
  messageBody: z.string().min(1),
  channel: z.enum(['email', 'chat', 'sms']),
  receivedAt: z.string().datetime(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CustomerReplyPayload = z.infer<typeof CustomerReplyPayloadSchema>;

// ── Union of all known agent payload schemas ──────────────────────────────────
export const AgentPayloadSchemas = {
  'quote-triage': QuoteTriagePayloadSchema,
  'customer-reply': CustomerReplyPayloadSchema,
} as const;

export type AgentType = keyof typeof AgentPayloadSchemas;
