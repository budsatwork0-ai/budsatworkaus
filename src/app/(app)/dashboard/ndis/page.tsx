'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { brand, glass } from '@/app/ui/theme';

type OrgStatus = 'active' | 'inactive' | 'trialing' | 'past_due' | 'cancelled';

type NdisOrg = {
  id: string;
  name: string;
  abn: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  website: string | null;
  notes: string | null;
  subscription_status: OrgStatus;
  subscription_plan: string | null;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  participant_count: number;
  created_at: string;
};

type Participant = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  ndis_number: string | null;
  status: string;
  invite_sent_at: string | null;
  joined_at: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<OrgStatus, string> = {
  active:    'bg-emerald-100 text-emerald-700',
  trialing:  'bg-blue-100 text-blue-700',
  past_due:  'bg-amber-100 text-amber-700',
  inactive:  'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<OrgStatus, string> = {
  active:    'Active',
  trialing:  'Trial',
  past_due:  'Past due',
  inactive:  'Inactive',
  cancelled: 'Cancelled',
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

const EMPTY_ORG = { name: '', contact_name: '', contact_email: '', contact_phone: '', abn: '', website: '', notes: '' };
const EMPTY_PART = { full_name: '', email: '', phone: '', ndis_number: '', notes: '' };

export default function NdisPage() {
  const [orgs, setOrgs] = useState<NdisOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState<NdisOrg | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);

  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showAddPart, setShowAddPart] = useState(false);
  const [orgForm, setOrgForm] = useState(EMPTY_ORG);
  const [partForm, setPartForm] = useState(EMPTY_PART);
  const [saving, setSaving] = useState(false);

  const fetchOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ndis/organisations');
      const data = await res.json();
      setOrgs(data.organisations || []);
    } catch {
      toast.error('Failed to load NDIS organisations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchOrgs(); }, [fetchOrgs]);

  async function fetchParticipants(orgId: string) {
    setPartsLoading(true);
    try {
      const res = await fetch(`/api/ndis/organisations/${orgId}/participants`);
      const data = await res.json();
      setParticipants(data.participants || []);
    } catch {
      toast.error('Failed to load participants');
    } finally {
      setPartsLoading(false);
    }
  }

  function selectOrg(org: NdisOrg) {
    setSelectedOrg(org);
    void fetchParticipants(org.id);
  }

  async function createOrg() {
    if (!orgForm.name || !orgForm.contact_name || !orgForm.contact_email) {
      toast.error('Name, contact name and contact email are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/ndis/organisations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgForm),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to create organisation');
      }
      toast.success('Organisation created');
      setShowCreateOrg(false);
      setOrgForm(EMPTY_ORG);
      void fetchOrgs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function addParticipant() {
    if (!selectedOrg) return;
    if (!partForm.full_name || !partForm.email) {
      toast.error('Name and email are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/ndis/organisations/${selectedOrg.id}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partForm),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to add participant');
      }
      toast.success('Participant added');
      setShowAddPart(false);
      setPartForm(EMPTY_PART);
      void fetchParticipants(selectedOrg.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function startSubscription(org: NdisOrg) {
    setSaving(true);
    try {
      const res = await fetch(`/api/ndis/organisations/${org.id}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create subscription link');
      if (data.url) window.open(data.url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start subscription');
    } finally {
      setSaving(false);
    }
  }

  async function cancelSubscription(org: NdisOrg) {
    if (!confirm(`Cancel subscription for ${org.name}? Their participants will lose access.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ndis/organisations/${org.id}/subscribe`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to cancel subscription');
      }
      toast.success('Subscription cancelled');
      void fetchOrgs();
      if (selectedOrg?.id === org.id) {
        setSelectedOrg((prev) => prev ? { ...prev, subscription_status: 'cancelled', stripe_subscription_id: null } : null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  const activeCount = orgs.filter((o) => o.subscription_status === 'active').length;
  const totalParticipants = orgs.reduce((sum, o) => sum + o.participant_count, 0);

  return (
    <div className="grid gap-6 w-full px-4 md:px-10 lg:px-12 pb-14">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: brand.text }}>NDIS Organisations</h1>
          <p className="text-sm mt-0.5" style={{ color: brand.muted }}>
            Manage NDIS company subscriptions and their participants
          </p>
        </div>
        <button
          onClick={() => setShowCreateOrg(true)}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: brand.primary }}
        >
          + Add Organisation
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total orgs', value: orgs.length },
          { label: 'Active subscriptions', value: activeCount },
          { label: 'Total participants', value: totalParticipants },
          { label: 'Monthly revenue', value: `$${(activeCount * (Number(process.env.NEXT_PUBLIC_NDIS_SUB_PRICE) || 0)).toFixed(0)}` },
        ].map((card) => (
          <div key={card.label} className={`${glass} p-4`}>
            <p className="text-xs font-medium mb-1" style={{ color: brand.muted }}>{card.label}</p>
            <p className="text-2xl font-bold" style={{ color: brand.text }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Org list */}
        <div className={`${glass} p-4 lg:col-span-2`}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: brand.text }}>
            Organisations ({orgs.length})
          </h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />)}
            </div>
          ) : orgs.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: brand.muted }}>
              No organisations yet. Add one above.
            </p>
          ) : (
            <div className="space-y-2">
              {orgs.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => selectOrg(org)}
                  className="w-full text-left rounded-xl border p-3 transition-all"
                  style={selectedOrg?.id === org.id
                    ? { borderColor: brand.primary, background: `${brand.primary}08` }
                    : { borderColor: brand.border, background: 'white' }
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: brand.text }}>{org.name}</p>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: brand.muted }}>{org.contact_email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[org.subscription_status]}`}>
                        {STATUS_LABELS[org.subscription_status]}
                      </span>
                      <span className="text-[10px]" style={{ color: brand.muted }}>
                        {org.participant_count} participant{org.participant_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Org detail */}
        <div className={`${glass} p-5 lg:col-span-3`}>
          {!selectedOrg ? (
            <div className="flex items-center justify-center h-48">
              <p className="text-sm" style={{ color: brand.muted }}>Select an organisation to view details</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Org info */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold" style={{ color: brand.text }}>{selectedOrg.name}</h2>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[selectedOrg.subscription_status]}`}>
                      {STATUS_LABELS[selectedOrg.subscription_status]}
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: brand.muted }}>
                    {selectedOrg.contact_name} · {selectedOrg.contact_email}
                    {selectedOrg.contact_phone && ` · ${selectedOrg.contact_phone}`}
                  </p>
                  {selectedOrg.abn && (
                    <p className="text-xs mt-0.5" style={{ color: brand.muted }}>ABN: {selectedOrg.abn}</p>
                  )}
                  {selectedOrg.current_period_end && (
                    <p className="text-xs mt-0.5" style={{ color: brand.muted }}>
                      Renews: {formatDate(selectedOrg.current_period_end)}
                    </p>
                  )}
                  {selectedOrg.notes && (
                    <p className="text-xs mt-1 italic" style={{ color: brand.muted }}>{selectedOrg.notes}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {selectedOrg.subscription_status !== 'active' && selectedOrg.subscription_status !== 'trialing' ? (
                    <button
                      onClick={() => void startSubscription(selectedOrg)}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                      style={{ background: brand.primary }}
                    >
                      Start subscription
                    </button>
                  ) : (
                    <button
                      onClick={() => void cancelSubscription(selectedOrg)}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancel sub
                    </button>
                  )}
                </div>
              </div>

              {/* Subscription status explainer */}
              {selectedOrg.subscription_status !== 'active' && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                  <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <p className="text-xs text-amber-800">
                    Participants cannot access the platform until the organisation has an active subscription.
                  </p>
                </div>
              )}

              {/* Participants section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold" style={{ color: brand.text }}>
                    Participants ({participants.length})
                  </h3>
                  <button
                    onClick={() => setShowAddPart(true)}
                    className="text-xs font-medium px-2.5 py-1 rounded-lg border"
                    style={{ borderColor: brand.border, color: brand.primary }}
                  >
                    + Add participant
                  </button>
                </div>

                {partsLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />)}
                  </div>
                ) : participants.length === 0 ? (
                  <p className="text-xs text-center py-6" style={{ color: brand.muted }}>
                    No participants added yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          {['Name', 'Email', 'NDIS #', 'Status', 'Joined'].map((h) => (
                            <th key={h} className="text-left pb-2 font-semibold pr-3" style={{ color: brand.muted }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: brand.border }}>
                        {participants.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 pr-3 font-medium" style={{ color: brand.text }}>{p.full_name}</td>
                            <td className="py-2 pr-3" style={{ color: brand.muted }}>{p.email}</td>
                            <td className="py-2 pr-3" style={{ color: brand.muted }}>{p.ndis_number || '—'}</td>
                            <td className="py-2 pr-3">
                              <span className={`px-1.5 py-0.5 rounded font-medium ${
                                p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="py-2" style={{ color: brand.muted }}>
                              {p.joined_at ? formatDate(p.joined_at) : <span className="italic">Pending invite</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create org modal */}
      {showCreateOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div className={`${glass} w-full max-w-md p-6 rounded-2xl`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold" style={{ color: brand.text }}>Add NDIS Organisation</h3>
              <button onClick={() => { setShowCreateOrg(false); setOrgForm(EMPTY_ORG); }} className="p-1 rounded-lg hover:bg-slate-100">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="space-y-3 mb-5">
              {[
                { key: 'name', label: 'Organisation name *', placeholder: 'e.g. Brisbane Support Network' },
                { key: 'contact_name', label: 'Contact name *', placeholder: 'e.g. Jane Smith' },
                { key: 'contact_email', label: 'Contact email *', placeholder: 'e.g. jane@org.com.au', type: 'email' },
                { key: 'contact_phone', label: 'Phone', placeholder: '04xx xxx xxx' },
                { key: 'abn', label: 'ABN', placeholder: '12 345 678 901' },
                { key: 'website', label: 'Website', placeholder: 'https://...' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>{label}</label>
                  <input
                    type={type || 'text'}
                    value={(orgForm as Record<string, string>)[key]}
                    onChange={(e) => setOrgForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ borderColor: brand.border, color: brand.text }}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>Notes</label>
                <textarea
                  rows={2}
                  value={orgForm.notes}
                  onChange={(e) => setOrgForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none"
                  style={{ borderColor: brand.border, color: brand.text }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreateOrg(false); setOrgForm(EMPTY_ORG); }}
                className="flex-1 py-2 rounded-xl border text-sm font-medium hover:bg-slate-50"
                style={{ borderColor: brand.border, color: brand.muted }}
              >
                Cancel
              </button>
              <button
                onClick={() => void createOrg()}
                disabled={saving}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: brand.primary }}
              >
                {saving ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add participant modal */}
      {showAddPart && selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <div className={`${glass} w-full max-w-sm p-6 rounded-2xl`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold" style={{ color: brand.text }}>Add Participant</h3>
                <p className="text-xs mt-0.5" style={{ color: brand.muted }}>{selectedOrg.name}</p>
              </div>
              <button onClick={() => { setShowAddPart(false); setPartForm(EMPTY_PART); }} className="p-1 rounded-lg hover:bg-slate-100">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="space-y-3 mb-5">
              {[
                { key: 'full_name', label: 'Full name *', placeholder: 'e.g. Alex Johnson' },
                { key: 'email', label: 'Email *', placeholder: 'alex@email.com', type: 'email' },
                { key: 'phone', label: 'Phone', placeholder: '04xx xxx xxx' },
                { key: 'ndis_number', label: 'NDIS number', placeholder: '430 123 456 7' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>{label}</label>
                  <input
                    type={type || 'text'}
                    value={(partForm as Record<string, string>)[key]}
                    onChange={(e) => setPartForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                    style={{ borderColor: brand.border, color: brand.text }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAddPart(false); setPartForm(EMPTY_PART); }}
                className="flex-1 py-2 rounded-xl border text-sm font-medium hover:bg-slate-50"
                style={{ borderColor: brand.border, color: brand.muted }}
              >
                Cancel
              </button>
              <button
                onClick={() => void addParticipant()}
                disabled={saving}
                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: brand.primary }}
              >
                {saving ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
