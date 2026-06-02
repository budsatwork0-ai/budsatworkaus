/**
 * Input validation for the design-developer agent.
 * Checks required design tokens and component prop shapes before execution.
 */
import { z } from 'zod';

// ── Design token schema ──────────────────────────────────────────────────────
// Mirrors the required fields from publicTheme.color used across UI components.
const ColorTokensSchema = z.object({
  accent:   z.string().min(1),
  primary:  z.string().min(1),
  text:     z.string().min(1),
  muted:    z.string().min(1),
  bg:       z.string().min(1),
  card:     z.string().min(1),
  surface:  z.string().min(1),
});

export const PublicThemeSchema = z.object({
  color: ColorTokensSchema,
});

// ── Component prop shape schema ──────────────────────────────────────────────
// Minimal shape expected by the agent's generative step.
export const ComponentInputSchema = z.object({
  componentName: z.string().min(1, 'componentName is required'),
  props:         z.record(z.string(), z.unknown()).optional(),
  theme:         PublicThemeSchema,
});

export type ComponentInput = z.infer<typeof ComponentInputSchema>;

// ── Structured validation result ─────────────────────────────────────────────
export type ValidationOk    = { ok: true;  input: ComponentInput };
export type ValidationError = { ok: false; message: string; details: z.ZodIssue[] };
export type ValidationResult = ValidationOk | ValidationError;

/**
 * Validates agent inputs before execution.
 * Returns a typed discriminated union — never throws.
 */
export function validateDesignDeveloperInput(raw: unknown): ValidationResult {
  const result = ComponentInputSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, input: result.data };
  }
  const first = result.error.issues[0];
  const message = first
    ? `Design-developer agent input invalid: ${first.path.join('.') || 'root'} — ${first.message}`
    : 'Design-developer agent received invalid input.';
  return { ok: false, message, details: result.error.issues };
}
