'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import type {
  CommercialCleaningType,
  CleaningWizardChecklistState,
  ScopeKey,
  ServiceType,
} from '../../types';
import {
} from '../../lib/pricing/constants';
import { cls, fmtAUD, fmtHrMin, titleCase } from '../../utils/formatting';
import { M } from '../../utils/motion';
import { isRec } from '../../lib/service-data';
import { scopePresetFor, buildCleaningChecklistFromWizard } from '../../lib/service-helpers';
import { hourlyRate } from '../../lib/pricing/engine';
import { computeMins, cleaningAddonsForScope } from '../../lib/estimation';
import { glassCard } from './UIComponents';
import { BinCleansPanel } from './BinCleansPanel';
import { CarDetailingPanel } from './CarDetailingPanel';
import { CleaningWizardPanel } from './CleaningWizardPanel';
import { HourlyCleaningPanel } from './HourlyCleaningPanel';
import { CommercialCleaningNichePanel } from './CommercialCleaningNichePanel';
import { DeliveryPanel } from './DeliveryPanel';
import { DumpRunsPanel } from './DumpRunsPanel';
import { LaundryPanel } from './LaundryPanel';
import { SneakerCarePanel } from './SneakerCarePanel';
import { TransportPanel } from './TransportPanel';
import { WindowsServicePanel } from './WindowsServicePanel';
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
  const { ironingOpen: laundryIroningOpen, setIroningOpen: setLaundryIroningOpen, addOnTotal: laundryAddOnTotal, priceLabel: priceLabelBase, isTurnaroundAvailable: isSneakerTurnaroundAvailable } = laundrySlot;
  const showSheet = !!openChecklists[sc.key];
  const _popoverId = React.useId(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const minutes = computeMins(S, S.service as ServiceType, sc.key as ScopeKey, conditionMult);
  const recommended = isRec(S.service as string, sc.key as string);
  const hourlyRateDisplay =
    S.service === 'cleaning' && sc.key === 'hourly'
      ? `${fmtAUD(hourlyRate(S.context, 'cleaning', 'hourly', S.commercialCleaningType))}/hr`
      : null;
  const hourlyHours =
    S.service === 'cleaning' && sc.key === 'hourly'
      ? Math.max(3, Math.round(S.paramsByService.cleaning?.hours ?? 3))
      : null;
  const isHomeCleaning = S.service === 'cleaning' && S.context !== 'commercial';
  const isCommercialCleaning = S.service === 'cleaning' && S.context === 'commercial';
  const commercialNicheKeys: CommercialCleaningType[] = ['office', 'medical', 'fitness', 'hospitality', 'education', 'event', 'accommodation'];
  const isCommercialNicheCard = isCommercialCleaning && commercialNicheKeys.includes(sc.key as CommercialCleaningType);
  const isHourlyCard = isHomeCleaning && sc.key === 'hourly';
  const isCleaningWizardCard = isHomeCleaning && !isHourlyCard;
  const addonsQuick: { key: string; label: string }[] = [];
  const addonsState = cleaningAddonsForScope(sc.key, S.cleaningAddons);
  const labelId = `sc-${sc.key}-label`;
  const hookId = `sc-${sc.key}-desc`;
  const isCarCleaning = S.service === 'auto';
  const isCleaning = S.service === 'cleaning';
  const isDumpRunsCard = S.service === 'dump' && sc.key === 'dump_runs';
  const isDeliveryCard = S.service === 'dump' && sc.key === 'dump_delivery';
  const isTransportCard = S.service === 'dump' && sc.key === 'dump_transport';
  // Laundry & Sneaker Care card detection
  const isLaundryCard = S.service === 'laundry_sneakers' && sc.key === 'laundry';
  const isSneakerCareCard = S.service === 'laundry_sneakers' && sc.key === 'sneaker_care';
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
      : (scopePresetFor('cleaning', sc.key, S.context) || {})) as Record<string, number>;
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
  const cupboardsSelected =
    (cleaningParams.kitchens ?? sizePreset.kitchens) > sizePreset.kitchens;
  const wallsSelected = (cleaningParams.living ?? sizePreset.living) > sizePreset.living;
  const messLevel = S.conditionLevel;

  const isBinCleans = S.service === 'dump' && sc.key === 'bin_cleans';
  const isConfigOpen = activeServiceId === sc.key;

  const updateDumpParam = (key: string, value: number) => {
    set('paramsByService', {
      ...S.paramsByService,
      dump: { ...(S.paramsByService.dump || {}), [key]: value },
    });
  };
  const setBinPlan = (n: number) => {
    const next = Math.max(0, Math.min(2, n));
    // Reset all bin selections when switching plans so the form feels fresh
    set('paramsByService', {
      ...S.paramsByService,
      dump: {
        ...(S.paramsByService.dump || {}),
        binPlan: next,
        redBins: 0,
        redBinFreq: 0,
        yellowBins: 0,
        yellowBinFreq: 0,
        greenBins: 0,
        greenBinFreq: 0,
        kitchenBins: 0,
      },
    });
  };

  const FALLBACK_INCLUSIONS = [
    "Scope confirmed (what's in / out)",
    'Access/parking/prep noted',
    'Time & pricing confirmed',
    'Handover/QA (photos or walkthrough)',
  ];

  let inclusions: string[] = Array.isArray(sc.inclusions) ? [...sc.inclusions] : [];
  if (isCleaningWizardCard) {
    const propertySize: CleaningWizardChecklistState['propertySize'] =
      cleaningSizeKey === 'studio'
        ? 'studio'
        : cleaningSizeKey === 'small'
        ? '1-2'
        : cleaningSizeKey === 'medium'
        ? '3-4'
        : '5+';
    const messLevelLabel: CleaningWizardChecklistState['messLevel'] =
      messLevel === 'light' ? 'tidy' : messLevel === 'heavy' ? 'reset' : 'lived-in';
    const addOns: CleaningWizardChecklistState['addOns'] = {
      oven: Boolean((addonsState as any).addon_oven),
      fridge: Boolean((addonsState as any).addon_fridge),
      windows: Boolean((addonsState as any).addon_windows),
      cupboards: cupboardsSelected,
      walls: wallsSelected,
    };
    inclusions = buildCleaningChecklistFromWizard({
      propertySize,
      bathrooms: bathroomsChoice as 1 | 2 | 3,
      messLevel: messLevelLabel,
      addOns,
      scope: sc.key,
    });
  }
  if (!isCleaning && !isCarCleaning && inclusions.length < 4) {
    const needed = 4 - inclusions.length;
    inclusions = inclusions.concat(FALLBACK_INCLUSIONS.slice(0, needed));
  }

  const visibleInclusions = isHourlyCard ? [] : inclusions.slice(0, 4);
  const hiddenInclusions = isHourlyCard ? [] : inclusions.slice(4);
  const moreCount = isHourlyCard ? 0 : Math.max(0, inclusions.length - visibleInclusions.length);


  const shouldShowHidden = hiddenInclusions.length > 0 && showSheet;
  const formatInc = (inc: string) => {
    const trimmed = inc.trim();
    const isHeader = /^—/.test(trimmed);
    const text = trimmed.replace(/^—\s*|\s*—$/g, '').trim();
    return { isHeader, text: text || inc };
  };
  const inclusionMinClass = ['windows', 'yard', 'dump', 'laundry_sneakers'].includes(
    S.service as any
  )
    ? 'min-h-[52px]'
    : 'min-h-[72px]';

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
        'relative overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 transition-all',
        isConfigOpen
          ? 'shadow-[0_20px_60px_rgba(2,6,23,0.18)] z-10'
          : 'hover:shadow-[0_16px_40px_rgba(2,6,23,0.10)]',
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
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cls(
            'shrink-0 self-center text-slate-400 transition-transform duration-200',
            isConfigOpen && 'rotate-90'
          )}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        )}
      </div>

      {/* Simple inclusions preview */}
      {isHourlyCard ? (
        <HourlyCleaningPanel inclusionMinClass={inclusionMinClass} />
      ) : (
      visibleInclusions.length > 0 && (
        <div
          className={`mt-2 ${inclusionMinClass} rounded-xl border border-black/5 bg-white/85 p-3 shadow-sm`}
        >
          <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1 select-none">
            <span className="font-semibold text-slate-800 tracking-tight uppercase">Checklist</span>
          </div>
          <ul className="mt-1 space-y-1 text-xs text-slate-700">
            {visibleInclusions.map((inc) => {
              const { isHeader, text } = formatInc(inc);
              if (isHeader) {
                return (
                  <li key={inc} className="pt-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    {text}
                  </li>
                );
              }
              return (
                <li key={inc} className="flex items-start gap-1.5">
                  <span
                    className="mt-[5px] h-1.5 w-1.5 rounded-full bg-emerald-400"
                    aria-hidden
                  />
                  <span>{text}</span>
                </li>
              );
            })}
          </ul>
          {moreCount > 0 && !shouldShowHidden && (
            <button
              type="button"
              data-card-interactive="true"
              onClick={(e) => {
                e.stopPropagation();
                setOpenChecklists((prev) => ({ ...prev, [sc.key]: true }));
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
              <ul className="space-y-1 text-xs text-slate-700">
                {hiddenInclusions.map((inc) => {
                  const { isHeader, text } = formatInc(inc);
                  if (isHeader) {
                    return (
                      <li
                        key={inc}
                        className="pt-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        {text}
                      </li>
                    );
                  }
                  return (
                    <li key={inc} className="flex items-start gap-1.5">
                      <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
                      <span>{text}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="text-left mt-2">
                <button
                  type="button"
                  data-card-interactive="true"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-slate-300 bg-white/95 text-[11px] text-slate-700 shadow-sm hover:border-[color:var(--accent)] hover:text-emerald-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenChecklists((prev) => {
                      const next = { ...prev };
                      delete next[sc.key];
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
              scopeKey={sc.key}
            />
          )}
          {isActive && isCommercialNicheCard && (
            <CommercialCleaningNichePanel
              S={S}
              set={set}
              isConfigOpen={isConfigOpen}
              nicheKey={sc.key as CommercialCleaningType}
            />
          )}
        </div>
      ))}

      {/* CTA row */}
      <div className="mt-auto pt-1.5 flex flex-col gap-3">
        <AnimatePresence>
          {isConfigOpen && (
            <M.div
              key={sc.key + '-cta'}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-3"
            >
        {S.service === 'windows' && isActive && (
          <WindowsServicePanel S={S} setMany={setMany} notifyDelta={notifyDelta} />
        )}

        {S.service === 'auto' && isActive && (
          <CarDetailingPanel S={S} set={set} carSelector={carSelector} />
        )}

        {/* Laundry Card */}
        {S.service === 'laundry_sneakers' && isLaundryCard && isActive && (
          <LaundryPanel
            laundryLoads={S.laundryLoads || 1}
            laundryPerLoadAddOns={S.laundryPerLoadAddOns ?? []}
            laundryPerOrderAddOns={S.laundryPerOrderAddOns ?? []}
            laundryIroningItems={S.laundryIroningItems ?? []}
            set={set}
            ironingOpen={laundryIroningOpen}
            setIroningOpen={setLaundryIroningOpen}
            addOnTotal={laundryAddOnTotal}
            priceLabel={priceLabelBase}
          />
        )}

        {S.service === 'laundry_sneakers' && isSneakerCareCard && isActive && (
          <SneakerCarePanel
            S={S}
            set={set}
            isSneakerTurnaroundAvailable={isSneakerTurnaroundAvailable}
            isConfigOpen={isConfigOpen}
          />
        )}

        {isDumpRunsCard && (
          <DumpRunsPanel
            S={S}
            set={set}
            isConfigOpen={isConfigOpen}
          />
        )}
        {isDeliveryCard && (
          <DeliveryPanel
            S={S}
            set={set}
            routeSlot={routeSlot}
          />
        )}
        {isTransportCard && (
          <TransportPanel
            S={S}
            set={set}
            routeSlot={routeSlot}
          />
        )}
        {isBinCleans && (
          <BinCleansPanel
            dumpParams={S.paramsByService.dump || {}}
            updateDumpParam={updateDumpParam}
            setBinPlan={setBinPlan}
          />
        )}


        {isActive && addonsQuick.length > 0 && (
          <div className="flex flex-wrap gap-1.5 relative z-10">
            {addonsQuick.map((a) => (
              <button
                key={a.key}
                type="button"
                className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] bg-white hover:border-[color:var(--accent)]"
                onClick={(e) => {
                  e.stopPropagation();
                  const current = cleaningAddonsForScope(sc.key, S.cleaningAddons);
                  const next = { ...current, [`addon_${a.key}`]: current[`addon_${a.key}`] ? 0 : 1 };
                  set('cleaningAddons', { ...S.cleaningAddons, [sc.key]: next });
                }}
              >
                {(addonsState as any)[`addon_${a.key}`] ? '✓ ' : ''}{a.label}
              </button>
            ))}
          </div>
        )}

            </M.div>
          )}
        </AnimatePresence>
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
