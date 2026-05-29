import { ZodError } from "zod";
import {
  QuoteTriageInputSchema,
  QuoteTriageLLMOutputSchema,
  type QuoteTriageInput,
  type QuoteTriageResult,
} from "./schema";
import { reportError } from "@/lib/error-reporting";

const AREA = "agent/quote-triage" as const;

/**
 * Builds the prompt sent to the LLM.
 * Keeping this co-located makes schema drift obvious.
 */
function buildPrompt(input: QuoteTriageInput): string {
  const itemSummary = input.items
    .map((i) => `${i.sku} x${i.quantity} @ $${i.unitPrice}`)
    .join(", ");
  return [
    "You are a quote-triage assistant. Analyse the following sales quote and respond with a JSON object.",
    `Quote ID: ${input.quoteId}`,
    `Customer ID: ${input.customerId}`,
    `Items: ${itemSummary}`,
    "",
    "Respond ONLY with valid JSON matching this exact shape:",
    `{ "priority": "low"|"medium"|"high"|"urgent", "recommendedAction": string, "flagged": boolean, "notes"?: string }`,
  ].join("\n");
}

/**
 * Calls the LLM and returns the raw response text.
 * Reads the API key from the environment at call-time so a missing secret
 * surfaces as a clear missing-env error rather than a silent crash.
 */
async function callLLM(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw Object.assign(
      new Error("OPENAI_API_KEY is not set in the environment"),
      { reason: "missing-env" as const }
    );
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `LLM API returned ${response.status}: ${await response.text()}`
    );
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("LLM returned an empty or malformed response");
  }
  return content.trim();
}

/**
 * Main agent entrypoint.
 *
 * 1. Validates raw input against the shared Zod schema.
 * 2. Calls the LLM and validates its output against the output schema.
 * 3. On any failure, calls reportError and returns null so callers can
 *    handle gracefully without a hard crash blocking the sales funnel.
 */
export async function runQuoteTriageAgent(
  rawInput: unknown
): Promise<QuoteTriageResult | null> {
  // ── 1. Validate input ──────────────────────────────────────────────────
  let input: QuoteTriageInput;
  try {
    input = QuoteTriageInputSchema.parse(rawInput);
  } catch (err) {
    reportError(
      AREA,
      err instanceof ZodError ? "validation" : "unexpected",
      err,
      rawInput
    );
    return null;
  }

  // ── 2. Call LLM and validate output ────────────────────────────────────
  try {
    const prompt = buildPrompt(input);
    const rawText = await callLLM(prompt);

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(
        `LLM output is not valid JSON. Raw text: ${rawText.slice(0, 200)}`
      );
    }

    const output = QuoteTriageLLMOutputSchema.parse(parsed);

    return {
      input,
      output,
      processedAt: new Date().toISOString(),
    };
  } catch (err) {
    const isMissingEnv =
      err instanceof Error &&
      (err as Error & { reason?: string }).reason === "missing-env";

    reportError(
      AREA,
      isMissingEnv
        ? "missing-env"
        : err instanceof ZodError
        ? "validation"
        : "unexpected",
      err,
      input
    );
    return null;
  }
}
