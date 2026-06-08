import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { RepairQuarantinePanel, type QuarantineRow } from './_components/RepairQuarantinePanel';

async function fetchQuarantine(): Promise<QuarantineRow[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await supabase
    .from('bud_repair_quarantine')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100);
  return (data ?? []) as QuarantineRow[];
}

export default async function AgentsDashboardPage() {
  const rows = await fetchQuarantine();

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Agents</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Autonomous agent system — repair quarantine and branch health.
          </p>
        </div>
        <Link
          href="/dashboard/mission-control"
          className="text-sm text-zinc-500 hover:text-zinc-800 underline underline-offset-2 transition-colors"
        >
          Full agent management →
        </Link>
      </div>

      <RepairQuarantinePanel rows={rows} />
    </div>
  );
}
