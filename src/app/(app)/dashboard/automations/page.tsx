'use client';

import { useEffect, useState } from 'react';
import { brand } from '@/app/ui/theme';
import {
  DEFAULT_AUTOMATION_CONFIG,
  DEFAULT_AUTOMATION_SETTINGS,
  DEFAULT_DASHBOARD_GOALS,
  type AutomationConfig,
  type AutomationSettings,
  type DashboardGoalSettings,
} from '@/lib/automations';

const glass = 'bg-white/80 backdrop-blur-2xl border shadow-[0_10px_30px_rgba(2,6,23,0.08)]';

type AutomationCard = {
  key: keyof AutomationSettings;
  title: string;
  desc: string;
  caution?: string;
};

const AUTOMATION_CARDS: AutomationCard[] = [
  {
    key: 'quote24hReminder',
    title: '24h Quote Reminder',
    desc: 'Follow up unpaid finalized quotes after 24 hours.',
  },
  {
    key: 'quote48hDiscount',
    title: '48h Discount Re-Engagement',
    desc: 'Apply the configured discount to stale unpaid quotes and email a fresh portal CTA.',
  },
  {
    key: 'dayBeforeReminder',
    title: 'Day-Before Service Reminder',
    desc: 'Email customers with tomorrow bookings so crew arrival details go out automatically.',
  },
  {
    key: 'weeklyKpiEmail',
    title: 'Weekly KPI Email',
    desc: 'Send the rolling 7-day quote, conversion, revenue, and jobs summary to admin inboxes.',
  },
  {
    key: 'autoCompleteJobs',
    title: 'Auto-Complete Old Jobs',
    desc: 'Close jobs that are at least 24 hours past their scheduled date when staffing looks uncontested.',
    caution: 'Recommended to leave off until you trust the crew assignment hygiene.',
  },
];

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'idle') return null;

  const copy =
    state === 'saving' ? 'Saving…' :
    state === 'saved' ? 'Saved' :
    'Failed';

  const style =
    state === 'saved'
      ? { background: '#ECFDF5', color: '#065F46' }
      : state === 'error'
        ? { background: '#FEF2F2', color: '#991B1B' }
        : { background: '#F1F5F9', color: brand.muted };

  return (
    <span className="text-xs px-2.5 py-1 rounded-full" style={style}>
      {copy}
    </span>
  );
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<AutomationSettings>(DEFAULT_AUTOMATION_SETTINGS);
  const [goals, setGoals] = useState<DashboardGoalSettings>(DEFAULT_DASHBOARD_GOALS);
  const [config, setConfig] = useState<AutomationConfig>(DEFAULT_AUTOMATION_CONFIG);
  const [loading, setLoading] = useState(true);
  const [toggleState, setToggleState] = useState<SaveState>('idle');
  const [goalsState, setGoalsState] = useState<SaveState>('idle');
  const [configState, setConfigState] = useState<SaveState>('idle');

  useEffect(() => {
    fetch('/api/site-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.settings) return;

        if (data.settings.automations && typeof data.settings.automations === 'object') {
          setAutomations((prev) => ({ ...prev, ...data.settings.automations }));
        }
        if (data.settings.goals && typeof data.settings.goals === 'object') {
          setGoals((prev) => ({ ...prev, ...data.settings.goals }));
        }
        if (data.settings.automationConfig && typeof data.settings.automationConfig === 'object') {
          setConfig((prev) => ({ ...prev, ...data.settings.automationConfig }));
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function persistSettings(payload: Record<string, unknown>, setState: (state: SaveState) => void) {
    setState('saving');
    try {
      const res = await fetch('/api/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      });

      if (!res.ok) throw new Error();

      setState('saved');
      window.setTimeout(() => setState('idle'), 1600);
    } catch {
      setState('error');
      window.setTimeout(() => setState('idle'), 2200);
    }
  }

  function toggleAutomation(key: keyof AutomationSettings) {
    const nextAutomations = {
      ...automations,
      [key]: !automations[key],
    };

    setAutomations(nextAutomations);
    void persistSettings({ automations: nextAutomations }, setToggleState);
  }

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: brand.bg }}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className={`${glass} rounded-2xl p-4 animate-pulse`} style={{ borderColor: 'rgba(0,0,0,0.08)', background: brand.card }}>
              <div className="h-5 w-40 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-full rounded bg-slate-100" />
              <div className="mt-2 h-4 w-4/5 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6" style={{ background: brand.bg }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>Automations</h1>
          <p className="text-sm md:text-base mt-1" style={{ color: brand.muted }}>
            Turn automations on and off, set the re-engagement discount, and keep dashboard goals editable without code changes.
          </p>
        </div>
        <SaveBadge state={toggleState} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {AUTOMATION_CARDS.map((card) => (
          <div key={card.key} className={`${glass} rounded-2xl p-4`} style={{ borderColor: 'rgba(0,0,0,0.08)', background: brand.card }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold" style={{ color: brand.primary }}>{card.title}</div>
                <div className="text-sm mt-0.5" style={{ color: brand.muted }}>{card.desc}</div>
                {card.caution && (
                  <div className="mt-2 text-xs rounded-lg px-2.5 py-2" style={{ background: '#FFF7ED', color: '#9A3412' }}>
                    {card.caution}
                  </div>
                )}
              </div>
              <button
                onClick={() => toggleAutomation(card.key)}
                className="w-12 h-7 rounded-full border relative transition flex-shrink-0"
                style={{ borderColor: brand.border, background: automations[card.key] ? '#E6F6ED' : '#F3F4F6' }}
                aria-pressed={automations[card.key]}
                aria-label={automations[card.key] ? `Disable ${card.title}` : `Enable ${card.title}`}
              >
                <span
                  className={`absolute top-1 left-1 h-5 w-5 rounded-full border transition-transform ${automations[card.key] ? 'translate-x-5' : ''}`}
                  style={{ borderColor: brand.border, background: '#fff' }}
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${glass} rounded-2xl p-5`} style={{ borderColor: 'rgba(0,0,0,0.08)', background: brand.card }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: brand.primary }}>Re-Engagement Offer</h2>
              <p className="text-sm mt-1" style={{ color: brand.muted }}>
                This controls the 48-hour quote discount automation.
              </p>
            </div>
            <SaveBadge state={configState} />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">Discount Percent</label>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={90}
                value={config.quoteReengagementDiscountPercent}
                onChange={(e) => setConfig((prev) => ({
                  ...prev,
                  quoteReengagementDiscountPercent: Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 1)),
                }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">%</span>
            </div>
          </div>

          <button
            onClick={() => persistSettings({ automationConfig: config }, setConfigState)}
            className="mt-4 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg"
            style={{ background: brand.primary }}
          >
            Save Discount
          </button>
        </section>

        <section className={`${glass} rounded-2xl p-5`} style={{ borderColor: 'rgba(0,0,0,0.08)', background: brand.card }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: brand.primary }}>Dashboard Goals</h2>
              <p className="text-sm mt-1" style={{ color: brand.muted }}>
                These feed the overview progress cards and reporting targets.
              </p>
            </div>
            <SaveBadge state={goalsState} />
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Revenue Target</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  min={1}
                  value={goals.monthlyRevenueTarget}
                  onChange={(e) => setGoals((prev) => ({
                    ...prev,
                    monthlyRevenueTarget: parseInt(e.target.value, 10) || 0,
                  }))}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Jobs Target</label>
              <input
                type="number"
                min={1}
                value={goals.monthlyJobsTarget}
                onChange={(e) => setGoals((prev) => ({
                  ...prev,
                  monthlyJobsTarget: parseInt(e.target.value, 10) || 0,
                }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            onClick={() => persistSettings({ goals }, setGoalsState)}
            className="mt-4 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg"
            style={{ background: brand.primary }}
          >
            Save Goals
          </button>
        </section>
      </div>
    </div>
  );
}
