/**
 * Startup validation for LLM-related environment variables.
 * Call assertLLMConfig() once at agent-runner entry point before any LLM call.
 */

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

const REQUIRED_LLM_ENV_VARS: ReadonlyArray<{
  key: string;
  /** Optional regex the value must satisfy */
  pattern?: RegExp;
  description: string;
}> = [
  {
    key: 'OPENAI_API_KEY',
    pattern: /^sk-[A-Za-z0-9_-]{20,}$/,
    description: 'OpenAI API key (must start with "sk-" followed by at least 20 alphanumeric/dash/underscore characters)',
  },
];

/**
 * Asserts that all required LLM environment variables are present and
 * well-formed.  Throws a ConfigurationError with a descriptive message
 * identifying the first offending variable so the root cause is immediately
 * visible in logs rather than surfacing as an ambiguous runtime failure.
 */
export function assertLLMConfig(): void {
  for (const { key, pattern, description } of REQUIRED_LLM_ENV_VARS) {
    const value = process.env[key];

    if (!value || value.trim() === '') {
      throw new ConfigurationError(
        `[ConfigurationError] Required environment variable "${key}" is missing or empty. ` +
          `Expected: ${description}.`,
      );
    }

    if (pattern && !pattern.test(value.trim())) {
      throw new ConfigurationError(
        `[ConfigurationError] Environment variable "${key}" is present but malformed. ` +
          `Expected: ${description}.`,
      );
    }
  }
}
