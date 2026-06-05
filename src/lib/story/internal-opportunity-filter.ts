import type { StoryOpportunity } from '@/types/story-engine';

const INTERNAL_SYSTEM_EVENT = /\b(theme|colour|color|code|component|component update|agent action|agent action log|write_theme_file|design system|dashboard ui|ui change|automation layer|config|configuration|migration|database|api|pull request|commit|css|style update)\b/i;

const PUBLIC_IMPACT_SIGNAL = /\b(customer impact|customer|client|lead impact|lead|revenue impact|revenue|paid|sale|booking|participant impact|participant|ndis|employment impact|employment|employee|hire|community impact|community|visible public milestone|public milestone|public launch|review|testimonial|contract|subscription|recurring)\b/i;

export type OpportunityExposure = 'public_story_opportunity' | 'internal_system_milestone';

export function opportunityText(opp: Pick<StoryOpportunity, 'title' | 'content_angle' | 'notes'>): string {
  return [opp.title, opp.content_angle, opp.notes].join(' ');
}

export function classifyOpportunityExposure(
  opp: Pick<StoryOpportunity, 'title' | 'content_angle' | 'notes' | 'source_type'>,
): OpportunityExposure {
  if (opp.source_type === 'internal_system_milestone') return 'internal_system_milestone';

  const text = opportunityText(opp);
  if (INTERNAL_SYSTEM_EVENT.test(text) && !PUBLIC_IMPACT_SIGNAL.test(text)) {
    return 'internal_system_milestone';
  }

  return 'public_story_opportunity';
}

export function hasPublicImpactSignal(text: string): boolean {
  return PUBLIC_IMPACT_SIGNAL.test(text);
}
