/**
 * withOutputGuard — rejects null/empty/schema-invalid agent output.
 * AgentEmptyOutputError is thrown when output is missing or fails validation.
 */

export class AgentEmptyOutputError extends Error {
  constructor(reason: string) {
    super(`Agent produced empty or invalid output: ${reason}`);
    this.name = 'AgentEmptyOutputError';
  }
}

/**
 * Wraps an async producer function and throws AgentEmptyOutputError if
 * the result is null, undefined, or an empty object/array.
 */
export async function withOutputGuard<T>(
  producer: () => Promise<T>,
  isEmpty?: (result: T) => boolean,
): Promise<T> {
  const result = await producer();

  if (result === null || result === undefined) {
    throw new AgentEmptyOutputError('result is null or undefined');
  }

  if (typeof isEmpty === 'function' && isEmpty(result)) {
    throw new AgentEmptyOutputError('result failed isEmpty check');
  }

  if (
    typeof result === 'object' &&
    !Array.isArray(result) &&
    Object.keys(result as object).length === 0
  ) {
    throw new AgentEmptyOutputError('result is an empty object');
  }

  if (Array.isArray(result) && (result as unknown[]).length === 0) {
    throw new AgentEmptyOutputError('result is an empty array');
  }

  return result;
}
