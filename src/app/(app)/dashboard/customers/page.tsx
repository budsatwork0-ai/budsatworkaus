'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';

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

type Stats = { totalCustomers: number; activeThisMonth: number; avgOrderValue: number; totalRevenue: number };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
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

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleCreate = async () => {
    if (!form.full_name.trim()) { toast.error('Name is required'); return; }
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
    { label: 'Total Customers', value: String(stats?.totalCustomers ?? 0), color: brand.primary },
    { label: 'Active This Month', value: String(stats?.activeThisMonth ?? 0), color: '#3B82F6' },
    { label: 'Avg Order Value', value: `$${(stats?.avgOrderValue ?? 0).toFixed(0)}`, color: '#8B5CF6' },
    { label: 'Total Revenue', value: `$${((stats?.totalRevenue ?? 0) / 1000).toFixed(1)}k`, color: '#10B981' },
  ];

  return (
    <div className="grid gap-6 w-full px-4 md:px-10 lg:px-12 pb-14">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: brand.primary }}>Customers</h1>
          <p className="text-sm text-slate-500">Manage customer relationships and view order history.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 rounded-xl text-sm text-white font-medium"
          style={{ background: brand.primary }}
        >
          + Add Customer
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className={`${glass} p-4`}>
            <p className="text-[11px] uppercase tracking-wider" style={{ color: brand.muted }}>{card.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: card.color }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-xl border px-4 py-2 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none"
          style={{ borderColor: brand.border }}
        />
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-14 rounded-xl bg-white/50 animate-pulse" />)}</div>
      ) : customers.length === 0 ? (
        <div className={`${glass} p-8 text-center`}>
          <p className="text-sm" style={{ color: brand.muted }}>No customers found.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {customers.map((c) => (
              <div key={c.id} className={`${glass} p-4`} onClick={() => setSelected(c)}>
                <p className="font-semibold text-sm" style={{ color: brand.text }}>{c.full_name}</p>
                <p className="text-xs mt-0.5" style={{ color: brand.muted }}>{c.email || c.phone || 'No contact'}</p>
                <p className="text-[11px] mt-1" style={{ color: brand.muted }}>{c.region || 'No region'}</p>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-black/5 bg-white/90">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-white/95 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-slate-100 px-4 py-2">Name</th>
                  <th className="border-b border-slate-100 px-4 py-2">Email</th>
                  <th className="border-b border-slate-100 px-4 py-2">Phone</th>
                  <th className="border-b border-slate-100 px-4 py-2">Region</th>
                  <th className="border-b border-slate-100 px-4 py-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-slate-50 border-b border-slate-50" onClick={() => setSelected(c)}>
                    <td className="px-4 py-3 font-medium">{c.full_name}</td>
                    <td className="px-4 py-3 text-slate-500">{c.email || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{c.phone || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{c.region || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(c.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative ml-auto h-full w-full max-w-md border-l border-black/5 bg-white/95 shadow-2xl overflow-y-auto">
            <div className="px-6 py-5 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Customer</p>
                <h2 className="text-lg font-semibold">{selected.full_name}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-full border border-black/10 bg-white px-3 py-1 text-sm text-slate-500">Close</button>
            </div>
            <div className="px-6 pb-6 space-y-4 text-sm">
              {selected.email && <div className="flex justify-between"><span className="text-slate-500">Email</span><span>{selected.email}</span></div>}
              {selected.phone && <div className="flex justify-between"><span className="text-slate-500">Phone</span><span>{selected.phone}</span></div>}
              {selected.region && <div className="flex justify-between"><span className="text-slate-500">Region</span><span>{selected.region}</span></div>}
              {selected.default_address && <div className="flex justify-between"><span className="text-slate-500">Address</span><span className="text-right max-w-[200px]">{selected.default_address}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Customer since</span><span>{new Date(selected.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Create Customer Modal */}
      <AnimatePresence>
        {createOpen && (
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
                  <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full rounded-xl border px-4 py-2 text-sm"
                    style={{ borderColor: brand.border }}
                    placeholder="John Smith"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full rounded-xl border px-4 py-2 text-sm"
                      style={{ borderColor: brand.border }}
                      placeholder="john@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full rounded-xl border px-4 py-2 text-sm"
                      style={{ borderColor: brand.border }}
                      placeholder="0412 345 678"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Region</label>
                  <input
                    type="text"
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    className="w-full rounded-xl border px-4 py-2 text-sm"
                    style={{ borderColor: brand.border }}
                    placeholder="Logan, Brisbane South"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                  <input
                    type="text"
                    value={form.default_address}
                    onChange={(e) => setForm({ ...form, default_address: e.target.value })}
                    className="w-full rounded-xl border px-4 py-2 text-sm"
                    style={{ borderColor: brand.border }}
                    placeholder="123 Main Street, Logan QLD 4114"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setCreateOpen(false)} className="flex-1 px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleCreate} disabled={creating} className="flex-1 px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50" style={{ background: brand.primary }}>
                  {creating ? 'Creating...' : 'Create Customer'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
