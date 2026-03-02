'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

type ApplicantRole = 'Casual crew' | 'Support worker' | 'Quality partner' | 'Innovation partner';

const ROLE_OPTIONS: ApplicantRole[] = ['Casual crew', 'Support worker', 'Quality partner', 'Innovation partner'];

export default function NewOnboardeePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [suburb, setSuburb] = useState('');
  const [role, setRole] = useState<ApplicantRole>('Casual crew');
  const [areas, setAreas] = useState<string[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [docs, setDocs] = useState({
    license: false,
    insurance: false,
    abn: false,
    blueCard: false,
    firstAid: false,
  });

  function toggle(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function createApplicant() {
    if (!name.trim() || !email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    setSubmitting(true);
    try {
      const missingDocs = Object.entries(docs)
        .filter(([, checked]) => !checked)
        .map(([k]) => k);

      const res = await fetch('/api/applicants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          full_name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          suburb: suburb.trim() || null,
          availability: days,
          services,
          notes: `Preferred areas: ${areas.join(', ') || 'n/a'}`,
          missing_docs: missingDocs,
          consent: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create applicant');

      toast.success('Onboardee added to intake pipeline');
      router.push('/dashboard/onboarding');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create onboardee');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: brand.bg }}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>New Onboardee</h1>
        <p className="text-sm md:text-base mt-1" style={{ color: brand.muted }}>
          Create a real intake record that flows into verification, paperwork, and activation.
        </p>
      </div>

      <div className={`${glass} rounded-2xl p-5 max-w-3xl`} style={{ background: brand.card, borderColor: 'rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-2 text-xs mb-4" style={{ color: brand.muted }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={`px-2 py-1 rounded border ${step === n ? 'bg-black/5' : ''}`} style={{ borderColor: brand.border }}>
              Step {n}
            </span>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="font-medium" style={{ color: brand.primary }}>Basics</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="px-3 py-2 rounded-lg border" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} style={{ borderColor: brand.border }} />
              <input className="px-3 py-2 rounded-lg border" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ borderColor: brand.border }} />
              <input className="px-3 py-2 rounded-lg border" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ borderColor: brand.border }} />
              <input className="px-3 py-2 rounded-lg border" placeholder="Suburb" value={suburb} onChange={(e) => setSuburb(e.target.value)} style={{ borderColor: brand.border }} />
              <div className="flex gap-2 md:col-span-2 flex-wrap">
                {ROLE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => setRole(option)}
                    className={`px-3 py-2 rounded-lg border ${role === option ? 'bg-black/5' : ''}`}
                    style={{ borderColor: brand.border, color: role === option ? brand.primary : brand.muted }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="font-medium" style={{ color: brand.primary }}>Availability & Areas</div>
            <div className="text-xs" style={{ color: brand.muted }}>Service areas</div>
            <div className="flex flex-wrap gap-2">
              {['Brisbane', 'Ipswich', 'Gold Coast', 'Sunshine Coast'].map((a) => (
                <button
                  key={a}
                  onClick={() => toggle(areas, a, setAreas)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${areas.includes(a) ? 'bg-black/5' : ''}`}
                  style={{ borderColor: brand.border, color: areas.includes(a) ? brand.primary : brand.muted }}
                >
                  {a}
                </button>
              ))}
            </div>

            <div className="text-xs mt-3" style={{ color: brand.muted }}>Days available</div>
            <div className="flex flex-wrap gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <button
                  key={d}
                  onClick={() => toggle(days, d, setDays)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${days.includes(d) ? 'bg-black/5' : ''}`}
                  style={{ borderColor: brand.border, color: days.includes(d) ? brand.primary : brand.muted }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="font-medium" style={{ color: brand.primary }}>Service Skills</div>
            <div className="flex flex-wrap gap-2">
              {['Windows', 'Lawns', 'Cleaning', 'Car Detailing', 'Dump Runs', 'Bin Cleans'].map((s) => (
                <button
                  key={s}
                  onClick={() => toggle(services, s, setServices)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${services.includes(s) ? 'bg-black/5' : ''}`}
                  style={{ borderColor: brand.border, color: services.includes(s) ? brand.primary : brand.muted }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="font-medium" style={{ color: brand.primary }}>Compliance Snapshot</div>
            {[
              ['license', 'Driver License'],
              ['insurance', 'Public Liability Insurance'],
              ['abn', 'ABN'],
              ['blueCard', 'Blue Card / WWCC'],
              ['firstAid', 'First Aid'],
            ].map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={(docs as Record<string, boolean>)[k]} onChange={(e) => setDocs((prev) => ({ ...prev, [k]: e.target.checked }))} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-2 text-sm">
            <div className="font-medium" style={{ color: brand.primary }}>Review</div>
            <div><strong>Name:</strong> {name || '—'}</div>
            <div><strong>Email:</strong> {email || '—'}</div>
            <div><strong>Phone:</strong> {phone || '—'}</div>
            <div><strong>Role:</strong> {role}</div>
            <div><strong>Suburb:</strong> {suburb || '—'}</div>
            <div><strong>Areas:</strong> {areas.join(', ') || '—'}</div>
            <div><strong>Days:</strong> {days.join(', ') || '—'}</div>
            <div><strong>Services:</strong> {services.join(', ') || '—'}</div>
            <div><strong>Pending docs:</strong> {Object.entries(docs).filter(([, v]) => !v).map(([k]) => k).join(', ') || 'none'}</div>
          </div>
        )}

        <div className="flex items-center justify-between mt-5">
          <button
            className="px-3 py-2 rounded-lg border"
            style={{ borderColor: brand.border, color: brand.muted }}
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={submitting}
          >
            Back
          </button>
          {step < 5 ? (
            <button
              className="px-3 py-2 rounded-lg border"
              style={{ borderColor: brand.border, color: brand.primary }}
              onClick={() => setStep(step + 1)}
              disabled={submitting}
            >
              Next
            </button>
          ) : (
            <button
              className="px-3 py-2 rounded-lg text-white disabled:opacity-60"
              style={{ background: brand.primary }}
              onClick={createApplicant}
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create applicant'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
