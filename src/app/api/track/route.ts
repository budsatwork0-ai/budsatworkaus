// src/app/api/track/route.ts
// Public endpoint for the VisitorTracker component.
// Receives pageview and heartbeat events from the public marketing site,
// upserts the site_visitors table, appends page_views, and cleans stale sessions.
// No authentication required — this endpoint is intentionally public.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

const rateLimiter = createRateLimiter({ limit: 120, windowMs: 10 * 60 * 1000 });

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = getClientIp(req);
  const { allowed } = rateLimiter(ip);
  if (!allowed) {
    return new NextResponse(null, { status: 429 });
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { session_id, page, page_title, referrer, event_type } = body as Record<string, unknown>;

  if (
    typeof session_id !== 'string' || !session_id ||
    typeof page !== 'string' || !page.startsWith('/') ||
    (event_type !== 'pageview' && event_type !== 'heartbeat')
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Drop known bot/crawler traffic — Googlebot uses headless Chrome so it
  // executes JS and would otherwise appear as real visitors from US data centres.
  const ua = req.headers.get('user-agent') ?? '';
  const BOT_RE = /bot|crawler|spider|googlebot|bingbot|slurp|duckduckbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|Discordbot|Applebot|AhrefsBot|SemrushBot|MJ12bot|DotBot/i;
  if (BOT_RE.test(ua)) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClientSafe();
  if (!supabase) {
    // DB unavailable — silently accept so tracker doesn't block the user
    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();

  // Vercel injects these automatically on all deployments — no API key needed
  const rawCity = req.headers.get('x-vercel-ip-city');
  const city = rawCity ? decodeURIComponent(rawCity) : null;
  const country = req.headers.get('x-vercel-ip-country') ?? null;

  // Upsert visitor session — always update current_page and last_seen_at
  const { error: upsertError } = await (supabase as any)
    .from('site_visitors')
    .upsert(
      {
        session_id,
        current_page: page,
        page_title: typeof page_title === 'string' ? page_title : null,
        referrer: event_type === 'pageview' && typeof referrer === 'string' ? referrer : undefined,
        user_agent: ua || null,
        city,
        country,
        last_seen_at: now,
      },
      { onConflict: 'session_id', ignoreDuplicates: false }
    );

  if (upsertError) {
    console.error('[track] upsert site_visitors error:', upsertError.message);
  }

  // Append page view (only for actual navigations, not heartbeats)
  if (event_type === 'pageview') {
    const { error: insertError } = await (supabase as any)
      .from('page_views')
      .insert({
        session_id,
        page,
        page_title: typeof page_title === 'string' ? page_title : null,
        viewed_at: now,
      });

    if (insertError) {
      console.error('[track] insert page_views error:', insertError.message);
    }
  }

  // Clean up stale sessions older than 10 minutes
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { error: deleteError } = await (supabase as any)
    .from('site_visitors')
    .delete()
    .lt('last_seen_at', staleThreshold);

  if (deleteError) {
    console.error('[track] delete stale visitors error:', deleteError.message);
  }

  return NextResponse.json({ ok: true });
}
