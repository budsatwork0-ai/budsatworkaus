import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates the CRON_SECRET on every cron route.
 * Returns a 401 response if the secret is missing from the environment
 * or the Authorization header does not match — fail-closed by design.
 * Returns null when the request is authorised and the route may proceed.
 */
export function requireCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
