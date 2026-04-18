'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/hooks/useAuth';
import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

type Profile = {
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  abn: string;
  default_address: string;
  region: string;
};

const EMPTY: Profile = {
  full_name: '',
  email: '',
  phone: '',
  company_name: '',
  abn: '',
  default_address: '',
  region: '',
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const res = await fetch('/api/portal/profile');
      if (!res.ok) throw new Error('Failed to load profile');
      const { profile: data } = await res.json();
      if (data) {
        setProfile({
          full_name: data.full_name ?? '',
          email: data.email ?? user?.email ?? '',
          phone: data.phone ?? '',
          company_name: data.company_name ?? '',
          abn: data.abn ?? '',
          default_address: data.default_address ?? '',
          region: data.region ?? '',
        });
      } else {
        // No customer row yet — seed email from auth session
        setProfile((p) => ({ ...p, email: user?.email ?? '' }));
      }
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: profile.full_name.trim(),
          phone: profile.phone.trim(),
          company_name: profile.company_name.trim(),
          abn: profile.abn.trim(),
          default_address: profile.default_address.trim(),
          region: profile.region.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof Profile, value: string) =>
    setProfile((p) => ({ ...p, [field]: value }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: brand.text }}>My Profile</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>
          Keep your details up to date to speed up future bookings.
        </p>
      </div>

      {loadFailed && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load your profile. Your changes may overwrite existing data — refresh to try again.
        </div>
      )}

      {loading ? (
        <div className={`${glass} p-6 space-y-4`}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Contact details */}
          <div className={`${glass} p-6`}>
            <h2 className="text-sm font-semibold mb-4" style={{ color: brand.text }}>Contact details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>
                  Full name
                </label>
                <input
                  className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 focus:border-[color:var(--accent)]"
                  value={profile.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                  placeholder="Jane Smith"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>
                  Email <span className="font-normal text-slate-400">(read-only)</span>
                </label>
                <input
                  className="w-full rounded-xl border border-black/10 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                  value={profile.email}
                  readOnly
                  tabIndex={-1}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>
                  Phone
                </label>
                <input
                  className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 focus:border-[color:var(--accent)]"
                  value={profile.phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D+/g, '').replace(/^61/, '0');
                    set('phone', digits.replace(/(\d{4})(\d{3})(\d{0,3}).*/, '$1 $2 $3').trim());
                  }}
                  placeholder="04XX XXX XXX"
                  autoComplete="tel"
                  inputMode="tel"
                />
              </div>
            </div>
          </div>

          {/* Business details (optional) */}
          <div className={`${glass} p-6`}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: brand.text }}>Business details</h2>
            <p className="text-xs mb-4" style={{ color: brand.muted }}>Optional — only needed for commercial quotes.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>Company name</label>
                <input
                  className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 focus:border-[color:var(--accent)]"
                  value={profile.company_name}
                  onChange={(e) => set('company_name', e.target.value)}
                  placeholder="Acme Pty Ltd"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>ABN</label>
                <input
                  className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 focus:border-[color:var(--accent)]"
                  value={profile.abn}
                  onChange={(e) => set('abn', e.target.value.replace(/[^\d\s]/g, ''))}
                  placeholder="12 345 678 901"
                  inputMode="numeric"
                />
              </div>
            </div>
          </div>

          {/* Default address */}
          <div className={`${glass} p-6`}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: brand.text }}>Default service address</h2>
            <p className="text-xs mb-4" style={{ color: brand.muted }}>Pre-filled in the quote wizard when you book.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>Address</label>
                <input
                  className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 focus:border-[color:var(--accent)]"
                  value={profile.default_address}
                  onChange={(e) => set('default_address', e.target.value)}
                  placeholder="123 Example St, Logan QLD 4114"
                  autoComplete="street-address"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: brand.muted }}>Region / suburb</label>
                <input
                  className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/40 focus:border-[color:var(--accent)]"
                  value={profile.region}
                  onChange={(e) => set('region', e.target.value)}
                  placeholder="Logan Central"
                />
              </div>
            </div>
          </div>

          {/* Save */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="text-sm font-medium" style={{ color: '#059669' }}>Saved successfully</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving || loadFailed}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-60"
              style={{ background: brand.primary }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
