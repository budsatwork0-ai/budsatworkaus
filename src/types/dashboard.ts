// Dashboard shared types and constants

// Status types
export type ReceivableStatus = 'Draft' | 'Sent' | 'Part-paid' | 'Paid' | 'Overdue';
export type PayableStatus = 'Upcoming' | 'Paid' | 'Overdue';
export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type TabKey = 'overview' | 'receivables' | 'payables' | 'jobs' | 'reports';
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
};

export type ActivityItem = {
  id: string;
  type: 'payment' | 'booking' | 'invoice' | 'expense' | 'job_completed';
  title: string;
  description: string;
  amount?: number;
  timestamp: string;
};

export type RecordDetail =
  | { type: 'receivable'; record: ReceivableRecord }
  | { type: 'payable'; record: PayableRecord }
  | { type: 'job'; record: JobRecord };

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
    monthlyJobsTarget: number;
    currentJobs: number;
  };
};

export type DashboardData = {
  metrics: DashboardMetrics;
  receivables: ReceivableRecord[];
  payables: PayableRecord[];
  jobs: JobRecord[];
  recentActivity: ActivityItem[];
  lastUpdated: string;
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

// Tab configuration
export const tabs: { key: TabKey; label: string; shortcut: string }[] = [
  { key: 'overview', label: 'Overview', shortcut: '1' },
  { key: 'receivables', label: 'Receivables', shortcut: '2' },
  { key: 'payables', label: 'Payables', shortcut: '3' },
  { key: 'jobs', label: 'Jobs', shortcut: '4' },
  { key: 'reports', label: 'Reports', shortcut: '5' },
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
