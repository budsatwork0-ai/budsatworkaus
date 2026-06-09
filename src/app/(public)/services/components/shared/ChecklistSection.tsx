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
  showSheet: _showSheet,
  isCarCleaning: _isCarCleaning,
  isCleaning: _isCleaning,
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

      {/* Hidden items — always rendered for smooth CSS animation */}
      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
          shouldShowHidden ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!shouldShowHidden}
      >
        <div className="mt-2 space-y-2">
          <InclusionList items={hiddenInclusions} />
          <button
            type="button"
            data-card-interactive="true"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 bg-white/95 text-[11px] text-slate-600 hover:border-emerald-200 hover:text-emerald-700 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setOpenChecklists((prev) => {
                const next = { ...prev };
                delete next[scopeKey];
                return next;
              });
            }}
          >
            <svg aria-hidden width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 15l-6-6-6 6" />
            </svg>
            Show less
          </button>
        </div>
      </div>

      {/* Expand CTA */}
      {moreCount > 0 && !shouldShowHidden && (
        <button
          type="button"
          data-card-interactive="true"
          onClick={(e) => {
            e.stopPropagation();
            setOpenChecklists((prev) => ({ ...prev, [scopeKey]: true }));
          }}
          aria-expanded="false"
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-100 bg-emerald-50/60 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 active:bg-emerald-100 transition-colors"
        >
          <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
          View {moreCount} more included items
        </button>
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
