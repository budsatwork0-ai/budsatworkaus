'use client';

interface LoadingSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
}

export default function LoadingSkeleton({ rows = 5, columns = 6, showHeader = true }: LoadingSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white/90 animate-pulse">
      <div className="overflow-auto">
        <table className="w-full">
          {showHeader && (
            <thead className="bg-white/95">
              <tr>
                {Array.from({ length: columns }).map((_, i) => (
                  <th key={i} className="border-b border-slate-100 px-3 py-3">
                    <div className="h-3 bg-slate-200 rounded w-20" />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-slate-100">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="px-3 py-4">
                    <div
                      className="h-4 bg-slate-200 rounded"
                      style={{ width: `${60 + Math.random() * 40}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/90 px-4 py-3 animate-pulse">
      <div className="h-3 bg-slate-200 rounded w-24 mb-2" />
      <div className="h-6 bg-slate-200 rounded w-16 mb-1" />
      <div className="h-3 bg-slate-200 rounded w-20" />
    </div>
  );
}

export function SummaryCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
