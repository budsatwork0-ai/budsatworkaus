'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';
import AuditLogPage from '../audit-log/page';
import FeedbackPage from '../feedback/page';
import { WorkbenchHeader, WorkbenchQueue, WorkbenchStatGrid, WorkbenchTabs } from '../components/Workbench';
import { useDashboardData } from '../hooks/useDashboardData';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  DEFAULT_AUTOMATION_CONFIG,
  DEFAULT_AUTOMATION_SETTINGS,
  type AutomationConfig,
  type AutomationSettings,
} from '@/lib/automations';

type SettingsGroup = 'account' | 'workspace' | 'system' | 'danger';
type PanelKey =
  | 'profile'
  | 'login-security'
  | 'notifications'
  | 'general'
  | 'goals-targets'
  | 'service-area'
  | 'pricing-engine'
  | 'payments-payroll'
  | 'invoice-settings'
  | 'team-permissions'
  | 'system-overview'
  | 'automations'
  | 'audit-log'
  | 'feedback'
  | 'export-data'
  | 'delete-account';

type SiteStats = {
  jobs_completed: string;
  avg_rating: string;
  repeat_customers: string;
};

type AccountProfile = {
  fullName: string;
  phone: string;
  bio: string;
  avatarUrl: string;
  role: string;
  email: string;
};

type AccountNotifications = {
  jobUpdates: boolean;
  newBookings: boolean;
  payments: boolean;
  reminders: boolean;
  browserNotifications: boolean;
  smsNotifications: boolean;
};

type WorkspaceGeneral = {
  workspaceName: string;
  operationsEmail: string;
  supportPhone: string;
};

type GoalSettings = {
  monthlyRevenueTarget: number;
  monthlyJobsTarget: number;
  cashBalance: number;
};

type ServiceAreaSettings = {
  serviceZones: string;
  travelRadius: number;
  minimumCalloutFee: number;
};

type PricingEngineSettings = {
  baseHourlyRate: number;
  serviceCaps: string;
  effortModifiersEnabled: boolean;
  exactPriceModeEnabled: boolean;
};

type PayrollSettings = {
  defaultPayRate: number;
  payCycle: 'weekly' | 'fortnightly' | 'monthly';
  payoutMethod: string;
  awardReference: string;
  fairWorkReference: string;
};

type InvoiceSettings = {
  defaultPaymentTerms: number;
  invoicePrefix: string;
  footerNote: string;
};

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  imageUrl?: string | null;
};

type PanelStatus = {
  saving: boolean;
  success: string | null;
  error: string | null;
};

type PanelMeta = {
  key: PanelKey;
  label: string;
  description: string;
};

const DEFAULT_SITE_STATS: SiteStats = {
  jobs_completed: 'Now booking',
  avg_rating: 'Reviews soon',
  repeat_customers: 'Local startup',
};

const DEFAULT_ACCOUNT_PROFILE: AccountProfile = {
  fullName: '',
  phone: '',
  bio: '',
  avatarUrl: '',
  role: 'customer',
  email: '',
};

const DEFAULT_ACCOUNT_NOTIFICATIONS: AccountNotifications = {
  jobUpdates: true,
  newBookings: true,
  payments: true,
  reminders: true,
  browserNotifications: true,
  smsNotifications: false,
};

const DEFAULT_WORKSPACE_GENERAL: WorkspaceGeneral = {
  workspaceName: 'Buds At Work',
  operationsEmail: '',
  supportPhone: '',
};

const DEFAULT_GOALS: GoalSettings = {
  monthlyRevenueTarget: 15000,
  monthlyJobsTarget: 30,
  cashBalance: 0,
};

const DEFAULT_SERVICE_AREA: ServiceAreaSettings = {
  serviceZones: 'Logan\nBrisbane Southside',
  travelRadius: 35,
  minimumCalloutFee: 0,
};

const DEFAULT_PRICING_ENGINE: PricingEngineSettings = {
  baseHourlyRate: 85,
  serviceCaps: 'Lawn care: $220\nDeep clean: $480',
  effortModifiersEnabled: true,
  exactPriceModeEnabled: false,
};

const DEFAULT_PAYROLL: PayrollSettings = {
  defaultPayRate: 32,
  payCycle: 'weekly',
  payoutMethod: 'Bank transfer',
  awardReference: '',
  fairWorkReference: '',
};

const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  defaultPaymentTerms: 14,
  invoicePrefix: 'INV-',
  footerNote: 'Thank you for choosing Buds At Work!',
};

const GROUP_TABS: Array<{ key: SettingsGroup; label: string }> = [
  { key: 'account', label: 'Account' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'system', label: 'System' },
  { key: 'danger', label: 'Danger Zone' },
];

const GROUP_PANELS: Record<SettingsGroup, PanelMeta[]> = {
  account: [
    { key: 'profile', label: 'Profile', description: 'Edit your personal account details and profile image.' },
    { key: 'login-security', label: 'Login & Security', description: 'Change email, password, and manage current security controls.' },
    { key: 'notifications', label: 'Notifications', description: 'Control how you receive personal alerts and reminders.' },
  ],
  workspace: [
    { key: 'general', label: 'General', description: 'Business-level settings and public-facing site content.' },
    { key: 'goals-targets', label: 'Goals & Targets', description: 'Monthly performance targets and cash tracking.' },
    { key: 'service-area', label: 'Service Area', description: 'Service zones, travel rules, and minimum callout settings.' },
    { key: 'pricing-engine', label: 'Pricing Engine', description: 'Operational pricing controls for quoting and effort logic.' },
    { key: 'payments-payroll', label: 'Payments & Payroll', description: 'Default payroll settings and payout references.' },
    { key: 'invoice-settings', label: 'Invoice Settings', description: 'Invoice defaults, numbering, and footer copy.' },
    { key: 'team-permissions', label: 'Team & Permissions', description: 'Manage who has access and what role they hold.' },
  ],
  system: [
    { key: 'system-overview', label: 'Overview', description: 'System oversight, alerts, and focus areas.' },
    { key: 'automations', label: 'Automations', description: 'Automation toggles and re-engagement configuration.' },
    { key: 'audit-log', label: 'Audit Log', description: 'Trace operational changes and admin actions.' },
    { key: 'feedback', label: 'Feedback', description: 'Review bugs, ideas, and admin notes.' },
  ],
  danger: [
    { key: 'export-data', label: 'Export Data', description: 'Download a backup of account and workspace settings.' },
    { key: 'delete-account', label: 'Delete Account', description: 'Access account deletion controls and restrictions.' },
  ],
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-emerald-100 text-emerald-700',
  employee: 'bg-blue-100 text-blue-700',
  customer: 'bg-slate-100 text-slate-600',
};

const ALL_ROLES = ['admin', 'employee', 'customer'] as const;

const ROLE_EXPLANATIONS: Record<string, string> = {
  admin: 'Full access to settings, people management, and operational controls.',
  employee: 'Crew or staff access without admin-wide configuration privileges.',
  customer: 'Portal-only access with no dashboard admin controls.',
};

const LEGACY_TAB_MAP: Record<string, { group: SettingsGroup; panel: PanelKey }> = {
  settings: { group: 'workspace', panel: 'general' },
  automations: { group: 'system', panel: 'automations' },
  'audit-log': { group: 'system', panel: 'audit-log' },
  feedback: { group: 'system', panel: 'feedback' },
};

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

function SettingsIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .35 1.82l.05.05a2 2 0 0 1-2.83 2.83l-.05-.05a1.7 1.7 0 0 0-1.82-.35 1.7 1.7 0 0 0-1.03 1.57V21a2 2 0 0 1-4 0v-.08a1.7 1.7 0 0 0-1.03-1.57 1.7 1.7 0 0 0-1.82.35l-.05.05a2 2 0 0 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.57-1.03H3a2 2 0 0 1 0-4h.08A1.7 1.7 0 0 0 4.65 8.94l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05A1.7 1.7 0 0 0 9.3 5.76 1.7 1.7 0 0 0 10.33 4.2V4a2 2 0 0 1 4 0v.08a1.7 1.7 0 0 0 1.03 1.57 1.7 1.7 0 0 0 1.82-.35l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.57 1.03H21a2 2 0 0 1 0 4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
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

function ShieldIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4Z" />
      <path d="m9.5 12 1.7 1.7L14.8 10" />
    </svg>
  );
}

function MapIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20V6.5Z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </svg>
  );
}

function CashIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 10h.01M18 14h.01" />
    </svg>
  );
}

function getLocation(params: URLSearchParams | null): { group: SettingsGroup; panel: PanelKey } {
  const legacy = params?.get('tab');
  if (legacy && LEGACY_TAB_MAP[legacy]) {
    return LEGACY_TAB_MAP[legacy];
  }

  const rawGroup = params?.get('group');
  const group: SettingsGroup =
    rawGroup === 'account' || rawGroup === 'workspace' || rawGroup === 'system' || rawGroup === 'danger'
      ? rawGroup
      : 'workspace';

  const availablePanels = GROUP_PANELS[group];
  const rawPanel = params?.get('panel');
  const panel = availablePanels.find((item) => item.key === rawPanel)?.key ?? availablePanels[0].key;

  return { group, panel };
}

function isDirty<T>(current: T, initial: T | null) {
  if (!initial) return false;
  return JSON.stringify(current) !== JSON.stringify(initial);
}

function clearLegacyParams(params: URLSearchParams) {
  params.delete('tab');
}

function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Unavailable';
  return new Date(value).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function detectDeviceLabel() {
  if (typeof navigator === 'undefined') return 'Current session';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('iphone') || ua.includes('android') || ua.includes('mobile')) return 'Mobile browser';
  if (ua.includes('mac')) return 'Mac browser';
  if (ua.includes('windows')) return 'Windows browser';
  return 'Current browser session';
}

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start justify-between gap-4 py-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative mt-0.5 flex h-6 w-11 items-center rounded-full border border-black/10 bg-white p-0.5 transition-colors"
      >
        <span
          className={`h-5 w-5 rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
          style={{ background: checked ? brand.primary : '#94A3B8' }}
        />
      </button>
    </label>
  );
}

function SettingsCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white/90 p-6 shadow-sm">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${brand.primary}15`, color: brand.primary }}>
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
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-slate-700">{children}</label>;
}

function InputField(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${props.className ?? ''}`}
    />
  );
}

function TextareaField(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none ${props.className ?? ''}`}
    />
  );
}

function SelectField(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${props.className ?? ''}`}
    />
  );
}

function SaveBar({
  dirty,
  saving,
  success,
  error,
  saveLabel,
  onSave,
  onReset,
}: {
  dirty: boolean;
  saving: boolean;
  success: string | null;
  error: string | null;
  saveLabel: string;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="sticky bottom-0 mt-6 flex flex-col gap-3 rounded-2xl border border-black/5 bg-white/95 p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="min-h-[20px] text-sm">
        {error ? <span className="text-red-600">{error}</span> : null}
        {!error && success ? <span className="text-emerald-600">{success}</span> : null}
        {!error && !success && dirty ? <span className="text-slate-500">Unsaved changes</span> : null}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onReset}
          disabled={!dirty || saving}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
          style={{ background: brand.primary }}
        >
          {saving ? 'Saving...' : saveLabel}
        </button>
      </div>
    </div>
  );
}

export default function SettingsWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const location = getLocation(searchParams);
  const { metrics, alertsFeed } = useDashboardData();

  const [accountProfile, setAccountProfile] = useState<AccountProfile>(DEFAULT_ACCOUNT_PROFILE);
  const [initialAccountProfile, setInitialAccountProfile] = useState<AccountProfile | null>(null);
  const [accountNotifications, setAccountNotifications] = useState<AccountNotifications>(DEFAULT_ACCOUNT_NOTIFICATIONS);
  const [initialAccountNotifications, setInitialAccountNotifications] = useState<AccountNotifications | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);

  const [workspaceGeneral, setWorkspaceGeneral] = useState<WorkspaceGeneral>(DEFAULT_WORKSPACE_GENERAL);
  const [initialWorkspaceGeneral, setInitialWorkspaceGeneral] = useState<WorkspaceGeneral | null>(null);
  const [siteStats, setSiteStats] = useState<SiteStats>(DEFAULT_SITE_STATS);
  const [initialSiteStats, setInitialSiteStats] = useState<SiteStats | null>(null);
  const [goals, setGoals] = useState<GoalSettings>(DEFAULT_GOALS);
  const [initialGoals, setInitialGoals] = useState<GoalSettings | null>(null);
  const [serviceArea, setServiceArea] = useState<ServiceAreaSettings>(DEFAULT_SERVICE_AREA);
  const [initialServiceArea, setInitialServiceArea] = useState<ServiceAreaSettings | null>(null);
  const [pricingEngine, setPricingEngine] = useState<PricingEngineSettings>(DEFAULT_PRICING_ENGINE);
  const [initialPricingEngine, setInitialPricingEngine] = useState<PricingEngineSettings | null>(null);
  const [payroll, setPayroll] = useState<PayrollSettings>(DEFAULT_PAYROLL);
  const [initialPayroll, setInitialPayroll] = useState<PayrollSettings | null>(null);
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(DEFAULT_INVOICE_SETTINGS);
  const [initialInvoiceSettings, setInitialInvoiceSettings] = useState<InvoiceSettings | null>(null);
  const [automations, setAutomations] = useState<AutomationSettings>(DEFAULT_AUTOMATION_SETTINGS);
  const [initialAutomations, setInitialAutomations] = useState<AutomationSettings | null>(null);
  const [automationConfig, setAutomationConfig] = useState<AutomationConfig>(DEFAULT_AUTOMATION_CONFIG);
  const [initialAutomationConfig, setInitialAutomationConfig] = useState<AutomationConfig | null>(null);
  const [siteLoading, setSiteLoading] = useState(true);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamCount, setTeamCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  const [panelStatus, setPanelStatus] = useState<Record<string, PanelStatus>>({});
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [security, setSecurity] = useState({
    newEmail: '',
    newPassword: '',
    confirmPassword: '',
    busy: '',
    success: '',
    error: '',
  });

  useEffect(() => {
    void loadAccountSettings();
    void loadSiteSettings();
    void loadTeamSnapshot();
  }, []);

  async function loadAccountSettings() {
    setAccountLoading(true);
    try {
      const res = await fetch('/api/account/settings');
      if (!res.ok) throw new Error('Failed to load account settings');
      const data = await res.json();
      const nextProfile: AccountProfile = {
        fullName: data.account?.fullName ?? '',
        phone: data.account?.phone ?? '',
        bio: data.account?.bio ?? '',
        avatarUrl: data.account?.avatarUrl ?? '',
        role: data.account?.role ?? 'customer',
        email: data.account?.email ?? '',
      };
      const nextNotifications: AccountNotifications = {
        ...DEFAULT_ACCOUNT_NOTIFICATIONS,
        ...(data.account?.notifications ?? {}),
      };
      setAccountProfile(nextProfile);
      setInitialAccountProfile(nextProfile);
      setAccountNotifications(nextNotifications);
      setInitialAccountNotifications(nextNotifications);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load account settings';
      setPanelStatus((prev) => ({
        ...prev,
        profile: { saving: false, success: null, error: message },
        notifications: { saving: false, success: null, error: message },
      }));
    } finally {
      setAccountLoading(false);
    }
  }

  async function loadSiteSettings() {
    setSiteLoading(true);
    try {
      const res = await fetch('/api/site-settings');
      if (!res.ok) throw new Error('Failed to load workspace settings');
      const data = await res.json();
      const nextGeneral: WorkspaceGeneral = {
        workspaceName: data.settings?.workspaceGeneral?.workspaceName || DEFAULT_WORKSPACE_GENERAL.workspaceName,
        operationsEmail: data.settings?.workspaceGeneral?.operationsEmail || '',
        supportPhone: data.settings?.workspaceGeneral?.supportPhone || '',
      };
      const nextSiteStats: SiteStats = {
        jobs_completed: data.settings?.siteContent?.jobs_completed || DEFAULT_SITE_STATS.jobs_completed,
        avg_rating: data.settings?.siteContent?.avg_rating || DEFAULT_SITE_STATS.avg_rating,
        repeat_customers: data.settings?.siteContent?.repeat_customers || DEFAULT_SITE_STATS.repeat_customers,
      };
      const rawCashBalance = data.settings?.cashBalance;
      const nextGoals: GoalSettings = {
        monthlyRevenueTarget: data.settings?.goals?.monthlyRevenueTarget ?? DEFAULT_GOALS.monthlyRevenueTarget,
        monthlyJobsTarget: data.settings?.goals?.monthlyJobsTarget ?? DEFAULT_GOALS.monthlyJobsTarget,
        cashBalance: typeof rawCashBalance === 'number' ? rawCashBalance : parseFloat(rawCashBalance) || 0,
      };
      const nextServiceArea: ServiceAreaSettings = {
        serviceZones: data.settings?.serviceArea?.serviceZones || DEFAULT_SERVICE_AREA.serviceZones,
        travelRadius: data.settings?.serviceArea?.travelRadius ?? DEFAULT_SERVICE_AREA.travelRadius,
        minimumCalloutFee: data.settings?.serviceArea?.minimumCalloutFee ?? DEFAULT_SERVICE_AREA.minimumCalloutFee,
      };
      const nextPricingEngine: PricingEngineSettings = {
        baseHourlyRate: data.settings?.pricingEngine?.baseHourlyRate ?? DEFAULT_PRICING_ENGINE.baseHourlyRate,
        serviceCaps: data.settings?.pricingEngine?.serviceCaps || DEFAULT_PRICING_ENGINE.serviceCaps,
        effortModifiersEnabled: data.settings?.pricingEngine?.effortModifiersEnabled ?? DEFAULT_PRICING_ENGINE.effortModifiersEnabled,
        exactPriceModeEnabled: data.settings?.pricingEngine?.exactPriceModeEnabled ?? DEFAULT_PRICING_ENGINE.exactPriceModeEnabled,
      };
      const nextPayroll: PayrollSettings = {
        defaultPayRate: data.settings?.payrollSettings?.defaultPayRate ?? DEFAULT_PAYROLL.defaultPayRate,
        payCycle: data.settings?.payrollSettings?.payCycle ?? DEFAULT_PAYROLL.payCycle,
        payoutMethod: data.settings?.payrollSettings?.payoutMethod || DEFAULT_PAYROLL.payoutMethod,
        awardReference: data.settings?.payrollSettings?.awardReference || '',
        fairWorkReference: data.settings?.payrollSettings?.fairWorkReference || '',
      };
      const nextInvoiceSettings: InvoiceSettings = {
        defaultPaymentTerms: data.settings?.invoiceSettings?.defaultPaymentTerms ?? DEFAULT_INVOICE_SETTINGS.defaultPaymentTerms,
        invoicePrefix: data.settings?.invoiceSettings?.invoicePrefix || DEFAULT_INVOICE_SETTINGS.invoicePrefix,
        footerNote: data.settings?.invoiceSettings?.footerNote || DEFAULT_INVOICE_SETTINGS.footerNote,
      };
      const nextAutomations: AutomationSettings = {
        ...DEFAULT_AUTOMATION_SETTINGS,
        ...(data.settings?.automations ?? {}),
      };
      const nextAutomationConfig: AutomationConfig = {
        ...DEFAULT_AUTOMATION_CONFIG,
        ...(data.settings?.automationConfig ?? {}),
      };

      setWorkspaceGeneral(nextGeneral);
      setInitialWorkspaceGeneral(nextGeneral);
      setSiteStats(nextSiteStats);
      setInitialSiteStats(nextSiteStats);
      setGoals(nextGoals);
      setInitialGoals(nextGoals);
      setServiceArea(nextServiceArea);
      setInitialServiceArea(nextServiceArea);
      setPricingEngine(nextPricingEngine);
      setInitialPricingEngine(nextPricingEngine);
      setPayroll(nextPayroll);
      setInitialPayroll(nextPayroll);
      setInvoiceSettings(nextInvoiceSettings);
      setInitialInvoiceSettings(nextInvoiceSettings);
      setAutomations(nextAutomations);
      setInitialAutomations(nextAutomations);
      setAutomationConfig(nextAutomationConfig);
      setInitialAutomationConfig(nextAutomationConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load workspace settings';
      setPanelStatus((prev) => ({
        ...prev,
        general: { saving: false, success: null, error: message },
      }));
    } finally {
      setSiteLoading(false);
    }
  }

  async function loadTeamSnapshot() {
    setSnapshotLoading(true);
    setTeamLoading(true);
    try {
      const [usersRes, feedbackRes] = await Promise.all([
        fetch('/api/users').then((r) => (r.ok ? r.json() : { users: [] })).catch(() => ({ users: [] })),
        fetch('/api/feedback').then((r) => (r.ok ? r.json() : { feedback: [] })).catch(() => ({ feedback: [] })),
      ]);

      const users = usersRes.users || [];
      const feedback = feedbackRes.feedback || [];
      setTeamMembers(users);
      setTeamCount(users.length);
      setAdminCount(users.filter((user: { role?: string }) => user.role === 'admin').length);
      setFeedbackCount(feedback.filter((item: { status?: string }) => item.status === 'new').length);
    } finally {
      setSnapshotLoading(false);
      setTeamLoading(false);
    }
  }

  function setStatus(panel: string, status: Partial<PanelStatus>) {
    setPanelStatus((prev) => ({
      ...prev,
      [panel]: {
        ...(prev[panel] ?? { saving: false, success: null, error: null }),
        ...status,
      },
    }));
  }

  async function runPanelSave(panel: string, task: () => Promise<void>, success: string) {
    setStatus(panel, { saving: true, success: null, error: null });
    try {
      await task();
      setStatus(panel, { saving: false, success, error: null });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed';
      setStatus(panel, { saving: false, success: null, error: message });
      return false;
    }
  }

  async function saveSiteSettings(panel: string, payload: Record<string, unknown>, success: string) {
    return runPanelSave(panel, async () => {
      const res = await fetch('/api/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save settings');
      }
    }, success);
  }

  async function saveAccountSettings(payload: Record<string, unknown>, panel: string, success: string) {
    return runPanelSave(panel, async () => {
      const res = await fetch('/api/account/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save account settings');
      }

      if (data.account) {
        const nextProfile: AccountProfile = {
          fullName: data.account.fullName ?? '',
          phone: data.account.phone ?? '',
          bio: data.account.bio ?? '',
          avatarUrl: data.account.avatarUrl ?? '',
          role: data.account.role ?? accountProfile.role,
          email: data.account.email ?? accountProfile.email,
        };
        const nextNotifications: AccountNotifications = {
          ...DEFAULT_ACCOUNT_NOTIFICATIONS,
          ...(data.account.notifications ?? {}),
        };
        setAccountProfile(nextProfile);
        setInitialAccountProfile(nextProfile);
        setAccountNotifications(nextNotifications);
        setInitialAccountNotifications(nextNotifications);
      }
    }, success);
  }

  async function handleRoleChange(userId: string, newRole: string) {
    const previous = teamMembers.find((member) => member.id === userId);
    if (!previous || previous.role === newRole) return;

    setTeamMembers((members) => members.map((member) => (
      member.id === userId ? { ...member, role: newRole } : member
    )));

    try {
      const res = await fetch('/api/users/role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Role updated to ${formatRole(newRole)}`);
      setAdminCount((count) => count + (newRole === 'admin' ? 1 : 0) - (previous.role === 'admin' ? 1 : 0));
    } catch {
      setTeamMembers((members) => members.map((member) => (
        member.id === userId ? { ...member, role: previous.role } : member
      )));
      toast.error('Failed to update role');
    }
  }

  async function handleAvatarUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setStatus('profile', { error: 'Profile image must be under 5MB.' });
      return;
    }

    setAvatarUploading(true);
    setStatus('profile', { error: null, success: null });
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      setAccountProfile((prev) => ({ ...prev, avatarUrl: data.url || '' }));
    } catch (error) {
      setStatus('profile', { error: error instanceof Error ? error.message : 'Upload failed' });
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleChangeEmail() {
    if (!security.newEmail.trim()) return;
    setSecurity((prev) => ({ ...prev, busy: 'email', success: '', error: '' }));
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ email: security.newEmail.trim() });
      if (error) throw error;
      setSecurity((prev) => ({
        ...prev,
        busy: '',
        newEmail: '',
        success: 'Email change requested. Check your inbox to confirm the new address.',
        error: '',
      }));
    } catch (error) {
      setSecurity((prev) => ({
        ...prev,
        busy: '',
        success: '',
        error: error instanceof Error ? error.message : 'Could not request email change',
      }));
    }
  }

  async function handleChangePassword() {
    if (!security.newPassword || security.newPassword !== security.confirmPassword) return;
    setSecurity((prev) => ({ ...prev, busy: 'password', success: '', error: '' }));
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: security.newPassword });
      if (error) throw error;
      setSecurity((prev) => ({
        ...prev,
        busy: '',
        newPassword: '',
        confirmPassword: '',
        success: 'Password updated successfully.',
        error: '',
      }));
    } catch (error) {
      setSecurity((prev) => ({
        ...prev,
        busy: '',
        success: '',
        error: error instanceof Error ? error.message : 'Could not update password',
      }));
    }
  }

  async function handlePasswordReset() {
    if (!accountProfile.email) return;
    setSecurity((prev) => ({ ...prev, busy: 'reset', success: '', error: '' }));
    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?redirect=/account/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(accountProfile.email, { redirectTo });
      if (error) throw error;
      setSecurity((prev) => ({
        ...prev,
        busy: '',
        success: 'Password reset email sent.',
        error: '',
      }));
    } catch (error) {
      setSecurity((prev) => ({
        ...prev,
        busy: '',
        success: '',
        error: error instanceof Error ? error.message : 'Could not send reset email',
      }));
    }
  }

  async function handleLogoutAllSessions() {
    setSecurity((prev) => ({ ...prev, busy: 'logout-all', success: '', error: '' }));
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
      window.location.href = '/account';
    } catch (error) {
      setSecurity((prev) => ({
        ...prev,
        busy: '',
        success: '',
        error: error instanceof Error ? error.message : 'Could not log out all sessions',
      }));
    }
  }

  function navigate(nextGroup: SettingsGroup, nextPanel?: PanelKey) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    clearLegacyParams(params);
    params.set('group', nextGroup);
    params.set('panel', nextPanel ?? GROUP_PANELS[nextGroup][0].key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const activePanels = GROUP_PANELS[location.group];
  const activePanelMeta = activePanels.find((item) => item.key === location.panel) ?? activePanels[0];
  const stats = useMemo(() => [
    {
      label: 'Active Alerts',
      value: String(alertsFeed.length),
      detail: alertsFeed.length > 0 ? 'Operational issues still open' : 'No active alerts',
      tone: alertsFeed.length > 0 ? ('amber' as const) : ('emerald' as const),
    },
    {
      label: 'Team Access',
      value: snapshotLoading ? '—' : String(teamCount),
      detail: snapshotLoading ? 'Loading team snapshot' : `${adminCount} admin accounts`,
      tone: 'blue' as const,
    },
    {
      label: 'Automations On',
      value: siteLoading ? '—' : String(Object.values(automations).filter(Boolean).length),
      detail: 'Configured automation toggles',
      tone: 'slate' as const,
    },
    {
      label: 'Revenue Target',
      value: `$${metrics.goals.monthlyRevenueTarget.toLocaleString('en-AU')}`,
      detail: `${metrics.goals.monthlyJobsTarget} jobs target`,
      tone: 'emerald' as const,
    },
  ], [adminCount, alertsFeed.length, automations, metrics.goals.monthlyJobsTarget, metrics.goals.monthlyRevenueTarget, siteLoading, snapshotLoading, teamCount]);

  const queueItems = [
    {
      key: 'alerts',
      title: alertsFeed.length > 0 ? `${alertsFeed.length} live alerts could point to config drift` : 'System alert load is currently quiet',
      detail: alertsFeed.length > 0
        ? 'Check alerts, automations, and role coverage before issues spill into daily operations.'
        : 'Use the quiet period to tighten your admin settings and automation rules.',
      tone: alertsFeed.length > 0 ? ('amber' as const) : ('emerald' as const),
      actionLabel: 'Open alerts',
      href: '/dashboard/alerts',
    },
    {
      key: 'automations',
      title: siteLoading ? 'Loading automation snapshot' : `${Object.values(automations).filter(Boolean).length} automation toggles enabled`,
      detail: 'Keep automation behaviour visible here instead of hiding it inside a separate admin page.',
      tone: 'blue' as const,
      actionLabel: 'Open automations',
      onAction: () => navigate('system', 'automations'),
    },
    {
      key: 'feedback',
      title: feedbackCount > 0 ? `${feedbackCount} new feedback items are waiting` : 'Feedback inbox is under control',
      detail: feedbackCount > 0
        ? 'New submissions may point to broken flows, missing settings, or rough edges in operations.'
        : 'No new submissions need triage right now.',
      tone: feedbackCount > 0 ? ('red' as const) : ('slate' as const),
      actionLabel: 'Open feedback',
      onAction: () => navigate('system', 'feedback'),
    },
  ];

  const groupedTeamMembers = useMemo(() => {
    return {
      admin: teamMembers.filter((member) => member.role === 'admin'),
      employee: teamMembers.filter((member) => member.role === 'employee'),
      customer: teamMembers.filter((member) => member.role === 'customer'),
    };
  }, [teamMembers]);

  const duplicateEmails = useMemo(() => {
    const counts = new Map<string, number>();
    teamMembers.forEach((member) => {
      const email = member.email.trim().toLowerCase();
      if (!email) return;
      counts.set(email, (counts.get(email) ?? 0) + 1);
    });
    return counts;
  }, [teamMembers]);

  const currentSessionRow = {
    label: detectDeviceLabel(),
    lastSeen: formatDateTime(new Date().toISOString()),
    lastSignIn: formatDateTime(undefined),
  };

  function renderPanel() {
    if (location.group === 'account') {
      if (location.panel === 'profile') {
        return (
          <SettingsCard title="Account Profile" description="This is your personal account record inside the operations console." icon={<UserIcon />}>
            {accountLoading ? (
              <PanelSkeleton />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                    <div className="flex flex-col items-center text-center">
                      {accountProfile.avatarUrl ? (
                        <img src={accountProfile.avatarUrl} alt={accountProfile.fullName || 'Profile'} className="h-24 w-24 rounded-full border border-slate-200 object-cover" />
                      ) : (
                        <div className="flex h-24 w-24 items-center justify-center rounded-full text-2xl font-semibold" style={{ background: `${brand.primary}15`, color: brand.primary }}>
                          {(accountProfile.fullName || accountProfile.email || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white">
                        {avatarUploading ? 'Uploading...' : 'Upload image'}
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void handleAvatarUpload(file);
                          }}
                          disabled={avatarUploading}
                        />
                      </label>
                      <p className="mt-3 text-xs text-slate-500">PNG or JPG up to 5MB.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel>Full name</FieldLabel>
                      <InputField
                        value={accountProfile.fullName}
                        onChange={(event) => {
                          setAccountProfile((prev) => ({ ...prev, fullName: event.target.value }));
                          setStatus('profile', { error: null, success: null });
                        }}
                        autoComplete="name"
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <FieldLabel>Phone number</FieldLabel>
                      <InputField
                        value={accountProfile.phone}
                        onChange={(event) => {
                          setAccountProfile((prev) => ({ ...prev, phone: event.target.value }));
                          setStatus('profile', { error: null, success: null });
                        }}
                        autoComplete="tel"
                        placeholder="04XX XXX XXX"
                      />
                    </div>
                    <div>
                      <FieldLabel>Role</FieldLabel>
                      <InputField value={formatRole(accountProfile.role)} readOnly className="cursor-not-allowed bg-slate-50 text-slate-500" />
                    </div>
                    <div>
                      <FieldLabel>Current email</FieldLabel>
                      <InputField value={accountProfile.email} readOnly className="cursor-not-allowed bg-slate-50 text-slate-500" />
                    </div>
                    <div className="md:col-span-2">
                      <FieldLabel>Internal bio / note</FieldLabel>
                      <TextareaField
                        rows={4}
                        value={accountProfile.bio}
                        onChange={(event) => {
                          setAccountProfile((prev) => ({ ...prev, bio: event.target.value }));
                          setStatus('profile', { error: null, success: null });
                        }}
                        placeholder="Optional internal note for your profile."
                      />
                    </div>
                  </div>
                </div>

                <SaveBar
                  dirty={isDirty(accountProfile, initialAccountProfile)}
                  saving={panelStatus.profile?.saving ?? false}
                  success={panelStatus.profile?.success ?? null}
                  error={panelStatus.profile?.error ?? null}
                  saveLabel="Save Profile"
                  onReset={() => {
                    if (initialAccountProfile) setAccountProfile(initialAccountProfile);
                    setStatus('profile', { error: null, success: null });
                  }}
                  onSave={() => {
                    void saveAccountSettings({
                      profile: {
                        fullName: accountProfile.fullName,
                        phone: accountProfile.phone,
                        bio: accountProfile.bio,
                        avatarUrl: accountProfile.avatarUrl,
                      },
                    }, 'profile', 'Profile updated');
                  }}
                />
              </div>
            )}
          </SettingsCard>
        );
      }

      if (location.panel === 'login-security') {
        const passwordMismatch = Boolean(security.newPassword) && security.newPassword !== security.confirmPassword;
        return (
          <div className="space-y-6">
            <SettingsCard title="Login & Security" description="Make account-level security changes without leaving settings." icon={<ShieldIcon />}>
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Change email</h3>
                    <p className="mt-1 text-xs text-slate-500">Your current email is shown for reference. A confirmation flow is required before the new email becomes active.</p>
                  </div>
                  <div>
                    <FieldLabel>Current email</FieldLabel>
                    <InputField value={accountProfile.email} readOnly className="cursor-not-allowed bg-white/80 text-slate-500" />
                  </div>
                  <div>
                    <FieldLabel>New email</FieldLabel>
                    <InputField
                      value={security.newEmail}
                      onChange={(event) => setSecurity((prev) => ({ ...prev, newEmail: event.target.value, success: '', error: '' }))}
                      placeholder="new@email.com"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleChangeEmail()}
                    disabled={!security.newEmail.trim() || security.busy === 'email'}
                    className="rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: brand.primary }}
                  >
                    {security.busy === 'email' ? 'Requesting...' : 'Change Email'}
                  </button>
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Change password</h3>
                    <p className="mt-1 text-xs text-slate-500">Use a fresh password here, or trigger a reset email if you would rather complete the change outside the console.</p>
                  </div>
                  <div>
                    <FieldLabel>New password</FieldLabel>
                    <InputField
                      type="password"
                      value={security.newPassword}
                      onChange={(event) => setSecurity((prev) => ({ ...prev, newPassword: event.target.value, success: '', error: '' }))}
                      placeholder="New password"
                    />
                  </div>
                  <div>
                    <FieldLabel>Confirm new password</FieldLabel>
                    <InputField
                      type="password"
                      value={security.confirmPassword}
                      onChange={(event) => setSecurity((prev) => ({ ...prev, confirmPassword: event.target.value, success: '', error: '' }))}
                      placeholder="Confirm password"
                    />
                    {passwordMismatch ? <p className="mt-1 text-xs text-red-600">Passwords do not match.</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleChangePassword()}
                      disabled={!security.newPassword || passwordMismatch || security.busy === 'password'}
                      className="rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: brand.primary }}
                    >
                      {security.busy === 'password' ? 'Updating...' : 'Change Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePasswordReset()}
                      disabled={!accountProfile.email || security.busy === 'reset'}
                      className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
                    >
                      {security.busy === 'reset' ? 'Sending...' : 'Send Reset Email'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Active sessions</h3>
                      <p className="mt-1 text-xs text-slate-500">Current browser access is shown here. Full multi-device session history is not exposed by the current backend yet.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleLogoutAllSessions()}
                      disabled={security.busy === 'logout-all'}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {security.busy === 'logout-all' ? 'Signing out...' : 'Logout All Sessions'}
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{currentSessionRow.label}</p>
                        <p className="mt-1 text-xs text-slate-500">Current device session</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Active now</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                      <p>Seen recently: {currentSessionRow.lastSeen}</p>
                      <p>Last sign-in: {currentSessionRow.lastSignIn}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Two-factor authentication</h3>
                      <p className="mt-1 text-xs text-slate-500">The console has space for MFA, but backend enrollment and verification are not wired up yet.</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Placeholder</span>
                  </div>
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
                    <p className="text-sm text-slate-700">2FA enrollment will live here once the MFA flow is connected.</p>
                    <button
                      type="button"
                      disabled
                      className="mt-4 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-400"
                    >
                      Enable 2FA
                    </button>
                  </div>
                </div>
              </div>

              {security.error ? <p className="mt-5 text-sm text-red-600">{security.error}</p> : null}
              {!security.error && security.success ? <p className="mt-5 text-sm text-emerald-600">{security.success}</p> : null}
            </SettingsCard>
          </div>
        );
      }

      return (
        <SettingsCard title="Personal Notifications" description="These preferences belong to you, not the wider workspace." icon={<BellIcon />}>
          {accountLoading ? (
            <PanelSkeleton />
          ) : (
            <div className="space-y-4">
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
                <div className="px-5"><ToggleSwitch checked={accountNotifications.jobUpdates} onChange={(value) => { setAccountNotifications((prev) => ({ ...prev, jobUpdates: value })); setStatus('notifications', { error: null, success: null }); }} label="Job updates" description="Get notified when jobs move, change, or need attention." /></div>
                <div className="px-5"><ToggleSwitch checked={accountNotifications.newBookings} onChange={(value) => { setAccountNotifications((prev) => ({ ...prev, newBookings: value })); setStatus('notifications', { error: null, success: null }); }} label="New bookings" description="Receive alerts when new bookings hit your workspace." /></div>
                <div className="px-5"><ToggleSwitch checked={accountNotifications.payments} onChange={(value) => { setAccountNotifications((prev) => ({ ...prev, payments: value })); setStatus('notifications', { error: null, success: null }); }} label="Payments" description="Payment confirmations, overdue notices, and settlement updates." /></div>
                <div className="px-5"><ToggleSwitch checked={accountNotifications.reminders} onChange={(value) => { setAccountNotifications((prev) => ({ ...prev, reminders: value })); setStatus('notifications', { error: null, success: null }); }} label="Reminders" description="Operational reminders for follow-up work and admin tasks." /></div>
                <div className="px-5"><ToggleSwitch checked={accountNotifications.browserNotifications} onChange={(value) => { setAccountNotifications((prev) => ({ ...prev, browserNotifications: value })); setStatus('notifications', { error: null, success: null }); }} label="Browser notifications" description="Allow this browser to show live alert prompts while you work." /></div>
                <div className="px-5"><ToggleSwitch checked={accountNotifications.smsNotifications} onChange={(value) => { setAccountNotifications((prev) => ({ ...prev, smsNotifications: value })); setStatus('notifications', { error: null, success: null }); }} label="SMS notifications" description="SMS delivery is not connected yet, but the preference is ready." /></div>
              </div>

              <SaveBar
                dirty={isDirty(accountNotifications, initialAccountNotifications)}
                saving={panelStatus.notifications?.saving ?? false}
                success={panelStatus.notifications?.success ?? null}
                error={panelStatus.notifications?.error ?? null}
                saveLabel="Save Preferences"
                onReset={() => {
                  if (initialAccountNotifications) setAccountNotifications(initialAccountNotifications);
                  setStatus('notifications', { error: null, success: null });
                }}
                onSave={() => {
                  void saveAccountSettings({ notifications: accountNotifications }, 'notifications', 'Notification preferences updated');
                }}
              />
            </div>
          )}
        </SettingsCard>
      );
    }

    if (location.group === 'workspace') {
      if (location.panel === 'general') {
        return (
          <SettingsCard title="Workspace General" description="Keep the core business record clean, then manage the public site stats in the same place." icon={<SettingsIcon />}>
            {siteLoading ? (
              <PanelSkeleton />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <FieldLabel>Workspace name</FieldLabel>
                    <InputField value={workspaceGeneral.workspaceName} onChange={(event) => { setWorkspaceGeneral((prev) => ({ ...prev, workspaceName: event.target.value })); setStatus('general', { error: null, success: null }); }} placeholder="Workspace name" />
                  </div>
                  <div>
                    <FieldLabel>Operations email</FieldLabel>
                    <InputField value={workspaceGeneral.operationsEmail} onChange={(event) => { setWorkspaceGeneral((prev) => ({ ...prev, operationsEmail: event.target.value })); setStatus('general', { error: null, success: null }); }} placeholder="ops@budsatwork.com" />
                  </div>
                  <div>
                    <FieldLabel>Support phone</FieldLabel>
                    <InputField value={workspaceGeneral.supportPhone} onChange={(event) => { setWorkspaceGeneral((prev) => ({ ...prev, supportPhone: event.target.value })); setStatus('general', { error: null, success: null }); }} placeholder="07 ..." />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">Site Content</h3>
                    <p className="mt-1 text-xs text-slate-500">These values are still used publicly. They now live under workspace settings instead of being mixed into the admin summary.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <FieldLabel>Jobs Completed</FieldLabel>
                      <InputField value={siteStats.jobs_completed} onChange={(event) => { setSiteStats((prev) => ({ ...prev, jobs_completed: event.target.value })); setStatus('general', { error: null, success: null }); }} />
                    </div>
                    <div>
                      <FieldLabel>Average Rating</FieldLabel>
                      <InputField value={siteStats.avg_rating} onChange={(event) => { setSiteStats((prev) => ({ ...prev, avg_rating: event.target.value })); setStatus('general', { error: null, success: null }); }} />
                    </div>
                    <div>
                      <FieldLabel>Repeat Customers</FieldLabel>
                      <InputField value={siteStats.repeat_customers} onChange={(event) => { setSiteStats((prev) => ({ ...prev, repeat_customers: event.target.value })); setStatus('general', { error: null, success: null }); }} />
                    </div>
                  </div>
                </div>

                <SaveBar
                  dirty={isDirty(workspaceGeneral, initialWorkspaceGeneral) || isDirty(siteStats, initialSiteStats)}
                  saving={panelStatus.general?.saving ?? false}
                  success={panelStatus.general?.success ?? null}
                  error={panelStatus.general?.error ?? null}
                  saveLabel="Save Workspace General"
                  onReset={() => {
                    if (initialWorkspaceGeneral) setWorkspaceGeneral(initialWorkspaceGeneral);
                    if (initialSiteStats) setSiteStats(initialSiteStats);
                    setStatus('general', { error: null, success: null });
                  }}
                  onSave={() => {
                    void saveSiteSettings('general', {
                      workspaceGeneral,
                      siteContent: siteStats,
                    }, 'Workspace general settings saved').then((saved) => {
                      if (!saved) return;
                      setInitialWorkspaceGeneral(workspaceGeneral);
                      setInitialSiteStats(siteStats);
                    });
                  }}
                />
              </div>
            )}
          </SettingsCard>
        );
      }

      if (location.panel === 'goals-targets') {
        return (
          <SettingsCard title="Goals & Targets" description="Monthly targets and cash position now live together as one operational settings panel." icon={<TargetIcon />}>
            {siteLoading ? (
              <PanelSkeleton />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <FieldLabel>Monthly revenue target</FieldLabel>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <InputField type="number" min={0} className="pl-8" value={goals.monthlyRevenueTarget} onChange={(event) => { setGoals((prev) => ({ ...prev, monthlyRevenueTarget: parseInt(event.target.value, 10) || 0 })); setStatus('goals-targets', { error: null, success: null }); }} />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Monthly jobs target</FieldLabel>
                    <InputField type="number" min={0} value={goals.monthlyJobsTarget} onChange={(event) => { setGoals((prev) => ({ ...prev, monthlyJobsTarget: parseInt(event.target.value, 10) || 0 })); setStatus('goals-targets', { error: null, success: null }); }} />
                  </div>
                  <div>
                    <FieldLabel>Cash balance</FieldLabel>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <InputField type="number" min={0} step={0.01} className="pl-8" value={goals.cashBalance} onChange={(event) => { setGoals((prev) => ({ ...prev, cashBalance: parseFloat(event.target.value) || 0 })); setStatus('goals-targets', { error: null, success: null }); }} />
                    </div>
                  </div>
                </div>

                <SaveBar
                  dirty={isDirty(goals, initialGoals)}
                  saving={panelStatus['goals-targets']?.saving ?? false}
                  success={panelStatus['goals-targets']?.success ?? null}
                  error={panelStatus['goals-targets']?.error ?? null}
                  saveLabel="Save Goals & Targets"
                  onReset={() => {
                    if (initialGoals) setGoals(initialGoals);
                    setStatus('goals-targets', { error: null, success: null });
                  }}
                  onSave={() => {
                    void saveSiteSettings('goals-targets', {
                      goals: {
                        monthlyRevenueTarget: goals.monthlyRevenueTarget,
                        monthlyJobsTarget: goals.monthlyJobsTarget,
                      },
                      cashBalance: goals.cashBalance,
                    }, 'Goals and cash position updated').then((saved) => {
                      if (!saved) return;
                      setInitialGoals(goals);
                    });
                  }}
                />
              </div>
            )}
          </SettingsCard>
        );
      }

      if (location.panel === 'service-area') {
        return (
          <SettingsCard title="Service Area" description="Capture where you operate and how travel affects quoting." icon={<MapIcon />}>
            {siteLoading ? (
              <PanelSkeleton />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <FieldLabel>Service zones</FieldLabel>
                    <TextareaField rows={5} value={serviceArea.serviceZones} onChange={(event) => { setServiceArea((prev) => ({ ...prev, serviceZones: event.target.value })); setStatus('service-area', { error: null, success: null }); }} placeholder="One zone per line or comma-separated list." />
                  </div>
                  <div>
                    <FieldLabel>Travel radius (km)</FieldLabel>
                    <InputField type="number" min={0} value={serviceArea.travelRadius} onChange={(event) => { setServiceArea((prev) => ({ ...prev, travelRadius: parseInt(event.target.value, 10) || 0 })); setStatus('service-area', { error: null, success: null }); }} />
                  </div>
                  <div>
                    <FieldLabel>Minimum callout fee</FieldLabel>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <InputField type="number" min={0} step={0.01} className="pl-8" value={serviceArea.minimumCalloutFee} onChange={(event) => { setServiceArea((prev) => ({ ...prev, minimumCalloutFee: parseFloat(event.target.value) || 0 })); setStatus('service-area', { error: null, success: null }); }} />
                    </div>
                  </div>
                </div>

                <SaveBar
                  dirty={isDirty(serviceArea, initialServiceArea)}
                  saving={panelStatus['service-area']?.saving ?? false}
                  success={panelStatus['service-area']?.success ?? null}
                  error={panelStatus['service-area']?.error ?? null}
                  saveLabel="Save Service Area"
                  onReset={() => {
                    if (initialServiceArea) setServiceArea(initialServiceArea);
                    setStatus('service-area', { error: null, success: null });
                  }}
                  onSave={() => {
                    void saveSiteSettings('service-area', { serviceArea }, 'Service area settings updated').then((saved) => {
                      if (!saved) return;
                      setInitialServiceArea(serviceArea);
                    });
                  }}
                />
              </div>
            )}
          </SettingsCard>
        );
      }

      if (location.panel === 'pricing-engine') {
        return (
          <SettingsCard title="Pricing Engine" description="Turn pricing into a real control panel instead of hidden assumptions." icon={<CashIcon />}>
            {siteLoading ? (
              <PanelSkeleton />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <FieldLabel>Base hourly rate</FieldLabel>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <InputField type="number" min={0} step={0.01} className="pl-8" value={pricingEngine.baseHourlyRate} onChange={(event) => { setPricingEngine((prev) => ({ ...prev, baseHourlyRate: parseFloat(event.target.value) || 0 })); setStatus('pricing-engine', { error: null, success: null }); }} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-5">
                    <ToggleSwitch checked={pricingEngine.effortModifiersEnabled} onChange={(value) => { setPricingEngine((prev) => ({ ...prev, effortModifiersEnabled: value })); setStatus('pricing-engine', { error: null, success: null }); }} label="Effort modifiers" description="Allow quote adjustments based on access, buildup, or complexity." />
                    <div className="border-t border-slate-200" />
                    <ToggleSwitch checked={pricingEngine.exactPriceModeEnabled} onChange={(value) => { setPricingEngine((prev) => ({ ...prev, exactPriceModeEnabled: value })); setStatus('pricing-engine', { error: null, success: null }); }} label="Exact price mode" description="Force fixed pricing instead of a softer estimate range." />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>Service caps</FieldLabel>
                    <TextareaField rows={5} value={pricingEngine.serviceCaps} onChange={(event) => { setPricingEngine((prev) => ({ ...prev, serviceCaps: event.target.value })); setStatus('pricing-engine', { error: null, success: null }); }} placeholder="Example: Lawn care: $220" />
                  </div>
                </div>

                <SaveBar
                  dirty={isDirty(pricingEngine, initialPricingEngine)}
                  saving={panelStatus['pricing-engine']?.saving ?? false}
                  success={panelStatus['pricing-engine']?.success ?? null}
                  error={panelStatus['pricing-engine']?.error ?? null}
                  saveLabel="Save Pricing Engine"
                  onReset={() => {
                    if (initialPricingEngine) setPricingEngine(initialPricingEngine);
                    setStatus('pricing-engine', { error: null, success: null });
                  }}
                  onSave={() => {
                    void saveSiteSettings('pricing-engine', { pricingEngine }, 'Pricing engine updated').then((saved) => {
                      if (!saved) return;
                      setInitialPricingEngine(pricingEngine);
                    });
                  }}
                />
              </div>
            )}
          </SettingsCard>
        );
      }

      if (location.panel === 'payments-payroll') {
        return (
          <SettingsCard title="Payments & Payroll" description="Payroll defaults and payout references live here as operational settings." icon={<CashIcon />}>
            {siteLoading ? (
              <PanelSkeleton />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <FieldLabel>Default pay rate</FieldLabel>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <InputField type="number" min={0} step={0.01} className="pl-8" value={payroll.defaultPayRate} onChange={(event) => { setPayroll((prev) => ({ ...prev, defaultPayRate: parseFloat(event.target.value) || 0 })); setStatus('payments-payroll', { error: null, success: null }); }} />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Pay cycle</FieldLabel>
                    <SelectField value={payroll.payCycle} onChange={(event) => { setPayroll((prev) => ({ ...prev, payCycle: event.target.value as PayrollSettings['payCycle'] })); setStatus('payments-payroll', { error: null, success: null }); }}>
                      <option value="weekly">Weekly</option>
                      <option value="fortnightly">Fortnightly</option>
                      <option value="monthly">Monthly</option>
                    </SelectField>
                  </div>
                  <div>
                    <FieldLabel>Payout method</FieldLabel>
                    <InputField value={payroll.payoutMethod} onChange={(event) => { setPayroll((prev) => ({ ...prev, payoutMethod: event.target.value })); setStatus('payments-payroll', { error: null, success: null }); }} placeholder="Bank transfer" />
                  </div>
                  <div>
                    <FieldLabel>Award reference</FieldLabel>
                    <InputField value={payroll.awardReference} onChange={(event) => { setPayroll((prev) => ({ ...prev, awardReference: event.target.value })); setStatus('payments-payroll', { error: null, success: null }); }} placeholder="Cleaning Services Award..." />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>Fair Work reference</FieldLabel>
                    <InputField value={payroll.fairWorkReference} onChange={(event) => { setPayroll((prev) => ({ ...prev, fairWorkReference: event.target.value })); setStatus('payments-payroll', { error: null, success: null }); }} placeholder="Placeholder link or policy reference" />
                  </div>
                </div>

                <SaveBar
                  dirty={isDirty(payroll, initialPayroll)}
                  saving={panelStatus['payments-payroll']?.saving ?? false}
                  success={panelStatus['payments-payroll']?.success ?? null}
                  error={panelStatus['payments-payroll']?.error ?? null}
                  saveLabel="Save Payroll Settings"
                  onReset={() => {
                    if (initialPayroll) setPayroll(initialPayroll);
                    setStatus('payments-payroll', { error: null, success: null });
                  }}
                  onSave={() => {
                    void saveSiteSettings('payments-payroll', { payrollSettings: payroll }, 'Payroll settings saved').then((saved) => {
                      if (!saved) return;
                      setInitialPayroll(payroll);
                    });
                  }}
                />
              </div>
            )}
          </SettingsCard>
        );
      }

      if (location.panel === 'invoice-settings') {
        return (
          <SettingsCard title="Invoice Settings" description="Keep the current invoice defaults intact, but in the right workspace section." icon={<DocumentIcon />}>
            {siteLoading ? (
              <PanelSkeleton />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4">
                  <div>
                    <FieldLabel>Default payment terms</FieldLabel>
                    <SelectField value={invoiceSettings.defaultPaymentTerms} onChange={(event) => { setInvoiceSettings((prev) => ({ ...prev, defaultPaymentTerms: parseInt(event.target.value, 10) })); setStatus('invoice-settings', { error: null, success: null }); }}>
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                    </SelectField>
                  </div>
                  <div>
                    <FieldLabel>Invoice number prefix</FieldLabel>
                    <InputField value={invoiceSettings.invoicePrefix} onChange={(event) => { setInvoiceSettings((prev) => ({ ...prev, invoicePrefix: event.target.value })); setStatus('invoice-settings', { error: null, success: null }); }} />
                  </div>
                  <div>
                    <FieldLabel>Invoice footer note</FieldLabel>
                    <TextareaField rows={3} value={invoiceSettings.footerNote} onChange={(event) => { setInvoiceSettings((prev) => ({ ...prev, footerNote: event.target.value })); setStatus('invoice-settings', { error: null, success: null }); }} />
                  </div>
                </div>

                <SaveBar
                  dirty={isDirty(invoiceSettings, initialInvoiceSettings)}
                  saving={panelStatus['invoice-settings']?.saving ?? false}
                  success={panelStatus['invoice-settings']?.success ?? null}
                  error={panelStatus['invoice-settings']?.error ?? null}
                  saveLabel="Save Invoice Settings"
                  onReset={() => {
                    if (initialInvoiceSettings) setInvoiceSettings(initialInvoiceSettings);
                    setStatus('invoice-settings', { error: null, success: null });
                  }}
                  onSave={() => {
                    void saveSiteSettings('invoice-settings', { invoiceSettings }, 'Invoice settings saved').then((saved) => {
                      if (!saved) return;
                      setInitialInvoiceSettings(invoiceSettings);
                    });
                  }}
                />
              </div>
            )}
          </SettingsCard>
        );
      }

      return (
        <SettingsCard title="Team & Permissions" description="The team list stays here, but now with clearer role context and less raw-dump feeling." icon={<UserIcon />}>
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              {(['admin', 'employee', 'customer'] as const).map((roleKey) => (
                <div key={roleKey} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-sm font-semibold text-slate-900">{formatRole(roleKey)}</p>
                  <p className="mt-1 text-xs text-slate-500">{ROLE_EXPLANATIONS[roleKey]}</p>
                  <p className="mt-4 text-2xl font-semibold text-slate-900">{groupedTeamMembers[roleKey].length}</p>
                </div>
              ))}
            </div>

            {teamLoading ? (
              <PanelSkeleton />
            ) : teamMembers.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 text-sm text-slate-500">No team members available for this account.</div>
            ) : (
              <div className="space-y-6">
                {(['admin', 'employee', 'customer'] as const).map((roleKey) => (
                  groupedTeamMembers[roleKey].length > 0 ? (
                    <div key={roleKey} className="space-y-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{formatRole(roleKey)}</h3>
                        <p className="mt-1 text-xs text-slate-500">{ROLE_EXPLANATIONS[roleKey]}</p>
                      </div>
                      <div className="space-y-3">
                        {groupedTeamMembers[roleKey].map((member) => {
                          const emailKey = member.email.trim().toLowerCase();
                          const duplicateCount = emailKey ? duplicateEmails.get(emailKey) ?? 0 : 0;
                          return (
                            <div key={member.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex items-start gap-3">
                                  {member.imageUrl ? (
                                    <img src={member.imageUrl} alt={member.name} className="h-11 w-11 rounded-full border border-slate-200 object-cover" />
                                  ) : (
                                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-700">
                                      {member.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_COLORS[member.role] || ROLE_COLORS.customer}`}>
                                        {formatRole(member.role)}
                                      </span>
                                      {duplicateCount > 1 ? (
                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                          Possible duplicate email
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">{member.email || 'No email on file'}</p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="min-w-[210px]">
                                    <FieldLabel>Role</FieldLabel>
                                    <SelectField value={member.role} onChange={(event) => void handleRoleChange(member.id, event.target.value)}>
                                      {ALL_ROLES.map((role) => (
                                        <option key={role} value={role}>{formatRole(role)}</option>
                                      ))}
                                    </SelectField>
                                  </div>
                                  <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                                    {member.active ? 'Active access' : 'Inactive'}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null
                ))}
              </div>
            )}
          </div>
        </SettingsCard>
      );
    }

    if (location.group === 'system') {
      if (location.panel === 'system-overview') {
        return (
          <div className="space-y-6">
            <SettingsCard title="System Overview" description="Keep the oversight layer intact, but framed as system control rather than the entire settings experience." icon={<SettingsIcon />}>
              <WorkbenchStatGrid stats={stats} />
            </SettingsCard>
            <WorkbenchQueue
              title="Configuration Focus Queue"
              subtitle="The fastest places to tighten the admin system before problems spill into operations."
              items={queueItems}
            />
          </div>
        );
      }

      if (location.panel === 'automations') {
        return (
          <SettingsCard title="Automations" description="Existing automation controls now live as a dedicated system subsection." icon={<SettingsIcon />}>
            {siteLoading ? (
              <PanelSkeleton />
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {(Object.entries(automations) as Array<[keyof AutomationSettings, boolean]>).map(([key, value]) => (
                    <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <ToggleSwitch
                        checked={Boolean(value)}
                        onChange={(next) => {
                          setAutomations((prev) => ({ ...prev, [key]: next }));
                          setStatus('automations', { error: null, success: null });
                        }}
                        label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}
                        description="System automation toggle"
                      />
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                  <FieldLabel>Re-engagement discount percent</FieldLabel>
                  <div className="relative max-w-xs">
                    <InputField
                      type="number"
                      min={1}
                      max={90}
                      value={automationConfig.quoteReengagementDiscountPercent}
                      onChange={(event) => {
                        setAutomationConfig((prev) => ({
                          ...prev,
                          quoteReengagementDiscountPercent: Math.max(1, Math.min(90, parseInt(event.target.value, 10) || 1)),
                        }));
                        setStatus('automations', { error: null, success: null });
                      }}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                  </div>
                </div>

                <SaveBar
                  dirty={isDirty(automations, initialAutomations) || isDirty(automationConfig, initialAutomationConfig)}
                  saving={panelStatus.automations?.saving ?? false}
                  success={panelStatus.automations?.success ?? null}
                  error={panelStatus.automations?.error ?? null}
                  saveLabel="Save Automations"
                  onReset={() => {
                    if (initialAutomations) setAutomations(initialAutomations);
                    if (initialAutomationConfig) setAutomationConfig(initialAutomationConfig);
                    setStatus('automations', { error: null, success: null });
                  }}
                  onSave={() => {
                    void saveSiteSettings('automations', {
                      automations,
                      automationConfig,
                    }, 'Automation settings updated').then((saved) => {
                      if (!saved) return;
                      setInitialAutomations(automations);
                      setInitialAutomationConfig(automationConfig);
                    });
                  }}
                />
              </div>
            )}
          </SettingsCard>
        );
      }

      if (location.panel === 'audit-log') {
        return <AuditLogPage />;
      }

      return <FeedbackPage />;
    }

    if (location.panel === 'export-data') {
      return (
        <SettingsCard title="Export Data" description="Download an account and settings export without touching destructive controls." icon={<DocumentIcon />}>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm text-red-700">Download a JSON backup of your account and workspace configuration.</p>
            <button
              type="button"
              onClick={() => toast.info('Data export coming soon!')}
              className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Export Data
            </button>
          </div>
        </SettingsCard>
      );
    }

    return (
      <SettingsCard title="Delete Account" description="Deletion stays isolated and clearly marked as destructive." icon={<ShieldIcon />}>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">Account deletion remains disabled in this environment. That keeps the UI visible without exposing an unsafe action.</p>
          <button
            type="button"
            onClick={() => toast.error('This action is disabled for demo purposes.')}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete Account
          </button>
        </div>
      </SettingsCard>
    );
  }

  return (
    <div className="grid w-full gap-6 px-4 pb-14 md:px-10 lg:px-12">
      <WorkbenchHeader
        eyebrow={location.group === 'danger' ? 'Danger Zone' : formatRole(location.group)}
        title={activePanelMeta.label}
        description={activePanelMeta.description}
      />

      <WorkbenchTabs tabs={GROUP_TABS} activeTab={location.group} onTabChange={(next) => navigate(next)} />

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-black/5 bg-white/90 p-3 shadow-sm">
          <div className="mb-3 px-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{formatRole(location.group)}</p>
            <p className="mt-1 text-xs text-slate-500">Each panel is separated so personal, workspace, and system controls no longer blur together.</p>
          </div>
          <div className="space-y-1">
            {activePanels.map((panel) => {
              const active = panel.key === location.panel;
              return (
                <button
                  key={panel.key}
                  type="button"
                  onClick={() => navigate(location.group, panel.key)}
                  className="w-full rounded-xl px-4 py-3 text-left transition"
                  style={active ? { background: brand.primary, color: '#fff' } : { background: '#fff', color: brand.muted }}
                >
                  <div className="text-sm font-semibold">{panel.label}</div>
                  <div className={`mt-1 text-xs ${active ? 'text-white/80' : 'text-slate-500'}`}>{panel.description}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0">{renderPanel()}</div>
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-12 rounded-xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}
