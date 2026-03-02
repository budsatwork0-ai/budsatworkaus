// Simple in-memory rate limiter for API routes.
// NOTE: Resets on cold starts (serverless). For production scale, replace
// the Map with a Redis/KV-backed store (e.g. Upstash, Vercel KV).

const store = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  limit: number;     // max requests per window
  windowMs: number;  // window in milliseconds
}

export function createRateLimiter(options: RateLimitOptions) {
  return function check(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true, remaining: options.limit - 1 };
    }

    if (entry.count >= options.limit) {
      return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: options.limit - entry.count };
  };
}

// Extract the best-effort client IP from a Next.js request.
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}
