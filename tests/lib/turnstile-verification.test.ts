import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstile } from '@/lib/rate-limit';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('server verification', () => {
  it('rejects missing tokens before contacting the provider', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await verifyTurnstile(null)).toMatchObject({ ok: false, status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('accepts a provider-verified token with a bounded request', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetch);
    expect(await verifyTurnstile('token')).toEqual({ ok: true });
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it('fails closed and returns a retryable error when the provider times out', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Timed out', 'TimeoutError')));
    expect(await verifyTurnstile('token')).toMatchObject({ ok: false, status: 503 });
  });
  it('rejects a consumed token and logs provider codes without logging the secret or token', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false, 'error-codes': ['timeout-or-duplicate'] }) }));
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await verifyTurnstile('consumed-token')).toMatchObject({ ok: false, status: 403 });
    expect(log).toHaveBeenCalledWith('[turnstile] verification rejected:', ['timeout-or-duplicate']);
  });
});
