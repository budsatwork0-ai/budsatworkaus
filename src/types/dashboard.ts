// Dashboard shared types and constants

// Status types
export type ReceivableStatus = 'Draft' | 'Sent' | 'Part-paid' | 'Paid' | 'Overdue';
export type PayableStatus = 'Upcoming' | 'Paid' | 'Overdue';
export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type TabKey = 'today' | 'money' | 'jobs' | 'analytics' | 'domains';
export type DateRange = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

// Record types
export type ReceivableRecord = {
  id: string;
  jobId: string;
  customer: string;
  service: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  paid: number;
  balance: number;
  status: ReceivableStatus;
  notes: string;
};

export type PayableRecord = {
  id: string;
  supplier: string;
  category: string;
  billDate: string;
  dueDate: string;
  amount: number;
  status: PayableStatus;
  paymentMethod: string;
  notes: string;
};

export type JobRecord = {
  id: string;
  customer: string;
  service: string;
  scheduledDate: string;
  scheduledTime: string;
  address: string;
  status: JobStatus;
  amount: number;
  notes: string;
  quoteId?: string;
};

export type ActivityItem = {
  id: string;
  type: 'payment' | 'booking' | 'invoice' | 'expense' | 'job_completed';
  title: string;
  description: string;
  amount?: number;
  timestamp: string;
};

export type DashboardAlert = {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  source: string;
  timestamp: string;
  href?: string;
};

export type RecordDetail =
  | { type: 'receivable'; record: ReceivableRecord }
  | { type: 'payable'; record: PayableRecord }
  | { type: 'job'; record: JobRecord };

export type LabourAcceptanceStatus = 'accepted' | 'pending' | 'missing';
export type AwardComplianceStatus = 'compliant' | 'review' | 'unconfigured';

export type MoneyFlowPoint = {
  date: string;
  revenue: number;
  expenses: number;
  labourCost: number;
  net: number;
};

export type MoneyBreakdownItem = {
  label: string;
  amount: number;
  share: number;
  count?: number;
};

export type MoneyActionAlert = {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  href?: string;
  actionLabel?: string;
};

export type CrewPayContribution = {
  assignmentId: string;
  orderId: string;
  jobLabel: string;
  customer: string;
  service: string;
  date: string;
  hours: number;
  approved: boolean;
  estimatedRevenue: number;
  labourAcceptance: LabourAcceptanceStatus;
};

export type CrewPayWorker = {
  id: string;
  name: string;
  role: string;
  employmentType: string;
  serviceMix: string[];
  payRate: number;
  awardCategory: string;
  classification: string | null;
  minimumAwardRate: number | null;
  awardVariance: number | null;
  awardStatus: AwardComplianceStatus;
  totalHours: number;
  approvedHours: number;
  pendingHours: number;
  estimatedGrossPay: number;
  approvedPay: number;
  pendingPay: number;
  payStatus: 'Draft' | 'Ready to pay' | 'Needs review';
  labourAcceptanceSummary: {
    accepted: number;
    pending: number;
    missing: number;
  };
  contributions: CrewPayContribution[];
};

export type MoneyTransaction = {
  id: string;
  date: string;
  type: 'incoming' | 'outgoing' | 'payroll' | 'settlement';
  title: string;
  subtitle: string;
  amount: number;
  status: string;
  reference?: string;
  href?: string;
};

export type MoneyJobMargin = {
  orderId: string;
  customer: string;
  service: string;
  date: string;
  revenue: number;
  labourCost: number;
  margin: number;
  labourAcceptance: LabourAcceptanceStatus;
};

export type MoneyFlowData = {
  overview: {
    revenueThisMonth: number;
    expensesThisMonth: number;
    payrollOwed: number;
    outstandingInvoices: number;
    grossMargin: number;
    labourCostPercent: number;
    incomingReceived: number;
    outgoingPaid: number;
  };
  series: MoneyFlowPoint[];
  incoming: {
    expected: number;
    received: number;
    overdue: number;
    depositsCollected: number;
    quotesAccepted: number;
    invoicesIssued: number;
    invoicesPaid: number;
    revenueByService: MoneyBreakdownItem[];
    revenueByCustomer: MoneyBreakdownItem[];
  };
  outgoing: {
    due: number;
    paid: number;
    payrollOwed: number;
    supplierCosts: number;
    subscriptionCosts: number;
    reimbursementCosts: number;
    settlementClearing: number;
    expenseByCategory: MoneyBreakdownItem[];
  };
  crewPay: {
    totalHours: number;
    approvedHours: number;
    pendingHours: number;
    payrollOwed: number;
    readyCount: number;
    needsReviewCount: number;
    missingAcceptanceCount: number;
    workers: CrewPayWorker[];
  };
  alerts: MoneyActionAlert[];
  transactions: MoneyTransaction[];
  jobMargins: MoneyJobMargin[];
};

// Filter types
export type ReceivableFilters = {
  status: 'all' | ReceivableStatus;
  startDate: string;
  endDate: string;
  search: string;
};

export type PayableFilters = {
  status: 'all' | PayableStatus;
  startDate: string;
  endDate: string;
  search: string;
};

export type JobFilters = {
  status: 'all' | JobStatus;
  startDate: string;
  endDate: string;
  search: string;
};

// Metrics types
export type DashboardMetrics = {
  cashBalance: number;
  outstandingReceivables: {
    total: number;
    count: number;
    change: number;
  };
  upcomingPayables: {
    total: number;
    count: number;
    change: number;
  };
  netProfit: {
    amount: number;
    margin: number;
    change: number;
  };
  revenueByService: Array<{
    service: string;
    amount: number;
  }>;
  expensesByCategory: Array<{
    category: string;
    amount: number;
    percent: number;
  }>;
  alerts: {
    overdueCount: number;
    overdueAmount: number;
    dueSoonCount: number;
    dueSoonAmount: number;
  };
  operationsSnapshot: {
    jobsCompleted: number;
    averageJobValue: number;
    labourPercent: number;
    grossMargin: number;
  };
  revenueTrend: Array<{
    month: string;
    revenue: number;
    expenses: number;
  }>;
  goals: {
    monthlyRevenueTarget: number;
    currentRevenue: number;
    revenueChange: number;
    monthlyJobsTarget: number;
    currentJobs: number;
  };
};

export type PayoutRecord = {
  id: string;
  stripe_payout_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'canceled';
  arrival_date: string | null;
  created_at: string;
  failure_message: string | null;
};

export type DashboardCrewMember = {
  id: string;
  full_name: string | null;
  status: string;
  services: string[] | null;
  onboardingComplete?: boolean;
  crewAccessApproved?: boolean;
  awaitingApproval?: boolean;
  readyForCrewApproval?: boolean;
  currentSectionLabel?: string | null;
  progress?: {
    completed: number;
    total: number;
    currentStep: number;
  };
  assignedJobs?: number;
  inProgressJobs?: number;
  nextJobDate?: string | null;
};

export type DashboardQuote = {
  id: string;
  status: string;
  customer_name: string | null;
  service_type: string | null;
  created_at: string;
  submitted_total: number | null;
  reviewed_total: number | null;
  total: number | null;
  converted_order_id: string | null;
  payment_status?: string | null;
  payment_requested_at?: string | null;
  finalized_at?: string | null;
  /**
   * Free-text service address ("12 Acacia St, Springfield QLD 4300").
   * Surfaced into the dashboard payload so Bud Leads can derive suburb
   * heatmaps without round-tripping per quote.
   */
  service_address?: string | null;
  /**
   * Lead source channel — defaults to 'website' on the API side when a quote
   * is created without explicit attribution. Used by the Live Leads Feed.
   */
  source?: 'website' | 'messenger' | 'sms' | 'instagram' | 'email' | 'phone' | 'referral' | 'unknown' | string | null;
  lead_score?: number | null;
  lead_score_at?: string | null;
};

export type PartnerReferralSnapshot = {
  partner: string;
  destinationUrl: string;
  totalClicks: number;
  uniqueSessions: number;
  clicksLast7Days: number;
  clicksPrev7Days: number;
  lastClickedAt: string | null;
  topSources: Array<{
    source: string;
    clicks: number;
  }>;
};

export type DashboardOverview = {
  customerCount: number;
  newLeadsThisWeek: number;
  revenueMTD: number;
  revenueHistory: Array<{ label: string; value: number; date: string }>;
  jobsToday: JobRecord[];
  quotesAwaitingReview: DashboardQuote[];
  applicantsAwaitingApproval: number;
  alertCount: number;
  popularServices: Array<{ name: string; amount: number; count?: number }>;
  recentFeedback: Array<{
    id: string;
    customer: string;
    service: string;
    quote: string;
    rating: number;
    created_at: string;
  }>;
  jobsCompleted: number;
  dataLineage: Array<{
    widget: string;
    query: string;
    table: string;
    fallback: string;
  }>;
};

export function normalizeQuoteStatus(status: string): string {
  if (status === 'pending') return 'submitted';
  if (status === 'approved') return 'finalized';
  if (status === 'adjusted') return 'in_review';
  if (status === 'converted') return 'paid';
  return status;
}

/**
 * Lead row from the `leads` table (Module 9). Returned by the dashboard API
 * once Messenger / SMS / IG ingest is wired in. Quote-derived leads still
 * arrive via `quotes` — Bud Leads unions both into a single Lead[] feed in
 * the adapter.
 */
export type DashboardLead = {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  service_type: string | null;
  suburb: string | null;
  service_address: string | null;
  source: 'website' | 'messenger' | 'sms' | 'instagram' | 'email' | 'phone' | 'referral' | 'unknown' | string;
  response_status:
    | 'awaiting_response'
    | 'in_conversation'
    | 'quoted'
    | 'booked'
    | 'completed'
    | 'no_response'
    | 'lost'
    | string;
  temperature: 'HOT' | 'WARM' | 'COLD' | 'LOST' | null;
  quote_id: string | null;
  first_response_at: string | null;
  booked_at: string | null;
  completed_at: string | null;
  lost_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DashboardData = {
  overview?: DashboardOverview;
  metrics: DashboardMetrics;
  moneyFlow: MoneyFlowData;
  receivables: ReceivableRecord[];
  payables: PayableRecord[];
  jobs: JobRecord[];
  recentActivity: ActivityItem[];
  alertsFeed: DashboardAlert[];
  dismissedAlertCount: number;
  payouts: PayoutRecord[];
  lastUpdated: string;
  crew: DashboardCrewMember[];
  quotes: DashboardQuote[];
  /**
   * Channel-ingested leads (Messenger, SMS, IG) that haven't rolled up into
   * a quote yet. Empty until module 9's channels are wired in.
   */
  leads?: DashboardLead[];
  partnerReferrals: PartnerReferralSnapshot[];
  applicantCount: number;
};

// Style mappings
export const statusStyles: Record<ReceivableStatus | PayableStatus | JobStatus, { bg: string; text: string }> = {
  Draft: { bg: 'bg-slate-100', text: 'text-slate-600' },
  Sent: { bg: 'bg-sky-100', text: 'text-sky-700' },
  'Part-paid': { bg: 'bg-amber-100', text: 'text-amber-700' },
  Paid: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Overdue: { bg: 'bg-red-100', text: 'text-red-700' },
  Upcoming: { bg: 'bg-slate-100', text: 'text-slate-600' },
  scheduled: { bg: 'bg-sky-100', text: 'text-sky-700' },
  in_progress: { bg: 'bg-amber-100', text: 'text-amber-700' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700' },
};

export const jobStatusLabels: Record<JobStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// Filter options
export const receivableStatusOptions: Array<'all' | ReceivableStatus> = ['all', 'Draft', 'Sent', 'Part-paid', 'Paid', 'Overdue'];
export const payableStatusOptions: Array<'all' | PayableStatus> = ['all', 'Upcoming', 'Paid', 'Overdue'];
export const jobStatusOptions: Array<'all' | JobStatus> = ['all', 'scheduled', 'in_progress', 'completed', 'cancelled'];

// Tab configuration — 5 grouped tabs replacing the original 8 flat tabs.
// Each tab may contain sub-navigation for the views it consolidates.
// Shortcuts: 1–5 for tab switching via keyboard.
export const tabs: { key: TabKey; label: string; shortcut: string; description: string }[] = [
  { key: 'today',     label: 'Today',     shortcut: '1', description: 'Schedule & Dispatch' },
  { key: 'money',     label: 'Money',     shortcut: '2', description: 'Overview, Receivables & Payables' },
  { key: 'jobs',      label: 'Jobs',      shortcut: '3', description: 'Job log with filters' },
  { key: 'analytics', label: 'Analytics', shortcut: '4', description: 'Reports & Live Visitors' },
  { key: 'domains',   label: 'Domains',   shortcut: '5', description: 'Command Centre — all 12 domains' },
];

export const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
];

// Service labels mapping
export const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window cleaning',
  cleaning: 'Home/Commercial cleaning',
  yard: 'Yard care',
  dump: 'Dump runs',
  auto: 'Auto detailing',
  laundry_sneakers: 'Laundry & Sneaker care',
  sneakers: 'Sneaker care',
};

// Constants
export const ITEMS_PER_PAGE = 10;
