import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const UxEventSchema = z.object({
  session_id: z.string().min(1),
  event_type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
  occurred_at: z.string().optional(),
});

export type UxEvent = z.infer<typeof UxEventSchema>;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------
export type UxIntelligenceResult =
  | { status: "ok"; id: string }
  | { status: "validation_error"; message: string }
  | { status: "db_error"; message: string }
  | { status: "env_error"; message: string };

// ---------------------------------------------------------------------------
// Lazy Supabase init
// ---------------------------------------------------------------------------
function getSupabaseClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  // Dynamic require so the module can be imported in tests without env vars
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createServiceClient } = require("@/lib/supabase/server") as {
    createServiceClient: () => ReturnType<
      typeof import("@supabase/supabase-js").createClient
    >;
  };
  return createServiceClient();
}

// ---------------------------------------------------------------------------
// Log helper — truncates long raw values to avoid bloating logs
// ---------------------------------------------------------------------------
function truncate(value: unknown, maxLen = 200): string {
  const str = JSON.stringify(value) ?? String(value);
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export async function processUxEvent(
  raw: unknown
): Promise<UxIntelligenceResult> {
  // 1. Validate input
  const parsed = UxEventSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(
      "[ux-intelligence] validation_error",
      JSON.stringify(parsed.error.issues),
      "raw_input_preview:",
      truncate(raw)
    );
    return {
      status: "validation_error",
      message: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  const event = parsed.data;

  // 2. Check env / Supabase availability
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error(
      "[ux-intelligence] env_error — NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing"
    );
    return { status: "env_error", message: "Supabase env vars not configured" };
  }

  // 3. Persist
  const { data, error } = await supabase
    .from("ux_events")
    .insert({
      session_id: event.session_id,
      event_type: event.event_type,
      payload: event.payload ?? {},
      occurred_at: event.occurred_at ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error(
      "[ux-intelligence] db_error",
      error.message,
      "session_id:",
      event.session_id
    );
    return { status: "db_error", message: error.message };
  }

  return { status: "ok", id: (data as { id: string }).id };
}
