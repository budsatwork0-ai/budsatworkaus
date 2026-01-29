import { brand } from '@/app/ui/theme';

export default function ReportsPage() {
  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: brand.primary }}>
          Reports
        </h1>
        <p className="text-sm text-slate-600">
          Export performance, revenue, and compliance snapshots.
        </p>
      </header>

      <div className="rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm">
        <div className="text-sm text-slate-700">
          Choose metrics and periods to generate CSV/PDF summaries here.
        </div>
      </div>
    </div>
  );
}
