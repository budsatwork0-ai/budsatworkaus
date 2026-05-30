import { z } from "zod";

// ---------------------------------------------------------------------------
// Typed error codes — immediately reveals root-cause category in logs
// ---------------------------------------------------------------------------
export type TriageErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_ERROR"
  | "DB_ERROR"
  | "LLM_ERROR"
  | "UNKNOWN_ERROR";

export interface TriageResult {
  success: boolean;
  quoteId?: string;
  errorCode?: TriageErrorCode;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Input schema — validate at the boundary before any I/O
// ---------------------------------------------------------------------------
const QuoteInputSchema = z.object({
  quoteId: z.string().min(1),
  customerId: z.string().min(1),
  payload: z.record(z.unknown()),
});

export type QuoteInput = z.infer<typeof QuoteInputSchema>;

// ---------------------------------------------------------------------------
// Dead-letter: flag failed quotes for manual triage (fire-and-forget, guarded)
// ---------------------------------------------------------------------------
async function sendToDeadLetter(
  input: unknown,
  errorCode: TriageErrorCode,
  errorMessage: string
): Promise<void> {
  try {
    // Lazy import prevents cold-start env-var crash
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error(
        JSON.stringify({
          event: "dead_letter_skipped",
          reason: "missing_supabase_env",
          errorCode,
        })
      );
      return;
    }
    const supabase = createClient(url, key);
    await supabase.from("quote_triage_dead_letter").insert({
      raw_input: input,
      error_code: errorCode,
      error_message: errorMessage,
      created_at: new Date().toISOString(),
    });
  } catch (dlErr) {
    // Never let dead-letter logging crash the caller
    console.error(
      JSON.stringify({
        event: "dead_letter_failed",
        error: dlErr instanceof Error ? dlErr.message : String(dlErr),
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Top-level entrypoint — structured try/catch, typed error codes
// ---------------------------------------------------------------------------
export async function run(rawInput: unknown): Promise<TriageResult> {
  // 1. Validate input
  const parsed = QuoteInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const msg = parsed.error.message;
    console.error(
      JSON.stringify({
        event: "quote_triage_error",
        errorCode: "VALIDATION_ERROR" satisfies TriageErrorCode,
        errorMessage: msg,
        input: rawInput,
      })
    );
    await sendToDeadLetter(rawInput, "VALIDATION_ERROR", msg);
    return { success: false, errorCode: "VALIDATION_ERROR", errorMessage: msg };
  }

  const { quoteId, customerId, payload } = parsed.data;

  try {
    // 2. Lazy Supabase import — prevents cold-start env-var crash
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw Object.assign(
        new Error("Supabase env vars NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing"),
        { code: "AUTH_ERROR" as TriageErrorCode }
      );
    }
    const supabase = createClient(url, key);

    // 3. Fetch existing quote row to confirm it exists and is accessible
    const { data: quoteRow, error: fetchError } = await supabase
      .from("quotes")
      .select("id, status")
      .eq("id", quoteId)
      .eq("customer_id", customerId)
      .single();

    if (fetchError) {
      const isAuth =
        fetchError.message.toLowerCase().includes("jwt") ||
        fetchError.message.toLowerCase().includes("auth") ||
        fetchError.code === "PGRST301";
      throw Object.assign(new Error(fetchError.message), {
        code: (isAuth ? "AUTH_ERROR" : "DB_ERROR") as TriageErrorCode,
      });
    }

    if (!quoteRow) {
      throw Object.assign(
        new Error(`Quote ${quoteId} not found for customer ${customerId}`),
        { code: "DB_ERROR" as TriageErrorCode }
      );
    }

    // 4. Mark quote as triaged
    const { error: updateError } = await supabase
      .from("quotes")
      .update({ status: "triaged", triage_payload: payload, triaged_at: new Date().toISOString() })
      .eq("id", quoteId);

    if (updateError) {
      throw Object.assign(new Error(updateError.message), {
        code: "DB_ERROR" as TriageErrorCode,
      });
    }

    console.log(
      JSON.stringify({ event: "quote_triage_success", quoteId, customerId })
    );
    return { success: true, quoteId };
  } catch (err) {
    const typedCode: TriageErrorCode =
      err instanceof Error && "code" in err
        ? (err as Error & { code: TriageErrorCode }).code
        : "UNKNOWN_ERROR";
    const typedMessage =
      err instanceof Error ? err.message : String(err);

    console.error(
      JSON.stringify({
        event: "quote_triage_error",
        errorCode: typedCode,
        errorMessage: typedMessage,
        quoteId,
        customerId,
      })
    );

    // Dead-letter: flag for manual triage, never silently drop
    await sendToDeadLetter(
      { quoteId, customerId, payload },
      typedCode,
      typedMessage
    );

    return {
      success: false,
      quoteId,
      errorCode: typedCode,
      errorMessage: typedMessage,
    };
  }
}
