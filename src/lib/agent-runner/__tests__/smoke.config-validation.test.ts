/**
 * smoke.config-validation.test.ts
 *
 * Smoke tests for the ConfigurationError class and assertLLMConfig() helper.
 * Verifies happy-path passes silently and bad config throws a ConfigurationError.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigurationError, assertLLMConfig } from '@/lib/agent-runner/config-validation';

const REQUIRED_ENV: Record<string, string> = {
  LLM_API_KEY: 'smoke-test-key',
  LLM_MODEL: 'gpt-4o',
  LLM_BASE_URL: 'https://api.openai.com/v1',
};

function setEnv(overrides: Partial<Record<string, string | undefined>> = {}) {
  const merged = { ...REQUIRED_ENV, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

beforeEach(() => setEnv());
afterEach(() => {
  for (const key of Object.keys(REQUIRED_ENV)) {
    delete process.env[key];
  }
});

describe('ConfigurationError', () => {
  it('is an instance of Error', () => {
    const err = new ConfigurationError('bad config');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ConfigurationError);
    expect(err.message).toBe('bad config');
    expect(err.name).toBe('ConfigurationError');
  });
});

describe('assertLLMConfig — smoke test', () => {
  it('does not throw when all required env vars are present', () => {
    expect(() => assertLLMConfig()).not.toThrow();
  });

  it('throws ConfigurationError when LLM_API_KEY is missing', () => {
    setEnv({ LLM_API_KEY: undefined });
    expect(() => assertLLMConfig()).toThrow(ConfigurationError);
  });

  it('throws ConfigurationError when LLM_MODEL is missing', () => {
    setEnv({ LLM_MODEL: undefined });
    expect(() => assertLLMConfig()).toThrow(ConfigurationError);
  });

  it('throws ConfigurationError when LLM_BASE_URL is missing', () => {
    setEnv({ LLM_BASE_URL: undefined });
    expect(() => assertLLMConfig()).toThrow(ConfigurationError);
  });
});
