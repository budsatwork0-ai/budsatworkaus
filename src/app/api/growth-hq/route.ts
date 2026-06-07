import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const db = createServiceClientSafe();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' }).format(new Date());
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    chapterRes,
    topOpportunityRes,
    ideasRes,
    scriptsRes,
    productionRes,
    queueRes,
    campaignsRes,
    trendsRes,
    journalTodayRes,
    leadsRes,
    journalCountRes,
    aiDraftRes,
  ] = await Promise.all([
    (db as any)
      .from('story_chapters')
      .select('id,title,summary,goal,is_active,started_at')
      .eq('is_active', true)
      .maybeSingle(),
    (db as any)
      .from('story_opportunities')
      .select('id,title,content_angle,suggested_format,suggested_platform,story_score,section')
      .eq('status', 'new')
      .order('priority')
      .order('story_score', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    (db as any)
      .from('content_ideas')
      .select('id,status')
      .neq('status', 'archived'),
    (db as any)
      .from('content_scripts')
      .select('id,status')
      .neq('status', 'archived'),
    (db as any)
      .from('content_production_cards')
      .select('id,status')
      .neq('status', 'published'),
    (db as any)
      .from('marketing_publishing_queue')
      .select('id,status')
      .neq('status', 'archived'),
    (db as any)
      .from('marketing_campaigns')
      .select('id,name,goal,channels,start_date,end_date')
      .eq('status', 'active')
      .order('start_date', { ascending: true, nullsFirst: false })
      .limit(5),
    (db as any)
      .from('research_trends')
      .select('id,title,platform,urgency,trend_type,adaptation_angle')
      .in('status', ['watching', 'adapting'])
      .order('created_at', { ascending: false })
      .limit(5),
    (db as any)
      .from('founder_journal_entries')
      .select('id,entry_date')
      .eq('entry_date', today)
      .maybeSingle(),
    (db as any)
      .from('leads')
      .select('id,response_status,temperature')
      .gte('created_at', sevenDaysAgo),
    (db as any)
      .from('founder_journal_entries')
      .select('id', { count: 'exact', head: true }),
    // AI-generated drafts in 'draft' status created in the last 48h, awaiting human review.
    (db as any)
      .from('story_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('is_ai_generated', true)
      .eq('status', 'draft')
      .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()),
  ]);

  const ideas      = ideasRes.data      ?? [];
  const scripts    = scriptsRes.data    ?? [];
  const production = productionRes.data ?? [];
  const queueItems = queueRes.data      ?? [];
  const leads      = leadsRes.data      ?? [];

  const pipeline = {
    ideas:      ideas.length,
    scripts:    scripts.length,
    production: production.filter((p: any) => ['to_film', 'in_edit', 'ready_to_publish'].includes(p.status)).length,
    queue:      queueItems.filter((q: any) => ['draft', 'ready'].includes(q.status)).length,
  };

  const leadPulse = {
    new:              leads.length,
    hot:              leads.filter((l: any) => l.temperature === 'HOT').length,
    awaitingResponse: leads.filter((l: any) => l.response_status === 'awaiting_response').length,
  };

  // Deterministic next action — first matching rule wins
  const hasJournalToday       = !!journalTodayRes.data;
  const hasNewOpportunity     = !!topOpportunityRes.data;
  const hasApprovedScript     = scripts.some((s: any) => s.status === 'approved');
  const activeProductionCount = production.filter((p: any) =>
    ['to_film', 'in_edit', 'ready_to_publish'].includes(p.status),
  ).length;
  const hasReadyToPublish     = production.some((p: any) => p.status === 'ready_to_publish');
  const hasReadyQueueItem     = queueItems.some((q: any) => q.status === 'ready');
  const aiDraftCount          = aiDraftRes.count ?? 0;

  let nextAction: { label: string; href: string; reason: string } | null = null;

  if (!hasJournalToday) {
    nextAction = {
      label:  "Write today's Founder Journal entry.",
      href:   '/dashboard/story-engine/journal/new',
      reason: 'No journal entry recorded for today.',
    };
  } else if (aiDraftCount > 0) {
    nextAction = {
      label:  `Review ${aiDraftCount} AI draft suggestion${aiDraftCount !== 1 ? 's' : ''}.`,
      href:   '/dashboard/story-engine/opportunities',
      reason: `${aiDraftCount} AI-generated draft${aiDraftCount !== 1 ? 's' : ''} from recent captures are waiting for your review.`,
    };
  } else if (hasNewOpportunity && ideas.length === 0) {
    nextAction = {
      label:  'Convert opportunity into content idea.',
      href:   '/dashboard/story-engine/opportunities',
      reason: 'A story opportunity exists with no content ideas yet.',
    };
  } else if (hasApprovedScript && activeProductionCount === 0) {
    nextAction = {
      label:  'Move approved script into Production.',
      href:   '/dashboard/content-studio/production',
      reason: 'An approved script has no production card.',
    };
  } else if (hasReadyToPublish && !hasReadyQueueItem) {
    nextAction = {
      label:  'Add content to Publishing Queue.',
      href:   '/dashboard/marketing/publishing',
      reason: 'A production card is ready to publish but not in the queue.',
    };
  }

  return NextResponse.json({
    chapter:        chapterRes.data      ?? null,
    topOpportunity: topOpportunityRes.data ?? null,
    pipeline,
    activeCampaigns: campaignsRes.data  ?? [],
    leadPulse,
    trends:         trendsRes.data      ?? [],
    nextAction,
    journalToday:   !!journalTodayRes.data,
    journalCount:   journalCountRes.count ?? 0,
    aiDraftCount,
  });
}
