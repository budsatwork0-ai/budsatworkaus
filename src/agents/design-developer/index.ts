/**
 * Design-developer agent entry point.
 *
 * Validates inputs before any execution and emits structured failure events
 * so the bud-observer can track regressions.
 */
import { validateDesignDeveloperInput, type ComponentInput } from './validate';

// ── Structured event types ───────────────────────────────────────────────────
export type AgentSuccessEvent = {
  type:    'design_developer.success';
  input:   ComponentInput;
  output:  unknown;
  durationMs: number;
};

export type AgentFailureEvent = {
  type:    'design_developer.failure';
  reason:  'validation_error' | 'runtime_error';
  message: string;
  details: unknown;
  durationMs: number;
};

export type AgentEvent = AgentSuccessEvent | AgentFailureEvent;

/** Callback signature for callers that want to observe events. */
export type AgentEventHandler = (event: AgentEvent) => void | Promise<void>;

// ── Default no-op emit (replaced in production via runDesignDeveloperAgent) ──
let _emit: AgentEventHandler = () => undefined;

export function setEventHandler(handler: AgentEventHandler): void {
  _emit = handler;
}

// ── Core execution placeholder ────────────────────────────────────────────────
// Replace this with the real design-generation logic.  The entry point
// intentionally keeps orchestration separate from generation so validation
// and event emission are always applied regardless of the implementation.
async function executeDesignStep(input: ComponentInput): Promise<unknown> {
  // TODO: wire real design-generation logic here.
  return { componentName: input.componentName, status: 'generated' };
}

// ── Public entry point ────────────────────────────────────────────────────────
/**
 * Run the design-developer agent.
 *
 * 1. Validates inputs — returns a structured failure event immediately on error.
 * 2. Executes the design step inside a try/catch.
 * 3. Emits a structured success or failure event every time.
 *
 * Never throws — all errors are captured and emitted as failure events.
 */
export async function runDesignDeveloperAgent(
  raw: unknown,
  emit: AgentEventHandler = _emit,
): Promise<AgentEvent> {
  const start = Date.now();

  // ── 1. Input validation ────────────────────────────────────────────────────
  const validation = validateDesignDeveloperInput(raw);
  if (!validation.ok) {
    const event: AgentFailureEvent = {
      type:       'design_developer.failure',
      reason:     'validation_error',
      message:    validation.message,
      details:    validation.details,
      durationMs: Date.now() - start,
    };
    await emit(event);
    return event;
  }

  // ── 2. Execute with runtime error guard ───────────────────────────────────
  try {
    const output = await executeDesignStep(validation.input);
    const event: AgentSuccessEvent = {
      type:       'design_developer.success',
      input:      validation.input,
      output,
      durationMs: Date.now() - start,
    };
    await emit(event);
    return event;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown runtime error in design-developer agent';
    const event: AgentFailureEvent = {
      type:       'design_developer.failure',
      reason:     'runtime_error',
      message,
      details:    err instanceof Error ? err.stack ?? null : String(err),
      durationMs: Date.now() - start,
    };
    await emit(event);
    return event;
  }
}
