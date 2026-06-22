import { describe, expect, it } from 'vitest';
import {
  buildLearningArtifact,
  calculateOutcomeScore,
} from '@/lib/content-feedback/engine';

describe('Content Feedback Engine', () => {
  it('scores each Batch 5 business goal against its primary business outcome', () => {
    expect(calculateOutcomeScore('Generate Leads', results({ leadsGenerated: 3 }))).toMatchObject({
      primaryMetric: 'leads generated',
      result: 'exceeded',
    });
    expect(calculateOutcomeScore('Raise Donations', results({ donationsRaisedCents: 35000 }))).toMatchObject({
      primaryMetric: 'donations generated',
      primaryValue: 35000,
      result: 'exceeded',
    });
    expect(calculateOutcomeScore('Build Trust', results({ reviewsGenerated: 1 }))).toMatchObject({
      primaryMetric: 'reviews generated',
      result: 'met',
    });
    expect(calculateOutcomeScore('Recruit Participants', results({ participantEnquiries: 1 }))).toMatchObject({
      primaryMetric: 'participant enquiries generated',
      result: 'met',
    });
    expect(calculateOutcomeScore('Promote Services', results({ quoteRequestsGenerated: 2 }))).toMatchObject({
      primaryMetric: 'quote requests generated',
      result: 'exceeded',
    });
  });

  it('creates a Learning Artifact with outcome score, evidence, future actions, and human review boundary', () => {
    const outcomeScore = calculateOutcomeScore('Raise Donations', results({ donationsRaisedCents: 35000, donorCount: 12 }));
    const artifact = buildLearningArtifact({
      context: {
        campaignTitle: 'Ride-On Mower Fundraiser',
        goal: 'Raise Donations',
        sourceArtifactIds: ['00000000-0000-4000-8000-000000000001'],
      },
      results: results({
        donationsRaisedCents: 35000,
        donorCount: 12,
        evidence: [{
          sourceTable: 'fundraising_contributions',
          sourceId: '00000000-0000-4000-8000-000000000002',
          label: 'Paid donation',
          detail: '$350 contribution recorded.',
          metric: 'donation_amount_cents',
          value: 35000,
        }],
      }),
      outcomeScore,
      whatWorked: [{
        title: 'Employment mission supported the business outcome',
        detail: 'Employment impact framing produced a donation outcome.',
        evidence: outcomeScore.reason,
        signalType: 'business_outcome',
      }],
      whatFailed: [{
        title: 'Long-form caption was not proven',
        detail: 'Future campaigns should lead with the employment outcome.',
        evidence: 'No stronger evidence for long-form copy.',
        signalType: 'weak_format',
      }],
      recommendedFutureActions: [{
        action: 'Lead with employment impact before equipment need',
        rationale: 'The campaign objective is donation behavior, not equipment awareness.',
        appliesToGoals: ['Raise Donations'],
        priority: 'high',
      }],
      confidence: {
        score: 82,
        reason: 'Direct donation evidence linked to the campaign.',
        evidenceQuality: 'strong',
      },
    });

    expect(artifact.content.artifactType).toBe('learning');
    expect(artifact.content.blocks.map((block) => block.id)).toEqual([
      'hero',
      'outcome-score',
      'results',
      'what-worked',
      'what-failed',
      'supporting-evidence',
      'future-actions',
      'confidence',
    ]);
    expect(artifact.plainText).toContain('Outcome Score');
    expect(artifact.plainText).toContain('Lead with employment impact before equipment need');
  });
});

function results(overrides: Partial<Parameters<typeof calculateOutcomeScore>[1]> = {}): Parameters<typeof calculateOutcomeScore>[1] {
  return {
    donationsRaisedCents: 0,
    donorCount: 0,
    leadsGenerated: 0,
    reviewsGenerated: 0,
    quoteRequestsGenerated: 0,
    customerConversions: 0,
    participantEnquiries: 0,
    evidence: [],
    ...overrides,
  };
}
