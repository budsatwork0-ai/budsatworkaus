'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { CommercialCleaningType, WizardState } from '../../types';
import { HourlyCleaningPanel } from './HourlyCleaningPanel';
import { InclusionList } from './InclusionList';
import { CleaningWizardPanel } from './CleaningWizardPanel';
import { CommercialCleaningNichePanel } from './CommercialCleaningNichePanel';

interface ChecklistSectionProps {
  isHourlyCard: boolean;
  inclusionMinClass: string;
  visibleInclusions: string[];
  moreCount: number;
  shouldShowHidden: boolean;
  showSheet: boolean;
  isCarCleaning: boolean;
  isCleaning: boolean;
  hiddenInclusions: string[];
  isCleaningWizardCard: boolean;
  isActive: boolean;
  isCommercialNicheCard: boolean;
  scopeKey: string;
  setOpenChecklists: Dispatch<SetStateAction<Record<string, boolean>>>;
  S: WizardState;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  isConfigOpen: boolean;
}

export function ChecklistSection({
  isHourlyCard,
  inclusionMinClass,
  visibleInclusions,
  moreCount,
  shouldShowHidden,
  showSheet,
  isCarCleaning,
  isCleaning,
  hiddenInclusions,
  isCleaningWizardCard,
  isActive,
  isCommercialNicheCard,
  scopeKey,
  setOpenChecklists,
  S,
  set,
  isConfigOpen,
}: ChecklistSectionProps) {
  if (isHourlyCard) {
    return <HourlyCleaningPanel inclusionMinClass={inclusionMinClass} />;
  }
  if (visibleInclusions.length === 0) return null;

  return (
    <div className={`mt-2 ${inclusionMinClass} rounded-xl border border-black/5 bg-white/85 p-3 shadow-sm`}>
      <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1 select-none">
        <span className="font-semibold text-slate-800 tracking-tight uppercase">Checklist</span>
      </div>
      <InclusionList items={visibleInclusions} className="mt-1" />
      {moreCount > 0 && !shouldShowHidden && (
        <button
          type="button"
          data-card-interactive="true"
          onClick={(e) => {
            e.stopPropagation();
            setOpenChecklists((prev) => ({ ...prev, [scopeKey]: true }));
          }}
          aria-expanded={showSheet}
          className="mt-1 text-[11px] underline text-slate-600 hover:text-slate-800"
        >
          {isCarCleaning || isCleaning
            ? `${moreCount} remaining`
            : `+${moreCount} more checklist items included`}
        </button>
      )}
      {shouldShowHidden && (
        <div className="mt-2 space-y-2">
          <InclusionList items={hiddenInclusions} />
          <div className="text-left mt-2">
            <button
              type="button"
              data-card-interactive="true"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-slate-300 bg-white/95 text-[11px] text-slate-700 shadow-sm hover:border-[color:var(--accent)] hover:text-emerald-700"
              onClick={(e) => {
                e.stopPropagation();
                setOpenChecklists((prev) => {
                  const next = { ...prev };
                  delete next[scopeKey];
                  return next;
                });
              }}
            >
              <span aria-hidden>×</span>
              <span>Hide</span>
            </button>
          </div>
        </div>
      )}
      {isCleaningWizardCard && (
        <CleaningWizardPanel
          S={S}
          set={set}
          isConfigOpen={isConfigOpen}
          isActive={isActive}
          scopeKey={scopeKey}
        />
      )}
      {isActive && isCommercialNicheCard && (
        <CommercialCleaningNichePanel
          S={S}
          set={set}
          isConfigOpen={isConfigOpen}
          nicheKey={scopeKey as CommercialCleaningType}
        />
      )}
    </div>
  );
}
