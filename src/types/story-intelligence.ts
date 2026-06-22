import { type ArtifactContent } from './artifact';
import { type ScoreBreakdown, type StoryCategory } from './story-engine';

export type StoryIntelligenceSignalType =
  | 'story_score'
  | 'story_arc'
  | 'open_thread'
  | 'fundraising'
  | 'job'
  | 'review'
  | 'lead'
  | 'milestone'
  | 'recency'
  | 'content_readiness';

export type StoryIntelligenceSignal = {
  id: string;
  type: StoryIntelligenceSignalType;
  label: string;
  detail: string;
  sourceTable: string;
  sourceId: string | null;
  weight: number;
};

export type StoryIntelligenceSourceRef = {
  id: string;
  title: string;
  detail: string;
  href?: string;
};

export type StoryIntelligenceRecommendation = {
  id: string;
  opportunityId: string;
  title: string;
  recommendedStory: string;
  score: number;
  baseStoryScore: number;
  recommendationBonus: number;
  scoreFormula: string;
  scoreBreakdown: ScoreBreakdown | null;
  storyCategory: StoryCategory | null;
  businessGoal: string;
  nextAction: {
    label: string;
    href: string;
    intent: 'create_story_brief';
  };
  why: string[];
  supportingSignals: StoryIntelligenceSignal[];
  relatedStoryArcs: StoryIntelligenceSourceRef[];
  relatedOpenThreads: StoryIntelligenceSourceRef[];
  relatedFundraisingCampaigns: StoryIntelligenceSourceRef[];
  relatedJobs: StoryIntelligenceSourceRef[];
  relatedReviews: StoryIntelligenceSourceRef[];
  relatedLeads: StoryIntelligenceSourceRef[];
  relatedMilestones: StoryIntelligenceSourceRef[];
  suggestedFormat: string;
  suggestedPlatform: string;
  contentAngle: string;
  createdAt: string;
};

export type StoryIntelligenceResponse = {
  generatedAt: string;
  recommendations: StoryIntelligenceRecommendation[];
};

export type StoryBriefArtifactInput = {
  recommendation: StoryIntelligenceRecommendation;
};

export type StoryBriefArtifactResult = {
  artifactContent: ArtifactContent;
  plainText: string;
};
