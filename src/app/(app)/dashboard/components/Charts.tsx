'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { brand } from '@/app/ui/theme';
import { formatCurrency } from '@/lib/dashboard/utils';

const COLORS = [brand.primary, '#10B981', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6'];

type RevenueDataPoint = {
  month: string;
  revenue: number;
  expenses: number;
};

type ServiceDataPoint = {
  name: string;
  value: number;
};

type ExpenseDataPoint = {
  category: string;
  amount: number;
  percent: number;
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-black/10 bg-white px-3 py-2 shadow-lg">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function RevenueLineChart({ data }: { data: RevenueDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#64748B' }}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748B' }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          axisLine={{ stroke: '#E5E7EB' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke={brand.primary}
          strokeWidth={2}
          dot={{ fill: brand.primary, strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6 }}
          name="Revenue"
        />
        <Line
          type="monotone"
          dataKey="expenses"
          stroke="#EF4444"
          strokeWidth={2}
          dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6 }}
          name="Expenses"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ServicesPieChart({ data }: { data: ServiceDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value) || 0), 'Revenue']}
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ServicesPieChartLegend({ data }: { data: ServiceDataPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {data.map((item, index) => (
        <div key={item.name} className="flex items-center gap-1.5 text-xs">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: COLORS[index % COLORS.length] }}
          />
          <span className="text-slate-600">{item.name}</span>
          <span className="text-slate-400">({Math.round((item.value / total) * 100)}%)</span>
        </div>
      ))}
    </div>
  );
}

export function ExpensesBarChart({ data }: { data: ExpenseDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#64748B' }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
        />
        <YAxis
          type="category"
          dataKey="category"
          tick={{ fontSize: 11, fill: '#64748B' }}
          width={80}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value) || 0), 'Amount']}
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        />
        <Bar dataKey="amount" fill={brand.primary} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GoalProgressBar({
  current,
  target,
  label
}: {
  current: number;
  target: number;
  label: string;
}) {
  const percentage = Math.min((current / target) * 100, 100);
  const isOnTrack = percentage >= 75;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">
          {formatCurrency(current)} / {formatCurrency(target)}
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isOnTrack ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{Math.round(percentage)}% complete</span>
        {percentage < 100 && (
          <span>{formatCurrency(target - current)} remaining</span>
        )}
      </div>
    </div>
  );
}
