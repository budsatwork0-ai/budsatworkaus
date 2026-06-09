'use client';

import React from 'react';
import { cls, fmtAUD, fmtHrMin, titleCase } from '../../utils/formatting';
import { hourlyRate } from '../../lib/pricing/engine';
import { computeScopeCardState } from '../../lib/scope-card-state';
import { glassCard } from './UIComponents';
import { ChecklistSection } from './ChecklistSection';
import { ServiceDetailRouter } from './ServiceDetailRouter';
import { type ScopeCardProps, scopeCardPropsAreEqual } from './ScopeCard.types';

export const ScopeCard = React.memo(function ScopeCard({
  S,
  sc,
  isActive,
  onSelect,
  onAdd,
  hookText,
  className = '',
  activeServiceId,
  setActiveServiceId,
  set,
  setMany,
  setHasInteractedStep2,
  openChecklists,
  setOpenChecklists,
  notifyDelta,
  conditionMult,
  carSelector,
  routeSlot,
  laundrySlot,
}: ScopeCardProps) {
  const {
    showSheet, minutes, recommended, hourlyRateDisplay, hourlyHours,
    isHourlyCard, isCleaningWizardCard, isCommercialNicheCard,
    labelId, hookId, isCarCleaning, isCleaning,
    isDumpRunsCard, isDeliveryCard, isTransportCard, isLaundryCard, isSneakerCareCard,
    isBinCleans, isConfigOpen,
    visibleInclusions, hiddenInclusions, moreCount, shouldShowHidden, inclusionMinClass,
  } = computeScopeCardState(S, sc, activeServiceId, conditionMult, openChecklists);

  return (
    <div
      key={sc.key}
      data-scope-card={sc.key}
      role="button"
      tabIndex={0}
      aria-pressed={isActive ? 'true' : 'false'}
      aria-labelledby={labelId}
      aria-describedby={hookId}
      className={cls(
        glassCard(isActive),
        'group relative overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 transition-all active:scale-[0.99]',
        isConfigOpen
          ? 'shadow-[0_20px_60px_rgba(2,6,23,0.18)] z-10'
          : 'hover:shadow-[0_16px_40px_rgba(2,6,23,0.10)] hover:ring-emerald-200/70',
        'flex flex-col h-full min-w-0',
        className
      )}
      onClick={(e) => {
        const target = e.target as HTMLElement | null;
        if (target && target.closest('[data-card-interactive="true"]')) return;
        if (S.scope !== sc.key) onSelect(sc.key);
        setHasInteractedStep2(true);
        if (S.service !== 'yard') setActiveServiceId((curr) => (curr === sc.key ? null : sc.key));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const target = e.target as HTMLElement | null;
          if (target && target.closest('[data-card-interactive="true"]')) return;
          e.preventDefault();
          if (S.scope !== sc.key) onSelect(sc.key);
          setHasInteractedStep2(true);
          if (S.service !== 'yard') setActiveServiceId((curr) => (curr === sc.key ? null : sc.key));
        }
      }}
    >
      {/* Header */}
      <div className="flex items-baseline gap-2 min-w-0">
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 24 24"
          className="mt-0.5 text-slate-700 shrink-0"
        >
          <path
            d="M4 10h16M4 14h16M6 6h12M6 18h12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        <div className="min-w-0 flex-1">
          <div
            id={labelId}
            className="text-lg md:text-xl font-semibold leading-tight tracking-tight text-slate-900 truncate"
          >
            {titleCase(sc.label)}
          </div>
          {!!hookText && (
            <p
              id={hookId}
              className="mt-1 text-[11px] text-slate-600 line-clamp-2 min-h-[28px]"
            >
              {hookText}
            </p>
          )}
        </div>

        {recommended && (
          <span className="ml-1 inline-flex items-center rounded-md bg-emerald-600/10 text-emerald-800 px-2 py-0.5 text-[10px] font-medium">
            Most booked
          </span>
        )}

        {isActive && S.service !== 'laundry_sneakers' && (
          <div className="flex flex-col items-end gap-1 shrink-0" aria-live="polite">
            <span
              className="rounded-full border border-slate-200 bg-white/80 px-2 py-0.5 text-[10px] md:text-[11px] text-slate-600"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {isHourlyCard
                ? `~${hourlyHours ?? 3}h`
                : hourlyRateDisplay
                ? hourlyRateDisplay
                : minutes > 0
                ? `~${fmtHrMin(minutes)}`
                : '—'}
            </span>
            {!isHourlyCard && hourlyHours != null && (
              <span className="text-[10px] text-slate-600">
                {hourlyHours}h · {fmtAUD(hourlyHours * hourlyRate(S.context, 'cleaning', 'hourly', S.commercialCleaningType))}
              </span>
            )}
          </div>
        )}
        {/* Expand/collapse chevron — hidden for yard cards */}
        {S.service !== 'yard' && (
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cls(
            'shrink-0 self-center transition-all duration-200',
            isConfigOpen
              ? 'rotate-90 text-emerald-600'
              : 'text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5'
          )}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        )}
      </div>

      <ChecklistSection
        isHourlyCard={isHourlyCard}
        inclusionMinClass={inclusionMinClass}
        visibleInclusions={visibleInclusions}
        moreCount={moreCount}
        shouldShowHidden={shouldShowHidden}
        showSheet={showSheet}
        isCarCleaning={isCarCleaning}
        isCleaning={isCleaning}
        hiddenInclusions={hiddenInclusions}
        isCleaningWizardCard={isCleaningWizardCard}
        isActive={isActive}
        isCommercialNicheCard={isCommercialNicheCard}
        scopeKey={sc.key}
        setOpenChecklists={setOpenChecklists}
        S={S}
        set={set}
        isConfigOpen={isConfigOpen}
      />

      {/* CTA row */}
      <div className="mt-auto pt-1.5 flex flex-col gap-3">
        <ServiceDetailRouter
          S={S}
          set={set}
          setMany={setMany}
          notifyDelta={notifyDelta}
          isActive={isActive}
          isLaundryCard={isLaundryCard}
          isSneakerCareCard={isSneakerCareCard}
          isDumpRunsCard={isDumpRunsCard}
          isDeliveryCard={isDeliveryCard}
          isTransportCard={isTransportCard}
          isBinCleans={isBinCleans}
          isConfigOpen={isConfigOpen}
          scopeKey={sc.key}
          laundrySlot={laundrySlot}
          carSelector={carSelector}
          routeSlot={routeSlot}
        />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-[11px] text-slate-600">
            Builds a clear to-do list for our techs and your peace of mind.
          </div>
          {S.service !== 'yard' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAdd(sc.key);
              }}
              className="text-sm px-4 py-2 rounded-2xl text-white shadow-[0_8px_20px_rgba(20,83,45,0.2)]"
              style={{ background: 'var(--accent)' }}
            >
              Add to quote
            </button>
          )}
        </div>
      </div>
    </div>
  );
}, scopeCardPropsAreEqual);
