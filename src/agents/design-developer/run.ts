import { DesignInsightPayloadSchema, type DesignInsightPayload } from './schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileWrite {
  path: string;
  originalContent: string | null;
  written: boolean;
}

export interface RunContext {
  /** Write a file; returns original content for rollback (null if file did not exist). */
  writeFile: (path: string, content: string) => Promise<string | null>;
  /** Restore a file to its original state (or delete if originalContent is null). */
  restoreFile: (path: string, originalContent: string | null) => Promise<void>;
  /** Create a pull request; returns the PR URL. */
  createPR: (proposalId: string, changedPaths: string[]) => Promise<string>;
  /** Structured logger. */
  log: (level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) => void;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Design-developer agent entry point.
 *
 * 1. Validates the incoming payload with Zod — rejects null/malformed inputs
 *    immediately and logs the proposalId for traceability.
 * 2. Performs file writes and PR creation inside a rollback-on-error block so
 *    partial changes are always reverted on failure.
 */
export async function runDesignDeveloperAgent(
  rawPayload: unknown,
  ctx: RunContext,
): Promise<{ prUrl: string }> {
  // ── Step 1: validate input ────────────────────────────────────────────────
  const parseResult = DesignInsightPayloadSchema.safeParse(rawPayload);

  if (!parseResult.success) {
    const proposalId =
      rawPayload != null &&
      typeof rawPayload === 'object' &&
      'proposalId' in rawPayload &&
      typeof (rawPayload as Record<string, unknown>).proposalId === 'string'
        ? (rawPayload as Record<string, unknown>).proposalId
        : '<unknown>';

    ctx.log('error', 'design-developer: invalid input payload — aborting', {
      proposalId,
      validationErrors: parseResult.error.issues,
    });

    throw new Error(
      `design-developer: invalid payload (proposalId=${proposalId}): ${
        parseResult.error.issues.map((i) => i.message).join('; ')
      }`,
    );
  }

  const payload: DesignInsightPayload = parseResult.data;
  const { proposalId } = payload;

  ctx.log('info', 'design-developer: starting run', { proposalId });

  // ── Step 2: file writes with rollback-on-error ────────────────────────────
  const written: FileWrite[] = [];

  try {
    for (const targetPath of payload.targetFiles) {
      ctx.log('info', 'design-developer: writing file', { proposalId, targetPath });

      const originalContent = await ctx.writeFile(targetPath, payload.insight);
      written.push({ path: targetPath, originalContent, written: true });
    }

    // ── Step 3: create PR ──────────────────────────────────────────────────
    ctx.log('info', 'design-developer: creating PR', {
      proposalId,
      changedPaths: payload.targetFiles,
    });

    const prUrl = await ctx.createPR(
      proposalId,
      payload.targetFiles,
    );

    ctx.log('info', 'design-developer: run complete', { proposalId, prUrl });

    return { prUrl };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    ctx.log('error', 'design-developer: error — rolling back partial changes', {
      proposalId,
      error: message,
      filesToRollback: written.map((w) => w.path),
    });

    // Rollback all successfully written files in reverse order
    for (const fileWrite of [...written].reverse()) {
      try {
        await ctx.restoreFile(fileWrite.path, fileWrite.originalContent);
        ctx.log('info', 'design-developer: rolled back file', {
          proposalId,
          path: fileWrite.path,
        });
      } catch (rollbackErr: unknown) {
        ctx.log('warn', 'design-developer: rollback failed for file', {
          proposalId,
          path: fileWrite.path,
          rollbackError:
            rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
        });
      }
    }

    throw new Error(
      `design-developer: run failed (proposalId=${proposalId}): ${message}`,
    );
  }
}
