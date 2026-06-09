import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import {
  checkRateLimit,
  createRateLimiter,
  getClientIp,
  trackRatelimit,
} from '@/lib/rate-limit';

const fallbackLimiter = createRateLimiter({ limit: 120, windowMs: 10 * 60 * 1000 });

const BOT_RE = /bot|crawler|spider|googlebot|bingbot|slurp|duckduckbot|facebookexternalhit/i;

const VALID_EVENTS = new Set([
  'service_selected',
  'card_expanded',
  'config_started',
  'add_to_quote',
  'quote_submitted',
]);

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed } = trackRatelimit
    ? await checkRateLimit(trackRatelimit, ip)
    : fallbackLimiter(ip);
  if (!allowed) return new NextResponse(null, { status: 429 });

  const ua = req.headers.get('user-agent') ?? '';
  if (BOT_RE.test(ua)) return NextResponse.json({ ok: true });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const {
    session_id,
    event_name,
    service,
    scope,
    context,
    time_spent_seconds,
    config_changes,
    quote_submitted,
  } = b;

  if (typeof session_id !== 'string' || !session_id) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
  }
  if (typeof event_name !== 'string' || !VALID_EVENTS.has(event_name)) {
    return NextResponse.json({ error: 'Unknown event_name' }, { status: 400 });
  }

  const supabase = createServiceClientSafe();
  if (!supabase) return NextResponse.json({ ok: true });

  await (supabase as any).from('quote_funnel_events').insert({
    session_id,
    event_name,
    service:            typeof service  === 'string'  ? service  : null,
    scope:              typeof scope    === 'string'  ? scope    : null,
    context:            typeof context  === 'string'  ? context  : null,
    time_spent_seconds: typeof time_spent_seconds === 'number' ? Math.round(time_spent_seconds) : null,
    config_changes:     typeof config_changes     === 'number' ? Math.round(config_changes)     : null,
    quote_submitted:    typeof quote_submitted    === 'boolean' ? quote_submitted : null,
  });

  return NextResponse.json({ ok: true });
}
