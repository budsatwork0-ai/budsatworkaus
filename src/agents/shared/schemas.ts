import { z } from 'zod';

export const QuoteTriagePayloadSchema = z.object({
  quoteId: z.string().min(1),
  customerId: z.string().min(1),
  requestedAt: z.string().datetime(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      quantity: z.number().int().positive(),
      unitPrice: z.number().nonnegative().optional(),
    })
  ).min(1),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type QuoteTriagePayload = z.infer<typeof QuoteTriagePayloadSchema>;

export const CustomerReplyPayloadSchema = z.object({
  conversationId: z.string().min(1),
  customerId: z.string().min(1),
  messageId: z.string().min(1),
  receivedAt: z.string().datetime(),
  body: z.string().min(1),
  channel: z.enum(['email', 'sms', 'chat', 'portal']),
  attachments: z.array(
    z.object({
      filename: z.string().min(1),
      mimeType: z.string().min(1),
      url: z.string().url(),
    })
  ).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CustomerReplyPayload = z.infer<typeof CustomerReplyPayloadSchema>;

export const AgentPayloadSchemas = {
  quoteTriage: QuoteTriagePayloadSchema,
  customerReply: CustomerReplyPayloadSchema,
} as const;

export type AgentPayloadType = keyof typeof AgentPayloadSchemas;
