// Pure synthetic fixture generator — no DB writes, no external calls.
// All records include environment: 'sandbox'. Generation is deterministic given seed.

// ── Types ─────────────────────────────────────────────────────────────────

export type SyntheticGeneratorKind =
  | 'customer'
  | 'quote'
  | 'message_thread'
  | 'ndis'
  | 'finance'
  | 'scheduling';

export type SyntheticRecord = Record<string, unknown> & {
  environment: 'sandbox';
  id: string;
};

export type SyntheticFixturePreview = {
  environment: 'sandbox';
  generatedAt: string;
  agentId: string;
  agentName: string;
  fixtureKind: SyntheticGeneratorKind;
  category: string;
  riskCovered: string;
  records: SyntheticRecord[];
  proposedTestInputs: string[];
  expectedActionTypes: string[];
  note: string;
};

// ── PRNG ──────────────────────────────────────────────────────────────────
// LCG: deterministic, no external deps. Same seed → same output.

function createPRNG(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function seedFromString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (((hash << 5) + hash) ^ str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function toId(prefix: string, rng: () => number): string {
  return `${prefix}_${Math.floor(rng() * 0xffffff).toString(16).padStart(6, '0')}`;
}

// ── Static domain data ────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Amelia', 'Oliver', 'Charlotte', 'Noah', 'Isla', 'Jack', 'Mia', 'Liam',
  'Sophia', 'William', 'Grace', 'James', 'Chloe', 'Henry', 'Ella',
  'Thomas', 'Ava', 'Ethan', 'Emily', 'Lucas',
] as const;

const LAST_NAMES = [
  'Smith', 'Jones', 'Williams', 'Brown', 'Taylor', 'Johnson', 'Martin',
  'Wilson', 'Anderson', 'Thompson', 'Davis', 'White', 'Harris', 'Lewis', 'Clark',
] as const;

const SUBURBS = [
  'Logan Central', 'Beenleigh', 'Browns Plains', 'Springwood', 'Woodridge',
  'Slacks Creek', 'Underwood', 'Capalaba', 'Sunnybank', 'Moorooka',
  'Acacia Ridge', 'Inala', 'Richlands', 'Rocklea', 'Darra',
  'Kenmore', 'Indooroopilly', 'Toowong', 'Taringa', 'Auchenflower',
] as const;

const SERVICES = [
  'Residential Cleaning', 'End of Lease Clean', 'Deep Clean',
  'Window Cleaning', 'Yard Maintenance', 'Gutter Clean',
  'Car Detailing', 'Dump Run', 'Laundry',
] as const;

const CREW_NAMES = [
  'Sam Chen', 'Priya Rajan', 'Marcus Webb', 'Keiko Tanaka',
  'Tyler Brock', 'Layla Hassan', 'Connor Reid', 'Jasmine Park',
] as const;

const NDIS_SUPPORT_TYPES = [
  'Community Access', 'Domestic Assistance', 'Personal Care',
  'Transport', 'Social Support', 'Capacity Building',
] as const;

const NDIS_PLAN_MANAGERS = ['Self-managed', 'Plan-managed', 'NDIA-managed'] as const;

const COMPLAINTS = [
  'The crew was 30 minutes late and left without cleaning the bathrooms.',
  "I'm very unhappy with the quality of yesterday's clean — dust still on shelves.",
  'My window cleaning was done incorrectly, streaks everywhere.',
  'The yard crew left clippings all over my driveway.',
  'I need this issue escalated to a manager immediately.',
] as const;

const EXPENSE_CATEGORIES = [
  'fuel', 'supplies', 'equipment', 'insurance', 'wages',
] as const;

// Fixed epoch for deterministic generatedAt
const SANDBOX_EPOCH = '2026-01-01T00:00:00.000Z';

function sandboxDate(offsetDays: number): string {
  const d = new Date(SANDBOX_EPOCH);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// ── Individual generators ─────────────────────────────────────────────────

export function generateCustomerProfile(seed: number): SyntheticRecord {
  const rng = createPRNG(seed);
  const firstName = pick(FIRST_NAMES, rng);
  const lastName = pick(LAST_NAMES, rng);
  const suburb = pick(SUBURBS, rng);
  const serviceCount = randInt(rng, 1, 5);
  const lastOrderDays = randInt(rng, 60, 200);

  return {
    environment: 'sandbox',
    id: toId('sbx_cust', rng),
    type: 'customer',
    name: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@sandbox.example.com`,
    phone: `+6140${randInt(rng, 1000000, 9999999)}`,
    suburb,
    state: 'QLD',
    serviceHistory: Array.from({ length: serviceCount }, (_, i) => ({
      service: pick(SERVICES, rng),
      date: sandboxDate(-(lastOrderDays + i * randInt(rng, 14, 60))),
      amountCents: randInt(rng, 8000, 45000),
      status: 'completed',
    })),
    lastOrderAt: sandboxDate(-lastOrderDays),
    lapseDays: lastOrderDays,
    totalSpendCents: randInt(rng, 15000, 320000),
    unsubscribed: rng() < 0.1,
    tags: ['sandbox'],
  };
}

export function generateQuoteScenario(seed: number): SyntheticRecord {
  const rng = createPRNG(seed);
  const serviceType = pick(SERVICES, rng);
  const urgent = rng() < 0.25;
  const inArea = rng() > 0.1;

  return {
    environment: 'sandbox',
    id: toId('sbx_quote', rng),
    type: 'quote',
    serviceType,
    suburb: inArea ? pick(SUBURBS, rng) : 'Fortitude Valley',
    postcode: inArea ? '4114' : '4006',
    inServiceArea: inArea,
    urgent,
    requestedDate: urgent ? sandboxDate(0) : sandboxDate(randInt(rng, 2, 14)),
    totalCents: randInt(rng, 8000, 45000),
    bedrooms: randInt(rng, 1, 5),
    bathrooms: randInt(rng, 1, 3),
    status: 'submitted',
    notes: urgent ? 'URGENT: End of lease today, need same-day service.' : '',
    tags: ['sandbox'],
  };
}

export function generateMessageThread(seed: number): SyntheticRecord {
  const rng = createPRNG(seed);
  const messageCount = randInt(rng, 2, 4);

  return {
    environment: 'sandbox',
    id: toId('sbx_thread', rng),
    type: 'message_thread',
    customerId: toId('sbx_cust', rng),
    channel: pick(['email', 'sms'] as const, rng),
    messages: Array.from({ length: messageCount }, (_, i) => ({
      direction: i % 2 === 0 ? 'inbound' : 'outbound',
      body: i === 0 ? pick(COMPLAINTS, rng) : i % 2 === 0 ? 'This is still not resolved.' : 'Thank you for getting in touch, we are looking into this.',
      sentAt: sandboxDate(-(messageCount - i)),
    })),
    escalationRequired: rng() > 0.5,
    tags: ['sandbox'],
  };
}

export function generateNDISFixture(seed: number): SyntheticRecord {
  const rng = createPRNG(seed);
  const firstName = pick(FIRST_NAMES, rng);
  const lastName = pick(LAST_NAMES, rng);
  const wwccOffsetDays = randInt(rng, -30, 90);
  const planEndDays = randInt(rng, 5, 180);
  const support1 = pick(NDIS_SUPPORT_TYPES, rng);
  const support2 = pick(NDIS_SUPPORT_TYPES, rng);

  return {
    environment: 'sandbox',
    id: toId('sbx_ndis', rng),
    type: 'ndis_participant',
    participantName: `${firstName} ${lastName}`,
    participantId: toId('sbx_part', rng),
    supportTypes: Array.from(new Set([support1, support2])),
    planManager: pick(NDIS_PLAN_MANAGERS, rng),
    fundingCents: randInt(rng, 500000, 5000000),
    wwccExpiry: sandboxDate(wwccOffsetDays),
    wwccExpired: wwccOffsetDays < 0,
    serviceAgreementEnd: sandboxDate(planEndDays),
    serviceAgreementExpiringSoon: planEndDays < 14,
    incidentPending: rng() < 0.15,
    screened: rng() > 0.2,
    crewAssigned: toId('sbx_crew', rng),
    tags: ['sandbox'],
  };
}

export function generateFinanceFixtures(seed: number): SyntheticRecord[] {
  const rng = createPRNG(seed);
  const invoiceCount = randInt(rng, 3, 6);

  const invoices: SyntheticRecord[] = Array.from({ length: invoiceCount }, () => ({
    environment: 'sandbox' as const,
    id: toId('sbx_inv', rng),
    type: 'invoice',
    amountCents: randInt(rng, 8000, 45000),
    status: pick(['paid', 'overdue', 'pending'] as const, rng),
    dueDate: sandboxDate(randInt(rng, -30, 30)),
    customerName: `${pick(FIRST_NAMES, rng)} ${pick(LAST_NAMES, rng)}`,
    serviceType: pick(SERVICES, rng),
    tags: ['sandbox'],
  }));

  const expenses: SyntheticRecord[] = Array.from({ length: randInt(rng, 2, 4) }, () => ({
    environment: 'sandbox' as const,
    id: toId('sbx_exp', rng),
    type: 'expense',
    category: pick(EXPENSE_CATEGORIES, rng),
    amountCents: randInt(rng, 2000, 50000),
    date: sandboxDate(-randInt(rng, 1, 30)),
    tags: ['sandbox'],
  }));

  const paidTotal = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.amountCents as number), 0);

  const payout: SyntheticRecord = {
    environment: 'sandbox',
    id: toId('sbx_pay', rng),
    type: 'stripe_payout',
    amountCents: paidTotal || randInt(rng, 20000, 120000),
    arrivalDate: sandboxDate(-randInt(rng, 1, 7)),
    status: 'paid',
    tags: ['sandbox'],
  };

  return [...invoices, ...expenses, payout];
}

export function generateSchedulingFixtures(seed: number): SyntheticRecord[] {
  const rng = createPRNG(seed);
  const crewCount = randInt(rng, 2, 4);

  const crew: SyntheticRecord[] = Array.from({ length: crewCount }, () => ({
    environment: 'sandbox' as const,
    id: toId('sbx_crew', rng),
    type: 'crew_member',
    name: pick(CREW_NAMES, rng),
    available: rng() > 0.2,
    qualifications: ['general_cleaning', ...(rng() > 0.5 ? ['ndis_support'] : [])],
    shiftStart: `0${randInt(rng, 7, 9)}:00`,
    shiftEnd: `${randInt(rng, 15, 17)}:00`,
    suburb: pick(SUBURBS, rng),
    tags: ['sandbox'],
  }));

  const jobs: SyntheticRecord[] = Array.from({ length: randInt(rng, 2, 5) }, () => ({
    environment: 'sandbox' as const,
    id: toId('sbx_job', rng),
    type: 'job',
    serviceType: pick(SERVICES, rng),
    suburb: pick(SUBURBS, rng),
    durationMins: randInt(rng, 60, 240),
    scheduledDate: sandboxDate(randInt(rng, 1, 7)),
    assignedCrew: null,
    priority: pick(['standard', 'urgent'] as const, rng),
    tags: ['sandbox'],
  }));

  return [...crew, ...jobs];
}

// ── Routing ───────────────────────────────────────────────────────────────

function generatorKindForAgent(agentId: string): SyntheticGeneratorKind {
  const lower = agentId.toLowerCase();
  if (lower.includes('ndis')) return 'ndis';
  if (
    lower.includes('finance') || lower.includes('cfo') || lower.includes('cash') ||
    lower.includes('reconcil') || lower.includes('dispute') || lower.includes('stripe')
  ) return 'finance';
  if (
    lower.includes('schedul') || lower.includes('crew') ||
    lower.includes('whs') || lower.includes('briefing') || lower.includes('photo')
  ) return 'scheduling';
  if (lower.includes('quote') || lower.includes('triage')) return 'quote';
  if (lower.includes('message') || lower.includes('phone') || lower.includes('transcrib')) return 'message_thread';
  // Default: customer profile + message thread for support/sales agents
  return 'customer';
}

// ── Agent metadata ────────────────────────────────────────────────────────

type AgentMeta = {
  category: string;
  riskCovered: string;
  proposedTestInputs: string[];
  expectedActionTypes: string[];
};

const AGENT_META: Record<string, AgentMeta> = {
  'customer-reply': {
    category: 'support',
    riskCovered: 'Poorly-worded replies or missed escalation paths causing customer churn',
    proposedTestInputs: [
      'Complaint: cleaning quality below standard',
      'Request: same-day rebook after crew no-show',
      'Escalation trigger: abusive or distressed customer message',
    ],
    expectedActionTypes: ['send_email', 'flag_for_review', 'escalate_to_human'],
  },
  'quote-triage': {
    category: 'customer',
    riskCovered: 'Misrouted high-value quotes or silently dropped urgent requests causing revenue loss',
    proposedTestInputs: [
      'Residential cleaning 3BR Logan Central standard request',
      'Same-day urgent end-of-lease Beenleigh',
      'Out-of-service-area postcode 4000 submission',
    ],
    expectedActionTypes: ['assign_priority', 'route_to_crew', 'flag_out_of_area', 'notify_admin'],
  },
  'lapsed-win-back': {
    category: 'customer',
    riskCovered: 'Emailing unsubscribed customers or missing 60-180 day lapse thresholds',
    proposedTestInputs: [
      'Customer lapsed 65 days — standard win-back',
      'Customer lapsed 120 days (high value — priority)',
      'Customer on suppression list — must be skipped',
    ],
    expectedActionTypes: ['send_email', 'skip_suppressed', 'log_winback_attempt'],
  },
  'reviews': {
    category: 'customer',
    riskCovered: 'Aggressive review requests or poorly-worded public responses damaging brand',
    proposedTestInputs: [
      'Completed job with satisfied customer — prompt for review',
      '1-star Google review requiring on-brand response',
    ],
    expectedActionTypes: ['send_review_request', 'draft_response', 'flag_for_approval'],
  },
  'lead-scorer': {
    category: 'marketplace',
    riskCovered: 'Misclassified leads wasting crew follow-up time or missing high-value opportunities',
    proposedTestInputs: [
      'High-quality lead: in-area, specific service, clear intent',
      'Low-quality lead: vague, out-of-area, no contact details',
    ],
    expectedActionTypes: ['score_lead', 'assign_priority', 'flag_low_quality'],
  },
  'ndis-compliance': {
    category: 'ndis',
    riskCovered: 'Unscreened workers with vulnerable participants or missed mandatory notifications',
    proposedTestInputs: [
      'Participant with expired WWCC — must block assignment',
      'Service agreement expiring in 7 days — flag renewal',
      'Mandatory incident requiring NDIS Commission notification',
    ],
    expectedActionTypes: ['flag_compliance_risk', 'propose_notification', 'block_assignment'],
  },
  'ndis-plan-matcher': {
    category: 'ndis',
    riskCovered: 'Incorrect participant-crew matches placing unqualified workers with vulnerable participants',
    proposedTestInputs: [
      'Participant requires personal care — match qualified crew',
      'No qualified crew available — flag no-match',
      'Crew with matching NDIS qualifications — propose match',
    ],
    expectedActionTypes: ['propose_match', 'flag_no_match', 'require_override'],
  },
  'scheduling': {
    category: 'ops',
    riskCovered: 'Double-bookings, unassigned jobs, or unqualified crew assigned to NDIS shifts',
    proposedTestInputs: [
      'Crew schedule with gaps and conflicts',
      'High-volume day with 8+ concurrent jobs',
      'No-show crew requiring same-day reassignment',
    ],
    expectedActionTypes: ['assign_crew', 'flag_conflict', 'propose_reassignment'],
  },
  'crew-briefing': {
    category: 'ops',
    riskCovered: 'Incomplete briefings leaving crew unprepared for special requirements or NDIS protocols',
    proposedTestInputs: [
      'Job with special customer requirements (pets, access codes)',
      'NDIS shift requiring specific briefing protocol',
    ],
    expectedActionTypes: ['send_briefing', 'flag_special_requirements', 'propose_action'],
  },
  'photo-qa': {
    category: 'ops',
    riskCovered: 'False positives unfairly penalising crew or false negatives allowing quality issues to reach customers',
    proposedTestInputs: [
      'Before/after set with clear quality issue — must flag',
      'Clean before/after set (control) — must not flag',
    ],
    expectedActionTypes: ['flag_quality_issue', 'approve_job', 'request_redo'],
  },
  'whs-safety-reminder': {
    category: 'ops',
    riskCovered: 'Missed WHS notifications creating workplace safety liability or unwarranted authority notifications',
    proposedTestInputs: [
      'Upcoming chemical-handling shift — trigger pre-shift reminder',
      'Crew injury incident requiring mandatory notification',
    ],
    expectedActionTypes: ['send_reminder', 'log_incident', 'propose_notification'],
  },
  'cfo-agent': {
    category: 'finance',
    riskCovered: 'Incorrect cash flow forecasts triggering unnecessary escalation or missing real shortfalls',
    proposedTestInputs: [
      'Overdue receivables batch (5+ invoices)',
      '30-day income/expense forecast with payment gaps',
      'Expense spike scenario impacting payroll week',
    ],
    expectedActionTypes: ['flag_cash_risk', 'propose_payment_priority', 'generate_report'],
  },
  'cash-flow-forecaster': {
    category: 'finance',
    riskCovered: 'Inaccurate 30-day forecasts causing premature payment escalation',
    proposedTestInputs: [
      '30-day invoice fixture with realistic payment gaps',
      'Recurring expense configuration with known outcome',
      'Stripe payout delay scenario affecting cash position',
    ],
    expectedActionTypes: ['generate_forecast', 'flag_shortfall', 'propose_action'],
  },
  'reconciliation': {
    category: 'finance',
    riskCovered: 'Undetected revenue discrepancies causing leakage or false dispute flags',
    proposedTestInputs: [
      'Payout batch where all jobs are matched — no flag expected',
      'Discrepancy: missing payout for completed job — must flag',
    ],
    expectedActionTypes: ['flag_discrepancy', 'mark_reconciled', 'propose_investigation'],
  },
  'stripe-dispute-manager': {
    category: 'finance',
    riskCovered: 'Incorrect dispute responses causing direct financial loss from lost chargebacks',
    proposedTestInputs: [
      'Dispute with strong evidence (completed and documented job)',
      'Dispute with weak evidence (no-show scenario)',
    ],
    expectedActionTypes: ['assemble_evidence', 'propose_dispute_response', 'flag_for_review'],
  },
  'applicant-screener': {
    category: 'ops',
    riskCovered: 'Incorrect applicant screening creating discrimination liability or allowing unscreened workers',
    proposedTestInputs: [
      'Strong applicant with all credentials present — should pass',
      'Applicant missing NDIS clearance — must flag',
    ],
    expectedActionTypes: ['pass_applicant', 'flag_missing_clearance', 'reject_applicant'],
  },
  'internal-qa': {
    category: 'ops',
    riskCovered: 'Undetected hallucinations propagating to downstream agents acting on bad data',
    proposedTestInputs: [
      'Agent run output with known hallucinated customer ID',
      'Clean agent run output — must not flag (control)',
    ],
    expectedActionTypes: ['flag_hallucination', 'approve_output', 'quarantine_run'],
  },
};

function metaForAgent(agentId: string, agentName: string): AgentMeta {
  if (AGENT_META[agentId]) return AGENT_META[agentId];

  const lower = agentId.toLowerCase();
  if (lower.includes('ndis')) return AGENT_META['ndis-compliance'];
  if (lower.includes('finance') || lower.includes('cfo') || lower.includes('cash'))
    return AGENT_META['cfo-agent'];
  if (lower.includes('schedul') || lower.includes('crew'))
    return AGENT_META['scheduling'];
  if (lower.includes('customer') || lower.includes('reply') || lower.includes('lapsed'))
    return AGENT_META['customer-reply'];
  if (lower.includes('quote') || lower.includes('triage'))
    return AGENT_META['quote-triage'];

  return {
    category: 'ops',
    riskCovered: `Unvalidated behavior for ${agentName} before production promotion`,
    proposedTestInputs: [
      `Standard ${agentName} input with realistic data`,
      `Edge case: empty or missing data`,
      `Stress: high-volume input batch`,
    ],
    expectedActionTypes: ['propose_action', 'flag_for_review'],
  };
}

// ── Main entry point ──────────────────────────────────────────────────────

export function generateSyntheticPreview(
  agentId: string,
  agentName: string,
  seed?: number,
): SyntheticFixturePreview {
  const resolvedSeed = seed ?? seedFromString(agentId);
  const kind = generatorKindForAgent(agentId);
  const meta = metaForAgent(agentId, agentName);

  let records: SyntheticRecord[];

  switch (kind) {
    case 'ndis':
      records = [generateNDISFixture(resolvedSeed)];
      break;
    case 'finance':
      records = generateFinanceFixtures(resolvedSeed);
      break;
    case 'scheduling':
      records = generateSchedulingFixtures(resolvedSeed);
      break;
    case 'quote':
      records = [
        generateCustomerProfile(resolvedSeed),
        generateQuoteScenario(resolvedSeed + 1),
      ];
      break;
    case 'message_thread':
      records = [
        generateCustomerProfile(resolvedSeed),
        generateMessageThread(resolvedSeed + 1),
      ];
      break;
    case 'customer':
    default:
      records = [
        generateCustomerProfile(resolvedSeed),
        generateMessageThread(resolvedSeed + 1),
      ];
      break;
  }

  return {
    environment: 'sandbox',
    generatedAt: SANDBOX_EPOCH,
    agentId,
    agentName,
    fixtureKind: kind,
    category: meta.category,
    riskCovered: meta.riskCovered,
    records,
    proposedTestInputs: meta.proposedTestInputs,
    expectedActionTypes: meta.expectedActionTypes,
    note: 'Preview only — no DB writes. Save fixture coming later.',
  };
}
