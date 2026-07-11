/**
 * Daily marketing metrics sync.
 *
 * Pulls reach / engagement / follower counts from the connected Meta
 * (Instagram + Facebook) accounts and writes a source='api' snapshot into
 * public.marketing_metrics, then refreshes the 'combined' row for the day.
 *
 * Manual entry in the Marketing Studio stays available as a fallback; this
 * job simply overwrites the day's row for any channel it can read from the API.
 * Falls back cleanly (200 + skipped) when Meta isn't configured yet.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { fetchMetaMetrics, isMetaConfigured } from '@/lib/marketing/meta';

export const dynamic = 'force-dynamic';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  if (!isMetaConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'meta_not_configured' });
  }

  const client = createServiceClientSafe();
  if (!client) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = client as any;

  const { configured, metrics, errors } = await fetchMetaMetrics();
  if (!configured) {
    return NextResponse.json({ ok: true, skipped: 'meta_not_configured' });
  }

  const date = today();
  let written = 0;

  for (const m of metrics) {
    // Preserve content_published (auto-counted from the queue) — don't overwrite it.
    const { data: existing } = await db
      .from('marketing_metrics')
      .select('content_published')
      .eq('snapshot_date', date)
      .eq('channel', m.channel)
      .maybeSingle();

    const { error } = await db.from('marketing_metrics').upsert({
      snapshot_date: date,
      channel: m.channel,
      views: m.views,
      engagements: m.engagements,
      followers: m.followers,
      content_published: Number(existing?.content_published ?? 0),
      source: 'api',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'snapshot_date,channel' });

    if (error) errors.push(`${m.channel}: ${error.message}`);
    else written += 1;
  }

  // Refresh the 'combined' roll-up for the day from all per-channel rows.
  if (written > 0) {
    const { data: rows } = await db
      .from('marketing_metrics')
      .select('channel, views, engagements, followers, content_published')
      .eq('snapshot_date', date)
      .neq('channel', 'combined');

    type Row = { views: number; engagements: number; followers: number; content_published: number };
    const list = (rows ?? []) as Row[];
    const sum = (k: keyof Row) => list.reduce((a, r) => a + (Number(r[k]) || 0), 0);

    await db.from('marketing_metrics').upsert({
      snapshot_date: date,
      channel: 'combined',
      views: sum('views'),
      engagements: sum('engagements'),
      followers: sum('followers'),
      content_published: sum('content_published'),
      source: 'api',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'snapshot_date,channel' });
  }

  return NextResponse.json({ ok: true, date, channels_written: written, errors });
}
