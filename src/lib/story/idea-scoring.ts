// Deterministic idea scorer — no LLM, no DB calls.
// Caller supplies the idea fields and an optional upstream opportunity score
// (0-100) so the story grounding dimension can inherit signal.
//
// Three dimensions, max 100:
//   Story Grounding     (0-40) — how strongly is this idea tied to a scored story opportunity?
//   Content Readiness   (0-35) — are the production fields filled in?
//   Acquisition Clarity (0-25) — does the angle serve local customer acquisition?

export interface IdeaForScoring {
  title:              string;
  platform_fit:       string;
  format:             string;
  hook:               string;
  content_angle:      string;
  notes:              string;
  related_arc_id:     string | null;
  related_characters: string[];
}

export interface IdeaScoreBreakdown {
  story_grounding:    number;
  content_readiness:  number;
  acquisition_clarity: number;
  reasons:            string[];
}

export interface IdeaScoringResult {
  idea_score:      number;
  score_breakdown: IdeaScoreBreakdown;
  score_reason:    string;
}

// ─── Dimension 1: Story Grounding (0–40) ─────────────────────────────────────

function scoreStoryGrounding(
  idea: IdeaForScoring,
  opportunityScore?: number,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  if (opportunityScore !== undefined) {
    let score: number;
    if (opportunityScore >= 80) {
      score = 40; reasons.push(`Linked to exceptional opportunity (score ${opportunityScore})`);
    } else if (opportunityScore >= 60) {
      score = 30; reasons.push(`Linked to strong opportunity (score ${opportunityScore})`);
    } else if (opportunityScore >= 40) {
      score = 20; reasons.push(`Linked to moderate opportunity (score ${opportunityScore})`);
    } else if (opportunityScore >= 20) {
      score = 10; reasons.push(`Linked to weak opportunity (score ${opportunityScore})`);
    } else {
      score = 5;  reasons.push(`Linked to low-scoring opportunity (score ${opportunityScore})`);
    }
    if (idea.related_arc_id) {
      score = Math.min(score + 3, 40);
      reasons.push('Story arc linked');
    }
    if (idea.related_characters.length > 0) {
      score = Math.min(score + 2, 40);
      reasons.push(`${idea.related_characters.length} character(s) referenced`);
    }
    return { score, reasons };
  }

  // No linked opportunity — score from arc/character signals alone
  let score = 0;
  if (idea.related_arc_id) {
    score = 18; reasons.push('Story arc linked without a scored opportunity');
  }
  if (idea.related_characters.length > 0) {
    score = Math.min(score + 5, 25);
    reasons.push('Named characters referenced');
  }
  if (!idea.related_arc_id && idea.related_characters.length === 0) {
    score = 5; reasons.push('No opportunity, arc, or characters linked');
  }
  return { score: Math.min(score, 40), reasons };
}

// ─── Dimension 2: Content Readiness (0–35) ───────────────────────────────────

function scoreContentReadiness(idea: IdeaForScoring): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (idea.format?.trim()) {
    score += 10; reasons.push(`Format specified: ${idea.format}`);
  }
  if (idea.platform_fit?.trim()) {
    score += 10; reasons.push(`Platform specified: ${idea.platform_fit}`);
  }
  if (idea.hook?.trim().length > 10) {
    score += 8; reasons.push('Hook written');
  }
  if ((idea.content_angle?.trim().length ?? 0) > 50) {
    score += 7; reasons.push('Content angle is detailed (>50 chars)');
  } else if ((idea.content_angle?.trim().length ?? 0) > 10) {
    score += 3; reasons.push('Content angle is brief');
  }

  return { score: Math.min(score, 35), reasons };
}

// ─── Dimension 3: Acquisition Clarity (0–25) ─────────────────────────────────

const LOCAL_SUBURBS = /\b(logan|brisbane|springfield|ipswich|beenleigh|browns\s*plains|jimboomba|capalaba|redland|bayside|southside|south\s*east\s*queensland|seq)\b/i;
const SERVICE_TERMS = /\b(cleaning|clean|window|yard|lawn|mowing|dump\s*run|rubbish|detailing|detail|laundry|ndis|support\s*worker)\b/i;
const CTA_TERMS     = /\b(book|quote|contact|call|get\s*in\s*touch|enquire|enquiry|hire|reach\s*out)\b/i;
const SOCIAL_PROOF  = /\b(review|testimonial|feedback|five[\s\-]?star|5[\s\-]?star|★{4,5}|referral)\b/i;

function scoreAcquisitionClarity(idea: IdeaForScoring): { score: number; reasons: string[] } {
  const text    = `${idea.title} ${idea.hook} ${idea.content_angle} ${idea.notes}`;
  const reasons: string[] = [];
  let score = 0;

  if (LOCAL_SUBURBS.test(text)) {
    score += 10; reasons.push('Local suburb or region mentioned');
  }
  if (SERVICE_TERMS.test(text)) {
    score += 5; reasons.push('Core service type mentioned');
  }
  if (CTA_TERMS.test(text)) {
    score += 5; reasons.push('Call-to-action language in angle');
  }
  if (SOCIAL_PROOF.test(text)) {
    score += 5; reasons.push('Social proof element referenced');
  }

  return { score: Math.min(score, 25), reasons };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function scoreIdea(
  idea: IdeaForScoring,
  opportunityScore?: number,
): IdeaScoringResult {
  const groundingResult    = scoreStoryGrounding(idea, opportunityScore);
  const readinessResult    = scoreContentReadiness(idea);
  const acquisitionResult  = scoreAcquisitionClarity(idea);

  const breakdown: IdeaScoreBreakdown = {
    story_grounding:     groundingResult.score,
    content_readiness:   readinessResult.score,
    acquisition_clarity: acquisitionResult.score,
    reasons: [
      ...groundingResult.reasons,
      ...readinessResult.reasons,
      ...acquisitionResult.reasons,
    ],
  };

  const idea_score = Math.min(
    100,
    breakdown.story_grounding + breakdown.content_readiness + breakdown.acquisition_clarity,
  );

  const score_reason = breakdown.reasons.length > 0
    ? breakdown.reasons.join('. ') + '.'
    : 'No strong content signals detected.';

  return { idea_score, score_breakdown: breakdown, score_reason };
}
