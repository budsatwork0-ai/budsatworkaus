import { describe, expect, it } from 'vitest';
import {
  buildCampaignArtifact,
  buildResearchArtifact,
  buildStrategyArtifact,
  buildStrategyOutput,
} from '@/lib/campaign-factory/mvp';
import {
  type CampaignFactoryGoal,
  type CampaignFactoryResearch,
} from '@/types/campaign-factory-mvp';
import { type StoryIntelligenceRecommendation } from '@/types/story-intelligence';

const SCENARIOS: Array<{
  goal: CampaignFactoryGoal;
  story: string;
  businessSignal: string;
  signalType: StoryIntelligenceRecommendation['supportingSignals'][number]['type'];
  cta: string;
}> = [
  {
    goal: 'Raise Donations',
    story: 'Trailer funding closes the gap for paid work',
    businessSignal: 'Mower trailer fundraiser has $1,850 raised toward a $3,000 equipment need',
    signalType: 'fundraising',
    cta: 'Fund this need',
  },
  {
    goal: 'Generate Leads',
    story: 'New Ipswich cleaning enquiries are clustering around recurring home support',
    businessSignal: 'Four warm home-cleaning leads arrived from the services quote flow this week',
    signalType: 'lead',
    cta: 'Book a service',
  },
  {
    goal: 'Build Trust',
    story: 'Five-star customer feedback proves the work is reliable',
    businessSignal: 'A verified customer review praised punctuality and respectful service',
    signalType: 'review',
    cta: 'See the proof',
  },
  {
    goal: 'Recruit Participants',
    story: 'First supervised shift creates a practical pathway into work',
    businessSignal: 'The employment pathway thread is open and ready for participant referral',
    signalType: 'open_thread',
    cta: 'Ask about work pathways',
  },
  {
    goal: 'Promote Services',
    story: 'Bin cleans and yard help are becoming the strongest local service pair',
    businessSignal: 'Recent completed jobs show customers bundling bin cleans with yard maintenance',
    signalType: 'job',
    cta: 'View services',
  },
];

describe('Campaign Factory output quality', () => {
  it.each(SCENARIOS)('keeps $goal campaigns grounded in Buds At Work business signals', (scenario) => {
    const recommendation = recommendationFor(scenario);
    const research = researchFor(scenario.goal, recommendation, scenario.businessSignal);
    const strategy = buildStrategyOutput(scenario.goal, recommendation, research);
    const artifact = buildCampaignArtifact(recommendation, strategy, research);

    const memoryBlock = artifact.content.blocks.find((block) => block.id === 'why-this-campaign-exists');
    const signalBlock = artifact.content.blocks.find((block) => block.id === 'supporting-signals');

    expect(memoryBlock?.title).toBe('Why This Campaign Exists');
    expect(JSON.stringify(memoryBlock)).toContain(`Business Goal: ${scenario.goal}`);
    expect(JSON.stringify(memoryBlock)).toContain('Story Arc: Proof of Work Arc');
    expect(JSON.stringify(memoryBlock)).toContain('Open Thread: Practical Employment Pathway');
    expect(JSON.stringify(memoryBlock)).toContain(scenario.businessSignal);
    expect(JSON.stringify(signalBlock)).toContain(scenario.businessSignal);
    expect(artifact.plainText).toContain('Why this campaign exists');
    expect(artifact.plainText).toContain(scenario.cta);
  });

  it('research, strategy, and campaign artifacts preserve the approved core loop', () => {
    const scenario = SCENARIOS[0];
    const recommendation = recommendationFor(scenario);
    const research = researchFor(scenario.goal, recommendation, scenario.businessSignal);
    const strategy = buildStrategyOutput(scenario.goal, recommendation, research);

    expect(buildResearchArtifact(research).content.artifactType).toBe('research');
    expect(buildStrategyArtifact(strategy).content.artifactType).toBe('strategy');
    expect(buildCampaignArtifact(recommendation, strategy, research).content.artifactType).toBe('campaign');
  });
});

function recommendationFor(scenario: (typeof SCENARIOS)[number]): StoryIntelligenceRecommendation {
  return {
    id: `story-intelligence:${slug(scenario.story)}`,
    opportunityId: '00000000-0000-4000-8000-000000000001',
    title: scenario.story,
    recommendedStory: scenario.story,
    score: 88,
    baseStoryScore: 70,
    recommendationBonus: 18,
    scoreFormula: 'min(100, base story score 70 + visible signal bonus 18)',
    scoreBreakdown: null,
    storyCategory: null,
    businessGoal: scenario.goal,
    nextAction: {
      label: 'Generate Story Brief Artifact',
      href: '/api/story-intelligence/brief?opportunity_id=00000000-0000-4000-8000-000000000001',
      intent: 'create_story_brief',
    },
    why: [
      scenario.businessSignal,
      `Supports business goal: ${scenario.goal}.`,
    ],
    supportingSignals: [
      {
        id: `${slug(scenario.story)}:signal`,
        type: scenario.signalType,
        label: 'Business signal',
        detail: scenario.businessSignal,
        sourceTable: signalSourceTable(scenario.signalType),
        sourceId: '00000000-0000-4000-8000-000000000002',
        weight: 8,
      },
      {
        id: `${slug(scenario.story)}:recency`,
        type: 'recency',
        label: 'Fresh opportunity',
        detail: 'Created today.',
        sourceTable: 'story_opportunities',
        sourceId: '00000000-0000-4000-8000-000000000001',
        weight: 3,
      },
    ],
    relatedStoryArcs: [{
      id: '00000000-0000-4000-8000-000000000003',
      title: 'Proof of Work Arc',
      detail: 'active arc · priority 1',
      href: '/dashboard/story-engine/arcs',
    }],
    relatedOpenThreads: [{
      id: '00000000-0000-4000-8000-000000000004',
      title: 'Practical Employment Pathway',
      detail: 'Open since 22 Jun',
      href: '/dashboard/story-engine/open-threads',
    }],
    relatedFundraisingCampaigns: [],
    relatedJobs: [],
    relatedReviews: [],
    relatedLeads: [],
    relatedMilestones: [],
    suggestedFormat: 'Campaign artifact',
    suggestedPlatform: 'Content Library',
    contentAngle: scenario.businessSignal,
    createdAt: '2026-06-22T00:00:00.000Z',
  };
}

function researchFor(
  goal: CampaignFactoryGoal,
  recommendation: StoryIntelligenceRecommendation,
  businessSignal: string,
): CampaignFactoryResearch {
  return {
    goal,
    recommendation,
    findings: [
      {
        title: 'Visible Buds At Work signal',
        detail: businessSignal,
        source: 'scenario_fixture',
      },
      {
        title: 'Campaign scope intentionally limited',
        detail: 'No publishing, scheduling, social integrations, or automation are triggered.',
        source: 'campaign_factory_scope',
      },
    ],
    emotionalTriggers: ['Proof', 'Momentum'],
    formatGuidance: [
      { platform: 'Facebook', format: 'Short post', rationale: 'Local trust and context.' },
      { platform: 'Instagram', format: 'Caption', rationale: 'Mission proof.' },
      { platform: 'TikTok', format: 'Short script', rationale: 'Founder-led story.' },
      { platform: 'Email', format: 'Plain text', rationale: 'Direct ask.' },
    ],
  };
}

function signalSourceTable(type: StoryIntelligenceRecommendation['supportingSignals'][number]['type']) {
  if (type === 'fundraising') return 'fundraising_items';
  if (type === 'lead') return 'leads';
  if (type === 'review') return 'ratings';
  if (type === 'job') return 'orders';
  if (type === 'open_thread') return 'story_open_threads';
  return 'story_opportunities';
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
