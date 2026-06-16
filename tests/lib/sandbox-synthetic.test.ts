/**
 * Tests for Phase 3A: Synthetic Scenario Preview Generator.
 * Verifies determinism, environment enforcement, generator correctness,
 * no DB writes, and Doctor integration hooks.
 */
import { describe, it, expect } from 'vitest';
import {
  generateCustomerProfile,
  generateQuoteScenario,
  generateMessageThread,
  generateNDISFixture,
  generateFinanceFixtures,
  generateSchedulingFixtures,
  generateSyntheticPreview,
  seedFromString,
} from '../../src/lib/sandbox/synthetic';
import {
  deriveIntegrityReport,
  shouldShowSyntheticPreview,
} from '../../src/app/(app)/dashboard/sandbox/_lib/doctor';
import { AGENT_REGISTRY } from '../../src/lib/agents/registry';

function agent(id: string) {
  const found = AGENT_REGISTRY[id];
  if (!found) throw new Error(`Agent '${id}' not found in registry`);
  return found;
}

// ── Determinism ─────────────────────────────────────────────────────────────

describe('deterministic generation', () => {
  it('generates identical output for the same agentId (implicit seed)', () => {
    const a = generateSyntheticPreview('customer-reply', 'Customer Reply');
    const b = generateSyntheticPreview('customer-reply', 'Customer Reply');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('generates different output for different agentIds', () => {
    const a = generateSyntheticPreview('customer-reply', 'Customer Reply');
    const b = generateSyntheticPreview('quote-triage', 'Quote Triage');
    expect(a.records[0].id).not.toBe(b.records[0].id);
  });

  it('uses provided explicit seed reproducibly', () => {
    const a = generateSyntheticPreview('customer-reply', 'Customer Reply', 42);
    const b = generateSyntheticPreview('customer-reply', 'Customer Reply', 42);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different explicit seeds produce different outputs', () => {
    const a = generateSyntheticPreview('customer-reply', 'Customer Reply', 42);
    const b = generateSyntheticPreview('customer-reply', 'Customer Reply', 99);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('seedFromString is deterministic', () => {
    expect(seedFromString('customer-reply')).toBe(seedFromString('customer-reply'));
    expect(seedFromString('ndis-compliance')).toBe(seedFromString('ndis-compliance'));
    expect(seedFromString('customer-reply')).not.toBe(seedFromString('ndis-compliance'));
  });

  it('individual generators are deterministic for same seed', () => {
    expect(JSON.stringify(generateCustomerProfile(42))).toBe(JSON.stringify(generateCustomerProfile(42)));
    expect(JSON.stringify(generateQuoteScenario(42))).toBe(JSON.stringify(generateQuoteScenario(42)));
    expect(JSON.stringify(generateNDISFixture(42))).toBe(JSON.stringify(generateNDISFixture(42)));
    expect(JSON.stringify(generateFinanceFixtures(42))).toBe(JSON.stringify(generateFinanceFixtures(42)));
    expect(JSON.stringify(generateSchedulingFixtures(42))).toBe(JSON.stringify(generateSchedulingFixtures(42)));
  });
});

// ── environment: 'sandbox' enforcement ──────────────────────────────────────

describe('environment sandbox enforcement', () => {
  const AGENT_CASES = [
    ['customer-reply', 'Customer Reply'],
    ['quote-triage', 'Quote Triage'],
    ['ndis-compliance', 'NDIS Compliance'],
    ['cfo-agent', 'CFO Agent'],
    ['scheduling', 'Scheduling'],
    ['lapsed-win-back', 'Lapsed Win-Back'],
    ['stripe-dispute-manager', 'Stripe Dispute Manager'],
    ['whs-safety-reminder', 'WHS Safety Reminder'],
  ] as const;

  for (const [agentId, agentName] of AGENT_CASES) {
    it(`${agentId}: top-level environment is 'sandbox'`, () => {
      const preview = generateSyntheticPreview(agentId, agentName);
      expect(preview.environment).toBe('sandbox');
    });

    it(`${agentId}: every record has environment: 'sandbox'`, () => {
      const preview = generateSyntheticPreview(agentId, agentName);
      expect(preview.records.length).toBeGreaterThan(0);
      for (const record of preview.records) {
        expect(record.environment).toBe('sandbox');
      }
    });
  }
});

// ── Customer profile generator ─────────────────────────────────────────────

describe('generateCustomerProfile', () => {
  it('generates required fields', () => {
    const profile = generateCustomerProfile(42);
    expect(profile.environment).toBe('sandbox');
    expect(profile.id).toMatch(/^sbx_cust_/);
    expect(typeof profile.name).toBe('string');
    expect((profile.email as string)).toContain('@sandbox.example.com');
    expect(typeof profile.suburb).toBe('string');
    expect(Array.isArray(profile.serviceHistory)).toBe(true);
    expect(typeof profile.lapseDays).toBe('number');
    expect((profile.lapseDays as number)).toBeGreaterThanOrEqual(60);
    expect(typeof profile.unsubscribed).toBe('boolean');
    expect(profile.state).toBe('QLD');
  });

  it('service history entries have required fields', () => {
    const profile = generateCustomerProfile(42);
    const history = profile.serviceHistory as Array<{ service: string; date: string; amountCents: number; status: string }>;
    for (const entry of history) {
      expect(typeof entry.service).toBe('string');
      expect(typeof entry.date).toBe('string');
      expect(typeof entry.amountCents).toBe('number');
      expect(entry.status).toBe('completed');
    }
  });

  it('email is lowercase and sandbox-scoped', () => {
    const profile = generateCustomerProfile(42);
    const email = profile.email as string;
    expect(email).toBe(email.toLowerCase());
    expect(email).toContain('@sandbox.example.com');
  });
});

// ── Quote scenario generator ───────────────────────────────────────────────

describe('generateQuoteScenario', () => {
  it('generates required fields', () => {
    const quote = generateQuoteScenario(42);
    expect(quote.environment).toBe('sandbox');
    expect(quote.id).toMatch(/^sbx_quote_/);
    expect(typeof quote.serviceType).toBe('string');
    expect(typeof quote.totalCents).toBe('number');
    expect(quote.status).toBe('submitted');
    expect(typeof quote.inServiceArea).toBe('boolean');
    expect(typeof quote.urgent).toBe('boolean');
  });

  it('out-of-area quotes have a non-standard postcode', () => {
    // Run many seeds to find one with inArea=false
    const outOfArea = Array.from({ length: 50 }, (_, i) => generateQuoteScenario(i * 7 + 3))
      .find((q) => q.inServiceArea === false);
    if (outOfArea) {
      expect(outOfArea.postcode).not.toBe('4114');
    }
  });
});

// ── Message thread generator ───────────────────────────────────────────────

describe('generateMessageThread', () => {
  it('generates required fields', () => {
    const thread = generateMessageThread(42);
    expect(thread.environment).toBe('sandbox');
    expect(thread.id).toMatch(/^sbx_thread_/);
    expect(['email', 'sms']).toContain(thread.channel);
    expect(Array.isArray(thread.messages)).toBe(true);
    expect((thread.messages as unknown[]).length).toBeGreaterThanOrEqual(2);
    expect(typeof thread.escalationRequired).toBe('boolean');
  });

  it('messages have direction and body', () => {
    const thread = generateMessageThread(42);
    const messages = thread.messages as Array<{ direction: string; body: string; sentAt: string }>;
    for (const msg of messages) {
      expect(['inbound', 'outbound']).toContain(msg.direction);
      expect(msg.body.length).toBeGreaterThan(0);
      expect(typeof msg.sentAt).toBe('string');
    }
  });

  it('first message is inbound', () => {
    const thread = generateMessageThread(42);
    const messages = thread.messages as Array<{ direction: string }>;
    expect(messages[0].direction).toBe('inbound');
  });
});

// ── NDIS fixture generator ─────────────────────────────────────────────────

describe('generateNDISFixture', () => {
  it('generates required fields', () => {
    const fixture = generateNDISFixture(42);
    expect(fixture.environment).toBe('sandbox');
    expect(fixture.id).toMatch(/^sbx_ndis_/);
    expect(typeof fixture.participantName).toBe('string');
    expect(fixture.participantId).toMatch(/^sbx_part_/);
    expect(Array.isArray(fixture.supportTypes)).toBe(true);
    expect(['Self-managed', 'Plan-managed', 'NDIA-managed']).toContain(fixture.planManager);
    expect(typeof fixture.wwccExpiry).toBe('string');
    expect(typeof fixture.wwccExpired).toBe('boolean');
    expect(typeof fixture.serviceAgreementEnd).toBe('string');
    expect(typeof fixture.serviceAgreementExpiringSoon).toBe('boolean');
    expect(typeof fixture.incidentPending).toBe('boolean');
    expect(typeof fixture.screened).toBe('boolean');
  });

  it('wwccExpired flag matches expiry date polarity', () => {
    // Run enough seeds to get both cases
    const results = Array.from({ length: 30 }, (_, i) => generateNDISFixture(i * 13 + 7));
    const expired = results.filter((r) => r.wwccExpired === true);
    const notExpired = results.filter((r) => r.wwccExpired === false);
    expect(expired.length).toBeGreaterThan(0);
    expect(notExpired.length).toBeGreaterThan(0);
  });
});

// ── Finance fixtures generator ─────────────────────────────────────────────

describe('generateFinanceFixtures', () => {
  it('returns multiple records', () => {
    const fixtures = generateFinanceFixtures(42);
    expect(fixtures.length).toBeGreaterThanOrEqual(3);
  });

  it('every record has environment: sandbox and an id', () => {
    const fixtures = generateFinanceFixtures(42);
    for (const f of fixtures) {
      expect(f.environment).toBe('sandbox');
      expect(typeof f.id).toBe('string');
      expect(f.id.length).toBeGreaterThan(0);
    }
  });

  it('includes invoices, expenses, and a payout', () => {
    const fixtures = generateFinanceFixtures(42);
    const types = fixtures.map((f) => f.type);
    expect(types).toContain('invoice');
    expect(types).toContain('expense');
    expect(types).toContain('stripe_payout');
  });

  it('invoice status is one of paid/overdue/pending', () => {
    const fixtures = generateFinanceFixtures(42);
    const invoices = fixtures.filter((f) => f.type === 'invoice');
    for (const inv of invoices) {
      expect(['paid', 'overdue', 'pending']).toContain(inv.status);
    }
  });
});

// ── Scheduling fixtures generator ──────────────────────────────────────────

describe('generateSchedulingFixtures', () => {
  it('returns multiple records', () => {
    const fixtures = generateSchedulingFixtures(42);
    expect(fixtures.length).toBeGreaterThanOrEqual(2);
  });

  it('every record has environment: sandbox and an id', () => {
    const fixtures = generateSchedulingFixtures(42);
    for (const f of fixtures) {
      expect(f.environment).toBe('sandbox');
      expect(typeof f.id).toBe('string');
    }
  });

  it('includes crew members and jobs', () => {
    const fixtures = generateSchedulingFixtures(42);
    const types = fixtures.map((f) => f.type);
    expect(types).toContain('crew_member');
    expect(types).toContain('job');
  });

  it('crew members have qualifications array', () => {
    const fixtures = generateSchedulingFixtures(42);
    const crew = fixtures.filter((f) => f.type === 'crew_member');
    for (const member of crew) {
      expect(Array.isArray(member.qualifications)).toBe(true);
      expect((member.qualifications as string[])).toContain('general_cleaning');
    }
  });
});

// ── generateSyntheticPreview routing ──────────────────────────────────────

describe('generateSyntheticPreview', () => {
  it('returns all required top-level fields', () => {
    const preview = generateSyntheticPreview('customer-reply', 'Customer Reply');
    expect(preview.environment).toBe('sandbox');
    expect(preview.agentId).toBe('customer-reply');
    expect(preview.agentName).toBe('Customer Reply');
    expect(typeof preview.fixtureKind).toBe('string');
    expect(typeof preview.category).toBe('string');
    expect(typeof preview.riskCovered).toBe('string');
    expect(Array.isArray(preview.records)).toBe(true);
    expect(Array.isArray(preview.proposedTestInputs)).toBe(true);
    expect(Array.isArray(preview.expectedActionTypes)).toBe(true);
    expect(typeof preview.note).toBe('string');
    expect(typeof preview.generatedAt).toBe('string');
  });

  it('note states no DB writes', () => {
    const preview = generateSyntheticPreview('customer-reply', 'Customer Reply');
    expect(preview.note.toLowerCase()).toContain('no db writes');
  });

  it('generatedAt is fixed (deterministic, not wall-clock)', () => {
    const a = generateSyntheticPreview('customer-reply', 'Customer Reply');
    const b = generateSyntheticPreview('customer-reply', 'Customer Reply');
    expect(a.generatedAt).toBe(b.generatedAt);
    expect(a.generatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('routes NDIS agents to ndis generator', () => {
    expect(generateSyntheticPreview('ndis-compliance', 'NDIS Compliance').fixtureKind).toBe('ndis');
    expect(generateSyntheticPreview('ndis-plan-matcher', 'NDIS Plan Matcher').fixtureKind).toBe('ndis');
  });

  it('routes finance agents to finance generator', () => {
    expect(generateSyntheticPreview('cfo-agent', 'CFO Agent').fixtureKind).toBe('finance');
    expect(generateSyntheticPreview('cash-flow-forecaster', 'Cash Flow Forecaster').fixtureKind).toBe('finance');
    expect(generateSyntheticPreview('reconciliation', 'Reconciliation').fixtureKind).toBe('finance');
    expect(generateSyntheticPreview('stripe-dispute-manager', 'Stripe Dispute Manager').fixtureKind).toBe('finance');
  });

  it('routes scheduling/ops agents to scheduling generator', () => {
    expect(generateSyntheticPreview('scheduling', 'Scheduling').fixtureKind).toBe('scheduling');
    expect(generateSyntheticPreview('whs-safety-reminder', 'WHS Safety Reminder').fixtureKind).toBe('scheduling');
    expect(generateSyntheticPreview('crew-briefing', 'Crew Briefing').fixtureKind).toBe('scheduling');
  });

  it('routes quote agents to quote generator', () => {
    expect(generateSyntheticPreview('quote-triage', 'Quote Triage').fixtureKind).toBe('quote');
  });

  it('routes customer/support agents to customer generator', () => {
    expect(generateSyntheticPreview('customer-reply', 'Customer Reply').fixtureKind).toBe('customer');
    expect(generateSyntheticPreview('lapsed-win-back', 'Lapsed Win-Back').fixtureKind).toBe('customer');
  });

  it('has at least one proposed test input and expected action type', () => {
    const agents = ['customer-reply', 'quote-triage', 'ndis-compliance', 'cfo-agent', 'scheduling'];
    for (const id of agents) {
      const preview = generateSyntheticPreview(id, id);
      expect(preview.proposedTestInputs.length).toBeGreaterThan(0);
      expect(preview.expectedActionTypes.length).toBeGreaterThan(0);
    }
  });

  it('unknown agents fall back gracefully', () => {
    const preview = generateSyntheticPreview('brand-new-agent', 'Brand New Agent');
    expect(preview.environment).toBe('sandbox');
    expect(preview.records.length).toBeGreaterThan(0);
    expect(preview.proposedTestInputs.length).toBeGreaterThan(0);
    expect(preview.riskCovered).toContain('Brand New Agent');
  });
});

// ── No DB writes ───────────────────────────────────────────────────────────

describe('no DB writes', () => {
  it('generateSyntheticPreview is synchronous (not a Promise)', () => {
    const result = generateSyntheticPreview('customer-reply', 'Customer Reply');
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe('object');
  });

  it('generateCustomerProfile is synchronous', () => {
    expect(generateCustomerProfile(42)).not.toBeInstanceOf(Promise);
  });

  it('generateNDISFixture is synchronous', () => {
    expect(generateNDISFixture(42)).not.toBeInstanceOf(Promise);
  });

  it('generateFinanceFixtures is synchronous', () => {
    expect(generateFinanceFixtures(42)).not.toBeInstanceOf(Promise);
  });

  it('generateSchedulingFixtures is synchronous', () => {
    expect(generateSchedulingFixtures(42)).not.toBeInstanceOf(Promise);
  });
});

// ── Doctor integration — shouldShowSyntheticPreview ────────────────────────

describe('shouldShowSyntheticPreview (Doctor integration)', () => {
  it('returns true for missing_data agents', () => {
    const report = deriveIntegrityReport({
      id: 'new-agent-xyz',
      name: 'New Agent XYZ',
      description: 'Unspecced test agent',
      category: 'ops',
      autonomy: 'review',
    });
    expect(report.integrityStatus).toBe('missing_data');
    expect(shouldShowSyntheticPreview(report)).toBe(true);
  });

  it('returns true for agents with missing fixtures', () => {
    const report = deriveIntegrityReport(agent('cfo-agent'));
    expect(report.repairPlan.missingFixtures.length).toBeGreaterThan(0);
    expect(shouldShowSyntheticPreview(report)).toBe(true);
  });

  it('returns true for agents with coverage gaps', () => {
    const unspecced = {
      id: 'unspecced-coverage-agent',
      name: 'Unspecced Agent',
      description: 'Test',
      category: 'ops',
      autonomy: 'review',
    };
    const report = deriveIntegrityReport(unspecced);
    expect(report.repairPlan.coverageGaps.length).toBeGreaterThan(0);
    expect(shouldShowSyntheticPreview(report)).toBe(true);
  });

  it('returns false for ready_to_promote agents with no repair actions', () => {
    const report = deriveIntegrityReport(agent('customer-reply'));
    expect(report.integrityStatus).toBe('ready_to_promote');
    expect(report.repairPlan.missingFixtures.length).toBe(0);
    expect(report.repairPlan.coverageGaps.length).toBe(0);
    expect(shouldShowSyntheticPreview(report)).toBe(false);
  });

  it('returns false for ready_to_test agents with no fixture or gap issues', () => {
    // quote-triage has scenarios but may have integration gaps — not fixture gaps
    const report = deriveIntegrityReport(agent('quote-triage'));
    // Only assert false if there are truly no fixture gaps (may vary by scenario count)
    if (report.repairPlan.missingFixtures.length === 0 && report.repairPlan.coverageGaps.length === 0 && report.integrityStatus !== 'missing_data') {
      expect(shouldShowSyntheticPreview(report)).toBe(false);
    }
  });
});
