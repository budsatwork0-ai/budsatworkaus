'use client';

import React from 'react';
import { cls, fmtAUD, fmtHrMin, titleCase } from '../../utils/formatting';
import { hourlyRate } from '../../lib/pricing/engine';
import { computeScopeCardState } from '../../lib/scope-card-state';
import { PREMIUM_UI, PREMIUM_FONT, SIMPLE_SERVICE_CARDS, MENU_SERVICE_CARDS, CARD_PHOTOS, CARD_LINES } from './simple-cards';
import { calculateServicePrice } from '../../lib/estimation';
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
      style={PREMIUM_UI ? { fontFamily: PREMIUM_FONT } : undefined}
      aria-describedby={hookId}
      className={cls(
        PREMIUM_UI
          ? cls('rounded-[24px] p-4 cursor-pointer select-none bg-white border transition-all duration-300 ease-out active:scale-[0.98]',
              isActive ? 'border-emerald-500/50 shadow-[0_2px_4px_rgba(0,0,0,0.03),0_20px_50px_rgba(16,94,60,0.10)]' : 'border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_36px_rgba(0,0,0,0.05)]')
          : glassCard(isActive),
        'group relative overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 transition-all active:scale-[0.99]',
        PREMIUM_UI ? '' : isConfigOpen
          ? 'shadow-[0_20px_60px_rgba(2,6,23,0.18)] z-10'
          : 'hover:shadow-[0_16px_40px_rgba(2,6,23,0.10)] hover:ring-emerald-200/70',
        PREMIUM_UI && !isActive ? 'hover:shadow-[0_2px_4px_rgba(0,0,0,0.03),0_18px_44px_rgba(0,0,0,0.08)]' : '',
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
      {MENU_SERVICE_CARDS && (() => {
        const photo = sc.groupPhoto || (sc.groupLine ? undefined : CARD_PHOTOS[sc.key]);
        const line = sc.groupLine || CARD_LINES[sc.key] || (sc.desc ? String(sc.desc).split('.')[0] : '');
        let price = 0;
        if (typeof sc.groupFrom === 'number') price = sc.groupFrom;
        else { try { price = calculateServicePrice(sc.key, S).price; } catch { price = 0; } }
        const time = isHourlyCard
          ? `~${hourlyHours ?? 3}h`
          : hourlyRateDisplay
          ? hourlyRateDisplay
          : minutes > 0
          ? `~${fmtHrMin(minutes)}`
          : '';
        const meta = [price > 0 ? `From ${fmtAUD(price)}` : '', sc.groupLine ? '' : time].filter(Boolean).join(' · ');
        return (
          <div className="-mx-4 -mt-4 mb-3">
            <div className={cls("relative w-full overflow-hidden bg-gradient-to-br from-emerald-50 to-emerald-100", PREMIUM_UI ? "h-48 rounded-t-[24px]" : "h-32")}>
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-emerald-700/70">
                  <svg aria-hidden width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z" />
                    <path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
                  </svg>
                </div>
              )}
              <button
                type="button"
                data-card-interactive="true"
                aria-label={isActive ? `Add ${sc.label} to quote` : `Choose ${sc.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setHasInteractedStep2(true);
                  if (isActive) { onAdd(sc.key); return; }
                  if (S.scope !== sc.key) onSelect(sc.key);
                  if (S.service !== 'yard') setActiveServiceId(sc.key);
                }}
                className={cls(
                  PREMIUM_UI
                    ? 'absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-xl transition-all duration-300 active:scale-90 shadow-[0_4px_14px_rgba(0,0,0,0.12)]'
                    : 'absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-colors',
                  isActive ? (PREMIUM_UI ? 'bg-emerald-600 text-white scale-105' : 'bg-emerald-600 text-white') : (PREMIUM_UI ? 'bg-white/85 text-slate-900' : 'bg-white text-emerald-700')
                )}
              >
                <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  {isActive ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M12 5v14M5 12h14" />}
                </svg>
              </button>
            </div>
            <div className={PREMIUM_UI ? "px-5 pt-5" : "px-4 pt-3"}>
              <div id={labelId} className={PREMIUM_UI ? "text-[22px] font-semibold leading-tight tracking-[-0.02em] text-slate-900" : "text-lg font-bold leading-tight tracking-tight text-slate-900"}>
                {titleCase(sc.label)}
              </div>
              {!!line && <p id={hookId} className={PREMIUM_UI ? "mt-1 text-[15px] text-slate-500 line-clamp-1" : "mt-0.5 text-sm text-slate-600 line-clamp-1"}>{line}</p>}
              {!!meta && (
                <p className={PREMIUM_UI ? "mt-2 text-[15px] font-medium text-slate-900" : "mt-1.5 text-sm font-semibold text-emerald-800"} style={{ fontVariantNumeric: 'tabular-nums' }}>{meta}</p>
              )}
              {isActive && Array.isArray(sc.groupVariants) && sc.groupVariants.length > 1 && (
                <div data-card-interactive="true" className={PREMIUM_UI ? "mt-4 flex rounded-full bg-slate-100 p-1" : "mt-3 flex flex-wrap gap-2"} role="radiogroup" aria-label="Choose an option">
                  {sc.groupVariants.map((v: { key: string; label: string }) => (
                    <button
                      key={v.key}
                      type="button"
                      role="radio"
                      aria-checked={sc.key === v.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (v.key === sc.key) return;
                        onSelect(v.key);
                        setActiveServiceId(v.key);
                      }}
                      className={cls(
                        PREMIUM_UI ? 'flex-1 rounded-full px-2 py-2 text-[13px] font-medium transition-all duration-200' : 'rounded-xl px-3 py-2 text-sm font-semibold',
                        PREMIUM_UI
                          ? (sc.key === v.key ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-slate-500')
                          : (sc.key === v.key ? 'bg-emerald-600 text-white' : 'bg-white text-[#0F3F33] border border-emerald-100')
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Header */}
      {!MENU_SERVICE_CARDS && <div className="flex items-baseline gap-2 min-w-0">
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
          {!!hookText && !SIMPLE_SERVICE_CARDS && (
            <p
              id={hookId}
              className="mt-1 text-[11px] text-slate-600 line-clamp-2 min-h-[28px]"
            >
              {hookText}
            </p>
          )}
        </div>

        {recommended && !SIMPLE_SERVICE_CARDS && (
          <span className="ml-1 inline-flex items-center rounded-md bg-emerald-600/10 text-emerald-800 px-2 py-0.5 text-[10px] font-medium">
            Most booked
          </span>
        )}

        {(isActive || SIMPLE_SERVICE_CARDS) && S.service !== 'laundry_sneakers' && (
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
        {/* Expand affordance — text label + chevron, hidden for yard */}
        {S.service !== 'yard' && (
          <span className="shrink-0 self-center flex items-center gap-1">
            {!isConfigOpen && !SIMPLE_SERVICE_CARDS && (
              <span className="hidden sm:inline text-[11px] font-medium text-emerald-700 group-hover:text-emerald-800 transition-colors whitespace-nowrap">
                View full checklist
              </span>
            )}
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
                'shrink-0 transition-all duration-200',
                isConfigOpen
                  ? 'rotate-90 text-emerald-600'
                  : 'text-emerald-600 group-hover:translate-x-0.5'
              )}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        )}
      </div>}

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
        {(!MENU_SERVICE_CARDS || isActive) && <div className={cls('flex items-center justify-between flex-wrap gap-2', MENU_SERVICE_CARDS ? '' : 'pt-2.5 mt-1 border-t border-black/[0.06]')}>
          {!SIMPLE_SERVICE_CARDS && (
            <div className="text-[11px] text-slate-500">
              Builds a clear to-do list for our techs and your peace of mind.
            </div>
          )}
          {S.service !== 'yard' && (
            <button
              type="button"
              data-card-interactive="true"
              onClick={(e) => {
                e.stopPropagation();
                onAdd(sc.key);
              }}
              className={PREMIUM_UI ? 'ml-auto h-10 px-6 rounded-full bg-slate-900 text-white text-sm font-medium transition-transform active:scale-[0.97]' : cls(SIMPLE_SERVICE_CARDS ? 'w-full h-11 text-base font-semibold' : 'text-sm px-4 py-2', 'rounded-2xl text-white shadow-[0_8px_20px_rgba(20,83,45,0.2)]')}
              style={PREMIUM_UI ? undefined : { background: 'var(--accent)' }}
            >
              {MENU_SERVICE_CARDS ? 'Continue' : 'Add to quote'}
            </button>
          )}
        </div>}
      </div>
    </div>
  );
}, scopeCardPropsAreEqual);
