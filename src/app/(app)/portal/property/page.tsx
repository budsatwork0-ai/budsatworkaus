'use client';

import { useState, useEffect, useCallback } from 'react';
import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

type PropertyInfo = {
  address: string;
  gate_code: string;
  pet_warnings: string;
  parking: string;
  special_instructions: string;
};

const EMPTY: PropertyInfo = {
  address: '', gate_code: '', pet_warnings: '', parking: '', special_instructions: '',
};

export default function PropertyPage() {
  const [info, setInfo] = useState<PropertyInfo>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const res = await fetch('/api/portal/property');
      if (!res.ok) throw new Error('Failed to load property details');
      const { property } = await res.json();
      if (property) setInfo({ ...EMPTY, ...property });
    } catch {
      // Track load failure so we can warn the user before they accidentally
      // overwrite their real data with blank fields.
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/property', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to save');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof PropertyInfo; label: string; placeholder: string; multiline?: boolean }[] = [
    { key: 'address', label: 'Property Address', placeholder: '123 Main Street, Logan QLD 4114' },
    { key: 'gate_code', label: 'Gate / Access Code', placeholder: 'e.g. #1234 or side gate unlocked' },
    { key: 'pet_warnings', label: 'Pets on Property', placeholder: 'e.g. Friendly dog in backyard, cat indoor' },
    { key: 'parking', label: 'Parking Instructions', placeholder: 'e.g. Park in driveway, street parking only' },
    { key: 'special_instructions', label: 'Special Instructions', placeholder: 'Any other notes for our crew...', multiline: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: brand.primary }}>Property Details</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>
          Help our crew prepare by sharing details about your property.
        </p>
      </div>

      {loadFailed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <svg className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Could not load your saved details</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your existing data could not be retrieved. Please{' '}
              <button onClick={load} className="underline font-medium">try reloading</button>{' '}
              before saving to avoid overwriting your property info with blank fields.
            </p>
          </div>
        </div>
      )}

      <div className={`${glass} p-5 sm:p-6`}>
        {loading ? (
          <div className="space-y-5">
            {fields.map((f) => (
              <div key={f.key}>
                <div className="h-4 w-32 rounded bg-slate-100 animate-pulse mb-1.5" />
                <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium mb-1.5" style={{ color: brand.text }}>
                  {field.label}
                </label>
                {field.multiline ? (
                  <textarea
                    value={info[field.key]}
                    onChange={(e) => setInfo({ ...info, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full rounded-xl border px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2"
                    style={{ borderColor: brand.border, color: brand.text }}
                  />
                ) : (
                  <input
                    type="text"
                    value={info[field.key]}
                    onChange={(e) => setInfo({ ...info, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2"
                    style={{ borderColor: brand.border, color: brand.text }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || loading || loadFailed}
            title={loadFailed ? 'Reload your saved details before saving' : undefined}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: brand.primary }}
          >
            {saving ? 'Saving…' : 'Save Details'}
          </button>
          {saved && (
            <span className="text-sm font-medium" style={{ color: '#059669' }}>Saved!</span>
          )}
          {error && (
            <span className="text-sm font-medium text-red-600">{error}</span>
          )}
        </div>
      </div>

      <div className={`${glass} p-5`}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: brand.text }}>Location</h2>
        {info.address ? (
          <iframe
            src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(info.address)}`}
            className="w-full rounded-xl border-0"
            style={{ height: '192px' }}
            loading="lazy"
            allowFullScreen
            title="Property location map"
          />
        ) : (
          <div
            className="w-full h-48 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(15,61,46,0.05)', border: '2px dashed rgba(15,61,46,0.15)' }}
          >
            <div className="text-center">
              <svg className="mx-auto mb-2" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={brand.muted} strokeWidth="1.5">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <p className="text-xs" style={{ color: brand.muted }}>Add your address above to see it on the map</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
