import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Input schema ────────────────────────────────────────────────────────────
const QuotePayloadSchema = z.object({
  quote_id: z.string().uuid(),
  service: z.string().min(1),
  total_price: z.number().nonnegative(),
  customer_email: z.string().email(),
  line_items: z.array(
    z.object({
      label: z.string(),
      amount: z.number(),
    })
  ).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type QuotePayload = z.infer<typeof QuotePayloadSchema>;

// ─── Result types ─────────────────────────────────────────────────────────────
export type TriageDecision = 'auto_approve' | 'manual_review' | 'reject';

export interface TriageSuccessResult {
  ok: true;
  decision: TriageDecision;
  quote_id: string;
  reason: string;
}

export interface TriageFailureResult {
  ok: false;
  error_code:
    | 'SCHEMA_VALIDATION_ERROR'
    | 'MISSING_ENV'
    | 'LLM_ERROR'
    | 'DB_ERROR'
    | 'UNKNOWN_ERROR';
  message: string;
  quote_id?: string;
}

export type TriageResult = TriageSuccessResult | TriageFailureResult;

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callLLMWithRetry(
  payload: QuotePayload,
  apiKey: string
): Promise<{ decision: TriageDecision; reason: string }> {
  const RETRY_DELAYS = [500, 1000];
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS[attempt - 1]);
    }
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          messages: [
            {
              role: 'system',
              content:
                'You are a quote triage assistant. Analyse the quote and return a JSON object with fields: decision ("auto_approve", "manual_review", or "reject") and reason (string). Return ONLY valid JSON, no markdown.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                service: payload.service,
                total_price: payload.total_price,
                line_items: payload.line_items ?? [],
                metadata: payload.metadata ?? {},
              }),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM HTTP ${response.status}: ${await response.text()}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = json.choices?.[0]?.message?.content ?? '';
      const parsed = JSON.parse(raw) as { decision?: string; reason?: string };

      const decision = parsed.decision as TriageDecision;
      if (!['auto_approve', 'manual_review', 'reject'].includes(decision)) {
        throw new Error(`Unexpected decision value: ${decision}`);
      }

      return { decision, reason: parsed.reason ?? '' };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

async function insertDeadLetter(
  payload: unknown,
  errorCode: string,
  message: string
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('quote_triage_dead_letters').insert({
      payload: payload as Record<string, unknown>,
      error_code: errorCode,
      error_message: message,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Dead-letter insert failure is non-fatal — log and continue.
    console.error('[quote-triage] dead-letter insert failed', { errorCode, message });
  }
}

// ─── Agent entry point ────────────────────────────────────────────────────────
export async function triageQuote(raw: unknown): Promise<TriageResult> {
  try {
    // 1. Env-var guard
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await insertDeadLetter(raw, 'MISSING_ENV', 'OPENAI_API_KEY is not set');
      return {
        ok: false,
        error_code: 'MISSING_ENV',
        message: 'OPENAI_API_KEY is not set',
      };
    }

    // 2. Schema validation
    const parsed = QuotePayloadSchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      await insertDeadLetter(raw, 'SCHEMA_VALIDATION_ERROR', message);
      return {
        ok: false,
        error_code: 'SCHEMA_VALIDATION_ERROR',
        message,
      };
    }

    const payload = parsed.data;

    // 3. LLM call with retry
    let llmResult: { decision: TriageDecision; reason: string };
    try {
      llmResult = await callLLMWithRetry(payload, apiKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await insertDeadLetter(raw, 'LLM_ERROR', message);
      return {
        ok: false,
        error_code: 'LLM_ERROR',
        message,
        quote_id: payload.quote_id,
      };
    }

    // 4. Persist decision to Supabase
    try {
      const supabase = createServiceClient();
      const { error } = await supabase.from('quote_triage_results').insert({
        quote_id: payload.quote_id,
        decision: llmResult.decision,
        reason: llmResult.reason,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await insertDeadLetter(raw, 'DB_ERROR', message);
      return {
        ok: false,
        error_code: 'DB_ERROR',
        message,
        quote_id: payload.quote_id,
      };
    }

    return {
      ok: true,
      decision: llmResult.decision,
      quote_id: payload.quote_id,
      reason: llmResult.reason,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await insertDeadLetter(raw, 'UNKNOWN_ERROR', message);
    return {
      ok: false,
      error_code: 'UNKNOWN_ERROR',
      message,
    };
  }
}
