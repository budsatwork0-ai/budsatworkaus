'use client';

import { useMemo } from 'react';
import { Panel, StatRow, StatusChip } from '../shared';
import { RevenueLineChart, ServicesPieChart, ServicesPieChartLegend, ExpensesBarChart, GoalProgressBar } from '../Charts';
import ActivityFeed from '../ActivityFeed';
import {
  ChartSkeleton,
  PanelSkeleton,
  ActivitySkeleton,
  GoalsSkeleton,
} from '../Skeletons';
import { formatCurrency } from '@/lib/dashboard/utils';
import type { DashboardMetrics, ActivityItem } from '@/types/dashboard';

type OverviewTabProps = {
  metrics: DashboardMetrics | null;
  recentActivity: ActivityItem[];
  isLoading: boolean;
};

export default function OverviewTab({ metrics, recentActivity, isLoading }: OverviewTabProps) {
  const pieChartData = useMemo(
    () =>
      metrics?.revenueByService.map((item) => ({
        name: item.service,
        value: item.amount,
      })) ?? [],
    [metrics]
  );

  const barChartData = useMemo(() => metrics?.expensesByCategory ?? [], [metrics]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
      <div className="space-y-4">
        {/* Revenue Trend Chart */}
        <Panel title="Revenue & Expenses Trend" subtitle="Last 6 months">
          {isLoading ? (
            <ChartSkeleton height={220} />
          ) : metrics?.revenueTrend && metrics.revenueTrend.length > 0 ? (
            <RevenueLineChart data={metrics.revenueTrend} />
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-500">
              No trend data available yet
            </div>
          )}
        </Panel>

        {/* Revenue by Service */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Panel title="Revenue by Service" subtitle="Month-to-date">
            {isLoading ? (
              <ChartSkeleton height={200} />
            ) : pieChartData.length > 0 ? (
              <>
                <ServicesPieChart data={pieChartData} />
                <ServicesPieChartLegend data={pieChartData} />
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-slate-500">
                No revenue data yet
              </div>
            )}
          </Panel>

          <Panel title="Expenses by Category" subtitle="Distribution">
            {isLoading ? (
              <ChartSkeleton height={200} />
            ) : barChartData.length > 0 ? (
              <ExpensesBarChart data={barChartData} />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-slate-500">
                No expense data yet
              </div>
            )}
          </Panel>
        </div>

        {/* Operations Snapshot */}
        <Panel title="Operations Snapshot" subtitle="Jobs + labour">
          {isLoading ? (
            <PanelSkeleton rows={4} />
          ) : (
            <div className="space-y-3">
              <StatRow label="Jobs completed (MTD)" value={`${metrics?.operationsSnapshot.jobsCompleted ?? 0}`} />
              <StatRow label="Average job value" value={formatCurrency(metrics?.operationsSnapshot.averageJobValue ?? 0)} />
              <StatRow label="Labour % of revenue" value={`${metrics?.operationsSnapshot.labourPercent ?? 0}%`} />
              <StatRow label="Gross margin" value={`${metrics?.operationsSnapshot.grossMargin ?? 0}%`} />
            </div>
          )}
        </Panel>
      </div>

      <div className="space-y-4">
        {/* Goals & Targets */}
        <Panel title="Monthly Goals" subtitle="Track your targets">
          {isLoading ? (
            <GoalsSkeleton />
          ) : (
            <div className="space-y-4">
              <GoalProgressBar
                current={metrics?.goals.currentRevenue ?? 0}
                target={metrics?.goals.monthlyRevenueTarget ?? 15000}
                label="Revenue Target"
              />
              <GoalProgressBar
                current={metrics?.goals.currentJobs ?? 0}
                target={metrics?.goals.monthlyJobsTarget ?? 30}
                label="Jobs Target"
              />
            </div>
          )}
        </Panel>

        {/* Alerts */}
        <Panel title="Alerts" subtitle="Requires attention">
          {isLoading ? (
            <PanelSkeleton rows={2} />
          ) : (
            <div className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500">Overdue invoices</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {metrics?.alerts.overdueCount ?? 0} · {formatCurrency(metrics?.alerts.overdueAmount ?? 0)}
                  </p>
                </div>
                <StatusChip status="Overdue" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-slate-500">Due this week</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {metrics?.alerts.dueSoonCount ?? 0} · {formatCurrency(metrics?.alerts.dueSoonAmount ?? 0)}
                  </p>
                </div>
                <StatusChip status="Upcoming" />
              </div>
            </div>
          )}
        </Panel>

        {/* Activity Feed */}
        <Panel title="Recent Activity" subtitle="Latest updates" className="max-h-[400px] overflow-hidden">
          {isLoading ? (
            <ActivitySkeleton items={5} />
          ) : (
            <div className="max-h-[300px] overflow-y-auto -mx-4 px-4">
              <ActivityFeed activities={recentActivity} />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
