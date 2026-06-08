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
  created_at: string;
  updated_at: string;
};

const STATUS_LABEL: Record<QuarantineRow['status'], string> = {
  blocked_for_repair: 'Blocked',
  abandoned:          'Abandoned',
  resolved:           'Resolved',
};

const STATUS_PILL: Record<QuarantineRow['status'], string> = {
  blocked_for_repair: 'text-amber-700 bg-amber-50',
  abandoned:          'text-rose-700  bg-rose-50',
  resolved:           'text-emerald-700 bg-emerald-50',
};

const GROUP_ORDER: QuarantineRow['status'][] = ['abandoned', 'blocked_for_repair', 'resolved'];

const GROUP_HEADING: Record<QuarantineRow['status'], string> = {
  abandoned:          'Abandoned — fresh branch from main required',
  blocked_for_repair: 'Blocked for repair — retry after window expires',
  resolved:           'Resolved',
};

const GROUP_BORDER: Record<QuarantineRow['status'], string> = {
  abandoned:          'border-rose-200',
  blocked_for_repair: 'border-amber-200',
  resolved:           'border-zinc-200',
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
  // Surface the first line that looks like a TypeScript error
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const errLine = lines.find(
    (l) => l.includes('error TS') || l.includes('Type error') || l.includes('Cannot find'),
  );
  return (errLine ?? lines[0] ?? '—').slice(0, 120);
}

export function RepairQuarantinePanel({ rows }: { rows: QuarantineRow[] }) {
  const active = rows.filter((r) => r.status !== 'resolved');

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-base font-semibold text-zinc-900">Repair Quarantine</h2>
        {active.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700">
            {active.length} active
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-8 text-center text-sm text-zinc-500">
          No repair quarantines active.
        </div>
      ) : (
        <div className="space-y-6">
          {GROUP_ORDER.map((status) => {
            const group = rows.filter((r) => r.status === status);
            if (group.length === 0) return null;
            return (
              <div key={status}>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 mb-2">
                  {GROUP_HEADING[status]}
                </p>
                <div className={`overflow-hidden rounded-lg border bg-white ${GROUP_BORDER[status]}`}>
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-zinc-600">
                      <tr>
                        <Th>Branch</Th>
                        <Th>Status</Th>
                        <Th>Attempts</Th>
                        <Th>Blocked until</Th>
                        <Th>Failing file</Th>
                        <Th>Error</Th>
                        <Th>Source agent</Th>
                        <Th>Deployment</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((row) => (
                        <tr key={row.id} className="border-t border-zinc-100">
                          <Td>
                            <span className="font-mono text-xs text-zinc-800">{row.branch}</span>
                          </Td>
                          <Td>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${STATUS_PILL[row.status]}`}>
                              {STATUS_LABEL[row.status]}
                            </span>
                          </Td>
                          <Td className="text-center">{row.attempt_count}</Td>
                          <Td className="text-zinc-500 whitespace-nowrap">
                            {row.status === 'resolved' ? '—' : fmt(row.blocked_until)}
                          </Td>
                          <Td>
                            {row.failing_file ? (
                              <span className="font-mono text-xs text-zinc-700">
                                {row.failing_file}
                                {row.failing_line != null ? `:${row.failing_line}` : ''}
                              </span>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </Td>
                          <Td className="text-zinc-600 max-w-xs truncate">
                            {shortError(row.error_text)}
                          </Td>
                          <Td className="text-zinc-500">{row.source_agent ?? '—'}</Td>
                          <Td>
                            {row.deployment_id ? (
                              <span className="font-mono text-xs text-zinc-500 truncate max-w-[120px] block">
                                {row.deployment_id}
                              </span>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </Td>
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
    <th className="text-left text-xs font-medium uppercase tracking-wide px-3 py-2">
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
