/**
 * output-validator.ts
 *
 * Lightweight output-contract validator for agent file-write operations.
 * Call `validateAgentOutput` after any file write to confirm the output
 * is non-empty and structurally plausible before marking the task done.
 */

export class AgentOutputError extends Error {
  constructor(
    message: string,
    public readonly file: string,
    public readonly details?: string,
  ) {
    super(`[AgentOutputError] ${file}: ${message}${details ? ` — ${details}` : ''}`);
    this.name = 'AgentOutputError';
  }
}

/** Minimum character length before we consider content non-trivial. */
const MIN_LENGTH = 20;

/**
 * Checks that opening and closing counts of a delimiter pair are equal.
 * Used as a lightweight structural heuristic — it is not a full parser.
 */
function balanced(content: string, open: string, close: string): boolean {
  let depth = 0;
  for (let i = 0; i < content.length; i++) {
    if (content.startsWith(open, i)) depth++;
    else if (content.startsWith(close, i)) depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

type FileType = 'tsx' | 'ts' | 'json' | 'unknown';

function detectType(file: string): FileType {
  if (file.endsWith('.tsx')) return 'tsx';
  if (file.endsWith('.ts')) return 'ts';
  if (file.endsWith('.json')) return 'json';
  return 'unknown';
}

/**
 * Validates agent output for a given file path.
 *
 * @param file    - The file path that was written (used for type detection and error messages).
 * @param content - The string content that was written.
 * @throws {AgentOutputError} if the content fails any validation check.
 */
export function validateAgentOutput(file: string, content: unknown): void {
  // ── 1. Presence check ──────────────────────────────────────────────────────
  if (content === null || content === undefined) {
    throw new AgentOutputError('output is null or undefined', file);
  }

  if (typeof content !== 'string') {
    throw new AgentOutputError(
      'output is not a string',
      file,
      `received type "${typeof content}"`,
    );
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    throw new AgentOutputError('output is empty', file);
  }

  // ── 2. Minimum length ─────────────────────────────────────────────────────
  if (trimmed.length < MIN_LENGTH) {
    throw new AgentOutputError(
      `output is too short (${trimmed.length} chars, minimum ${MIN_LENGTH})`,
      file,
    );
  }

  // ── 3. Structural heuristics per file type ────────────────────────────────
  const type = detectType(file);

  if (type === 'json') {
    try {
      JSON.parse(trimmed);
    } catch (err) {
      throw new AgentOutputError(
        'output is not valid JSON',
        file,
        err instanceof Error ? err.message : String(err),
      );
    }
    return;
  }

  if (type === 'tsx' || type === 'ts') {
    // Balanced curly braces
    if (!balanced(trimmed, '{', '}')) {
      throw new AgentOutputError('output has unbalanced curly braces', file);
    }
    // Balanced parentheses
    if (!balanced(trimmed, '(', ')')) {
      throw new AgentOutputError('output has unbalanced parentheses', file);
    }
    // TSX: balanced angle-bracket tags (very rough — catches truncated renders)
    if (type === 'tsx' && !balanced(trimmed, '<', '>')) {
      throw new AgentOutputError('output has unbalanced angle brackets', file);
    }
    return;
  }

  // For unknown types we only apply the presence + length checks above.
}
