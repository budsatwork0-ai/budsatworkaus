import { AGENT_LIST } from '@/lib/agents/registry';
import { SANDBOX_SCENARIOS } from '@/lib/sandbox/scenarios';
import type { AgentDefinition } from '@/lib/agents/types';
import type {
  AgentIntegrityReport,
  AgentIntegrityStatus,
  IntegrityRequirement,
  RequirementStatus,
} from './types';

// ── Static integrity specs ──────────────────────────────────────────────────

type SpecReq = { label: string; required: boolean; sandboxNote?: string };

type AgentSpec = {
  capability: string;
  dataSources: SpecReq[];
  integrations: SpecReq[];
  sandboxFixtures: string[];
  riskIfPromoted: string;
  recommendation: string;
  /** True = missing a required integration makes the agent unsafe_to_promote regardless of score. */
  criticalIntegrationGate?: boolean;
};

const AGENT_SPECS: Record<string, AgentSpec> = {
  'customer-reply': {
    capability:
      'Reads inbound customer messages, drafts context-aware replies, and escalates unresolved complaints.',
    dataSources: [
      { label: 'Email / message threads', required: true },
      { label: 'Customer profile', required: true },
      { label: 'Quote history', required: true },
      { label: 'Escalation rules', required: false },
    ],
    integrations: [
      {
        label: 'Email send (Resend)',
        required: true,
        sandboxNote: 'Must use propose-action adapter only — no live send',
      },
      { label: 'Supabase customers read', required: true, sandboxNote: 'Safe — read-only' },
    ],
    sandboxFixtures: [
      'Seeded customer with full quote history',
      'Complaint message thread (late arrival, quality)',
      'Escalation trigger — abusive customer',
    ],
    riskIfPromoted:
      'Could send poorly-worded replies to real customers, causing churn or reputational damage if escalation logic misfires.',
    recommendation:
      'Seed at least 3 complaint variants. Confirm escalation path fires on angry-customer input. Verify email adapter is propose-only.',
  },

  'quote-triage': {
    capability:
      'Analyses quote submissions, scores urgency, assigns priority, and routes jobs to appropriate crew.',
    dataSources: [
      { label: 'Quote submissions', required: true },
      { label: 'Pricing rules', required: true },
      { label: 'Service area config', required: true },
      { label: 'Urgency signals', required: true },
    ],
    integrations: [
      { label: 'Supabase quotes read', required: true, sandboxNote: 'Safe — read-only' },
      { label: 'Notification send', required: false, sandboxNote: 'Propose action only' },
    ],
    sandboxFixtures: [
      'Quotes across all service types (cleaning, windows, yard)',
      'Same-day urgent request edge case',
      'Out-of-service-area submission',
    ],
    riskIfPromoted:
      'Could misroute high-value quotes or silently drop urgent requests, causing revenue loss and customer trust damage.',
    recommendation:
      'Verify out-of-area rejection and urgency scoring with dedicated fixtures. Run surge-demand stress test.',
  },

  'ndis-compliance': {
    capability:
      'Monitors participant records, checks screening expiries, flags documentation gaps, and logs incident notifications.',
    dataSources: [
      { label: 'Participant records', required: true },
      { label: 'Service agreements', required: true },
      { label: 'Screening expiry dates', required: true },
      { label: 'Incident reporting rules', required: true },
    ],
    integrations: [
      {
        label: 'NDIS DB read (participant_support_profiles)',
        required: true,
        sandboxNote: 'Safe — read-only',
      },
      {
        label: 'NDIS Commission notification',
        required: true,
        sandboxNote: 'MUST be propose-action only — do not call live commission endpoint',
      },
    ],
    sandboxFixtures: [
      'Participant with expired WWCC',
      'Participant with service agreement expiring in 7 days',
      'Participant with complete documentation (control)',
      'Mandatory notification incident',
    ],
    riskIfPromoted:
      'CRITICAL — Regulatory notifications sent without verification constitute NDIS Commission non-compliance. Missing expiry checks could allow unscreened workers with vulnerable participants.',
    recommendation:
      'Block promotion until all incident notification paths are verified sandbox-only. Confirm regulatory actions are always proposal-gated.',
    criticalIntegrationGate: true,
  },

  scheduling: {
    capability:
      'Optimises job scheduling based on crew availability, job duration, travel distance, and shift priority.',
    dataSources: [
      { label: 'Calendar availability', required: true },
      { label: 'Job durations', required: true },
      { label: 'Travel distance data', required: true },
      { label: 'Crew availability', required: true },
    ],
    integrations: [
      { label: 'Supabase jobs read', required: true, sandboxNote: 'Safe — read-only' },
      { label: 'Supabase crew read', required: true, sandboxNote: 'Safe — read-only' },
      { label: 'Calendar write', required: false, sandboxNote: 'Propose action only' },
    ],
    sandboxFixtures: [
      'Crew schedule with gaps and conflicts',
      'High-volume day with 8+ concurrent jobs',
      'No-show crew requiring same-day reassignment',
      'NDIS shift with crew qualification constraint',
    ],
    riskIfPromoted:
      'Incorrect scheduling could create double-bookings, leave jobs unassigned, or assign unqualified crew to NDIS shifts.',
    recommendation:
      'Run scheduling stress test and validate NDIS crew qualification restriction before promoting.',
  },

  'cfo-agent': {
    capability:
      'Produces weekly financial summaries, flags cash flow risks, and recommends payment priority actions.',
    dataSources: [
      { label: 'Invoices', required: true },
      { label: 'Payments received', required: true },
      { label: 'Expenses', required: true },
      { label: 'Cash flow data', required: true },
    ],
    integrations: [
      {
        label: 'Stripe read',
        required: true,
        sandboxNote: 'Sandbox fixture data — no live Stripe calls in sandbox',
      },
      { label: 'Supabase financials read', required: true, sandboxNote: 'Safe — read-only' },
    ],
    sandboxFixtures: [
      'Overdue receivables batch (5+ invoices)',
      '30-day income/expense forecast fixture',
      'Expense spike scenario',
    ],
    riskIfPromoted:
      'Incorrect cash flow forecasts could trigger unnecessary payment escalation or miss real shortfalls, impacting crew payroll.',
    recommendation:
      'Seed complete 30-day financial fixture with realistic income and expense patterns before promoting.',
  },

  'cash-flow-forecaster': {
    capability:
      'Projects 30-day cash position from Stripe payouts, recurring expenses, and invoice history.',
    dataSources: [
      { label: 'Stripe payout history', required: true },
      { label: 'Invoice history', required: true },
      { label: 'Recurring expenses', required: true },
      { label: 'Forecast model config', required: false },
    ],
    integrations: [
      { label: 'Stripe read', required: true, sandboxNote: 'Fixture Stripe payout data' },
      { label: 'Supabase financials read', required: true, sandboxNote: 'Seeded finance tables' },
    ],
    sandboxFixtures: [
      '30-day invoice fixture with payment gaps',
      'Recurring expense configuration set',
    ],
    riskIfPromoted:
      'Inaccurate forecasts could cause premature payment escalation or missed cash shortfall warnings affecting operations.',
    recommendation:
      'Validate forecast model against fixture with known 30-day outcome before promoting.',
  },

  'lapsed-win-back': {
    capability:
      'Identifies lapsed customers at 60–180 day thresholds and proposes personalised re-engagement messages.',
    dataSources: [
      { label: 'Customer order history', required: true },
      { label: 'Last contact date', required: true },
      { label: 'Unsubscribe suppression list', required: true },
      { label: 'Service preferences', required: false },
    ],
    integrations: [
      {
        label: 'Email send (Resend)',
        required: true,
        sandboxNote: 'Propose-action only — no live send',
      },
      { label: 'Supabase customers read', required: true, sandboxNote: 'Safe — read-only' },
    ],
    sandboxFixtures: [
      'Customers at 60d, 90d, 120d, 180d lapse thresholds',
      'High-value lapsed customer fixture',
      'Customer on unsubscribe suppression list',
    ],
    riskIfPromoted:
      'Could send unsolicited emails to unsubscribed customers, breaching spam compliance. Needs suppression list verified.',
    recommendation:
      'Confirm unsubscribe suppression logic is active. Run sandbox at each threshold. Validate personalisation quality.',
  },

  reviews: {
    capability:
      'Prompts satisfied customers for Google reviews and drafts responses to existing reviews.',
    dataSources: [
      { label: 'Completed job records', required: true },
      { label: 'Customer satisfaction signals', required: false },
      { label: 'Google review data', required: false },
    ],
    integrations: [
      {
        label: 'Email send (Resend)',
        required: true,
        sandboxNote: 'Propose-action only — no live send',
      },
      {
        label: 'Google Business read',
        required: false,
        sandboxNote: 'Not yet wired — use fixture reviews',
      },
    ],
    sandboxFixtures: [
      'Completed job with satisfied customer',
      '1-star Google review requiring a response',
    ],
    riskIfPromoted:
      'Aggressive review requests or poorly-worded public responses could damage brand reputation.',
    recommendation:
      'Confirm review request cadence cap. Test negative review response for brand voice compliance.',
  },

  reconciliation: {
    capability:
      'Cross-references Stripe payouts against job records and flags revenue discrepancies.',
    dataSources: [
      { label: 'Stripe payout records', required: true },
      { label: 'Job completion records', required: true },
      { label: 'Invoice records', required: true },
    ],
    integrations: [
      { label: 'Stripe read', required: true, sandboxNote: 'Fixture Stripe data' },
      { label: 'Supabase jobs read', required: true, sandboxNote: 'Seeded jobs table' },
    ],
    sandboxFixtures: [
      'Payout batch with all jobs matched',
      'Discrepancy scenario — missing payout for completed job',
    ],
    riskIfPromoted:
      'Undetected discrepancies allow revenue leakage. False positives could trigger unnecessary dispute flags.',
    recommendation:
      'Run against known-discrepancy fixture and confirm flag is raised correctly before promoting.',
  },

  'stripe-dispute-manager': {
    capability:
      'Detects Stripe chargebacks, assembles evidence from job records, and proposes dispute responses.',
    dataSources: [
      { label: 'Stripe dispute data', required: true },
      { label: 'Job completion records', required: true },
      { label: 'Customer communications', required: false },
    ],
    integrations: [
      {
        label: 'Stripe read (disputes)',
        required: true,
        sandboxNote: 'Fixture dispute data',
      },
      {
        label: 'Stripe write (dispute response)',
        required: true,
        sandboxNote: 'MUST be propose-action only — no live dispute submissions',
      },
    ],
    sandboxFixtures: [
      'Dispute with strong evidence (completed + documented job)',
      'Dispute with weak evidence (no-show scenario)',
    ],
    riskIfPromoted:
      'Incorrect dispute responses cause direct financial loss from lost chargebacks. Evidence quality must be validated first.',
    recommendation:
      'Confirm Stripe write adapter is proposal-only until evidence quality is validated across both fixture cases.',
    criticalIntegrationGate: true,
  },

  'whs-safety-reminder': {
    capability:
      'Sends WHS safety reminders to crew before chemical-handling shifts and flags incidents for mandatory notification.',
    dataSources: [
      { label: 'Upcoming shift schedule', required: true },
      { label: 'WHS policy rules', required: true },
      { label: 'Incident records', required: false },
    ],
    integrations: [
      {
        label: 'Crew notification (SMS/email)',
        required: true,
        sandboxNote: 'Propose-action only',
      },
      {
        label: 'Supabase incident log write',
        required: false,
        sandboxNote: 'Safe — sandbox table',
      },
    ],
    sandboxFixtures: [
      'Upcoming chemical-handling shift (trigger reminder)',
      'Crew injury incident requiring mandatory notification',
    ],
    riskIfPromoted:
      'Missed WHS notifications create workplace safety liability. Incorrect incident classification could trigger unwarranted authority notifications.',
    recommendation:
      'Confirm WHS reminder triggers at correct pre-shift interval. Validate incident classification rules against fixture.',
  },

  'lead-scorer': {
    capability:
      'Scores inbound web leads by quality signals and recommends follow-up priority.',
    dataSources: [
      { label: 'Inbound lead form data', required: true },
      { label: 'Service area match', required: true },
      { label: 'Historical conversion rates', required: false },
    ],
    integrations: [
      { label: 'Supabase leads read', required: true, sandboxNote: 'Safe — read-only' },
    ],
    sandboxFixtures: [
      'High-quality lead (in-area, specific service, clear intent)',
      'Low-quality lead (vague, out-of-area)',
    ],
    riskIfPromoted:
      'Misclassified leads waste crew follow-up time or miss high-value opportunities.',
    recommendation:
      'Validate scoring thresholds against leads with known historical outcomes.',
  },

  'applicant-screener': {
    capability:
      'Reviews crew job applications and flags candidates for interview or rejection based on screening criteria.',
    dataSources: [
      { label: 'Application form data', required: true },
      { label: 'Screening criteria rules', required: true },
      { label: 'NDIS check requirements', required: false },
    ],
    integrations: [
      {
        label: 'Supabase applicants read',
        required: true,
        sandboxNote: 'Safe — read-only',
      },
    ],
    sandboxFixtures: [
      'Strong applicant with all credentials present',
      'Applicant with missing NDIS clearance',
    ],
    riskIfPromoted:
      'Incorrectly flagging applicants could create discrimination liability. Allowing unscreened workers is a compliance risk.',
    recommendation:
      'Validate NDIS clearance check logic before promoting. Test both pass and fail paths.',
  },

  'photo-qa': {
    capability:
      'Reviews before/after job photos for quality assurance and flags issues to supervisors.',
    dataSources: [
      { label: 'Job completion photos', required: true },
      { label: 'Quality standards config', required: false },
    ],
    integrations: [
      {
        label: 'Storage read (Supabase/S3)',
        required: true,
        sandboxNote: 'Fixture photo URLs',
      },
    ],
    sandboxFixtures: [
      'Before/after set with clear quality issue',
      'Clean before/after set (control — should not flag)',
    ],
    riskIfPromoted:
      'False positives unfairly penalise crew. False negatives allow quality issues to reach customers.',
    recommendation:
      'Run against both clean and flagged fixture sets. Validate false positive rate before promoting.',
  },

  'crew-briefing': {
    capability:
      'Generates pre-shift briefings for crew based on upcoming job details, customer notes, and equipment needs.',
    dataSources: [
      { label: 'Scheduled jobs', required: true },
      { label: 'Customer property notes', required: false },
      { label: 'Equipment requirements', required: false },
    ],
    integrations: [
      { label: 'Supabase jobs read', required: true, sandboxNote: 'Safe — read-only' },
      { label: 'Crew notification', required: false, sandboxNote: 'Propose-action only' },
    ],
    sandboxFixtures: [
      'Job with special customer requirements (pets, security codes)',
      'NDIS shift with specific briefing protocol',
    ],
    riskIfPromoted:
      'Incomplete briefings leave crew unprepared for special customer requirements or NDIS protocols.',
    recommendation:
      'Seed fixture with NDIS and standard shifts. Add scenarios and verify briefing completeness.',
  },

  'price-optimizer': {
    capability:
      'Analyses pricing competitiveness and recommends service price adjustments.',
    dataSources: [
      { label: 'Current pricing configuration', required: true },
      { label: 'Competitor price signals', required: false },
      { label: 'Conversion rate by price point', required: false },
    ],
    integrations: [
      {
        label: 'Pricing config read',
        required: true,
        sandboxNote: 'Services pricing config file',
      },
    ],
    sandboxFixtures: [
      'Price sensitivity fixture with high/low conversion at test prices',
    ],
    riskIfPromoted:
      'CRITICAL — Unsanctioned price changes affect all customer quotes. Requires human approval gate before any write.',
    recommendation:
      'Ensure all price proposals have requiresApproval=true. Block auto-approval for any pricing action.',
    criticalIntegrationGate: true,
  },

  'internal-qa': {
    capability:
      'Reviews agent run outputs for quality, hallucinations, and policy compliance.',
    dataSources: [
      { label: 'Agent run history', required: true },
      { label: 'Quality policy rules', required: true },
    ],
    integrations: [
      {
        label: 'Supabase agent_runs read',
        required: true,
        sandboxNote: 'Safe — read-only',
      },
    ],
    sandboxFixtures: [
      'Agent run output with known hallucination',
      'Clean agent run output (control)',
    ],
    riskIfPromoted: 'Undetected hallucinations propagate to downstream agents acting on bad data.',
    recommendation:
      'Test against known hallucination fixture before promoting. Verify detection sensitivity.',
  },

  'ndis-plan-matcher': {
    capability:
      'Matches NDIS participants to crew workers based on support needs, qualifications, and NDIS plan constraints.',
    dataSources: [
      { label: 'Participant support profiles', required: true },
      { label: 'Crew NDIS qualifications', required: true },
      { label: 'NDIS plan funding limits', required: false },
    ],
    integrations: [
      {
        label: 'Supabase NDIS tables read',
        required: true,
        sandboxNote: 'participant_support_profiles + job_participant_matches',
      },
    ],
    sandboxFixtures: [
      'Participant with specific support requirements',
      'Crew with matching NDIS qualifications',
      'No-match scenario (no qualified crew available)',
    ],
    riskIfPromoted:
      'Incorrect participant-crew matches place unqualified workers with vulnerable participants — direct regulatory risk.',
    recommendation:
      'Block promotion until no-match handling is validated. Verify qualification check logic at each support level.',
    criticalIntegrationGate: true,
  },
};

// ── Category fallbacks for unspecced agents ────────────────────────────────

const CATEGORY_CAPABILITY: Record<string, string> = {
  sales: 'Analyses sales signals and proposes customer acquisition or retention actions.',
  support: 'Handles inbound customer support requests and escalations.',
  ops: 'Monitors operational metrics and proposes process improvements.',
  hiring: 'Reviews applicant data and recommends hiring decisions.',
  finance: 'Analyses financial data and recommends payment or reporting actions.',
  compliance: 'Monitors compliance requirements and flags regulatory risks.',
  executive: 'Synthesises cross-functional data and provides strategic recommendations.',
};

const CATEGORY_RISK: Record<string, string> = {
  sales: 'May send unsolicited communications to customers if email adapter is not sandboxed.',
  support: 'May send incorrect replies to real customers if not validated against complaint scenarios.',
  ops: 'May propose incorrect operational changes without scenario coverage.',
  hiring: 'May incorrectly screen applicants, creating compliance or discrimination risk.',
  finance: 'May trigger incorrect financial actions without full data fixture coverage.',
  compliance: 'May miss regulatory requirements or file false notifications without proper testing.',
  executive: 'May produce misleading strategic recommendations without validated data pipelines.',
};

// ── Internal helpers ───────────────────────────────────────────────────────

function scenariosForAgent(agentId: string): string[] {
  return SANDBOX_SCENARIOS.filter((s) => s.agentId === agentId).map((s) => s.title);
}

function computeScore(
  all: IntegrityRequirement[],
): number {
  if (all.length === 0) return 0;
  const sum = all.reduce(
    (acc, r) => acc + (r.status === 'present' ? 1 : r.status === 'partial' ? 0.5 : 0),
    0,
  );
  return Math.round((sum / all.length) * 100);
}

function deriveStatus(
  score: number,
  scenarioCount: number,
  integrations: IntegrityRequirement[],
  criticalGate: boolean,
): AgentIntegrityStatus {
  const hasMissingRequired = integrations.some((i) => i.status === 'missing');
  if (criticalGate && hasMissingRequired) return 'unsafe_to_promote';
  if (scenarioCount === 0) return 'missing_data';
  if (hasMissingRequired) return 'missing_integration';
  // Critical-gate agents require every integration confirmed present before promoting
  const allIntegrationsPresent = integrations.every((i) => i.status === 'present');
  if (score >= 80 && (!criticalGate || allIntegrationsPresent)) return 'ready_to_promote';
  if (score >= 40) return 'ready_to_test';
  return 'missing_data';
}

function buildFixPrompt(
  agent: AgentDefinition,
  status: AgentIntegrityStatus,
  missing: string[],
  recommendation: string,
): string {
  const parts = [
    `Fix integrity issues for agent '${agent.id}' (${agent.name}).`,
    `Current status: ${status.replace(/_/g, ' ')}.`,
  ];
  if (missing.length > 0) parts.push(`Missing: ${missing.join(', ')}.`);
  parts.push(recommendation);
  parts.push(
    'Important: do not dispatch real emails, calendar events, Stripe writes, or external API calls. All outbound integrations must use propose-action-only adapters in sandbox.',
  );
  return parts.join(' ');
}

// ── Main derivation ────────────────────────────────────────────────────────

export function deriveIntegrityReport(agent: AgentDefinition): AgentIntegrityReport {
  const spec = AGENT_SPECS[agent.id];
  const agentScenarioTitles = scenariosForAgent(agent.id);
  const scenarioCount = agentScenarioTitles.length;
  const hasScenarios = scenarioCount > 0;

  // ── Generic path for unspecced agents ──────────────────────────────
  if (!spec) {
    const capability = CATEGORY_CAPABILITY[agent.category] ?? agent.description;
    const riskIfPromoted = CATEGORY_RISK[agent.category] ?? 'Unknown risk — review before promoting.';

    const dataSources: IntegrityRequirement[] = [
      {
        label: 'Primary data source (unspecified)',
        status: hasScenarios ? 'partial' : 'missing',
        notes: 'Add an integrity spec for this agent to describe its data requirements precisely.',
      },
    ];
    const integrations: IntegrityRequirement[] = [];
    const sandboxFixtures: IntegrityRequirement[] = [
      { label: 'Sandbox test fixtures', status: hasScenarios ? 'partial' : 'missing' },
    ];
    const scenarioCoverage: IntegrityRequirement[] = agentScenarioTitles.map((title) => ({
      label: title,
      status: 'present' as RequirementStatus,
    }));
    if (!hasScenarios) scenarioCoverage.push({ label: 'No scenarios defined', status: 'missing' });

    const missingConnections: string[] = [];
    if (!hasScenarios) missingConnections.push('Sandbox scenarios');

    const allReqs = [...dataSources, ...integrations, ...sandboxFixtures, ...scenarioCoverage];
    const integrityScore = computeScore(allReqs);
    const integrityStatus = deriveStatus(integrityScore, scenarioCount, integrations, false);
    const recommendation = hasScenarios
      ? `Add a structured integrity spec for ${agent.id}. Scenario coverage exists but requirements are unverified.`
      : `Define sandbox scenarios and a structured integrity spec for ${agent.id} before testing or promoting.`;
    const generateFixPrompt = buildFixPrompt(agent, integrityStatus, missingConnections, recommendation);

    return {
      agentId: agent.id,
      agentName: agent.name,
      category: agent.category,
      intendedCapability: capability,
      integrityScore,
      integrityStatus,
      dataSources,
      integrations,
      missingConnections,
      sandboxFixtures,
      scenarioCoverage,
      scenarioCount,
      recommendation,
      riskIfPromoted,
      generateFixPrompt,
    };
  }

  // ── Specced path ──────────────────────────────────────────────────
  const isAutoAgent = agent.autonomy === 'auto';

  // Data sources: coverage inferred from scenario count
  const dataSources: IntegrityRequirement[] = spec.dataSources.map((ds, index) => {
    let status: RequirementStatus;
    if (scenarioCount >= 3) {
      status = 'present';
    } else if (scenarioCount >= 1) {
      status = index === 0 ? 'present' : 'partial';
    } else {
      status = ds.required ? 'missing' : 'partial';
    }
    return { label: ds.label, status, notes: ds.sandboxNote };
  });

  // Integrations: outbound ones with auto-agents flag as missing (real-world risk)
  const integrations: IntegrityRequirement[] = spec.integrations.map((int) => {
    const isOutbound =
      int.label.toLowerCase().includes('send') ||
      int.label.toLowerCase().includes('write') ||
      int.label.toLowerCase().includes('notification') ||
      int.label.toLowerCase().includes('commission');

    let status: RequirementStatus;
    if (!int.required) {
      status = hasScenarios ? 'partial' : 'missing';
    } else if (isOutbound && isAutoAgent) {
      status = 'missing';
    } else if (isOutbound) {
      status = hasScenarios ? 'partial' : 'missing';
    } else {
      status = hasScenarios ? 'present' : 'partial';
    }
    return { label: int.label, status, notes: int.sandboxNote };
  });

  // Sandbox fixtures: proxy scenario count against expected fixture count
  const sandboxFixtures: IntegrityRequirement[] = spec.sandboxFixtures.map((fixture, index) => {
    let status: RequirementStatus;
    if (scenarioCount > index) {
      status = 'present';
    } else if (scenarioCount > 0) {
      status = 'partial';
    } else {
      status = 'missing';
    }
    return { label: fixture, status };
  });

  // Scenario coverage: list real scenarios + gap note
  const scenarioCoverage: IntegrityRequirement[] = agentScenarioTitles.map((title) => ({
    label: title,
    status: 'present' as RequirementStatus,
  }));
  if (scenarioCount === 0) {
    scenarioCoverage.push({ label: 'No scenarios defined', status: 'missing' });
  } else if (scenarioCount < Math.max(2, Math.ceil(spec.sandboxFixtures.length * 0.5))) {
    scenarioCoverage.push({
      label: `${spec.sandboxFixtures.length - scenarioCount} additional scenario(s) needed`,
      status: 'partial',
    });
  }

  const missingConnections = [
    ...integrations.filter((i) => i.status === 'missing').map((i) => i.label),
    ...dataSources.filter((d) => d.status === 'missing').map((d) => d.label),
    ...(scenarioCount === 0 ? ['Sandbox scenarios'] : []),
  ];

  const allReqs = [...dataSources, ...integrations, ...sandboxFixtures, ...scenarioCoverage];
  const integrityScore = computeScore(allReqs);
  const integrityStatus = deriveStatus(
    integrityScore,
    scenarioCount,
    integrations,
    spec.criticalIntegrationGate ?? false,
  );
  const generateFixPrompt = buildFixPrompt(agent, integrityStatus, missingConnections, spec.recommendation);

  return {
    agentId: agent.id,
    agentName: agent.name,
    category: agent.category,
    intendedCapability: spec.capability,
    integrityScore,
    integrityStatus,
    dataSources,
    integrations,
    missingConnections,
    sandboxFixtures,
    scenarioCoverage,
    scenarioCount,
    recommendation: spec.recommendation,
    riskIfPromoted: spec.riskIfPromoted,
    generateFixPrompt,
  };
}

export function deriveFleetIntegrityReports(): AgentIntegrityReport[] {
  return AGENT_LIST.map(deriveIntegrityReport);
}

export function integrityStatusLabel(status: AgentIntegrityStatus): string {
  switch (status) {
    case 'ready_to_promote':    return 'Ready to Promote';
    case 'ready_to_test':       return 'Ready to Test';
    case 'missing_data':        return 'Missing Data';
    case 'missing_integration': return 'Missing Integration';
    case 'unsafe_to_promote':   return 'Unsafe to Promote';
  }
}

export function integrityStatusColour(status: AgentIntegrityStatus): string {
  switch (status) {
    case 'ready_to_promote':    return 'bg-[#e5f4ec] text-[#1C7C54]';
    case 'ready_to_test':       return 'bg-blue-100 text-blue-800';
    case 'missing_data':        return 'bg-yellow-100 text-yellow-800';
    case 'missing_integration': return 'bg-amber-100 text-amber-800';
    case 'unsafe_to_promote':   return 'bg-red-100 text-red-800';
  }
}

export function requirementStatusColour(status: RequirementStatus): string {
  switch (status) {
    case 'present': return 'bg-[#e5f4ec] text-[#1C7C54]';
    case 'partial':  return 'bg-yellow-100 text-yellow-800';
    case 'missing':  return 'bg-red-100 text-red-800';
  }
}
