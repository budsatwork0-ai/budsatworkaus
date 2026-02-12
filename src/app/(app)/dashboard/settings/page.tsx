'use client';

import { useState, useEffect } from 'react';
import { brand } from '@/app/ui/theme';
import { toast } from 'sonner';

type SiteStats = {
  jobs_completed: string;
  avg_rating: string;
  repeat_customers: string;
};

const STAT_LABELS: Record<keyof SiteStats, string> = {
  jobs_completed: 'Jobs Completed',
  avg_rating: 'Average Rating',
  repeat_customers: 'Repeat Customers',
};

export default function SettingsPage() {
  const [stats, setStats] = useState<SiteStats>({
    jobs_completed: '',
    avg_rating: '',
    repeat_customers: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/site-settings');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setStats({
        jobs_completed: data.settings?.jobs_completed || '250+',
        avg_rating: data.settings?.avg_rating || '4.9/5',
        repeat_customers: data.settings?.repeat_customers || '70%+',
      });
    } catch (err) {
      console.error('Failed to load settings:', err);
      // Use defaults
      setStats({
        jobs_completed: '250+',
        avg_rating: '4.9/5',
        repeat_customers: '70%+',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: stats }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      toast.success('Site content updated');
    } catch (err) {
      console.error('Save error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to save: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: brand.primary }}>
          Settings
        </h1>
        <p className="text-sm text-slate-600">
          Manage users, notifications, and operational defaults.
        </p>
      </header>

      {/* Site Content Section */}
      <section className="rounded-2xl border border-black/5 bg-white/90 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-1" style={{ color: brand.text }}>
          Site Content
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Update the stats displayed on the About page.
        </p>

        {loading ? (
          <div className="text-sm text-slate-500">Loading...</div>
        ) : (
          <div className="space-y-4">
            {(Object.keys(STAT_LABELS) as Array<keyof SiteStats>).map((key) => (
              <div key={key} className="flex items-center gap-4">
                <label className="w-40 text-sm font-medium text-slate-700">
                  {STAT_LABELS[key]}
                </label>
                <input
                  type="text"
                  value={stats[key]}
                  onChange={(e) => setStats((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="flex-1 max-w-xs rounded-xl border border-black/10 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]/20"
                  placeholder={key === 'jobs_completed' ? '250+' : key === 'avg_rating' ? '4.9/5' : '70%+'}
                />
              </div>
            ))}

            <div className="pt-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
                style={{ background: brand.primary }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Placeholder for other settings */}
      <section className="rounded-2xl border border-black/5 bg-white/90 p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-1" style={{ color: brand.text }}>
          Other Settings
        </h2>
        <p className="text-sm text-slate-600">
          Add toggles for access control, alert channels, and billing preferences here.
        </p>
      </section>
    </div>
  );
}
