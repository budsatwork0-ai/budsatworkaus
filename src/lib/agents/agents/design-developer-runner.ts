/**
 * design-developer-runner.ts
 *
 * Thin pipeline wrapper for the design-developer agent that:
 *  1. Validates the input payload with the Zod-based input validator.
 *  2. Runs the core agent logic (passed in as a callback to avoid coupling).
 *  3. Validates the output with the shared output-validator utility.
 *  4. Classifies any thrown error into MALFORMED_INPUT | LLM_TOOL_CALL_ERROR |
 *     FILE_WRITE_ERROR | OUTPUT_VALIDATION_ERROR and emits a structured error
 *     object with triage guidance — preventing silent failures from suppressing
 *     downstream UX signals.
 */

import {
  validateDesignDeveloperInput,
  type DesignPayload,
} from './design-developer-input-validator';
import {
  classifyUnknownError,
  buildDesignDeveloperError,
  type DesignDeveloperError,
} from './design-developer-error-types';
import { validateAgentOutput } from '@/lib/agent-utils/output-validator';

// ─── Output contract ──────────────────────────────────────────────────────────

export interface DesignDeveloperOutput {
  /** Absolute or repo-relative path of the file that was written */
  writtenPath: string;
  /** The generated source code string */
  generatedCode: string;
  /** Optional: warnings emitted during generation */
  warnings?: string[];
}

// ─── Runner result ────────────────────────────────────────────────────────────

export type DesignDeveloperRunnerResult =
  | { ok: true; output: DesignDeveloperOutput }
  | { ok: false; error: DesignDeveloperError };

// ─── Core runner ─────────────────────────────────────────────────────────────

/**
 * runDesignDeveloper
 *
 * @param rawInput   - The unvalidated payload from the caller.
 * @param agentCore  - The actual agent logic (async function that takes a
 *                     validated DesignPayload and returns DesignDeveloperOutput).
 *                     Keeping this as a callback makes the runner independently
 *                     testable without coupling to any specific LLM client.
 */
export async function runDesignDeveloper(
  rawInput: unknown,
  agentCore: (payload: DesignPayload) => Promise<DesignDeveloperOutput>
): Promise<DesignDeveloperRunnerResult> {
  // ── Step 1: Validate input ──────────────────────────────────────────────────
  const inputResult = validateDesignDeveloperInput(rawInput);

  if (!inputResult.ok) {
    return {
      ok: false,
      error: buildDesignDeveloperError(
        'MALFORMED_INPUT',
        inputResult.message,
        inputResult.triage,
        undefined,
        undefined
      ),
    };
  }

  const { data: payload } = inputResult;

  // ── Step 2: Run core agent logic ────────────────────────────────────────────
  let rawOutput: DesignDeveloperOutput;

  try {
    rawOutput = await agentCore(payload);
  } catch (err) {
    return {
      ok: false,
      error: classifyUnknownError(err, payload.taskId),
    };
  }

  // ── Step 3: Validate output ─────────────────────────────────────────────────
  try {
    validateAgentOutput(rawOutput, [
      { field: 'writtenPath', type: 'string' },
      { field: 'generatedCode', type: 'string' },
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: buildDesignDeveloperError(
        'OUTPUT_VALIDATION_ERROR',
        `design-developer output failed validation: ${msg}`,
        'The agent core returned an output missing required fields (writtenPath, generatedCode). ' +
          'Check that the LLM tool call returned a complete response and that the file-write ' +
          'step populates both fields before returning.',
        err,
        payload.taskId
      ),
    };
  }

  // ── Step 4: Return success ──────────────────────────────────────────────────
  return { ok: true, output: rawOutput };
}
