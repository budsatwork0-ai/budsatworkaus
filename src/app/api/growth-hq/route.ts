import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

const GROWTH_AGENT_IDS = [
  'arc-monitor',
  'thread-progress',
  'production-monitor',
  'asset-matcher',
  'consent-monitor',
  'campaign-reporter',
  'cadence-monitor',
  'format-analyst',
  'trend-scout',
  'adaptation-validator',
];

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const db = createServiceClientSafe();
  if (!db) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const today             = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' }).format(new Date());
  const sevenDaysAgo      = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString();
  const fortyEightHrsAgo  = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

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
    agentActionsRes,
    pipelineEventsRes,
    topIdeaRes,
    openOppsCountRes,
    staleOppRes,
  ] = await Promise.all([
    (db as any)
      .from('story_chapters')
      .select('id,title,summary,goal,is_active,started_at')
      .eq('is_active', true)
      .maybeSingle(),

    (db as any)
      .from('story_opportunities')
      .select('id,title,content_angle,suggested_format,suggested_platform,story_score,section,content_idea_created')
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

    // Sorted by adaptation_score desc so highest-fit trends surface first.
    (db as any)
      .from('research_trends')
      .select('id,title,platform,urgency,trend_type,adaptation_angle,adaptation_score,adaptation_reason')
      .in('status', ['watching', 'adapting'])
      .order('adaptation_score', { ascending: false, nullsFirst: false })
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

    (db as any)
      .from('story_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('is_ai_generated', true)
      .eq('status', 'draft')
      .gte('created_at', fortyEightHrsAgo),

    // Pending agent actions from Growth Department agents.
    (db as any)
      .from('agent_actions')
      .select('id,agent_id,action_type,preview,created_at,target_table,payload')
      .eq('status', 'pending')
      .in('agent_id', GROWTH_AGENT_IDS)
      .order('created_at', { ascending: false })
      .limit(10),

    // Recent pipeline events (48h) — shows what automation fired overnight.
    // Routine scoring events (opportunity_scored, idea_scored) are excluded
    // server-side to reduce noise; only agent-generated signals come through.
    (db as any)
      .from('growth_pipeline_events')
      .select('id,event_type,source_type,metadata,created_at')
      .gt('created_at', fortyEightHrsAgo)
      .not('event_type', 'in', '("opportunity_scored","idea_scored","opportunity_detected")')
      .order('created_at', { ascending: false })
      .limit(15),

    // Top idea by score (excluding archived).
    (db as any)
      .from('content_ideas')
      .select('id,title,idea_score')
      .not('idea_score', 'is', null)
      .neq('status', 'archived')
      .order('idea_score', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Total open opportunity count for the "N waiting" hint.
    (db as any)
      .from('story_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new'),

    // Stale mid-range opportunity: 40–69 score, status=new, older than 7 days.
    // Powers the time-based nudge so promising-but-neglected findings get surfaced.
    (db as any)
      .from('story_opportunities')
      .select('id,title,story_score,created_at')
      .eq('status', 'new')
      .gte('story_score', 40)
      .lte('story_score', 69)
      .lte('created_at', sevenDaysAgo)
      .order('story_score', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const ideas      = ideasRes.data      ?? [];
  const scripts    = scriptsRes.data    ?? [];
  const production = productionRes.data ?? [];
  const queueItems = queueRes.data      ?? [];
  const leads      = leadsRes.data      ?? [];
  const agentActions     = agentActionsRes.data    ?? [];
  const pipelineEvents   = pipelineEventsRes.data  ?? [];
  const trends           = trendsRes.data           ?? [];

  const activeProductionItems = production.filter((p: any) =>
    ['to_film', 'in_edit', 'ready_to_publish'].includes(p.status),
  );

  const pipeline = {
    ideas:          ideas.length,
    scripts:        scripts.length,
    production:     activeProductionItems.length,
    queue:          queueItems.filter((q: any) => ['draft', 'ready'].includes(q.status)).length,
    pendingActions: agentActions.length,
  };

  const leadPulse = {
    new:              leads.length,
    hot:              leads.filter((l: any) => l.temperature === 'HOT').length,
    awaitingResponse: leads.filter((l: any) => l.response_status === 'awaiting_response').length,
  };

  // ── Next action — expanded priority chain ────────────────────────────────────

  const hasJournalToday       = !!journalTodayRes.data;
  const hasApprovedScript     = scripts.some((s: any) => s.status === 'approved');
  const hasReadyToPublish     = production.some((p: any) => p.status === 'ready_to_publish');
  const hasReadyQueueItem     = queueItems.some((q: any) => q.status === 'ready');
  const aiDraftCount          = aiDraftRes.count ?? 0;
  const pendingActionsCount   = agentActions.length;

  const stalledProductionCount = pipelineEvents.filter(
    (e: any) => e.event_type === 'production_card_stale_flag',
  ).length;

  const cadenceIssueCount = pipelineEvents.filter(
    (e: any) => e.event_type === 'cadence_behind_flag' || e.event_type === 'campaign_kpi_report',
  ).length;

  const topOpp     = topOpportunityRes.data;
  const staleOpp   = staleOppRes.data ?? null;
  const highFitTrend = trends.find((t: any) => (t.adaptation_score ?? 0) >= 70);
  const hasHighScoreOpp = topOpp
    && (topOpp.story_score ?? 0) >= 70
    && !topOpp.content_idea_created;

  let nextAction: { label: string; href: string; reason: string } | null = null;

  if (pendingActionsCount > 0) {
    nextAction = {
      label:  `Review ${pendingActionsCount} agent finding${pendingActionsCount !== 1 ? 's' : ''}.`,
      href:   '/dashboard/agents',
      reason: `${pendingActionsCount} growth agent action${pendingActionsCount !== 1 ? 's' : ''} waiting for your review.`,
    };
  } else if (!hasJournalToday) {
    nextAction = {
      label:  "Write today's Founder Journal entry.",
      href:   '/dashboard/story-engine/journal/new',
      reason: 'No journal entry recorded for today.',
    };
  } else if (aiDraftCount > 0) {
    nextAction = {
      label:  `Review ${aiDraftCount} AI draft suggestion${aiDraftCount !== 1 ? 's' : ''}.`,
      href:   '/dashboard/story-engine/opportunities',
      reason: `${aiDraftCount} AI-generated draft${aiDraftCount !== 1 ? 's' : ''} from recent captures waiting for review.`,
    };
  } else if (stalledProductionCount > 0) {
    nextAction = {
      label:  `${stalledProductionCount} production card${stalledProductionCount !== 1 ? 's' : ''} stalled.`,
      href:   '/dashboard/content-studio/production',
      reason: 'Production Monitor found cards with no activity in 7+ days.',
    };
  } else if (hasHighScoreOpp) {
    nextAction = {
      label:  'Convert high-score opportunity to idea.',
      href:   '/dashboard/story-engine/opportunities',
      reason: `"${topOpp.title}" scored ${topOpp.story_score}/100 — no content idea yet.`,
    };
  } else if (highFitTrend) {
    nextAction = {
      label:  'Review high-fit trend in Research Lab.',
      href:   '/dashboard/research-lab/trends',
      reason: `"${(highFitTrend as any).title}" scored ${(highFitTrend as any).adaptation_score}/100 for story fit.`,
    };
  } else if (staleOpp) {
    nextAction = {
      label:  'Review ageing opportunity.',
      href:   '/dashboard/story-engine/opportunities',
      reason: `"${staleOpp.title}" scored ${staleOpp.story_score}/100 and has been waiting over 7 days.`,
    };
  } else if (cadenceIssueCount > 0) {
    nextAction = {
      label:  'Review campaign and cadence alerts.',
      href:   '/dashboard/marketing/campaigns',
      reason: `${cadenceIssueCount} campaign or cadence issue${cadenceIssueCount !== 1 ? 's' : ''} detected.`,
    };
  } else if (topOpp && ideas.length === 0) {
    nextAction = {
      label:  'Convert opportunity into content idea.',
      href:   '/dashboard/story-engine/opportunities',
      reason: 'A story opportunity exists with no content ideas yet.',
    };
  } else if (hasApprovedScript && activeProductionItems.length === 0) {
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
  } else {
    // Replace "All clear" with a contextual pipeline summary.
    const activeCount = pipeline.ideas + pipeline.scripts + pipeline.production + pipeline.queue;
    if (activeCount > 0) {
      nextAction = {
        label:  'Pipeline is flowing.',
        href:   '/dashboard/content-studio',
        reason: `${activeCount} item${activeCount !== 1 ? 's' : ''} active across ideas, scripts, production, and queue.`,
      };
    }
  }

  return NextResponse.json({
    chapter:               chapterRes.data       ?? null,
    topOpportunity:        topOpportunityRes.data ?? null,
    pipeline,
    activeCampaigns:       campaignsRes.data      ?? [],
    leadPulse,
    trends,
    nextAction,
    journalToday:          !!journalTodayRes.data,
    journalCount:          journalCountRes.count  ?? 0,
    aiDraftCount,
    // New fields:
    agentActions,
    recentPipelineEvents:  pipelineEvents,
    topIdea:               topIdeaRes.data        ?? null,
    openOpportunitiesCount: openOppsCountRes.count ?? 0,
    pendingActionsCount,
  });
}
