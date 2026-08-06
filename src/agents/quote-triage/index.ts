import { withCircuitBreaker, type AgentResult } from '@/lib/agent-circuit-breaker';

const AGENT_ID = 'quote-triage';

export interface QuoteTriageInput {
  quoteId: string;
  [key: string]: unknown;
}

export interface QuoteTriageOutput {
  quoteId: string;
  triaged: boolean;
  notes?: string;
}

async function runQuoteTriage(
  input: QuoteTriageInput
): Promise<QuoteTriageOutput> {
  // Core triage logic placeholder — replace with real implementation.
  return { quoteId: input.quoteId, triaged: true };
}

export async function triageQuote(
  input: QuoteTriageInput
): Promise<AgentResult<QuoteTriageOutput>> {
  return withCircuitBreaker(AGENT_ID, () => runQuoteTriage(input));
}
