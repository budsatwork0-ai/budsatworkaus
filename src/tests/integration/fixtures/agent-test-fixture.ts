/**
 * Shared test fixture providing reusable LLM and Supabase mocks
 * for integration tests across agent suites.
 */
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// LLM mock factory
// ---------------------------------------------------------------------------

export interface LLMResponse {
  content: string;
}

/**
 * Returns a vi-mocked LLM client whose `invoke` resolves to the supplied
 * content string.  Pass a JSON string to simulate structured LLM outputs.
 */
export function makeLLMMock(responseContent: string = '{}') {
  return {
    invoke: vi.fn().mockResolvedValue({ content: responseContent } satisfies LLMResponse),
  };
}

// ---------------------------------------------------------------------------
// Supabase mock factory
// ---------------------------------------------------------------------------

export interface SupabaseMockRow {
  [key: string]: unknown;
}

/**
 * Returns a minimal vi-mocked Supabase client whose `from().insert()` chain
 * resolves successfully by default.  Override `insertResult` to simulate
 * errors or custom return data.
 */
export function makeSupabaseMock(
  insertResult: { data: unknown; error: null | { message: string } } = {
    data: [{ id: 'test-id' }],
    error: null,
  },
) {
  const insertMock = vi.fn().mockResolvedValue(insertResult);
  const selectMock = vi.fn().mockResolvedValue({ data: [], error: null });

  const fromMock = vi.fn().mockReturnValue({
    insert: insertMock,
    select: selectMock,
  });

  return {
    from: fromMock,
    // expose inner mocks so tests can assert on them
    _mocks: { insertMock, selectMock, fromMock },
  };
}

// ---------------------------------------------------------------------------
// Convenience reset helper
// ---------------------------------------------------------------------------

/** Call in beforeEach / afterEach to clear all mock state. */
export function resetFixtureMocks(
  ...mocks: Array<{ _mocks: Record<string, ReturnType<typeof vi.fn>> }>
) {
  for (const fixture of mocks) {
    for (const mock of Object.values(fixture._mocks)) {
      mock.mockClear();
    }
  }
}
