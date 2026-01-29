import { brand } from '@/app/ui/theme';

export default function PipelinesPage() {
  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: brand.primary }}>
          Workflows
        </h1>
        <p className="text-sm text-slate-600">
          One place to see job pipelines and inductions so everything serves the public booking flow.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: 'Arrivals today', value: '12', hint: '3 late' },
          { label: 'In-progress', value: '28', hint: 'SLA: 94% on time' },
          { label: 'Inductions active', value: '7', hint: '2 pending checks' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-black/5 bg-white/90 p-3 shadow-[0_10px_20px_rgba(2,6,23,0.04)]"
          >
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{stat.label}</div>
            <div className="text-xl font-semibold text-slate-900">{stat.value}</div>
            {stat.hint && <div className="text-xs text-emerald-600 mt-0.5">{stat.hint}</div>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-semibold" style={{ color: brand.primary }}>
                Job pipelines
              </div>
              <div className="text-xs text-slate-600">Arrival → In-progress → Completed</div>
            </div>
            <button className="text-xs px-3 py-1.5 rounded-lg border border-black/10 bg-white">
              Open board
            </button>
          </div>
          <div className="rounded-xl border border-dashed border-black/10 bg-white/70 p-4 text-sm text-slate-600">
            Drop your stages here (e.g., Schedule, En route, Onsite, QC, Done). Tie these to the public booking so every job shows where it is.
          </div>
        </section>

        <section className="rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-semibold" style={{ color: brand.primary }}>
                Inductions
              </div>
              <div className="text-xs text-slate-600">Checks, training, readiness</div>
            </div>
            <button className="text-xs px-3 py-1.5 rounded-lg border border-black/10 bg-white">
              View all
            </button>
          </div>
          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center justify-between rounded-lg border border-black/5 bg-white/80 px-3 py-2">
              <span>Background / ID</span>
              <span className="text-emerald-600 text-xs">5/7 cleared</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-black/5 bg-white/80 px-3 py-2">
              <span>Training modules</span>
              <span className="text-amber-600 text-xs">2 need follow-up</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-black/5 bg-white/80 px-3 py-2">
              <span>Shadow shifts</span>
              <span className="text-slate-700 text-xs">Schedule 3</span>
            </div>
            <p className="text-xs text-slate-600">
              Keep inductions here so your public services stay staffed and compliant.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
