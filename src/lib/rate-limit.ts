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
// 10 quote submissions per IP per 15 minutes
export const quoteSubmitRatelimit = createLimiter(10, '15 m');
// 5 confirmation-email resends per IP per 15 minutes
export const resendIpRatelimit = createLimiter(5, '15 m');
// 3 confirmation-email resends per email per 15 minutes
export const resendEmailRatelimit = createLimiter(3, '15 m');
// 120 visitor-tracking writes per IP per 10 minutes (one heartbeat ≈ 30s,
// so this caps a single visitor's session at ~60min before throttle).
export const trackRatelimit = createLimiter(120, '10 m');
// 3 site-feedback submissions per IP per 15 minutes — enough for a real
// bug-report-with-screenshot retry, tight enough to stop bucket flooding.
export const feedbackRatelimit = createLimiter(3, '15 m');

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

// Verify a Cloudflare Turnstile token server-side.
// Returns:
//   { ok: true }                       — token verified, OR no TURNSTILE_SECRET_KEY set (dev/local)
//   { ok: false, status, error }       — caller should return NextResponse.json({error}, {status})
// Gating on the env var keeps local dev working without a Turnstile account.
export async function verifyTurnstile(
  token: string | undefined | null
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true };
  if (!token) {
    return { ok: false, status: 400, error: 'Bot verification required.' };
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
    });
    const data = (await res.json()) as { success: boolean };
    if (!data.success) {
      return { ok: false, status: 403, error: 'Bot verification failed. Please try again.' };
    }
    return { ok: true };
  } catch {
    // Fail closed on network error — better to ask the user to retry than to bypass the gate.
    return { ok: false, status: 503, error: 'Bot verification unavailable. Please try again.' };
  }
}
