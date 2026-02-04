import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

type Stage = {
  key: string;
  label: string;
  color: string;
  jobs: { id: string; customer: string; service: string; time: string }[];
};

const STAGES: Stage[] = [
  {
    key: 'scheduled',
    label: 'Scheduled',
    color: '#8b5cf6',
    jobs: [
      { id: 'J-071', customer: 'Sarah M.', service: 'Deep clean', time: 'Thu 9am' },
      { id: 'J-072', customer: 'Tom B.', service: 'Bin cleans (x3)', time: 'Thu 11am' },
      { id: 'J-073', customer: 'Lina P.', service: 'Window clean', time: 'Fri 8am' },
    ],
  },
  {
    key: 'en_route',
    label: 'En Route',
    color: '#3b82f6',
    jobs: [
      { id: 'J-068', customer: 'Mark D.', service: 'Yard mow & edge', time: 'ETA 15min' },
    ],
  },
  {
    key: 'onsite',
    label: 'Onsite',
    color: '#f59e0b',
    jobs: [
      { id: 'J-066', customer: 'Rachel W.', service: 'End of lease clean', time: 'Started 10:20am' },
      { id: 'J-067', customer: 'James K.', service: 'Car detail (interior)', time: 'Started 9:45am' },
    ],
  },
  {
    key: 'qc',
    label: 'QC / Review',
    color: '#06b6d4',
    jobs: [
      { id: 'J-064', customer: 'Amy S.', service: 'Window clean', time: 'Awaiting photos' },
    ],
  },
  {
    key: 'done',
    label: 'Done',
    color: '#22c55e',
    jobs: [
      { id: 'J-061', customer: 'Chris N.', service: 'Dump run (trailer)', time: 'Completed 8:30am' },
      { id: 'J-062', customer: 'Helen T.', service: 'Regular clean', time: 'Completed 11:00am' },
    ],
  },
];

export default function PipelinesPage() {
  const totalJobs = STAGES.reduce((sum, s) => sum + s.jobs.length, 0);
  const activeJobs = STAGES.filter(s => s.key !== 'done').reduce((sum, s) => sum + s.jobs.length, 0);

  return (
    <div className="min-h-screen" style={{ background: brand.bg }}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>Workflows</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>
          Job pipelines from scheduling through to completion.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        {[
          { label: 'Total jobs', value: String(totalJobs), color: brand.text },
          { label: 'Active', value: String(activeJobs), color: brand.primary },
          { label: 'Completed today', value: String(STAGES.find(s => s.key === 'done')?.jobs.length ?? 0), color: '#22c55e' },
          { label: 'SLA on-time', value: '94%', color: '#22c55e' },
        ].map(s => (
          <div key={s.label} className={`${glass} rounded-2xl p-3`} style={{ borderColor: brand.border, background: brand.card }}>
            <div className="text-[11px] uppercase tracking-wide" style={{ color: brand.muted }}>{s.label}</div>
            <div className="text-xl font-semibold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Kanban-style board */}
      <div className="overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-3 min-w-[900px]">
          {STAGES.map(stage => (
            <div key={stage.key} className="flex-1 min-w-[170px]">
              {/* Column header */}
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                <div className="text-xs font-semibold" style={{ color: brand.text }}>{stage.label}</div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{stage.jobs.length}</span>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {stage.jobs.map(job => (
                  <div
                    key={job.id}
                    className={`${glass} rounded-xl p-3`}
                    style={{ borderColor: brand.border, background: brand.card, borderLeftWidth: 3, borderLeftColor: stage.color }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium" style={{ color: brand.muted }}>{job.id}</span>
                      <span className="text-[10px]" style={{ color: brand.muted }}>{job.time}</span>
                    </div>
                    <div className="text-sm font-medium" style={{ color: brand.text }}>{job.customer}</div>
                    <div className="text-[11px]" style={{ color: brand.muted }}>{job.service}</div>
                  </div>
                ))}

                {stage.jobs.length === 0 && (
                  <div className="rounded-xl border border-dashed p-4 text-center" style={{ borderColor: brand.border }}>
                    <div className="text-xs" style={{ color: brand.muted }}>No jobs</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs mt-6" style={{ color: brand.muted }}>
        Design-only. Jobs are sample data. Stages will update in real-time when connected to the order system.
      </p>
    </div>
  );
}
