import { describe, expect, it } from 'vitest';
import { evaluateOpportunity } from '@/lib/story/opportunity-scoring';
import {
  getScoreTier,
  type OpportunitySection,
  type OpportunitySourceType,
  type StoryOpportunity,
} from '@/types/story-engine';

type OpportunityInput = {
  title: string;
  content_angle?: string;
  notes?: string;
  source_type?: OpportunitySourceType;
  section?: OpportunitySection;
  related_characters?: string[];
  suggested_format?: string;
  suggested_platform?: string;
  is_auto_detected?: boolean;
  confidence_score?: number | null;
  detection_rule?: string | null;
  detection_reason?: string | null;
};

function opportunity(input: OpportunityInput): StoryOpportunity {
  return {
    id: input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    title: input.title,
    source_type: input.source_type ?? 'manual',
    source_ref_id: null,
    related_arc_id: null,
    related_characters: input.related_characters ?? [],
    content_angle: input.content_angle ?? '',
    suggested_format: input.suggested_format ?? '',
    suggested_platform: input.suggested_platform ?? '',
    priority: 3,
    status: 'new',
    section: input.section ?? 'surfaced',
    notes: input.notes ?? '',
    is_auto_detected: input.is_auto_detected ?? false,
    detection_rule: input.detection_rule ?? null,
    detection_reason: input.detection_reason ?? null,
    confidence_score: input.confidence_score ?? null,
    source_hash: null,
    story_score: null,
    score_breakdown: null,
    score_reason: null,
    scored_at: null,
    created_at: '2026-06-05T00:00:00.000Z',
    updated_at: '2026-06-05T00:00:00.000Z',
  };
}

function rankedBenchmarks() {
  const benchmarks = [
    opportunity({
      title: 'Theme colour change',
      content_angle: 'The crew theme colour was changed in the admin interface.',
      notes: 'A configuration update for the crew app, crew portal, and crew theme.',
      suggested_format: '',
      suggested_platform: '',
    }),
    opportunity({
      title: 'First lead',
      source_type: 'milestone',
      content_angle: 'Buds At Work received its first lead from the website.',
      notes: 'The first inquiry showed the service had a real commercial signal.',
      suggested_format: 'LinkedIn post',
      suggested_platform: 'LinkedIn',
    }),
    opportunity({
      title: 'First customer',
      source_type: 'milestone',
      content_angle: 'Buds At Work booked its first customer and moved from idea to paid work.',
      notes: 'A first booking with a real client.',
      suggested_format: 'Photo post',
      suggested_platform: 'Instagram',
    }),
    opportunity({
      title: 'First recurring customer',
      source_type: 'milestone',
      content_angle: 'The first recurring customer kept booking and proved retention was possible.',
      notes: 'A loyal customer story with a clear business outcome.',
      suggested_format: 'Carousel',
      suggested_platform: 'Instagram',
    }),
    opportunity({
      title: 'First commercial contract',
      source_type: 'milestone',
      content_angle: 'Buds At Work signed its first commercial contract with a client.',
      notes: 'The first contract turned the operation into a serious business channel.',
      suggested_format: 'LinkedIn post',
      suggested_platform: 'LinkedIn',
    }),
    opportunity({
      title: 'First participant employment outcome',
      source_type: 'milestone',
      content_angle: 'An NDIS participant reached a first employment outcome and gained new independence.',
      notes: 'This was life changing work with a real livelihood outcome.',
      suggested_format: 'Short video',
      suggested_platform: 'Instagram',
      related_characters: ['Participant'],
    }),
    opportunity({
      title: 'Silvan first solo job',
      source_type: 'milestone',
      content_angle: 'Silvan completed his first solo job after weeks of training and pressure.',
      notes: 'A crew member took responsibility for a difficult job without needing rescue.',
      suggested_format: 'Reel',
      suggested_platform: 'Instagram',
      related_characters: ['Silvan'],
      section: 'tension_map',
    }),
    opportunity({
      title: 'Five-star customer review',
      content_angle: 'A customer left a five-star review after a visible result.',
      notes: 'The testimonial gave strong social proof.',
      suggested_format: 'Story',
      suggested_platform: 'Instagram',
    }),
    opportunity({
      title: 'First employee',
      source_type: 'milestone',
      content_angle: 'Buds At Work hired its first employee.',
      notes: 'The business moved from founder-only work to a real crew member.',
      suggested_format: 'Photo post',
      suggested_platform: 'LinkedIn',
    }),
    opportunity({
      title: 'First $1,000 month',
      source_type: 'milestone',
      content_angle: 'Buds At Work reached its first $1,000 month.',
      notes: 'A breakthrough revenue milestone showed the business was growing.',
      suggested_format: 'LinkedIn post',
      suggested_platform: 'LinkedIn',
    }),
  ];

  return benchmarks
    .map((opp) => {
      const result = evaluateOpportunity(opp);
      return {
        title: opp.title,
        score: result.story_score,
        tier: getScoreTier(result.story_score).label,
        breakdown: result.score_breakdown,
      };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

describe('story opportunity scoring calibration', () => {
  it('uses section placement as a supporting signal only', () => {
    const result = evaluateOpportunity(opportunity({
      title: 'Quiet operational note',
      content_angle: 'A normal update was filed for later review.',
      section: 'tension_map',
    }));

    expect(result.score_breakdown.emotional_tension).toBe(3);
    expect(result.score_breakdown.reasons).toContain('Filed in Tension Map — supporting tension signal');
  });

  it('does not score system crew terms as human impact', () => {
    for (const phrase of ['crew theme', 'crew portal', 'crew app']) {
      const result = evaluateOpportunity(opportunity({
        title: `Updated ${phrase}`,
        content_angle: `The ${phrase} was updated for internal admin consistency.`,
      }));

      expect(result.score_breakdown.human_impact).toBe(0);
    }
  });

  it('does not score detection metadata as story evidence', () => {
    const result = evaluateOpportunity(opportunity({
      title: 'Theme colour change',
      content_angle: 'The theme colour was changed.',
      detection_rule: 'first_customer_rule',
      detection_reason: 'Detected customer participant employment milestone',
    }));

    expect(result.score_breakdown.human_impact).toBe(0);
    expect(result.score_breakdown.business_significance).toBe(2);
  });

  it('recognises first lead and inquiry milestones', () => {
    for (const phrase of ['first lead', 'first inquiry', 'first enquiry']) {
      const result = evaluateOpportunity(opportunity({
        title: phrase,
        source_type: 'milestone',
      }));

      expect(result.score_breakdown.business_significance).toBe(16);
    }
  });

  it('calibrates benchmark opportunities in a human-reasonable order', () => {
    const ranked = rankedBenchmarks();
    if (process.env.PRINT_STORY_BENCHMARKS === '1') {
      console.log(JSON.stringify(ranked, null, 2));
    }

    expect(ranked.map((item) => [item.title, item.score, item.tier])).toEqual([
      ['First participant employment outcome', 67, 'Good'],
      ['First recurring customer', 66, 'Good'],
      ['Silvan first solo job', 54, 'Moderate'],
      ['Five-star customer review', 49, 'Moderate'],
      ['First commercial contract', 48, 'Moderate'],
      ['First customer', 48, 'Moderate'],
      ['First employee', 43, 'Moderate'],
      ['First $1,000 month', 40, 'Moderate'],
      ['First lead', 34, 'Weak'],
      ['Theme colour change', 5, 'Weak'],
    ]);

    expect(ranked[0].breakdown).toMatchObject({
      human_impact: 25,
      business_significance: 11,
      emotional_tension: 0,
      transformation_potential: 20,
      content_potential: 11,
    });
  });
});
