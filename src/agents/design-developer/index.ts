import { z } from 'zod';
import { buildDegradedSignal } from '@/agents/shared/degraded-signal';

// ─── Input schema ─────────────────────────────────────────────────────────────
// Validates snapshot/context data before any processing occurs.
// Unknown extra keys are stripped (z.object default) to tolerate upstream additions.
const SnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  capturedAt: z.string().min(1),
  viewport: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  components: z.array(
    z.object({
      id: z.string().min(1),
      type: z.string().min(1),
      props: z.record(z.string(), z.unknown()).optional(),
    })
  ),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type DesignDeveloperSnapshot = z.infer<typeof SnapshotSchema>;

// ─── Agent result type ────────────────────────────────────────────────────────
export type DesignDeveloperResult =
  | { status: 'ok';       output: Record<string, unknown> }
  | { status: 'degraded'; signal: ReturnType<typeof buildDegradedSignal> };

// ─── Agent entry point ────────────────────────────────────────────────────────
export async function runDesignDeveloperAgent(
  rawInput: unknown
): Promise<DesignDeveloperResult> {
  // 1. Validate input against schema — emit degraded signal on invalid input
  //    rather than propagating a runtime error downstream.
  const parsed = SnapshotSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    const signal = buildDegradedSignal({
      agent: 'design-developer',
      reason: `invalid_input: ${issues}`,
      rawInput,
    });
    return { status: 'degraded', signal };
  }

  // 2. All processing uses the validated, typed snapshot from here on.
  const snapshot = parsed.data;

  try {
    // Core agent logic placeholder — replace with actual implementation.
    // At this point `snapshot` is fully typed and guaranteed structurally valid.
    const output: Record<string, unknown> = {
      snapshotId: snapshot.snapshotId,
      processedAt: new Date().toISOString(),
      componentCount: snapshot.components.length,
    };

    return { status: 'ok', output };
  } catch (err) {
    const signal = buildDegradedSignal({
      agent: 'design-developer',
      reason: err instanceof Error ? err.message : String(err),
      rawInput: snapshot,
    });
    return { status: 'degraded', signal };
  }
}
