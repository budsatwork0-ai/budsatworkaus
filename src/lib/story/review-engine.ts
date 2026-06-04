// Phase 2G: Story Safety Review Engine
// Deterministic, rule-based. No LLM calls. No external requests. Pure TypeScript.

import type { StoryDraft } from '@/types/story-engine';
import type {
  ReviewFinding,
  ReviewFindingCategory,
  ReviewFindingSeverity,
  ReviewRecommendation,
  ReviewResult,
} from '@/types/story-review';

// ─── Score deductions ─────────────────────────────────────────────────────────

const DEDUCTIONS: Record<ReviewFindingSeverity, number> = {
  blocker: 25,
  warning: 10,
  info:     3,
};

function finding(
  category: ReviewFindingCategory,
  severity: ReviewFindingSeverity,
  message: string,
): ReviewFinding {
  return { category, severity, message };
}

// ─── Privacy checks ───────────────────────────────────────────────────────────

function checkPrivacy(draft: StoryDraft): ReviewFinding[] {
  const results: ReviewFinding[] = [];
  const texts = [draft.hook, draft.body, draft.close].filter(Boolean);
  const combined = texts.join(' ');

  // Capitalised First Last name patterns
  const namePattern = /\b[A-Z][a-z]{1,20}\s+[A-Z][a-z]{1,20}\b/g;
  if (namePattern.test(combined)) {
    results.push(finding('privacy', 'warning',
      'Possible full name detected in draft content. Confirm this person has consented to being named.'));
  }

  // Australian phone numbers
  const phonePattern = /(\+61|0)[0-9\s\-().]{8,14}[0-9]|\(0[0-9]\)\s?[0-9]{4}\s?[0-9]{4}|04[0-9]{2}\s?[0-9]{3}\s?[0-9]{3}/;
  if (phonePattern.test(combined)) {
    results.push(finding('privacy', 'blocker',
      'Phone number pattern detected. Remove all phone numbers before publishing.'));
  }

  // Email addresses
  const emailPattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
  if (emailPattern.test(combined)) {
    results.push(finding('privacy', 'blocker',
      'Email address detected. Remove all email addresses before publishing.'));
  }

  // Street address patterns (e.g. "12 Smith Street")
  const addressPattern = /\b\d{1,4}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl|Crescent|Cres|Lane|Ln|Boulevard|Blvd)\b/i;
  if (addressPattern.test(combined)) {
    results.push(finding('privacy', 'blocker',
      'Street address pattern detected. Remove specific addresses before publishing.'));
  }

  // Customer/client attribution with quoted text
  const attributionPattern = /\b(?:customer|client)\b.{0,40}(?:said|told|mentioned|wrote|asked|explained)/i;
  if (attributionPattern.test(combined)) {
    results.push(finding('privacy', 'warning',
      'Content attributes a quote or statement to a customer/client. Confirm consent before publishing.'));
  }

  return results;
}

// ─── Brand alignment checks ───────────────────────────────────────────────────

function checkBrand(draft: StoryDraft): ReviewFinding[] {
  const results: ReviewFinding[] = [];
  const combined = [draft.hook, draft.body, draft.close].join(' ');

  if (!draft.platform || draft.platform.trim() === '') {
    results.push(finding('brand', 'warning', 'Platform is not set. Assign a target platform before publishing.'));
  }

  if (!draft.format || draft.format.trim() === '') {
    results.push(finding('brand', 'warning', 'Format is not set. Assign a content format before publishing.'));
  }

  if (!draft.hook || draft.hook.trim().length < 10) {
    results.push(finding('brand', 'blocker', 'Hook is missing or too short (< 10 characters). A strong hook is required.'));
  }

  if (!draft.body || draft.body.trim().length < 20) {
    results.push(finding('brand', 'blocker', 'Body content is missing or too short (< 20 characters).'));
  }

  if (!draft.close || draft.close.trim() === '') {
    results.push(finding('brand', 'warning', 'Close/CTA is empty. Consider adding a call to action.'));
  }

  // Competitor disparagement
  const disparagementPattern = /\b(?:unlike|better than|worse than|compared to|instead of)\s+[A-Z][a-zA-Z\s&]{2,30}(?:cleaning|services|maid|home|yard|lawn)/i;
  if (disparagementPattern.test(combined)) {
    results.push(finding('brand', 'blocker',
      'Possible competitor disparagement detected. Buds At Work does not publish comparative claims.'));
  }

  return results;
}

// ─── Factual grounding checks ─────────────────────────────────────────────────

function checkFactual(draft: StoryDraft): ReviewFinding[] {
  const results: ReviewFinding[] = [];
  const combined = [draft.hook, draft.body, draft.close].join(' ');

  if (!draft.prompt_context || draft.prompt_context.trim() === '') {
    results.push(finding('factual', 'blocker',
      'No source context was recorded for this draft. Cannot verify factual grounding.'));
  }

  // Fabricated milestone / absolute claims
  const absolutePattern = /\b(?:first ever|100%\s+success|always deliver|never failed|zero complaints|perfect record)\b/i;
  if (absolutePattern.test(combined)) {
    results.push(finding('factual', 'warning',
      'Absolute claim detected ("first ever", "100% success", etc.). Confirm this is verifiable.'));
  }

  // Fabricated quote: name-like pattern followed by colon with short prompt context
  const quotePattern = /[A-Z][a-z]+(?: [A-Z][a-z]+)?:\s*[""'"]/;
  const contextTooShort = !draft.prompt_context || draft.prompt_context.trim().length < 50;
  if (quotePattern.test(combined) && contextTooShort) {
    results.push(finding('factual', 'warning',
      'Attributed quote detected but source context is very short. Verify the quote is real.'));
  }

  // AI-generated with no model recorded
  if (draft.is_ai_generated && (!draft.generation_model || draft.generation_model.trim() === '')) {
    results.push(finding('factual', 'info',
      'Draft is marked AI-generated but no generation model was recorded.'));
  }

  return results;
}

// ─── Consent checks ───────────────────────────────────────────────────────────

function checkConsent(draft: StoryDraft): ReviewFinding[] {
  const results: ReviewFinding[] = [];

  if (draft.is_ai_generated && (!draft.generation_model || draft.generation_model.trim() === '')) {
    results.push(finding('consent', 'warning',
      'Draft is marked AI-generated but generation model is not recorded. Update before publishing.'));
  }

  if (!draft.hashtags || draft.hashtags.length === 0) {
    results.push(finding('consent', 'info',
      'No hashtags set. Consider adding hashtags to improve discoverability.'));
  }

  return results;
}

// ─── Score + recommendation ───────────────────────────────────────────────────

function scoreFindings(findings: ReviewFinding[]): number {
  const deduction = findings.reduce((acc, f) => acc + DEDUCTIONS[f.severity], 0);
  return Math.max(0, 100 - deduction);
}

function recommend(findings: ReviewFinding[], score: number): ReviewRecommendation {
  const hasBlocker = findings.some((f) => f.severity === 'blocker');
  if (hasBlocker) return 'reject';
  if (score >= 80) return 'approve';
  return 'changes_required';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function evaluateDraft(draft: StoryDraft): ReviewResult {
  const privacyFindings  = checkPrivacy(draft);
  const brandFindings    = checkBrand(draft);
  const factualFindings  = checkFactual(draft);
  const consentFindings  = checkConsent(draft);

  const findings: ReviewFinding[] = [
    ...privacyFindings,
    ...brandFindings,
    ...factualFindings,
    ...consentFindings,
  ];

  const safety_score = scoreFindings(findings);
  const recommendation = recommend(findings, safety_score);

  const hasBlockerInCategory = (cat: ReviewFindingCategory) =>
    findings.some((f) => f.category === cat && f.severity === 'blocker');

  return {
    findings,
    safety_score,
    recommendation,
    privacy_checked:          !hasBlockerInCategory('privacy'),
    consent_verified:         !hasBlockerInCategory('consent'),
    factual_accuracy_checked: !hasBlockerInCategory('factual'),
    brand_alignment_checked:  !hasBlockerInCategory('brand'),
  };
}
