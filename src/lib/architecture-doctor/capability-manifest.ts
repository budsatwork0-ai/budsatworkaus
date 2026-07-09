import type { CapabilitySpec } from './types';

export interface CapabilityManifestEntry {
  capabilityId: string;
  domains: string[];
  filePatterns: string[];
  routePatterns: string[];
  tablePatterns: string[];
  agentPatterns: string[];
}

export interface DependencyAllowlistEntry {
  fromPattern: string;
  toPattern: string;
  reason: string;
}

export const CAPABILITY_MANIFEST: CapabilityManifestEntry[] = [
  {
    capabilityId: 'C01',
    domains: ['leads', 'contact', 'messaging'],
    filePatterns: ['src/app/api/leads/**', 'src/app/(app)/dashboard/leads/**', 'src/lib/leads/**'],
    routePatterns: ['/api/leads/**', '/dashboard/leads/**', '/contact'],
    tablePatterns: ['leads', 'lead_*', 'conversations', 'messages', 'phone_calls', 'quote_funnel_events', 'growth_pipeline_events', 'lapsed_outreach'],
    agentPatterns: ['phone-transcriber', 'customer-reply', 'quote-triage', 'lead-scorer', 'lapsed-win-back'],
  },
  {
    capabilityId: 'C02',
    domains: ['quotes', 'checkout', 'pay', 'services', 'pricing'],
    filePatterns: ['src/app/api/quotes/**', 'src/app/api/pay/**', 'src/app/(public)/services/**', 'src/lib/services-core/**', 'src/lib/payments/**'],
    routePatterns: ['/api/quotes/**', '/api/pay/**', '/services/**', '/pay/**', '/pricing', '/dashboard/quotes/**'],
    tablePatterns: ['quotes', 'quote_*', 'service_pricing', 'pricing_recommendations', 'floor_plans', 'rego_cache'],
    agentPatterns: ['quote-triage', 'price-optimizer', 'yard-map-geo', 'conversion-funnel'],
  },
  {
    capabilityId: 'C03',
    domains: ['orders', 'webhooks'],
    filePatterns: ['src/app/api/orders/**', 'src/app/api/webhooks/stripe/**'],
    routePatterns: ['/api/orders/**', '/api/webhooks/stripe', '/api/paypal/**', '/dashboard/orders', '/portal/orders'],
    tablePatterns: ['orders', 'payments', 'subscriptions', 'subscription_orders', 'invoices', 'production_orders'],
    agentPatterns: ['scheduling', 'crew-briefing', 'reconciliation', 'coo-agent'],
  },
  {
    capabilityId: 'C04',
    domains: ['schedule', 'jobs', 'cron'],
    filePatterns: ['src/app/api/cron/remind-day-before/**', 'src/app/api/cron/auto-complete-jobs/**', 'src/app/(app)/dashboard/schedule/**', 'src/app/(app)/dashboard/jobs/**'],
    routePatterns: ['/dashboard/schedule', '/dashboard/jobs', '/crew/jobs/**', '/crew/my-jobs', '/api/crew/jobs/**', '/api/crew/my-jobs', '/api/cron/remind-day-before', '/api/cron/auto-complete-jobs'],
    tablePatterns: ['orders', 'jobs', 'job_assignments', 'job_completions', 'job_publications', 'job_requirements', 'job_variations', 'shift_segments', 'employees', 'whs_records'],
    agentPatterns: ['scheduling', 'crew-briefing', 'coo-agent', 'field-producer'],
  },
  {
    capabilityId: 'C05',
    domains: ['crew', 'jobs'],
    filePatterns: ['src/app/(app)/crew/**', 'src/app/api/crew/**', 'src/lib/crew-onboarding.ts'],
    routePatterns: ['/crew/**', '/api/crew/**', '/dashboard/crew/**'],
    tablePatterns: ['employees', 'employee_documents', 'job_photos', 'crew_coach_notes', 'whs_records', 'payouts'],
    agentPatterns: ['crew-briefing', 'crew-coach', 'photo-qa', 'whs-safety-reminder', 'field-producer'],
  },
  {
    capabilityId: 'C06',
    domains: ['portal', 'subscriptions'],
    filePatterns: ['src/app/(app)/portal/**', 'src/app/api/portal/**', 'src/app/api/subscriptions/**'],
    routePatterns: ['/portal/**', '/api/portal/**', '/api/subscriptions/**', '/dashboard/customers', '/api/customers/**'],
    tablePatterns: ['customers', 'customer_*', 'quotes', 'orders', 'subscriptions', 'payments', 'client_agreements'],
    agentPatterns: ['customer-reply', 'lapsed-win-back', 'reviews'],
  },
  {
    capabilityId: 'C07',
    domains: ['payments', 'payables', 'expenses', 'finance', 'stripe'],
    filePatterns: ['src/app/api/payables/**', 'src/app/api/webhooks/stripe/**', 'src/lib/stripe/**', 'src/lib/payments/**'],
    routePatterns: ['/dashboard/payments', '/dashboard/expenses', '/dashboard/invoices', '/api/payables', '/api/webhooks/stripe', '/api/donate/**'],
    tablePatterns: ['payments', 'payouts', 'payables', 'expenses', 'stripe_disputes', 'cash_flow_forecasts', 'employee_payroll_details', 'invoices'],
    agentPatterns: ['reconciliation', 'cash-flow-forecaster', 'stripe-dispute-manager', 'cfo-agent', 'price-optimizer'],
  },
  {
    capabilityId: 'C08',
    domains: ['ndis'],
    filePatterns: ['src/app/api/ndis/**', 'src/app/(app)/dashboard/ndis/**', 'src/lib/ndis/**'],
    routePatterns: ['/api/ndis/**', '/dashboard/ndis/**', '/crew/onboarding/ndis'],
    tablePatterns: ['ndis_*', 'participant_support_profiles', 'job_participant_matches'],
    agentPatterns: ['ndis-compliance', 'ndis-plan-matcher'],
  },
  {
    capabilityId: 'C09',
    domains: ['applicants', 'onboarding', 'inductions'],
    filePatterns: ['src/app/api/applicants/**', 'src/app/api/inductions/**', 'src/app/(app)/dashboard/applicants/**', 'src/app/(app)/dashboard/onboarding/**'],
    routePatterns: ['/api/applicants/**', '/api/inductions/**', '/dashboard/applicants', '/dashboard/onboarding/**', '/dashboard/inductions'],
    tablePatterns: ['applicants', 'employees', 'employee_*', 'employee_onboarding', 'employment_contracts', 'induction_progress', 'crew_members'],
    agentPatterns: ['applicant-screener', 'crew-coach', 'whs-safety-reminder'],
  },
  {
    capabilityId: 'C10',
    domains: ['messaging', 'feedback'],
    filePatterns: ['src/app/api/messaging/**', 'src/app/api/feedback/**', 'src/app/(app)/dashboard/messages/**'],
    routePatterns: ['/api/messaging/**', '/api/feedback/**', '/api/webhooks/messenger', '/dashboard/messages'],
    tablePatterns: ['conversations', 'messages', 'feedback', 'customer_messages'],
    agentPatterns: ['customer-reply', 'lapsed-win-back', 'reviews', 'attention-seeker'],
  },
  {
    capabilityId: 'C11',
    domains: ['feedback', 'social-proof', 'reviews'],
    filePatterns: ['src/app/api/social-proof/**', 'src/app/api/feedback/**', 'src/app/(app)/dashboard/feedback/**'],
    routePatterns: ['/api/social-proof/**', '/api/feedback/**', '/dashboard/feedback'],
    tablePatterns: ['feedback', 'social_proof_items', 'site_impact_stats'],
    agentPatterns: ['reviews', 'customer-reply', 'attention-seeker'],
  },
  {
    capabilityId: 'C12',
    domains: ['analytics', 'growth-hq', 'research-trends', 'track'],
    filePatterns: ['src/app/api/analytics/**', 'src/app/api/growth-hq/**', 'src/app/api/research-trends/**', 'src/lib/analytics/**'],
    routePatterns: ['/api/analytics/**', '/api/growth-hq', '/api/research-trends/**', '/dashboard/insights'],
    tablePatterns: ['analytics_reports', 'analytics_findings', 'analytics_funnels', 'analytics_sessions', 'marketing_metrics', 'research_trends'],
    agentPatterns: ['analytics-intelligence', 'conversion-funnel', 'heatmap-analyst', 'trend-scout', 'competitor-scout'],
  },
  {
    capabilityId: 'C13',
    domains: ['marketing', 'publishing-queue', 'campaign-factory', 'social-channels'],
    filePatterns: ['src/app/api/marketing-campaigns/**', 'src/app/api/publishing-queue/**', 'src/app/api/campaign-factory/**', 'src/app/(app)/dashboard/marketing/**'],
    routePatterns: ['/api/marketing-campaigns/**', '/api/publishing-queue/**', '/api/campaign-factory/**', '/dashboard/marketing/**'],
    tablePatterns: ['marketing_campaigns', 'marketing_publishing_queue', 'marketing_social_channels', 'campaign_factory_runs'],
    agentPatterns: ['campaign-reporter', 'cadence-monitor', 'content-agent', 'copy-optimizer', 'seo-meta'],
  },
  {
    capabilityId: 'C14',
    domains: ['content', 'story', 'journal', 'artifacts'],
    filePatterns: ['src/app/api/story-*/**', 'src/app/api/content-*/**', 'src/app/api/journal/**', 'src/app/api/artifacts/**', 'src/app/(app)/dashboard/story-engine/**', 'src/app/(app)/dashboard/content-studio/**'],
    routePatterns: ['/api/story-*/**', '/api/content-*/**', '/api/journal/**', '/api/artifacts/**', '/dashboard/story-engine/**', '/dashboard/content-studio/**'],
    tablePatterns: ['story_arcs', 'story_open_threads', 'story_drafts', 'content_ideas', 'content_assets', 'artifacts'],
    agentPatterns: ['trend-scout', 'arc-monitor', 'thread-progress', 'production-monitor', 'asset-matcher', 'content-agent'],
  },
  {
    capabilityId: 'C15',
    domains: ['fundraising', 'donate'],
    filePatterns: ['src/app/api/fundraising/**', 'src/app/api/donate/**', 'src/app/(app)/dashboard/fundraising/**'],
    routePatterns: ['/api/fundraising/**', '/api/donate/**', '/api/upload/fundraising-image', '/dashboard/fundraising', '/get-involved', '/donate/success'],
    tablePatterns: ['fundraising_*', 'site_impact_stats'],
    agentPatterns: [],
  },
  {
    capabilityId: 'C16',
    domains: ['executive', 'dashboard'],
    filePatterns: ['src/app/(app)/dashboard/executive/**', 'src/app/api/cron/executive-*/**', 'src/lib/agents/agents/*-agent.ts'],
    routePatterns: ['/dashboard/executive', '/api/cron/executive-*'],
    tablePatterns: ['executive_decisions', 'executive_tasks', 'executive_metrics_snapshots'],
    agentPatterns: ['ceo-agent', 'coo-agent', 'cmo-agent', 'cfo-agent', 'chief-of-staff'],
  },
  {
    capabilityId: 'C17',
    domains: ['agents', 'bud'],
    filePatterns: ['src/lib/agents/**', 'src/app/api/agents/**', 'src/app/api/bud/**', 'src/app/(app)/dashboard/agents/**', 'src/app/(app)/dashboard/mission-control/**'],
    routePatterns: ['/api/agents/**', '/api/bud/**', '/api/cron/bud', '/dashboard/agents/**', '/dashboard/mission-control'],
    tablePatterns: ['agents', 'agent_*', 'bud_*', 'mission_control_*', 'pipeline_agent_scores'],
    agentPatterns: ['bud', 'bud-observer', 'agent-architect', 'efficiency-architect', 'internal-qa', 'admin-optimization'],
  },
  {
    capabilityId: 'C18',
    domains: ['sandbox'],
    filePatterns: ['src/app/api/sandbox/**', 'src/app/(app)/dashboard/sandbox/**', 'src/lib/sandbox/**'],
    routePatterns: ['/api/sandbox/**', '/dashboard/sandbox'],
    tablePatterns: ['sandbox_scenarios', 'sandbox_training_runs', 'sandbox_agent_responses', 'sandbox_decision_scores'],
    agentPatterns: [],
  },
  {
    capabilityId: 'C19',
    domains: ['vercel', 'github', 'pipeline', 'dev-os'],
    filePatterns: ['src/app/api/webhooks/vercel/**', 'src/app/api/webhooks/github/**', 'src/app/api/dev-os/**', 'src/app/api/cron/pipeline/**', 'src/lib/bud/**'],
    routePatterns: ['/api/webhooks/vercel', '/api/webhooks/github', '/api/dev-os', '/api/cron/pipeline'],
    tablePatterns: ['bud_improvements', 'bud_evidence', 'bud_repair_quarantine', 'github_*', 'pipeline_*'],
    agentPatterns: ['bud', 'bud-observer', 'design-developer', 'github-historian', 'browser-agent'],
  },
  {
    capabilityId: 'C20',
    domains: ['memory'],
    filePatterns: ['src/app/api/memory/**', 'src/lib/memory/**'],
    routePatterns: ['/api/memory/**'],
    tablePatterns: ['memory_documents', 'memory_edges', 'agent_memory', 'bud_convention_learnings'],
    agentPatterns: ['internal-qa', 'github-historian', 'bud'],
  },
  {
    capabilityId: 'C21',
    domains: ['auth', 'users', 'account', 'audit-log'],
    filePatterns: ['src/app/api/auth/**', 'src/app/api/users/**', 'src/app/api/account/**', 'src/app/api/audit-log/**', 'src/middleware.ts', 'src/lib/auth/**'],
    routePatterns: ['/api/auth/**', '/api/users/**', '/api/account/**', '/api/audit-log', '/account/**', '/api/upload/avatar'],
    tablePatterns: ['users', 'profiles', 'avatars', 'employees', 'customers', 'audit_log', 'bud_audit_logs'],
    agentPatterns: [],
  },
  {
    capabilityId: 'C22',
    domains: ['design'],
    filePatterns: ['src/app/api/design/**', 'src/app/(app)/dashboard/design/**', 'src/lib/design-system/**'],
    routePatterns: ['/api/design/**', '/dashboard/design/**'],
    tablePatterns: ['design_audits', 'design_violations', 'design_insights', 'design_latest_audit'],
    agentPatterns: ['design-system', 'ux-intelligence', 'admin-ux-designer', 'layout-critic', 'design-developer'],
  },
  {
    capabilityId: 'C23',
    domains: ['pricing'],
    filePatterns: ['src/lib/services-core/**', 'src/lib/payments/**', 'src/app/(public)/pricing/**'],
    routePatterns: ['/pricing', '/services/**'],
    tablePatterns: ['service_pricing', 'pricing_recommendations'],
    agentPatterns: ['price-optimizer', 'cfo-agent', 'conversion-funnel'],
  },
  {
    capabilityId: 'C24',
    domains: ['reports', 'insights', 'dashboard', 'customers'],
    filePatterns: ['src/app/api/dashboard/**', 'src/app/api/customers/**', 'src/app/(app)/dashboard/reports/**', 'src/app/(app)/dashboard/insights/**'],
    routePatterns: ['/api/dashboard', '/api/customers/**', '/dashboard/reports', '/dashboard/insights'],
    tablePatterns: ['orders', 'quotes', 'payments', 'customers', 'leads', 'marketing_metrics'],
    agentPatterns: ['analytics-intelligence', 'ceo-agent', 'coo-agent', 'cfo-agent', 'cmo-agent', 'scoreboard-keeper'],
  },
];

export const DEPENDENCY_ALLOWLIST: DependencyAllowlistEntry[] = [
  { fromPattern: 'src/app/**', toPattern: 'src/components/**', reason: 'shared UI components' },
  { fromPattern: 'src/app/**', toPattern: 'src/lib/supabase/**', reason: 'Supabase helpers' },
  { fromPattern: 'src/app/**', toPattern: 'src/lib/auth/**', reason: 'auth helpers' },
  { fromPattern: 'src/app/**', toPattern: 'src/types/**', reason: 'shared types' },
  { fromPattern: 'src/lib/**', toPattern: 'src/types/**', reason: 'shared types' },
  { fromPattern: 'src/lib/**', toPattern: 'src/lib/supabase/**', reason: 'Supabase helpers' },
  { fromPattern: 'src/lib/agents/**', toPattern: 'src/lib/agents/**', reason: 'agent runtime internals' },
  { fromPattern: 'src/lib/bud/**', toPattern: 'src/lib/bud/**', reason: 'Bud runtime internals' },
  { fromPattern: 'src/app/(public)/services/**', toPattern: 'src/app/(public)/services/**', reason: 'services flow internals' },
  { fromPattern: 'src/app/(app)/dashboard/**', toPattern: 'src/app/(app)/dashboard/components/**', reason: 'dashboard shared components' },
];

export function capabilityForPath(relativePath: string): string | undefined {
  return CAPABILITY_MANIFEST.find((entry) => entry.filePatterns.some((pattern) => globMatch(pattern, relativePath)))?.capabilityId;
}

export function capabilityForRoute(route: string): string | undefined {
  return CAPABILITY_MANIFEST.find((entry) => entry.routePatterns.some((pattern) => globMatch(pattern, route)))?.capabilityId;
}

export function capabilityForTable(table: string): string | undefined {
  return CAPABILITY_MANIFEST.find((entry) => entry.tablePatterns.some((pattern) => globMatch(pattern, table)))?.capabilityId;
}

export function capabilityForAgent(agent: string): string | undefined {
  return CAPABILITY_MANIFEST.find((entry) => entry.agentPatterns.some((pattern) => globMatch(pattern, agent)))?.capabilityId;
}

export function isAllowedDependency(fromRelativePath: string, toRelativePath: string): boolean {
  return DEPENDENCY_ALLOWLIST.some(
    (entry) => globMatch(entry.fromPattern, fromRelativePath) && globMatch(entry.toPattern, toRelativePath),
  );
}

export function capabilityIdToName(atlasCapabilities: CapabilitySpec[], capabilityId?: string): string | undefined {
  return atlasCapabilities.find((capability) => capability.id === capabilityId)?.name;
}

export function globMatch(pattern: string, value: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}
