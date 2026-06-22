import { createStructuredArtifact } from '@/lib/artifacts/server';
import {
  type ContentFutureAction,
  type ContentLearningEvidence,
  type ContentLearningPoint,
  type ContentOutcomeScore,
  type LearningArtifactResult,
  type LearningGuidance,
} from '@/types/content-feedback';
import { type CampaignFactoryGoal } from '@/types/campaign-factory-mvp';

type DbClient = {
  from: (table: string) => any;
};

type FeedbackContext = {
  run: any | null;
  campaign: any | null;
  artifacts: any[];
  libraryItems: any[];
  goal: string;
  campaignTitle: string;
  sourceArtifactIds: string[];
  sourceLibraryItemIds: string[];
  relatedFundraisingItemIds: string[];
  relatedStory: string;
  createdAt: string;
};

type OutcomeResults = {
  donationsRaisedCents: number;
  donorCount: number;
  leadsGenerated: number;
  reviewsGenerated: number;
  quoteRequestsGenerated: number;
  customerConversions: number;
  participantEnquiries: number;
  evidence: ContentLearningEvidence[];
};

const GOAL_TARGETS: Record<string, { metric: keyof OutcomeResults; target: number; label: string }> = {
  'Generate Leads': { metric: 'leadsGenerated', target: 1, label: 'leads generated' },
  'Raise Donations': { metric: 'donationsRaisedCents', target: 100, label: 'donations generated' },
  'Build Trust': { metric: 'reviewsGenerated', target: 1, label: 'reviews generated' },
  'Recruit Participants': { metric: 'participantEnquiries', target: 1, label: 'participant enquiries generated' },
  'Promote Services': { metric: 'quoteRequestsGenerated', target: 1, label: 'quote requests generated' },
  'Recruit Customers': { metric: 'customerConversions', target: 1, label: 'customer conversions' },
};

export async function analyzeContentFeedback(input: {
  client: DbClient;
  campaignFactoryRunId?: string | null;
  campaignId?: string | null;
  artifactIds?: string[];
  createdBy: string | null;
}) {
  const context = await collectFeedbackContext(input.client, input);
  if ('error' in context) return context;

  const results = await collectOutcomeResults(input.client, context);
  const outcomeScore = calculateOutcomeScore(context.goal, results);
  const whatWorked = buildWhatWorked(context, results, outcomeScore);
  const whatFailed = buildWhatFailed(context, results, outcomeScore);
  const recommendedFutureActions = buildRecommendedFutureActions(context, whatWorked, whatFailed, outcomeScore);
  const confidence = calculateConfidence(context, results, outcomeScore);
  const artifact = buildLearningArtifact({
    context,
    results,
    outcomeScore,
    whatWorked,
    whatFailed,
    recommendedFutureActions,
    confidence,
  });

  const created = await createStructuredArtifact({
    client: input.client,
    type: 'learning',
    title: artifact.title,
    summary: artifact.summary,
    status: 'in_review',
    score: outcomeScore.score,
    metadata: {
      content_feedback_engine: true,
      goal: context.goal,
      outcome_score: outcomeScore,
    },
    sourceContext: {
      campaign_factory_run_id: input.campaignFactoryRunId ?? null,
      campaign_id: input.campaignId ?? null,
      source_artifact_ids: context.sourceArtifactIds,
      source_library_item_ids: context.sourceLibraryItemIds,
      automation_boundary: 'learning_artifact_only',
    },
    content: artifact.content,
    plainText: artifact.plainText,
    generationInput: {
      campaign_factory_run_id: input.campaignFactoryRunId ?? null,
      campaign_id: input.campaignId ?? null,
      artifact_ids: input.artifactIds ?? [],
      results,
      outcome_score: outcomeScore,
    },
    generationModel: 'deterministic-content-feedback-v1',
    createdBy: input.createdBy,
    campaignFactoryRunId: input.campaignFactoryRunId ?? null,
    campaignFactoryRole: 'supporting',
    tags: ['content-feedback', 'learning', context.goal.toLowerCase().replace(/\s+/g, '-')],
  });

  if (created.error) return { error: created.error };

  const learningInsert = {
    campaign_factory_run_id: input.campaignFactoryRunId ?? null,
    campaign_id: input.campaignId ?? null,
    learning_artifact_id: created.artifact.id,
    goal: context.goal,
    campaign_title: context.campaignTitle,
    source_artifact_ids: context.sourceArtifactIds,
    source_library_item_ids: context.sourceLibraryItemIds,
    outcome_score: outcomeScore,
    results: serialiseResults(results),
    what_worked: whatWorked,
    what_failed: whatFailed,
    supporting_evidence: results.evidence,
    recommended_future_actions: recommendedFutureActions,
    confidence: confidence.score,
    confidence_reason: confidence.reason,
    status: 'in_review',
    created_by: input.createdBy,
  };

  const { data: learningRecord, error } = await input.client
    .from('content_learning_records')
    .insert(learningInsert)
    .select()
    .single();

  if (error) return { error };

  return {
    learningRecord,
    artifact: created.artifact,
    outcomeScore,
  };
}

export async function getLearningGuidance(
  client: DbClient,
  goal: string,
  options: { limit?: number } = {},
): Promise<LearningGuidance> {
  const { data } = await client
    .from('content_learning_records')
    .select('learning_artifact_id,recommended_future_actions,what_failed,supporting_evidence,confidence')
    .eq('status', 'approved')
    .eq('goal', goal)
    .order('confidence', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 5);

  const records = data ?? [];
  return {
    use: records.flatMap((record: any) => arrayOfObjects(record.recommended_future_actions)).slice(0, 6) as ContentFutureAction[],
    avoid: records.flatMap((record: any) => arrayOfObjects(record.what_failed)).slice(0, 6) as ContentLearningPoint[],
    evidence: records.flatMap((record: any) => arrayOfObjects(record.supporting_evidence)).slice(0, 8) as ContentLearningEvidence[],
    learningArtifactIds: records.map((record: any) => record.learning_artifact_id).filter(Boolean),
  };
}

export function calculateOutcomeScore(goal: string, results: OutcomeResults): ContentOutcomeScore {
  const target = GOAL_TARGETS[goal] ?? { metric: 'leadsGenerated' as const, target: 1, label: 'business outcomes generated' };
  const rawValue = results[target.metric];
  const primaryValue = typeof rawValue === 'number' ? rawValue : 0;
  const normalisedValue = target.metric === 'donationsRaisedCents' ? primaryValue / 100 : primaryValue;
  const ratio = target.target > 0 ? normalisedValue / target.target : 0;
  const score = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  const result = ratio >= 1.5 ? 'exceeded' : ratio >= 1 ? 'met' : ratio >= 0.4 ? 'partial' : 'missed';

  return {
    score,
    goal,
    primaryMetric: target.label,
    primaryValue,
    targetValue: target.metric === 'donationsRaisedCents' ? target.target * 100 : target.target,
    result,
    reason: `Primary outcome for ${goal}: ${formatMetric(target.metric, primaryValue)} against target ${formatMetric(target.metric, target.metric === 'donationsRaisedCents' ? target.target * 100 : target.target)}.`,
  };
}

export function buildLearningArtifact(input: {
  context: Pick<FeedbackContext, 'campaignTitle' | 'goal' | 'sourceArtifactIds'>;
  results: OutcomeResults;
  outcomeScore: ContentOutcomeScore;
  whatWorked: ContentLearningPoint[];
  whatFailed: ContentLearningPoint[];
  recommendedFutureActions: ContentFutureAction[];
  confidence: { score: number; reason: string; evidenceQuality: 'strong' | 'medium' | 'weak' };
}): LearningArtifactResult {
  const title = `Learning: ${input.context.campaignTitle}`;
  const summary = `${input.context.goal} learning artifact with outcome score ${input.outcomeScore.score}/100.`;

  return {
    title,
    summary,
    plainText: [
      title,
      `Goal: ${input.context.goal}`,
      `Outcome Score: ${input.outcomeScore.score}/100 (${input.outcomeScore.result})`,
      input.outcomeScore.reason,
      'What Worked:',
      ...input.whatWorked.map((item) => `- ${item.title}: ${item.detail}`),
      'What Failed:',
      ...input.whatFailed.map((item) => `- ${item.title}: ${item.detail}`),
      'Recommended Future Actions:',
      ...input.recommendedFutureActions.map((item) => `- ${item.action}: ${item.rationale}`),
      `Confidence: ${input.confidence.score}/100 - ${input.confidence.reason}`,
    ].join('\n'),
    content: {
      schemaVersion: 'artifact.v1',
      artifactType: 'learning',
      blocks: [
        {
          id: 'hero',
          type: 'hero',
          data: {
            eyebrow: 'Content Feedback Engine',
            heading: title,
            subheading: summary,
            primaryMetricLabel: 'Outcome Score',
            primaryMetricValue: `${input.outcomeScore.score}/100`,
          },
        },
        {
          id: 'outcome-score',
          type: 'scorecard',
          title: 'Did this campaign achieve its goal?',
          data: {
            score: input.outcomeScore.score,
            label: input.outcomeScore.result,
            reasons: [
              `Goal: ${input.outcomeScore.goal}`,
              `Primary metric: ${input.outcomeScore.primaryMetric}`,
              input.outcomeScore.reason,
            ],
          },
        },
        {
          id: 'results',
          type: 'metric_grid',
          title: 'Results',
          data: {
            metrics: [
              { label: 'Donations', value: formatMoney(input.results.donationsRaisedCents), detail: `${input.results.donorCount} donors` },
              { label: 'Leads', value: String(input.results.leadsGenerated), detail: 'Lead records linked or observed' },
              { label: 'Quote Requests', value: String(input.results.quoteRequestsGenerated), detail: 'Quote records observed' },
              { label: 'Reviews', value: String(input.results.reviewsGenerated), detail: 'Trust signals observed' },
              { label: 'Participant Enquiries', value: String(input.results.participantEnquiries), detail: 'Participant/referral signals' },
              { label: 'Conversions', value: String(input.results.customerConversions), detail: 'Completed customer outcomes' },
            ],
          },
        },
        {
          id: 'what-worked',
          type: 'recommendation_list',
          title: 'What Worked',
          data: {
            recommendations: input.whatWorked.map((item) => ({
              title: item.title,
              rationale: `${item.detail} Evidence: ${item.evidence}`,
              priority: 'high',
            })),
          },
        },
        {
          id: 'what-failed',
          type: 'recommendation_list',
          title: 'What Failed',
          data: {
            recommendations: input.whatFailed.map((item) => ({
              title: item.title,
              rationale: `${item.detail} Evidence: ${item.evidence}`,
              priority: 'medium',
            })),
          },
        },
        {
          id: 'supporting-evidence',
          type: 'insight_list',
          title: 'Supporting Evidence',
          data: {
            insights: input.results.evidence.map((item) => ({
              title: item.label,
              detail: item.detail,
              source: item.sourceTable,
            })),
          },
        },
        {
          id: 'future-actions',
          type: 'recommendation_list',
          title: 'Recommended Future Actions',
          data: {
            recommendations: input.recommendedFutureActions.map((item) => ({
              title: item.action,
              rationale: item.rationale,
              priority: item.priority,
            })),
          },
        },
        {
          id: 'confidence',
          type: 'decision_panel',
          title: 'Human Review',
          data: {
            decision: `Review this learning before it influences future Story Intelligence or Campaign Factory output. Confidence: ${input.confidence.score}/100.`,
            options: ['Approve learning', 'Reject learning', 'Keep in review'],
            approvalNote: input.confidence.reason,
          },
        },
      ],
    },
  };
}

async function collectFeedbackContext(
  client: DbClient,
  input: { campaignFactoryRunId?: string | null; campaignId?: string | null; artifactIds?: string[] },
): Promise<FeedbackContext | { error: Error }> {
  const run = input.campaignFactoryRunId ? await maybeSingle(client, 'campaign_factory_runs', input.campaignFactoryRunId) : null;
  const campaign = input.campaignId ? await maybeSingle(client, 'marketing_campaigns', input.campaignId) : null;
  const linkedArtifactIds = input.campaignFactoryRunId ? await loadRunArtifactIds(client, input.campaignFactoryRunId) : [];
  const sourceArtifactIds = [...new Set([...(input.artifactIds ?? []), ...linkedArtifactIds])];
  const artifacts = sourceArtifactIds.length > 0
    ? (await client.from('artifacts').select('*').in('id', sourceArtifactIds)).data ?? []
    : [];
  const libraryItems = sourceArtifactIds.length > 0
    ? (await client.from('content_library_items').select('*').in('artifact_id', sourceArtifactIds)).data ?? []
    : [];
  const campaignArtifact = artifacts.find((artifact: any) => artifact.type === 'campaign') ?? artifacts[0] ?? null;
  const sourceContext = campaignArtifact?.source_context ?? {};
  const recommendation = sourceContext.recommendation ?? run?.signals?.recommendation ?? null;
  const relatedFundraisingItemIds = arrayOfObjects(recommendation?.relatedFundraisingCampaigns).map((item: any) => item.id).filter(Boolean);

  const goal = run?.goal || campaign?.goal || campaignArtifact?.metadata?.goal || recommendation?.businessGoal || 'Generate Leads';
  const campaignTitle = run?.title || campaign?.name || campaignArtifact?.title || 'Untitled Campaign';

  return {
    run,
    campaign,
    artifacts,
    libraryItems,
    goal,
    campaignTitle,
    sourceArtifactIds,
    sourceLibraryItemIds: libraryItems.map((item: any) => item.id),
    relatedFundraisingItemIds,
    relatedStory: recommendation?.recommendedStory ?? campaignTitle,
    createdAt: run?.created_at || campaign?.created_at || campaignArtifact?.created_at || new Date().toISOString(),
  };
}

async function collectOutcomeResults(client: DbClient, context: FeedbackContext): Promise<OutcomeResults> {
  const since = context.createdAt;
  const fundraising = context.relatedFundraisingItemIds.length > 0
    ? await safeSelect(client, 'fundraising_contributions', (query) =>
        query.select('id,fundraising_item_id,amount_cents,status,paid_at,created_at')
          .in('fundraising_item_id', context.relatedFundraisingItemIds)
          .eq('status', 'paid'))
    : [];
  const leads = await safeSelect(client, 'leads', (query) =>
    query.select('id,customer_name,service_type,source,response_status,temperature,created_at').gte('created_at', since));
  const quotes = await safeSelect(client, 'quotes', (query) =>
    query.select('id,status,created_at').gte('created_at', since));
  const orders = await safeSelect(client, 'orders', (query) =>
    query.select('id,status,created_at,completed_at').gte('created_at', since));
  const ratings = await safeSelect(client, 'ratings', (query) =>
    query.select('id,rating,comment,created_at').gte('created_at', since));

  const paidContributions = fundraising.filter((item: any) => item.status === 'paid');
  const donationsRaisedCents = paidContributions.reduce((sum: number, item: any) => sum + Number(item.amount_cents ?? 0), 0);
  const participantEnquiries = leads.filter((lead: any) =>
    includesAny([lead.service_type, lead.source, lead.temperature, lead.customer_name].join(' '), ['participant', 'ndis', 'support coordinator', 'referral']),
  ).length;
  const customerConversions = orders.filter((order: any) => ['completed', 'paid', 'done'].includes(String(order.status).toLowerCase())).length;

  const evidence: ContentLearningEvidence[] = [
    ...paidContributions.slice(0, 5).map((item: any) => ({
      sourceTable: 'fundraising_contributions',
      sourceId: item.id,
      label: 'Paid donation',
      detail: `${formatMoney(Number(item.amount_cents ?? 0))} contribution recorded.`,
      metric: 'donation_amount_cents',
      value: Number(item.amount_cents ?? 0),
    })),
    ...leads.slice(0, 5).map((lead: any) => ({
      sourceTable: 'leads',
      sourceId: lead.id,
      label: 'Lead generated',
      detail: `${lead.customer_name ?? 'Lead'} · ${lead.service_type ?? lead.source ?? 'unknown service'}`,
      metric: 'lead_count',
      value: 1,
    })),
    ...quotes.slice(0, 5).map((quote: any) => ({
      sourceTable: 'quotes',
      sourceId: quote.id,
      label: 'Quote request',
      detail: `Quote request recorded with status ${quote.status ?? 'unknown'}.`,
      metric: 'quote_request_count',
      value: 1,
    })),
    ...ratings.slice(0, 5).map((rating: any) => ({
      sourceTable: 'ratings',
      sourceId: rating.id,
      label: 'Review generated',
      detail: `${rating.rating}/5 review${rating.comment ? `: ${rating.comment}` : ''}`,
      metric: 'review_count',
      value: 1,
    })),
  ];

  return {
    donationsRaisedCents,
    donorCount: paidContributions.length,
    leadsGenerated: leads.length,
    reviewsGenerated: ratings.length,
    quoteRequestsGenerated: quotes.length,
    customerConversions,
    participantEnquiries,
    evidence,
  };
}

function buildWhatWorked(
  context: FeedbackContext,
  results: OutcomeResults,
  outcomeScore: ContentOutcomeScore,
): ContentLearningPoint[] {
  if (outcomeScore.result === 'missed') {
    return [{
      title: 'Campaign preserved a reusable learning baseline',
      detail: 'Even without a strong outcome, the campaign now has an outcome record for future comparison.',
      evidence: outcomeScore.reason,
      signalType: 'learning_baseline',
    }];
  }

  const theme = context.goal === 'Raise Donations' ? 'Employment mission' : businessOutcomeTheme(context.goal);
  return [{
    title: `${theme} supported the business outcome`,
    detail: `${context.relatedStory} produced a ${outcomeScore.result} result for ${context.goal}.`,
    evidence: outcomeScore.reason,
    signalType: 'business_outcome',
  }];
}

function buildWhatFailed(
  context: FeedbackContext,
  results: OutcomeResults,
  outcomeScore: ContentOutcomeScore,
): ContentLearningPoint[] {
  const failures: ContentLearningPoint[] = [];
  if (outcomeScore.result === 'missed' || outcomeScore.result === 'partial') {
    failures.push({
      title: `${context.goal} outcome was not fully proven`,
      detail: 'Future campaigns should tighten the ask around the primary business metric before optimizing for engagement.',
      evidence: outcomeScore.reason,
      signalType: 'weak_business_outcome',
    });
  }
  if (results.evidence.length === 0) {
    failures.push({
      title: 'Weak attribution evidence',
      detail: 'No direct outcome records were found for this campaign window.',
      evidence: 'Content Feedback Engine could not link donations, leads, quote requests, reviews, or conversions.',
      signalType: 'weak_attribution',
    });
  }
  return failures;
}

function buildRecommendedFutureActions(
  context: FeedbackContext,
  whatWorked: ContentLearningPoint[],
  whatFailed: ContentLearningPoint[],
  outcomeScore: ContentOutcomeScore,
): ContentFutureAction[] {
  const actions: ContentFutureAction[] = [];
  if (whatWorked.some((item) => item.signalType === 'business_outcome')) {
    actions.push({
      action: `Repeat ${businessOutcomeTheme(context.goal).toLowerCase()} framing for ${context.goal} campaigns`,
      rationale: `This campaign produced a ${outcomeScore.result} primary outcome: ${outcomeScore.reason}`,
      appliesToGoals: [context.goal],
      priority: 'high',
    });
  }
  if (context.goal === 'Raise Donations') {
    actions.push({
      action: 'Lead with employment impact before equipment need',
      rationale: 'Fundraising learning should prioritize practical employment outcomes over generic equipment descriptions.',
      appliesToGoals: ['Raise Donations', 'Build Trust'],
      priority: 'high',
    });
  }
  if (whatFailed.length > 0) {
    actions.push({
      action: `Define the ${outcomeScore.primaryMetric} ask more clearly`,
      rationale: 'Weak or partial outcomes should improve the direct business ask before channel expansion.',
      appliesToGoals: [context.goal],
      priority: 'medium',
    });
  }
  return actions;
}

function calculateConfidence(
  context: FeedbackContext,
  results: OutcomeResults,
  outcomeScore: ContentOutcomeScore,
): { score: number; reason: string; evidenceQuality: 'strong' | 'medium' | 'weak' } {
  const directEvidence = results.evidence.length;
  const linkedArtifacts = context.sourceArtifactIds.length;
  const base = directEvidence > 0 ? 50 : 25;
  const evidenceBonus = Math.min(30, directEvidence * 6);
  const artifactBonus = Math.min(10, linkedArtifacts * 2);
  const outcomeBonus = outcomeScore.result === 'met' || outcomeScore.result === 'exceeded' ? 10 : 0;
  const score = Math.min(100, base + evidenceBonus + artifactBonus + outcomeBonus);
  const evidenceQuality: 'strong' | 'medium' | 'weak' = score >= 75 ? 'strong' : score >= 50 ? 'medium' : 'weak';
  return {
    score,
    evidenceQuality,
    reason: directEvidence > 0
      ? `${directEvidence} outcome evidence record${directEvidence === 1 ? '' : 's'} linked to ${linkedArtifacts} source artifact${linkedArtifacts === 1 ? '' : 's'}.`
      : 'No direct outcome evidence was found; keep this learning in review or add manual performance metadata.',
  };
}

function serialiseResults(results: OutcomeResults) {
  return {
    donationsRaisedCents: results.donationsRaisedCents,
    donorCount: results.donorCount,
    leadsGenerated: results.leadsGenerated,
    reviewsGenerated: results.reviewsGenerated,
    quoteRequestsGenerated: results.quoteRequestsGenerated,
    customerConversions: results.customerConversions,
    participantEnquiries: results.participantEnquiries,
  };
}

async function loadRunArtifactIds(client: DbClient, runId: string) {
  const { data } = await client
    .from('campaign_factory_run_artifacts')
    .select('artifact_id')
    .eq('run_id', runId);
  return (data ?? []).map((link: any) => link.artifact_id).filter(Boolean);
}

async function maybeSingle(client: DbClient, table: string, id: string) {
  const { data } = await client.from(table).select('*').eq('id', id).single();
  return data ?? null;
}

async function safeSelect(client: DbClient, table: string, build: (query: any) => any) {
  const result = await build(client.from(table));
  if (result.error) return [];
  return result.data ?? [];
}

function arrayOfObjects(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function businessOutcomeTheme(goal: string) {
  if (goal === 'Raise Donations') return 'Employment impact';
  if (goal === 'Generate Leads') return 'Qualified local demand';
  if (goal === 'Build Trust') return 'Specific proof';
  if (goal === 'Recruit Participants') return 'Practical pathway';
  if (goal === 'Promote Services') return 'Service proof';
  return 'Business outcome';
}

function includesAny(value: string, terms: string[]) {
  const lower = value.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function formatMetric(metric: keyof OutcomeResults, value: number) {
  return metric === 'donationsRaisedCents' ? formatMoney(value) : String(value);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
}
