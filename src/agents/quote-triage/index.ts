import { z } from 'zod';
import { withAgentResilience } from '@/lib/agent-resilience';

// ── Input schema ──────────────────────────────────────────────────────────────
const QuoteTriageInputSchema = z.object({
  quoteId: z.string().min(1),
  serviceType: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

type QuoteTriageInput = z.infer<typeof QuoteTriageInputSchema>;

export interface QuoteTriageResult {
  quoteId: string;
  priority: 'high' | 'normal' | 'low';
  assignedTo: string | null;
  notes: string;
}

const FALLBACK_RESULT: QuoteTriageResult = {
  quoteId: 'unknown',
  priority: 'normal',
  assignedTo: null,
  notes: 'Triage unavailable — manual review required.',
};

// ── Core logic (pure, no retry/error handling here) ───────────────────────────
async function runTriage(input: QuoteTriageInput): Promise<QuoteTriageResult> {
  // Placeholder: real implementation would call an LLM or rules engine.
  const priority: QuoteTriageResult['priority'] =
    input.serviceType === 'cleaning' ? 'high' : 'normal';

  return {
    quoteId: input.quoteId,
    priority,
    assignedTo: null,
    notes: `Auto-triaged for service: ${input.serviceType}`,
  };
}

// ── Public agent entry-point ──────────────────────────────────────────────────
export async function triageQuote(input: QuoteTriageInput) {
  return withAgentResilience(runTriage, input, {
    agentName: 'quote-triage',
    inputSchema: QuoteTriageInputSchema,
    maxAttempts: 3,
    baseDelayMs: 200,
    fallback: { ...FALLBACK_RESULT, quoteId: input?.quoteId ?? 'unknown' },
  });
}
