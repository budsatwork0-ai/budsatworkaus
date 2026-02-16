'use client';

import { brand } from '@/app/ui/theme';
import type { ActivityItem } from '../hooks/useDashboardData';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);

const formatRelativeTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
};

const typeIcons: Record<ActivityItem['type'], React.ReactNode> = {
  payment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  booking: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  invoice: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h4" />
    </svg>
  ),
  expense: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path d="M2 12h20M2 6h20M2 18h20" />
    </svg>
  ),
  job_completed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
};

const typeColors: Record<ActivityItem['type'], string> = {
  payment: '#10B981',
  booking: '#6366F1',
  invoice: brand.primary,
  expense: '#EF4444',
  job_completed: '#10B981',
};

const typeBgColors: Record<ActivityItem['type'], string> = {
  payment: 'bg-emerald-50',
  booking: 'bg-indigo-50',
  invoice: 'bg-emerald-50',
  expense: 'bg-red-50',
  job_completed: 'bg-emerald-50',
};

export default function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-6 w-6 text-slate-400"
          >
            <path d="M12 8v4l3 3" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">No recent activity</p>
        <p className="text-xs text-slate-400 mt-1">Activity will appear here as things happen</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((activity, index) => (
        <div
          key={activity.id}
          className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors"
        >
          <div
            className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${typeBgColors[activity.type]}`}
            style={{ color: typeColors[activity.type] }}
          >
            {typeIcons[activity.type]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{activity.title}</p>
                <p className="text-xs text-slate-500 truncate">{activity.description}</p>
              </div>
              <div className="shrink-0 text-right">
                {activity.amount !== undefined && (
                  <p
                    className="text-sm font-semibold"
                    style={{
                      color:
                        activity.type === 'expense' ? '#EF4444' : activity.type === 'payment' || activity.type === 'job_completed' ? '#10B981' : brand.text,
                    }}
                  >
                    {activity.type === 'expense' ? '-' : ''}
                    {formatCurrency(activity.amount)}
                  </p>
                )}
                <p className="text-[10px] text-slate-400">{formatRelativeTime(activity.timestamp)}</p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
