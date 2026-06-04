/**
 * design-developer agent
 *
 * Runs design-to-code checks. Each tool call is wrapped with a try/catch
 * that emits a structured log entry so failures are immediately diagnosable
 * without stalling the pipeline on a non-critical step.
 */

import { createServiceClient } from '@/lib/supabase/server';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DesignDeveloperResult {
  success: boolean;
  /** Partial results are emitted even when individual tool calls fail. */
  findings: DesignFinding[];
  errors: DesignAgentError[];
}

export interface DesignFinding {
  file: string;
  issue: string;
  severity: 'info' | 'warning' | 'error';
}

export interface DesignAgentError {
  operation: string;
  input: unknown;
  message: string;
  timestamp: string;
}

// ─── Structured logger ────────────────────────────────────────────────────────

function logAgentError(entry: DesignAgentError): void {
  // Emit a JSON line so log aggregators can parse it without regex.
  console.error(
    JSON.stringify({
      level: 'error',
      agent: 'design-developer',
      ...entry,
    }),
  );
}

// ─── Safe tool-call wrapper ───────────────────────────────────────────────────

async function safeCall<T>(
  operation: string,
  input: unknown,
  fn: () => Promise<T>,
  errors: DesignAgentError[],
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const entry: DesignAgentError = {
      operation,
      input,
      message: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    };
    logAgentError(entry);
    errors.push(entry);
    // Return null so the caller can apply a graceful fallback.
    return null;
  }
}

// ─── Tool calls ───────────────────────────────────────────────────────────────

/**
 * Fetch design-token snapshot rows from Supabase.
 * Non-critical: if this fails the agent still runs with an empty token list.
 */
async function fetchDesignTokens(
  errors: DesignAgentError[],
): Promise<Record<string, string>> {
  const result = await safeCall(
    'fetchDesignTokens',
    { table: 'design_tokens' },
    async () => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('design_tokens')
        .select('key, value');

      if (error) {
        throw new Error(
          `Supabase query failed for design_tokens: ${error.message}`,
        );
      }

      const tokens: Record<string, string> = {};
      for (const row of data ?? []) {
        if (typeof row.key === 'string' && typeof row.value === 'string') {
          tokens[row.key] = row.value;
        }
      }
      return tokens;
    },
    errors,
  );

  // Graceful fallback — return empty map so downstream steps still run.
  return result ?? {};
}

/**
 * Fetch the list of source files to check from Supabase.
 * Non-critical: if this fails the agent emits a warning finding and exits
 * cleanly rather than throwing.
 */
async function fetchTargetFiles(
  errors: DesignAgentError[],
): Promise<string[]> {
  const result = await safeCall(
    'fetchTargetFiles',
    { table: 'design_review_targets' },
    async () => {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from('design_review_targets')
        .select('file_path');

      if (error) {
        throw new Error(
          `Supabase query failed for design_review_targets: ${error.message}`,
        );
      }

      return (data ?? []).map((r) => r.file_path as string);
    },
    errors,
  );

  return result ?? [];
}

// ─── Core analysis ────────────────────────────────────────────────────────────

/**
 * Placeholder rule: flag any file path that contains a known deprecated pattern.
 * Replace / extend this with real AST or LLM-based checks.
 */
function analyseFile(
  filePath: string,
  tokens: Record<string, string>,
): DesignFinding[] {
  const findings: DesignFinding[] = [];
  void tokens; // tokens available for richer checks

  const DEPRECATED_PATTERNS: Array<{ pattern: RegExp; issue: string }> = [
    {
      pattern: /\/ui\/theme/,
      issue:
        'Import from @/app/ui/theme directly, not from relative ../theme paths.',
    },
  ];

  for (const { pattern, issue } of DEPRECATED_PATTERNS) {
    if (pattern.test(filePath)) {
      findings.push({ file: filePath, issue, severity: 'warning' });
    }
  }

  return findings;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function runDesignDeveloperAgent(): Promise<DesignDeveloperResult> {
  const errors: DesignAgentError[] = [];
  const findings: DesignFinding[] = [];

  // Step 1 — fetch supporting data (both are non-critical; failures are caught).
  const [tokens, targetFiles] = await Promise.all([
    fetchDesignTokens(errors),
    fetchTargetFiles(errors),
  ]);

  if (targetFiles.length === 0 && errors.length > 0) {
    // We couldn't load targets AND had errors — emit a diagnostic finding so
    // the pipeline surfaces the problem without a hard failure.
    findings.push({
      file: '(agent)',
      issue:
        'design-developer agent could not load target files — check Supabase connectivity and table existence.',
      severity: 'warning',
    });
  }

  // Step 2 — analyse each file (graceful: errors per file don't abort the run).
  for (const filePath of targetFiles) {
    const fileFindings = await safeCall(
      'analyseFile',
      { filePath },
      async () => analyseFile(filePath, tokens),
      errors,
    );
    if (fileFindings) {
      findings.push(...fileFindings);
    }
  }

  return {
    success: errors.length === 0,
    findings,
    errors,
  };
}
