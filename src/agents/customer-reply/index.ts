import { z } from 'zod';
import { withAgentResilience } from '@/lib/agent-resilience';

// ── Input schema ──────────────────────────────────────────────────────────────
const CustomerReplyInputSchema = z.object({
  customerId: z.string().min(1),
  messageId: z.string().min(1),
  messageBody: z.string().min(1),
  channel: z.enum(['email', 'sms', 'portal']).optional(),
});

type CustomerReplyInput = z.infer<typeof CustomerReplyInputSchema>;

export interface CustomerReplyResult {
  customerId: string;
  messageId: string;
  replySent: boolean;
  replyBody: string | null;
}

const FALLBACK_RESULT: CustomerReplyResult = {
  customerId: 'unknown',
  messageId: 'unknown',
  replySent: false,
  replyBody: null,
};

// ── Core logic (pure, no retry/error handling here) ───────────────────────────
async function runCustomerReply(
  input: CustomerReplyInput,
): Promise<CustomerReplyResult> {
  // Placeholder: real implementation would compose and dispatch a reply.
  return {
    customerId: input.customerId,
    messageId: input.messageId,
    replySent: true,
    replyBody: `Thank you for your message. We will be in touch shortly.`,
  };
}

// ── Public agent entry-point ──────────────────────────────────────────────────
export async function replyToCustomer(input: CustomerReplyInput) {
  return withAgentResilience(runCustomerReply, input, {
    agentName: 'customer-reply',
    inputSchema: CustomerReplyInputSchema,
    maxAttempts: 3,
    baseDelayMs: 200,
    fallback: {
      ...FALLBACK_RESULT,
      customerId: input?.customerId ?? 'unknown',
      messageId: input?.messageId ?? 'unknown',
    },
  });
}
