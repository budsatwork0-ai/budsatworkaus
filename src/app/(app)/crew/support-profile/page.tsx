'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { crewTheme } from '@/lib/design-system/themes';
import { useEmployee } from '@/app/hooks/useEmployee';
import {
  SUPPORT_MODE_LABELS,
  TRANSPORT_STATUS_LABELS,
  PHYSICAL_CAPACITY_LABELS,
  type ParticipantSupportProfile,
  type SupportMode,
  type TransportStatus,
  type PhysicalCapacity,
} from '@/types/ndis';
import { SERVICE_TYPE_LABELS } from '@/types/orders';
import type { ServiceType } from '@/types/orders';

const EMPTY_PROFILE: Omit<ParticipantSupportProfile, 'id' | 'employee_id' | 'created_at' | 'updated_at'> = {
  support_window_start: null,
  support_window_end: null,
  max_shift_duration_minutes: 240,
  support_mode: 'independent',
  transport_status: 'independent',
  travel_radius_km: 10,
  preferred_services: [],
  physical_capacity: 'medium',
  customer_facing_ok: true,
  can_work_after_support_hours: false,
  supervision_notes: null,
  risk_notes: null,
  emergency_contact: null,
  support_worker_name: null,
  support_worker_provider: null,
};

const SERVICE_OPTIONS = Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export default function SupportProfilePage() {
  const { employee, isLoading: empLoading } = useEmployee();
  const [profile, setProfile] = useState<typeof EMPTY_PROFILE>({ ...EMPTY_PROFILE });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/crew/support-profile');
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      if (data.profile) {
        setHasProfile(true);
        const { id: _id, employee_id: _eid, created_at: _ca, updated_at: _ua, ...rest } = data.profile;
        void _id; void _eid; void _ca; void _ua;
        setProfile({ ...EMPTY_PROFILE, ...rest });
      }
    } catch {
      // silently ignore — profile may not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (employee) loadProfile();
  }, [employee, loadProfile]);

  function toggleService(value: string) {
    setProfile((p) => ({
      ...p,
      preferred_services: p.preferred_services.includes(value)
        ? p.preferred_services.filter((s) => s !== value)
        : [...p.preferred_services, value],
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/crew/support-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error('Failed to save support profile');
      setHasProfile(true);
      toast.success('Support profile saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  if (empLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: crewTheme.color.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: crewTheme.color.text }}>Support Profile</h1>
        <p className="text-sm mt-1" style={{ color: crewTheme.color.muted }}>
          Help us match you with jobs that suit your support needs and availability.
          {!hasProfile && ' Your profile has not been set up yet.'}
        </p>
      </div>

      {/* Availability window */}
      <div className={`${crewTheme.glass} rounded-2xl p-5`}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: crewTheme.color.text }}>Availability & Hours</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: crewTheme.color.muted }}>Support funded from</label>
            <input
              type="time"
              value={profile.support_window_start ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, support_window_start: e.target.value || null }))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: crewTheme.color.muted }}>Support funded until</label>
            <input
              type="time"
              value={profile.support_window_end ?? ''}
              onChange={(e) => setProfile((p) => ({ ...p, support_window_end: e.target.value || null }))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: crewTheme.color.muted }}>Maximum shift length (minutes)</label>
            <input
              type="number"
              min={30}
              max={480}
              step={15}
              value={profile.max_shift_duration_minutes}
              onChange={(e) => setProfile((p) => ({ ...p, max_shift_duration_minutes: Number(e.target.value) || 240 }))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: crewTheme.color.muted }}>Travel radius (km)</label>
            <input
              type="number"
              min={1}
              max={50}
              value={profile.travel_radius_km}
              onChange={(e) => setProfile((p) => ({ ...p, travel_radius_km: Number(e.target.value) || 10 }))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text }}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 mt-4 cursor-pointer" style={{ color: crewTheme.color.text }}>
          <input
            type="checkbox"
            checked={profile.can_work_after_support_hours}
            onChange={(e) => setProfile((p) => ({ ...p, can_work_after_support_hours: e.target.checked }))}
            className="rounded"
          />
          <span className="text-sm">I can work outside my funded support hours if needed</span>
        </label>
      </div>

      {/* Support & transport */}
      <div className={`${crewTheme.glass} rounded-2xl p-5`}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: crewTheme.color.text }}>Support & Transport</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: crewTheme.color.muted }}>How do you work?</label>
            <select
              value={profile.support_mode}
              onChange={(e) => setProfile((p) => ({ ...p, support_mode: e.target.value as SupportMode }))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text }}
            >
              {Object.entries(SUPPORT_MODE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: crewTheme.color.muted }}>Transport</label>
            <select
              value={profile.transport_status}
              onChange={(e) => setProfile((p) => ({ ...p, transport_status: e.target.value as TransportStatus }))}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text }}
            >
              {Object.entries(TRANSPORT_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Support worker details */}
          {profile.support_mode === 'supported' && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: crewTheme.color.muted }}>Support worker name</label>
                <input
                  type="text"
                  value={profile.support_worker_name ?? ''}
                  onChange={(e) => setProfile((p) => ({ ...p, support_worker_name: e.target.value || null }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text }}
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: crewTheme.color.muted }}>Support worker provider</label>
                <input
                  type="text"
                  value={profile.support_worker_provider ?? ''}
                  onChange={(e) => setProfile((p) => ({ ...p, support_worker_provider: e.target.value || null }))}
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text }}
                  placeholder="Organisation name"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Job preferences */}
      <div className={`${crewTheme.glass} rounded-2xl p-5`}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: crewTheme.color.text }}>Job Preferences</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: crewTheme.color.muted }}>Physical capacity</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(PHYSICAL_CAPACITY_LABELS) as [PhysicalCapacity, string][]).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setProfile((p) => ({ ...p, physical_capacity: v }))}
                  className="px-3 py-2.5 rounded-xl border text-xs text-left transition-colors"
                  style={{
                    borderColor: profile.physical_capacity === v ? crewTheme.color.primary : crewTheme.color.border,
                    background: profile.physical_capacity === v ? 'rgba(15,61,46,0.07)' : 'transparent',
                    color: profile.physical_capacity === v ? crewTheme.color.primary : crewTheme.color.text,
                    fontWeight: profile.physical_capacity === v ? 600 : 400,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: crewTheme.color.muted }}>
              Preferred service types <span className="font-normal">(select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleService(value)}
                  className="px-3 py-1.5 rounded-full border text-xs transition-colors"
                  style={{
                    borderColor: profile.preferred_services.includes(value) ? crewTheme.color.primary : crewTheme.color.border,
                    background: profile.preferred_services.includes(value) ? 'rgba(15,61,46,0.1)' : 'transparent',
                    color: profile.preferred_services.includes(value) ? crewTheme.color.primary : crewTheme.color.muted,
                    fontWeight: profile.preferred_services.includes(value) ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer" style={{ color: crewTheme.color.text }}>
            <input
              type="checkbox"
              checked={profile.customer_facing_ok}
              onChange={(e) => setProfile((p) => ({ ...p, customer_facing_ok: e.target.checked }))}
              className="rounded"
            />
            <span className="text-sm">I am comfortable working directly with customers</span>
          </label>
        </div>
      </div>

      {/* Emergency contact */}
      <div className={`${crewTheme.glass} rounded-2xl p-5`}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: crewTheme.color.text }}>Emergency Contact</h2>
        <input
          type="text"
          value={profile.emergency_contact ?? ''}
          onChange={(e) => setProfile((p) => ({ ...p, emergency_contact: e.target.value || null }))}
          className="w-full rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text }}
          placeholder="Name and phone number"
        />
      </div>

      {/* Save */}
      <div className="pb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          style={{ background: crewTheme.color.primary }}
        >
          {saving ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : null}
          {hasProfile ? 'Save changes' : 'Create support profile'}
        </button>
      </div>
    </div>
  );
}
