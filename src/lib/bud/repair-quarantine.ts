/**
 * Repair Quarantine
 *
 * Prevents failed bud/* repair branches from being repeatedly patched after
 * rejection. Any branch that fails CI repair is blocked for 24 hours.
 * After two failures it is marked abandoned and requires a fresh branch from main.
 *
 * The quarantine operates at two call sites:
 *   1. /api/cron/vercel-repair — checked before calling triggerImprovement()
 *   2. improvement-executor   — updated on CI failure, cleared on success
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const QUARANTINE_WINDOW_MS = 86_400_000; // 24 hours
const MAX_REPAIR_ATTEMPTS = 2;

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuarantineCheck =
  | { blocked: false; attemptCount: number }
  | { blocked: true; abandoned: false; blockedUntil: string; attemptCount: number }
  | { blocked: true; abandoned: true; attemptCount: number };

type QuarantineRecord = {
  status: string;
  blocked_until: string;
  attempt_count: number;
};

// ── Core helpers ──────────────────────────────────────────────────────────────

/**
 * Check whether a branch is currently quarantined.
 * Returns `{ blocked: false }` when no record exists or the window has expired.
 */
export async function checkQuarantine(
  supabase: SupabaseClient,
  branch: string,
): Promise<QuarantineCheck> {
  const { data } = await supabase
    .from('bud_repair_quarantine')
    .select('status, blocked_until, attempt_count')
    .eq('branch', branch)
    .maybeSingle();

  if (!data) return { blocked: false, attemptCount: 0 };

  const row = data as QuarantineRecord;

  if (row.status === 'resolved') {
    return { blocked: false, attemptCount: row.attempt_count };
  }

  if (row.status === 'abandoned') {
    return { blocked: true, abandoned: true, attemptCount: row.attempt_count };
  }

  // blocked_for_repair — check if the window has expired
  const blockedUntil = new Date(row.blocked_until);
  if (blockedUntil > new Date()) {
    return {
      blocked: true,
      abandoned: false,
      blockedUntil: row.blocked_until,
      attemptCount: row.attempt_count,
    };
  }

  // Window expired — unblocked
  return { blocked: false, attemptCount: row.attempt_count };
}

/**
 * Record a failed repair attempt for a branch.
 * Upserts via the unique branch constraint — increments attempt_count on conflict.
 * Returns the new attempt count and whether the branch is now abandoned.
 */
export async function recordFailedAttempt(
  supabase: SupabaseClient,
  params: {
    branch: string;
    commitSha?: string | null;
    deploymentId?: string | null;
    errorText?: string | null;
    failingFile?: string | null;
    failingLine?: number | null;
    sourceAgent?: string;
    rejectionReason?: string;
  },
): Promise<{ attemptCount: number; abandoned: boolean }> {
  const blockedUntil = new Date(Date.now() + QUARANTINE_WINDOW_MS).toISOString();
  const now = new Date().toISOString();

  // Read existing record to get current attempt count
  const { data: existing } = await supabase
    .from('bud_repair_quarantine')
    .select('id, attempt_count')
    .eq('branch', params.branch)
    .maybeSingle();

  const existingRow = existing as { id: string; attempt_count: number } | null;
  const newAttemptCount = (existingRow?.attempt_count ?? 0) + 1;
  const abandoned = newAttemptCount >= MAX_REPAIR_ATTEMPTS;
  const newStatus = abandoned ? 'abandoned' : 'blocked_for_repair';

  if (existingRow) {
    await supabase
      .from('bud_repair_quarantine')
      .update({
        attempt_count: newAttemptCount,
        status: newStatus,
        blocked_until: blockedUntil,
        error_text: params.errorText?.slice(0, 2000) ?? null,
        failing_file: params.failingFile ?? null,
        failing_line: params.failingLine ?? null,
        rejection_reason: params.rejectionReason ?? null,
        commit_sha: params.commitSha ?? null,
        source_agent: params.sourceAgent ?? null,
        updated_at: now,
      })
      .eq('branch', params.branch);
  } else {
    await supabase
      .from('bud_repair_quarantine')
      .insert({
        branch: params.branch,
        attempt_count: 1,
        status: newStatus,
        blocked_until: blockedUntil,
        commit_sha: params.commitSha ?? null,
        deployment_id: params.deploymentId ?? null,
        error_text: params.errorText?.slice(0, 2000) ?? null,
        failing_file: params.failingFile ?? null,
        failing_line: params.failingLine ?? null,
        source_agent: params.sourceAgent ?? null,
        rejection_reason: params.rejectionReason ?? null,
      });
  }

  return { attemptCount: newAttemptCount, abandoned };
}

/**
 * Clear quarantine for a branch after a successful repair.
 * Marks the record `resolved` rather than deleting it, preserving audit history.
 */
export async function clearQuarantine(
  supabase: SupabaseClient,
  branch: string,
): Promise<void> {
  await supabase
    .from('bud_repair_quarantine')
    .update({ status: 'resolved', updated_at: new Date().toISOString() })
    .eq('branch', branch);
}

// ── Pre-push verification ─────────────────────────────────────────────────────

/**
 * Extract the first source-file reference from a TypeScript CI error log.
 * Returns the file path and line number if found.
 */
export function extractFailingFileFromLog(
  errorLog: string,
): { file: string | null; line: number | null } {
  const match = errorLog.match(/\b(src\/[\w/.-]+\.tsx?)(?::(\d+))?/);
  if (match) {
    return {
      file: match[1],
      line: match[2] ? parseInt(match[2], 10) : null,
    };
  }
  return { file: null, line: null };
}

/**
 * Heuristic pre-push check: detect whether a known bad pattern from a previous
 * failure still appears in the proposed patches.
 *
 * This catches the most common case — a wrong import name or missing export that
 * the LLM duplicates in the corrective patch. It cannot replace running `tsc`,
 * but it catches obvious repeats before we burn a CI run.
 *
 * Returns null when the error appears resolved (or cannot be checked).
 * Returns a reason string when the error is likely still present.
 */
export function verifyErrorResolved(
  patches: Array<{ file: string; content: string }>,
  previousErrorText: string,
): string | null {
  if (!previousErrorText) return null;

  // Pattern: "'X' is not exported from 'Y'" / "has no exported member 'X'"
  const badExportMatch = previousErrorText.match(
    /'([^']+)' (?:is not exported from|has no exported member)/,
  );
  if (badExportMatch) {
    const badSymbol = badExportMatch[1];
    for (const patch of patches) {
      // The symbol appears in an import statement in the patched file — likely still broken
      if (
        patch.content.includes(`{ ${badSymbol}`) ||
        patch.content.includes(`, ${badSymbol}`) ||
        patch.content.includes(`${badSymbol} }`)
      ) {
        return `Patch still imports '${badSymbol}' which was not exported in the previous build`;
      }
    }
  }

  // Pattern: "Module not found: Can't resolve 'X'" / "Attempted import error: 'X'"
  const badModuleMatch = previousErrorText.match(
    /(?:Cannot find module|Attempted import error[^:]*:)\s+'([^']+)'/,
  );
  if (badModuleMatch) {
    const badModule = badModuleMatch[1];
    for (const patch of patches) {
      if (patch.content.includes(`from '${badModule}'`) || patch.content.includes(`require('${badModule}')`)) {
        return `Patch still imports from '${badModule}' which could not be resolved in the previous build`;
      }
    }
  }

  return null;
}
