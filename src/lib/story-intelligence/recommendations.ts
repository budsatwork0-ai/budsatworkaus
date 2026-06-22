import { evaluateOpportunity } from '@/lib/story/opportunity-scoring';
import { type ArtifactContent } from '@/types/artifact';
import {
  type ScoreBreakdown,
  type StoryArc,
  type StoryCategory,
  type StoryOpenThread,
  type StoryOpportunity,
} from '@/types/story-engine';
import {
  type StoryBriefArtifactResult,
  type StoryIntelligenceRecommendation,
  type StoryIntelligenceResponse,
  type StoryIntelligenceSignal,
  type StoryIntelligenceSourceRef,
} from '@/types/story-intelligence';

type DbClient = {
  from: (table: string) => any;
};

type FundraisingRow = {
  id: string;
  title: string;
  category: string;
  status: string;
  goal_amount_cents: number;
  raised_amount_cents: number;
  short_reason: string | null;
  who_it_helps: string | null;
  employment_impact: string | null;
  is_featured: boolean;
  updated_at: string;
};

type OrderRow = {
  id: string;
  customer_name: string;
  service_type: string;
  context: string;
  status: string;
  final_price: number;
  completed_at: string | null;
  created_at: string;
};

type RatingRow = {
  id: string;
  order_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type LeadRow = {
  id: string;
  customer_name: string | null;
  service_type: string | null;
  source: string;
  response_status: string;
  temperature: string | null;
  created_at: string;
};

type EventRow = {
  id: string;
  event_type: string;
  source_type: string | null;
  source_id: string | null;
  result_type: string | null;
  result_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Context = {
  opportunities: StoryOpportunity[];
  arcs: StoryArc[];
  threads: StoryOpenThread[];
  fundraising: FundraisingRow[];
  orders: OrderRow[];
  ratings: RatingRow[];
  leads: LeadRow[];
  events: EventRow[];
};

const MAX_RECOMMENDATIONS = 8;

export async function buildStoryIntelligenceRecommendations(client: DbClient): Promise<StoryIntelligenceResponse> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [
    opportunitiesRes,
    arcsRes,
    threadsRes,
    fundraisingRes,
    ordersRes,
    ratingsRes,
    leadsRes,
    eventsRes,
  ] = await Promise.all([
    client
      .from('story_opportunities')
      .select('*')
      .eq('status', 'new')
      .neq('source_type', 'internal_system_milestone')
      .order('story_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(25),

    client
      .from('story_arcs')
      .select('*')
      .in('status', ['active', 'planted'])
      .order('priority', { ascending: true }),

    client
      .from('story_open_threads')
      .select('*')
      .eq('status', 'open')
      .order('opened_date', { ascending: false }),

    client
      .from('fundraising_items')
      .select('id,title,category,status,goal_amount_cents,raised_amount_cents,short_reason,who_it_helps,employment_impact,is_featured,updated_at')
      .in('status', ['live', 'funded'])
      .order('is_featured', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(10),

    client
      .from('orders')
      .select('id,customer_name,service_type,context,status,final_price,completed_at,created_at')
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(40),

    client
      .from('ratings')
      .select('id,order_id,rating,comment,created_at')
      .gte('created_at', ninetyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(25),

    client
      .from('leads')
      .select('id,customer_name,service_type,source,response_status,temperature,created_at')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(30),

    client
      .from('growth_pipeline_events')
      .select('id,event_type,source_type,source_id,result_type,result_id,metadata,created_at')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const context: Context = {
    opportunities: opportunitiesRes.data ?? [],
    arcs: arcsRes.data ?? [],
    threads: threadsRes.data ?? [],
    fundraising: fundraisingRes.data ?? [],
    orders: ordersRes.data ?? [],
    ratings: ratingsRes.data ?? [],
    leads: leadsRes.data ?? [],
    events: eventsRes.data ?? [],
  };

  return {
    generatedAt: now.toISOString(),
    recommendations: context.opportunities
      .map((opportunity) => buildRecommendation(opportunity, context, now))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECOMMENDATIONS),
  };
}

function buildRecommendation(
  opportunity: StoryOpportunity,
  context: Context,
  now: Date,
): StoryIntelligenceRecommendation {
  const evaluated = opportunity.story_score === null ? evaluateOpportunity(opportunity) : null;
  const baseStoryScore = opportunity.story_score ?? evaluated?.story_score ?? 0;
  const scoreBreakdown = opportunity.score_breakdown ?? evaluated?.score_breakdown ?? null;
  const storyCategory = opportunity.story_category ?? evaluated?.story_category ?? null;
  const searchText = storyText(opportunity);

  const relatedStoryArcs = context.arcs.filter((arc) =>
    arc.id === opportunity.related_arc_id || overlaps(searchText, storyTextFromParts(arc.title, arc.description)),
  ).slice(0, 3).map((arc) => ({
    id: arc.id,
    title: arc.title,
    detail: `${arc.status} arc · priority ${arc.priority}`,
    href: '/dashboard/story-engine/arcs',
  }));

  const relatedOpenThreads = context.threads.filter((thread) =>
    thread.related_arc_id === opportunity.related_arc_id ||
    intersects(thread.related_characters, opportunity.related_characters) ||
    overlaps(searchText, storyTextFromParts(thread.title, thread.description)),
  ).slice(0, 3).map((thread) => ({
    id: thread.id,
    title: thread.title,
    detail: `Open since ${formatDate(thread.opened_date)}`,
    href: '/dashboard/story-engine/open-threads',
  }));

  const relatedFundraisingCampaigns = context.fundraising.filter((item) =>
    overlaps(searchText, storyTextFromParts(item.title, item.category, item.short_reason, item.who_it_helps, item.employment_impact)) ||
    hasAny(searchText, ['fundraising', 'donation', 'donate', 'mower', 'equipment', 'employment']),
  ).slice(0, 3).map((item) => ({
    id: item.id,
    title: item.title,
    detail: `${item.status} · ${formatMoney(item.raised_amount_cents)} raised of ${formatMoney(item.goal_amount_cents)}`,
    href: '/dashboard/fundraising',
  }));

  const relatedJobs = context.orders.filter((order) =>
    overlaps(searchText, storyTextFromParts(order.customer_name, order.service_type, order.context)) ||
    hasAny(searchText, [order.service_type, 'job', 'customer', 'service', 'booking']),
  ).slice(0, 4).map((order) => ({
    id: order.id,
    title: `${order.customer_name} · ${order.service_type}`,
    detail: `${order.status} · ${formatMoney(Math.round(Number(order.final_price ?? 0) * 100))}`,
    href: '/dashboard/orders',
  }));

  const orderIds = new Set(relatedJobs.map((job) => job.id));
  const relatedReviews = context.ratings.filter((rating) =>
    orderIds.has(rating.order_id) ||
    (rating.rating >= 4 && hasAny(searchText, ['review', 'testimonial', 'trust', 'customer', 'proof', 'five star', '5 star']))
  ).slice(0, 3).map((rating) => ({
    id: rating.id,
    title: `${rating.rating}/5 customer review`,
    detail: rating.comment ? truncate(rating.comment, 120) : `Rating left ${formatDate(rating.created_at)}`,
    href: '/dashboard/feedback',
  }));

  const relatedLeads = context.leads.filter((lead) =>
    overlaps(searchText, storyTextFromParts(lead.customer_name, lead.service_type, lead.source, lead.temperature)) ||
    hasAny(searchText, [lead.service_type ?? '', 'lead', 'inquiry', 'customer', 'demand'])
  ).slice(0, 4).map((lead) => ({
    id: lead.id,
    title: `${lead.customer_name ?? 'Lead'} · ${lead.service_type ?? lead.source}`,
    detail: `${lead.temperature ?? 'UNSCORED'} · ${lead.response_status}`,
    href: '/dashboard/insights/leads',
  }));

  const relatedMilestones = context.events.filter((event) =>
    event.source_id === opportunity.source_ref_id ||
    event.result_id === opportunity.id ||
    overlaps(searchText, storyTextFromParts(event.event_type, event.source_type, event.result_type, metadataText(event.metadata)))
  ).slice(0, 4).map((event) => ({
    id: event.id,
    title: event.event_type.replace(/_/g, ' '),
    detail: `${event.source_type ?? 'pipeline'} · ${formatDate(event.created_at)}`,
    href: '/dashboard/growth-hq',
  }));

  const signals = buildSignals({
    opportunity,
    baseStoryScore,
    scoreBreakdown,
    relatedStoryArcs,
    relatedOpenThreads,
    relatedFundraisingCampaigns,
    relatedJobs,
    relatedReviews,
    relatedLeads,
    relatedMilestones,
    now,
  });

  const recommendationBonus = signals
    .filter((signal) => signal.type !== 'story_score')
    .reduce((total, signal) => total + signal.weight, 0);
  const score = Math.min(100, Math.round(baseStoryScore + recommendationBonus));
  const businessGoal = inferBusinessGoal(storyCategory, {
    relatedFundraisingCampaigns,
    relatedJobs,
    relatedReviews,
    relatedLeads,
  });
  const why = buildWhy({
    scoreBreakdown,
    signals,
    businessGoal,
    opportunity,
  });

  return {
    id: `story-intelligence:${opportunity.id}`,
    opportunityId: opportunity.id,
    title: opportunity.title,
    recommendedStory: opportunity.title,
    score,
    baseStoryScore,
    recommendationBonus,
    scoreFormula: `min(100, base story score ${baseStoryScore} + visible signal bonus ${recommendationBonus})`,
    scoreBreakdown,
    storyCategory,
    businessGoal,
    nextAction: {
      label: 'Generate Story Brief Artifact',
      href: `/api/story-intelligence/brief?opportunity_id=${opportunity.id}`,
      intent: 'create_story_brief',
    },
    why,
    supportingSignals: signals,
    relatedStoryArcs,
    relatedOpenThreads,
    relatedFundraisingCampaigns,
    relatedJobs,
    relatedReviews,
    relatedLeads,
    relatedMilestones,
    suggestedFormat: opportunity.suggested_format,
    suggestedPlatform: opportunity.suggested_platform,
    contentAngle: opportunity.content_angle,
    createdAt: opportunity.created_at,
  };
}

function buildSignals(input: {
  opportunity: StoryOpportunity;
  baseStoryScore: number;
  scoreBreakdown: ScoreBreakdown | null;
  relatedStoryArcs: StoryIntelligenceSourceRef[];
  relatedOpenThreads: StoryIntelligenceSourceRef[];
  relatedFundraisingCampaigns: StoryIntelligenceSourceRef[];
  relatedJobs: StoryIntelligenceSourceRef[];
  relatedReviews: StoryIntelligenceSourceRef[];
  relatedLeads: StoryIntelligenceSourceRef[];
  relatedMilestones: StoryIntelligenceSourceRef[];
  now: Date;
}): StoryIntelligenceSignal[] {
  const signals: StoryIntelligenceSignal[] = [{
    id: `${input.opportunity.id}:story-score`,
    type: 'story_score',
    label: 'Base story score',
    detail: input.scoreBreakdown?.reasons.slice(0, 3).join('. ') || 'Existing deterministic story score.',
    sourceTable: 'story_opportunities',
    sourceId: input.opportunity.id,
    weight: input.baseStoryScore,
  }];

  addCountSignal(signals, 'story_arc', 'Related story arc', input.relatedStoryArcs, 5);
  addCountSignal(signals, 'open_thread', 'Related open thread', input.relatedOpenThreads, 4);
  addCountSignal(signals, 'fundraising', 'Related fundraising campaign', input.relatedFundraisingCampaigns, 8);
  addCountSignal(signals, 'job', 'Related job/customer activity', input.relatedJobs, 5);
  addCountSignal(signals, 'review', 'Related review/social proof', input.relatedReviews, 6);
  addCountSignal(signals, 'lead', 'Related lead/demand signal', input.relatedLeads, 5);
  addCountSignal(signals, 'milestone', 'Related milestone', input.relatedMilestones, 4);

  const ageDays = Math.floor((input.now.getTime() - new Date(input.opportunity.created_at).getTime()) / 86_400_000);
  if (ageDays <= 7) {
    signals.push({
      id: `${input.opportunity.id}:recency`,
      type: 'recency',
      label: 'Fresh opportunity',
      detail: `Created ${ageDays === 0 ? 'today' : `${ageDays} day${ageDays !== 1 ? 's' : ''} ago`}.`,
      sourceTable: 'story_opportunities',
      sourceId: input.opportunity.id,
      weight: 3,
    });
  }

  if (input.opportunity.suggested_format || input.opportunity.suggested_platform) {
    signals.push({
      id: `${input.opportunity.id}:readiness`,
      type: 'content_readiness',
      label: 'Content-ready',
      detail: [input.opportunity.suggested_format, input.opportunity.suggested_platform].filter(Boolean).join(' · '),
      sourceTable: 'story_opportunities',
      sourceId: input.opportunity.id,
      weight: 3,
    });
  }

  return signals;
}

function addCountSignal(
  signals: StoryIntelligenceSignal[],
  type: StoryIntelligenceSignal['type'],
  label: string,
  refs: StoryIntelligenceSourceRef[],
  weight: number,
) {
  if (refs.length === 0) return;
  signals.push({
    id: `${type}:${refs.map((ref) => ref.id).join(':')}`,
    type,
    label,
    detail: `${refs.length} supporting record${refs.length !== 1 ? 's' : ''}: ${refs.map((ref) => ref.title).join(', ')}`,
    sourceTable: 'multiple',
    sourceId: null,
    weight: Math.min(weight, refs.length * weight),
  });
}

function inferBusinessGoal(
  category: StoryCategory | null,
  refs: {
    relatedFundraisingCampaigns: StoryIntelligenceSourceRef[];
    relatedJobs: StoryIntelligenceSourceRef[];
    relatedReviews: StoryIntelligenceSourceRef[];
    relatedLeads: StoryIntelligenceSourceRef[];
  },
) {
  if (refs.relatedFundraisingCampaigns.length > 0) return 'Raise Donations';
  if (refs.relatedLeads.length > 0) return 'Generate Leads';
  if (refs.relatedReviews.length > 0) return 'Build Trust';
  if (refs.relatedJobs.length > 0) return 'Recruit Customers';
  if (category === 'employment_outcome' || category === 'community_impact') return 'Tell Our Story';
  if (category === 'customer_validation') return 'Build Trust';
  if (category === 'business_milestone') return 'Build Trust';
  return 'Tell Our Story';
}

function buildWhy(input: {
  scoreBreakdown: ScoreBreakdown | null;
  signals: StoryIntelligenceSignal[];
  businessGoal: string;
  opportunity: StoryOpportunity;
}) {
  const reasons = [
    ...(input.scoreBreakdown?.reasons.slice(0, 4) ?? []),
    ...input.signals
      .filter((signal) => signal.type !== 'story_score')
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 4)
      .map((signal) => signal.detail),
    `Supports business goal: ${input.businessGoal}.`,
  ];

  if (reasons.length === 1) {
    reasons.unshift(`"${input.opportunity.title}" is the strongest available story opportunity by deterministic score.`);
  }

  return [...new Set(reasons)];
}

export function buildStoryBriefArtifact(input: StoryIntelligenceRecommendation): StoryBriefArtifactResult {
  const content: ArtifactContent = {
    schemaVersion: 'artifact.v1',
    artifactType: 'story',
    blocks: [
      {
        id: 'hero',
        type: 'hero',
        data: {
          eyebrow: 'Story Intelligence',
          heading: input.recommendedStory,
          subheading: input.contentAngle || `Recommended story supporting ${input.businessGoal}.`,
          primaryMetricLabel: 'Recommendation Score',
          primaryMetricValue: `${input.score}/100`,
        },
      },
      {
        id: 'score',
        type: 'scorecard',
        title: 'Why this story now',
        data: {
          score: input.score,
          label: 'Story potential',
          reasons: input.why,
        },
      },
      {
        id: 'signals',
        type: 'insight_list',
        title: 'Supporting signals',
        data: {
          insights: input.supportingSignals.map((signal) => ({
            title: `${signal.label} (+${signal.weight})`,
            detail: signal.detail,
            source: signal.sourceTable,
          })),
        },
      },
      {
        id: 'sources',
        type: 'asset_list',
        title: 'Source records',
        data: {
          assets: [
            ...input.relatedStoryArcs.map((ref) => ({ title: ref.title, type: 'Story Arc', status: ref.detail })),
            ...input.relatedOpenThreads.map((ref) => ({ title: ref.title, type: 'Open Thread', status: ref.detail })),
            ...input.relatedFundraisingCampaigns.map((ref) => ({ title: ref.title, type: 'Fundraising', status: ref.detail })),
            ...input.relatedJobs.map((ref) => ({ title: ref.title, type: 'Job', status: ref.detail })),
            ...input.relatedReviews.map((ref) => ({ title: ref.title, type: 'Review', status: ref.detail })),
            ...input.relatedLeads.map((ref) => ({ title: ref.title, type: 'Lead', status: ref.detail })),
            ...input.relatedMilestones.map((ref) => ({ title: ref.title, type: 'Milestone', status: ref.detail })),
          ],
        },
      },
      {
        id: 'decision',
        type: 'decision_panel',
        title: 'Recommended next action',
        data: {
          decision: `Use this story to support: ${input.businessGoal}`,
          options: ['Approve story direction', 'Send to Campaign Factory later', 'Hold for more signal'],
          approvalNote: 'Batch 2 stops at the Story Brief Artifact. No campaign generation or publishing is triggered.',
        },
      },
    ],
  };

  const plainText = [
    `Story Brief: ${input.recommendedStory}`,
    `Score: ${input.score}/100`,
    `Goal: ${input.businessGoal}`,
    `Formula: ${input.scoreFormula}`,
    'Why:',
    ...input.why.map((reason) => `- ${reason}`),
  ].join('\n');

  return { artifactContent: content, plainText };
}

function storyText(opportunity: StoryOpportunity) {
  return storyTextFromParts(
    opportunity.title,
    opportunity.content_angle,
    opportunity.notes,
    opportunity.suggested_format,
    opportunity.suggested_platform,
    opportunity.story_category,
    ...opportunity.related_characters,
  );
}

function storyTextFromParts(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function overlaps(a: string, b: string) {
  const aTokens = keywordSet(a);
  const bTokens = keywordSet(b);
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return overlap >= 2;
}

function keywordSet(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 4)
      .filter((token) => !['with', 'from', 'this', 'that', 'into', 'story', 'content', 'work'].includes(token)),
  );
}

function intersects(a: string[], b: string[]) {
  const bSet = new Set(b.map((item) => item.toLowerCase()));
  return a.some((item) => bSet.has(item.toLowerCase()));
}

function hasAny(text: string, terms: string[]) {
  return terms.filter(Boolean).some((term) => text.includes(term.toLowerCase()));
}

function metadataText(metadata: Record<string, unknown> | null) {
  if (!metadata) return '';
  return Object.values(metadata)
    .map((value) => typeof value === 'string' || typeof value === 'number' ? String(value) : '')
    .join(' ');
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
