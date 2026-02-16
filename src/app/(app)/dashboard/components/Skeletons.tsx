'use client';

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/90 px-4 py-4 shadow-sm animate-pulse">
      <div className="h-3 w-24 bg-slate-200 rounded mb-3" />
      <div className="h-8 w-32 bg-slate-200 rounded mb-2" />
      <div className="h-3 w-20 bg-slate-100 rounded" />
    </div>
  );
}

export function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="animate-pulse" style={{ height }}>
      <div className="h-full w-full bg-gradient-to-t from-slate-100 to-slate-50 rounded-xl" />
    </div>
  );
}

export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/90 px-4 py-4 shadow-sm animate-pulse">
      <div className="h-4 w-32 bg-slate-200 rounded mb-2" />
      <div className="h-3 w-24 bg-slate-100 rounded mb-4" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-3 w-20 bg-slate-100 rounded" />
            <div className="h-4 w-16 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/90 overflow-hidden animate-pulse">
      {/* Header */}
      <div className="bg-slate-50 px-4 py-3 flex gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-3 w-20 bg-slate-200 rounded" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-t border-slate-100 flex gap-4">
          {[1, 2, 3, 4, 5].map((j) => (
            <div key={j} className="h-4 w-20 bg-slate-100 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ActivitySkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-3 py-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-slate-200 rounded mb-1" />
            <div className="h-3 w-48 bg-slate-100 rounded" />
          </div>
          <div className="text-right">
            <div className="h-4 w-16 bg-slate-200 rounded mb-1" />
            <div className="h-2 w-10 bg-slate-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GoalsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div>
        <div className="flex justify-between mb-2">
          <div className="h-4 w-24 bg-slate-200 rounded" />
          <div className="h-4 w-32 bg-slate-200 rounded" />
        </div>
        <div className="h-3 w-full bg-slate-100 rounded-full" />
        <div className="flex justify-between mt-1">
          <div className="h-3 w-16 bg-slate-100 rounded" />
          <div className="h-3 w-20 bg-slate-100 rounded" />
        </div>
      </div>
      <div>
        <div className="flex justify-between mb-2">
          <div className="h-4 w-20 bg-slate-200 rounded" />
          <div className="h-4 w-28 bg-slate-200 rounded" />
        </div>
        <div className="h-3 w-full bg-slate-100 rounded-full" />
      </div>
    </div>
  );
}
