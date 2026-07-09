import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';

const VALID_SECRET = 'test-cron-secret-abc123';

function makeRequest(authHeader?: string): NextRequest {
  return new NextRequest('http://localhost/api/cron/test', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('requireCronAuth — fail-closed security invariants', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = VALID_SECRET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('returns null (authorised) when the header matches CRON_SECRET', async () => {
    const result = requireCronAuth(makeRequest(`Bearer ${VALID_SECRET}`));
    expect(result).toBeNull();
  });

  it('returns 401 when the Authorization header is wrong', async () => {
    const result = requireCronAuth(makeRequest('Bearer wrong-secret'));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const body = await result!.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when no Authorization header is present', async () => {
    const result = requireCronAuth(makeRequest());
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET env var is missing (fail-closed)', async () => {
    delete process.env.CRON_SECRET;
    // Even with the correct value that was previously valid, no env var → reject
    const result = requireCronAuth(makeRequest(`Bearer ${VALID_SECRET}`));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it('returns 401 for a Bearer-prefix-only header with no secret', async () => {
    const result = requireCronAuth(makeRequest('Bearer '));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});
