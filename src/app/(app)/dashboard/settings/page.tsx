'use client';

import { useState, useEffect } from 'react';
import { brand } from '@/app/ui/theme';
import { toast } from 'sonner';
import AuditLogPage from '../audit-log/page';
import FeedbackPage from '../feedback/page';
import AutomationsPage from '../automations/page';

// ─── Types ────────────────────────────────────────────────────────────────────

type SiteStats = {
  jobs_completed: string;
  avg_rating: string;
  repeat_customers: string;
};

type GoalSettings = {
  monthlyRevenueTarget: number;
  monthlyJobsTarget: number;
};

type CashBalanceSetting = {
  amount: number;
};

type NotificationSettings = {
  emailOverdue: boolean;
  emailNewBooking: boolean;
  emailWeeklySummary: boolean;
  browserNotifications: boolean;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STAT_LABELS: Record<keyof SiteStats, string> = {
  jobs_completed: 'Jobs Completed',
  avg_rating: 'Average Rating',
  repeat_customers: 'Repeat Customers',
};

const ALL_ROLES = ['admin', 'employee', 'customer'] as const;

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-emerald-100 text-emerald-700',
  employee: 'bg-blue-100 text-blue-700',
  customer: 'bg-slate-100 text-slate-600',
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function UserIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function BellIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function TargetIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function DocumentIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h4" />
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ToggleSwitch = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) => (
  <label className="flex items-center justify-between cursor-pointer py-2">
    <span className="text-sm text-slate-700">{label}</span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative flex h-6 w-11 items-center rounded-full border border-black/10 bg-white p-0.5 transition-colors"
    >
      <span
        className={`h-5 w-5 rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
        style={{ background: checked ? brand.primary : '#94A3B8' }}
      />
    </button>
  </label>
);

const SettingsCard = ({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="rounded-2xl border border-black/5 bg-white/90 p-6 shadow-sm">
    <div className="flex items-start gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${brand.primary}15`, color: brand.primary }}>
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold" style={{ color: brand.text }}>{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </div>
    {children}
  </section>
);

// ─── General Settings panel ───────────────────────────────────────────────────

function GeneralSettings() {
  const [stats, setStats] = useState<SiteStats>({ jobs_completed: '', avg_rating: '', repeat_customers: '' });
  const [goals, setGoals] = useState<GoalSettings>({ monthlyRevenueTarget: 15000, monthlyJobsTarget: 30 });
  const [cashBalance, setCashBalance] = useState<CashBalanceSetting>({ amount: 0 });
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailOverdue: true, emailNewBooking: true, emailWeeklySummary: false, browserNotifications: true,
  });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [invoiceSettings, setInvoiceSettings] = useState({
    defaultPaymentTerms: 14,
    invoicePrefix: 'INV-',
    footerNote: 'Thank you for choosing Buds At Work!',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchTeam();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchTeam() {
    setTeamLoading(true);
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTeamMembers(data.users || []);
    } catch {
      // Fall back to empty — user may not be admin
    } finally {
      setTeamLoading(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    const prev = teamMembers.find(m => m.id === userId);
    if (!prev || prev.role === newRole) return;
    setTeamMembers(members => members.map(m => m.id === userId ? { ...m, role: newRole } : m));
    try {
      const res = await fetch('/api/users/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Role updated to ${newRole}`);
    } catch {
      setTeamMembers(members => members.map(m => m.id === userId ? { ...m, role: prev.role } : m));
      toast.error('Failed to update role');
    }
  }

  async function fetchSettings() {
    try {
      const res = await fetch('/api/site-settings');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats({
        jobs_completed: data.settings?.jobs_completed || '250+',
        avg_rating: data.settings?.avg_rating || '4.9/5',
        repeat_customers: data.settings?.repeat_customers || '70%+',
      });
      if (data.settings?.goals) setGoals(data.settings.goals);
      if (data.settings?.cashBalance !== undefined) {
        const raw = data.settings.cashBalance;
        setCashBalance({ amount: typeof raw === 'number' ? raw : parseFloat(raw) || 0 });
      }
      if (data.settings?.notifications) setNotifications(data.settings.notifications);
      if (data.settings?.invoiceSettings) setInvoiceSettings(data.settings.invoiceSettings);
    } catch {
      setStats({ jobs_completed: '250+', avg_rating: '4.9/5', repeat_customers: '70%+' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(section: string, data: Record<string, unknown>) {
    setSaving(section);
    try {
      const res = await fetch('/api/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { [section]: data } }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      toast.success('Settings saved');
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-black/5 bg-white/90 p-6 shadow-sm animate-pulse">
            <div className="h-6 w-32 bg-slate-200 rounded mb-2" />
            <div className="h-4 w-48 bg-slate-100 rounded mb-6" />
            <div className="space-y-3">
              <div className="h-10 bg-slate-100 rounded" />
              <div className="h-10 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Site Content */}
      <SettingsCard title="Site Content" description="Update stats displayed on the About page" icon={<DocumentIcon />}>
        <div className="space-y-4">
          {(Object.keys(STAT_LABELS) as Array<keyof SiteStats>).map((key) => (
            <div key={key} className="flex items-center gap-4">
              <label className="w-40 text-sm font-medium text-slate-700">{STAT_LABELS[key]}</label>
              <input
                type="text"
                value={stats[key]}
                onChange={(e) => setStats((prev) => ({ ...prev, [key]: e.target.value }))}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          ))}
          <button
            onClick={() => handleSave('siteContent', stats)}
            disabled={saving === 'siteContent'}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
            style={{ background: brand.primary }}
          >
            {saving === 'siteContent' ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </SettingsCard>

      {/* Goals */}
      <SettingsCard title="Goals & Targets" description="Set monthly targets for your dashboard" icon={<TargetIcon />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Revenue Target</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                value={goals.monthlyRevenueTarget}
                onChange={(e) => setGoals((prev) => ({ ...prev, monthlyRevenueTarget: parseInt(e.target.value) || 0 }))}
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Jobs Target</label>
            <input
              type="number"
              value={goals.monthlyJobsTarget}
              onChange={(e) => setGoals((prev) => ({ ...prev, monthlyJobsTarget: parseInt(e.target.value) || 0 }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <button
            onClick={() => handleSave('goals', goals)}
            disabled={saving === 'goals'}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
            style={{ background: brand.primary }}
          >
            {saving === 'goals' ? 'Saving...' : 'Save Goals'}
          </button>
        </div>
      </SettingsCard>

      {/* Cash Balance */}
      <SettingsCard
        title="Cash Balance"
        description="Manually set the current cash balance shown on the dashboard"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            <circle cx="12" cy="14" r="2" />
          </svg>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Update this whenever you reconcile your accounts.</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Current Cash Balance</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number" min={0} step={0.01}
                value={cashBalance.amount}
                onChange={(e) => setCashBalance({ amount: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                placeholder="0.00"
              />
            </div>
          </div>
          <button
            onClick={() => handleSave('cashBalance', { amount: cashBalance.amount })}
            disabled={saving === 'cashBalance'}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
            style={{ background: brand.primary }}
          >
            {saving === 'cashBalance' ? 'Saving...' : 'Update Balance'}
          </button>
        </div>
      </SettingsCard>

      {/* Notifications */}
      <SettingsCard title="Notifications" description="Control how you receive alerts and updates" icon={<BellIcon />}>
        <div className="space-y-2 divide-y divide-slate-100">
          <ToggleSwitch checked={notifications.emailOverdue} onChange={(v) => setNotifications((p) => ({ ...p, emailOverdue: v }))} label="Email me when invoices are overdue" />
          <ToggleSwitch checked={notifications.emailNewBooking} onChange={(v) => setNotifications((p) => ({ ...p, emailNewBooking: v }))} label="Email me for new bookings" />
          <ToggleSwitch checked={notifications.emailWeeklySummary} onChange={(v) => setNotifications((p) => ({ ...p, emailWeeklySummary: v }))} label="Send weekly summary email" />
          <ToggleSwitch checked={notifications.browserNotifications} onChange={(v) => setNotifications((p) => ({ ...p, browserNotifications: v }))} label="Enable browser notifications" />
        </div>
        <button
          onClick={() => handleSave('notifications', notifications)}
          disabled={saving === 'notifications'}
          className="mt-4 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
          style={{ background: brand.primary }}
        >
          {saving === 'notifications' ? 'Saving...' : 'Save Preferences'}
        </button>
      </SettingsCard>

      {/* Invoice Settings */}
      <SettingsCard title="Invoice Settings" description="Customize your invoice defaults" icon={<DocumentIcon />}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Default Payment Terms (days)</label>
            <select
              value={invoiceSettings.defaultPaymentTerms}
              onChange={(e) => setInvoiceSettings((p) => ({ ...p, defaultPaymentTerms: parseInt(e.target.value) }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Number Prefix</label>
            <input
              type="text"
              value={invoiceSettings.invoicePrefix}
              onChange={(e) => setInvoiceSettings((p) => ({ ...p, invoicePrefix: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Invoice Footer Note</label>
            <textarea
              value={invoiceSettings.footerNote}
              onChange={(e) => setInvoiceSettings((p) => ({ ...p, footerNote: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              rows={2}
            />
          </div>
          <button
            onClick={() => handleSave('invoiceSettings', invoiceSettings)}
            disabled={saving === 'invoiceSettings'}
            className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
            style={{ background: brand.primary }}
          >
            {saving === 'invoiceSettings' ? 'Saving...' : 'Save Invoice Settings'}
          </button>
        </div>
      </SettingsCard>

      {/* Team Members */}
      <SettingsCard title="Team Members" description="Manage who has access to the dashboard" icon={<UserIcon />}>
        <div className="space-y-3">
          {teamLoading ? (
            [1, 2].map((n) => (
              <div key={n} className="rounded-xl border border-slate-200 bg-white px-4 py-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div>
                    <div className="h-4 w-28 bg-slate-200 rounded" />
                    <div className="h-3 w-36 bg-slate-100 rounded mt-1" />
                  </div>
                </div>
              </div>
            ))
          ) : teamMembers.length === 0 ? (
            <div className="text-sm text-center py-4" style={{ color: brand.muted }}>No team members found.</div>
          ) : (
            teamMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">{member.name}</div>
                    <div className="text-xs text-slate-500">{member.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                    className={`px-2 py-1 rounded-full text-[10px] font-semibold border-0 cursor-pointer ${ROLE_COLORS[member.role] || ROLE_COLORS.customer}`}
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                    ))}
                  </select>
                  <span className={`w-2 h-2 rounded-full ${member.active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                </div>
              </div>
            ))
          )}
        </div>
      </SettingsCard>

      {/* Danger Zone */}
      <SettingsCard
        title="Danger Zone"
        description="Irreversible actions"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <h3 className="text-sm font-semibold text-red-800 mb-1">Export All Data</h3>
            <p className="text-xs text-red-600 mb-3">Download a complete backup of all your data in JSON format.</p>
            <button
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              onClick={() => toast.info('Data export coming soon!')}
            >
              Export Data
            </button>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <h3 className="text-sm font-semibold text-red-800 mb-1">Delete Account</h3>
            <p className="text-xs text-red-600 mb-3">Permanently delete your account and all associated data.</p>
            <button
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              onClick={() => toast.error('This action is disabled for demo purposes.')}
            >
              Delete Account
            </button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

// ─── Main Settings Page ────────────────────────────────────────────────────────

type Tab = 'settings' | 'automations' | 'audit-log' | 'feedback';

const TABS: { key: Tab; label: string }[] = [
  { key: 'settings',   label: 'Settings'   },
  { key: 'automations', label: 'Automations' },
  { key: 'audit-log',  label: 'Audit Log'  },
  { key: 'feedback',   label: 'Feedback'   },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('settings');

  return (
    <div>
      <div className="px-4 md:px-10 lg:px-12 pb-4">
        <div className="flex gap-1 p-1 rounded-xl bg-white/60 border border-black/5 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
              style={
                tab === t.key
                  ? { background: brand.primary, color: 'white' }
                  : { color: brand.muted }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'settings' && (
        <div className="px-4 md:px-10 lg:px-12 pb-14">
          <GeneralSettings />
        </div>
      )}
      {tab === 'automations' && <AutomationsPage />}
      {tab === 'audit-log'  && <AuditLogPage />}
      {tab === 'feedback'   && <FeedbackPage />}
    </div>
  );
}
