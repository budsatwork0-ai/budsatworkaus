/**
 * Sandbox scenario templates — TypeScript mirror of the DB seed rows.
 *
 * These are used by the arena to look up scenarios without a DB round-trip,
 * and by the UI to render the scenario catalogue.
 */

export type ScenarioCategory =
  | 'customer'
  | 'participant'
  | 'marketplace'
  | 'ndis'
  | 'ops'
  | 'growth'
  | 'finance';

export type ScenarioDifficulty = 'easy' | 'medium' | 'hard';

export interface SandboxScenarioTemplate {
  slug: string;
  title: string;
  category: ScenarioCategory;
  description: string;
  agentId: string;
  input: Record<string, unknown>;
  expectedActionTypes: string[];
  difficulty: ScenarioDifficulty;
  tags: string[];
}

export const SANDBOX_SCENARIOS: SandboxScenarioTemplate[] = [
  // ── CUSTOMER ─────────────────────────────────────────────────────────────
  {
    slug: 'customer-new-quote-cleaning',
    title: 'New quote request — cleaning',
    category: 'customer',
    description: 'A new residential customer in Underwood submits a quote for a standard clean.',
    agentId: 'quote-triage',
    input: { service: 'cleaning', suburb: 'Underwood', bedrooms: 3, bathrooms: 2, extras: [], message: 'Hi, I need a regular house clean please.' },
    expectedActionTypes: ['send_email'],
    difficulty: 'easy',
    tags: ['quote', 'cleaning'],
  },
  {
    slug: 'customer-new-quote-windows',
    title: 'New quote request — window cleaning',
    category: 'customer',
    description: 'Two-storey home in Sunnybank Hills requests interior + exterior window clean.',
    agentId: 'quote-triage',
    input: { service: 'windows', suburb: 'Sunnybank Hills', storeys: 2, message: 'Need inside and outside windows done ASAP.' },
    expectedActionTypes: ['send_email'],
    difficulty: 'easy',
    tags: ['quote', 'windows'],
  },
  {
    slug: 'customer-new-quote-yard',
    title: 'New quote request — yard care',
    category: 'customer',
    description: 'Lawn mowing and edging for a large block in Loganlea.',
    agentId: 'quote-triage',
    input: { service: 'lawn-mowing', suburb: 'Loganlea', area_m2: 600, message: 'Big backyard, needs mowing and edging.' },
    expectedActionTypes: ['send_email'],
    difficulty: 'easy',
    tags: ['quote', 'yard'],
  },
  {
    slug: 'customer-lapsed-60-days',
    title: 'Lapsed customer — 60 days silent',
    category: 'customer',
    description: 'A previous cleaning customer has not booked in 60 days. Win-back campaign.',
    agentId: 'lapsed-win-back',
    input: { days_since_last_job: 60, service: 'cleaning', customer_name: 'Sophie Harris' },
    expectedActionTypes: ['send_email'],
    difficulty: 'medium',
    tags: ['lapsed', 'win-back'],
  },
  {
    slug: 'customer-complaint-late-job',
    title: 'Complaint — late arrival',
    category: 'customer',
    description: 'Customer complains crew arrived 90 minutes late without notice.',
    agentId: 'customer-reply',
    input: { complaint: 'Your cleaner arrived 90 minutes late and I was not told. Very unhappy.', customer_name: 'Noah Cooper' },
    expectedActionTypes: ['send_email', 'flag_for_review'],
    difficulty: 'medium',
    tags: ['complaint', 'support'],
  },
  {
    slug: 'customer-complaint-quality',
    title: 'Complaint — cleaning quality',
    category: 'customer',
    description: 'Customer unhappy with the standard of a recent end-of-lease clean.',
    agentId: 'customer-reply',
    input: { complaint: 'The end-of-lease clean was not up to standard. Oven was not cleaned.', customer_name: 'Ava Singh' },
    expectedActionTypes: ['send_email', 'flag_for_review'],
    difficulty: 'medium',
    tags: ['complaint', 'quality'],
  },
  {
    slug: 'customer-5-star-review-prompt',
    title: 'Review prompt — satisfied customer',
    category: 'customer',
    description: 'Customer left 5-star feedback verbally. Prompt for Google review.',
    agentId: 'reviews',
    input: { sentiment: 'positive', customer_name: 'Grace Nguyen', service: 'cleaning' },
    expectedActionTypes: ['send_email'],
    difficulty: 'easy',
    tags: ['review', 'growth'],
  },
  {
    slug: 'customer-negative-review-response',
    title: 'Respond to 1-star Google review',
    category: 'customer',
    description: 'A 1-star Google review appeared overnight. Agent should draft a professional response.',
    agentId: 'reviews',
    input: { rating: 1, review_text: 'Terrible service. The cleaner did not show up.', platform: 'google' },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'hard',
    tags: ['review', 'reputation'],
  },

  // ── PARTICIPANT (NDIS) ────────────────────────────────────────────────────
  {
    slug: 'ndis-new-participant-profile',
    title: 'New NDIS participant — profile creation',
    category: 'participant',
    description: 'Admin triggers profile creation for a new NDIS support worker.',
    agentId: 'ndis-compliance',
    input: { worker_name: 'Lucas Patel', ndis_worker_screening_id: 'NWS-12345', supports: ['domestic-assistance', 'community-participation'] },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'medium',
    tags: ['ndis', 'onboarding'],
  },
  {
    slug: 'ndis-compliance-expiry',
    title: 'NDIS screening expiry warning',
    category: 'participant',
    description: 'A worker NDIS screening clearance expires in 14 days.',
    agentId: 'ndis-compliance',
    input: { worker_name: 'Ruby Wilson', expiry_days: 14, clearance_type: 'worker-screening' },
    expectedActionTypes: ['send_email', 'flag_for_review'],
    difficulty: 'medium',
    tags: ['ndis', 'compliance'],
  },
  {
    slug: 'ndis-plan-match',
    title: 'NDIS plan — job matching',
    category: 'participant',
    description: 'Match an NDIS participant to suitable open jobs based on their support plan.',
    agentId: 'ndis-plan-matcher',
    input: { participant_name: 'Mia Anderson', support_categories: ['domestic-assistance'], suburb: 'Waterford West' },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'hard',
    tags: ['ndis', 'matching'],
  },
  {
    slug: 'ndis-shift-briefing',
    title: 'Crew briefing for NDIS shift',
    category: 'participant',
    description: 'Generate a shift briefing for crew assigned to an NDIS support job.',
    agentId: 'scheduling',
    input: { job_type: 'ndis-domestic-assistance', participant_name: 'Ethan Taylor', suburb: 'Meadowbrook', shift_start: '09:00' },
    expectedActionTypes: ['send_email'],
    difficulty: 'easy',
    tags: ['ndis', 'briefing'],
  },

  // ── MARKETPLACE ───────────────────────────────────────────────────────────
  {
    slug: 'marketplace-high-volume-day',
    title: 'High-volume day — scheduling crunch',
    category: 'marketplace',
    description: '8 jobs scheduled for the same Saturday. Detect overload and flag.',
    agentId: 'scheduling',
    input: { date: '2026-06-20', job_count: 8, available_crew: 3 },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'hard',
    tags: ['scheduling', 'ops'],
  },
  {
    slug: 'marketplace-crew-no-show',
    title: 'Crew no-show — job reassignment',
    category: 'marketplace',
    description: 'Assigned crew member calls in sick 2 hours before a job.',
    agentId: 'scheduling',
    input: { job_id: 'sandbox-job-001', crew_name: 'Liam Davies', hours_before_job: 2, service: 'cleaning' },
    expectedActionTypes: ['schedule_job', 'send_email'],
    difficulty: 'hard',
    tags: ['scheduling', 'emergency'],
  },
  {
    slug: 'marketplace-price-query',
    title: 'Customer price query — competitive check',
    category: 'marketplace',
    description: 'Customer asks why our price is higher than a competitor quote.',
    agentId: 'customer-reply',
    input: { query: 'I got a quote from another company for $80 cheaper. Can you match it?', service: 'end-of-lease', our_price: 480 },
    expectedActionTypes: ['send_email'],
    difficulty: 'medium',
    tags: ['pricing', 'competitive'],
  },
  {
    slug: 'marketplace-surge-demand',
    title: 'Surge demand — spring clean season',
    category: 'marketplace',
    description: 'Spike in quote volume detected. Recommend dynamic pricing or capacity limit.',
    agentId: 'quote-triage',
    input: { quote_volume_7d: 45, capacity_utilisation: 0.92, season: 'spring' },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'medium',
    tags: ['demand', 'pricing'],
  },

  // ── NDIS / COMPLIANCE ─────────────────────────────────────────────────────
  {
    slug: 'ndis-compliance-audit',
    title: 'NDIS compliance audit — documentation check',
    category: 'ndis',
    description: 'Monthly compliance check on NDIS documentation completeness.',
    agentId: 'ndis-compliance',
    input: { check_type: 'monthly', missing_docs: ['incident-report-june', 'worker-screening-renewal'] },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'medium',
    tags: ['ndis', 'audit', 'compliance'],
  },
  {
    slug: 'ndis-incident-report',
    title: 'NDIS incident report — mandatory notification',
    category: 'ndis',
    description: 'A participant reported a near-miss injury during a support shift.',
    agentId: 'ndis-compliance',
    input: { incident_type: 'near-miss', severity: 'moderate', participant_name: 'Mia Anderson', worker_name: 'Lucas Patel' },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'hard',
    tags: ['ndis', 'incident', 'compliance'],
  },
  {
    slug: 'whs-safety-reminder',
    title: 'WHS safety reminder — chemical handling',
    category: 'ndis',
    description: 'Monthly WHS reminder for crew handling cleaning chemicals.',
    agentId: 'whs-safety-reminder',
    input: { crew_count: 6, reminder_type: 'chemical-handling', due_date: '2026-06-30' },
    expectedActionTypes: ['send_email'],
    difficulty: 'easy',
    tags: ['whs', 'safety'],
  },
  {
    slug: 'whs-incident-flag',
    title: 'WHS incident — crew injury on site',
    category: 'ndis',
    description: 'Crew member reported a slip-and-fall incident on a job site.',
    agentId: 'whs-safety-reminder',
    input: { incident_type: 'slip-fall', severity: 'minor', crew_name: 'Liam Davies', job_id: 'sandbox-job-002' },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'hard',
    tags: ['whs', 'incident'],
  },

  // ── OPS ───────────────────────────────────────────────────────────────────
  {
    slug: 'ops-late-job-detection',
    title: 'Late job detection',
    category: 'ops',
    description: 'A scheduled job is 45 minutes overdue with no status update.',
    agentId: 'scheduling',
    input: { job_id: 'sandbox-job-003', overdue_minutes: 45, service: 'windows', crew_name: 'Ruby Wilson' },
    expectedActionTypes: ['send_email', 'flag_for_review'],
    difficulty: 'medium',
    tags: ['ops', 'scheduling'],
  },
  {
    slug: 'ops-cash-flow-warning',
    title: 'Cash flow warning — receivables spike',
    category: 'ops',
    description: 'Outstanding receivables have grown 40% week-on-week.',
    agentId: 'cash-flow-forecaster',
    input: { receivables_aud: 18500, receivables_wow_change: 0.4, days_outstanding_avg: 22 },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'medium',
    tags: ['finance', 'cashflow'],
  },
  {
    slug: 'ops-stripe-dispute',
    title: 'Stripe dispute — chargeback received',
    category: 'ops',
    description: 'A customer has raised a chargeback for a $480 end-of-lease clean.',
    agentId: 'stripe-dispute-manager',
    input: { dispute_id: 'dp_sandbox_001', amount_aud: 480, service: 'end-of-lease', reason: 'service_not_as_described' },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'hard',
    tags: ['stripe', 'dispute', 'finance'],
  },
  {
    slug: 'ops-photo-qa',
    title: 'Photo QA — before/after review',
    category: 'ops',
    description: 'Crew uploaded before/after photos for a completed job. QA check.',
    agentId: 'photo-qa',
    input: { job_id: 'sandbox-job-004', service: 'cleaning', photo_count: 8 },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'medium',
    tags: ['quality', 'photos'],
  },
  {
    slug: 'ops-internal-qa',
    title: 'Internal QA — agent output review',
    category: 'ops',
    description: 'Internal QA agent reviews the output of the last 5 agent runs for quality.',
    agentId: 'internal-qa',
    input: { review_window_hours: 24, agent_runs: 5 },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'medium',
    tags: ['qa', 'agents'],
  },
  {
    slug: 'ops-reconciliation',
    title: 'Financial reconciliation — end of week',
    category: 'ops',
    description: 'Reconcile Stripe payouts against Supabase orders for the past 7 days.',
    agentId: 'reconciliation',
    input: { period_days: 7, expected_payout_aud: 4200, recorded_aud: 4080 },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'hard',
    tags: ['finance', 'reconciliation'],
  },
  {
    slug: 'ops-applicant-screener',
    title: 'Applicant screener — new crew application',
    category: 'ops',
    description: 'A new crew application submitted. Screen against Buds at Work criteria.',
    agentId: 'applicant-screener',
    input: { applicant_name: 'Jack Martin', role: 'cleaner', experience_years: 2, suburb: 'Loganlea', has_abn: true },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'easy',
    tags: ['hiring', 'crew'],
  },

  // ── GROWTH ────────────────────────────────────────────────────────────────
  {
    slug: 'growth-lead-scoring',
    title: 'Lead scoring — inbound web lead',
    category: 'growth',
    description: 'Score an inbound web lead from the public quote form.',
    agentId: 'lead-scorer',
    input: { service: 'end-of-lease', suburb: 'Springwood', message: 'Need bond clean by end of month.', source: 'website' },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'easy',
    tags: ['leads', 'growth'],
  },
  {
    slug: 'growth-seo-meta',
    title: 'SEO meta — suburb landing page',
    category: 'growth',
    description: 'Generate SEO-optimised meta title and description for a suburb landing page.',
    agentId: 'seo-meta',
    input: { page_type: 'suburb-landing', suburb: 'Underwood', service: 'cleaning' },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'easy',
    tags: ['seo', 'growth'],
  },
  {
    slug: 'growth-conversion-funnel',
    title: 'Conversion funnel analysis',
    category: 'growth',
    description: 'Analyse quote funnel drop-off and recommend optimisations.',
    agentId: 'conversion-funnel',
    input: { funnel_step_views: { step1: 520, step2: 310, step3: 180, submitted: 95 }, period_days: 30 },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'medium',
    tags: ['growth', 'conversion'],
  },
  {
    slug: 'growth-lapsed-pack',
    title: 'Lapsed customer pack — 90+ days',
    category: 'growth',
    description: 'Run win-back for a batch of customers silent for 90+ days.',
    agentId: 'lapsed-win-back',
    input: { days_since_last_job: 95, customer_count: 12, service: 'cleaning' },
    expectedActionTypes: ['send_email'],
    difficulty: 'medium',
    tags: ['growth', 'lapsed'],
  },
  {
    slug: 'growth-ab-test',
    title: 'A/B test design — CTA copy',
    category: 'growth',
    description: 'Design an A/B test for the primary CTA on the homepage.',
    agentId: 'ab-test-architect',
    input: { page: 'homepage', element: 'primary-cta', hypothesis: 'Changing CTA copy to action-oriented language increases click-through.' },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'medium',
    tags: ['growth', 'ab-test'],
  },

  // ── FINANCE ───────────────────────────────────────────────────────────────
  {
    slug: 'finance-cash-flow-forecast',
    title: 'Cash flow forecast — 30-day outlook',
    category: 'finance',
    description: 'Produce a 30-day cash flow forecast based on current pipeline and actuals.',
    agentId: 'cash-flow-forecaster',
    input: { forecast_days: 30, pipeline_aud: 12400, recurring_monthly_aud: 8200 },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'medium',
    tags: ['finance', 'forecast'],
  },
  {
    slug: 'finance-price-optimizer',
    title: 'Price optimisation — window cleaning',
    category: 'finance',
    description: 'Evaluate current window cleaning pricing against market rates and recommend adjustment.',
    agentId: 'price-optimizer',
    input: { service: 'windows', current_rate_aud: 285, market_range: { low: 220, high: 320 }, jobs_last_30d: 18 },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'hard',
    tags: ['finance', 'pricing'],
  },
  {
    slug: 'finance-stripe-reconcile',
    title: 'Stripe payout reconciliation',
    category: 'finance',
    description: 'Match last week Stripe payout against orders in Supabase.',
    agentId: 'reconciliation',
    input: { payout_id: 'po_sandbox_001', payout_aud: 5840, period: '2026-06-01/2026-06-07' },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'medium',
    tags: ['finance', 'stripe'],
  },
  {
    slug: 'finance-invoice-overdue',
    title: 'Overdue invoice — follow-up email',
    category: 'finance',
    description: 'An invoice for $960 has been outstanding for 21 days. Generate a polite follow-up.',
    agentId: 'customer-reply',
    input: { invoice_amount_aud: 960, days_overdue: 21, customer_name: 'Ethan Taylor', service: 'commercial-cleaning' },
    expectedActionTypes: ['send_email'],
    difficulty: 'medium',
    tags: ['finance', 'invoicing'],
  },
  {
    slug: 'finance-cfo-review',
    title: 'CFO weekly financial review',
    category: 'finance',
    description: 'CFO agent runs its weekly snapshot of revenue, cost, and margin.',
    agentId: 'cfo-agent',
    input: { period: 'week', revenue_aud: 14200, cost_aud: 8900, jobs_completed: 31 },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'medium',
    tags: ['finance', 'executive'],
  },
  {
    slug: 'finance-dispute-resolution',
    title: 'Dispute resolution — customer refund demand',
    category: 'finance',
    description: 'Customer demands full refund for a $480 clean citing dissatisfaction.',
    agentId: 'stripe-dispute-manager',
    input: { refund_requested_aud: 480, reason: 'dissatisfied', service: 'end-of-lease', job_completed: true },
    expectedActionTypes: ['flag_for_review'],
    difficulty: 'hard',
    tags: ['finance', 'dispute'],
  },

  // ── STRESS / MULTI-AGENT ──────────────────────────────────────────────────
  {
    slug: 'stress-agent-cascade',
    title: 'Stress test — quote + triage + scheduling cascade',
    category: 'ops',
    description: 'A high-urgency quote arrives and triggers triage, scoring, and scheduling in sequence.',
    agentId: 'quote-triage',
    input: { service: 'end-of-lease', suburb: 'Loganlea', urgency: 'high', message: 'Need bond clean tomorrow for settlement.', available_crew: ['crew-001'] },
    expectedActionTypes: ['send_email', 'schedule_job'],
    difficulty: 'hard',
    tags: ['stress', 'cascade', 'multi-agent'],
  },
];

/** Look up a template by slug. Returns undefined if not found. */
export function getScenarioTemplate(slug: string): SandboxScenarioTemplate | undefined {
  return SANDBOX_SCENARIOS.find((s) => s.slug === slug);
}

/** Return all templates for a given category. */
export function getScenariosByCategory(category: ScenarioCategory): SandboxScenarioTemplate[] {
  return SANDBOX_SCENARIOS.filter((s) => s.category === category);
}

/** Return all unique category names present in the templates. */
export function getAllCategories(): ScenarioCategory[] {
  return Array.from(new Set(SANDBOX_SCENARIOS.map((s) => s.category)));
}
