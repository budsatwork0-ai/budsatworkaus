export type DashboardNavBadgeKey = 'dashboard' | 'schedule' | 'quotes' | 'invoices' | 'applicants';

export type DashboardNavIconKey =
  | 'dashboard'
  | 'schedule'
  | 'quotes'
  | 'money'
  | 'customers'
  | 'crew'
  | 'growthHq'
  | 'contentStudio'
  | 'settings'
  | 'ndis'
  | 'mission'
  | 'executive'
  | 'alerts'
  | 'leads'
  | 'reports'
  | 'insights'
  | 'quoteFunnel'
  | 'jobs'
  | 'subscriptions'
  | 'applicants'
  | 'feedback'
  | 'automations'
  | 'audit'
  | 'design'
  | 'messages'
  | 'sandbox'
  | 'fundraising';

export type DashboardNavItem = {
  href: string;
  label: string;
  iconKey: DashboardNavIconKey;
  badgeKey?: DashboardNavBadgeKey;
};

export type DashboardNavGroup = {
  id: string;
  label: string;
  adminOnly?: boolean;
  collapsedByDefault?: boolean;
  items: DashboardNavItem[];
};

export type DashboardCommand = {
  id: string;
  label: string;
  description: string;
  href: string;
  keywords: string[];
  category: 'Navigation' | 'People' | 'Growth' | 'Money' | 'Bud OS' | 'Settings' | 'System';
  primary?: boolean;
};

export const DASHBOARD_NAV_GROUPS: readonly DashboardNavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Overview', iconKey: 'dashboard', badgeKey: 'dashboard' },
      { href: '/dashboard/alerts', label: 'Alerts', iconKey: 'alerts' },
      { href: '/dashboard/messages', label: 'Messages', iconKey: 'messages' },
    ],
  },
  {
    id: 'work',
    label: 'Work',
    items: [
      { href: '/dashboard/schedule', label: 'Schedule', iconKey: 'schedule', badgeKey: 'schedule' },
      { href: '/dashboard/orders', label: 'Jobs & Orders', iconKey: 'jobs' },
      { href: '/dashboard/quotes', label: 'Quotes', iconKey: 'quotes', badgeKey: 'quotes' },
      { href: '/dashboard/customers', label: 'Customers', iconKey: 'customers' },
    ],
  },
  {
    id: 'people',
    label: 'People',
    adminOnly: true,
    items: [
      { href: '/dashboard/crew', label: 'Crew', iconKey: 'crew' },
      { href: '/dashboard/applicants', label: 'Applicants', iconKey: 'applicants', badgeKey: 'applicants' },
      { href: '/dashboard/ndis', label: 'NDIS', iconKey: 'ndis' },
    ],
  },
  {
    id: 'growth',
    label: 'Growth',
    adminOnly: true,
    items: [
      { href: '/dashboard/leads', label: 'Leads', iconKey: 'leads' },
      { href: '/dashboard/growth-hq', label: 'Campaigns', iconKey: 'growthHq' },
      { href: '/dashboard/content', label: 'Create', iconKey: 'contentStudio' },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    adminOnly: true,
    items: [
      { href: '/dashboard/invoices', label: 'Invoices', iconKey: 'money', badgeKey: 'invoices' },
      { href: '/dashboard/subscriptions', label: 'Subscriptions', iconKey: 'subscriptions' },
    ],
  },
  {
    id: 'bud-os',
    label: 'Bud OS',
    adminOnly: true,
    items: [
      { href: '/dashboard/mission-control', label: 'Mission Control', iconKey: 'mission' },
      { href: '/dashboard/agents', label: 'Agents', iconKey: 'automations' },
      { href: '/dashboard/executive', label: 'Executive HQ', iconKey: 'executive' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    adminOnly: true,
    items: [
      { href: '/dashboard/settings', label: 'Workspace', iconKey: 'settings' },
      { href: '/dashboard/automations', label: 'Automations', iconKey: 'automations' },
    ],
  },
  {
    id: 'more-system',
    label: 'More / System',
    adminOnly: true,
    collapsedByDefault: true,
    items: [
      { href: '/dashboard/reports', label: 'Reports', iconKey: 'reports' },
      { href: '/dashboard/insights', label: 'Insights', iconKey: 'insights' },
      { href: '/dashboard/audit-log', label: 'Audit Log', iconKey: 'audit' },
      { href: '/dashboard/sandbox', label: 'Sandbox', iconKey: 'sandbox' },
      { href: '/dashboard/design', label: 'Design System', iconKey: 'design' },
      { href: '/dashboard/fundraising', label: 'Fundraising', iconKey: 'fundraising' },
      { href: '/dashboard/onboarding', label: 'Onboarding', iconKey: 'crew' },
      { href: '/dashboard/inductions', label: 'Inductions', iconKey: 'audit' },
      { href: '/dashboard/analytics/quote-funnel', label: 'Quote Funnel', iconKey: 'quoteFunnel' },
      { href: '/dashboard/feedback', label: 'Feedback', iconKey: 'feedback' },
    ],
  },
] as const;

export const DASHBOARD_COMMANDS: readonly DashboardCommand[] = [
  { id: 'overview', label: 'Go to Overview', description: 'Admin overview and operating status', href: '/dashboard', keywords: ['home', 'dashboard', 'status', 'mission control'], category: 'Navigation', primary: true },
  { id: 'alerts', label: 'Go to Alerts', description: 'Operational alerts and attention items', href: '/dashboard/alerts', keywords: ['notifications', 'issues', 'attention'], category: 'Navigation', primary: true },
  { id: 'messages', label: 'Go to Messages', description: 'Customer and lead conversations', href: '/dashboard/messages', keywords: ['inbox', 'conversation', 'messaging'], category: 'Navigation', primary: true },
  { id: 'schedule', label: 'Go to Schedule', description: 'Daily and weekly dispatch', href: '/dashboard/schedule', keywords: ['calendar', 'today', 'dispatch'], category: 'Navigation', primary: true },
  { id: 'orders', label: 'Go to Jobs & Orders', description: 'Manage booked work', href: '/dashboard/orders', keywords: ['jobs', 'orders', 'work'], category: 'Navigation', primary: true },
  { id: 'quotes', label: 'Go to Quotes', description: 'Review quote submissions', href: '/dashboard/quotes', keywords: ['pricing', 'quote review'], category: 'Navigation', primary: true },
  { id: 'customers', label: 'Go to Customers', description: 'Customer directory and cleanup', href: '/dashboard/customers', keywords: ['clients', 'customer list'], category: 'Navigation', primary: true },
  { id: 'crew', label: 'Go to Crew', description: 'Crew roster and pipeline', href: '/dashboard/crew', keywords: ['employees', 'team', 'people'], category: 'People', primary: true },
  { id: 'applicants', label: 'Go to Applicants', description: 'Applicant intake pipeline', href: '/dashboard/applicants', keywords: ['hiring', 'recruiting'], category: 'People', primary: true },
  { id: 'ndis', label: 'Go to NDIS', description: 'Organisations and participant matching', href: '/dashboard/ndis', keywords: ['participants', 'organisations', 'support'], category: 'People', primary: true },
  { id: 'leads', label: 'Go to Leads', description: 'Lead inbox and follow-up', href: '/dashboard/leads', keywords: ['sales', 'enquiries', 'inquiries'], category: 'Growth', primary: true },
  { id: 'growth-hq', label: 'Go to Campaigns', description: 'Growth HQ and campaign validation', href: '/dashboard/growth-hq', keywords: ['campaigns', 'growth', 'validation'], category: 'Growth', primary: true },
  { id: 'content', label: 'Go to Create', description: 'Campaign Factory content creation', href: '/dashboard/content', keywords: ['content', 'create', 'campaign factory'], category: 'Growth', primary: true },
  { id: 'invoices', label: 'Go to Invoices', description: 'Money overview and receivables', href: '/dashboard/invoices', keywords: ['money', 'finance', 'receivables'], category: 'Money', primary: true },
  { id: 'subscriptions', label: 'Go to Subscriptions', description: 'Recurring services', href: '/dashboard/subscriptions', keywords: ['recurring', 'plans'], category: 'Money', primary: true },
  { id: 'mission-control', label: 'Go to Mission Control', description: 'Bud OS operating console', href: '/dashboard/mission-control', keywords: ['bud os', 'agents', 'automation'], category: 'Bud OS', primary: true },
  { id: 'agents', label: 'Go to Agents', description: 'Agent fleet and repair quarantine', href: '/dashboard/agents', keywords: ['bud', 'automation', 'agent runs'], category: 'Bud OS', primary: true },
  { id: 'executive', label: 'Go to Executive HQ', description: 'Executive decisions and weekly reviews', href: '/dashboard/executive', keywords: ['ceo', 'decisions', 'weekly'], category: 'Bud OS', primary: true },
  { id: 'settings', label: 'Go to Settings', description: 'Workspace and account settings', href: '/dashboard/settings', keywords: ['workspace', 'account', 'config'], category: 'Settings', primary: true },
  { id: 'automations', label: 'Go to Automations', description: 'Automation configuration', href: '/dashboard/automations', keywords: ['settings', 'automatic'], category: 'Settings', primary: true },
  { id: 'reports', label: 'Go to Reports', description: 'Operational reports', href: '/dashboard/reports', keywords: ['analytics', 'metrics'], category: 'System' },
  { id: 'insights', label: 'Go to Insights', description: 'Business analytics workspace', href: '/dashboard/insights', keywords: ['analytics', 'ceo', 'growth', 'finance'], category: 'System' },
  { id: 'audit-log', label: 'Go to Audit Log', description: 'System changes log', href: '/dashboard/audit-log', keywords: ['history', 'audit'], category: 'System' },
  { id: 'sandbox', label: 'Go to Sandbox', description: 'Sandbox scenarios and diagnostics', href: '/dashboard/sandbox', keywords: ['testing', 'system', 'diagnostics'], category: 'System' },
  { id: 'design', label: 'Go to Design System', description: 'Design audit and tokens', href: '/dashboard/design', keywords: ['design', 'tokens', 'violations'], category: 'System' },
  { id: 'fundraising', label: 'Go to Fundraising', description: 'Fundraising and social proof admin', href: '/dashboard/fundraising', keywords: ['donate', 'impact'], category: 'System' },
  { id: 'onboarding', label: 'Go to Onboarding', description: 'Crew onboarding pipeline', href: '/dashboard/onboarding', keywords: ['people', 'crew', 'documents'], category: 'System' },
  { id: 'inductions', label: 'Go to Inductions', description: 'Induction status and follow-up', href: '/dashboard/inductions', keywords: ['people', 'training'], category: 'System' },
  { id: 'quote-funnel', label: 'Go to Quote Funnel', description: 'Quote funnel analytics', href: '/dashboard/analytics/quote-funnel', keywords: ['analytics', 'quotes', 'conversion'], category: 'System' },
  { id: 'feedback', label: 'Go to Feedback', description: 'Customer and site feedback', href: '/dashboard/feedback', keywords: ['reviews', 'messages'], category: 'System' },
] as const;

export const DEFAULT_COLLAPSED_DASHBOARD_NAV_GROUP_IDS = DASHBOARD_NAV_GROUPS
  .filter((group) => group.collapsedByDefault)
  .map((group) => group.id);
