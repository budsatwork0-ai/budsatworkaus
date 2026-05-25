'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { cleaningAddonsForScope } from '../../lib/estimation';
import { scopePresetFor } from '../../lib/service-helpers';
import type { WizardState } from '../../types';
import { cls } from '../../utils/formatting';
import { M } from '../../utils/motion';
import { NumberStepper } from './UIComponents';

interface CleaningWizardPanelProps {
  S: WizardState;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  isConfigOpen: boolean;
  isActive: boolean;
  scopeKey: string;
}

export function CleaningWizardPanel({ S, set, isConfigOpen, isActive, scopeKey }: CleaningWizardPanelProps) {
  const cleaningSizePresets = {
    studio: { bedrooms: 1, bathrooms: 1, kitchens: 1, living: 0, laundry: 0, storeys: 1 },
    small: { bedrooms: 2, bathrooms: 1, kitchens: 1, living: 1, laundry: 0, storeys: 1 },
    medium: { bedrooms: 4, bathrooms: 2, kitchens: 1, living: 2, laundry: 1, storeys: 1 },
    large: { bedrooms: 5, bathrooms: 3, kitchens: 1, living: 2, laundry: 1, storeys: 2 },
  } as const;
  type CleaningSizeKey = keyof typeof cleaningSizePresets;
  const cleaningParams =
    (S.paramsByService.cleaning && Object.keys(S.paramsByService.cleaning).length > 0
      ? S.paramsByService.cleaning
      : (scopePresetFor('cleaning', scopeKey, S.context) || {})) as Record<string, number>;
  const deriveSizeKey = (): CleaningSizeKey => {
    const beds = cleaningParams.bedrooms ?? 1;
    if (beds <= 1) return 'studio';
    if (beds <= 2) return 'small';
    if (beds <= 4) return 'medium';
    return 'large';
  };
  const cleaningSizeKey = deriveSizeKey();
  const sizePreset = cleaningSizePresets[cleaningSizeKey];
  const bathroomsChoice = (() => {
    const b = cleaningParams.bathrooms ?? sizePreset.bathrooms ?? 1;
    if (b <= 1) return 1;
    if (b <= 2) return 2;
    return 3;
  })() as 1 | 2 | 3;
  const cupboardsSelected = (cleaningParams.kitchens ?? sizePreset.kitchens) > sizePreset.kitchens;
  const wallsSelected = (cleaningParams.living ?? sizePreset.living) > sizePreset.living;
  const messLevel = S.conditionLevel;
  const addonsState = cleaningAddonsForScope(scopeKey, S.cleaningAddons);

  const setCleaningWizard = ({
    sizeKey = cleaningSizeKey,
    bathrooms = bathroomsChoice,
    cupboards = cupboardsSelected,
    walls = wallsSelected,
    bedrooms,
    storeys,
  }: {
    sizeKey?: CleaningSizeKey;
    bathrooms?: 1 | 2 | 3;
    cupboards?: boolean;
    walls?: boolean;
    bedrooms?: number;
    storeys?: number;
  }) => {
    const base = cleaningSizePresets[sizeKey] || cleaningSizePresets.medium;
    const nextBedrooms = Math.max(1, bedrooms ?? base.bedrooms);
    const nextBathrooms = Math.max(1, Math.min(3, bathrooms || base.bathrooms || 1));
    const nextStoreys = Math.max(1, Math.min(5, storeys ?? base.storeys ?? 1));
    const nextParams = {
      bedrooms: nextBedrooms,
      bathrooms: nextBathrooms,
      kitchens: base.kitchens + (cupboards ? 1 : 0),
      living: base.living + (walls ? 1 : 0),
      laundry: base.laundry,
      storeys: nextStoreys,
    };
    set('paramsByService', {
      ...S.paramsByService,
      cleaning: {
        ...(S.paramsByService.cleaning || {}),
        ...nextParams,
      },
    });
  };

  const toggleCleaningAddon = (key: 'oven' | 'fridge' | 'windows') => {
    const current = cleaningAddonsForScope(scopeKey, S.cleaningAddons);
    const next = { ...current, [`addon_${key}`]: current[`addon_${key}`] ? 0 : 1 };
    set('cleaningAddons', { ...S.cleaningAddons, [scopeKey]: next });
  };

  const toggleCupboards = () => {
    const current = cleaningAddonsForScope(scopeKey, S.cleaningAddons);
    const nextSelected = !cupboardsSelected;
    set('cleaningAddons', { ...S.cleaningAddons, [scopeKey]: { ...current, wizard_cupboards: nextSelected ? 1 : 0 } });
    setCleaningWizard({ cupboards: nextSelected });
  };

  const toggleWalls = () => {
    const current = cleaningAddonsForScope(scopeKey, S.cleaningAddons);
    const nextSelected = !wallsSelected;
    set('cleaningAddons', { ...S.cleaningAddons, [scopeKey]: { ...current, wizard_walls: nextSelected ? 1 : 0 } });
    setCleaningWizard({ walls: nextSelected });
  };

  const adjustBedrooms = (delta: number) => {
    const current = S.paramsByService.cleaning?.bedrooms ?? sizePreset.bedrooms;
    const next = Math.max(1, Math.min(8, current + delta));
    setCleaningWizard({ bedrooms: next });
  };
  const adjustBathrooms = (delta: number) => {
    const current = S.paramsByService.cleaning?.bathrooms ?? sizePreset.bathrooms;
    const next = Math.max(1, Math.min(6, current + delta));
    setCleaningWizard({ bathrooms: (next > 3 ? 3 : next) as 1 | 2 | 3 });
    set('paramsByService', {
      ...S.paramsByService,
      cleaning: {
        ...(S.paramsByService.cleaning || {}),
        bathrooms: next,
      },
    });
  };
  const adjustStoreys = (delta: number) => {
    const current = S.paramsByService.cleaning?.storeys ?? sizePreset.storeys;
    const next = Math.max(1, Math.min(5, current + delta));
    setCleaningWizard({ storeys: next });
  };
  const adjustKitchens = (delta: number) => {
    const current = S.paramsByService.cleaning?.kitchens ?? sizePreset.kitchens;
    const next = Math.max(0, Math.min(3, current + delta));
    set('paramsByService', {
      ...S.paramsByService,
      cleaning: { ...(S.paramsByService.cleaning || {}), kitchens: next },
    });
  };
  const adjustLaundry = (delta: number) => {
    const current = S.paramsByService.cleaning?.laundry ?? sizePreset.laundry;
    const next = Math.max(0, Math.min(2, current + delta));
    set('paramsByService', {
      ...S.paramsByService,
      cleaning: { ...(S.paramsByService.cleaning || {}), laundry: next },
    });
  };
  const adjustLiving = (delta: number) => {
    const current = S.paramsByService.cleaning?.living ?? sizePreset.living;
    const next = Math.max(0, Math.min(4, current + delta));
    set('paramsByService', {
      ...S.paramsByService,
      cleaning: { ...(S.paramsByService.cleaning || {}), living: next },
    });
  };

  const cleaningHint = (() => {
    if (scopeKey === 'deep') return 'Deep cleans add more detail in kitchens and bathrooms.';
    if (scopeKey === 'endoflease') return 'Move in/out cleans are bond-style with inside appliances included.';
    if (cleaningSizeKey === 'medium') return 'Most 3–4 bedroom homes take around half a day.';
    if (cleaningSizeKey === 'large') return 'Larger homes may be split into focused sessions; we keep it efficient.';
    return 'We keep visits lean; add details if you want us to focus anywhere extra.';
  })();

  return (
    <AnimatePresence>
      {isActive && isConfigOpen && (
        <M.div
          key="cleaning-config"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
        >
          <div className="mt-3 space-y-2 border-t border-slate-200/80 pt-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-800 tracking-tight uppercase">Adjust details</span>
              {cleaningHint && <span className="text-slate-500 hidden sm:inline">{cleaningHint}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5 text-[10px] md:text-[11px] text-slate-700">
              <NumberStepper label="Bed"  value={S.paramsByService.cleaning?.bedrooms  ?? sizePreset.bedrooms}  onStep={(d) => adjustBedrooms(d)}  />
              <NumberStepper label="Kit"  value={S.paramsByService.cleaning?.kitchens  ?? sizePreset.kitchens}  onStep={(d) => adjustKitchens(d)}  />
              <NumberStepper label="Lndy" value={S.paramsByService.cleaning?.laundry   ?? sizePreset.laundry}   onStep={(d) => adjustLaundry(d)}   />
              <NumberStepper label="Liv"  value={S.paramsByService.cleaning?.living    ?? sizePreset.living}    onStep={(d) => adjustLiving(d)}    />
              <NumberStepper label="Bath" value={S.paramsByService.cleaning?.bathrooms ?? sizePreset.bathrooms} onStep={(d) => adjustBathrooms(d)} />
              <NumberStepper label="Flr"  value={S.paramsByService.cleaning?.storeys   ?? sizePreset.storeys}   onStep={(d) => adjustStoreys(d)}   />
            </div>
            <div className="flex flex-wrap gap-1 text-[10px] md:text-[11px]">
              {[
                { key: 'light', label: 'Tidy' },
                { key: 'standard', label: 'Lived in' },
                { key: 'heavy', label: 'Reset' },
              ].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={cls(
                    'px-2 py-0.5 md:px-3 md:py-1 rounded-full border',
                    messLevel === c.key
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white border-black/10 text-slate-700'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    set('conditionLevel', c.key as any);
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 text-[10px] md:text-[11px]">
              {[
                { key: 'oven', label: 'Oven' },
                { key: 'fridge', label: 'Fridge' },
                { key: 'windows', label: 'Windows' },
                { key: 'cupboards', label: 'Cupboards' },
                { key: 'walls', label: 'Walls' },
              ].map((c) => {
                const active =
                  c.key === 'oven'
                    ? Boolean((addonsState as any).addon_oven)
                    : c.key === 'fridge'
                    ? Boolean((addonsState as any).addon_fridge)
                    : c.key === 'windows'
                    ? Boolean((addonsState as any).addon_windows)
                    : c.key === 'cupboards'
                    ? cupboardsSelected
                    : wallsSelected;
                const handle = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (c.key === 'cupboards') return toggleCupboards();
                  if (c.key === 'walls') return toggleWalls();
                  toggleCleaningAddon(c.key as 'oven' | 'fridge' | 'windows');
                };
                return (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'px-2 py-0.5 md:px-3 md:py-1 rounded-full border',
                      active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                    )}
                    onClick={handle}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </M.div>
      )}
    </AnimatePresence>
  );
}
