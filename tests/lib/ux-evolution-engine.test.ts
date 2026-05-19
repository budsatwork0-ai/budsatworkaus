import { describe, expect, it } from 'vitest';
import { buildUxEvolutionRecommendations } from '@/lib/bud/ux-evolution-engine';

describe('uxEvolutionEngine', () => {
  it('normalizes UX, design, and agent evolution signals into Bud recommendations', () => {
    const recommendations = buildUxEvolutionRecommendations({
      adminUxProposals: [
        {
          id: 'admin-1',
          page_path: '/dashboard/mission-control',
          severity: 'critical',
          title: 'Mission Control hierarchy is weak',
          body: 'The operator cannot tell what Bud is doing first.',
          proposed_change: { layout: 'console' },
          status: 'new',
          created_at: '2026-05-19T00:00:00.000Z',
        },
      ],
      designInsights: [
        {
          id: 'design-1',
          page_path: '/services',
          insight_type: 'layout',
          severity: 'medium',
          title: 'Quote CTA is hidden',
          body: 'Move the primary CTA into the visible workflow.',
          proposed_change: { selector: '.quote' },
          status: 'reviewing',
          created_at: '2026-05-19T00:01:00.000Z',
        },
      ],
      agentEvolutions: [
        {
          id: 'agent-1',
          target_agent_id: 'layout-critic',
          evolution_type: 'prompt_tweak',
          rationale: 'Too many generic findings.',
          proposed_diff: { after: 'be specific' },
          status: 'pending',
          created_at: '2026-05-19T00:02:00.000Z',
        },
      ],
    });

    expect(recommendations).toHaveLength(3);
    expect(recommendations[0]).toMatchObject({
      source: 'admin_ux_proposal',
      severity: 'critical',
      can_queue_approval: true,
    });
    expect(recommendations.some((item) => item.source === 'agent_evolution')).toBe(true);
  });
});
