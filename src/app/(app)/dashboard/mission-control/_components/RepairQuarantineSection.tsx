export type QuarantineRow = {
  id: string;
  branch: string;
  commit_sha: string | null;
  deployment_id: string | null;
  error_text: string | null;
  failing_file: string | null;
  failing_line: number | null;
  source_agent: string | null;
  rejection_reason: string | null;
  attempt_count: number;
  status: 'blocked_for_repair' | 'abandoned' | 'resolved';
  blocked_until: string;
  updated_at: string;
};

const GROUP_ORDER: QuarantineRow['status'][] = ['abandoned', 'blocked_for_repair', 'resolved'];

const GROUP_LABEL: Record<QuarantineRow['status'], string> = {
  abandoned:          'Abandoned — fresh branch from main required',
  blocked_for_repair: 'Blocked for repair — retry after window expires',
  resolved:           'Resolved',
};

const STATUS_PILL: Record<QuarantineRow['status'], string> = {
  abandoned:          'bg-rose-500/15 text-rose-400',
  blocked_for_repair: 'bg-amber-500/15 text-amber-400',
  resolved:           'bg-emerald-500/15 text-emerald-400',
};

const STATUS_LABEL: Record<QuarantineRow['status'], string> = {
  abandoned:          'Abandoned',
  blocked_for_repair: 'Blocked',
  resolved:           'Resolved',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
  });
}

function shortError(text: string | null): string {
  if (!text) return '—';
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const hit = lines.find(
    (l) => l.includes('error TS') || l.includes('Type error') || l.includes('Cannot find'),
  );
  return (hit ?? lines[0] ?? '—').slice(0, 110);
}

export function RepairQuarantineSection({ rows }: { rows: QuarantineRow[] }) {
  const active = rows.filter((r) => r.status !== 'resolved');

  return (
    <section className="mt-6">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">
          Repair Quarantine
        </h3>
        {active.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/15 text-rose-400">
            {active.length} active
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-6 text-center text-xs text-white/35">
          No repair quarantines active.
        </div>
      ) : (
        <div className="space-y-5">
          {GROUP_ORDER.map((status) => {
            const group = rows.filter((r) => r.status === status);
            if (group.length === 0) return null;
            return (
              <div key={status}>
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/35 mb-1.5">
                  {GROUP_LABEL[status]}
                </p>
                <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.04]">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <Th>Branch</Th>
                        <Th>Status</Th>
                        <Th>Attempts</Th>
                        <Th>Blocked until</Th>
                        <Th>Failing file</Th>
                        <Th>Error</Th>
                        <Th>Agent</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((row) => (
                        <tr key={row.id} className="border-t border-white/[0.05]">
                          <Td>
                            <span className="font-mono text-white/80">{row.branch}</span>
                          </Td>
                          <Td>
                            <span className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-medium ${STATUS_PILL[row.status]}`}>
                              {STATUS_LABEL[row.status]}
                            </span>
                          </Td>
                          <Td className="text-center text-white/60">{row.attempt_count}</Td>
                          <Td className="text-white/50 whitespace-nowrap">
                            {row.status === 'resolved' ? '—' : fmt(row.blocked_until)}
                          </Td>
                          <Td>
                            {row.failing_file ? (
                              <span className="font-mono text-white/60">
                                {row.failing_file}
                                {row.failing_line != null ? `:${row.failing_line}` : ''}
                              </span>
                            ) : (
                              <span className="text-white/30">—</span>
                            )}
                          </Td>
                          <Td className="text-white/50 max-w-[220px] truncate">
                            {shortError(row.error_text)}
                          </Td>
                          <Td className="text-white/45">{row.source_agent ?? '—'}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left text-[10px] font-medium uppercase tracking-wide px-3 py-2 text-white/40">
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
