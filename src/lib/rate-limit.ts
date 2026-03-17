// Redis-backed rate limiter using Upstash.
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your environment.
// Falls back to allow-all if env vars are absent (local dev without Redis).

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

function createLimiter(requests: number, window: string) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window as any) });
}

// 5 registrations per IP per 15 minutes
export const ipRatelimit = createLimiter(5, '15 m');
// 3 registrations per email per hour
export const emailRatelimit = createLimiter(3, '1 h');

export async function checkRateLimit(
  limiter: Ratelimit | null,
  key: string
): Promise<{ allowed: boolean }> {
  if (!limiter) return { allowed: true };
  const { success } = await limiter.limit(key);
  return { allowed: success };
}

// Simple in-memory sliding-window rate limiter factory.
// Returns a synchronous check function — suitable for serverless edge use where
// Redis isn't needed for every endpoint.
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();
  return function check(key: string): { allowed: boolean } {
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = (hits.get(key) ?? []).filter(t => t > windowStart);
    if (timestamps.length >= limit) {
      hits.set(key, timestamps);
      return { allowed: false };
    }
    timestamps.push(now);
    hits.set(key, timestamps);
    return { allowed: true };
  };
}

// Extract the best-effort client IP from a Next.js request.
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}
