/**
 * Shared output-emptiness guard.
 * Returns true when a nominally-successful agent run produced no usable output.
 * Reusable by any agent that needs to detect silent no-output completions.
 */
export function isEmpty(output: unknown): boolean {
  if (output === null || output === undefined) return true;
  if (typeof output === 'object') {
    if (Array.isArray(output)) return output.length === 0;
    return Object.keys(output as Record<string, unknown>).length === 0;
  }
  if (typeof output === 'string') return output.trim().length === 0;
  return false;
}
