import { brand } from '@/app/ui/theme';

export default function InductionsPage() {
  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: brand.primary }}>
          Inductions
        </h1>
        <p className="text-sm text-slate-600">
          Central place to track onboarding steps, checks, and approvals.
        </p>
      </header>

      <div className="rounded-2xl border border-black/5 bg-white/90 p-4 shadow-sm">
        <div className="text-sm text-slate-700">
          Add your onboarding checklist, status, and document collection here.
        </div>
      </div>
    </div>
  );
}
