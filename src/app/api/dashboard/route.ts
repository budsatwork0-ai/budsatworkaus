import { NextResponse } from 'next/server';
import { buildAdminAlerts, getAdminAlertState } from '@/lib/admin-alerts';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { buildEmployeeOnboardingSnapshot } from '@/lib/crew-onboarding';
import { DEFAULT_DASHBOARD_GOALS, getDashboardGoals } from '@/lib/automations';
import type { Order, Payable } from '@/types/database';

export const dynamic = 'force-dynamic';

export type DashboardMetrics = {
  cashBalance: number;
  outstandingReceivables: {
    total: number;
    count: number;
    change: number; // percent change vs last month
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

export type JobRecord = {
  id: string;
  customer: string;
  service: string;
  scheduledDate: string;
  scheduledTime: string;
  address: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
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
  status: 'Draft' | 'Sent' | 'Part-paid' | 'Paid' | 'Overdue';
  notes: string;
};

export type PayableRecord = {
  id: string;
  supplier: string;
  category: string;
  billDate: string;
  dueDate: string;
  amount: number;
  status: 'Upcoming' | 'Paid' | 'Overdue';
  paymentMethod: string;
  notes: string;
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

export type DashboardData = {
  metrics: DashboardMetrics;
  moneyFlow: {
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
    series: Array<{
      date: string;
      revenue: number;
      expenses: number;
      labourCost: number;
      net: number;
    }>;
    incoming: {
      expected: number;
      received: number;
      overdue: number;
      depositsCollected: number;
      quotesAccepted: number;
      invoicesIssued: number;
      invoicesPaid: number;
      revenueByService: Array<{ label: string; amount: number; share: number; count?: number }>;
      revenueByCustomer: Array<{ label: string; amount: number; share: number; count?: number }>;
    };
    outgoing: {
      due: number;
      paid: number;
      payrollOwed: number;
      supplierCosts: number;
      subscriptionCosts: number;
      reimbursementCosts: number;
      settlementClearing: number;
      expenseByCategory: Array<{ label: string; amount: number; share: number; count?: number }>;
    };
    crewPay: {
      totalHours: number;
      approvedHours: number;
      pendingHours: number;
      payrollOwed: number;
      readyCount: number;
      needsReviewCount: number;
      missingAcceptanceCount: number;
      workers: Array<{
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
        awardStatus: 'compliant' | 'review' | 'unconfigured';
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
        contributions: Array<{
          assignmentId: string;
          orderId: string;
          jobLabel: string;
          customer: string;
          service: string;
          date: string;
          hours: number;
          approved: boolean;
          estimatedRevenue: number;
          labourAcceptance: 'accepted' | 'pending' | 'missing';
        }>;
      }>;
    };
    alerts: Array<{
      id: string;
      title: string;
      message: string;
      severity: 'critical' | 'warning' | 'info';
      href?: string;
      actionLabel?: string;
    }>;
    transactions: Array<{
      id: string;
      date: string;
      type: 'incoming' | 'outgoing' | 'payroll' | 'settlement';
      title: string;
      subtitle: string;
      amount: number;
      status: string;
      reference?: string;
      href?: string;
    }>;
    jobMargins: Array<{
      orderId: string;
      customer: string;
      service: string;
      date: string;
      revenue: number;
      labourCost: number;
      margin: number;
      labourAcceptance: 'accepted' | 'pending' | 'missing';
    }>;
  };
  receivables: ReceivableRecord[];
  payables: PayableRecord[];
  jobs: JobRecord[];
  recentActivity: ActivityItem[];
  alertsFeed: {
    id: string;
    title: string;
    message: string;
    severity: 'critical' | 'warning' | 'info';
    source: string;
    timestamp: string;
    href?: string;
  }[];
  dismissedAlertCount: number;
  payouts: PayoutRecord[];
  crew: {
    id: string;
    full_name: string | null;
    status: string;
    services: string[] | null;
    onboardingComplete: boolean;
    crewAccessApproved: boolean;
    awaitingApproval: boolean;
    readyForCrewApproval: boolean;
    currentSectionLabel: string | null;
    progress: {
      completed: number;
      total: number;
      currentStep: number;
    };
    assignedJobs: number;
    inProgressJobs: number;
    nextJobDate: string | null;
  }[];
  quotes: { id: string; status: string; customer_name: string | null; service_type: string | null; created_at: string; submitted_total: number | null; reviewed_total: number | null; total: number | null; converted_order_id: string | null }[];
  applicantCount: number;
  lastUpdated: string;
};

type LabourAcceptanceStatus = 'accepted' | 'pending' | 'missing';

type CrewAssignmentRecord = {
  employee_id: string;
  status: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  orders: {
    id: string;
    customer_name: string;
    service_type: string;
    quote_id: string | null;
    scheduled_date: string | null;
    estimated_duration_minutes: number | null;
    final_price: number | null;
    status: string;
  } | null;
};

type DashboardQuoteRecord = {
  id: string;
  status: string;
  customer_name: string | null;
  service_type: string | null;
  created_at: string;
  submitted_total: number | null;
  reviewed_total: number | null;
  total: number | null;
  converted_order_id: string | null;
  payment_status: string | null;
  payment_requested_at: string | null;
  finalized_at: string | null;
};

// Map order status to receivable status
function mapOrderStatusToReceivableStatus(
  orderStatus: string,
  dueDate: string | null,
  paidAmount: number,
  totalAmount: number
): ReceivableRecord['status'] {
  if (paidAmount >= totalAmount) return 'Paid';
  if (paidAmount > 0) return 'Part-paid';

  if (dueDate) {
    const due = new Date(dueDate);
    const now = new Date();
    if (due < now) return 'Overdue';
  }

  if (orderStatus === 'pending') return 'Draft';
  return 'Sent';
}

// Map payable status
function mapPayableStatus(
  status: string,
  dueDate: string | null
): PayableRecord['status'] {
  if (status === 'paid') return 'Paid';

  if (dueDate) {
    const due = new Date(dueDate);
    const now = new Date();
    if (due < now) return 'Overdue';
  }

  return 'Upcoming';
}

// Service type to display name mapping
const SERVICE_LABELS: Record<string, string> = {
  windows: 'Window cleaning',
  cleaning: 'Home/Commercial cleaning',
  yard: 'Yard care',
  dump: 'Dump runs',
  auto: 'Auto detailing',
  laundry_sneakers: 'Laundry & Sneaker care',
  sneakers: 'Sneaker care',
};

// Generate revenue trend data for the last 6 months
function generateRevenueTrend(
  completedOrders: Order[],
  paidPayables: Payable[]
): Array<{ month: string; revenue: number; expenses: number }> {
  const months: Array<{ month: string; revenue: number; expenses: number }> = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const monthName = date.toLocaleDateString('en-AU', { month: 'short' });

    const monthRevenue = completedOrders
      .filter(o => {
        const orderDate = new Date(o.completed_at || o.created_at);
        return orderDate >= date && orderDate <= endDate;
      })
      .reduce((sum, o) => sum + (o.final_price || 0), 0);

    const monthExpenses = paidPayables
      .filter(p => {
        const paidDate = new Date(p.paid_date || p.created_at);
        return paidDate >= date && paidDate <= endDate;
      })
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    months.push({ month: monthName, revenue: monthRevenue, expenses: monthExpenses });
  }

  return months;
}

// Generate recent activity items
function generateRecentActivity(
  orders: Order[],
  payables: Payable[],
  recentPayments: { order_id: string | null; amount: number; paid_at: string }[]
): ActivityItem[] {
  const activities: ActivityItem[] = [];

  // Add recent completed jobs
  orders
    .filter(o => o.status === 'completed')
    .slice(0, 5)
    .forEach(order => {
      activities.push({
        id: `job-${order.id}`,
        type: 'job_completed',
        title: 'Job completed',
        description: `${SERVICE_LABELS[order.service_type] || order.service_type} for ${order.customer_name}`,
        amount: order.final_price || 0,
        timestamp: order.completed_at || order.created_at,
      });
    });

  // Add recent bookings
  orders
    .filter(o => o.status === 'pending' || o.status === 'confirmed')
    .slice(0, 3)
    .forEach(order => {
      activities.push({
        id: `booking-${order.id}`,
        type: 'booking',
        title: 'New booking',
        description: `${order.customer_name} - ${SERVICE_LABELS[order.service_type] || order.service_type}`,
        amount: order.final_price || 0,
        timestamp: order.created_at,
      });
    });

  // Add recent confirmed payments
  recentPayments.forEach(p => {
    if (!p.order_id) return;
    activities.push({
      id: `payment-${p.order_id}`,
      type: 'payment',
      title: 'Payment confirmed',
      description: 'Stripe payment received',
      amount: p.amount,
      timestamp: p.paid_at,
    });
  });

  // Add recent expenses
  payables
    .filter(p => p.status === 'paid')
    .slice(0, 3)
    .forEach(p => {
      activities.push({
        id: `expense-${p.id}`,
        type: 'expense',
        title: 'Expense paid',
        description: `${p.vendor_name} - ${p.category}`,
        amount: p.amount || 0,
        timestamp: p.paid_date || p.created_at,
      });
    });

  // Sort by timestamp descending
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}

function normalizeQuoteStatus(status: string): string {
  if (status === 'pending') return 'submitted';
  if (status === 'approved') return 'finalized';
  if (status === 'adjusted') return 'in_review';
  if (status === 'converted') return 'paid';
  return status;
}

function effectiveQuoteTotal(quote: DashboardQuoteRecord | undefined) {
  return Number(quote?.reviewed_total ?? quote?.submitted_total ?? quote?.total ?? 0);
}

function inferLabourAcceptance(quote: DashboardQuoteRecord | undefined): LabourAcceptanceStatus {
  if (!quote) return 'missing';
  const status = normalizeQuoteStatus(quote.status);
  if (quote.converted_order_id || status === 'paid' || status === 'payment_pending' || status === 'finalized') {
    return 'accepted';
  }
  if (status === 'submitted' || status === 'in_review') {
    return 'pending';
  }
  return 'missing';
}

function resolveAwardReference(employee: {
  services?: string[] | null;
  default_role?: string | null;
  employment_type?: string | null;
}) {
  const serviceMix = employee.services || [];
  const usesGardening = serviceMix.some((service) => service === 'yard' || service === 'dump');
  const employmentType = (employee.employment_type || 'casual').toLowerCase();
  const isCasual = employmentType.includes('casual');

  if (usesGardening) {
    const casualLevelOne = 31.19;
    return {
      awardCategory: 'Gardening & Landscaping Award reference',
      classification: 'Level 1 reference',
      minimumAwardRate: isCasual ? casualLevelOne : Math.round((casualLevelOne / 1.25) * 100) / 100,
    };
  }

  const casualLevelOne = 32.31;
  return {
    awardCategory: 'Cleaning Services Award reference',
    classification: 'Level 1 reference',
    minimumAwardRate: isCasual ? casualLevelOne : Math.round((casualLevelOne / 1.25) * 100) / 100,
  };
}

function createEmptyDailySeries(now: Date) {
  const points: Array<{ date: string; revenue: number; expenses: number; labourCost: number; net: number }> = [];

  for (let offset = 364; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    points.push({
      date: day.toISOString().slice(0, 10),
      revenue: 0,
      expenses: 0,
      labourCost: 0,
      net: 0,
    });
  }

  return points;
}

export async function GET() {
  const client = createServiceClientSafe();

  if (!client) {
    return NextResponse.json(
      { error: 'Database unavailable' },
      { status: 503 }
    );
  }

  try {
    // Get current date info for calculations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const payrollWindowStart = new Date(now.getFullYear(), now.getMonth() - 4, 1);

    // Fetch all data in parallel
    const [
      ordersResult,
      completedOrdersResult,
      lastMonthOrdersResult,
      payablesResult,
      paymentsResult,
      recentPaymentsResult,
      payoutsResult,
      crewResult,
      quotesResult,
      applicantsResult,
      alertState,
    ] = await Promise.all([
      // All non-cancelled orders for receivables (join customers for address)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)
        .from('orders')
        .select('*, customers(default_address)')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false }),

      // Completed orders (last 6 months for trend)
      client
        .from('orders')
        .select('*')
        .eq('status', 'completed')
        .gte('completed_at', yearAgo.toISOString()),

      // Completed orders last month for comparison
      client
        .from('orders')
        .select('*')
        .eq('status', 'completed')
        .gte('completed_at', startOfLastMonth.toISOString())
        .lte('completed_at', endOfLastMonth.toISOString()),

      // All payables
      client
        .from('payables')
        .select('*')
        .order('due_date', { ascending: true }),

      // Completed payments for receivables tracking
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)
        .from('payments')
        .select('order_id, amount, status')
        .eq('status', 'completed'),

      // Recent completed payments for activity feed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)
        .from('payments')
        .select('order_id, amount, paid_at')
        .eq('status', 'completed')
        .order('paid_at', { ascending: false })
        .limit(5),

      // Recent Stripe payouts to NAB
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)
        .from('payouts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10),

      // Active crew members for dashboard summary
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)
        .from('employees')
        .select('id, full_name, status, services, onboarding_complete, crew_access_approved, ndis_worker, hourly_rate, default_role, employment_type')
        .order('created_at', { ascending: false }),

      // All quotes for pipeline calculations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)
        .from('quotes')
        .select('id, status, customer_name, service_type, created_at, submitted_total, reviewed_total, total, converted_order_id, payment_status, payment_requested_at, finalized_at')
        .order('created_at', { ascending: false })
        .limit(200),

      // Intake applicants count (non-community roles)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)
        .from('applicants')
        .select('id, role')
        .eq('stage', 'intake'),

      getAdminAlertState(),
    ]);

    // Handle errors
    if (ordersResult.error) throw ordersResult.error;
    if (completedOrdersResult.error) throw completedOrdersResult.error;
    if (lastMonthOrdersResult.error) throw lastMonthOrdersResult.error;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orders: any[] = ordersResult.data || [];
    const allCompletedOrders: Order[] = completedOrdersResult.data || [];
    const lastMonthOrders: Order[] = lastMonthOrdersResult.data || [];
    const payables: Payable[] = payablesResult.data || [];
    const recentPaymentsData: { order_id: string | null; amount: number; paid_at: string }[] = recentPaymentsResult?.data || [];
    const payoutsData: PayoutRecord[] = payoutsResult?.data || [];
    const crewData: Array<{
      id: string;
      full_name: string | null;
      status: string;
      services: string[] | null;
      onboarding_complete?: boolean | null;
      crew_access_approved?: boolean | null;
      ndis_worker?: boolean | null;
      hourly_rate?: number | null;
      default_role?: string | null;
      employment_type?: string | null;
    }> = crewResult?.data || [];
    const quotesData: DashboardQuoteRecord[] = quotesResult?.data || [];
    const communityRoles = new Set(['Quality partner', 'Sponsor', 'Innovation partner']);
    const applicantCount = (applicantsResult?.data || []).filter(
      (a: { role?: string }) => !communityRoles.has(a.role || '')
    ).length;

    const employeeIds = crewData.map((employee) => employee.id);
    const sectionsByEmployee = new Map<string, Array<{ section: string; completed: boolean }>>();
    const docsByEmployee = new Map<string, Array<{
      doc_type: string;
      file_url?: string | null;
      file_name?: string | null;
      status?: string | null;
      created_at?: string;
      expires_at?: string | null;
    }>>();
    const assignmentsByEmployee = new Map<string, CrewAssignmentRecord[]>();

    if (employeeIds.length > 0) {
      const [sectionsResult, documentsResult, assignmentsResult] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client as any)
          .from('employee_onboarding')
          .select('employee_id, section, completed')
          .in('employee_id', employeeIds),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client as any)
          .from('employee_documents')
          .select('employee_id, doc_type, file_url, file_name, status, created_at, expires_at')
          .in('employee_id', employeeIds)
          .order('created_at', { ascending: false }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client as any)
          .from('job_assignments')
          .select('employee_id, status, accepted_at, started_at, completed_at, created_at, orders(id, customer_name, service_type, quote_id, scheduled_date, estimated_duration_minutes, final_price, status)')
          .in('employee_id', employeeIds),
      ]);

      for (const section of sectionsResult.data || []) {
        const list = sectionsByEmployee.get(section.employee_id) || [];
        list.push({ section: section.section, completed: section.completed });
        sectionsByEmployee.set(section.employee_id, list);
      }

      for (const document of documentsResult.data || []) {
        const list = docsByEmployee.get(document.employee_id) || [];
        list.push(document);
        docsByEmployee.set(document.employee_id, list);
      }

      for (const assignment of assignmentsResult.data || []) {
        const orderInfo = Array.isArray(assignment.orders) ? assignment.orders[0] : assignment.orders;
        if (new Date(assignment.created_at) < payrollWindowStart) continue;
        const list = assignmentsByEmployee.get(assignment.employee_id) || [];
        list.push({
          employee_id: assignment.employee_id,
          status: assignment.status,
          accepted_at: assignment.accepted_at || null,
          started_at: assignment.started_at || null,
          completed_at: assignment.completed_at || null,
          created_at: assignment.created_at,
          orders: orderInfo
            ? {
                id: orderInfo.id,
                customer_name: orderInfo.customer_name,
                service_type: orderInfo.service_type,
                quote_id: orderInfo.quote_id,
                scheduled_date: orderInfo.scheduled_date,
                estimated_duration_minutes: orderInfo.estimated_duration_minutes,
                final_price: orderInfo.final_price,
                status: orderInfo.status,
              }
            : null,
        });
        assignmentsByEmployee.set(assignment.employee_id, list);
      }
    }

    // Build a map of order_id -> total paid amount from completed payments
    const paymentsData: { order_id: string | null; amount: number; status: string }[] = paymentsResult?.data || [];
    const paidByOrder = new Map<string, number>();
    for (const p of paymentsData) {
      if (p.order_id) {
        const current = paidByOrder.get(p.order_id) || 0;
        paidByOrder.set(p.order_id, current + (p.amount || 0));
      }
    }

    // Filter completed orders for this month
    const completedOrders = allCompletedOrders.filter(o => {
      const completedAt = new Date(o.completed_at || o.created_at);
      return completedAt >= startOfMonth;
    });

    // Calculate last month totals for comparison
    const lastMonthRevenue = lastMonthOrders.reduce((sum, o) => sum + (o.final_price || 0), 0);
    const lastMonthReceivables = lastMonthOrders.filter(o => o.status !== 'completed').length;

    // Calculate outstanding receivables (non-completed orders, minus payments received)
    const outstandingOrders = orders.filter(o => o.status !== 'completed');
    const outstandingTotal = outstandingOrders.reduce((sum, o) => {
      const paid = paidByOrder.get(o.id) || 0;
      return sum + Math.max(0, (o.final_price || 0) - paid);
    }, 0);

    // Calculate upcoming payables (next 30 days, pending)
    const upcomingPayables = payables.filter(p => {
      if (p.status === 'paid') return false;
      if (!p.due_date) return true;
      const dueDate = new Date(p.due_date);
      return dueDate <= thirtyDaysFromNow;
    });
    const upcomingPayablesTotal = upcomingPayables.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Calculate last month's upcoming payables for change comparison
    const lastMonthUpcomingPayables = payables.filter(p => {
      if (p.status === 'paid') return false;
      if (!p.due_date) return false;
      const due = new Date(p.due_date);
      return due >= startOfLastMonth && due <= endOfLastMonth;
    });
    const lastMonthUpcomingTotal = lastMonthUpcomingPayables.reduce((sum, p) => sum + (p.amount || 0), 0);
    const upcomingChange = lastMonthUpcomingTotal > 0
      ? Math.round(((upcomingPayablesTotal - lastMonthUpcomingTotal) / lastMonthUpcomingTotal) * 100)
      : 0;

    // Calculate revenue by service type
    const revenueByServiceMap = new Map<string, number>();
    completedOrders.forEach(order => {
      const service = order.service_type || 'other';
      const current = revenueByServiceMap.get(service) || 0;
      revenueByServiceMap.set(service, current + (order.final_price || 0));
    });
    const revenueByService = Array.from(revenueByServiceMap.entries())
      .map(([service, amount]) => ({
        service: SERVICE_LABELS[service] || service,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Calculate expenses by category
    const expensesByCategoryMap = new Map<string, number>();
    const paidPayables = payables.filter(p => p.status === 'paid');
    paidPayables.forEach(p => {
      const category = p.category || 'other';
      const current = expensesByCategoryMap.get(category) || 0;
      expensesByCategoryMap.set(category, current + (p.amount || 0));
    });
    const totalExpenses = paidPayables.reduce((sum, p) => sum + (p.amount || 0), 0);
    const expensesByCategory = Array.from(expensesByCategoryMap.entries())
      .map(([category, amount]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        amount,
        percent: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Calculate alerts
    const overdueOrders = orders.filter(o => {
      if (o.status === 'completed' || o.status === 'cancelled') return false;
      if (!o.scheduled_date) return false;
      return new Date(o.scheduled_date) < now;
    });
    const dueSoonOrders = orders.filter(o => {
      if (o.status === 'completed' || o.status === 'cancelled') return false;
      if (!o.scheduled_date) return false;
      const scheduled = new Date(o.scheduled_date);
      return scheduled >= now && scheduled <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    });

    // Calculate operations snapshot
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.final_price || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const grossMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
    const labourExpenses = expensesByCategoryMap.get('wages') || expensesByCategoryMap.get('labour') || 0;
    const labourPercent = totalExpenses > 0 ? Math.round((labourExpenses / totalExpenses) * 100) : 0;

    // Build receivables list from orders with real payment data
    const receivables: ReceivableRecord[] = outstandingOrders.map((order, index) => {
      const paidAmount = paidByOrder.get(order.id) || 0;
      const totalAmount = order.final_price || 0;
      const balance = Math.max(0, totalAmount - paidAmount);

      return {
        id: `INV-${(2000 + index).toString()}`,
        jobId: `Job ${order.id.slice(0, 6)}`,
        customer: order.customer_name,
        service: SERVICE_LABELS[order.service_type] || order.service_type,
        invoiceDate: order.created_at?.split('T')[0] || '',
        dueDate: order.scheduled_date || '',
        amount: totalAmount,
        paid: paidAmount,
        balance,
        status: mapOrderStatusToReceivableStatus(
          order.status,
          order.scheduled_date,
          paidAmount,
          totalAmount
        ),
        notes: order.notes || '',
      };
    });

    // Build payables list
    const payableRecords: PayableRecord[] = payables.map(p => ({
      id: `BILL-${p.id.slice(0, 4)}`,
      supplier: p.vendor_name,
      category: p.category?.charAt(0).toUpperCase() + p.category?.slice(1) || 'Other',
      billDate: p.created_at?.split('T')[0] || '',
      dueDate: p.due_date || '',
      amount: p.amount || 0,
      status: mapPayableStatus(p.status, p.due_date),
      paymentMethod: p.paid_date ? 'Paid' : 'Pending',
      notes: p.notes || '',
    }));

    // Calculate comparison percentages
    const receivablesChange = lastMonthReceivables > 0
      ? Math.round(((outstandingOrders.length - lastMonthReceivables) / lastMonthReceivables) * 100)
      : 0;

    const lastMonthExpenses = payables
      .filter(p => {
        if (!p.paid_date) return false;
        const paidDate = new Date(p.paid_date);
        return paidDate >= startOfLastMonth && paidDate <= endOfLastMonth;
      })
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const lastMonthNetProfit = lastMonthRevenue - lastMonthExpenses;
    const profitChange = lastMonthNetProfit !== 0
      ? Math.round(((netProfit - lastMonthNetProfit) / Math.abs(lastMonthNetProfit)) * 100)
      : 0;

    // Generate revenue trend
    const revenueTrend = generateRevenueTrend(allCompletedOrders, paidPayables);

    // Generate recent activity
    const recentActivity = generateRecentActivity(orders, payables, recentPaymentsData);

    // Build jobs list
    const jobs: JobRecord[] = orders
      .filter(o => o.status !== 'completed' && o.status !== 'cancelled')
      .map(order => ({
        id: order.id,
        customer: order.customer_name,
        service: SERVICE_LABELS[order.service_type] || order.service_type,
        scheduledDate: order.scheduled_date || '',
        scheduledTime: order.scheduled_time || '',
        address: order.customers?.default_address || '',
        status: order.status === 'in_progress' ? 'in_progress' : 'scheduled',
        amount: order.final_price || 0,
        notes: order.notes || '',
      }));

    const allAlerts = buildAdminAlerts({ orders, payables, now });
    const dismissedSet = new Set(alertState.dismissedIds);
    const alertsFeed = allAlerts.filter((alert) => !dismissedSet.has(alert.id));
    const quotesById = new Map(quotesData.map((quote) => [quote.id, quote]));
    const ordersById = new Map(orders.map((order) => [order.id, order]));

    const crew = crewData.map((employee) => {
      const snapshot = buildEmployeeOnboardingSnapshot({
        employee,
        sections: sectionsByEmployee.get(employee.id) || [],
        documents: docsByEmployee.get(employee.id) || [],
      });
      const assignments = assignmentsByEmployee.get(employee.id) || [];
      const sortedDates = assignments
        .map((assignment) => assignment.orders?.scheduled_date || null)
        .filter((value): value is string => Boolean(value))
        .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());

      return {
        id: employee.id,
        full_name: employee.full_name,
        status: employee.status,
        services: employee.services,
        onboardingComplete: snapshot.onboardingComplete,
        crewAccessApproved: snapshot.crewAccessApproved,
        awaitingApproval: snapshot.awaitingApproval,
        readyForCrewApproval: snapshot.readyForCrewApproval,
        currentSectionLabel: snapshot.currentSection ? snapshot.sections.find((section) => section.section === snapshot.currentSection)?.label || null : null,
        progress: snapshot.progress,
        assignedJobs: assignments.length,
        inProgressJobs: assignments.filter((assignment) => assignment.status === 'in_progress').length,
        nextJobDate: sortedDates[0] || null,
      };
    });

    const dailySeries = createEmptyDailySeries(now);
    const dailyIndex = new Map(dailySeries.map((point, index) => [point.date, index]));

    for (const order of allCompletedOrders) {
      const dateKey = (order.completed_at || order.created_at || '').slice(0, 10);
      const index = dailyIndex.get(dateKey);
      if (index !== undefined) {
        dailySeries[index].revenue += order.final_price || 0;
      }
    }

    for (const payable of paidPayables) {
      const dateKey = (payable.paid_date || payable.created_at || '').slice(0, 10);
      const index = dailyIndex.get(dateKey);
      if (index !== undefined) {
        dailySeries[index].expenses += payable.amount || 0;
      }
    }

    const crewPayWorkers = crewData.map((employee) => {
      const payRate = Number(employee.hourly_rate || 0);
      const assignments = assignmentsByEmployee.get(employee.id) || [];
      const awardReference = resolveAwardReference(employee);
      const contributions = assignments
        .filter((assignment) => assignment.status !== 'declined' && assignment.status !== 'available')
        .map((assignment) => {
          const order = assignment.orders;
          const hours = Number(order?.estimated_duration_minutes || 0) / 60;
          const quote = order?.quote_id ? quotesById.get(order.quote_id) : undefined;
          const labourAcceptance = inferLabourAcceptance(quote);
          const date = (assignment.completed_at || order?.scheduled_date || assignment.created_at || '').slice(0, 10);

          if (assignment.status === 'completed') {
            const index = dailyIndex.get(date);
            if (index !== undefined) {
              dailySeries[index].labourCost += hours * payRate;
            }
          }

          return {
            assignmentId: `${employee.id}-${order?.id || assignment.created_at}`,
            orderId: order?.id || '',
            jobLabel: order ? `Job ${order.id.slice(0, 6)}` : 'Unlinked job',
            customer: order?.customer_name || 'Unassigned',
            service: order ? SERVICE_LABELS[order.service_type] || order.service_type : 'Unknown',
            date,
            hours,
            approved: assignment.status === 'completed',
            estimatedRevenue: Number(order?.final_price || 0),
            labourAcceptance,
          };
        })
        .filter((contribution) => contribution.hours > 0)
        .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

      const approvedHours = contributions
        .filter((contribution) => contribution.approved)
        .reduce((sum, contribution) => sum + contribution.hours, 0);
      const pendingHours = contributions
        .filter((contribution) => !contribution.approved)
        .reduce((sum, contribution) => sum + contribution.hours, 0);
      const totalHours = approvedHours + pendingHours;
      const approvedPay = approvedHours * payRate;
      const pendingPay = pendingHours * payRate;
      const minimumAwardRate = awardReference.minimumAwardRate;
      const awardVariance = minimumAwardRate == null ? null : Math.round((payRate - minimumAwardRate) * 100) / 100;
      const awardStatus: 'compliant' | 'review' | 'unconfigured' =
        minimumAwardRate == null
          ? 'unconfigured'
          : payRate >= minimumAwardRate
            ? 'compliant'
            : 'review';
      const labourAcceptanceSummary = contributions.reduce(
        (summary, contribution) => {
          summary[contribution.labourAcceptance] += 1;
          return summary;
        },
        { accepted: 0, pending: 0, missing: 0 }
      );

      const payStatus: 'Draft' | 'Ready to pay' | 'Needs review' =
        awardStatus === 'review'
          ? 'Needs review'
          : approvedHours > 0
            ? 'Ready to pay'
            : 'Draft';

      return {
        id: employee.id,
        name: employee.full_name || 'Crew member',
        role: employee.default_role || 'Crew member',
        employmentType: employee.employment_type || 'Casual',
        serviceMix: employee.services || [],
        payRate,
        awardCategory: awardReference.awardCategory,
        classification: awardReference.classification,
        minimumAwardRate,
        awardVariance,
        awardStatus,
        totalHours,
        approvedHours,
        pendingHours,
        estimatedGrossPay: totalHours * payRate,
        approvedPay,
        pendingPay,
        payStatus,
        labourAcceptanceSummary,
        contributions,
      };
    })
      .filter((worker) => worker.totalHours > 0 || worker.payRate > 0)
      .sort((left, right) => right.approvedPay - left.approvedPay);

    for (const point of dailySeries) {
      point.net = point.revenue - point.expenses;
    }

    const totalApprovedHours = crewPayWorkers.reduce((sum, worker) => sum + worker.approvedHours, 0);
    const totalPendingHours = crewPayWorkers.reduce((sum, worker) => sum + worker.pendingHours, 0);
    const totalCrewHours = totalApprovedHours + totalPendingHours;
    const payrollOwed = crewPayWorkers.reduce((sum, worker) => sum + worker.approvedPay, 0);

    const jobMargins = allCompletedOrders
      .map((order) => {
        const labourCost = crewPayWorkers.reduce((sum, worker) => {
          const contributionCost = worker.contributions
            .filter((contribution) => contribution.orderId === order.id)
            .reduce((workerSum, contribution) => workerSum + contribution.hours * worker.payRate, 0);
          return sum + contributionCost;
        }, 0);
        const quote = order.quote_id ? quotesById.get(order.quote_id) : undefined;
        const labourAcceptance = inferLabourAcceptance(quote);
        const revenue = Number(order.final_price || 0);
        const margin = revenue > 0 ? Math.round(((revenue - labourCost) / revenue) * 100) : 0;

        return {
          orderId: order.id,
          customer: order.customer_name,
          service: SERVICE_LABELS[order.service_type] || order.service_type,
          date: (order.completed_at || order.created_at || '').slice(0, 10),
          revenue,
          labourCost,
          margin,
          labourAcceptance,
        };
      })
      .sort((left, right) => left.margin - right.margin)
      .slice(0, 8);

    const receivedRevenue = paymentsData.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const depositsCollected = receivables
      .filter((record) => record.paid > 0 && record.balance > 0)
      .reduce((sum, record) => sum + record.paid, 0);
    const acceptedQuotes = quotesData.filter((quote) => inferLabourAcceptance(quote) === 'accepted');
    const quotesAcceptedValue = acceptedQuotes.reduce((sum, quote) => sum + effectiveQuoteTotal(quote), 0);

    const revenueByCustomerMap = new Map<string, { amount: number; count: number }>();
    for (const order of allCompletedOrders) {
      const key = order.customer_name || 'Customer';
      const current = revenueByCustomerMap.get(key) || { amount: 0, count: 0 };
      current.amount += order.final_price || 0;
      current.count += 1;
      revenueByCustomerMap.set(key, current);
    }
    const revenueByCustomer = Array.from(revenueByCustomerMap.entries())
      .map(([label, value]) => ({
        label,
        amount: value.amount,
        count: value.count,
        share: totalRevenue > 0 ? Math.round((value.amount / totalRevenue) * 100) : 0,
      }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 6);

    const supplierDue = upcomingPayables
      .filter((payable) => {
        const category = (payable.category || '').toLowerCase();
        return !category.includes('subscription') && !category.includes('reimburse');
      })
      .reduce((sum, payable) => sum + (payable.amount || 0), 0);
    const subscriptionCosts = payables
      .filter((payable) => (payable.category || '').toLowerCase().includes('subscription'))
      .reduce((sum, payable) => sum + (payable.amount || 0), 0);
    const reimbursementCosts = payables
      .filter((payable) => (payable.category || '').toLowerCase().includes('reimburse'))
      .reduce((sum, payable) => sum + (payable.amount || 0), 0);
    const settlementClearing = payoutsData
      .filter((payout) => payout.status === 'pending')
      .reduce((sum, payout) => sum + (payout.amount || 0), 0);

    const transactions = [
      ...recentPaymentsData.map((payment) => {
        const order = payment.order_id ? ordersById.get(payment.order_id) : undefined;
        return {
          id: `incoming-${payment.order_id || payment.paid_at}`,
          date: payment.paid_at,
          type: 'incoming' as const,
          title: order ? `${SERVICE_LABELS[order.service_type] || order.service_type} payment received` : 'Payment received',
          subtitle: order?.customer_name || 'Stripe payment',
          amount: payment.amount || 0,
          status: 'Received',
          reference: payment.order_id || undefined,
          href: '/dashboard/invoices?tab=incoming',
        };
      }),
      ...payables.slice(0, 12).map((payable) => ({
        id: `outgoing-${payable.id}`,
        date: payable.paid_date || payable.due_date || payable.created_at,
        type: 'outgoing' as const,
        title: payable.vendor_name,
        subtitle: `${payable.category || 'Expense'} · ${payable.status === 'paid' ? 'Paid' : 'Due'}`,
        amount: payable.amount || 0,
        status: payable.status === 'paid' ? 'Paid' : 'Scheduled',
        reference: payable.id,
        href: '/dashboard/invoices?tab=outgoing',
      })),
      ...crewPayWorkers
        .filter((worker) => worker.approvedPay > 0)
        .map((worker) => ({
          id: `payroll-${worker.id}`,
          date: now.toISOString(),
          type: 'payroll' as const,
          title: worker.name,
          subtitle: `${worker.approvedHours.toFixed(1)} approved hrs`,
          amount: worker.approvedPay,
          status: worker.payStatus,
          reference: worker.role,
          href: '/dashboard/invoices?tab=crew-pay',
        })),
      ...payoutsData.map((payout) => ({
        id: `settlement-${payout.id}`,
        date: payout.arrival_date || payout.created_at,
        type: 'settlement' as const,
        title: 'NAB settlement',
        subtitle: payout.failure_message || 'Stripe payout',
        amount: payout.amount || 0,
        status: payout.status,
        reference: payout.stripe_payout_id,
        href: '/dashboard/invoices?tab=transactions',
      })),
    ]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, 30);

    const lowMarginJobs = jobMargins.filter((job) => job.margin < 30);
    const missingAcceptanceCount = crewPayWorkers.reduce(
      (sum, worker) => sum + worker.labourAcceptanceSummary.missing + worker.labourAcceptanceSummary.pending,
      0
    );
    const dueSubscriptions = payables.filter((payable) => {
      const category = (payable.category || '').toLowerCase();
      if (!category.includes('subscription')) return false;
      if (!payable.due_date) return true;
      return new Date(payable.due_date) <= thirtyDaysFromNow;
    });

    const moneyAlerts = [
      overdueOrders.length > 0 ? {
        id: 'overdue-invoices',
        title: 'Overdue invoices',
        message: `${overdueOrders.length} invoices are overdue with ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(receivables.filter((record) => record.status === 'Overdue').reduce((sum, record) => sum + record.balance, 0))} still outstanding.`,
        severity: 'critical' as const,
        href: '/dashboard/invoices?tab=incoming&status=Overdue',
        actionLabel: 'Review invoices',
      } : null,
      payrollOwed > 0 ? {
        id: 'payroll-due',
        title: 'Payroll due',
        message: `${crewPayWorkers.filter((worker) => worker.approvedPay > 0).length} crew members have approved hours ready for payment.`,
        severity: 'warning' as const,
        href: '/dashboard/invoices?tab=crew-pay',
        actionLabel: 'Review pay',
      } : null,
      totalPendingHours > 0 ? {
        id: 'hours-pending',
        title: 'Unapproved labour hours',
        message: `${totalPendingHours.toFixed(1)} hours are still pending approval before payroll can run.`,
        severity: 'warning' as const,
        href: '/dashboard/invoices?tab=crew-pay',
        actionLabel: 'Approve hours',
      } : null,
      missingAcceptanceCount > 0 ? {
        id: 'labour-acceptance',
        title: 'Missing labour acceptance',
        message: `${missingAcceptanceCount} job-linked labour entries are missing clear customer pricing acceptance.`,
        severity: 'warning' as const,
        href: '/dashboard/invoices?tab=crew-pay',
        actionLabel: 'Check jobs',
      } : null,
      lowMarginJobs.length > 0 ? {
        id: 'low-margin-jobs',
        title: 'Low margin jobs',
        message: `${lowMarginJobs.length} completed jobs are sitting below a 30% labour margin reference.`,
        severity: 'info' as const,
        href: '/dashboard/invoices?tab=overview',
        actionLabel: 'Inspect margins',
      } : null,
      dueSubscriptions.length > 0 ? {
        id: 'subscriptions-due',
        title: 'Subscriptions due',
        message: `${dueSubscriptions.length} subscription-related costs are due inside the next 30 days.`,
        severity: 'info' as const,
        href: '/dashboard/invoices?tab=outgoing',
        actionLabel: 'Check costs',
      } : null,
    ].flatMap((alert) => (alert ? [alert] : []));

    // Revenue change vs last month
    const revenueChange = lastMonthRevenue > 0
      ? Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : 0;

    // Fetch goals from site settings (with defaults)
    const dashboardGoals = await getDashboardGoals().catch(() => DEFAULT_DASHBOARD_GOALS);
    const monthlyRevenueTarget = dashboardGoals.monthlyRevenueTarget;
    const monthlyJobsTarget = dashboardGoals.monthlyJobsTarget;

    // Cash balance = this month's confirmed revenue minus this month's paid expenses
    // This is what should be in the bank / Stripe balance after outgoings
    const cashBalance = totalRevenue - totalExpenses;

    // Build response
    const data: DashboardData = {
      metrics: {
        cashBalance,
        outstandingReceivables: {
          total: outstandingTotal,
          count: outstandingOrders.length,
          change: receivablesChange,
        },
        upcomingPayables: {
          total: upcomingPayablesTotal,
          count: upcomingPayables.length,
          change: upcomingChange,
        },
        netProfit: {
          amount: netProfit,
          margin: grossMargin,
          change: profitChange,
        },
        revenueByService,
        expensesByCategory,
        alerts: {
          overdueCount: overdueOrders.length,
          overdueAmount: overdueOrders.reduce((sum, o) => sum + (o.final_price || 0), 0),
          dueSoonCount: dueSoonOrders.length,
          dueSoonAmount: dueSoonOrders.reduce((sum, o) => sum + (o.final_price || 0), 0),
        },
        operationsSnapshot: {
          jobsCompleted: completedOrders.length,
          averageJobValue: completedOrders.length > 0
            ? Math.round(totalRevenue / completedOrders.length)
            : 0,
          labourPercent,
          grossMargin,
        },
        revenueTrend,
        goals: {
          monthlyRevenueTarget,
          currentRevenue: totalRevenue,
          revenueChange,
          monthlyJobsTarget,
          currentJobs: completedOrders.length,
        },
      },
      moneyFlow: {
        overview: {
          revenueThisMonth: totalRevenue,
          expensesThisMonth: totalExpenses,
          payrollOwed,
          outstandingInvoices: outstandingTotal,
          grossMargin,
          labourCostPercent: totalRevenue > 0 ? Math.round((payrollOwed / totalRevenue) * 100) : 0,
          incomingReceived: receivedRevenue,
          outgoingPaid: totalExpenses,
        },
        series: dailySeries,
        incoming: {
          expected: outstandingTotal + quotesAcceptedValue,
          received: receivedRevenue,
          overdue: receivables.filter((record) => record.status === 'Overdue').reduce((sum, record) => sum + record.balance, 0),
          depositsCollected,
          quotesAccepted: acceptedQuotes.length,
          invoicesIssued: receivables.length,
          invoicesPaid: orders.filter((order) => {
            const totalAmount = order.final_price || 0;
            const paidAmount = paidByOrder.get(order.id) || 0;
            return totalAmount > 0 && paidAmount >= totalAmount;
          }).length,
          revenueByService: revenueByService.map((item) => ({
            label: item.service,
            amount: item.amount,
            share: totalRevenue > 0 ? Math.round((item.amount / totalRevenue) * 100) : 0,
          })),
          revenueByCustomer,
        },
        outgoing: {
          due: upcomingPayablesTotal + payrollOwed,
          paid: totalExpenses,
          payrollOwed,
          supplierCosts: supplierDue,
          subscriptionCosts,
          reimbursementCosts,
          settlementClearing,
          expenseByCategory: expensesByCategory.map((item) => ({
            label: item.category,
            amount: item.amount,
            share: item.percent,
          })),
        },
        crewPay: {
          totalHours: totalCrewHours,
          approvedHours: totalApprovedHours,
          pendingHours: totalPendingHours,
          payrollOwed,
          readyCount: crewPayWorkers.filter((worker) => worker.payStatus === 'Ready to pay').length,
          needsReviewCount: crewPayWorkers.filter((worker) => worker.payStatus === 'Needs review').length,
          missingAcceptanceCount,
          workers: crewPayWorkers,
        },
        alerts: moneyAlerts,
        transactions,
        jobMargins,
      },
      receivables,
      payables: payableRecords,
      jobs,
      recentActivity,
      alertsFeed,
      dismissedAlertCount: allAlerts.length - alertsFeed.length,
      payouts: payoutsData,
      crew,
      quotes: quotesData,
      applicantCount,
      lastUpdated: now.toISOString(),
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
