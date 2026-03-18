'use client';

import { useState, useEffect, useCallback } from 'react';
import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

type AuditEntry = {
  id: string;
  created_at: string;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  source: string | null;
};

const ACTION_COLORS: Record<string, { bg: string; fg: string }> = {
  created: { bg: '#ECFDF5', fg: '#065F46' },
  updated: { bg: '#DBEAFE', fg: '#1E40AF' },
  deleted: { bg: '#FEE2E2', fg: '#991B1B' },
  status_changed: { bg: '#FEF3C7', fg: '#92400E' },
  assigned: { bg: '#E0E7FF', fg: '#3730A3' },
  completed: { bg: '#ECFDF5', fg: '#065F46' },
  payment_received: { bg: '#ECFDF5', fg: '#065F46' },
  refunded: { bg: '#FEE2E2', fg: '#991B1B' },
  login: { bg: '#F1F5F9', fg: '#475569' },
};

const PAGE_SIZE = 20;

function formatTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (actionFilter !== 'all') params.set('action', actionFilter);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(page * PAGE_SIZE));

      const res = await fetch(`/api/audit-log?${params}`);
      const data = await res.json();
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, page]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const actions = ['all', 'created', 'updated', 'deleted', 'status_changed', 'assigned', 'completed', 'payment_received', 'refunded'];

  return (
    <div className="grid gap-6 w-full px-4 md:px-10 lg:px-12 pb-14">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: brand.primary }}>Audit Log</h1>
          <p className="text-sm text-slate-500">Track all system changes and user actions.</p>
        </div>
        <div className="text-xs text-slate-400">{total} total entries</div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search actions, users, entities..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="flex-1 min-w-[200px] rounded-xl border px-4 py-2 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none"
          style={{ borderColor: brand.border }}
        />
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
          className="rounded-xl border px-3 py-2 text-sm text-slate-800 bg-white"
          style={{ borderColor: brand.border }}
        >
          {actions.map((a) => (
            <option key={a} value={a}>{a === 'all' ? 'All actions' : a.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button
          onClick={fetchEntries}
          className="px-4 py-2 rounded-xl text-sm text-white"
          style={{ background: brand.primary }}
        >
          Refresh
        </button>
      </div>

      {/* Log Entries */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-14 rounded-xl bg-white/50 animate-pulse" />)}</div>
      ) : (
        <div className={`${glass} overflow-hidden`}>
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/95 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-slate-100 px-4 py-2">Time</th>
                  <th className="border-b border-slate-100 px-4 py-2">User</th>
                  <th className="border-b border-slate-100 px-4 py-2">Action</th>
                  <th className="border-b border-slate-100 px-4 py-2">Entity</th>
                  <th className="border-b border-slate-100 px-4 py-2">Details</th>
                  <th className="border-b border-slate-100 px-4 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const ac = ACTION_COLORS[entry.action] || ACTION_COLORS.updated;
                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatTime(entry.created_at)}</td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-600">{entry.user_email || 'system'}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: ac.bg, color: ac.fg }}>
                          {entry.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{entry.entity_type}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[300px] truncate">{entry.details || '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{entry.source || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden divide-y divide-black/5">
            {entries.map((entry) => {
              const ac = ACTION_COLORS[entry.action] || ACTION_COLORS.updated;
              return (
                <div key={entry.id} className="p-4" onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: ac.bg, color: ac.fg }}>
                      {entry.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[11px] text-slate-400">{formatTime(entry.created_at)}</span>
                  </div>
                  <p className="text-sm" style={{ color: brand.text }}>{entry.details || `${entry.action} ${entry.entity_type}`}</p>
                  <p className="text-[11px] mt-0.5 text-slate-400">{entry.user_email || 'system'} · {entry.entity_type}</p>
                </div>
              );
            })}
          </div>

          {/* Expanded detail */}
          {expandedId && entries.find((e) => e.id === expandedId) && (() => {
            const entry = entries.find((e) => e.id === expandedId)!;
            return (
              <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-slate-500 font-medium mb-1">Entity ID</p>
                    <p className="font-mono text-slate-700">{entry.entity_id}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium mb-1">Source</p>
                    <p className="text-slate-700">{entry.source || 'N/A'}</p>
                  </div>
                  {entry.old_value && (
                    <div>
                      <p className="text-slate-500 font-medium mb-1">Old Value</p>
                      <pre className="text-[11px] bg-white rounded p-2 overflow-auto max-h-24">{JSON.stringify(entry.old_value, null, 2)}</pre>
                    </div>
                  )}
                  {entry.new_value && (
                    <div>
                      <p className="text-slate-500 font-medium mb-1">New Value</p>
                      <pre className="text-[11px] bg-white rounded p-2 overflow-auto max-h-24">{JSON.stringify(entry.new_value, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {entries.length === 0 && (
            <div className="p-8 text-center"><p className="text-sm text-slate-400">No audit entries found.</p></div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg border text-xs text-slate-600 bg-white disabled:opacity-40" style={{ borderColor: brand.border }}>
            Previous
          </button>
          <span className="text-xs text-slate-500">Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-lg border text-xs text-slate-600 bg-white disabled:opacity-40" style={{ borderColor: brand.border }}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
