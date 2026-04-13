'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { brand, glass } from '@/app/ui/theme';
import { useEmployee } from '@/app/hooks/useEmployee';
import { SERVICE_TYPE_LABELS } from '@/types/orders';
import type { ServiceType } from '@/types/orders';

const AVAILABILITY_LABELS: Record<string, string> = {
  mon_am: 'Mon AM', mon_pm: 'Mon PM', tue_am: 'Tue AM', tue_pm: 'Tue PM',
  wed_am: 'Wed AM', wed_pm: 'Wed PM', thu_am: 'Thu AM', thu_pm: 'Thu PM',
  fri_am: 'Fri AM', fri_pm: 'Fri PM', sat_am: 'Sat AM', sat_pm: 'Sat PM',
  sun_am: 'Sun AM', sun_pm: 'Sun PM',
};

export default function ProfilePage() {
  const { employee, isLoading, refetch } = useEmployee();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  async function handlePhotoUpload(file: File) {
    setPhotoError('');
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Photo must be under 5MB.');
      return;
    }
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: fd });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      setForm((f) => ({ ...f, photo_url: json.url! }));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setPhotoUploading(false);
    }
  }

  // Sync form state whenever fresh employee data arrives (initial load or after refetch).
  // We only update when NOT in edit mode to avoid clobbering in-progress edits.
  useEffect(() => {
    if (employee && !editing) {
      setForm(buildFormFromEmployee(employee));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee]);

  // Build a clean form snapshot from the current employee data.
  function buildFormFromEmployee(emp: typeof employee) {
    if (!emp) return {};
    return {
      full_name: emp.full_name,
      email: emp.email,
      phone: emp.phone || '',
      suburb: emp.suburb || '',
      photo_url: emp.photo_url || '',
      bio: emp.bio || '',
      emergency_contact_name: emp.emergency_contact_name || '',
      emergency_contact_phone: emp.emergency_contact_phone || '',
    };
  }

  function handleCancel() {
    // Reset form back to the last successfully loaded employee data so that
    // re-opening edit mode doesn't show previously unsaved changes.
    setForm(buildFormFromEmployee(employee));
    setSaveError('');
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/crew/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setEditing(false);
        refetch();
      } else {
        const body = await res.json().catch(() => ({}));
        setSaveError(body?.error || 'Could not save changes. Please try again.');
      }
    } catch {
      setSaveError('Could not save changes. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-20">
        <p style={{ color: brand.text }}>No profile found.</p>
        <Link href="/crew/onboarding" className="text-sm underline mt-2 inline-block" style={{ color: brand.primary }}>
          Start Onboarding
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: brand.text }}>Profile</h1>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 rounded-lg text-sm border transition-colors hover:bg-slate-50"
            style={{ borderColor: brand.border, color: brand.primary }}
          >
            Edit Profile
          </button>
        )}
      </div>

      {/* Personal Info */}
      <div className={`${glass} rounded-2xl p-6`}>
        <h2 className="font-semibold mb-4" style={{ color: brand.text }}>Personal Information</h2>

        {editing ? (
          <div className="space-y-4">
            <EditField label="Full Name" value={form.full_name as string} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
            <EditField label="Email" value={form.email as string} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
            <EditField label="Phone" value={form.phone as string} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
            <EditField label="Suburb" value={form.suburb as string} onChange={(v) => setForm((f) => ({ ...f, suburb: v }))} />
            {/* Profile photo upload */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: brand.text }}>Profile Photo</label>
              <div className="flex items-center gap-4">
                {form.photo_url ? (
                  <img src={form.photo_url as string} alt="Profile" className="w-14 h-14 rounded-full object-cover border-2 shrink-0" style={{ borderColor: brand.border }} />
                ) : (
                  <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0" style={{ background: `${brand.primary}12` }}>
                    <svg className="w-6 h-6" style={{ color: brand.muted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                )}
                <div>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-all hover:bg-slate-50" style={{ borderColor: brand.border, color: photoUploading ? brand.muted : brand.primary }}>
                    {photoUploading ? 'Uploading…' : (form.photo_url ? 'Change photo' : 'Upload photo')}
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])} disabled={photoUploading} />
                  </label>
                  {photoError && <p className="text-xs mt-1 text-red-600">{photoError}</p>}
                </div>
              </div>
            </div>
            <EditField label="Bio" value={form.bio as string} onChange={(v) => setForm((f) => ({ ...f, bio: v }))} multiline />

            <div className="pt-2">
              <h3 className="text-sm font-medium mb-2" style={{ color: brand.text }}>Emergency Contact</h3>
              <div className="space-y-3">
                <EditField label="Name" value={form.emergency_contact_name as string} onChange={(v) => setForm((f) => ({ ...f, emergency_contact_name: v }))} />
                <EditField label="Phone" value={form.emergency_contact_phone as string} onChange={(v) => setForm((f) => ({ ...f, emergency_contact_phone: v }))} />
              </div>
            </div>

            {saveError && (
              <p className="text-xs text-red-600 pt-1">{saveError}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg text-sm border transition-colors hover:bg-slate-50"
                style={{ borderColor: brand.border, color: brand.muted }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm text-white transition-colors hover:opacity-90 disabled:opacity-60"
                style={{ background: brand.primary }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Avatar */}
            <div className="flex items-center gap-4 pb-2">
              {employee.photo_url ? (
                <img src={employee.photo_url} alt={employee.full_name} className="w-16 h-16 rounded-full object-cover border-2 shrink-0" style={{ borderColor: brand.border }} />
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-xl font-bold" style={{ background: `${brand.primary}15`, color: brand.primary }}>
                  {employee.full_name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-sm" style={{ color: brand.text }}>{employee.full_name}</p>
                <p className="text-xs" style={{ color: brand.muted }}>{employee.email}</p>
              </div>
            </div>
            <InfoRow label="Name" value={employee.full_name} />
            <InfoRow label="Email" value={employee.email} />
            <InfoRow label="Phone" value={employee.phone || 'Not set'} />
            <InfoRow label="Suburb" value={employee.suburb || 'Not set'} />
            {employee.bio && <InfoRow label="Bio" value={employee.bio} />}
            {employee.emergency_contact_name && (
              <InfoRow label="Emergency Contact" value={`${employee.emergency_contact_name} - ${employee.emergency_contact_phone || ''}`} />
            )}
          </div>
        )}
      </div>

      {/* Status badges */}
      <div className={`${glass} rounded-2xl p-6`}>
        <h2 className="font-semibold mb-4" style={{ color: brand.text }}>Status</h2>
        <div className="flex flex-wrap gap-2">
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{
              background: employee.onboarding_complete ? 'rgba(16,185,129,0.1)' : 'rgba(251,191,36,0.15)',
              color: employee.onboarding_complete ? '#059669' : '#92400E',
            }}
          >
            Onboarding: {employee.onboarding_complete ? 'Complete' : 'Incomplete'}
          </span>
          {employee.ndis_worker && (
            <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: 'rgba(59,130,246,0.1)', color: '#2563EB' }}>
              NDIS Worker
            </span>
          )}
          <span
            className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(15,61,46,0.08)', color: brand.primary }}
          >
            Status: {employee.status}
          </span>
        </div>
      </div>

      {/* Services & Availability */}
      <div className={`${glass} rounded-2xl p-6`}>
        <h2 className="font-semibold mb-4" style={{ color: brand.text }}>Services & Availability</h2>

        {employee.services && employee.services.length > 0 ? (
          <div className="mb-4">
            <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: brand.muted }}>Services</p>
            <div className="flex flex-wrap gap-2">
              {employee.services.map((s) => (
                <span
                  key={s}
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{ background: 'rgba(15,61,46,0.08)', color: brand.primary }}
                >
                  {SERVICE_TYPE_LABELS[s as ServiceType] || s}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm mb-4" style={{ color: brand.muted }}>
            No services selected. <Link href="/crew/onboarding/services" className="underline" style={{ color: brand.primary }}>Set up in onboarding</Link>
          </p>
        )}

        {employee.availability && employee.availability.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: brand.muted }}>Availability</p>
            <div className="flex flex-wrap gap-2">
              {employee.availability.map((a) => (
                <span
                  key={a}
                  className="px-2 py-1 rounded text-xs"
                  style={{ background: 'rgba(15,61,46,0.05)', color: brand.text }}
                >
                  {AVAILABILITY_LABELS[a] || a}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: brand.muted }}>
            No availability set. <Link href="/crew/onboarding/availability" className="underline" style={{ color: brand.primary }}>Set up in onboarding</Link>
          </p>
        )}
      </div>

      {/* Documents overview */}
      <div className={`${glass} rounded-2xl p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ color: brand.text }}>Documents</h2>
          <Link
            href="/crew/onboarding/documents"
            className="text-sm"
            style={{ color: brand.primary }}
          >
            Manage Documents
          </Link>
        </div>
        <p className="text-sm" style={{ color: brand.muted }}>
          View and manage your uploaded documents in the onboarding section.
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4">
      <p className="text-xs font-medium uppercase tracking-wider w-28 shrink-0 pt-0.5" style={{ color: brand.muted }}>{label}</p>
      <p className="text-sm" style={{ color: brand.text }}>{value}</p>
    </div>
  );
}

function EditField({
  label, value, onChange, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: brand.text }}>{label}</label>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border bg-white text-sm resize-none"
          style={{ borderColor: brand.border, color: brand.text }}
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
          style={{ borderColor: brand.border, color: brand.text }}
        />
      )}
    </div>
  );
}
