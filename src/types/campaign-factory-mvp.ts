import { type ArtifactContent } from './artifact';
import { type LearningGuidance } from './content-feedback';
import { type StoryIntelligenceRecommendation } from './story-intelligence';

export const CAMPAIGN_FACTORY_GOALS = [
  'Generate Leads',
  'Raise Donations',
  'Build Trust',
  'Recruit Participants',
  'Recruit Customers',
  'Promote Services',
  'Tell Our Story',
  'Grow Social Audience',
] as const;

export type CampaignFactoryGoal = typeof CAMPAIGN_FACTORY_GOALS[number];

export const CAMPAIGN_FACTORY_DELIVERABLES = [
  'Facebook Post',
  'Instagram Post',
  'TikTok Script',
  'Email',
] as const;

export type CampaignFactoryDeliverable = typeof CAMPAIGN_FACTORY_DELIVERABLES[number];

export type CampaignFactoryResearchFinding = {
  title: string;
  detail: string;
  source: string;
};

export type CampaignFactoryResearch = {
  goal: CampaignFactoryGoal;
  recommendation: StoryIntelligenceRecommendation;
  findings: CampaignFactoryResearchFinding[];
  emotionalTriggers: string[];
  learningGuidance: LearningGuidance;
  formatGuidance: Array<{
    platform: string;
    format: string;
    rationale: string;
  }>;
};

export type CampaignFactoryStrategy = {
  campaignName: string;
  goal: CampaignFactoryGoal;
  audience: string;
  thesis: string;
  positioning: string;
  proofPoints: string[];
  callsToAction: string[];
  appliedLearning: {
    use: string[];
    avoid: string[];
    learningArtifactIds: string[];
  };
  deliverables: CampaignFactoryDeliverable[];
};

export type CampaignFactoryGeneratedArtifact = {
  title: string;
  summary: string;
  content: ArtifactContent;
  plainText: string;
};
