'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

type Employee = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  services: string[] | null;
  suburb: string | null;
  status: string;
  role: string | null;
};

const SERVICE_LABELS: Record<string, string> = {
  windows: 'Windows', cleaning: 'Cleaning', yard: 'Yard',
  dump: 'Dump', auto: 'Auto', laundry_sneakers: 'Laundry',
};

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  active: { bg: '#ECFDF5', fg: '#065F46' },
  inactive: { bg: '#F1F5F9', fg: '#475569' },
  suspended: { bg: '#FEE2E2', fg: '#991B1B' },
};

const ROLE_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  admin: { bg: '#FEF3C7', fg: '#92400E', label: 'Admin' },
  employee: { bg: '#EFF6FF', fg: '#1E40AF', label: 'Employee' },
};

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function CrewManagementPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [hideAdmins, setHideAdmins] = useState(false);

  const [form, setForm] = useState({ full_name: '', email: '', role: 'employee' as 'employee' | 'admin' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  function loadEmployees() {
    setLoading(true);
    fetch('/api/crew/employees')
      .then((r) => r.json())
      .then((data) => setEmployees(data.employees || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadEmployees(); }, []);

  const activeCount = employees.filter((e) => e.status === 'active').length;
  const visibleEmployees = hideAdmins ? employees.filter((e) => e.role !== 'admin') : employees;

  async function handleStatusToggle(emp: Employee) {
    if (!emp.user_id) return;
    const action = emp.status === 'suspended' ? 'activate' : 'suspend';
    setStatusUpdating(true);
    const res = await fetch(`/api/users/${emp.user_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    setStatusUpdating(false);
    if (res.ok) {
      const newStatus = action === 'suspend' ? 'suspended' : 'active';
      setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, status: newStatus } : e));
      setSelected((prev) => prev?.id === emp.id ? { ...prev, status: newStatus } : prev);
    }
  }

  async function handleRoleToggle(emp: Employee) {
    if (!emp.user_id) return;
    const newRole = emp.role === 'admin' ? 'employee' : 'admin';
    setRoleUpdating(true);
    const res = await fetch('/api/users/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: emp.user_id, role: newRole }),
    });
    setRoleUpdating(false);
    if (res.ok) {
      setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, role: newRole } : e));
      setSelected((prev) => prev?.id === emp.id ? { ...prev, role: newRole } : prev);
    }
  }

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    setCreateSuccess('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setCreateLoading(false);
    if (!res.ok) {
      setCreateError(data.error || 'Failed to create account');
      return;
    }
    setCreateSuccess(`Invite sent to ${form.email}`);
    setForm({ full_name: '', email: '', role: 'employee' });
    loadEmployees();
    setTimeout(() => { setShowCreate(false); setCreateSuccess(''); }, 1500);
  }

  return (
    <div className="grid gap-6 w-full px-4 md:px-10 lg:px-12 pb-14">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: brand.primary }}>Crew Management</h1>
          <p className="text-sm text-slate-500">Manage crew members, roles, and compliance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHideAdmins((v) => !v)}
            className="rounded-xl px-3 py-2 text-xs font-medium border transition-colors"
            style={hideAdmins
              ? { background: brand.primary, color: 'white', borderColor: brand.primary }
              : { background: 'transparent', color: brand.muted, borderColor: '#E2E8F0' }}
          >
            {hideAdmins ? 'Show admins' : 'Hide admins'}
          </button>
          <button
            onClick={() => { setShowCreate(true); setCreateError(''); setCreateSuccess(''); }}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow transition-opacity hover:opacity-90"
            style={{ background: brand.primary }}
          >
            <PlusIcon />
            Invite Staff
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`${glass} p-4`}>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: brand.muted }}>Active Crew</p>
          <p className="text-2xl font-bold mt-1" style={{ color: brand.primary }}>{activeCount}</p>
        </div>
        <div className={`${glass} p-4`}>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: brand.muted }}>Total Members</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#3B82F6' }}>{employees.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((n) => <div key={n} className="h-14 rounded-xl bg-white/50 animate-pulse" />)}</div>
      ) : visibleEmployees.length === 0 ? (
        <div className={`${glass} p-8 text-center`}>
          <p className="text-sm" style={{ color: brand.muted }}>No crew members found.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {visibleEmployees.map((emp) => {
              const s = STATUS_STYLES[emp.status] || STATUS_STYLES.active;
              const r = emp.role ? ROLE_STYLES[emp.role] : null;
              return (
                <div key={emp.id} className={`${glass} p-4`} onClick={() => setSelected(emp)}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm" style={{ color: brand.text }}>{emp.full_name}</p>
                    <div className="flex gap-1">
                      {r && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: r.bg, color: r.fg }}>{r.label}</span>}
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.fg }}>{emp.status}</span>
                    </div>
                  </div>
                  <p className="text-xs mt-1" style={{ color: brand.muted }}>{emp.email}</p>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block overflow-hidden rounded-2xl border border-black/5 bg-white/90">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-white/95 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-slate-100 px-4 py-2">Name</th>
                  <th className="border-b border-slate-100 px-4 py-2">Email</th>
                  <th className="border-b border-slate-100 px-4 py-2">Services</th>
                  <th className="border-b border-slate-100 px-4 py-2">Suburb</th>
                  <th className="border-b border-slate-100 px-4 py-2">Role</th>
                  <th className="border-b border-slate-100 px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((emp) => {
                  const s = STATUS_STYLES[emp.status] || STATUS_STYLES.active;
                  const r = emp.role ? ROLE_STYLES[emp.role] : null;
                  return (
                    <tr key={emp.id} className="cursor-pointer hover:bg-slate-50 border-b border-slate-50" onClick={() => setSelected(emp)}>
                      <td className="px-4 py-3 font-medium">{emp.full_name}</td>
                      <td className="px-4 py-3 text-slate-500">{emp.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {(emp.services || []).map((svc) => (
                            <span key={svc} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{SERVICE_LABELS[svc] || svc}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{emp.suburb || '-'}</td>
                      <td className="px-4 py-3">
                        {r
                          ? <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: r.bg, color: r.fg }}>{r.label}</span>
                          : <span className="text-[10px] text-slate-400">No login</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.fg }}>{emp.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Employee detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative ml-auto h-full w-full max-w-md border-l border-black/5 bg-white/95 shadow-2xl overflow-y-auto">
            <div className="px-6 py-5 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Crew Member</p>
                <h2 className="text-lg font-semibold">{selected.full_name}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm text-slate-500">Close</button>
            </div>

            <div className="px-6 pb-6 space-y-4 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Email</span><span>{selected.email}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Suburb</span><span>{selected.suburb || '-'}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="capitalize">{selected.status}</span></div>

              {selected.services && selected.services.length > 0 && (
                <div>
                  <span className="text-slate-500">Services</span>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {selected.services.map((svc) => (
                      <span key={svc} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{SERVICE_LABELS[svc] || svc}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Dashboard Access</p>
                {!selected.user_id ? (
                  <p className="text-sm text-slate-400 italic">No login linked yet. Create a staff account for this person first.</p>
                ) : (
                  <div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <p className="font-medium text-sm" style={{ color: brand.text }}>
                          {selected.role === 'admin' ? 'Admin Dashboard' : 'Crew Portal'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {selected.role === 'admin'
                            ? 'Full admin access. Toggle to restrict to crew portal.'
                            : 'Crew portal only. Toggle to grant admin dashboard access.'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRoleToggle(selected)}
                        disabled={roleUpdating}
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 shrink-0 ml-4"
                        style={{ background: selected.role === 'admin' ? brand.primary : '#CBD5E1' }}
                        title={selected.role === 'admin' ? 'Switch to Employee' : 'Promote to Admin'}
                      >
                        <span
                          className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                          style={{ transform: selected.role === 'admin' ? 'translateX(22px)' : 'translateX(4px)' }}
                        />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">Role changes take effect on their next sign-in.</p>
                  </div>
                )}
              </div>

              {selected.user_id && (
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-3">Account Status</p>
                  <div className="flex items-center justify-between rounded-xl border bg-slate-50 px-4 py-3"
                    style={{ borderColor: selected.status === 'suspended' ? '#FECACA' : '#E2E8F0', background: selected.status === 'suspended' ? '#FFF5F5' : undefined }}>
                    <div>
                      <p className="font-medium text-sm capitalize" style={{ color: selected.status === 'suspended' ? '#991B1B' : brand.text }}>
                        {selected.status === 'suspended' ? 'Suspended' : 'Active'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {selected.status === 'suspended'
                          ? 'This person cannot sign in. Activate to restore access.'
                          : 'This person can sign in normally.'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleStatusToggle(selected)}
                      disabled={statusUpdating}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 shrink-0 ml-4"
                      style={selected.status === 'suspended'
                        ? { background: '#ECFDF5', color: '#065F46', borderColor: '#A7F3D0' }
                        : { background: '#FEE2E2', color: '#991B1B', borderColor: '#FECACA' }}
                    >
                      {selected.status === 'suspended' ? 'Activate' : 'Suspend'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Staff Account modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold" style={{ color: brand.text }}>Invite Staff Member</h2>
              <button onClick={() => setShowCreate(false)} className="rounded-full border border-black/10 px-3 py-1 text-sm text-slate-500">Cancel</button>
            </div>
            <p className="text-xs text-slate-500 mb-5">An invite email will be sent so they can set their own password.</p>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: brand.text }}>Full name</label>
                <input
                  type="text" required value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-600"
                  placeholder="Jane Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: brand.text }}>Email</label>
                <input
                  type="email" required value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-600"
                  placeholder="jane@budsatwork.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: brand.text }}>Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['employee', 'admin'] as const).map((r) => (
                    <button
                      key={r} type="button"
                      onClick={() => setForm((f) => ({ ...f, role: r }))}
                      className="rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-colors"
                      style={{
                        borderColor: form.role === r ? brand.primary : '#E2E8F0',
                        background: form.role === r ? `${brand.primary}10` : 'transparent',
                        color: form.role === r ? brand.primary : brand.muted,
                      }}
                    >
                      {r === 'employee' ? 'Employee' : 'Admin'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {form.role === 'admin' ? 'Admin: full dashboard access.' : 'Employee: crew portal access only.'}
                </p>
              </div>

              {createError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{createError}</div>
              )}
              {createSuccess && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">{createSuccess}</div>
              )}

              <button
                type="submit" disabled={createLoading}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: brand.primary }}
              >
                {createLoading ? 'Sending invite...' : 'Send invite'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
