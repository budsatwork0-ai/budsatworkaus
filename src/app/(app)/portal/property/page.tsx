'use client';

import { useState, useEffect } from 'react';
import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border border-black/8 shadow-[0_10px_30px_rgba(2,6,23,0.08)] rounded-2xl';

type PropertyInfo = {
  address: string;
  gateCode: string;
  petWarnings: string;
  parking: string;
  specialInstructions: string;
};

const STORAGE_KEY = 'baw_property_info';

export default function PropertyPage() {
  const [info, setInfo] = useState<PropertyInfo>({
    address: '', gateCode: '', petWarnings: '', parking: '', specialInstructions: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setInfo(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const fields: { key: keyof PropertyInfo; label: string; placeholder: string; multiline?: boolean }[] = [
    { key: 'address', label: 'Property Address', placeholder: '123 Main Street, Logan QLD 4114' },
    { key: 'gateCode', label: 'Gate / Access Code', placeholder: 'e.g. #1234 or side gate unlocked' },
    { key: 'petWarnings', label: 'Pets on Property', placeholder: 'e.g. Friendly dog in backyard, cat indoor' },
    { key: 'parking', label: 'Parking Instructions', placeholder: 'e.g. Park in driveway, street parking only' },
    { key: 'specialInstructions', label: 'Special Instructions', placeholder: 'Any other notes for our crew...', multiline: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: brand.primary }}>Property Details</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>
          Help our crew prepare by sharing details about your property.
        </p>
      </div>

      <div className={`${glass} p-5 sm:p-6`}>
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

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: brand.primary }}
          >
            Save Details
          </button>
          {saved && (
            <span className="text-sm font-medium" style={{ color: '#059669' }}>
              Saved!
            </span>
          )}
        </div>
      </div>

      {/* Map placeholder */}
      <div className={`${glass} p-5`}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: brand.text }}>Location</h2>
        <div
          className="w-full h-48 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(15,61,46,0.05)', border: '2px dashed rgba(15,61,46,0.15)' }}
        >
          <div className="text-center">
            <svg className="mx-auto mb-2" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={brand.muted} strokeWidth="1.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <p className="text-xs" style={{ color: brand.muted }}>
              {info.address || 'Add your address above to see it on the map'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
