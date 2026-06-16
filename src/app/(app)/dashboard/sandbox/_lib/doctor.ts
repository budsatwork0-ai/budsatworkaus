import { SANDBOX_SCENARIOS } from '@/lib/sandbox/scenarios';
import type {
  AgentRepairPlan,
  AgentIntegrityReport,
  AgentIntegrityStatus,
  CoverageGapRepair,
  FleetRepairQueueItem,
  HealthData,
  IntegrityRequirement,
  IntegrationConnectionStatus,
  IntegrationDetail,
  MissingFixtureRepair,
  MissingIntegrationRepair,
  RecommendedConnection,
  RepairDisposition,
  RequirementStatus,
  RepairPriority,
  RepairSeverity,
  RootCause,
} from './types';

// Lightweight agent metadata — avoids pulling in the full registry (which has Node.js deps)
// and is safe to import in client components.
export type AgentMeta = {
  id: string;
  name: string;
  description: string;
  category: string;
  autonomy: string;
};

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

  'yard-map-geo': {
    capability:
      'Analyses property address data to estimate yard dimensions, perimeter, and area using Google Maps geocoding and historical job records.',
    dataSources: [
      { label: 'Property address', required: true },
      { label: 'Google Maps geocoding data', required: true },
      { label: 'Supabase property records', required: true },
      { label: 'Historical yard job records', required: false },
    ],
    integrations: [
      {
        label: 'Google Maps API',
        required: true,
        sandboxNote: 'Fixture GeoJSON polygon data only — no live Maps API calls in sandbox',
      },
      {
        label: 'Supabase property read',
        required: true,
        sandboxNote: 'Safe — read-only',
      },
    ],
    sandboxFixtures: [
      'Property with known boundary polygon and verified area (sqm)',
      'Property with irregular boundary (L-shaped lot)',
      'Address geocoding failure scenario (invalid address)',
    ],
    riskIfPromoted:
      'Incorrect dimension estimates cause systematic underpricing on yard jobs, leading to crew time overruns and revenue loss on every affected quote.',
    recommendation:
      'Seed at least 2 fixture property GeoJSON polygons with verified area ground-truth values. Confirm area and perimeter calculations match expected outputs before promoting.',
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

// ── Integration metadata ───────────────────────────────────────────────────
// Maps known integration labels to purpose, env vars, and mock connector info.

type IntegrationMeta = { purpose: string; envVars: string[]; connectorName: string };

const INTEGRATION_METADATA: Record<string, IntegrationMeta> = {
  'Email send (Resend)': {
    purpose: 'Send customer-facing transactional emails via Resend',
    envVars: ['RESEND_API_KEY'],
    connectorName: 'Gmail Sandbox Adapter',
  },
  'Crew notification (SMS/email)': {
    purpose: 'Send SMS or email notifications to crew members',
    envVars: ['RESEND_API_KEY', 'TWILIO_ACCOUNT_SID'],
    connectorName: 'Crew Notification Sandbox Adapter',
  },
  'Supabase customers read': {
    purpose: 'Read customer records and profile data from Supabase',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    connectorName: 'Customer Records Fixtures',
  },
  'Supabase quotes read': {
    purpose: 'Read quote submissions and pricing data from Supabase',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    connectorName: 'Quote Submission Fixtures',
  },
  'Supabase jobs read': {
    purpose: 'Read job completion records and schedules from Supabase',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    connectorName: 'Job Records Fixtures',
  },
  'Supabase crew read': {
    purpose: 'Read crew availability and qualification records from Supabase',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    connectorName: 'Crew Records Fixtures',
  },
  'Supabase financials read': {
    purpose: 'Read invoice and expense records from Supabase',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    connectorName: 'Invoice Sandbox Data',
  },
  'Supabase leads read': {
    purpose: 'Read inbound lead form submissions from Supabase',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    connectorName: 'Lead Records Fixtures',
  },
  'Supabase applicants read': {
    purpose: 'Read crew job applications from Supabase',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    connectorName: 'Applicant Records Fixtures',
  },
  'Supabase agent_runs read': {
    purpose: 'Read historical agent run outputs for quality review',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    connectorName: 'Agent Run History Fixtures',
  },
  'Supabase NDIS tables read': {
    purpose: 'Read participant support profiles and job match records',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    connectorName: 'Participant Records Fixtures',
  },
  'NDIS DB read (participant_support_profiles)': {
    purpose: 'Read NDIS participant support profile records',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    connectorName: 'Participant Records Fixtures',
  },
  'NDIS Commission notification': {
    purpose: 'Submit mandatory incident notifications to the NDIS Commission',
    envVars: ['NDIS_COMMISSION_API_KEY'],
    connectorName: 'NDIS Commission Sandbox Stub',
  },
  'Stripe read': {
    purpose: 'Read Stripe payment, payout, and invoice data',
    envVars: ['STRIPE_SECRET_KEY'],
    connectorName: 'Stripe Sandbox Data',
  },
  'Stripe read (disputes)': {
    purpose: 'Read Stripe chargeback and dispute data',
    envVars: ['STRIPE_SECRET_KEY'],
    connectorName: 'Stripe Dispute Fixtures',
  },
  'Stripe write (dispute response)': {
    purpose: 'Submit dispute evidence and responses to Stripe',
    envVars: ['STRIPE_SECRET_KEY'],
    connectorName: 'Stripe Write Sandbox Adapter',
  },
  'Calendar write': {
    purpose: 'Write job events and crew schedules to calendar',
    envVars: ['GOOGLE_CALENDAR_API_KEY'],
    connectorName: 'Calendar Sandbox Adapter',
  },
  'Notification send': {
    purpose: 'Send internal operational notifications',
    envVars: ['RESEND_API_KEY'],
    connectorName: 'Notification Sandbox Adapter',
  },
  'Google Business read': {
    purpose: 'Read Google Business reviews and ratings',
    envVars: ['GOOGLE_BUSINESS_API_KEY'],
    connectorName: 'Google Reviews Fixture Data',
  },
  'Google Maps API': {
    purpose: 'Geocode property addresses and retrieve boundary polygon data',
    envVars: ['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'],
    connectorName: 'GeoJSON Fixture Adapter',
  },
  'Supabase property read': {
    purpose: 'Read property records and historical yard job data',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    connectorName: 'Property Records Fixtures',
  },
  'Supabase incident log write': {
    purpose: 'Write WHS incident records to the sandbox incident log',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    connectorName: 'Sandbox Incident Log',
  },
  'Storage read (Supabase/S3)': {
    purpose: 'Read job completion photos from storage',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    connectorName: 'Photo Fixture URLs',
  },
  'Pricing config read': {
    purpose: 'Read the services pricing configuration file',
    envVars: [],
    connectorName: 'Services Pricing Config',
  },
  'Crew notification': {
    purpose: 'Send pre-shift briefing notifications to crew',
    envVars: ['RESEND_API_KEY'],
    connectorName: 'Crew Notification Sandbox Adapter',
  },
};

function getIntegrationMeta(label: string): IntegrationMeta {
  if (INTEGRATION_METADATA[label]) return INTEGRATION_METADATA[label];
  // Fallback: derive from label
  const lower = label.toLowerCase();
  const envVars = lower.includes('supabase')
    ? ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    : lower.includes('stripe')
    ? ['STRIPE_SECRET_KEY']
    : lower.includes('resend') || lower.includes('email')
    ? ['RESEND_API_KEY']
    : lower.includes('google')
    ? ['GOOGLE_API_KEY']
    : [];
  return {
    purpose: `${label} connector`,
    envVars,
    connectorName: `${label} Sandbox Adapter`,
  };
}

function deriveConnectionStatus(
  req: IntegrityRequirement,
  isOutbound: boolean,
): IntegrationConnectionStatus {
  if (req.status === 'missing') return 'missing';
  if (req.status === 'present') return isOutbound ? 'mocked' : 'connected';
  // partial
  return isOutbound ? 'unverified' : 'mocked';
}

function buildIntegrationDetails(
  integrations: IntegrityRequirement[],
  spec: { integrations: Array<{ label: string; required: boolean; sandboxNote?: string }> } | null,
): IntegrationDetail[] {
  return integrations.map((req) => {
    const specReq = spec?.integrations.find((s) => s.label === req.label);
    const meta = getIntegrationMeta(req.label);
    const lower = req.label.toLowerCase();
    const isOutbound =
      lower.includes('send') ||
      lower.includes('write') ||
      lower.includes('notification') ||
      lower.includes('commission');
    const mockAvailable =
      req.status !== 'missing' ||
      lower.includes('supabase') ||
      lower.includes('fixture') ||
      lower.includes('read');
    return {
      label: req.label,
      purpose: meta.purpose,
      connectionStatus: deriveConnectionStatus(req, isOutbound),
      required: specReq?.required ?? true,
      envVars: meta.envVars,
      mockAvailable,
      sandboxNote: specReq?.sandboxNote ?? req.notes ?? '',
      connectorName: meta.connectorName,
    };
  });
}

// ── Internal helpers ───────────────────────────────────────────────────────

function scenariosForAgent(agentId: string): string[] {
  return SANDBOX_SCENARIOS.filter((s) => s.agentId === agentId).map((s) => s.title);
}

function scenarioTemplatesForAgent(agentId: string) {
  return SANDBOX_SCENARIOS.filter((s) => s.agentId === agentId);
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

function priorityForSeverity(severity: RepairSeverity): RepairPriority {
  return severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low';
}

function severityWeight(priority: RepairPriority): number {
  switch (priority) {
    case 'critical': return 100;
    case 'high': return 70;
    case 'medium': return 40;
    case 'low': return 15;
  }
}

function inferSeverity(label: string, required: boolean, criticalGate: boolean): RepairSeverity {
  const lower = label.toLowerCase();
  if (criticalGate || lower.includes('commission') || lower.includes('ndis') || lower.includes('dispute response')) return 'critical';
  if (lower.includes('stripe') || lower.includes('write') || lower.includes('send') || lower.includes('calendar')) return required ? 'high' : 'medium';
  if (lower.includes('notification')) return 'high';
  return required ? 'medium' : 'low';
}

function recommendedConnectionName(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('email') || lower.includes('gmail')) return 'Gmail Sandbox Adapter';
  if (lower.includes('message') || lower.includes('messenger')) return 'Messenger Sandbox Adapter';
  if (lower.includes('calendar')) return 'Calendar Sandbox Adapter';
  if (lower.includes('stripe')) return 'Stripe Sandbox Data';
  if (lower.includes('quote')) return 'Quote Submission Fixtures';
  if (lower.includes('customer')) return 'Customer Records Fixtures';
  if (lower.includes('participant') || lower.includes('ndis')) return 'Participant Records Fixtures';
  if (lower.includes('crew')) return 'Crew Records Fixtures';
  if (lower.includes('invoice')) return 'Invoice Sandbox Data';
  if (lower.includes('expense')) return 'Expense Sandbox Data';
  if (lower.includes('analytics') || lower.includes('conversion')) return 'Analytics Sandbox Data';
  return `${label} Sandbox Adapter`;
}

function fixtureKind(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('conversation') || lower.includes('complaint') || lower.includes('message') || lower.includes('review')) return 'fake conversations';
  if (lower.includes('invoice') || lower.includes('payment') || lower.includes('expense') || lower.includes('payout') || lower.includes('cash') || lower.includes('dispute')) return 'fake transactions';
  if (lower.includes('participant') || lower.includes('ndis') || lower.includes('service agreement')) return 'fake participants';
  if (lower.includes('job') || lower.includes('shift') || lower.includes('schedule') || lower.includes('crew')) return 'fake jobs';
  if (lower.includes('quote') || lower.includes('customer') || lower.includes('applicant') || lower.includes('lead')) return 'mock records';
  return 'sandbox data';
}

function likelyFilesForAgent(agent: AgentMeta): string[] {
  const lower = `${agent.id} ${agent.category}`.toLowerCase();
  const files = [
    'src/app/(app)/dashboard/sandbox/_lib/doctor.ts',
    'src/lib/sandbox/scenarios.ts',
    'tests/lib/sandbox-agent-doctor.test.ts',
  ];
  if (lower.includes('customer') || lower.includes('reply') || lower.includes('lapsed')) files.push('src/lib/agents/customer-reply.ts');
  if (lower.includes('quote')) files.push('src/lib/agents/quote-triage.ts');
  if (lower.includes('ndis')) files.push('src/lib/ndis/matching.ts');
  if (lower.includes('schedul') || lower.includes('crew')) files.push('src/lib/agents/scheduling.ts');
  if (lower.includes('finance') || lower.includes('cfo') || lower.includes('cash') || lower.includes('stripe') || lower.includes('reconciliation')) files.push('src/lib/stripe/server.ts');
  return Array.from(new Set(files));
}

function rootCausesForAgent(health: HealthData | undefined, agentId: string): RootCause[] {
  return (health?.activeRootCauses ?? health?.rootCauses ?? []).filter((cause) => cause.agentId === agentId);
}

function failingScenariosForAgent(health: HealthData | undefined, agentId: string) {
  return (health?.failingScenarios ?? []).filter((scenario) => scenario.agentId === agentId);
}

function latestBatchForAgent(health: HealthData | undefined, agentId: string) {
  return (health?.batches ?? []).find((batch) => batch.agent_id === agentId) ?? null;
}

function derivePassedScenarioCount(health: HealthData | undefined, agentId: string, total: number, failingCount: number): number {
  const batch = latestBatchForAgent(health, agentId);
  if (batch) return batch.pass_count;
  if (health && total > 0) return Math.max(0, total - failingCount);
  return total;
}

function buildMissingIntegrationRepairs(
  agent: AgentMeta,
  capability: string,
  integrations: IntegrityRequirement[],
  spec: AgentSpec | null,
): MissingIntegrationRepair[] {
  return integrations
    .filter((item) => item.status === 'missing')
    .map((item) => {
      const specReq = spec?.integrations.find((req) => req.label === item.label);
      const severity = inferSeverity(item.label, specReq?.required ?? true, spec?.criticalIntegrationGate ?? false);
      const connection = recommendedConnectionName(item.label);
      return {
        integration: item.label,
        whyRequired: specReq?.sandboxNote ?? `${agent.name} needs this connection to safely validate ${capability.toLowerCase()}.`,
        blockedCapability: capability,
        severity,
        recommendedFix: `Wire ${connection} through a sandbox/propose-action adapter and add deterministic tests before promotion.`,
      };
    });
}

function buildAgentSpecificFixtureAction(agent: AgentMeta): string {
  const category = agent.category;
  const lower = `${agent.id} ${agent.name}`.toLowerCase();

  if (category === 'compliance' || lower.includes('ndis'))
    return `Generate sandbox fixtures for ${agent.name}, including participant records, plan/service agreement samples, and screening expiry scenarios needed to test its expected compliance capability.`;
  if (category === 'finance' || lower.includes('cash') || lower.includes('invoice') || lower.includes('reconcil') || lower.includes('cfo'))
    return `Generate sandbox fixtures for ${agent.name}, including fake invoices, expenses, and transaction records needed to test its expected financial analysis capability.`;
  if (lower.includes('lead') || lower.includes('campaign') || lower.includes('conversion') || lower.includes('growth') || lower.includes('seo') || lower.includes('content'))
    return `Generate sandbox fixtures for ${agent.name}, including fake leads, campaign events, and conversion signals needed to test its expected growth capability.`;
  if (category === 'sales' || category === 'support' || lower.includes('customer') || lower.includes('reply') || lower.includes('lapsed') || lower.includes('review'))
    return `Generate sandbox fixtures for ${agent.name}, including fake customers, message threads, and quote history needed to test its expected customer-facing capability.`;
  if (category === 'ops' || lower.includes('schedul') || lower.includes('crew') || lower.includes('job'))
    return `Generate sandbox fixtures for ${agent.name}, including fake crew records, jobs, and calendar availability scenarios needed to test its expected scheduling capability.`;
  if (category === 'hiring' || lower.includes('applicant') || lower.includes('screen'))
    return `Generate sandbox fixtures for ${agent.name}, including fake applicant records and screening criteria samples needed to test its expected hiring capability.`;

  return `Generate sandbox fixtures for ${agent.name}, including the minimum fake records needed to test its expected capability.`;
}

function buildMissingFixtureRepairs(
  agent: AgentMeta,
  sandboxFixtures: IntegrityRequirement[],
  dataSources: IntegrityRequirement[],
): MissingFixtureRepair[] {
  const fixtureItems = sandboxFixtures.filter((item) => item.status !== 'present');
  const dataItems = dataSources.filter((item) => item.status === 'missing');
  return [...fixtureItems, ...dataItems].map((item) => {
    const isGenericFixture = item.label === 'Sandbox test fixtures';
    const kind = fixtureKind(item.label);
    return {
      fixture: item.label,
      whyItMatters: isGenericFixture
        ? `Without sandbox fixtures for ${agent.name}, the Doctor cannot validate its expected capability against deterministic test data.`
        : `Without ${kind}, the Doctor cannot validate this requirement without relying on production-shaped data.`,
      recommendedFixture: isGenericFixture
        ? buildAgentSpecificFixtureAction(agent)
        : `Generate ${kind} for "${item.label}" with explicit sandbox identifiers and no live dispatch side effects.`,
    };
  });
}

function buildCoverageGaps(
  agent: AgentMeta,
  spec: AgentSpec | null,
  scenarioCoverage: IntegrityRequirement[],
  failingCount: number,
): CoverageGapRepair[] {
  const gaps: CoverageGapRepair[] = scenarioCoverage
    .filter((item) => item.status !== 'present')
    .map((item) => ({
      capability: item.label,
      riskLevel: item.status === 'missing' ? 'high' : 'medium',
      recommendedScenario: `Add a sandbox scenario for ${agent.name} that validates ${item.label.toLowerCase()} with expected proposed actions only.`,
    }));

  if (failingCount > 0) {
    gaps.push({
      capability: 'Failing latest scenario run',
      riskLevel: 'high',
      recommendedScenario: `Rerun and repair ${agent.name} against the failing scenario set before promotion.`,
    });
  }

  if (spec && scenarioTemplatesForAgent(agent.id).length === 0) {
    gaps.push({
      capability: spec.capability,
      riskLevel: spec.criticalIntegrationGate ? 'critical' : 'high',
      recommendedScenario: `Create first sandbox scenario for ${agent.name} covering ${spec.capability.toLowerCase()}.`,
    });
  }

  return gaps;
}

function buildRecommendedConnections(
  agent: AgentMeta,
  capability: string,
  missingIntegrations: MissingIntegrationRepair[],
  missingFixtures: MissingFixtureRepair[],
): RecommendedConnection[] {
  const hasRepairItems = missingIntegrations.length > 0 || missingFixtures.length > 0;
  const base: RecommendedConnection[] = missingIntegrations.map((item) => ({
    capability,
    connection: recommendedConnectionName(item.integration),
    benefit: `Unblocks sandbox validation for ${item.integration}.`,
    priority: priorityForSeverity(item.severity),
    riskIfMissing: `${item.blockedCapability} remains blocked or unsafe to promote.`,
  }));

  for (const fixture of missingFixtures) {
    base.push({
      capability,
      connection: fixture.recommendedFixture.replace(/^Generate /, ''),
      benefit: `Provides deterministic test coverage for ${fixture.fixture}.`,
      priority: fixture.fixture.toLowerCase().includes('ndis') ? 'critical' : 'medium',
      riskIfMissing: fixture.whyItMatters,
    });
  }

  const lower = agent.id.toLowerCase();
  if (hasRepairItems && lower === 'customer-reply') {
    base.push(
      {
        capability: 'Customer Reply',
        connection: 'Gmail Sandbox Adapter',
        benefit: 'Validates email replies without sending real customer emails.',
        priority: 'high',
        riskIfMissing: 'Customer response behavior cannot be safely promoted.',
      },
      {
        capability: 'Customer Reply',
        connection: 'Messenger Sandbox Adapter',
        benefit: 'Covers inbound support conversations from Messenger-style channels.',
        priority: 'medium',
        riskIfMissing: 'Messenger replies remain untested.',
      },
    );
  }
  if (hasRepairItems && lower === 'scheduling') {
    base.push({
      capability: 'Scheduling',
      connection: 'Calendar Sandbox Adapter',
      benefit: 'Validates calendar proposals without writing real events.',
      priority: 'high',
      riskIfMissing: 'Scheduling cannot prove conflict handling before promotion.',
    });
  }
  if (hasRepairItems && ['cfo-agent', 'cash-flow-forecaster', 'reconciliation'].includes(lower)) {
    base.push(
      {
        capability: 'Finance',
        connection: 'Invoice Sandbox Data',
        benefit: 'Gives finance agents realistic receivables and invoice context.',
        priority: 'high',
        riskIfMissing: 'Cash flow and reconciliation results remain weakly grounded.',
      },
      {
        capability: 'Finance',
        connection: 'Expense Sandbox Data',
        benefit: 'Covers expense spikes and recurring cost behavior.',
        priority: 'medium',
        riskIfMissing: 'Forecasts may miss expense-driven risk.',
      },
    );
  }
  if (hasRepairItems && lower === 'quote-triage') {
    base.push({
      capability: 'Quote Triage',
      connection: 'Quote Submission Fixtures',
      benefit: 'Covers quote intake, urgency, and service routing behavior.',
      priority: 'high',
      riskIfMissing: 'High-value or urgent quote routing may remain untested.',
    });
  }
  if (hasRepairItems && (lower === 'ndis-compliance' || lower === 'ndis-plan-matcher')) {
    base.push(
      {
        capability: 'NDIS Compliance',
        connection: 'Participant Records Fixtures',
        benefit: 'Validates participant-specific compliance without production data.',
        priority: 'critical',
        riskIfMissing: 'Regulatory risk remains unresolved.',
      },
      {
        capability: 'NDIS Compliance',
        connection: 'Service Agreement Fixtures',
        benefit: 'Covers agreement expiry and plan matching behavior.',
        priority: 'critical',
        riskIfMissing: 'Service agreement gaps may not be caught before promotion.',
      },
    );
  }

  const seen = new Set<string>();
  return base.filter((item) => {
    const key = `${item.capability}:${item.connection}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildRootCauseSummary(
  reportStatus: AgentIntegrityStatus,
  missingIntegrations: MissingIntegrationRepair[],
  missingFixtures: MissingFixtureRepair[],
  coverageGaps: CoverageGapRepair[],
  rootCauses: RootCause[],
): string {
  if (rootCauses.length > 0) {
    return rootCauses.map((cause) => cause.rootCauseSummary).join(' ');
  }
  if (missingIntegrations.length > 0) return `Missing sandbox integration coverage is blocking ${missingIntegrations[0].blockedCapability}.`;
  if (missingFixtures.length > 0) return 'Sandbox fixture coverage is incomplete, so the agent cannot be validated against required data shapes.';
  if (coverageGaps.length > 0) return 'Scenario coverage is incomplete for at least one required capability.';
  if (reportStatus === 'ready_to_promote') return 'No repair required.';
  return 'Integrity score is below promotion threshold; review missing requirements and scenario coverage.';
}

function hasRepairActions(repairPlan: Pick<AgentRepairPlan, 'missingIntegrations' | 'missingFixtures' | 'coverageGaps' | 'failingScenarios'>): boolean {
  return (
    repairPlan.missingIntegrations.length > 0 ||
    repairPlan.missingFixtures.length > 0 ||
    repairPlan.coverageGaps.length > 0 ||
    repairPlan.failingScenarios.length > 0
  );
}

function deriveRepairDisposition(status: AgentIntegrityStatus, hasActions: boolean): RepairDisposition {
  if (hasActions) return 'repair_required';
  if (status === 'ready_to_promote') return 'no_repair_required';
  return 'validation_recommended';
}

function dispositionLabel(disposition: RepairDisposition): string {
  switch (disposition) {
    case 'repair_required': return 'Repair required';
    case 'validation_recommended': return 'Validation recommended';
    case 'no_repair_required': return 'No repair required';
  }
}

function buildImplementationTasks(repairPlan: AgentRepairPlan): string[] {
  const tasks: string[] = [];
  for (const item of repairPlan.missingIntegrations) {
    tasks.push(`[ ] Wire "${item.integration}" through a sandbox propose-action adapter (severity: ${item.severity})`);
  }
  for (const item of repairPlan.missingFixtures) {
    tasks.push(`[ ] Create fixture for "${item.fixture}" — ${item.recommendedFixture.split('.')[0]}`);
  }
  for (const item of repairPlan.coverageGaps) {
    tasks.push(`[ ] Add scenario covering "${item.capability}" (risk: ${item.riskLevel})`);
  }
  for (const item of repairPlan.failingScenarios) {
    const f1Str = typeof item.f1 === 'number' ? ` — current F1 ${item.f1.toFixed(2)}` : '';
    tasks.push(`[ ] Debug and fix failing scenario: "${item.title}"${f1Str}`);
  }
  return tasks;
}

function buildRepairPrompt(agent: AgentMeta, status: AgentIntegrityStatus, repairPlan: AgentRepairPlan): string {
  const list = (items: string[], empty: string) => (items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : `- ${empty}`);
  const checkbox = (items: string[], empty: string) => (items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : `- ${empty}`);

  const implementationTasks = buildImplementationTasks(repairPlan);

  const lines = [
    `# Agent Doctor Plan: ${agent.name} (${agent.id})`,
    '',
    `Agent name: ${agent.name}`,
    `Agent category: ${agent.category}`,
    `Integrity status: ${integrityStatusLabel(status)}`,
    `Repair status: ${dispositionLabel(repairPlan.disposition)}`,
    '',
    'Root cause summary:',
    repairPlan.rootCauseSummary,
    '',
    'Failing scenarios:',
    list(
      repairPlan.failingScenarios.map((scenario) => `${scenario.title}${typeof scenario.f1 === 'number' ? ` (F1 ${scenario.f1.toFixed(2)})` : ''}`),
      'No failing scenarios',
    ),
    '',
    'Missing integrations:',
    list(repairPlan.missingIntegrations.map((item) => `${item.integration}: ${item.recommendedFix}`), 'No missing integrations'),
    '',
    'Missing fixtures:',
    list(repairPlan.missingFixtures.map((item) => `${item.fixture}: ${item.recommendedFixture}`), 'No missing fixtures'),
    '',
    'Missing scenario coverage:',
    list(repairPlan.coverageGaps.map((item) => `${item.capability} (risk: ${item.riskLevel}): ${item.recommendedScenario}`), 'No coverage gaps'),
  ];

  if (repairPlan.recommendedImplementation) {
    lines.push(
      '',
      'Recommended implementation:',
      repairPlan.recommendedImplementation,
    );
  }

  lines.push('', 'Likely affected files:', list(repairPlan.likelyAffectedFiles, 'No files need changes'));

  if (implementationTasks.length > 0) {
    lines.push('', 'Implementation tasks:', checkbox(implementationTasks, 'No tasks'));
  }

  if (repairPlan.validationRecommendation) {
    lines.push('', 'Optional validation:', repairPlan.validationRecommendation);
  }

  lines.push(
    '',
    'Expected outcome:',
    repairPlan.expectedOutcome,
    '',
    'Verification checklist:',
    '- [ ] All outbound integrations route through propose-action only — no live sends',
    '- [ ] All required fixtures are seeded with environment=sandbox tags',
    '- [ ] Agent produces expected action types for all scenarios',
    '- [ ] No production API keys are called in sandbox mode',
    '- [ ] Full scenario pack passes before promotion',
    '- [ ] Sandbox mock connectors verified for: email, Stripe, notifications',
    '',
    'Constraints:',
    '- Keep this read-only and derived unless explicitly asked otherwise.',
    '- Do not dispatch real emails, messages, invoices, calendar events, Stripe writes, or external API calls.',
    '- Use sandbox adapters, mock connectors, fixtures, and propose-action/proposed actions only.',
  );

  return lines.join('\n');
}

function buildRepairPlan(params: {
  agent: AgentMeta;
  status: AgentIntegrityStatus;
  capability: string;
  recommendation: string;
  dataSources: IntegrityRequirement[];
  integrations: IntegrityRequirement[];
  sandboxFixtures: IntegrityRequirement[];
  scenarioCoverage: IntegrityRequirement[];
  spec: AgentSpec | null;
  health?: HealthData;
}): { repairPlan: AgentRepairPlan; recommendedConnections: RecommendedConnection[]; repairPromptPreview: string } {
  const failing = failingScenariosForAgent(params.health, params.agent.id);
  const rootCauses = rootCausesForAgent(params.health, params.agent.id);
  const totalScenarios = latestBatchForAgent(params.health, params.agent.id)?.scenario_count ?? scenarioTemplatesForAgent(params.agent.id).length;
  const passedScenarios = derivePassedScenarioCount(params.health, params.agent.id, totalScenarios, failing.length);
  const missingIntegrations = buildMissingIntegrationRepairs(params.agent, params.capability, params.integrations, params.spec);
  const missingFixtures = buildMissingFixtureRepairs(params.agent, params.sandboxFixtures, params.dataSources);
  const coverageGaps = buildCoverageGaps(params.agent, params.spec, params.scenarioCoverage, failing.length);
  const rootCauseSummary = buildRootCauseSummary(params.status, missingIntegrations, missingFixtures, coverageGaps, rootCauses);
  const hasActions = hasRepairActions({
    missingIntegrations,
    missingFixtures,
    coverageGaps,
    failingScenarios: failing,
  }) || rootCauses.length > 0;
  const disposition = deriveRepairDisposition(params.status, hasActions);
  const recommendedImplementation = disposition === 'repair_required' ? params.recommendation : '';
  const likelyAffectedFiles = disposition === 'repair_required' ? likelyFilesForAgent(params.agent) : [];
  const validationRecommendation =
    disposition === 'validation_recommended'
      ? params.recommendation
      : disposition === 'no_repair_required'
        ? 'Optional validation only: rerun the existing sandbox scenarios before promotion if the operator wants a fresh confidence check.'
        : null;
  const expectedOutcome =
    disposition === 'repair_required'
      ? `${params.agent.name} can be retested with sandbox-only fixtures and promoted only after missing requirements and failing scenarios are resolved.`
      : disposition === 'validation_recommended'
        ? `${params.agent.name} has no concrete repair action, but should be validated before promotion.`
        : `${params.agent.name} has no repair required.`;

  const repairPlan: AgentRepairPlan = {
    disposition,
    summary: dispositionLabel(disposition),
    rootCauseSummary,
    totalScenarios,
    passedScenarios,
    failingScenarios: failing.map((scenario) => ({
      title: scenario.title,
      category: scenario.category,
      f1: scenario.f1,
    })),
    missingIntegrations,
    missingFixtures,
    coverageGaps,
    recommendedImplementation,
    validationRecommendation,
    likelyAffectedFiles,
    expectedOutcome,
  };

  return {
    repairPlan,
    recommendedConnections: buildRecommendedConnections(params.agent, params.capability, missingIntegrations, missingFixtures),
    repairPromptPreview: buildRepairPrompt(params.agent, params.status, repairPlan),
  };
}

// ── Main derivation ────────────────────────────────────────────────────────

export function deriveIntegrityReport(agent: AgentMeta, health?: HealthData): AgentIntegrityReport {
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
    const { repairPlan, recommendedConnections, repairPromptPreview } = buildRepairPlan({
      agent,
      status: integrityStatus,
      capability,
      recommendation,
      dataSources,
      integrations,
      sandboxFixtures,
      scenarioCoverage,
      spec: null,
      health,
    });

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
      generateFixPrompt: repairPromptPreview,
      repairPlan,
      recommendedConnections,
      repairPromptPreview,
      integrationDetails: buildIntegrationDetails(integrations, null),
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
  const { repairPlan, recommendedConnections, repairPromptPreview } = buildRepairPlan({
    agent,
    status: integrityStatus,
    capability: spec.capability,
    recommendation: spec.recommendation,
    dataSources,
    integrations,
    sandboxFixtures,
    scenarioCoverage,
    spec,
    health,
  });

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
    generateFixPrompt: repairPromptPreview,
    repairPlan,
    recommendedConnections,
    repairPromptPreview,
    integrationDetails: buildIntegrationDetails(integrations, spec),
  };
}

export function deriveFleetIntegrityReports(agents: AgentMeta[], health?: HealthData): AgentIntegrityReport[] {
  return agents.map((agent) => deriveIntegrityReport(agent, health));
}

function priorityForQueueItem(report: AgentIntegrityReport): RepairPriority {
  if (report.repairPlan.disposition !== 'repair_required') return 'low';
  if (report.integrityStatus === 'unsafe_to_promote') return 'critical';
  if (report.integrityStatus === 'missing_integration') return 'high';
  if (report.repairPlan.failingScenarios.length > 0) return 'high';
  if (report.integrityStatus === 'missing_data') return 'medium';
  if (report.integrityStatus === 'ready_to_test') return 'low';
  return 'low';
}

export function deriveFleetRepairQueue(reports: AgentIntegrityReport[]): FleetRepairQueueItem[] {
  return reports
    .map((report) => {
      const priority = priorityForQueueItem(report);
      const rootCauseSeverity = Math.max(
        ...report.repairPlan.missingIntegrations.map((item) => severityWeight(priorityForSeverity(item.severity))),
        ...report.repairPlan.coverageGaps.map((item) => severityWeight(item.riskLevel === 'critical' ? 'critical' : item.riskLevel === 'high' ? 'high' : item.riskLevel === 'medium' ? 'medium' : 'low')),
        0,
      );
      const promotionImpact =
        report.integrityStatus === 'unsafe_to_promote' ? 100 :
        report.integrityStatus === 'missing_integration' ? 80 :
        report.integrityStatus === 'missing_data' ? 60 :
        report.integrityStatus === 'ready_to_test' ? 25 :
        0;
      const failingScenarioCount = report.repairPlan.failingScenarios.length;
      const integrityScoreImpact = Math.max(0, 100 - report.integrityScore);
      const rankScore = promotionImpact + rootCauseSeverity + failingScenarioCount * 15 + integrityScoreImpact;
      const primaryAction =
        report.repairPlan.missingIntegrations[0]?.recommendedFix ??
        report.repairPlan.missingFixtures[0]?.recommendedFixture ??
        report.repairPlan.coverageGaps[0]?.recommendedScenario ??
        report.repairPlan.recommendedImplementation;

      return {
        agentId: report.agentId,
        agentName: report.agentName,
        integrityStatus: report.integrityStatus,
        priority,
        rankScore,
        promotionImpact,
        rootCauseSeverity,
        failingScenarioCount,
        integrityScoreImpact,
        primaryAction,
      };
    })
    .filter((item) => {
      const report = reports.find((row) => row.agentId === item.agentId);
      return item.rankScore > 0 && report?.repairPlan.disposition === 'repair_required';
    })
    .sort((a, b) => b.rankScore - a.rankScore);
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

export function shouldShowSyntheticPreview(report: AgentIntegrityReport): boolean {
  return (
    report.integrityStatus === 'missing_data' ||
    report.repairPlan.missingFixtures.length > 0 ||
    report.repairPlan.coverageGaps.length > 0
  );
}
