import { brand } from '@/app/ui/theme';

export default function SettingsPage() {
  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: brand.primary }}>
          Settings
        </h1>
        <p className="text-sm text-slate-600">
          Manage users, notifications, and operational defaults.
        </p>
      </header>

      <div className="rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm">
        <div className="text-sm text-slate-700">
          Add toggles for access control, alert channels, and billing preferences here.
        </div>
      </div>
    </div>
  );
}
