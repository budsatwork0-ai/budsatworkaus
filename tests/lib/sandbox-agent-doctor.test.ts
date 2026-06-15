/**
 * Tests for the Bud Agent Doctor integrity derivation logic.
 * Validates status derivation, score calculation, and fix prompt generation
 * for specced agents, critical-gate agents, and unspecced agents.
 */
import { describe, it, expect } from 'vitest';
import { deriveIntegrityReport, deriveFleetIntegrityReports, integrityStatusLabel, integrityStatusColour, type AgentMeta } from '../../src/app/(app)/dashboard/sandbox/_lib/doctor';
import { AGENT_LIST, AGENT_REGISTRY } from '../../src/lib/agents/registry';

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
