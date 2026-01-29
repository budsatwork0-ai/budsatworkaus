import { brand } from '@/app/ui/theme';

export default function AlertsPage() {
  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: brand.primary }}>
          Alerts
        </h1>
        <p className="text-sm text-slate-600">
          Surface urgent issues and reminders across jobs and teams.
        </p>
      </header>

      <div className="rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm">
        <div className="text-sm text-slate-700">
          Configure alert rules, priorities, and recipients here.
        </div>
      </div>
    </div>
  );
}
