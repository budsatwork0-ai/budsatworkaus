'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

type Role = 'Crew' | 'Support Worker' | 'Contractor';

export default function NewOnboardeePage() {
  const r = useRouter();
  const [step, setStep] = useState(1);

  // design-only state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [suburb, setSuburb] = useState('');
  const [role, setRole] = useState<Role>('Crew');

  const [areas, setAreas] = useState<string[]>([]);
  const [days, setDays] = useState<string[]>([]);

  const [services, setServices] = useState<string[]>([]);
  const [docs, setDocs] = useState({ license:false, insurance:false, abn:false, blueCard:false, firstAid:false });

  function toggle(list: string[], v: string, set: (x:string[])=>void) {
    set(list.includes(v) ? list.filter(x=>x!==v) : [...list, v]);
  }

  return (
    <div className="min-h-screen" style={{ background: brand.bg }}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>New Onboardee</h1>
        <p className="text-sm md:text-base mt-1" style={{ color: brand.muted }}>
          5 quick steps. This is design-only; submission just redirects to the pipeline.
        </p>
      </div>

      <div className={`${glass} rounded-2xl p-5 max-w-3xl`} style={{ background: brand.card, borderColor: 'rgba(0,0,0,0.08)' }}>
        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs mb-4" style={{ color: brand.muted }}>
          {[1,2,3,4,5].map(n=>(
            <span key={n} className={`px-2 py-1 rounded border ${step===n?'bg-black/5':''}`}
                  style={{ borderColor: brand.border }}>
              Step {n}
            </span>
          ))}
        </div>

        {step===1 && (
          <div className="space-y-4">
            <div className="font-medium" style={{ color: brand.primary }}>Basics</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="px-3 py-2 rounded-lg border" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} style={{ borderColor: brand.border }} />
              <input className="px-3 py-2 rounded-lg border" placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)} style={{ borderColor: brand.border }} />
              <input className="px-3 py-2 rounded-lg border md:col-span-2" placeholder="Suburb" value={suburb} onChange={e=>setSuburb(e.target.value)} style={{ borderColor: brand.border }} />
              <div className="flex gap-2 md:col-span-2">
                {(['Crew','Support Worker','Contractor'] as Role[]).map(x=>(
                  <button key={x} onClick={()=>setRole(x)}
                          className={`px-3 py-2 rounded-lg border ${role===x?'bg-black/5':''}`}
                          style={{ borderColor: brand.border, color: role===x? brand.primary : brand.muted }}>
                    {x}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step===2 && (
          <div className="space-y-4">
            <div className="font-medium" style={{ color: brand.primary }}>Availability & Areas</div>
            <div className="text-xs" style={{ color: brand.muted }}>Service areas</div>
            <div className="flex flex-wrap gap-2">
              {['Brisbane','Ipswich','Gold Coast','Sunshine Coast'].map(a=>(
                <button key={a} onClick={()=>toggle(areas, a, setAreas)}
                        className={`px-3 py-1.5 rounded-lg border text-sm ${areas.includes(a)?'bg-black/5':''}`}
                        style={{ borderColor: brand.border, color: areas.includes(a)?brand.primary:brand.muted }}>
                  {a}
                </button>
              ))}
            </div>

            <div className="text-xs mt-3" style={{ color: brand.muted }}>Days available</div>
            <div className="flex flex-wrap gap-2">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>(
                <button key={d} onClick={()=>toggle(days, d, setDays)}
                        className={`px-3 py-1.5 rounded-lg border text-sm ${days.includes(d)?'bg-black/5':''}`}
                        style={{ borderColor: brand.border, color: days.includes(d)?brand.primary:brand.muted }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {step===3 && (
          <div className="space-y-4">
            <div className="font-medium" style={{ color: brand.primary }}>Services</div>
            <div className="flex flex-wrap gap-2">
              {['Windows','Lawns','Cleaning','Car Detailing','Dump Runs','Bin Cleans'].map(s=>(
                <button key={s} onClick={()=>toggle(services, s, setServices)}
                        className={`px-3 py-1.5 rounded-lg border text-sm ${services.includes(s)?'bg-black/5':''}`}
                        style={{ borderColor: brand.border, color: services.includes(s)?brand.primary:brand.muted }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {step===4 && (
          <div className="space-y-3">
            <div className="font-medium" style={{ color: brand.primary }}>Compliance</div>
            {[
              ['license','Driver License'],
              ['insurance','Public Liability Insurance'],
              ['abn','ABN'],
              ['blueCard','Blue Card / WWCC'],
              ['firstAid','First Aid'],
            ].map(([k,label])=>(
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={(docs as any)[k]} onChange={e=>setDocs(prev=>({ ...prev, [k]: e.target.checked }))} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        )}

        {step===5 && (
          <div className="space-y-2 text-sm">
            <div className="font-medium" style={{ color: brand.primary }}>Review</div>
            <div><strong>Name:</strong> {name || '—'}</div>
            <div><strong>Phone:</strong> {phone || '—'}</div>
            <div><strong>Role:</strong> {role}</div>
            <div><strong>Suburb:</strong> {suburb || '—'}</div>
            <div><strong>Areas:</strong> {areas.join(', ') || '—'}</div>
            <div><strong>Days:</strong> {days.join(', ') || '—'}</div>
            <div><strong>Services:</strong> {services.join(', ') || '—'}</div>
            <div><strong>Docs:</strong> {Object.entries(docs).filter(([,v])=>v).map(([k])=>k).join(', ') || '—'}</div>
          </div>
        )}

        <div className="flex items-center justify-between mt-5">
          <button className="px-3 py-2 rounded-lg border"
                  style={{ borderColor: brand.border, color: brand.muted }}
                  onClick={() => setStep(Math.max(1, step - 1))}>
            Back
          </button>
          {step < 5 ? (
            <button className="px-3 py-2 rounded-lg border"
                    style={{ borderColor: brand.border, color: brand.primary }}
                    onClick={() => setStep(step + 1)}>
              Next
            </button>
          ) : (
            <button className="px-3 py-2 rounded-lg border"
                    style={{ borderColor: brand.border, color: brand.primary }}
                    onClick={() => r.push('/dashboard/onboarding')}>
              Create (mock)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}