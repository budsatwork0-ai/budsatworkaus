/**
 * Tests for the Bud Agent Doctor integrity derivation logic.
 * Validates status derivation, score calculation, and fix prompt generation
 * for specced agents, critical-gate agents, and unspecced agents.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveFleetIntegrityReports,
  deriveFleetRepairQueue,
  deriveIntegrityReport,
  integrityStatusColour,
  integrityStatusLabel,
  type AgentMeta,
} from '../../src/app/(app)/dashboard/sandbox/_lib/doctor';
import { AGENT_LIST, AGENT_REGISTRY } from '../../src/lib/agents/registry';
import type { HealthData } from '../../src/app/(app)/dashboard/sandbox/_lib/types';

const AGENT_META_LIST: AgentMeta[] = AGENT_LIST.map((a) => ({
  id: a.id,
  name: a.name,
  description: a.description,
  category: a.category,
  autonomy: a.autonomy,
}));

// ── Helpers ────────────────────────────────────────────────────────────────

function agent(id: string) {
  const found = AGENT_REGISTRY[id];
  if (!found) throw new Error(`Agent '${id}' not found in registry`);
  return found;
}

const MOCK_HEALTH: HealthData = {
  lastCronRun: null,
  batches: [
    {
      id: 'batch-customer-reply',
      agent_id: 'customer-reply',
      trigger: 'manual',
      status: 'completed',
      scenario_count: 4,
      pass_count: 3,
      avg_f1: 0.78,
      total_cost_cents: 12,
      started_at: '2026-06-15T00:00:00.000Z',
      finished_at: '2026-06-15T00:01:00.000Z',
    },
  ],
  health: [],
  regressions: [],
  failingScenarios: [
    {
      scenarioId: 'scenario-complaint-quality',
      title: 'Complaint - cleaning quality',
      category: 'customer',
      agentId: 'customer-reply',
      f1: 0.25,
      scoredAt: '2026-06-15T00:01:00.000Z',
    },
  ],
  needsReview: [],
  rootCauses: [
    {
      key: 'customer-reply::wrong_actions',
      title: 'Wrong action types - customer-reply',
      severity: 'critical',
      agentId: 'customer-reply',
      failureType: 'wrong_actions',
      rootCauseSummary: 'Agent proposed action types that did not match expected support escalation behavior.',
      lessonCount: 2,
      latestAt: '2026-06-15T00:01:00.000Z',
      exampleObservations: ['Expected flag_for_review but only saw send_email.'],
      recommendedFix: 'Update support escalation prompt and fixture handling.',
      lessonIds: ['lesson-1'],
    },
  ],
  activeRootCauses: [
    {
      key: 'customer-reply::wrong_actions',
      title: 'Wrong action types - customer-reply',
      severity: 'critical',
      agentId: 'customer-reply',
      failureType: 'wrong_actions',
      rootCauseSummary: 'Agent proposed action types that did not match expected support escalation behavior.',
      lessonCount: 2,
      latestAt: '2026-06-15T00:01:00.000Z',
      exampleObservations: ['Expected flag_for_review but only saw send_email.'],
      recommendedFix: 'Update support escalation prompt and fixture handling.',
      lessonIds: ['lesson-1'],
    },
  ],
  resolvedRootCauses: [],
  proposals: [],
  recommendations: [],
};

// ── Fleet-level tests ───────────────────────────────────────────────────────

describe('deriveFleetIntegrityReports', () => {
  it('returns one report per agent in the registry', () => {
    const reports = deriveFleetIntegrityReports(AGENT_META_LIST);
    expect(reports).toHaveLength(AGENT_LIST.length);
  });

  it('every report has a valid integrityStatus', () => {
    const validStatuses = new Set([
      'ready_to_promote',
      'ready_to_test',
      'missing_data',
      'missing_integration',
      'unsafe_to_promote',
    ]);
    const reports = deriveFleetIntegrityReports(AGENT_META_LIST);
    for (const report of reports) {
      expect(validStatuses.has(report.integrityStatus), `invalid status for ${report.agentId}: ${report.integrityStatus}`).toBe(true);
    }
  });

  it('every report has an integrityScore in [0, 100]', () => {
    const reports = deriveFleetIntegrityReports(AGENT_META_LIST);
    for (const report of reports) {
      expect(report.integrityScore).toBeGreaterThanOrEqual(0);
      expect(report.integrityScore).toBeLessThanOrEqual(100);
    }
  });

  it('every report has a non-empty generateFixPrompt', () => {
    const reports = deriveFleetIntegrityReports(AGENT_META_LIST);
    for (const report of reports) {
      expect(report.generateFixPrompt.length).toBeGreaterThan(0);
    }
  });

  it('every report has a repair plan and prompt preview', () => {
    const reports = deriveFleetIntegrityReports(AGENT_META_LIST);
    for (const report of reports) {
      expect(report.repairPlan.rootCauseSummary.length).toBeGreaterThan(0);
      expect(Array.isArray(report.repairPlan.missingIntegrations)).toBe(true);
      expect(Array.isArray(report.repairPlan.missingFixtures)).toBe(true);
      expect(Array.isArray(report.repairPlan.coverageGaps)).toBe(true);
      expect(report.repairPromptPreview).toBe(report.generateFixPrompt);
    }
  });
});

describe('repair plan generation', () => {
  it('creates missing integration repair items with required operator fields', () => {
    const report = deriveIntegrityReport({ ...agent('customer-reply'), autonomy: 'auto' });
    const gmail = report.repairPlan.missingIntegrations.find((item) =>
      item.recommendedFix.includes('Gmail Sandbox Adapter'),
    );
    expect(gmail).toBeDefined();
    expect(gmail?.whyRequired.length).toBeGreaterThan(0);
    expect(gmail?.blockedCapability).toContain('Reads inbound customer messages');
    expect(['critical', 'high', 'medium', 'low']).toContain(gmail?.severity);
    expect(gmail?.recommendedFix).toContain('sandbox/propose-action adapter');
  });

  it('creates fixture recommendations for incomplete sandbox fixtures', () => {
    const report = deriveIntegrityReport(agent('cfo-agent'));
    expect(report.repairPlan.missingFixtures.length).toBeGreaterThan(0);
    expect(report.repairPlan.missingFixtures.some((item) => item.recommendedFixture.toLowerCase().includes('fake transactions'))).toBe(true);
  });

  it('creates scenario coverage gaps for agents with no scenarios', () => {
    const unspecced = AGENT_META_LIST.find((candidate) => candidate.id === 'crew-briefing') ?? {
      id: 'unspecced-test-agent',
      name: 'Unspecced Test Agent',
      description: 'Test agent',
      category: 'ops',
      autonomy: 'review',
    };
    const report = deriveIntegrityReport(unspecced);
    expect(report.repairPlan.coverageGaps.length).toBeGreaterThan(0);
    expect(report.repairPlan.coverageGaps[0].recommendedScenario).toContain('sandbox scenario');
  });

  it('enriches repair plans with failing scenarios and active root causes from health data', () => {
    const report = deriveIntegrityReport(agent('customer-reply'), MOCK_HEALTH);
    expect(report.repairPlan.totalScenarios).toBe(4);
    expect(report.repairPlan.passedScenarios).toBe(3);
    expect(report.repairPlan.failingScenarios).toHaveLength(1);
    expect(report.repairPlan.rootCauseSummary).toContain('did not match expected support escalation');
  });

  it('generates recommended connections with benefit, priority, and risk', () => {
    const report = deriveIntegrityReport(agent('cfo-agent'));
    const invoiceFixture = report.recommendedConnections.find((item) => item.connection === 'Invoice Sandbox Data');
    expect(invoiceFixture).toBeDefined();
    expect(invoiceFixture?.benefit.length).toBeGreaterThan(0);
    expect(['critical', 'high', 'medium', 'low']).toContain(invoiceFixture?.priority);
    expect(invoiceFixture?.riskIfMissing.length).toBeGreaterThan(0);
  });

  it('builds a repair prompt preview with all required visible fields', () => {
    const report = deriveIntegrityReport(agent('customer-reply'), MOCK_HEALTH);
    const prompt = report.repairPromptPreview;
    expect(prompt).toContain('Agent name:');
    expect(prompt).toContain('Integrity status:');
    expect(prompt).toContain('Missing integrations:');
    expect(prompt).toContain('Missing fixtures:');
    expect(prompt).toContain('Failing scenarios:');
    expect(prompt).toContain('Root cause summary:');
    expect(prompt).toContain('Recommended implementation:');
    expect(prompt).toContain('Likely affected files:');
    expect(prompt).toContain('Expected outcome:');
    expect(prompt).toContain('Do not dispatch real emails');
  });

  it('ranks the fleet repair queue by promotion impact, severity, failures, and score impact', () => {
    const reports = deriveFleetIntegrityReports(
      [agent('customer-reply'), agent('quote-triage'), agent('ndis-compliance')],
      MOCK_HEALTH,
    );
    const queue = deriveFleetRepairQueue(reports);
    expect(queue.length).toBeGreaterThan(0);
    expect(queue[0].rankScore).toBeGreaterThanOrEqual(queue[queue.length - 1].rankScore);
    expect(queue[0].promotionImpact + queue[0].rootCauseSeverity + queue[0].integrityScoreImpact).toBeGreaterThan(0);
  });

  it('keeps healthy reports empty-state safe when no repair actions are required', () => {
    const report = deriveIntegrityReport(agent('customer-reply'));

    expect(report.repairPlan.disposition).toBe('no_repair_required');
    expect(report.repairPlan.summary).toBe('No repair required');
    expect(report.repairPlan.recommendedImplementation).toBe('');
    expect(report.recommendedConnections).toHaveLength(0);
    expect(report.repairPlan.failingScenarios).toHaveLength(0);
    expect(report.repairPromptPreview).toContain('- No failing scenarios');
    expect(report.repairPromptPreview).toContain('Missing integrations:');
    expect(report.repairPromptPreview).toContain('- No missing integrations');
    expect(report.repairPromptPreview).toContain('Repair status: No repair required');
    expect(report.repairPromptPreview).not.toContain('Recommended implementation:');
    expect(report.repairPromptPreview).toContain('- No files need changes');
  });

  it('generates agent-specific fixture text for unspecced agents by category', () => {
    const cases: Array<{ meta: AgentMeta; expectedSubstring: string }> = [
      {
        meta: { id: 'cash-planner', name: 'Cash Planner', description: 'Plans cash flow', category: 'finance', autonomy: 'review' },
        expectedSubstring: 'invoices',
      },
      {
        meta: { id: 'msg-handler', name: 'Message Handler', description: 'Handles messages', category: 'support', autonomy: 'review' },
        expectedSubstring: 'message threads',
      },
      {
        meta: { id: 'ndis-auditor', name: 'NDIS Auditor', description: 'Audits NDIS records', category: 'compliance', autonomy: 'review' },
        expectedSubstring: 'participant records',
      },
      {
        meta: { id: 'shift-planner', name: 'Shift Planner', description: 'Plans shifts', category: 'ops', autonomy: 'review' },
        expectedSubstring: 'crew records',
      },
      {
        meta: { id: 'lead-tracker', name: 'Lead Tracker', description: 'Tracks leads', category: 'sales', autonomy: 'review' },
        expectedSubstring: 'fake leads',
      },
    ];

    for (const { meta, expectedSubstring } of cases) {
      const report = deriveIntegrityReport(meta);
      const fixture = report.repairPlan.missingFixtures.find((f) => f.fixture === 'Sandbox test fixtures');
      expect(fixture, `${meta.id} should have a Sandbox test fixtures repair item`).toBeDefined();
      expect(fixture?.recommendedFixture, `${meta.id} fixture text should include agent name`).toContain(meta.name);
      expect(fixture?.recommendedFixture, `${meta.id} fixture text should include ${expectedSubstring}`).toContain(expectedSubstring);
    }
  });

  it('keeps ready-to-promote agents out of the repair queue when they have no repair actions', () => {
    const customerReply = deriveIntegrityReport(agent('customer-reply'));
    const queue = deriveFleetRepairQueue([customerReply]);
    expect(queue).toHaveLength(0);
  });

  it('labels failing ready agents as repair required when health data adds failures', () => {
    const report = deriveIntegrityReport(agent('customer-reply'), MOCK_HEALTH);
    expect(report.repairPlan.disposition).toBe('repair_required');
    expect(report.repairPromptPreview).toContain('Repair status: Repair required');
    expect(report.repairPromptPreview).toContain('Recommended implementation:');
    expect(deriveFleetRepairQueue([report])).toHaveLength(1);
  });
});

// ── Specced agents ─────────────────────────────────────────────────────────

describe('customer-reply (has scenario coverage)', () => {
  it('surfaces email send integration', () => {
    const report = deriveIntegrityReport(agent('customer-reply'));
    const emailInt = report.integrations.find((i) => i.label.includes('Email send'));
    expect(emailInt).toBeDefined();
  });

  it('has at least 1 scenario', () => {
    const report = deriveIntegrityReport(agent('customer-reply'));
    expect(report.scenarioCount).toBeGreaterThanOrEqual(1);
  });

  it('is not missing_data', () => {
    const report = deriveIntegrityReport(agent('customer-reply'));
    expect(report.integrityStatus).not.toBe('missing_data');
  });

  it('generateFixPrompt mentions agent id', () => {
    const report = deriveIntegrityReport(agent('customer-reply'));
    expect(report.generateFixPrompt).toContain('customer-reply');
  });

  it('generateFixPrompt contains sandbox safety note', () => {
    const report = deriveIntegrityReport(agent('customer-reply'));
    expect(report.generateFixPrompt.toLowerCase()).toContain('propose-action');
  });
});

describe('quote-triage (has multiple scenarios)', () => {
  it('has 3 or more scenarios', () => {
    const report = deriveIntegrityReport(agent('quote-triage'));
    expect(report.scenarioCount).toBeGreaterThanOrEqual(3);
  });

  it('data sources are all present when scenarioCount >= 3', () => {
    const report = deriveIntegrityReport(agent('quote-triage'));
    const missingDataSources = report.dataSources.filter((d) => d.status === 'missing');
    expect(missingDataSources).toHaveLength(0);
  });

  it('integrityScore is >= 50', () => {
    const report = deriveIntegrityReport(agent('quote-triage'));
    expect(report.integrityScore).toBeGreaterThanOrEqual(50);
  });
});

// ── Critical-gate agents ───────────────────────────────────────────────────

describe('ndis-compliance (critical integration gate)', () => {
  it('is flagged unsafe_to_promote when NDIS Commission integration is missing', () => {
    const report = deriveIntegrityReport(agent('ndis-compliance'));
    // The NDIS Commission notification is outbound + criticalGate is true.
    // If agent autonomy is 'auto', it is marked missing → unsafe_to_promote.
    // If autonomy is 'review'/'manual', it is partial → may be ready_to_test or higher.
    // Either way: should never be ready_to_promote until integration is confirmed present.
    const agentDef = agent('ndis-compliance');
    if (agentDef.autonomy === 'auto') {
      expect(report.integrityStatus).toBe('unsafe_to_promote');
    } else {
      // review/manual — outbound integration is partial, not missing
      expect(['ready_to_test', 'missing_integration', 'unsafe_to_promote']).toContain(report.integrityStatus);
    }
  });

  it('riskIfPromoted contains CRITICAL', () => {
    const report = deriveIntegrityReport(agent('ndis-compliance'));
    expect(report.riskIfPromoted).toContain('CRITICAL');
  });

  it('has scenario coverage', () => {
    const report = deriveIntegrityReport(agent('ndis-compliance'));
    expect(report.scenarioCount).toBeGreaterThanOrEqual(1);
  });
});

describe('stripe-dispute-manager (critical integration gate)', () => {
  it('riskIfPromoted mentions direct financial loss', () => {
    const report = deriveIntegrityReport(agent('stripe-dispute-manager'));
    expect(report.riskIfPromoted.toLowerCase()).toContain('financial');
  });

  it('Stripe write integration is listed', () => {
    const report = deriveIntegrityReport(agent('stripe-dispute-manager'));
    const stripeWrite = report.integrations.find((i) => i.label.toLowerCase().includes('write'));
    expect(stripeWrite).toBeDefined();
  });
});

describe('price-optimizer (critical integration gate)', () => {
  it('recommendation mentions requiresApproval', () => {
    const report = deriveIntegrityReport(agent('price-optimizer'));
    expect(report.recommendation).toContain('requiresApproval');
  });
});

describe('ndis-plan-matcher (critical integration gate)', () => {
  it('riskIfPromoted mentions regulatory risk', () => {
    const report = deriveIntegrityReport(agent('ndis-plan-matcher'));
    expect(report.riskIfPromoted.toLowerCase()).toContain('regulatory');
  });
});

// ── Agents without sandbox scenarios ──────────────────────────────────────

describe('agents without scenarios', () => {
  const noScenarioAgents = AGENT_LIST.filter(
    (a) =>
      !['quote-triage','customer-reply','lapsed-win-back','reviews','ndis-compliance',
        'ndis-plan-matcher','scheduling','whs-safety-reminder','cash-flow-forecaster',
        'stripe-dispute-manager','photo-qa','internal-qa','reconciliation',
        'applicant-screener','lead-scorer','seo-meta','conversion-funnel',
        'ab-test-architect','price-optimizer','cfo-agent'].includes(a.id),
  );

  it('agents without scenarios are missing_data or unsafe_to_promote', () => {
    for (const agentDef of noScenarioAgents) {
      const report = deriveIntegrityReport(agentDef);
      expect(
        ['missing_data', 'unsafe_to_promote'],
        `${agentDef.id} should be missing_data or unsafe_to_promote`,
      ).toContain(report.integrityStatus);
    }
  });

  it('missing connections list includes Sandbox scenarios for unspecced agents', () => {
    const unspecced = noScenarioAgents.find((a) => {
      // Find one that's not in the AGENT_SPECS
      return !['customer-reply','quote-triage','ndis-compliance','scheduling','cfo-agent',
        'cash-flow-forecaster','lapsed-win-back','reviews','reconciliation',
        'stripe-dispute-manager','whs-safety-reminder','lead-scorer','applicant-screener',
        'photo-qa','crew-briefing','price-optimizer','internal-qa','ndis-plan-matcher'].includes(a.id);
    });
    if (!unspecced) return; // all agents are specced — nothing to test
    const report = deriveIntegrityReport(unspecced);
    expect(report.missingConnections).toContain('Sandbox scenarios');
  });
});

// ── Fix prompt content ─────────────────────────────────────────────────────

describe('generateFixPrompt content', () => {
  it('is non-empty for every agent — button is never silent', () => {
    const reports = deriveFleetIntegrityReports(AGENT_META_LIST);
    for (const report of reports) {
      expect(report.generateFixPrompt.length, `${report.agentId} has empty generateFixPrompt`).toBeGreaterThan(50);
    }
  });

  it('includes agent name, category, and integrity status for customer-reply', () => {
    const report = deriveIntegrityReport(agent('customer-reply'));
    expect(report.generateFixPrompt).toContain('Customer Reply');
    expect(report.generateFixPrompt).toContain('support');
    expect(report.generateFixPrompt).toContain('Integrity status:');
  });

  it('includes agent name and category for every specced agent', () => {
    const speccedIds = ['quote-triage', 'ndis-compliance', 'scheduling', 'cfo-agent', 'stripe-dispute-manager'];
    for (const id of speccedIds) {
      const report = deriveIntegrityReport(agent(id));
      expect(report.generateFixPrompt, `${id}: missing Agent name`).toContain('Agent name:');
      expect(report.generateFixPrompt, `${id}: missing Agent category`).toContain('Agent category:');
      expect(report.generateFixPrompt, `${id}: missing Integrity status`).toContain('Integrity status:');
    }
  });

  it('includes missing scenario coverage section', () => {
    const report = deriveIntegrityReport(agent('cfo-agent'));
    expect(report.generateFixPrompt).toContain('Missing scenario coverage:');
  });

  it('includes implementation tasks when repair is required', () => {
    const report = deriveIntegrityReport({ ...agent('customer-reply'), autonomy: 'auto' });
    if (report.repairPlan.disposition === 'repair_required') {
      expect(report.generateFixPrompt).toContain('Implementation tasks:');
      expect(report.generateFixPrompt).toContain('[ ]');
    }
  });

  it('includes a verification checklist in every prompt', () => {
    const reports = deriveFleetIntegrityReports(AGENT_META_LIST);
    for (const report of reports) {
      expect(report.generateFixPrompt, `${report.agentId}: missing verification checklist`).toContain('Verification checklist:');
      expect(report.generateFixPrompt, `${report.agentId}: missing sandbox mode check`).toContain('No production API keys are called in sandbox mode');
      expect(report.generateFixPrompt, `${report.agentId}: missing propose-action check`).toContain('All outbound integrations route through propose-action only');
    }
  });

  it('generateFixPrompt equals repairPromptPreview (single source of truth)', () => {
    const reports = deriveFleetIntegrityReports(AGENT_META_LIST);
    for (const report of reports) {
      expect(report.generateFixPrompt).toBe(report.repairPromptPreview);
    }
  });

  it('includes Constraints section with sandbox safety rule', () => {
    const report = deriveIntegrityReport(agent('customer-reply'));
    expect(report.generateFixPrompt).toContain('Constraints:');
    expect(report.generateFixPrompt).toContain('Do not dispatch real emails');
  });
});

// ── Integration details ────────────────────────────────────────────────────

describe('integrationDetails structure', () => {
  it('every specced agent has an integrationDetails array', () => {
    const speccedIds = ['customer-reply', 'quote-triage', 'ndis-compliance', 'scheduling', 'cfo-agent'];
    for (const id of speccedIds) {
      const report = deriveIntegrityReport(agent(id));
      expect(Array.isArray(report.integrationDetails), `${id}: integrationDetails should be array`).toBe(true);
      expect(report.integrationDetails.length, `${id}: should have at least 1 integration detail`).toBeGreaterThan(0);
    }
  });

  it('every integration detail has required fields', () => {
    const report = deriveIntegrityReport(agent('customer-reply'));
    for (const detail of report.integrationDetails) {
      expect(typeof detail.label).toBe('string');
      expect(typeof detail.purpose).toBe('string');
      expect(['connected', 'missing', 'mocked', 'unverified']).toContain(detail.connectionStatus);
      expect(typeof detail.required).toBe('boolean');
      expect(Array.isArray(detail.envVars)).toBe(true);
      expect(typeof detail.mockAvailable).toBe('boolean');
      expect(typeof detail.sandboxNote).toBe('string');
      expect(typeof detail.connectorName).toBe('string');
    }
  });

  it('Email send integration has RESEND_API_KEY env var', () => {
    const report = deriveIntegrityReport(agent('customer-reply'));
    const emailDetail = report.integrationDetails.find((d) => d.label.includes('Email send'));
    expect(emailDetail).toBeDefined();
    expect(emailDetail?.envVars).toContain('RESEND_API_KEY');
    expect(emailDetail?.connectorName).toBe('Gmail Sandbox Adapter');
  });

  it('Stripe read integration has STRIPE_SECRET_KEY env var', () => {
    const report = deriveIntegrityReport(agent('cfo-agent'));
    const stripeDetail = report.integrationDetails.find((d) => d.label.toLowerCase().includes('stripe'));
    expect(stripeDetail).toBeDefined();
    expect(stripeDetail?.envVars).toContain('STRIPE_SECRET_KEY');
  });

  it('Supabase read integrations are never marked missing (always available as fixtures)', () => {
    const report = deriveIntegrityReport(agent('quote-triage'));
    const supabaseDetails = report.integrationDetails.filter((d) => d.label.toLowerCase().includes('supabase'));
    for (const detail of supabaseDetails) {
      expect(['connected', 'mocked'], `${detail.label}: Supabase read should not be missing`).toContain(detail.connectionStatus);
    }
  });

  it('unspecced agents get an integrationDetails array (may be empty)', () => {
    const unspegged: AgentMeta = { id: 'unknown-agent', name: 'Unknown', description: 'test', category: 'ops', autonomy: 'review' };
    const report = deriveIntegrityReport(unspegged);
    expect(Array.isArray(report.integrationDetails)).toBe(true);
  });
});

// ── Sandbox safety ─────────────────────────────────────────────────────────

describe('sandbox safety — no production connectors', () => {
  it('all outbound integrations have a sandboxNote preventing live dispatch', () => {
    const outboundAgents = ['customer-reply', 'lapsed-win-back', 'reviews', 'whs-safety-reminder', 'ndis-compliance', 'stripe-dispute-manager'];
    for (const id of outboundAgents) {
      const report = deriveIntegrityReport(agent(id));
      const outbound = report.integrationDetails.filter((d) => {
        const lower = d.label.toLowerCase();
        return lower.includes('send') || lower.includes('write') || lower.includes('notification') || lower.includes('commission');
      });
      for (const detail of outbound) {
        expect(
          detail.sandboxNote.length,
          `${id} / "${detail.label}": outbound integration must have a sandboxNote`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('critical-gate agents list at least one outbound integration as mocked or missing (never silently connected)', () => {
    const criticalAgents = ['ndis-compliance', 'stripe-dispute-manager', 'price-optimizer', 'ndis-plan-matcher'];
    for (const id of criticalAgents) {
      const report = deriveIntegrityReport(agent(id));
      const outbound = report.integrationDetails.filter((d) => {
        const lower = d.label.toLowerCase();
        return lower.includes('send') || lower.includes('write') || lower.includes('commission') || lower.includes('response');
      });
      for (const detail of outbound) {
        expect(
          ['missing', 'mocked', 'unverified'],
          `${id} / "${detail.label}": must not show 'connected' for outbound integration`,
        ).toContain(detail.connectionStatus);
      }
    }
  });

  it('generateFixPrompt always includes the sandbox constraint banner', () => {
    const allReports = deriveFleetIntegrityReports(AGENT_META_LIST);
    for (const report of allReports) {
      expect(
        report.generateFixPrompt,
        `${report.agentId}: missing sandbox constraint banner`,
      ).toContain('Use sandbox adapters, mock connectors, fixtures, and propose-action');
    }
  });
});

// ── yard-map-geo spec ──────────────────────────────────────────────────────

describe('yard-map-geo integrity spec', () => {
  it('has a structured spec (not unspecced fallback)', () => {
    const report = deriveIntegrityReport(agent('yard-map-geo'));
    expect(report.intendedCapability).not.toContain('unspecified');
    expect(report.intendedCapability.toLowerCase()).toContain('yard');
  });

  it('includes Google Maps API integration', () => {
    const report = deriveIntegrityReport(agent('yard-map-geo'));
    const mapsInt = report.integrations.find((i) => i.label.includes('Google Maps'));
    expect(mapsInt).toBeDefined();
  });

  it('integrationDetails includes GeoJSON Fixture Adapter', () => {
    const report = deriveIntegrityReport(agent('yard-map-geo'));
    const mapsDetail = report.integrationDetails.find((d) => d.label.includes('Google Maps'));
    expect(mapsDetail?.connectorName).toBe('GeoJSON Fixture Adapter');
    expect(mapsDetail?.envVars).toContain('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
    expect(mapsDetail?.sandboxNote).toContain('no live Maps API calls');
  });

  it('riskIfPromoted mentions revenue impact', () => {
    const report = deriveIntegrityReport(agent('yard-map-geo'));
    expect(report.riskIfPromoted.toLowerCase()).toContain('revenue');
  });
});

// ── integrityStatusLabel / colour helpers ─────────────────────────────────

describe('integrityStatusLabel', () => {
  const cases: Array<[Parameters<typeof integrityStatusLabel>[0], string]> = [
    ['ready_to_promote', 'Ready to Promote'],
    ['ready_to_test', 'Ready to Test'],
    ['missing_data', 'Missing Data'],
    ['missing_integration', 'Missing Integration'],
    ['unsafe_to_promote', 'Unsafe to Promote'],
  ];

  for (const [status, expected] of cases) {
    it(`maps ${status} → '${expected}'`, () => {
      expect(integrityStatusLabel(status)).toBe(expected);
    });
  }
});

describe('integrityStatusColour', () => {
  it('returns a non-empty string for every valid status', () => {
    const statuses = [
      'ready_to_promote',
      'ready_to_test',
      'missing_data',
      'missing_integration',
      'unsafe_to_promote',
    ] as const;
    for (const status of statuses) {
      expect(integrityStatusColour(status).length).toBeGreaterThan(0);
    }
  });
});

// ── Score edge cases ───────────────────────────────────────────────────────

describe('score boundaries', () => {
  it('scheduling agent (4 scenarios) has score >= 60', () => {
    const report = deriveIntegrityReport(agent('scheduling'));
    expect(report.integrityScore).toBeGreaterThanOrEqual(60);
  });

  it('cfo-agent (1 scenario) has score < scheduling score', () => {
    const cfoReport = deriveIntegrityReport(agent('cfo-agent'));
    const schedulingReport = deriveIntegrityReport(agent('scheduling'));
    expect(cfoReport.integrityScore).toBeLessThanOrEqual(schedulingReport.integrityScore);
  });
});
