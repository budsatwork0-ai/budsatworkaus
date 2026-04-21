import { NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
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
  receivables: ReceivableRecord[];
  payables: PayableRecord[];
  jobs: JobRecord[];
  recentActivity: ActivityItem[];
  payouts: PayoutRecord[];
  crew: { id: string; full_name: string | null; status: string; services: string[] | null }[];
  quotes: { id: string; status: string; customer_name: string | null; service_type: string | null; created_at: string; submitted_total: number | null; reviewed_total: number | null; total: number | null }[];
  applicantCount: number;
  lastUpdated: string;
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
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

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
        .gte('completed_at', sixMonthsAgo.toISOString()),

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
        .select('id, full_name, status, services')
        .order('created_at', { ascending: false }),

      // All quotes for pipeline calculations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)
        .from('quotes')
        .select('id, status, customer_name, service_type, created_at, submitted_total, reviewed_total, total')
        .order('created_at', { ascending: false })
        .limit(200),

      // Intake applicants count (non-community roles)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any)
        .from('applicants')
        .select('id, role')
        .eq('stage', 'intake'),
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
    const crewData: { id: string; full_name: string | null; status: string; services: string[] | null }[] = crewResult?.data || [];
    const quotesData: { id: string; status: string; customer_name: string | null; service_type: string | null; created_at: string; submitted_total: number | null; reviewed_total: number | null; total: number | null }[] = quotesResult?.data || [];
    const communityRoles = new Set(['Quality partner', 'Sponsor', 'Innovation partner']);
    const applicantCount = (applicantsResult?.data || []).filter(
      (a: { role?: string }) => !communityRoles.has(a.role || '')
    ).length;

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
      receivables,
      payables: payableRecords,
      jobs,
      recentActivity,
      payouts: payoutsData,
      crew: crewData,
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
