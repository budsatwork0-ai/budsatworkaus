import { z } from 'zod';

/**
 * Output schema for the customer-reply agent.
 * Validates that the agent returns a non-empty reply payload.
 */
export const outputSchema = z.object({
  customerId: z.string().min(1),
  replyText: z.string().min(1),
  channel: z.enum(['email', 'sms', 'portal']),
  sentAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CustomerReplyOutput = z.infer<typeof outputSchema>;
