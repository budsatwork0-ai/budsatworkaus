// src/app/api/track/route.ts
// Enhanced public endpoint for the VisitorTracker component.
// Handles: pageview, heartbeat, engagement (scroll/time data), and event (CTA clicks).
// Writes to: site_visitors (live presence), page_views (append-only log),
//            analytics_sessions (persistent historical), visitor_events (CTA tracking).

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

const rateLimiter = createRateLimiter({ limit: 120, windowMs: 10 * 60 * 1000 });

const BOT_RE = /bot|crawler|spider|googlebot|bingbot|slurp|duckduckbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|Discordbot|Applebot|AhrefsBot|SemrushBot|MJ12bot|DotBot/i;

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = getClientIp(req);
  const { allowed } = rateLimiter(ip);
  if (!allowed) return new NextResponse(null, { status: 429 });

  // Parse body
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const {
    session_id,
    page,
    page_title,
    referrer,
    event_type,
    is_returning,
    // UTM params (sent on first pageview only)
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    // Engagement data for the PREVIOUS page (sent with each pageview)
    prev_page,
    prev_time_on_page,
    prev_scroll_depth,
    // Engagement flush (event_type === 'engagement')
    time_on_page,
    scroll_depth,
    // CTA events (event_type === 'event')
    event_name,
    event_label,
  } = b;

  const validEventTypes = ['pageview', 'heartbeat', 'engagement', 'event'];

  if (
    typeof session_id !== 'string' || !session_id ||
    typeof page !== 'string' || !page.startsWith('/') ||
    !validEventTypes.includes(event_type as string)
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Drop bots
  const ua = req.headers.get('user-agent') ?? '';
  if (BOT_RE.test(ua)) return NextResponse.json({ ok: true });

  const supabase = createServiceClientSafe();
  if (!supabase) return NextResponse.json({ ok: true });

  const now = new Date().toISOString();

  // Vercel geolocation headers
  const rawCity = req.headers.get('x-vercel-ip-city');
  const city = rawCity ? decodeURIComponent(rawCity) : null;
  const country = req.headers.get('x-vercel-ip-country') ?? null;

  // -------------------------------------------------------------------------
  // 1. UPSERT site_visitors (live presence table — still cleaned every 10 min)
  // -------------------------------------------------------------------------
  if (event_type !== 'engagement') {
    await (supabase as any)
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
  }

  // -------------------------------------------------------------------------
  // 2. UPSERT analytics_sessions (persistent — never deleted)
  // -------------------------------------------------------------------------
  if (event_type === 'pageview') {
    // Try INSERT first (new session). If conflict, UPDATE last_seen + pages_visited.
    const { error: insertErr } = await (supabase as any)
      .from('analytics_sessions')
      .insert({
        session_id,
        referrer: typeof referrer === 'string' ? referrer : null,
        user_agent: ua || null,
        city,
        country,
        utm_source: typeof utm_source === 'string' ? utm_source : null,
        utm_medium: typeof utm_medium === 'string' ? utm_medium : null,
        utm_campaign: typeof utm_campaign === 'string' ? utm_campaign : null,
        utm_term: typeof utm_term === 'string' ? utm_term : null,
        utm_content: typeof utm_content === 'string' ? utm_content : null,
        is_returning: Boolean(is_returning),
        pages_visited: 1,
        total_seconds: 0,
        first_seen_at: now,
        last_seen_at: now,
      });

    if (insertErr) {
      // Session already exists — increment pages_visited and update last_seen
      await (supabase as any).rpc('increment_session_pages', { p_session_id: session_id, p_now: now });
    }
  }

  // Update total time on site when we receive engagement data
  if ((event_type === 'engagement' || event_type === 'pageview') && typeof time_on_page === 'number' && time_on_page > 0) {
    await (supabase as any).rpc('increment_session_time', {
      p_session_id: session_id,
      p_seconds: Math.min(time_on_page, 1800), // cap at 30 min
      p_now: now,
    });
  }

  // -------------------------------------------------------------------------
  // 3. INSERT page_views (append-only)
  // -------------------------------------------------------------------------
  if (event_type === 'pageview') {
    await (supabase as any)
      .from('page_views')
      .insert({
        session_id,
        page,
        page_title: typeof page_title === 'string' ? page_title : null,
        viewed_at: now,
        utm_source: typeof utm_source === 'string' ? utm_source : null,
        utm_medium: typeof utm_medium === 'string' ? utm_medium : null,
        utm_campaign: typeof utm_campaign === 'string' ? utm_campaign : null,
      });
  }

  // -------------------------------------------------------------------------
  // 4. UPDATE prev page's engagement data (scroll_depth + time_on_page)
  // Sent alongside a new pageview — applies to the page the visitor just left.
  // -------------------------------------------------------------------------
  if (
    event_type === 'pageview' &&
    typeof prev_page === 'string' && prev_page &&
    (typeof prev_time_on_page === 'number' || typeof prev_scroll_depth === 'number')
  ) {
    // Update the most recent page_view row for this session + page
    await (supabase as any)
      .from('page_views')
      .update({
        ...(typeof prev_time_on_page === 'number' ? { time_on_page: Math.min(prev_time_on_page, 3600) } : {}),
        ...(typeof prev_scroll_depth === 'number' ? { scroll_depth: Math.min(prev_scroll_depth, 100) } : {}),
      })
      .eq('session_id', session_id)
      .eq('page', prev_page)
      .order('viewed_at', { ascending: false })
      .limit(1);
  }

  // Handle engagement flush (beforeunload / visibilitychange)
  if (event_type === 'engagement') {
    if (typeof time_on_page === 'number' || typeof scroll_depth === 'number') {
      await (supabase as any)
        .from('page_views')
        .update({
          ...(typeof time_on_page === 'number' ? { time_on_page: Math.min(time_on_page, 3600) } : {}),
          ...(typeof scroll_depth === 'number' ? { scroll_depth: Math.min(scroll_depth as number, 100) } : {}),
        })
        .eq('session_id', session_id)
        .eq('page', page)
        .order('viewed_at', { ascending: false })
        .limit(1);
    }
  }

  // -------------------------------------------------------------------------
  // 5. INSERT visitor_events (CTA clicks / custom events)
  // -------------------------------------------------------------------------
  if (event_type === 'event' && typeof event_name === 'string' && event_name) {
    await (supabase as any)
      .from('visitor_events')
      .insert({
        session_id,
        event_name,
        event_label: typeof event_label === 'string' ? event_label : null,
        page,
        created_at: now,
      });
  }

  // -------------------------------------------------------------------------
  // 6. CLEAN stale site_visitors (live presence only — not analytics_sessions)
  // -------------------------------------------------------------------------
  if (event_type === 'pageview' || event_type === 'heartbeat') {
    const staleThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await (supabase as any)
      .from('site_visitors')
      .delete()
      .lt('last_seen_at', staleThreshold);
  }

  return NextResponse.json({ ok: true });
}
