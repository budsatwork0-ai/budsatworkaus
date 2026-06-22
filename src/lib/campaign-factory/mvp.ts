import {
  CAMPAIGN_FACTORY_DELIVERABLES,
  type CampaignFactoryGeneratedArtifact,
  type CampaignFactoryGoal,
  type CampaignFactoryResearch,
  type CampaignFactoryResearchFinding,
  type CampaignFactoryStrategy,
} from '@/types/campaign-factory-mvp';
import { type StoryIntelligenceRecommendation } from '@/types/story-intelligence';

type DbClient = {
  from: (table: string) => any;
};

type ResearchTrend = {
  id: string;
  platform: string;
  title: string;
  description: string;
  trend_type: string;
  urgency: string;
  adaptation_angle: string;
  adaptation_score: number | null;
  adaptation_reason: string | null;
  status: string;
};

export async function buildResearchServiceOutput(
  client: DbClient,
  goal: CampaignFactoryGoal,
  recommendation: StoryIntelligenceRecommendation,
): Promise<CampaignFactoryResearch> {
  const { data: trends } = await client
    .from('research_trends')
    .select('id,platform,title,description,trend_type,urgency,adaptation_angle,adaptation_score,adaptation_reason,status')
    .in('status', ['watching', 'adapting'])
    .order('adaptation_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(8);

  const trendFindings: CampaignFactoryResearchFinding[] = (trends ?? [])
    .slice(0, 4)
    .map((trend: ResearchTrend) => ({
      title: `${platformLabel(trend.platform)} · ${trend.title}`,
      detail: trend.adaptation_reason || trend.adaptation_angle || trend.description,
      source: `research_trends:${trend.id}`,
    }));

  const storyFindings = recommendation.supportingSignals
    .filter((signal) => signal.type !== 'story_score')
    .slice(0, 5)
    .map((signal) => ({
      title: signal.label,
      detail: signal.detail,
      source: signal.sourceTable,
    }));

  const findings = [
    ...storyFindings,
    ...trendFindings,
    {
      title: 'Campaign scope intentionally limited',
      detail: 'Batch 3 generates only Facebook, Instagram, TikTok script, and email artifacts. It does not publish or create downstream production records.',
      source: 'campaign_factory_scope',
    },
  ];

  return {
    goal,
    recommendation,
    findings,
    emotionalTriggers: emotionalTriggersFor(goal, recommendation),
    formatGuidance: [
      { platform: 'Facebook', format: 'Short post', rationale: 'Best for local trust, context, and clear calls to action.' },
      { platform: 'Instagram', format: 'Caption + visual direction', rationale: 'Best for emotional proof and mission visibility.' },
      { platform: 'TikTok', format: 'Short script', rationale: 'Best for founder-led story, immediacy, and discovery.' },
      { platform: 'Email', format: 'Plain-text campaign email', rationale: 'Best for warm audience conversion and direct asks.' },
    ],
  };
}

export function buildStrategyOutput(
  goal: CampaignFactoryGoal,
  recommendation: StoryIntelligenceRecommendation,
  research: CampaignFactoryResearch,
): CampaignFactoryStrategy {
  const proofPoints = [
    ...recommendation.why.slice(0, 4),
    ...research.findings.slice(0, 3).map((finding) => finding.detail),
  ].filter(Boolean);

  return {
    campaignName: `${recommendation.recommendedStory} · ${goal}`,
    goal,
    audience: audienceFor(goal),
    thesis: `${recommendation.recommendedStory} matters now because it connects a real Buds At Work story to ${goal.toLowerCase()}.`,
    positioning: positioningFor(goal, recommendation),
    proofPoints: [...new Set(proofPoints)].slice(0, 6),
    callsToAction: callsToActionFor(goal),
    deliverables: [...CAMPAIGN_FACTORY_DELIVERABLES],
  };
}

export function buildResearchArtifact(research: CampaignFactoryResearch): CampaignFactoryGeneratedArtifact {
  const title = `Research: ${research.recommendation.recommendedStory}`;
  const summary = `Research findings for a ${research.goal} campaign grounded in Story Intelligence signals.`;
  return {
    title,
    summary,
    plainText: [
      title,
      summary,
      ...research.findings.map((finding) => `- ${finding.title}: ${finding.detail}`),
    ].join('\n'),
    content: {
      schemaVersion: 'artifact.v1',
      artifactType: 'research',
      blocks: [
        heroBlock('Research Artifact', title, summary, `${research.recommendation.score}/100`),
        {
          id: 'findings',
          type: 'insight_list',
          title: 'Findings',
          data: {
            insights: research.findings.map((finding) => ({
              title: finding.title,
              detail: finding.detail,
              source: finding.source,
            })),
          },
        },
        {
          id: 'emotional-triggers',
          type: 'recommendation_list',
          title: 'Emotional triggers to use',
          data: {
            recommendations: research.emotionalTriggers.map((trigger) => ({
              title: trigger,
              rationale: 'Selected from the campaign goal and visible Story Intelligence signals.',
              priority: 'medium',
            })),
          },
        },
        {
          id: 'format-guidance',
          type: 'channel_plan',
          title: 'Format guidance',
          data: {
            channels: research.formatGuidance.map((item) => ({
              platform: item.platform,
              format: item.format,
              angle: item.rationale,
            })),
          },
        },
      ],
    },
  };
}

export function buildStrategyArtifact(strategy: CampaignFactoryStrategy): CampaignFactoryGeneratedArtifact {
  const title = `Strategy: ${strategy.campaignName}`;
  const summary = `${strategy.goal} strategy for ${strategy.audience}.`;
  return {
    title,
    summary,
    plainText: [
      title,
      strategy.thesis,
      strategy.positioning,
      'Proof points:',
      ...strategy.proofPoints.map((point) => `- ${point}`),
    ].join('\n'),
    content: {
      schemaVersion: 'artifact.v1',
      artifactType: 'strategy',
      blocks: [
        heroBlock('Strategy Artifact', title, strategy.thesis, strategy.goal),
        {
          id: 'summary',
          type: 'summary',
          title: 'Positioning',
          data: {
            body: strategy.positioning,
            bullets: [
              `Audience: ${strategy.audience}`,
              `Goal: ${strategy.goal}`,
              `Deliverables: ${strategy.deliverables.join(', ')}`,
            ],
          },
        },
        {
          id: 'proof-points',
          type: 'recommendation_list',
          title: 'Proof points',
          data: {
            recommendations: strategy.proofPoints.map((point) => ({
              title: point,
              rationale: 'Visible supporting evidence from Story Intelligence or research.',
              priority: 'high',
            })),
          },
        },
        {
          id: 'ctas',
          type: 'decision_panel',
          title: 'Calls to action',
          data: {
            decision: 'Use one CTA per channel, matched to the platform and audience temperature.',
            options: strategy.callsToAction,
            approvalNote: 'Approval stops at artifact review. No publishing is triggered.',
          },
        },
      ],
    },
  };
}

export function buildCampaignArtifact(
  recommendation: StoryIntelligenceRecommendation,
  strategy: CampaignFactoryStrategy,
  research: CampaignFactoryResearch,
): CampaignFactoryGeneratedArtifact {
  const title = `Campaign: ${strategy.campaignName}`;
  const summary = `Narrow campaign artifact with Facebook, Instagram, TikTok, and email deliverables.`;
  const memory = buildCampaignMemory(recommendation, strategy, research);
  const copy = generateCopy(recommendation, strategy, research);

  return {
    title,
    summary,
    plainText: [
      title,
      strategy.thesis,
      'Why this campaign exists:',
      `- Business Goal: ${memory.businessGoal}`,
      `- Story Arc: ${memory.storyArc}`,
      `- Open Thread: ${memory.openThread}`,
      `- Supporting Signals: ${memory.supportingSignals.join('; ')}`,
      `- Why this campaign exists: ${memory.whyThisCampaignExists}`,
      ...copy.map((item) => `${item.title}\n${item.note}`),
    ].join('\n\n'),
    content: {
      schemaVersion: 'artifact.v1',
      artifactType: 'campaign',
      blocks: [
        heroBlock('Campaign Artifact', title, strategy.thesis, strategy.goal),
        {
          id: 'campaign-brief',
          type: 'summary',
          title: 'Campaign brief',
          data: {
            body: strategy.positioning,
            bullets: [
              `Business goal: ${strategy.goal}`,
              `Audience: ${strategy.audience}`,
              `Grounded in: ${recommendation.recommendedStory}`,
              `Score formula: ${recommendation.scoreFormula}`,
            ],
          },
        },
        {
          id: 'why-this-campaign-exists',
          type: 'summary',
          title: 'Why This Campaign Exists',
          data: {
            body: memory.whyThisCampaignExists,
            bullets: [
              `Business Goal: ${memory.businessGoal}`,
              `Story Arc: ${memory.storyArc}`,
              `Open Thread: ${memory.openThread}`,
              `Supporting Signals: ${memory.supportingSignals.join(' | ')}`,
              `Why this campaign exists: ${memory.whyThisCampaignExists}`,
            ],
          },
        },
        {
          id: 'supporting-signals',
          type: 'insight_list',
          title: 'Supporting Signals',
          data: {
            insights: memory.signalInsights,
          },
        },
        {
          id: 'deliverables',
          type: 'asset_list',
          title: 'Initial deliverables',
          data: {
            assets: copy,
          },
        },
        {
          id: 'channel-plan',
          type: 'channel_plan',
          title: 'Channel plan',
          data: {
            channels: [
              { platform: 'Facebook', format: 'Post', angle: 'Local trust and context', cadence: 'One post' },
              { platform: 'Instagram', format: 'Post', angle: 'Visual mission proof', cadence: 'One feed post' },
              { platform: 'TikTok', format: 'Script', angle: 'Founder-led short-form story', cadence: 'One short video' },
              { platform: 'Email', format: 'Plain text', angle: 'Direct conversion ask', cadence: 'One send' },
            ],
          },
        },
        {
          id: 'approval',
          type: 'decision_panel',
          title: 'Approval boundary',
          data: {
            decision: 'Review this campaign artifact. Approval does not publish, schedule, or create downstream production records.',
            options: ['Approve artifact', 'Revise artifact', 'Hold campaign'],
            approvalNote: 'No automation beyond artifact approval is active in Batch 3.',
          },
        },
      ],
    },
  };
}

function buildCampaignMemory(
  recommendation: StoryIntelligenceRecommendation,
  strategy: CampaignFactoryStrategy,
  research: CampaignFactoryResearch,
) {
  const storyArc = recommendation.relatedStoryArcs[0]?.title ?? 'No linked story arc recorded';
  const openThread = recommendation.relatedOpenThreads[0]?.title ?? 'No linked open thread recorded';
  const signalInsights = recommendation.supportingSignals
    .filter((signal) => signal.type !== 'story_score')
    .slice(0, 6)
    .map((signal) => ({
      title: signal.label,
      detail: signal.detail,
      source: signal.sourceTable,
    }));
  const supportingSignals = signalInsights.length > 0
    ? signalInsights.map((signal) => `${signal.title}: ${signal.detail}`)
    : research.findings.slice(0, 3).map((finding) => `${finding.title}: ${finding.detail}`);
  const primaryReason = recommendation.why[0] ?? strategy.proofPoints[0] ?? strategy.thesis;

  return {
    businessGoal: strategy.goal,
    storyArc,
    openThread,
    supportingSignals,
    signalInsights,
    whyThisCampaignExists: `${recommendation.recommendedStory} exists as a ${strategy.goal} campaign because ${primaryReason}`,
  };
}

function generateCopy(
  recommendation: StoryIntelligenceRecommendation,
  strategy: CampaignFactoryStrategy,
  research: CampaignFactoryResearch,
) {
  const cta = strategy.callsToAction[0] ?? 'Learn more';
  const proof = strategy.proofPoints[0] ?? recommendation.why[0] ?? 'There is a strong story signal behind this campaign.';
  const trigger = research.emotionalTriggers[0] ?? 'proof';
  const story = recommendation.recommendedStory;

  return [
    {
      title: 'Facebook Post',
      type: 'Copy',
      status: 'Draft artifact',
      note: `${story}\n\n${strategy.positioning}\n\nWhy this matters: ${proof}\n\n${cta}`,
    },
    {
      title: 'Instagram Post',
      type: 'Copy',
      status: 'Draft artifact',
      note: `${story}\n\nA real Buds At Work moment about ${trigger.toLowerCase()}.\n\n${proof}\n\n${cta}`,
    },
    {
      title: 'TikTok Script',
      type: 'Script',
      status: 'Draft artifact',
      note: `Hook: "This is the story Buds At Work should talk about today."\n\nSetup: ${story} connects directly to ${strategy.goal.toLowerCase()}.\n\nCore moment: ${proof}\n\nClose: ${cta}`,
    },
    {
      title: 'Email',
      type: 'Copy',
      status: 'Draft artifact',
      note: `Subject: ${story}\n\nHi,\n\n${strategy.thesis}\n\n${strategy.positioning}\n\n${proof}\n\n${cta}\n\n- Buds At Work`,
    },
  ];
}

function heroBlock(eyebrow: string, heading: string, subheading: string, metric: string) {
  return {
    id: 'hero',
    type: 'hero' as const,
    data: {
      eyebrow,
      heading,
      subheading,
      primaryMetricLabel: 'Goal',
      primaryMetricValue: metric,
    },
  };
}

function emotionalTriggersFor(goal: CampaignFactoryGoal, recommendation: StoryIntelligenceRecommendation) {
  const base = ['Proof', 'Momentum'];
  if (goal === 'Raise Donations') return ['Contribution', 'Employment impact', 'Urgency', ...base];
  if (goal === 'Generate Leads' || goal === 'Recruit Customers') return ['Trust', 'Local proof', 'Customer demand', ...base];
  if (goal === 'Build Trust') return ['Credibility', 'Specific evidence', 'Human stakes', ...base];
  if (goal === 'Recruit Participants') return ['Belonging', 'Capability', 'Pathway', ...base];
  if (goal === 'Grow Social Audience') return ['Curiosity', 'Founder journey', 'Transformation', ...base];
  if (recommendation.businessGoal === 'Raise Donations') return ['Contribution', 'Mission', 'Urgency', ...base];
  return ['Mission', 'Human progress', 'Transformation', ...base];
}

function audienceFor(goal: CampaignFactoryGoal) {
  switch (goal) {
    case 'Generate Leads':
    case 'Recruit Customers':
    case 'Promote Services':
      return 'Local customers who need trustworthy services and want to support meaningful employment.';
    case 'Raise Donations':
      return 'Supporters, partners, and community members who want their contribution to create practical employment outcomes.';
    case 'Recruit Participants':
      return 'Participants, families, coordinators, and support networks looking for practical work pathways.';
    case 'Build Trust':
      return 'Warm audience, referrers, partners, and customers evaluating whether Buds At Work is credible.';
    case 'Grow Social Audience':
      return 'Cold social audience who will respond to founder-led proof and visible transformation.';
    case 'Tell Our Story':
    default:
      return 'People who need to understand what Buds At Work is building and why it matters.';
  }
}

function positioningFor(goal: CampaignFactoryGoal, recommendation: StoryIntelligenceRecommendation) {
  return `${recommendation.recommendedStory} should be framed as a concrete proof point, not a generic update. It should make the business goal "${goal}" feel tied to real work, real people, and visible progress.`;
}

function callsToActionFor(goal: CampaignFactoryGoal) {
  switch (goal) {
    case 'Generate Leads':
      return ['Book a service', 'Request a quote', 'Message Buds At Work'];
    case 'Raise Donations':
      return ['Fund this need', 'Share the campaign', 'Back practical employment'];
    case 'Recruit Participants':
      return ['Ask about work pathways', 'Refer a participant', 'Talk to Buds At Work'];
    case 'Recruit Customers':
      return ['Become a customer', 'Book a first job', 'Support the mission through a service'];
    case 'Promote Services':
      return ['View services', 'Get a quote', 'Choose a service'];
    case 'Grow Social Audience':
      return ['Follow the build', 'Share this story', 'Watch what happens next'];
    case 'Build Trust':
      return ['See the proof', 'Follow the work', 'Talk to Buds At Work'];
    case 'Tell Our Story':
    default:
      return ['Follow the story', 'Share this mission', 'Learn what Buds At Work is building'];
  }
}

function platformLabel(platform: string) {
  const labels: Record<string, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    facebook: 'Facebook',
    youtube: 'YouTube',
    linkedin: 'LinkedIn',
    website: 'Website',
  };
  return labels[platform] ?? platform;
}
