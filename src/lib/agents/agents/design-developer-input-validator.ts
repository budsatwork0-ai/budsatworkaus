/**
 * design-developer-input-validator.ts
 *
 * Zod-based input validator for the design-developer agent entry point.
 * Validates required design payload fields before any LLM calls are made.
 */

import { z } from 'zod';

// ─── Input schema ─────────────────────────────────────────────────────────────

export const DesignPayloadSchema = z.object({
  /** Unique identifier for the design task */
  taskId: z.string().min(1, 'taskId is required'),
  /** Human-readable name of the component or page being built */
  componentName: z.string().min(1, 'componentName is required'),
  /** Raw design specification (Figma JSON, markdown spec, or structured object) */
  designSpec: z.record(z.string(), z.unknown()),
  /** Target file path where the generated component should be written */
  outputPath: z.string().min(1, 'outputPath is required'),
  /** Optional: design tokens or theme overrides */
  tokens: z.record(z.string(), z.unknown()).optional(),
  /** Optional: additional context for the LLM */
  context: z.string().optional(),
});

export type DesignPayload = z.infer<typeof DesignPayloadSchema>;

// ─── Validation result ────────────────────────────────────────────────────────

export interface InputValidationSuccess {
  ok: true;
  data: DesignPayload;
}

export interface InputValidationFailure {
  ok: false;
  errorCode: 'MALFORMED_INPUT';
  message: string;
  fieldErrors: Record<string, string[]>;
  triage: string;
}

export type InputValidationResult = InputValidationSuccess | InputValidationFailure;

// ─── Validator function ───────────────────────────────────────────────────────

/**
 * Validates the raw input payload for the design-developer agent.
 * Returns a discriminated union — callers must check `result.ok` before proceeding.
 */
export function validateDesignDeveloperInput(
  raw: unknown
): InputValidationResult {
  const parsed = DesignPayloadSchema.safeParse(raw);

  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!fieldErrors[path]) fieldErrors[path] = [];
    fieldErrors[path].push(issue.message);
  }

  return {
    ok: false,
    errorCode: 'MALFORMED_INPUT',
    message: `design-developer agent received an invalid input payload: ${parsed.error.issues.map(i => i.message).join('; ')}`,
    fieldErrors,
    triage:
      'Check the payload passed to the design-developer agent. ' +
      'Required fields: taskId (string), componentName (string), designSpec (object), outputPath (string). ' +
      'Verify the upstream caller serialises the design spec correctly before invoking the agent.',
  };
}
