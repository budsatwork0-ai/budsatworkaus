'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useOpenMessaging } from '../hooks/useMessagingHub';
import { dashboardTheme } from '@/lib/design-system/themes';
import { WorkbenchHeader, WorkbenchQueue, WorkbenchStatGrid, WorkbenchTabs } from '../components/Workbench';
import { useTabbedNav } from '../hooks/useTabbedNav';

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  region: string | null;
  default_address: string | null;
  created_at: string;
};

type Stats = {
  totalCustomers: number;
  activeThisMonth: number;
  avgOrderValue: number;
  totalRevenue: number;
};

type CustomerView = 'directory' | 'recent' | 'incomplete';

function sanitizeCustomerView(value: string | null): CustomerView {
  if (value === 'recent' || value === 'incomplete') return value;
  return 'directory';
}

function CustomerPageContent() {
  const [view, setView] = useTabbedNav<CustomerView>('view', sanitizeCustomerView);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const openMessaging = useOpenMessaging();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', region: '', default_address: '' });

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const [custRes, statsRes] = await Promise.all([
      fetch(`/api/customers?${params}`).then((r) => r.json()).catch(() => ({ customers: [] })),
      fetch('/api/customers/stats').then((r) => r.json()).catch(() => null),
    ]);
    setCustomers(custRes.customers || []);
    if (statsRes) setStats(statsRes);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const recentCustomers = useMemo(() => {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 30);
    return customers.filter((customer) => new Date(customer.created_at) >= threshold);
  }, [customers]);

  const incompleteCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const missingContact = !customer.email && !customer.phone;
      const missingProfile = !customer.default_address || !customer.region;
      return missingContact || missingProfile;
    });
  }, [customers]);

  const missingContactCount = useMemo(
    () => customers.filter((customer) => !customer.email && !customer.phone).length,
    [customers]
  );

  const missingAddressCount = useMemo(
    () => customers.filter((customer) => !customer.default_address || !customer.region).length,
    [customers]
  );

  const visibleCustomers = useMemo(() => {
    if (view === 'recent') return recentCustomers;
    if (view === 'incomplete') return incompleteCustomers;
    return customers;
  }, [customers, incompleteCustomers, recentCustomers, view]);

  const handleCreate = async () => {
    if (!form.full_name.trim()) {
      toast.error('Name is required');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          region: form.region.trim() || null,
          default_address: form.default_address.trim() || null,
        }),
      });

      if (res.ok) {
        toast.success('Customer created');
        setCreateOpen(false);
        setForm({ full_name: '', email: '', phone: '', region: '', default_address: '' });
        fetchCustomers();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create customer');
      }
    } catch {
      toast.error('Failed to create customer');
    } finally {
      setCreating(false);
    }
  };

  const summaryCards = [
    {
      label: 'Total Customers',
      value: String(stats?.totalCustomers ?? customers.length),
      detail: `${stats?.activeThisMonth ?? recentCustomers.length} active this month`,
      tone: 'emerald' as const,
    },
    {
      label: 'Recent Adds',
      value: String(recentCustomers.length),
      detail: 'Created in the last 30 days',
      tone: 'blue' as const,
    },
    {
      label: 'Missing Contact',
      value: String(missingContactCount),
      detail: 'No email or phone on file',
      tone: missingContactCount > 0 ? ('amber' as const) : ('slate' as const),
    },
    {
      label: 'Avg Order Value',
      value: `$${(stats?.avgOrderValue ?? 0).toFixed(0)}`,
      detail: `$${((stats?.totalRevenue ?? 0) / 1000).toFixed(1)}k total revenue`,
      tone: 'slate' as const,
    },
  ];

  const focusItems = [
    {
      key: 'recent',
      title: `${recentCustomers.length} customers added recently`,
      detail: 'Review new customers and make sure location and contact details are complete before they fall into the broader directory.',
      tone: 'blue' as const,
      actionLabel: 'Open recent',
      onAction: () => setView('recent'),
    },
    {
      key: 'contact',
      title: `${missingContactCount} profiles missing contact details`,
      detail: 'These customer profiles have no phone and no email, which blocks follow-up on invoices, quotes, and service reminders.',
      tone: missingContactCount > 0 ? ('amber' as const) : ('slate' as const),
      actionLabel: 'Review incomplete',
      onAction: () => setView('incomplete'),
    },
    {
      key: 'address',
      title: `${missingAddressCount} profiles missing address or region`,
      detail: 'Fill these gaps so schedule planning, service zones, and crew dispatch stay reliable.',
      tone: missingAddressCount > 0 ? ('amber' as const) : ('slate' as const),
      actionLabel: 'Review incomplete',
      onAction: () => setView('incomplete'),
    },
  ];

  const tabs = [
    { key: 'directory' as const, label: 'Directory', count: customers.length },
    { key: 'recent' as const, label: 'Recent', count: recentCustomers.length },
    { key: 'incomplete' as const, label: 'Incomplete', count: incompleteCustomers.length },
  ];

  const viewCopy: Record<CustomerView, { title: string; description: string }> = {
    directory: {
      title: 'Customer Directory',
      description: 'Search the full customer base and open detailed profiles from a single table.',
    },
    recent: {
      title: 'Recent Customers',
      description: 'Newly created customer profiles from the last 30 days.',
    },
    incomplete: {
      title: 'Incomplete Profiles',
      description: 'Customer records missing contact or location data that should be cleaned up.',
    },
  };

  return (
    <div className="grid gap-6 w-full px-4 md:px-10 lg:px-12 pb-14">
      <WorkbenchHeader
        eyebrow="Customer Workspace"
        title="Manage customer relationships with clearer triage."
        description="This tab now behaves more like an operations workspace: summary metrics up top, scoped customer modes, and a focused cleanup queue before the full directory."
        actions={(
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: dashboardTheme.color.primary }}
          >
            + Add Customer
          </button>
        )}
      />

      <WorkbenchStatGrid stats={summaryCards} />
      <WorkbenchTabs tabs={tabs} activeTab={view} onTabChange={setView} />
      <WorkbenchQueue
        title="Customer Focus Queue"
        subtitle="Triage the customer records that need attention before working through the broader directory."
        items={focusItems}
      />

      <section className={`${glass} p-5`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: dashboardTheme.color.primary }}>
              {viewCopy[view].title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{viewCopy[view].description}</p>
          </div>
          <div className="w-full md:w-80">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-1">
              Search customers
            </label>
            <input
              type="text"
              placeholder="Name, email, phone, or region"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border px-4 py-2.5 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none"
              style={{ borderColor: dashboardTheme.color.border }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-3 py-1">{visibleCustomers.length} visible</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">Mode: {tabs.find((tab) => tab.key === view)?.label}</span>
        </div>

        {loading ? (
          <div className="mt-5 space-y-2">{[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-14 rounded-xl bg-white/50 animate-pulse" />)}</div>
        ) : visibleCustomers.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-black/10 bg-white/60 p-8 text-center">
            <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>No customers match this view right now.</p>
          </div>
        ) : (
          <>
            <div className="mt-5 space-y-3 md:hidden">
              {visibleCustomers.map((customer) => (
                <div key={customer.id} className={`${glass} p-4`} onClick={() => setSelected(customer)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: dashboardTheme.color.text }}>{customer.full_name}</p>
                      <p className="text-xs mt-0.5" style={{ color: dashboardTheme.color.muted }}>{customer.email || customer.phone || 'No contact'}</p>
                    </div>
                    {(!customer.email && !customer.phone) || !customer.default_address ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Needs cleanup
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] mt-2" style={{ color: dashboardTheme.color.muted }}>{customer.region || 'No region set'}</p>
                </div>
              ))}
            </div>

            <div className="hidden md:block mt-5 overflow-hidden rounded-2xl border border-black/5 bg-white/95">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-white text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="border-b border-slate-100 px-4 py-2">Customer</th>
                    <th className="border-b border-slate-100 px-4 py-2">Contact</th>
                    <th className="border-b border-slate-100 px-4 py-2">Location</th>
                    <th className="border-b border-slate-100 px-4 py-2">Joined</th>
                    <th className="border-b border-slate-100 px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCustomers.map((customer) => {
                    const missingContact = !customer.email && !customer.phone;
                    const missingProfile = !customer.default_address || !customer.region;
                    return (
                      <tr
                        key={customer.id}
                        className="cursor-pointer hover:bg-slate-50 border-b border-slate-50"
                        onClick={() => setSelected(customer)}
                      >
                        <td className="px-4 py-3 font-medium">
                          <div className="text-slate-900">{customer.full_name}</div>
                          <div className="text-xs text-slate-500">{customer.default_address || 'No address set'}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          <div>{customer.email || '-'}</div>
                          <div className="text-xs">{customer.phone || 'No phone'}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{customer.region || 'No region'}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(customer.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          {missingContact || missingProfile ? (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700">
                              Needs cleanup
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                              Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative ml-auto h-full w-full max-w-md border-l border-black/5 bg-white/95 shadow-2xl overflow-y-auto">
            <div className="px-6 py-5 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Customer</p>
                <h2 className="text-lg font-semibold">{selected.full_name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openMessaging({ entity_type: 'customer', entity_id: selected.id, display_name: selected.full_name })}
                  className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm text-slate-500 hover:bg-slate-50"
                >
                  Message
                </button>
                <button onClick={() => setSelected(null)} className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm text-slate-500">Close</button>
              </div>
            </div>
            <div className="px-6 pb-6 space-y-4 text-sm">
              {selected.email && <div className="flex justify-between gap-4"><span className="text-slate-500">Email</span><span className="text-right">{selected.email}</span></div>}
              {selected.phone && <div className="flex justify-between gap-4"><span className="text-slate-500">Phone</span><span className="text-right">{selected.phone}</span></div>}
              {selected.region && <div className="flex justify-between gap-4"><span className="text-slate-500">Region</span><span className="text-right">{selected.region}</span></div>}
              {selected.default_address && <div className="flex justify-between gap-4"><span className="text-slate-500">Address</span><span className="text-right max-w-[200px]">{selected.default_address}</span></div>}
              <div className="flex justify-between gap-4"><span className="text-slate-500">Customer since</span><span className="text-right">{new Date(selected.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
            </div>
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {createOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => setCreateOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6"
            >
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Add Customer</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full rounded-xl border px-4 py-2 text-sm"
                    style={{ borderColor: dashboardTheme.color.border }}
                    placeholder="John Smith"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full rounded-xl border px-4 py-2 text-sm"
                      style={{ borderColor: dashboardTheme.color.border }}
                      placeholder="john@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full rounded-xl border px-4 py-2 text-sm"
                      style={{ borderColor: dashboardTheme.color.border }}
                      placeholder="0412 345 678"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
                  <input
                    type="text"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    className="w-full rounded-xl border px-4 py-2 text-sm"
                    style={{ borderColor: dashboardTheme.color.border }}
                    placeholder="Logan, Brisbane South"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={form.default_address}
                    onChange={(e) => setForm({ ...form, default_address: e.target.value })}
                    className="w-full rounded-xl border px-4 py-2 text-sm"
                    style={{ borderColor: dashboardTheme.color.border }}
                    placeholder="123 Main Street, Logan QLD 4114"
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="flex-1 px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-1 px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50"
                  style={{ background: dashboardTheme.color.primary }}
                >
                  {creating ? 'Creating...' : 'Create Customer'}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="min-h-[320px] w-full" />}>
      <CustomerPageContent />
    </Suspense>
  );
}
