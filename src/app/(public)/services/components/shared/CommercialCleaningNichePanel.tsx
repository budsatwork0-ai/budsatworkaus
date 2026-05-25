'use client';

import { AnimatePresence } from 'framer-motion';
import type { CommercialCleaningType, CommFrequency, WizardState } from '../../types';
import { COMM_FEATURES, COMM_PRESETS, COMM_STANDARDS } from '../../lib/service-data';
import { cls } from '../../utils/formatting';
import { M } from '../../utils/motion';
import { CommSqmSlider } from './UIComponents';

interface CommercialCleaningNichePanelProps {
  S: WizardState;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  isConfigOpen: boolean;
  nicheKey: CommercialCleaningType;
}

export function CommercialCleaningNichePanel({ S, set, isConfigOpen, nicheKey }: CommercialCleaningNichePanelProps) {
  return (
    <AnimatePresence>
      {isConfigOpen && (
        <M.div
          key="commercial-config"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          <div
            data-card-interactive="true"
            className="mt-3 space-y-3 border-t border-slate-200/80 pt-3"
          >
            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <span className="font-semibold text-slate-800 tracking-tight uppercase">Configure your clean</span>
            </div>
            {/* Preset selector: Essential / Standard / Intensive */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-700">Service level</div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {[
                  { key: 'essential', label: 'Essential', desc: 'Basic maintenance clean' },
                  { key: 'standard', label: 'Standard', desc: 'Comprehensive clean' },
                  { key: 'intensive', label: 'Intensive', desc: 'Deep reset clean' },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={cls(
                      'px-3 py-1.5 rounded-full border text-sm',
                      S.commPreset === p.key
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white border-black/10 text-slate-700 hover:border-emerald-400'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      set('commPreset', p.key as 'essential' | 'standard' | 'intensive');
                      const presetParams = COMM_PRESETS[nicheKey]?.find((pr) => pr.key === p.key)?.params;
                      if (presetParams?.sqm) {
                        set('paramsByService', {
                          ...S.paramsByService,
                          cleaning: {
                            ...(S.paramsByService.cleaning || {}),
                            sqm: presetParams.sqm,
                          },
                        });
                      }
                    }}
                    title={p.desc}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Frequency selector */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-700">Frequency</div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {[
                  { key: 'none', label: 'One-off' },
                  { key: 'weekly', label: 'Weekly' },
                  { key: 'fortnightly', label: 'Fortnightly' },
                  { key: 'monthly', label: 'Monthly' },
                ].map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={cls(
                      'px-3 py-1 rounded-full border text-sm',
                      S.commFrequency === f.key
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white border-black/10 text-slate-700 hover:border-emerald-400'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      set('commFrequency', f.key as CommFrequency);
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Square metres slider */}
            <CommSqmSlider
              value={S.paramsByService.cleaning?.sqm ?? COMM_PRESETS[nicheKey]?.[0]?.params?.sqm ?? 300}
              onChange={(sqm) => set('paramsByService', {
                ...S.paramsByService,
                cleaning: { ...(S.paramsByService.cleaning || {}), sqm },
              })}
            />
            {/* Features covered */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-700">Included</div>
              <div className="flex flex-wrap gap-1.5">
                {(COMM_FEATURES[nicheKey] || []).map((feature) => (
                  <span
                    key={feature}
                    className="px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-800"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
            {/* Standards */}
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-700">Standards</div>
              <div className="flex flex-wrap gap-1.5">
                {(COMM_STANDARDS[nicheKey] || []).map((std) => (
                  <span
                    key={std}
                    className="px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-[11px] text-slate-600"
                  >
                    {std}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </M.div>
      )}
    </AnimatePresence>
  );
}
