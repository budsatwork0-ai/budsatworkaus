import { NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import type { Order, Payable } from '@/types/database';

export const dynamic = 'force-dynamic';

export type DashboardMetrics = {
  cashBalance: number;
  outstandingReceivables: {
    total: number;
    count: number;
  };
  upcomingPayables: {
    total: number;
    count: number;
  };
  netProfit: {
    amount: number;
    margin: number;
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

export type DashboardData = {
  metrics: DashboardMetrics;
  receivables: ReceivableRecord[];
  payables: PayableRecord[];
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
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Fetch all data in parallel
    const [
      ordersResult,
      completedOrdersResult,
      payablesResult,
    ] = await Promise.all([
      // All non-cancelled orders for receivables
      client
        .from('orders')
        .select('*')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false }),

      // Completed orders this month for revenue
      client
        .from('orders')
        .select('*')
        .eq('status', 'completed')
        .gte('completed_at', startOfMonth.toISOString()),

      // All payables
      client
        .from('payables')
        .select('*')
        .order('due_date', { ascending: true }),
    ]);

    // Handle errors
    if (ordersResult.error) throw ordersResult.error;
    if (completedOrdersResult.error) throw completedOrdersResult.error;

    const orders: Order[] = ordersResult.data || [];
    const completedOrders: Order[] = completedOrdersResult.data || [];
    const payables: Payable[] = payablesResult.data || [];

    // Calculate outstanding receivables (non-completed orders)
    const outstandingOrders = orders.filter(o => o.status !== 'completed');
    const outstandingTotal = outstandingOrders.reduce((sum, o) => sum + (o.final_price || 0), 0);

    // Calculate upcoming payables (next 30 days, pending)
    const upcomingPayables = payables.filter(p => {
      if (p.status === 'paid') return false;
      if (!p.due_date) return true;
      const dueDate = new Date(p.due_date);
      return dueDate <= thirtyDaysFromNow;
    });
    const upcomingPayablesTotal = upcomingPayables.reduce((sum, p) => sum + (p.amount || 0), 0);

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

    // Build receivables list from orders
    const receivables: ReceivableRecord[] = outstandingOrders.map((order, index) => ({
      id: `INV-${(2000 + index).toString()}`,
      jobId: `Job ${order.id.slice(0, 6)}`,
      customer: order.customer_name,
      service: SERVICE_LABELS[order.service_type] || order.service_type,
      invoiceDate: order.created_at?.split('T')[0] || '',
      dueDate: order.scheduled_date || '',
      amount: order.final_price || 0,
      paid: 0, // Would need a payments table to track partial payments
      balance: order.final_price || 0,
      status: mapOrderStatusToReceivableStatus(
        order.status,
        order.scheduled_date,
        0,
        order.final_price || 0
      ),
      notes: order.notes || '',
    }));

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

    // Build response
    const data: DashboardData = {
      metrics: {
        cashBalance: 0, // Would need a bank integration or manual entry
        outstandingReceivables: {
          total: outstandingTotal,
          count: outstandingOrders.length,
        },
        upcomingPayables: {
          total: upcomingPayablesTotal,
          count: upcomingPayables.length,
        },
        netProfit: {
          amount: netProfit,
          margin: grossMargin,
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
      },
      receivables,
      payables: payableRecords,
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
