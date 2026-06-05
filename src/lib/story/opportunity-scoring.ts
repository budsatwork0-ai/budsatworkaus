// Phase 2H.5: Story Opportunity Scoring Engine
// Deterministic, rule-based. No LLM calls. No external requests.
// Evaluates real fields on StoryOpportunity — never invents signals.

import type { ScoreBreakdown, StoryOpportunity } from '@/types/story-engine';
import { classifyOpportunityExposure } from '@/lib/story/internal-opportunity-filter';

export interface ScoringResult {
  story_score:      number;
  score_breakdown:  ScoreBreakdown;
  score_reason:     string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function storyText(opp: StoryOpportunity): string {
  return [
    opp.title,
    opp.content_angle,
    opp.notes,
  ].join(' ');
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

// ─── Dimension 1: Human Impact (0–25) ────────────────────────────────────────
// How directly does this story involve and affect real people?

function scoreHumanImpact(opp: StoryOpportunity): { score: number; reasons: string[] } {
  const text  = storyText(opp);
  const reasons: string[] = [];
  let score = 0;

  // NDIS / participant / support = highest human impact
  if (has(text, /\b(ndis|participant|support\s+worker|disability\s+support|independent\s+living|carer)\b/i)) {
    score = 25;
    reasons.push('Involves NDIS participant or support worker');
  } else if (has(text, /\b(employment\s+outcome|employed|job\s+offer|new\s+job|livelihood|income\s+source)\b/i)) {
    score = 22;
    reasons.push('Employment or livelihood outcome');
  } else if (
    has(text, /\b(customer|client)\b/i) &&
    has(text, /\b(transform|recurring|loyal|return|outcome|result|referral|referred)\b/i)
  ) {
    score = 20;
    reasons.push('Customer story with clear outcome or transformation');
  } else if (has(text, /\b(customer|client)\b/i)) {
    score = 12;
    reasons.push('Customer or client involvement');
  } else if (has(text, /\b(crew\s+member|crew\s+worker|team\s+member|staff\s+member|employee|worker)\b/i)) {
    score = 7;
    reasons.push('Crew or team member story');
  }

  // Named characters amplify human impact
  if (opp.related_characters.length > 0 && score < 25) {
    score = Math.min(score + 3, 25);
    reasons.push(`${opp.related_characters.length} named character(s) referenced`);
  }

  return { score: Math.min(score, 25), reasons };
}

// ─── Dimension 2: Business Significance (0–20) ───────────────────────────────
// How significant is this moment to Buds At Work as a business?

function scoreBusinessSignificance(opp: StoryOpportunity): { score: number; reasons: string[] } {
  const text  = storyText(opp);
  const reasons: string[] = [];
  let score = 0;

  // First recurring/subscription customer = maximum business milestone
  if (has(text, /\b(first\s+recurring|first\s+subscription|first\s+repeat\s+customer|first\s+return)\b/i)) {
    score = 20;
    reasons.push('First recurring or subscription customer');
  } else if (has(text, /\b(first\s+(customer|client|sale|order|booking|revenue|payment|commercial\s+contract|contract))\b/i)) {
    score = 18;
    reasons.push('First customer / first sale / first booking');
  } else if (has(text, /\b(first\s+(lead|inquiry|enquiry))\b/i)) {
    score = 16;
    reasons.push('First lead or inquiry');
  } else if (has(text, /\b(first\s+\$?1,?000\s+month|first\s+thousand(?:-|\s)dollar\s+month)\b/i)) {
    score = 18;
    reasons.push('First meaningful revenue month');
  } else if (has(text, /\b(first\s+(employee|hire|staff\s+member|crew\s+member))\b/i)) {
    score = 14;
    reasons.push('First team growth milestone');
  } else if (has(text, /\b(recurring|subscription|repeat\s+customer|retention)\b/i)) {
    score = 16;
    reasons.push('Recurring or subscription business');
  } else if (has(text, /\b(five[\s\-]?star|5[\s\-]?star|★{4,5}|5\/5|top\s+review|five\s+star)\b/i)) {
    score = 14;
    reasons.push('Five-star review or top rating');
  } else if (has(text, /\b(review|testimonial|feedback|referral)\b/i)) {
    score = 11;
    reasons.push('Customer review, testimonial, or referral');
  } else if (
    has(text, /\bfirst\b/i) &&
    opp.source_type === 'milestone'
  ) {
    // First milestone (non-revenue) — e.g. first agent action
    score = 11;
    reasons.push('First business or operational milestone');
  } else if (opp.source_type === 'milestone' || has(text, /\b(milestone|achievement|launch|deployed|live)\b/i)) {
    score = 7;
    reasons.push('Business or system milestone');
  } else if (has(text, /\b(theme|colour|color|style|design|config|updated|changed)\b/i) &&
             !has(text, /\b(customer|client|participant)\b/i)) {
    score = 2;
    reasons.push('Technical configuration or style change');
  }

  // High-confidence auto-detection adds confidence bonus
  if (opp.is_auto_detected && opp.confidence_score !== null && opp.confidence_score >= 0.75 && score < 20) {
    score = Math.min(score + 2, 20);
    reasons.push(`Auto-detected at ${Math.round(opp.confidence_score * 100)}% confidence`);
  }

  return { score: Math.min(score, 20), reasons };
}

// ─── Dimension 3: Emotional Tension (0–15) ───────────────────────────────────
// Is there conflict, stakes, or dramatic weight worth exploring?

function scoreEmotionalTension(opp: StoryOpportunity): { score: number; reasons: string[] } {
  const text  = storyText(opp);
  const reasons: string[] = [];
  let score = 0;

  if (has(text, /\b(struggle|conflict|crisis|broke|failed|rejected|lost\s+the|nearly|almost\s+quit|fell\s+apart)\b/i)) {
    score = 11;
    reasons.push('Strong tension or conflict signal in content');
  } else if (has(text, /\b(challenge|difficult|hard\s+time|problem|worry|worried|risk|setback|behind)\b/i)) {
    score = 6;
    reasons.push('Moderate challenge or problem language');
  } else if (has(text, /\b(uncertain|pressure|concern|question|wondered)\b/i)) {
    score = 2;
    reasons.push('Mild tension or uncertainty signal');
  }

  // Section placement is a supporting editorial signal, not dominant evidence.
  if (opp.section === 'tension_map') {
    score = Math.min(score + 3, 15);
    reasons.push('Filed in Tension Map — supporting tension signal');
  }

  return { score: Math.min(score, 15), reasons };
}

// ─── Dimension 4: Transformation Potential (0–20) ────────────────────────────
// Does this story have a clear before/after or growth arc?

function scoreTransformationPotential(opp: StoryOpportunity): { score: number; reasons: string[] } {
  const text  = storyText(opp);
  const reasons: string[] = [];
  let score = 0;

  // Life / livelihood transformation = highest
  if (has(text, /\b(employment|independence|livelihood|life\s+chang|life-chang|new\s+career|changed\s+their\s+life)\b/i)) {
    score = 20;
    reasons.push('Life or livelihood transformation');
  } else if (
    has(text, /\b(transform|before.{0,20}after|turnaround|complete\s+change)\b/i) &&
    has(text, /\b(customer|client|participant)\b/i)
  ) {
    score = 17;
    reasons.push('Clear customer or participant transformation arc');
  } else if (has(text, /\b(loyal|recurring|return|kept\s+coming|kept\s+booking|regular\s+customer)\b/i)) {
    score = 15;
    reasons.push('Customer loyalty or retention journey');
  } else if (has(text, /\b(growth|grew|expanding|scaled|doubled|breakthrough)\b/i)) {
    score = 13;
    reasons.push('Business growth or breakthrough');
  } else if (has(text, /\b(first\s+solo\s+job|solo\s+job|took\s+responsibility|without\s+needing\s+rescue)\b/i)) {
    score = 13;
    reasons.push('Crew capability growth');
  } else if (has(text, /\b(first\s+employee|first\s+hire|founder-only|real\s+crew\s+member)\b/i)) {
    score = 13;
    reasons.push('Team growth from founder-only work');
  } else if (has(text, /\b(first\s+real|first\s+time|no\s+longer\s+a\s+prototype|became\s+real|went\s+live)\b/i)) {
    score = 9;
    reasons.push('System or product became real / went live');
  } else if (has(text, /\bfirst\b/i) && opp.source_type === 'milestone') {
    score = 7;
    reasons.push('First milestone — beginning of a journey');
  } else if (has(text, /\b(theme|colour|color|style|design|config|configuration)\b/i) &&
             has(text, /\b(changed|updated|modified|adjusted|update)\b/i) &&
             !has(text, /\b(customer|client|participant|crew\s+member|employee)\b/i)) {
    score = 1;
    reasons.push('Configuration or style update');
  } else if (has(text, /\b(improve|improved|better|upgrade|update|refine)\b/i)) {
    score = 4;
    reasons.push('Improvement or refinement');
  } else if (has(text, /\b(changed|updated|modified|adjusted)\b/i)) {
    score = 2;
    reasons.push('Change or update — minor transformation signal');
  }

  return { score: Math.min(score, 20), reasons };
}

// ─── Dimension 5: Content Potential (0–20) ───────────────────────────────────
// How ready and rich is this story for content development?

function scoreContentPotential(opp: StoryOpportunity): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Format and platform being set signals content readiness
  if (opp.suggested_format && opp.suggested_format.trim()) {
    score += 5;
    reasons.push(`Format specified: ${opp.suggested_format}`);
  }
  if (opp.suggested_platform && opp.suggested_platform.trim()) {
    score += 4;
    reasons.push(`Platform specified: ${opp.suggested_platform}`);
  }

  // Content angle richness
  const angleLen = (opp.content_angle ?? '').trim().length;
  if (angleLen > 150) {
    score += 5;
    reasons.push('Rich content angle (>150 chars)');
  } else if (angleLen > 50) {
    score += 2;
    reasons.push('Moderate content angle length');
  }

  // Social proof = inherently shareable
  const text = storyText(opp);
  if (has(text, /\b(review|testimonial|feedback|five[\s\-]?star|referral)\b/i)) {
    score += 4;
    reasons.push('Social proof — inherently shareable');
  }

  // Visual/educational content potential
  if (has(text, /\b(photo|video|reel|visual|before.{0,10}after|transformation\s+photo)\b/i)) {
    score += 2;
    reasons.push('Visual content opportunity');
  }

  return { score: Math.min(score, 20), reasons };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function evaluateOpportunity(opp: StoryOpportunity): ScoringResult {
  if (classifyOpportunityExposure(opp) === 'internal_system_milestone') {
    return {
      story_score: 0,
      score_breakdown: {
        human_impact: 0,
        business_significance: 0,
        emotional_tension: 0,
        transformation_potential: 0,
        content_potential: 0,
        reasons: ['Internal system milestone — not public content without customer, lead, revenue, participant, employment, community, or visible public milestone impact'],
      },
      score_reason: 'Internal system milestone — not public content.',
    };
  }

  const humanResult       = scoreHumanImpact(opp);
  const businessResult    = scoreBusinessSignificance(opp);
  const tensionResult     = scoreEmotionalTension(opp);
  const transformResult   = scoreTransformationPotential(opp);
  const contentResult     = scoreContentPotential(opp);

  const breakdown: ScoreBreakdown = {
    human_impact:             humanResult.score,
    business_significance:    businessResult.score,
    emotional_tension:        tensionResult.score,
    transformation_potential: transformResult.score,
    content_potential:        contentResult.score,
    reasons: [
      ...humanResult.reasons,
      ...businessResult.reasons,
      ...tensionResult.reasons,
      ...transformResult.reasons,
      ...contentResult.reasons,
    ],
  };

  const story_score = Math.min(
    100,
    breakdown.human_impact +
    breakdown.business_significance +
    breakdown.emotional_tension +
    breakdown.transformation_potential +
    breakdown.content_potential,
  );

  const score_reason = breakdown.reasons.length > 0
    ? breakdown.reasons.join('. ') + '.'
    : 'No strong story signals detected.';

  return { story_score, score_breakdown: breakdown, score_reason };
}
