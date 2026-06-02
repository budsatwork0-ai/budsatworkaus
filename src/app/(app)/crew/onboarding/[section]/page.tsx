'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { crewTheme } from '@/lib/design-system/themes';
import { ONBOARDING_SECTION_LABELS } from '@/types/crew';
import { SERVICE_TYPE_LABELS } from '@/types/orders';
import type { OnboardingSection } from '@/types/crew';


const AVAILABILITY_OPTIONS = [
  'mon_am', 'mon_pm', 'tue_am', 'tue_pm', 'wed_am', 'wed_pm',
  'thu_am', 'thu_pm', 'fri_am', 'fri_pm', 'sat_am', 'sat_pm', 'sun_am', 'sun_pm',
];

const AVAILABILITY_LABELS: Record<string, string> = {
  mon_am: 'Mon AM', mon_pm: 'Mon PM', tue_am: 'Tue AM', tue_pm: 'Tue PM',
  wed_am: 'Wed AM', wed_pm: 'Wed PM', thu_am: 'Thu AM', thu_pm: 'Thu PM',
  fri_am: 'Fri AM', fri_pm: 'Fri PM', sat_am: 'Sat AM', sat_pm: 'Sat PM',
  sun_am: 'Sun AM', sun_pm: 'Sun PM',
};

// Canonical section order (excluding conditional NDIS)
const BASE_SECTION_ORDER = ['personal', 'emergency', 'availability', 'services', 'documents'];

const SECTION_WHY: Record<string, { blurb: string; note?: string }> = {
  personal: {
    blurb: 'We use this to set up your crew profile and contact you about job bookings.',
  },
  emergency: {
    blurb: 'Required in case of an incident on-site. This information stays confidential.',
    note: 'Never shared with clients.',
  },
  availability: {
    blurb: 'We match your availability with job bookings in your area so you get the right shifts.',
  },
  services: {
    blurb: 'Tell us what you can offer so we assign you jobs that match your skills.',
  },
  documents: {
    blurb: 'Compliance documents are required by law for most job types and protect you and clients.',
    note: 'Documents are reviewed by our team and never shared publicly.',
  },
  ndis: {
    blurb: 'NDIS workers need additional screening. This helps us match you with NDIS-eligible bookings.',
    note: 'Only visible to our compliance team.',
  },
};

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export default function OnboardingSectionPage() {
  const params = useParams<{ section: string }>();
  const section = params?.section as OnboardingSection;
  const router = useRouter();
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
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
      updateField('photo_url', json.url!);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPhotoError(`Upload failed: ${msg}`);
    } finally {
      setPhotoUploading(false);
    }
  }

  const sectionLabel = ONBOARDING_SECTION_LABELS[section] || section;

  // Step indicator
  const isNdis = section === 'ndis';
  const stepIndex = BASE_SECTION_ORDER.indexOf(section);
  const stepNum = stepIndex >= 0 ? stepIndex + 1 : null;
  const totalSteps = BASE_SECTION_ORDER.length;
  const stepProgressPct = stepNum ? Math.round(((stepNum - 1) / totalSteps) * 100) : null;

  const why = SECTION_WHY[section];

  const loadSection = useCallback(async () => {
    try {
      // Guard: check previous section is complete before allowing access
      const progressRes = await fetch('/api/crew/onboarding');
      if (progressRes.ok) {
        const progressData = await progressRes.json() as { sections: { section: string; completed: boolean }[] };
        const idx = BASE_SECTION_ORDER.indexOf(section);
        if (idx > 0) {
          const prev = progressData.sections.find((s) => s.section === BASE_SECTION_ORDER[idx - 1]);
          if (prev && !prev.completed) {
            router.replace('/crew/onboarding');
            return;
          }
        }
      }

      const res = await fetch(`/api/crew/onboarding/${section}`);
      if (res.ok) {
        const data = await res.json();
        setResponses(data.onboarding?.responses || {});
      }
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, [section, router]);

  useEffect(() => {
    loadSection();
  }, [loadSection]);

  async function handleSave(completed: boolean) {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/crew/onboarding/${section}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses, completed }),
      });
      if (res.ok) {
        router.push('/crew/onboarding');
      } else {
        const body = await res.json().catch(() => ({}));
        setSaveError((body as { error?: string }).error || 'Could not save. Please try again.');
      }
    } catch {
      setSaveError('Connection error. Please check your internet and try again.');
    } finally {
      setSaving(false);
    }
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: crewTheme.color.primary, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      {/* Top navigation & step indicator */}
      <div className="flex items-center justify-between">
        <Link
          href="/crew/onboarding"
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
          style={{ color: crewTheme.color.muted }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to overview
        </Link>
        {isNdis ? (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: `${crewTheme.color.primary}12`, color: crewTheme.color.primary }}>
            NDIS section
          </span>
        ) : stepNum ? (
          <span className="text-xs font-medium" style={{ color: crewTheme.color.muted }}>
            Step {stepNum} of {totalSteps}
          </span>
        ) : null}
      </div>

      {/* Step progress bar (base sections only) */}
      {stepNum && stepProgressPct !== null && (
        <div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(15,61,46,0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${stepProgressPct}%`, background: crewTheme.color.primary }}
            />
          </div>
        </div>
      )}

      {/* Section header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: crewTheme.color.text }}>{sectionLabel}</h1>
        {why && (
          <p className="text-sm mt-1 leading-relaxed" style={{ color: crewTheme.color.muted }}>{why.blurb}</p>
        )}
      </div>

      {/* Privacy / context note */}
      {why?.note && (
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs"
          style={{ background: `${crewTheme.color.primary}08`, color: crewTheme.color.primary }}
        >
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span className="font-medium">{why.note}</span>
        </div>
      )}

      {/* Form fields */}
      <div className={`${crewTheme.glass} rounded-2xl p-6 space-y-5`}>

        {section === 'personal' && (
          <>
            <Field label="Full Name" value={responses.full_name as string} onChange={(v) => updateField('full_name', v)} required />
            <Field label="Phone Number" value={responses.phone as string} onChange={(v) => updateField('phone', v)} placeholder="e.g. 0412 345 678" />
            <Field label="Suburb" value={responses.suburb as string} onChange={(v) => updateField('suburb', v)} placeholder="e.g. Fortitude Valley" />
            {/* Profile photo upload */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: crewTheme.color.text }}>
                Profile Photo <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="flex items-center gap-4">
                {responses.photo_url ? (
                  <img
                    src={responses.photo_url as string}
                    alt="Profile"
                    className="w-16 h-16 rounded-full object-cover border-2 shrink-0"
                    style={{ borderColor: crewTheme.color.border }}
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: `${crewTheme.color.primary}12` }}
                  >
                    <svg className="w-7 h-7" style={{ color: crewTheme.color.muted }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                )}
                <div>
                  <label
                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all hover:bg-slate-50"
                    style={{ borderColor: crewTheme.color.border, color: photoUploading ? crewTheme.color.muted : crewTheme.color.primary }}
                  >
                    {photoUploading ? (
                      <><Spinner className="h-3.5 w-3.5" /> Uploading…</>
                    ) : (
                      responses.photo_url ? 'Change photo' : 'Upload photo'
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                      disabled={photoUploading}
                    />
                  </label>
                  <p className="text-xs mt-1.5" style={{ color: crewTheme.color.muted }}>JPG, PNG or HEIC · Max 5MB</p>
                  {photoError && <p className="text-xs mt-1 text-red-600">{photoError}</p>}
                </div>
              </div>
            </div>
            <Field label="Date of Birth" value={responses.dob as string} onChange={(v) => updateField('dob', v)} type="date" />
          </>
        )}

        {section === 'emergency' && (
          <>
            <Field label="Emergency Contact Name" value={responses.emergency_contact_name as string} onChange={(v) => updateField('emergency_contact_name', v)} required placeholder="e.g. John Smith" />
            <Field label="Emergency Contact Phone" value={responses.emergency_contact_phone as string} onChange={(v) => updateField('emergency_contact_phone', v)} required placeholder="e.g. 0412 345 678" />
            <Field label="Relationship" value={responses.relationship as string} onChange={(v) => updateField('relationship', v)} placeholder="e.g. Spouse, Parent, Sibling" />
          </>
        )}

        {section === 'availability' && (
          <>
            <div>
              <p className="text-sm font-medium mb-3" style={{ color: crewTheme.color.text }}>
                Which times are you available to work?
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {AVAILABILITY_OPTIONS.map((opt) => {
                  const selected = ((responses.availability as string[]) || []).includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleArrayItem('availability', opt)}
                      className="px-3 py-2 rounded-xl text-sm border transition-all font-medium"
                      style={{
                        borderColor: selected ? crewTheme.color.primary : crewTheme.color.border,
                        background: selected ? `${crewTheme.color.primary}10` : 'transparent',
                        color: selected ? crewTheme.color.primary : crewTheme.color.muted,
                      }}
                    >
                      {AVAILABILITY_LABELS[opt]}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field
              label="Additional notes"
              value={responses.availability_notes as string}
              onChange={(v) => updateField('availability_notes', v)}
              multiline
              placeholder="e.g. Not available school holidays, prefer morning shifts"
            />
          </>
        )}

        {section === 'services' && (
          <>
            <div>
              <p className="text-sm font-medium mb-3" style={{ color: crewTheme.color.text }}>
                Which services can you perform?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => {
                  const selected = ((responses.services as string[]) || []).includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleArrayItem('services', key)}
                      className="px-4 py-3 rounded-xl text-sm border transition-all text-left font-medium"
                      style={{
                        borderColor: selected ? crewTheme.color.primary : crewTheme.color.border,
                        background: selected ? `${crewTheme.color.primary}10` : 'transparent',
                        color: selected ? crewTheme.color.primary : crewTheme.color.text,
                      }}
                    >
                      {label as string}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(responses.ndis_worker)}
                  onChange={(e) => updateField('ndis_worker', e.target.checked)}
                  className="w-5 h-5 rounded mt-0.5 accent-emerald-600 shrink-0"
                />
                <div>
                  <span className="text-sm font-medium" style={{ color: crewTheme.color.text }}>
                    I am an NDIS support worker
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: crewTheme.color.muted }}>
                    Adds an NDIS screening questionnaire to your onboarding.
                  </p>
                </div>
              </label>
            </div>

            <Field
              label="Years of experience"
              value={responses.years_experience as string}
              onChange={(v) => updateField('years_experience', v)}
              type="number"
              placeholder="e.g. 3"
            />
            <Field
              label="ABN (if you have one)"
              value={responses.abn as string}
              onChange={(v) => updateField('abn', v)}
              placeholder="e.g. 12 345 678 901 — leave blank if none"
            />
          </>
        )}
      </div>

      {/* Save error */}
      {saveError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <svg className="h-4 w-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{saveError}</span>
        </div>
      )}

      {/* Save buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="px-4 py-2.5 rounded-xl text-sm font-medium border transition-all hover:bg-slate-50 disabled:opacity-50"
          style={{ borderColor: crewTheme.color.border, color: crewTheme.color.muted }}
        >
          Save draft
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving}
          className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background: crewTheme.color.primary }}
        >
          {saving && <Spinner />}
          {saving ? 'Saving…' : 'Save & mark complete'}
        </button>
      </div>

      {/* Reassurance */}
      <p className="text-xs text-center" style={{ color: crewTheme.color.muted }}>
        You can return and update this section at any time before approval.
      </p>
    </div>
  );
}

function Field({
  label, value, onChange, required, type = 'text', multiline, placeholder, hint,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: crewTheme.color.text }}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-sm resize-none transition-all focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          style={{ color: crewTheme.color.text }}
        />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white/60 text-sm transition-all focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          style={{ color: crewTheme.color.text }}
        />
      )}
      {hint && (
        <p className="text-xs mt-1.5" style={{ color: crewTheme.color.muted }}>{hint}</p>
      )}
    </div>
  );
}
