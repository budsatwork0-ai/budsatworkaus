/**
 * Shared agent dispatcher.
 * Validates the incoming payload via schema validation, then dispatches to the
 * appropriate agent.  LLM calls are wrapped so that LLMConfigError and other
 * LLM-layer errors are converted into structured errors compatible with the
 * monitoring threshold-evaluator.
 */

import { validateAgentPayload, AgentValidationError } from "./validation";
import { llmClient, llmModel, LLMConfigError } from "@/lib/llm/client";

export interface DispatchResult {
  success: boolean;
  agentType: string;
  error?: DispatchError;
  data?: unknown;
}

export interface DispatchError {
  code:
    | "VALIDATION_ERROR"
    | "LLM_CONFIG_ERROR"
    | "LLM_CALL_ERROR"
    | "UNKNOWN_ERROR";
  message: string;
  agentType: string;
}

/**
 * Dispatches a payload to the named agent.
 *
 * @param agentType - Identifier matching a registered agent (e.g. "quote-triage").
 * @param rawPayload - Unvalidated inbound payload.
 * @returns A structured DispatchResult suitable for consumption by the
 *          monitoring threshold-evaluator.
 */
export async function dispatch(
  agentType: string,
  rawPayload: unknown
): Promise<DispatchResult> {
  // 1. Schema validation gate
  let payload: unknown;
  try {
    payload = validateAgentPayload(agentType, rawPayload);
  } catch (err) {
    if (err instanceof AgentValidationError) {
      return {
        success: false,
        agentType,
        error: {
          code: "VALIDATION_ERROR",
          message: err.message,
          agentType,
        },
      };
    }
    throw err;
  }

  // 2. LLM dispatch — wrapped so config and call errors are structured
  try {
    const result = await runAgentLLMCall(agentType, payload);
    return { success: true, agentType, data: result };
  } catch (err) {
    if (err instanceof LLMConfigError) {
      return {
        success: false,
        agentType,
        error: {
          code: "LLM_CONFIG_ERROR",
          message: err.message,
          agentType,
        },
      };
    }

    const message =
      err instanceof Error ? err.message : "Unknown LLM call error";
    return {
      success: false,
      agentType,
      error: {
        code: "LLM_CALL_ERROR",
        message,
        agentType,
      },
    };
  }
}

/**
 * Internal helper that performs the actual LLM call using the centralised
 * client.  Additional agent-specific prompt building should be added here or
 * delegated to per-agent modules imported into this function.
 */
async function runAgentLLMCall(
  agentType: string,
  payload: unknown
): Promise<unknown> {
  const completion = await llmClient.chat.completions.create({
    model: llmModel,
    messages: [
      {
        role: "system",
        content: `You are the ${agentType} agent. Process the following payload and respond in JSON.`,
      },
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw);
}
