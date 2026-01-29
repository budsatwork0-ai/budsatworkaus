'use client';

import { useState } from 'react';
import { brand } from '@/app/ui/theme';

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

type Recipe = {
  key: string;
  title: string;
  desc: string;
  enabled: boolean;
  config?: Record<string, any>;
};

export default function AutomationsPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([
    { key: 'tag_by_suburb', title: 'Auto-tag by Suburb', desc: 'Tag onboardees with their service area based on postcode.', enabled: true, config: { map: { '4300-4301':'Ipswich','4114':'Logan' } } },
    { key: 'assign_by_service', title: 'Auto-assign by Service', desc: 'Assign owner based on first selected service.', enabled: false, config: { Windows:'Jackson', Lawns:'Dean', Cleaning:'Nate' } },
    { key: 'welcome_sms', title: 'Welcome SMS on Intake', desc: 'Send a friendly SMS when someone enters Intake.', enabled: true, config: { template: 'Hi {{name}}, thanks for joining Buds at Work! – Jackson' } },
    { key: 'docs_chase', title: 'Chase Missing Docs after 48h', desc: 'Auto-reminder if paperwork is incomplete.', enabled: true, config: { afterHours: 48 } },
    { key: 'sla_escalate', title: 'Escalate if Verify > 72h', desc: 'Ping team if Verify stage exceeds SLA.', enabled: false, config: { hours: 72, ping: 'Team Lead' } },
  ]);

  function toggle(key: string) {
    setRecipes(prev => prev.map(r => r.key === key ? ({ ...r, enabled: !r.enabled }) : r));
  }

  return (
    <div className="min-h-screen" style={{ background: brand.bg }}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>Automation Recipes</h1>
        <p className="text-sm md:text-base mt-1" style={{ color: brand.muted }}>
          Design-only toggles. Later, wire to webhooks/cron/workers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {recipes.map(r => (
          <div key={r.key} className={`${glass} rounded-2xl p-4`} style={{ borderColor: 'rgba(0,0,0,0.08)', background: brand.card }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold" style={{ color: brand.primary }}>{r.title}</div>
                <div className="text-sm mt-0.5" style={{ color: brand.muted }}>{r.desc}</div>
              </div>
              <button
                onClick={() => toggle(r.key)}
                className={`w-12 h-7 rounded-full border relative transition`}
                style={{
                  borderColor: brand.border,
                  background: r.enabled ? '#E6F6ED' : '#F3F4F6'
                }}
                aria-pressed={r.enabled}
              >
                <span
                  className={`absolute top-1 left-1 h-5 w-5 rounded-full border transition ${r.enabled ? 'translate-x-5' : ''}`}
                  style={{ borderColor: brand.border, background: '#fff' }}
                />
              </button>
            </div>

            {r.config && (
              <div className="mt-3 text-xs rounded-lg border p-3"
                   style={{ borderColor: brand.border, background: '#fff' }}>
                <div className="font-medium mb-1" style={{ color: brand.muted }}>Config (mock)</div>
                <pre className="whitespace-pre-wrap leading-5">{JSON.stringify(r.config, null, 2)}</pre>
                <button className="mt-2 text-xs underline" style={{ color: brand.primary }}
                        onClick={() => alert('Open config drawer (stub)')}>
                  Edit config
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}