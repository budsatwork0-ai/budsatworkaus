import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const db = createServiceClientSafe();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const thirtyDaysAgo     = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgoDate = thirtyDaysAgo.slice(0, 10);

  const [
    journalsRes,
    oppsCreatedRes,
    oppsConvertedRes,
    ideasRes,
    scriptsRes,
    publishedRes,
    leadsRes,
    customersRes,
    revenueRes,
  ] = await Promise.all([
    (db as any)
      .from('founder_journal_entries')
      .select('id', { count: 'exact', head: true })
      .gte('entry_date', thirtyDaysAgoDate),

    (db as any)
      .from('story_opportunities')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo),

    (db as any)
      .from('story_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('content_idea_created', true)
      .gte('created_at', thirtyDaysAgo),

    (db as any)
      .from('content_ideas')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo),

    (db as any)
      .from('content_scripts')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo),

    (db as any)
      .from('marketing_publishing_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', thirtyDaysAgo),

    (db as any)
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo),

    (db as any)
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo),

    (db as any)
      .from('orders')
      .select('final_price')
      .eq('status', 'completed')
      .gte('created_at', thirtyDaysAgo),
  ]);

  const revenue = ((revenueRes.data ?? []) as { final_price: string | number }[])
    .reduce((sum, row) => sum + Number(row.final_price ?? 0), 0);

  return NextResponse.json({
    journals:           journalsRes.count    ?? 0,
    oppsCreated:        oppsCreatedRes.count  ?? 0,
    oppsConverted:      oppsConvertedRes.count ?? 0,
    ideasCreated:       ideasRes.count        ?? 0,
    scriptsCreated:     scriptsRes.count      ?? 0,
    publishedContent:   publishedRes.count    ?? 0,
    leadsGenerated:     leadsRes.count        ?? 0,
    customersGenerated: customersRes.count    ?? 0,
    revenueGenerated:   revenue,
  });
}
