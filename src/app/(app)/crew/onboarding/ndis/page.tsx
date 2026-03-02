'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { brand, glass } from '@/app/ui/theme';

const DISABILITY_TYPES = [
  'Intellectual disability',
  'Autism spectrum',
  'Physical disability',
  'Psychosocial disability',
  'Sensory disability',
  'Neurological conditions',
  'Acquired brain injury',
  'Other',
];

const PLAN_MANAGEMENT_TYPES = [
  { value: 'self_managed', label: 'Self-managed' },
  { value: 'plan_managed', label: 'Plan-managed' },
  { value: 'ndia_managed', label: 'NDIA-managed' },
  { value: 'all', label: 'All of the above' },
];

const NDIS_MODULES = [
  'NDIS Worker Orientation Module',
  'Supporting Safe and Enjoyable Meals',
  'Supporting Effective Communication',
  'COVID-19 Infection Control Training',
  'Fire Safety and Emergency Procedures',
];

export default function NDISOnboardingPage() {
  const router = useRouter();
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  const loadSection = useCallback(async () => {
    try {
      const res = await fetch('/api/crew/onboarding/ndis');
      if (res.ok) {
        const data = await res.json();
        setResponses(data.onboarding?.responses || {});
      }
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSection();
  }, [loadSection]);

  function updateField(key: string, value: unknown) {
    setResponses((prev) => ({ ...prev, [key]: value }));
  }

  function toggleArrayItem(key: string, item: string) {
    setResponses((prev) => {
      const arr = (prev[key] as string[]) || [];
      return {
        ...prev,
        [key]: arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item],
      };
    });
  }

  async function handleSave(completed: boolean) {
    setSaving(true);
    try {
      // Also update employee ndis_worker flag
      await fetch('/api/crew/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ndis_worker: true }),
      });

      const res = await fetch('/api/crew/onboarding/ndis', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses, completed }),
      });
      if (res.ok) {
        router.push('/crew/onboarding');
      }
    } catch {
      // handle silently
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: brand.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const steps = [
    { title: 'Worker Screening', key: 'screening' },
    { title: 'Training & Modules', key: 'training' },
    { title: 'Experience & Knowledge', key: 'experience' },
    { title: 'Compliance', key: 'compliance' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/crew/onboarding" className="text-sm" style={{ color: brand.muted }}>
        &larr; Back to Onboarding
      </Link>

      <div>
        <h1 className="text-2xl font-bold" style={{ color: brand.text }}>NDIS Worker Questionnaire</h1>
        <p className="text-sm mt-1" style={{ color: brand.muted }}>
          As an NDIS support worker, we need additional information to ensure compliance.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <button
            key={s.key}
            onClick={() => setStep(i)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: step === i ? 'rgba(15,61,46,0.08)' : 'transparent',
              color: step === i ? brand.primary : brand.muted,
            }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
              style={{
                background: step === i ? brand.primary : brand.border,
                color: step === i ? 'white' : brand.muted,
              }}
            >
              {i + 1}
            </span>
            <span className="hidden sm:inline">{s.title}</span>
          </button>
        ))}
      </div>

      <div className={`${glass} rounded-2xl p-6 space-y-5`}>
        {/* Step 1: Worker Screening */}
        {step === 0 && (
          <>
            <h2 className="font-semibold" style={{ color: brand.text }}>NDIS Worker Screening</h2>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: brand.text }}>
                NDIS Worker Screening Check Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={(responses.screening_number as string) || ''}
                onChange={(e) => updateField('screening_number', e.target.value)}
                placeholder="e.g. WSC-123456"
                className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
                style={{ borderColor: brand.border, color: brand.text }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: brand.text }}>
                Screening Expiry Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={(responses.screening_expiry as string) || ''}
                onChange={(e) => updateField('screening_expiry', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
                style={{ borderColor: brand.border, color: brand.text }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: brand.text }}>
                Screening State / Territory
              </label>
              <select
                value={(responses.screening_state as string) || ''}
                onChange={(e) => updateField('screening_state', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
                style={{ borderColor: brand.border, color: brand.text }}
              >
                <option value="">Select state</option>
                <option value="NSW">NSW</option>
                <option value="VIC">VIC</option>
                <option value="QLD">QLD</option>
                <option value="SA">SA</option>
                <option value="WA">WA</option>
                <option value="TAS">TAS</option>
                <option value="NT">NT</option>
                <option value="ACT">ACT</option>
              </select>
            </div>
          </>
        )}

        {/* Step 2: Training & Modules */}
        {step === 1 && (
          <>
            <h2 className="font-semibold" style={{ color: brand.text }}>Training & Modules</h2>
            <p className="text-sm" style={{ color: brand.muted }}>
              Select the NDIS training modules you have completed.
            </p>
            <div className="space-y-2">
              {NDIS_MODULES.map((mod) => {
                const completed = ((responses.completed_modules as string[]) || []).includes(mod);
                return (
                  <label key={mod} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-slate-50" style={{ borderColor: brand.border }}>
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={() => toggleArrayItem('completed_modules', mod)}
                      className="w-5 h-5 rounded accent-emerald-600"
                    />
                    <span className="text-sm" style={{ color: brand.text }}>{mod}</span>
                  </label>
                );
              })}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: brand.text }}>
                Additional certifications or training
              </label>
              <textarea
                value={(responses.additional_training as string) || ''}
                onChange={(e) => updateField('additional_training', e.target.value)}
                rows={3}
                placeholder="List any other relevant certifications..."
                className="w-full px-3 py-2 rounded-lg border bg-white text-sm resize-none"
                style={{ borderColor: brand.border, color: brand.text }}
              />
            </div>
          </>
        )}

        {/* Step 3: Experience & Knowledge */}
        {step === 2 && (
          <>
            <h2 className="font-semibold" style={{ color: brand.text }}>Experience & Knowledge</h2>
            <p className="text-sm" style={{ color: brand.muted }}>
              Select the disability types you have experience supporting.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DISABILITY_TYPES.map((dt) => {
                const selected = ((responses.disability_experience as string[]) || []).includes(dt);
                return (
                  <button
                    key={dt}
                    onClick={() => toggleArrayItem('disability_experience', dt)}
                    className="px-4 py-3 rounded-lg text-sm border transition-colors text-left"
                    style={{
                      borderColor: selected ? brand.primary : brand.border,
                      background: selected ? 'rgba(15,61,46,0.08)' : 'transparent',
                      color: selected ? brand.primary : brand.text,
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    {dt}
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: brand.text }}>
                Plan management knowledge
              </label>
              <p className="text-xs mb-2" style={{ color: brand.muted }}>
                Which plan management types are you familiar with?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PLAN_MANAGEMENT_TYPES.map((pm) => {
                  const selected = ((responses.plan_management_knowledge as string[]) || []).includes(pm.value);
                  return (
                    <button
                      key={pm.value}
                      onClick={() => toggleArrayItem('plan_management_knowledge', pm.value)}
                      className="px-3 py-2 rounded-lg text-sm border transition-colors"
                      style={{
                        borderColor: selected ? brand.primary : brand.border,
                        background: selected ? 'rgba(15,61,46,0.08)' : 'transparent',
                        color: selected ? brand.primary : brand.text,
                        fontWeight: selected ? 600 : 400,
                      }}
                    >
                      {pm.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: brand.text }}>
                Years of NDIS experience
              </label>
              <input
                type="number"
                value={(responses.ndis_years_experience as string) || ''}
                onChange={(e) => updateField('ndis_years_experience', e.target.value)}
                min="0"
                className="w-full px-3 py-2 rounded-lg border bg-white text-sm"
                style={{ borderColor: brand.border, color: brand.text }}
              />
            </div>
          </>
        )}

        {/* Step 4: Compliance */}
        {step === 3 && (
          <>
            <h2 className="font-semibold" style={{ color: brand.text }}>Compliance Declarations</h2>
            <p className="text-sm" style={{ color: brand.muted }}>
              Please read and acknowledge the following compliance requirements.
            </p>

            <label className="flex items-start gap-3 p-4 rounded-lg border" style={{ borderColor: brand.border }}>
              <input
                type="checkbox"
                checked={Boolean(responses.code_of_conduct)}
                onChange={(e) => updateField('code_of_conduct', e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded accent-emerald-600"
              />
              <div>
                <p className="text-sm font-medium" style={{ color: brand.text }}>
                  NDIS Code of Conduct <span className="text-red-500">*</span>
                </p>
                <p className="text-xs mt-1" style={{ color: brand.muted }}>
                  I have read, understood, and agree to comply with the NDIS Code of Conduct, including acting with respect, honesty, and integrity when providing supports.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border" style={{ borderColor: brand.border }}>
              <input
                type="checkbox"
                checked={Boolean(responses.practice_standards)}
                onChange={(e) => updateField('practice_standards', e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded accent-emerald-600"
              />
              <div>
                <p className="text-sm font-medium" style={{ color: brand.text }}>
                  NDIS Practice Standards <span className="text-red-500">*</span>
                </p>
                <p className="text-xs mt-1" style={{ color: brand.muted }}>
                  I understand the NDIS Practice Standards and will deliver supports in line with these standards.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border" style={{ borderColor: brand.border }}>
              <input
                type="checkbox"
                checked={Boolean(responses.incident_reporting)}
                onChange={(e) => updateField('incident_reporting', e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded accent-emerald-600"
              />
              <div>
                <p className="text-sm font-medium" style={{ color: brand.text }}>
                  Incident Reporting <span className="text-red-500">*</span>
                </p>
                <p className="text-xs mt-1" style={{ color: brand.muted }}>
                  I understand my obligation to report incidents, including allegations of abuse, neglect, or exploitation, through the appropriate channels.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-lg border" style={{ borderColor: brand.border }}>
              <input
                type="checkbox"
                checked={Boolean(responses.privacy_confidentiality)}
                onChange={(e) => updateField('privacy_confidentiality', e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded accent-emerald-600"
              />
              <div>
                <p className="text-sm font-medium" style={{ color: brand.text }}>
                  Privacy & Confidentiality <span className="text-red-500">*</span>
                </p>
                <p className="text-xs mt-1" style={{ color: brand.muted }}>
                  I will maintain the privacy and confidentiality of participant information at all times.
                </p>
              </div>
            </label>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-4 py-2 rounded-lg text-sm border transition-colors hover:bg-slate-50 disabled:opacity-40"
          style={{ borderColor: brand.border, color: brand.muted }}
        >
          Previous
        </button>

        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            className="px-4 py-2 rounded-lg text-sm text-white transition-colors hover:opacity-90"
            style={{ background: brand.primary }}
          >
            Next
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm border transition-colors hover:bg-slate-50"
              style={{ borderColor: brand.border, color: brand.muted }}
            >
              Save Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving || !responses.code_of_conduct || !responses.practice_standards || !responses.incident_reporting || !responses.privacy_confidentiality}
              className="px-4 py-2 rounded-lg text-sm text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ background: brand.primary }}
            >
              {saving ? 'Saving...' : 'Complete NDIS Section'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
