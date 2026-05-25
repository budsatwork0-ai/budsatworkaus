'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import RegoLookupAssistant from '@/app/ui/car/RegoLookupAssistant';
import type {
  CommercialCleaningType,
  CommFrequency,
  CleaningWizardChecklistState,
  DeliverySelection,
  DumpRunSelection,
  IroningItem,
  IroningItemType,
  LaundryPerLoadAddOn,
  LaundryPerOrderAddOn,
  ScopeKey,
  ServiceType,
  TransportSelection,
} from '../../types';
import {
  DEFAULT_DUMP_RUN,
  DEFAULT_DUMP_DELIVERY,
  DEFAULT_DUMP_TRANSPORT,
  SNEAKER_TURNAROUND_META,
  SNEAKER_MULTI_PRICING,
  LAUNDRY_PER_LOAD_ADDONS,
  LAUNDRY_PER_ORDER_ADDONS,
  LAUNDRY_IRONING_PRICES,
} from '../../lib/pricing/constants';
import { cls, fmtAUD, fmtHrMin, titleCase } from '../../utils/formatting';
import { M } from '../../utils/motion';
import { COMM_FEATURES, COMM_PRESETS, COMM_STANDARDS, isRec } from '../../lib/service-data';
import { scopePresetFor, buildCleaningChecklistFromWizard } from '../../lib/service-helpers';
import { hourlyRate } from '../../lib/pricing/engine';
import { calcTransportQuote, calcDeliveryQuote } from '../../lib/pricing/transport';
import { computeMins, cleaningAddonsForScope } from '../../lib/estimation';
import { glassCard, CommSqmSlider, NumberStepper } from './UIComponents';
import { type ScopeCardProps, scopeCardPropsAreEqual } from './ScopeCard.types';

const WindowsEditor = dynamic(
  () => import('../windows/WindowsEditor').then(m => ({ default: m.WindowsEditor })),
  { ssr: false }
);
const DistanceRouteConfigurator = dynamic(
  () => import('../dump/DistanceRouteConfigurator').then(m => ({ default: m.DistanceRouteConfigurator })),
  { ssr: false }
);

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
  const { expanded: routeExpanded, setExpanded: setRouteExpanded, transportExpanded: transportRouteExpanded, setTransportExpanded: setTransportRouteExpanded, lookup: routeLookup, loading: routeLookupLoading, message: routeLookupMessage, distanceLabel: routeDistanceLabel, onFocusChange: handleDistanceInputFocusChange, onPlaceSelected: handleDistancePlaceSelected } = routeSlot;
  const { ironingOpen: laundryIroningOpen, setIroningOpen: setLaundryIroningOpen, addOnTotal: laundryAddOnTotal, priceLabel: priceLabelBase, isTurnaroundAvailable: isSneakerTurnaroundAvailable } = laundrySlot;
  const dumpRunState = S.dumpRun || DEFAULT_DUMP_RUN;
  const deliveryState = S.dumpDelivery || DEFAULT_DUMP_DELIVERY;
  const transportState = S.dumpTransport || DEFAULT_DUMP_TRANSPORT;
  const dumpLoadType = dumpRunState.loadType;
  const dumpLoads = Math.max(1, Math.round(dumpRunState.loads || 1));
  const deliveryType = deliveryState.itemType;
  const deliveryAssist = deliveryState.assist;
  const transportType = transportState.moveType;
  const transportStairs = transportState.stairs;
  const transportSize = transportState.loadSize;
  const updateDumpRun = (next: Partial<DumpRunSelection>) =>
    set('dumpRun', { ...dumpRunState, ...next });
  const updateDelivery = (next: Partial<DeliverySelection>) =>
    set('dumpDelivery', { ...deliveryState, ...next });
  const updateTransport = (next: Partial<TransportSelection>) =>
    set('dumpTransport', { ...transportState, ...next });
  const [refreshMaterial, setRefreshMaterial] = React.useState<
    'mesh' | 'leather' | 'synthetic' | 'suede' | 'boots' | null
  >(null);
  const [refreshConcern, setRefreshConcern] = React.useState<
    'dirt' | 'yellowing' | 'scuffs' | 'odour' | 'wear' | null
  >(null);
  const [deepSoiling, setDeepSoiling] = React.useState<'light' | 'noticeable' | 'heavy'>('light');
  const [deepSensitive, setDeepSensitive] = React.useState<Set<'suede' | 'dyed' | 'collectible'>>(
    () => new Set()
  );
  const [multiPairs, setMultiPairs] = React.useState(1);
  const [multiMixed, setMultiMixed] = React.useState<'yes' | 'no'>('no');
  const [deliveryItemQty, setDeliveryItemQty] = React.useState(1);
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
  // Legacy sneaker card detection (for backward compatibility)
  const isSneakerRefresh = S.service === 'laundry_sneakers' && (sc.key === 'sneaker_basic' || (sc.key === 'sneaker_care' && S.sneakerTier === 'refresh'));
  const isSneakerDeep = S.service === 'laundry_sneakers' && (sc.key === 'sneaker_full' || (sc.key === 'sneaker_care' && S.sneakerTier === 'deep'));
  const isSneakerMulti = S.service === 'laundry_sneakers' && (sc.key === 'sneaker_lot' || (sc.key === 'sneaker_care' && S.sneakerTier === 'multi'));
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
    const current = cleaningAddonsForScope(sc.key, S.cleaningAddons);
    const next = { ...current, [`addon_${key}`]: current[`addon_${key}`] ? 0 : 1 };
    set('cleaningAddons', { ...S.cleaningAddons, [sc.key]: next });
  };

  const toggleCupboards = () => {
    const current = cleaningAddonsForScope(sc.key, S.cleaningAddons);
    const nextSelected = !cupboardsSelected;
    set('cleaningAddons', { ...S.cleaningAddons, [sc.key]: { ...current, wizard_cupboards: nextSelected ? 1 : 0 } });
    setCleaningWizard({ cupboards: nextSelected });
  };

  const toggleWalls = () => {
    const current = cleaningAddonsForScope(sc.key, S.cleaningAddons);
    const nextSelected = !wallsSelected;
    set('cleaningAddons', { ...S.cleaningAddons, [sc.key]: { ...current, wizard_walls: nextSelected ? 1 : 0 } });
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
  const isBinCleans = S.service === 'dump' && sc.key === 'bin_cleans';
  const isConfigOpen = activeServiceId === sc.key;

  // Bin cleans state
  const dumpParams = S.paramsByService.dump || {};
  const redBins = Math.max(0, dumpParams.redBins ?? 0);
  const redBinFreq = Math.max(0, Math.min(2, dumpParams.redBinFreq ?? 0)); // 0=oneoff, 1=weekly, 2=fortnightly
  const yellowBins = Math.max(0, dumpParams.yellowBins ?? 0);
  const yellowBinFreq = Math.max(0, Math.min(1, dumpParams.yellowBinFreq ?? 0)); // 0=oneoff, 1=fortnightly
  const greenBins = Math.max(0, dumpParams.greenBins ?? 0);
  const greenBinFreq = Math.max(0, Math.min(1, dumpParams.greenBinFreq ?? 0)); // 0=oneoff, 1=monthly
  const kitchenBins = Math.max(0, dumpParams.kitchenBins ?? 0);
  const binPlan = Math.max(0, Math.min(2, dumpParams.binPlan ?? 0)); // 0=none, 1=household, 2=lite

  const totalWheelies = redBins + yellowBins + greenBins;
  const validKitchenBins = totalWheelies > 0 ? kitchenBins : 0;

  const updateDumpParam = (key: string, value: number) => {
    set('paramsByService', {
      ...S.paramsByService,
      dump: { ...(S.paramsByService.dump || {}), [key]: value },
    });
  };

  const setRedBins = (n: number) => updateDumpParam('redBins', Math.max(0, Math.min(10, Math.round(n))));
  const setRedBinFreq = (n: number) => updateDumpParam('redBinFreq', Math.max(0, Math.min(2, n)));
  const setYellowBins = (n: number) => updateDumpParam('yellowBins', Math.max(0, Math.min(10, Math.round(n))));
  const setYellowBinFreq = (n: number) => updateDumpParam('yellowBinFreq', Math.max(0, Math.min(1, n)));
  const setGreenBins = (n: number) => updateDumpParam('greenBins', Math.max(0, Math.min(10, Math.round(n))));
  const setGreenBinFreq = (n: number) => updateDumpParam('greenBinFreq', Math.max(0, Math.min(1, n)));
  const setKitchenBins = (n: number) => updateDumpParam('kitchenBins', Math.max(0, Math.min(5, Math.round(n))));
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

  const cleaningHint = (() => {
    if (!isCleaningWizardCard) return null;
    if (sc.key === 'deep') return 'Deep cleans add more detail in kitchens and bathrooms.';
    if (sc.key === 'endoflease') return 'Move in/out cleans are bond-style with inside appliances included.';
    if (cleaningSizeKey === 'medium') return 'Most 3–4 bedroom homes take around half a day.';
    if (cleaningSizeKey === 'large') return 'Larger homes may be split into focused sessions; we keep it efficient.';
    return 'We keep visits lean; add details if you want us to focus anywhere extra.';
  })();
  const stopCardBubble = (e: React.SyntheticEvent) => e.stopPropagation();

  const dumpHints = (() => {
    if (!(isConfigOpen && isDumpRunsCard)) return null;
    const typeLabel =
      dumpLoadType === 'single_item'
        ? 'single item'
        : dumpLoadType === 'ute'
        ? 'ute load'
        : dumpLoadType === 'half_trailer'
        ? 'half trailer'
        : dumpLoadType === 'trailer'
        ? 'trailer full'
        : dumpLoadType === 'bulky'
        ? 'bulky furniture'
        : 'mixed load';
    const volumePer =
      dumpLoadType === 'single_item'
        ? 0.5
        : dumpLoadType === 'ute'
        ? 1.5
        : dumpLoadType === 'half_trailer'
        ? 2.0
        : dumpLoadType === 'trailer'
        ? 2.5
        : dumpLoadType === 'bulky'
        ? 2.0
        : 1.2;
    const totalVol = Math.max(1, dumpLoads) * volumePer;
    const baseLow =
      dumpLoadType === 'single_item' ? 20 : dumpLoadType === 'bulky' ? 50 : 40;
    const baseHigh =
      dumpLoadType === 'single_item' ? 40 : dumpLoadType === 'bulky' ? 90 : 80;
    const minsLow = baseLow + (dumpLoads - 1) * 15;
    const minsHigh = baseHigh + (dumpLoads - 1) * 20;
    const techs =
      dumpLoadType === 'single_item'
        ? 'Usually a solo tech.'
        : dumpLoadType === 'bulky' || dumpLoads >= 3
        ? 'Usually requires 2 techs.'
        : 'Typically 1–2 techs.';
    return {
      line1: `Looks like approximately ~${Math.round(totalVol * 10) / 10} cubic metres (${typeLabel}).`,
      line2: `Most jobs like this take around ${Math.max(30, minsLow)}–${minsHigh} minutes onsite.`,
      line3: techs,
    };
  })();

  const refreshHints = (() => {
    if (!(isConfigOpen && isSneakerRefresh)) return null;
    const materialHint =
      refreshMaterial === 'mesh'
        ? 'Mesh pairs respond really well to Refresh cleans.'
        : refreshMaterial === 'leather'
        ? 'Leather pairs get gentle, material-safe cleaning.'
        : refreshMaterial === 'synthetic'
        ? 'Synthetic uppers clean up nicely with a refresh.'
        : refreshMaterial === 'suede'
        ? 'Thanks — suede is cleaned with material-safe methods.'
        : refreshMaterial === 'boots'
        ? 'Boots get an exterior uplift; we keep it material-safe.'
        : "We'll match the clean to the material.";

    const concernHint =
      refreshConcern === 'yellowing'
        ? 'Yellowing often needs deeper treatment — Deep Restore may be better.'
        : refreshConcern === 'scuffs'
        ? 'Light scuffs get cosmetic attention in Refresh.'
        : refreshConcern === 'odour'
        ? 'Odour treatment is included in Refresh Clean.'
        : refreshConcern === 'wear'
        ? "Wear & tear is noted — we'll set expectations clearly."
        : 'General dirt is well suited to Refresh Clean.';

    return [materialHint, concernHint];
  })();

  const deepHints = (() => {
    if (!(isConfigOpen && isSneakerDeep)) return null;
    const soilingHint =
      deepSoiling === 'heavy'
        ? 'Heavily worn pairs usually benefit the most from Deep Restore.'
        : deepSoiling === 'noticeable'
        ? 'Noticeably dirty pairs are a great fit for Deep Restore.'
        : 'Lightly worn pairs still get full deep care.';
    const sensitives = Array.from(deepSensitive);
    const sensitiveHint = sensitives.length
      ? "We'll take extra care with suede, dyed leather, and collectible pairs."
      : "We'll still handle carefully — no sensitive materials flagged.";
    return [soilingHint, sensitiveHint];
  })();

  const multiHints = (() => {
    if (!(isConfigOpen && isSneakerMulti)) return null;
    const countHint =
      multiPairs >= 10
        ? 'Batch discounts may apply depending on quantity.'
        : multiPairs >= 4
        ? 'Larger batches can be grouped for efficiency.'
        : 'Small batches are easy to schedule together.';
    const mixHint =
      multiMixed === 'yes'
        ? 'You can mix Refresh and Deep Restore in the same booking.'
        : 'All pairs same care — quick to batch together.';
    return [countHint, mixHint, 'We can return pairs together or separately.'];
  })();

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
        <div className={`mt-2 ${inclusionMinClass}`}>
          <ul className="space-y-1 text-[11px] text-slate-700">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              <span>3-hour minimum</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              <span>$60/hr</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              <span>You choose what gets cleaned</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              <span>Smart Floor Plan included</span>
            </li>
          </ul>
        </div>
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
          <AnimatePresence>
            {isActive && isCleaningWizardCard && isConfigOpen && (
              <M.div
                key="cleaning-config"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
            <div
              className="mt-3 space-y-2 border-t border-slate-200/80 pt-3"
            >
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
          <AnimatePresence>
            {isActive && isCommercialNicheCard && isConfigOpen && (
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
                        const niche = sc.key as CommercialCleaningType;
                        const presetParams = COMM_PRESETS[niche]?.find((pr) => pr.key === p.key)?.params;
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
              {/* Square metres slider — isolated component prevents full-page re-render on drag */}
              <CommSqmSlider
                value={S.paramsByService.cleaning?.sqm ?? COMM_PRESETS[sc.key as CommercialCleaningType]?.[0]?.params?.sqm ?? 300}
                onChange={(sqm) => set('paramsByService', {
                  ...S.paramsByService,
                  cleaning: { ...(S.paramsByService.cleaning || {}), sqm },
                })}
              />
              {/* Features covered */}
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-700">Included</div>
                <div className="flex flex-wrap gap-1.5">
                  {(COMM_FEATURES[sc.key as CommercialCleaningType] || []).map((feature) => (
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
                  {(COMM_STANDARDS[sc.key as CommercialCleaningType] || []).map((std) => (
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
          <div
            data-card-interactive="true"
            className="min-w-0 w-full overflow-hidden"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <WindowsEditor S={S} setMany={setMany} notifyDelta={notifyDelta} />
          </div>
        )}

        {S.service === 'auto' && isActive && (
          <div
            data-card-interactive="true"
            className="rounded-2xl bg-slate-900 overflow-hidden"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            {/* Rego Lookup Section */}
            <div className="p-4 border-b border-white/10">
              <RegoLookupAssistant
                selectedCategory={carSelector.carType}
                detectedVehicle={S.carDetectedVehicle}
                onVehicleChange={(vehicle) => set('carDetectedVehicle', vehicle)}
                onSelectCategory={(category) => {
                  carSelector.setCarType(category);
                  const sizeMap: Record<string, number> = {
                    hatch: 1, sedan: 2, suv: 3, ute: 4, van: 5, '4wd': 6, luxury: 2, muscle: 2,
                  };
                  set('paramsByService', {
                    ...S.paramsByService,
                    auto: { ...S.paramsByService.auto, vehicle_size: sizeMap[category] || 2 },
                  });
                }}
                onVehicleDetected={(_vehicle, classification) => {
                  if (classification.sizeCategory) {
                    set('carDetectedSizeCategory', classification.sizeCategory);
                  }
                  set('carDetectedYear', typeof _vehicle.year === 'number' ? _vehicle.year : null);
                }}
              />
            </div>

            {/* Car Type Selection */}
            <div className="p-4 border-b border-white/10">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">
                Select vehicle type
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(['hatch', 'sedan', 'suv', 'ute', 'van', '4wd', 'luxury', 'muscle'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      carSelector.setCarType(type);
                      const sizeMap: Record<string, number> = {
                        hatch: 1, sedan: 2, suv: 3, ute: 4, van: 5, '4wd': 6, luxury: 2, muscle: 2,
                      };
                      set('paramsByService', {
                        ...S.paramsByService,
                        auto: { ...S.paramsByService.auto, vehicle_size: sizeMap[type] || 2 },
                      });
                    }}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                      carSelector.carType === type
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white/10 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    {type === '4wd' ? '4WD' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Interior Config */}
            <div className="p-4 border-b border-white/10">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-3">
                Interior details
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-400 mb-2">Seat rows</div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          set('paramsByService', {
                            ...S.paramsByService,
                            auto: { ...S.paramsByService.auto, rows: n },
                          });
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          (S.paramsByService.auto?.rows || 2) === n
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 mb-2">Child seats</div>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          set('paramsByService', {
                            ...S.paramsByService,
                            auto: { ...S.paramsByService.auto, child_seats: n },
                          });
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          (S.paramsByService.auto?.child_seats || 0) === n
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Condition */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Current condition
                </div>
                <div className="text-xs font-medium text-emerald-400">
                  {carSelector.dirtLevel === 0 ? 'Clean' : carSelector.dirtLevel < 0.4 ? 'Light dirt' : carSelector.dirtLevel < 0.7 ? 'Moderate' : 'Heavy'}
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={carSelector.dirtLevel}
                onChange={(e) => carSelector.setDirtLevel(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>Clean</span>
                <span>Heavy</span>
              </div>
            </div>

            {/* Focus Zones Selection */}
            <div className="p-4">
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  Any areas to focus on? <span className="text-slate-500">(optional)</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { zone: 'hood', label: 'Hood', icon: '🚗' },
                  { zone: 'roof', label: 'Roof', icon: '☀️' },
                  { zone: 'boot', label: 'Boot', icon: '📦' },
                  { zone: 'wheels', label: 'Wheels', icon: '🛞' },
                  { zone: 'glass', label: 'Glass', icon: '🪟' },
                  { zone: 'interior', label: 'Interior', icon: '💺' },
                ] as const).map(({ zone, label, icon }) => {
                  const isSelected = carSelector.zones.has(zone);
                  return (
                    <button
                      key={zone}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        carSelector.toggleZone(zone);
                      }}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white/10 text-slate-300 hover:bg-white/20'
                      }`}
                    >
                      <span className="text-lg">{icon}</span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Laundry Card */}
        {S.service === 'laundry_sneakers' && isLaundryCard && isActive && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/80 p-3 space-y-3"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            {/* Service type — single pre-selected pill */}
            <div>
              <div className="text-xs text-slate-500 mb-1.5">Service type</div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-3 py-1.5 text-sm">
                <span>Wash &amp; Fold</span>
                <span className="text-emerald-100 text-xs">$30/load</span>
              </span>
            </div>

            {/* Load counter */}
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-700">How many loads? <span className="text-xs text-slate-500">(~5kg each)</span></span>
              <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                <button
                  type="button"
                  className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
                  onClick={(e) => { e.stopPropagation(); set('laundryLoads', Math.max(1, (S.laundryLoads || 1) - 1)); }}
                  aria-label="Decrease loads"
                >–</button>
                <span className="min-w-[24px] text-center font-semibold">{S.laundryLoads || 1}</span>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
                  onClick={(e) => { e.stopPropagation(); set('laundryLoads', Math.min(10, (S.laundryLoads || 1) + 1)); }}
                  aria-label="Increase loads"
                >+</button>
              </div>
            </div>

            {/* Add-ons */}
            <div>
              <div className="text-xs text-slate-500 mb-1.5">Add-ons <span className="text-slate-400">(optional)</span></div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(LAUNDRY_PER_LOAD_ADDONS) as [LaundryPerLoadAddOn, { label: string; price: number }][]).map(([key, meta]) => {
                  const active = (S.laundryPerLoadAddOns ?? []).includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const current = S.laundryPerLoadAddOns ?? [];
                        set('laundryPerLoadAddOns', active ? current.filter((k) => k !== key) : [...current, key]);
                      }}
                      className={cls(
                        'rounded-full border px-2.5 py-1 text-xs flex items-center gap-1',
                        active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10 hover:border-emerald-300',
                      )}
                    >
                      {meta.label}
                      <span className={active ? 'text-emerald-100' : 'text-slate-400'}>+${meta.price}/load</span>
                    </button>
                  );
                })}
                {(Object.entries(LAUNDRY_PER_ORDER_ADDONS) as [LaundryPerOrderAddOn, { label: string; price: number }][]).map(([key, meta]) => {
                  const active = (S.laundryPerOrderAddOns ?? []).includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const current = S.laundryPerOrderAddOns ?? [];
                        set('laundryPerOrderAddOns', active ? current.filter((k) => k !== key) : [...current, key]);
                      }}
                      className={cls(
                        'rounded-full border px-2.5 py-1 text-xs flex items-center gap-1',
                        active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10 hover:border-emerald-300',
                      )}
                    >
                      {meta.label}
                      <span className={active ? 'text-emerald-100' : 'text-slate-400'}>+${meta.price}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ironing toggle */}
            <div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLaundryIroningOpen((v) => !v); }}
                className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
              >
                <span>{laundryIroningOpen ? '▼' : '▶'}</span>
                <span>Add ironing items</span>
              </button>
              {laundryIroningOpen && (
                <div className="mt-2 space-y-2">
                  {(Object.entries(LAUNDRY_IRONING_PRICES) as [IroningItemType, { label: string; price: number }][]).map(([type, meta]) => {
                    const item = (S.laundryIroningItems ?? []).find((i) => i.type === type);
                    const count = item?.count ?? 0;
                    const setCount = (n: number) => {
                      const items: IroningItem[] = (S.laundryIroningItems ?? []).filter((i) => i.type !== type);
                      if (n > 0) items.push({ type, count: n });
                      set('laundryIroningItems', items);
                    };
                    return (
                      <div key={type} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-700">{meta.label} <span className="text-slate-400">${meta.price}/item</span></span>
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-1.5 py-0.5">
                          <button
                            type="button"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10 hover:bg-slate-50 text-[11px]"
                            onClick={(e) => { e.stopPropagation(); setCount(Math.max(0, count - 1)); }}
                            aria-label={`Decrease ${meta.label}`}
                          >–</button>
                          <span className="min-w-[20px] text-center font-semibold">{count}</span>
                          <button
                            type="button"
                            className="w-5 h-5 flex items-center justify-center rounded-full border border-black/10 hover:bg-slate-50 text-[11px]"
                            onClick={(e) => { e.stopPropagation(); setCount(count + 1); }}
                            aria-label={`Increase ${meta.label}`}
                          >+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live estimated total */}
            {laundryAddOnTotal > 0 && (
              <div className="text-xs text-slate-600 font-medium">
                Estimated: {priceLabelBase} <span className="text-slate-400">(excl. fees)</span>
              </div>
            )}

            {/* Footer notes */}
            <div className="text-[11px] text-slate-500 space-y-0.5">
              <div>Minimum service $60 (pickup &amp; delivery for up to 2 loads) · fees shown at checkout</div>
              <div>Loads are ~5kg each. Overweight or bulky items may count as an extra load — we&apos;ll confirm any changes before washing.</div>
            </div>
          </div>
        )}

        {/* Sneaker Care Card - Tier Selector */}
        {S.service === 'laundry_sneakers' && isSneakerCareCard && isActive && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/80 p-3 space-y-2"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <div className="text-sm font-semibold text-slate-900">Care level</div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'refresh', label: 'Refresh Clean', price: '$40' },
                { key: 'deep',    label: 'Deep Restore',  price: '$60' },
                { key: 'multi',   label: 'Multi-Pair',    price: 'from $40' },
              ].map((tier) => (
                <button
                  key={tier.key}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); set('sneakerTier', tier.key as any); }}
                  className={cls(
                    'rounded-full border px-3 py-1.5 text-sm flex items-center gap-2',
                    S.sneakerTier === tier.key
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white border-black/10 hover:border-emerald-300',
                  )}
                >
                  <span>{tier.label}</span>
                  <span className={cls('text-xs', S.sneakerTier === tier.key ? 'text-emerald-100' : 'text-slate-500')}>
                    {tier.price}
                  </span>
                </button>
              ))}
            </div>

            {/* Multi-pair count picker */}
            {S.sneakerTier === 'multi' && (
              <div>
                <div className="text-xs text-slate-500 mb-1.5">How many pairs?</div>
                <div className="flex flex-wrap gap-1.5">
                  {SNEAKER_MULTI_PRICING.map((opt) => (
                    <button
                      key={opt.pairs}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); set('sneakerPairCount', opt.pairs); }}
                      className={cls(
                        'rounded-full border px-2.5 py-1 text-xs flex items-center gap-1',
                        (S.sneakerPairCount ?? 3) === opt.pairs
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white border-black/10 hover:border-emerald-300',
                      )}
                    >
                      {opt.popular && <span>⭐</span>}
                      <span>{opt.pairs} {opt.pairs === 1 ? 'pair' : 'pairs'}</span>
                      <span className={cls('ml-0.5', (S.sneakerPairCount ?? 3) === opt.pairs ? 'text-emerald-100' : 'text-slate-400')}>
                        {fmtAUD(opt.price)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[11px] text-slate-600 space-y-0.5">
              <div>
                {S.sneakerTier === 'refresh' && 'Quick cosmetic refresh for lightly worn pairs.'}
                {S.sneakerTier === 'deep' && 'Full restoration for noticeably dirty or worn pairs.'}
                {S.sneakerTier === 'multi' && 'Best value when cleaning 3 or more pairs at once.'}
              </div>
              <div>Fees shown at checkout</div>
            </div>
          </div>
        )}

        {/* Sneaker Care Card - Turnaround Selector */}
        {S.service === 'laundry_sneakers' && isSneakerCareCard && isActive && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/80 p-3 space-y-2"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <div className="text-sm font-semibold text-slate-900">Turnaround speed</div>
            <div className="flex flex-wrap gap-2">
              {SNEAKER_TURNAROUND_META.map((t) => {
                const available = isSneakerTurnaroundAvailable(t.key);
                const isActiveTurnaround = S.sneakerTurnaround === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    disabled={!available}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (available) set('sneakerTurnaround', t.key);
                    }}
                    className={cls(
                      'rounded-full border px-3 py-1 text-sm',
                      isActiveTurnaround ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10',
                      !available && !isActiveTurnaround ? 'opacity-50 cursor-not-allowed' : ''
                    )}
                    title={`${t.window}${t.surcharge ? ` · +$${t.surcharge}/pair` : ''}`}
                  >
                    {t.label} — {t.window}
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-slate-600">
              Standard is best value; Express and Priority reduce turnaround with limited slots.
            </div>
          </div>
        )}

        {isDumpRunsCard && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/80 p-3"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <div className="flex items-center justify-between text-sm">
              <div className="font-semibold text-slate-900">Add Details</div>
              <div className="text-[11px] text-slate-600">Adjusts time & cost</div>
            </div>
            <div className="mt-3 space-y-2 text-xs text-slate-700">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'single_item',  label: 'Single item' },
                  { key: 'ute',          label: 'Ute load' },
                  { key: 'half_trailer', label: 'Half trailer' },
                  { key: 'trailer',      label: 'Trailer full' },
                  { key: 'bulky',        label: 'Bulky furniture' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'px-3 py-1 rounded-full border text-sm',
                      dumpLoadType === c.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateDumpRun({
                        loadType: c.key as
                          | 'single_item'
                          | 'ute'
                          | 'half_trailer'
                          | 'trailer'
                          | 'bulky',
                      });
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-700">Number of loads</span>
                <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = Math.max(1, Math.min(6, dumpLoads - 1));
                      updateDumpRun({ loads: next });
                    }}
                    aria-label="Decrease loads"
                  >
                    –
                  </button>
                  <span className="min-w-[24px] text-center font-semibold">{dumpLoads}</span>
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = Math.max(1, Math.min(6, dumpLoads + 1));
                      updateDumpRun({ loads: next });
                    }}
                    aria-label="Increase loads"
                  >
                    +
                  </button>
                </div>
              </div>
              {dumpHints && (
                <div className="text-[11px] text-slate-600 space-y-1">
                  <div>{dumpHints.line1}</div>
                  <div>{dumpHints.line2}</div>
                  <div>{dumpHints.line3}</div>
                </div>
              )}
            </div>
          </div>
        )}
        {isDeliveryCard && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/90 p-4 shadow-sm space-y-4"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <div>
              <div className="font-semibold text-slate-900">Delivery Details</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Tell us what you need delivered</div>
            </div>

            {/* Step 1: What + how many */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">1</span>
                What are you delivering?
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: 'parcel', label: 'Small box / parcel', desc: 'Fits in a car', icon: '📦' },
                  { key: 'household', label: 'Household item', desc: 'Chair, table, etc.', icon: '🪑' },
                  { key: 'mattress', label: 'Mattress / bed', desc: 'Weather protected', icon: '🛏️' },
                  { key: 'groceries', label: 'Groceries', desc: 'Kept shaded', icon: '🛒' },
                  { key: 'tools', label: 'Tools / equipment', desc: 'Secured transport', icon: '🔧' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'p-3 rounded-lg border text-left transition-all',
                      deliveryType === c.key
                        ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400'
                        : 'border-black/10 bg-white hover:bg-slate-50'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateDelivery({ itemType: c.key as DeliverySelection['itemType'] });
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{c.icon}</span>
                      <div>
                        <div className="text-xs font-medium text-slate-800">{c.label}</div>
                        <div className="text-[10px] text-slate-500">{c.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {/* Quantity */}
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-[11px] text-slate-700">How many items?</span>
                <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
                    onClick={(e) => { e.stopPropagation(); setDeliveryItemQty((n) => Math.max(1, n - 1)); }}
                    aria-label="Decrease quantity"
                  >–</button>
                  <span className="min-w-[24px] text-center font-semibold text-sm">{deliveryItemQty}</span>
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
                    onClick={(e) => { e.stopPropagation(); setDeliveryItemQty((n) => Math.min(20, n + 1)); }}
                    aria-label="Increase quantity"
                  >+</button>
                </div>
              </div>
              {/* Lifting help */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[
                  { key: 'no_help', label: 'No help needed', desc: 'I can load/unload myself', icon: '👤' },
                  { key: 'need_help', label: 'Need help', desc: 'Extra hands for lifting', icon: '👥', extra: '+$25–50' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'p-2.5 rounded-lg border text-left transition-all',
                      deliveryAssist === c.key
                        ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-400'
                        : 'border-black/10 bg-white hover:bg-slate-50'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateDelivery({ assist: c.key as DeliverySelection['assist'] });
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span>{c.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-800">{c.label}</div>
                        <div className="text-[10px] text-slate-500">{c.desc}</div>
                      </div>
                      {c.extra && (
                        <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1 py-0.5 rounded shrink-0">{c.extra}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Extra stops + optional extras */}
            <div className="space-y-3">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">2</span>
                Any extra stops?
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-[11px] text-slate-700">Extra drop-off stops <span className="text-slate-400">(+$8 each)</span></span>
                <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
                    onClick={(e) => { e.stopPropagation(); updateDelivery({ extraStops: Math.max(0, (deliveryState.extraStops ?? 0) - 1) }); }}
                    aria-label="Decrease stops"
                  >–</button>
                  <span className="min-w-[24px] text-center font-semibold text-sm">{deliveryState.extraStops ?? 0}</span>
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded-full border border-black/10 text-[11px] hover:bg-slate-50"
                    onClick={(e) => { e.stopPropagation(); updateDelivery({ extraStops: Math.min(5, (deliveryState.extraStops ?? 0) + 1) }); }}
                    aria-label="Increase stops"
                  >+</button>
                </div>
              </div>
              <div className="space-y-1.5">
                {[
                  { key: 'priority', label: 'Priority / same-day delivery', price: '+$15', value: deliveryState.priority ?? false },
                  { key: 'stairsAtDropoff', label: 'Stairs at drop-off', price: '+$20', value: deliveryState.stairsAtDropoff ?? false },
                ].map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-black/10 bg-white cursor-pointer hover:bg-slate-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={opt.value}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateDelivery({ [opt.key]: !opt.value } as any);
                        }}
                        className="rounded border-slate-300 accent-emerald-600"
                      />
                      <span className="text-xs text-slate-800">{opt.label}</span>
                    </div>
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">{opt.price}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Live delivery price preview */}
            {deliveryType && (() => {
              const dResult = calcDeliveryQuote(deliveryState, S.distanceKm);
              if (dResult.isCustomQuote) {
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <div className="font-semibold mb-0.5">Custom quote may be required</div>
                    <div className="text-[11px]">{dResult.customQuoteReason ?? 'This job may require a custom quote based on distance or item size.'}</div>
                  </div>
                );
              }
              return (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 space-y-1">
                  <div className="text-[11px] font-semibold text-emerald-900 mb-1.5">Price breakdown</div>
                  {dResult.lineItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-700">{item.label}</span>
                      <span className="font-medium text-slate-900 tabular-nums">
                        {item.note === 'Included' ? <span className="text-slate-400">Included</span> : `$${item.amount}`}
                      </span>
                    </div>
                  ))}
                  <div className="h-px bg-emerald-200 my-1" />
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-slate-900">Total</span>
                    <span className="text-emerald-700">{fmtAUD(dResult.total)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Transparent pricing — no hidden fees</div>
                </div>
              );
            })()}

            {/* Step 3: Where to deliver */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">3</span>
                Where would you like it delivered?
              </div>
              <div className="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-3 border border-dashed border-slate-200">
                {S.dumpRouteDropoff?.address
                  ? <span className="text-emerald-700 font-medium">{S.dumpRouteDropoff.address}</span>
                  : <span>Add addresses in the route calculator to refine the distance price</span>}
              </div>
            </div>

            {/* Step 4: Route Calculator (collapsible) */}
            <div className="space-y-2">
              <button
                type="button"
                className="w-full text-left"
                onClick={(e) => { e.stopPropagation(); setRouteExpanded((v) => !v); }}
              >
                <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">4</span>
                  Route Calculator
                  {S.distanceKm > 0 && (
                    <span className="ml-1 text-emerald-600 font-semibold">{Math.round(S.distanceKm)} km</span>
                  )}
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className={cls('ml-auto text-slate-400 transition-transform duration-200', routeExpanded ? 'rotate-180' : '')}
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
              {routeExpanded && (
                <DistanceRouteConfigurator
                  S={S}
                  set={set}
                  routeLookup={routeLookup}
                  routeLookupLoading={routeLookupLoading}
                  routeLookupMessage={routeLookupMessage}
                  routeDistanceLabel={routeDistanceLabel}
                  onFocusChange={handleDistanceInputFocusChange}
                  onPlaceSelected={handleDistancePlaceSelected}
                />
              )}
            </div>
          </div>
        )}
        {isTransportCard && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/90 p-4 shadow-sm space-y-4"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <div>
              <div className="font-semibold text-slate-900">Transport & Haul Details</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Tell us about the move</div>
            </div>

            {/* Step 1: Type of move */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">1</span>
                What type of move?
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: 'house', label: 'House move', desc: 'Full home relocation', icon: '🏠', note: 'Multiple loads likely' },
                  { key: 'bedroom', label: 'Bedroom move', desc: 'Single room items', icon: '🛏️', note: '1–2 techs' },
                  { key: 'student', label: 'Student move', desc: 'Dorm/share house', icon: '🎓', note: 'Usually 1 trip' },
                  { key: 'office', label: 'Office move', desc: 'Desks & equipment', icon: '💼', note: 'Equipment protected' },
                  { key: 'event', label: 'Event pack-up', desc: 'Staging & gear', icon: '🎪', note: 'Organised staging' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'p-3 rounded-lg border text-left transition-all',
                      transportType === c.key
                        ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                        : 'border-black/10 bg-white hover:bg-slate-50'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTransport({ moveType: c.key as TransportSelection['moveType'] });
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{c.icon}</span>
                      <div>
                        <div className="text-xs font-medium text-slate-800">{c.label}</div>
                        <div className="text-[10px] text-slate-500">{c.desc}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{c.note}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Load size */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">2</span>
                How much are you moving?
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'bags', label: 'A few bags', desc: 'Small items only', icon: '🎒', price: 'From $104' },
                  { key: 'boot', label: 'Car boot load', desc: 'Boxes & small furniture', icon: '🚗', price: 'From $124' },
                  { key: 'small_load', label: 'Small load', desc: 'Bed, desk, boxes', icon: '📦', price: 'From $158' },
                  { key: 'full_move', label: 'Full move', desc: 'Complete household', icon: '🚚', price: 'From $228' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'p-3 rounded-lg border text-left transition-all',
                      transportSize === c.key
                        ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                        : 'border-black/10 bg-white hover:bg-slate-50'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTransport({ loadSize: c.key as TransportSelection['loadSize'] });
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{c.icon}</span>
                      <div className="flex-1">
                        <div className="text-xs font-medium text-slate-800">{c.label}</div>
                        <div className="text-[10px] text-slate-500">{c.desc}</div>
                      </div>
                      <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        {c.price}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Stair access */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">3</span>
                Stair access at pickup or drop-off?
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'none', label: 'No stairs', desc: 'Ground level access', icon: '✓', extra: null },
                  { key: 'one', label: 'One flight', desc: 'Single staircase', icon: '🔼', extra: '+$20' },
                  { key: 'multi', label: 'Multiple flights', desc: '2+ floors of stairs', icon: '🔼🔼', extra: '+$40' },
                  { key: 'no_lift', label: 'No lift access', desc: 'Apartment without lift', icon: '🏢', extra: '+$30' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'p-3 rounded-lg border text-left transition-all',
                      transportStairs === c.key
                        ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                        : 'border-black/10 bg-white hover:bg-slate-50'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTransport({ stairs: c.key as TransportSelection['stairs'] });
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm w-6 text-center">{c.icon}</span>
                      <div className="flex-1">
                        <div className="text-xs font-medium text-slate-800">{c.label}</div>
                        <div className="text-[10px] text-slate-500">{c.desc}</div>
                      </div>
                      {c.extra && (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          {c.extra}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 4: How many helpers? */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">4</span>
                How many helpers do you need?
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 1, label: '1 helper', desc: 'Included', extra: null },
                  { key: 2, label: '2 helpers', desc: 'Extra hands', extra: '+$60' },
                  { key: 3, label: '3 helpers', desc: 'Heavy loads', extra: '+$120' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'p-3 rounded-lg border text-left transition-all',
                      (transportState.helpers ?? 1) === c.key
                        ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-400'
                        : 'border-black/10 bg-white hover:bg-slate-50'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTransport({ helpers: c.key as 1 | 2 | 3 });
                    }}
                  >
                    <div className="text-xs font-medium text-slate-800">{c.label}</div>
                    <div className="text-[10px] text-slate-500">{c.desc}</div>
                    {c.extra && (
                      <div className="text-[10px] font-medium text-amber-600 mt-0.5">{c.extra}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional extras */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                Optional extras
              </div>
              <div className="space-y-1.5">
                {[
                  { key: 'urgent', label: 'Priority / urgent booking', price: '+$15', value: transportState.urgent ?? false },
                  { key: 'afterHours', label: 'After-hours or weekend loading', price: '+$40', value: transportState.afterHours ?? false },
                ].map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-black/10 bg-white cursor-pointer hover:bg-slate-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={opt.value}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateTransport({ [opt.key]: !opt.value } as any);
                        }}
                        className="rounded border-slate-300 accent-blue-600"
                      />
                      <span className="text-xs text-slate-800">{opt.label}</span>
                    </div>
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">{opt.price}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Live price preview */}
            {(() => {
              const tResult = calcTransportQuote(transportState, S.distanceKm);
              if (tResult.isCustomQuote) {
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <div className="font-semibold mb-0.5">Custom quote may be required</div>
                    <div className="text-[11px]">{tResult.customQuoteReason ?? 'This job may require a custom quote based on distance, access, or item size.'}</div>
                  </div>
                );
              }
              return (
                <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 space-y-1">
                  <div className="text-[11px] font-semibold text-blue-900 mb-1.5">Price breakdown</div>
                  {tResult.lineItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-700">{item.label}</span>
                      <span className="font-medium text-slate-900 tabular-nums">
                        {item.note === 'Included' ? <span className="text-slate-400">Included</span> : `$${item.amount}`}
                      </span>
                    </div>
                  ))}
                  <div className="h-px bg-blue-200 my-1" />
                  <div className="flex items-center justify-between text-[11px] font-semibold">
                    <span className="text-slate-900">Total</span>
                    <span className="text-blue-700">{fmtAUD(tResult.total)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Transparent pricing — no hidden fees</div>
                </div>
              );
            })()}

            {/* Step 5: Origin & destination display */}
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">5</span>
                Origin &amp; destination
              </div>
              <div className="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-3 border border-dashed border-slate-200">
                {S.distanceKm > 0
                  ? <span className="text-blue-700 font-medium">{Math.round(S.distanceKm)} km between locations</span>
                  : <span>Add addresses in the route calculator to refine the distance price</span>}
              </div>
            </div>

            {/* Step 6: Route Calculator (collapsible) */}
            <div className="space-y-2">
              <button
                type="button"
                className="w-full text-left"
                onClick={(e) => { e.stopPropagation(); setTransportRouteExpanded((v) => !v); }}
              >
                <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">6</span>
                  Route Calculator
                  {S.distanceKm > 0 && (
                    <span className="ml-1 text-blue-600 font-semibold">{Math.round(S.distanceKm)} km</span>
                  )}
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className={cls('ml-auto text-slate-400 transition-transform duration-200', transportRouteExpanded ? 'rotate-180' : '')}
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
              {transportRouteExpanded && (
                <DistanceRouteConfigurator
                  S={S}
                  set={set}
                  routeLookup={routeLookup}
                  routeLookupLoading={routeLookupLoading}
                  routeLookupMessage={routeLookupMessage}
                  routeDistanceLabel={routeDistanceLabel}
                  onFocusChange={handleDistanceInputFocusChange}
                  onPlaceSelected={handleDistancePlaceSelected}
                />
              )}
            </div>
          </div>
        )}
        {isBinCleans && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/90 p-4 shadow-sm"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <div className="flex items-center justify-between text-sm mb-3">
              <div className="font-semibold text-slate-900">Bin Cleaning</div>
              <div className="text-[10px] text-slate-500">Select bins &amp; frequency</div>
            </div>

            <div className="space-y-3 text-xs">
              {/* Subscription Plans */}
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="text-[11px] font-semibold text-slate-800">Choose your plan</div>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {/* Pay per clean option */}
                  <button
                    type="button"
                    className={cls(
                      'w-full p-3 rounded-xl border-2 text-left transition-all',
                      binPlan === 0
                        ? 'border-slate-400 bg-white shadow-sm'
                        : 'border-transparent bg-slate-50 hover:bg-slate-100'
                    )}
                    onClick={(e) => { e.stopPropagation(); setBinPlan(0); }}
                    aria-label="No subscription plan"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cls(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        binPlan === 0 ? 'border-slate-600' : 'border-slate-300'
                      )}>
                        {binPlan === 0 && <div className="w-2 h-2 rounded-full bg-slate-600" />}
                      </div>
                      <div>
                        <div className="text-[12px] font-medium text-slate-800">Pay per clean</div>
                        <div className="text-[10px] text-slate-500">No commitment &mdash; book when you need it</div>
                      </div>
                    </div>
                  </button>

                  {/* Household Plan */}
                  <button
                    type="button"
                    className={cls(
                      'w-full p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden',
                      binPlan === 1
                        ? 'border-emerald-500 bg-emerald-50/60 shadow-sm'
                        : 'border-transparent bg-slate-50 hover:bg-slate-100'
                    )}
                    onClick={(e) => { e.stopPropagation(); setBinPlan(1); }}
                    aria-label="Household Bin Care Plan"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cls(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                        binPlan === 1 ? 'border-emerald-600' : 'border-slate-300'
                      )}>
                        {binPlan === 1 && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[12px] font-medium text-slate-800">Household Plan</div>
                          <div className={cls(
                            'text-[12px] font-bold tabular-nums',
                            binPlan === 1 ? 'text-emerald-700' : 'text-slate-600'
                          )}>$35<span className="text-[10px] font-normal text-slate-500">/mo</span></div>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Up to 5 bins, cleaned monthly</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">+$6 per extra bin</div>
                      </div>
                    </div>
                    {binPlan === 1 && <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-500" />}
                  </button>

                  {/* Bin Care Lite */}
                  <button
                    type="button"
                    className={cls(
                      'w-full p-3 rounded-xl border-2 text-left transition-all relative overflow-hidden',
                      binPlan === 2
                        ? 'border-sky-500 bg-sky-50/60 shadow-sm'
                        : 'border-transparent bg-slate-50 hover:bg-slate-100'
                    )}
                    onClick={(e) => { e.stopPropagation(); setBinPlan(2); }}
                    aria-label="Bin Care Lite plan"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cls(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                        binPlan === 2 ? 'border-sky-600' : 'border-slate-300'
                      )}>
                        {binPlan === 2 && <div className="w-2 h-2 rounded-full bg-sky-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[12px] font-medium text-slate-800">Bin Care Lite</div>
                          <div className={cls(
                            'text-[12px] font-bold tabular-nums',
                            binPlan === 2 ? 'text-sky-700' : 'text-slate-600'
                          )}>$29<span className="text-[10px] font-normal text-slate-500">/mo</span></div>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Up to 3 bins, cleaned monthly</div>
                      </div>
                    </div>
                    {binPlan === 2 && <div className="absolute top-0 left-0 w-full h-0.5 bg-sky-500" />}
                  </button>
                </div>
              </div>

              {/* Bin selection — compact rows */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-slate-700">
                      {binPlan > 0 ? 'Which bins do you have?' : 'Select your bins'}
                    </div>
                    {binPlan > 0 && (
                      <div className="text-[10px] text-slate-500">All cleaned monthly</div>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {/* Red — General Waste */}
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-slate-800">General waste</div>
                        <div className="text-[10px] text-slate-500">Red lid</div>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                        <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Decrease red bins" onClick={(e) => { e.stopPropagation(); setRedBins(redBins - 1); }}>–</button>
                        <span className="min-w-[18px] text-center font-semibold text-[12px]">{redBins}</span>
                        <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Increase red bins" onClick={(e) => { e.stopPropagation(); setRedBins(redBins + 1); }}>+</button>
                      </div>
                      {binPlan === 0 && redBins > 0 && (
                        <div className="text-[10px] text-slate-500 tabular-nums w-10 text-right">${redBinFreq === 0 ? 25 : redBinFreq === 1 ? 18 : 20}<span className="text-slate-400">/ea</span></div>
                      )}
                    </div>
                    {redBins > 0 && binPlan === 0 && (
                      <div className="flex gap-1 mt-2 ml-6">
                        {[
                          { val: 0, label: 'One-off' },
                          { val: 1, label: 'Weekly' },
                          { val: 2, label: 'Fortnightly' },
                        ].map((opt) => (
                          <button key={opt.val} type="button" className={cls('px-2 py-0.5 rounded-full border text-[10px] transition-colors', redBinFreq === opt.val ? 'bg-red-500 text-white border-red-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')} onClick={(e) => { e.stopPropagation(); setRedBinFreq(opt.val); }} aria-label={`${opt.label} frequency for red bins`}>{opt.label}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Yellow — Recycling */}
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-yellow-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-slate-800">Recycling</div>
                        <div className="text-[10px] text-slate-500">Yellow lid</div>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                        <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Decrease yellow bins" onClick={(e) => { e.stopPropagation(); setYellowBins(yellowBins - 1); }}>–</button>
                        <span className="min-w-[18px] text-center font-semibold text-[12px]">{yellowBins}</span>
                        <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Increase yellow bins" onClick={(e) => { e.stopPropagation(); setYellowBins(yellowBins + 1); }}>+</button>
                      </div>
                      {binPlan === 0 && yellowBins > 0 && (
                        <div className="text-[10px] text-slate-500 tabular-nums w-10 text-right">${yellowBinFreq === 0 ? 20 : 15}<span className="text-slate-400">/ea</span></div>
                      )}
                    </div>
                    {yellowBins > 0 && binPlan === 0 && (
                      <div className="flex gap-1 mt-2 ml-6">
                        {[
                          { val: 0, label: 'One-off' },
                          { val: 1, label: 'Fortnightly' },
                        ].map((opt) => (
                          <button key={opt.val} type="button" className={cls('px-2 py-0.5 rounded-full border text-[10px] transition-colors', yellowBinFreq === opt.val ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')} onClick={(e) => { e.stopPropagation(); setYellowBinFreq(opt.val); }} aria-label={`${opt.label} frequency for yellow bins`}>{opt.label}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Green — Garden */}
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-slate-800">Garden waste</div>
                        <div className="text-[10px] text-slate-500">Green lid</div>
                      </div>
                      <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                        <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Decrease green bins" onClick={(e) => { e.stopPropagation(); setGreenBins(greenBins - 1); }}>–</button>
                        <span className="min-w-[18px] text-center font-semibold text-[12px]">{greenBins}</span>
                        <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Increase green bins" onClick={(e) => { e.stopPropagation(); setGreenBins(greenBins + 1); }}>+</button>
                      </div>
                      {binPlan === 0 && greenBins > 0 && (
                        <div className="text-[10px] text-slate-500 tabular-nums w-10 text-right">${greenBinFreq === 0 ? 22 : 17}<span className="text-slate-400">/ea</span></div>
                      )}
                    </div>
                    {greenBins > 0 && binPlan === 0 && (
                      <div className="flex gap-1 mt-2 ml-6">
                        {[
                          { val: 0, label: 'One-off' },
                          { val: 1, label: 'Monthly' },
                        ].map((opt) => (
                          <button key={opt.val} type="button" className={cls('px-2 py-0.5 rounded-full border text-[10px] transition-colors', greenBinFreq === opt.val ? 'bg-green-600 text-white border-green-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')} onClick={(e) => { e.stopPropagation(); setGreenBinFreq(opt.val); }} aria-label={`${opt.label} frequency for green bins`}>{opt.label}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Kitchen — Add-on */}
                  <div className={cls('px-3 py-2.5', totalWheelies === 0 && 'opacity-40')}>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded bg-amber-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="text-[11px] font-medium text-slate-800">Kitchen caddy</div>
                          <span className="text-[8px] px-1 py-px rounded bg-slate-200 text-slate-500 uppercase tracking-wide">Add-on</span>
                        </div>
                        <div className="text-[10px] text-slate-500">{totalWheelies === 0 ? 'Add a wheelie bin first' : '$7.50/ea — cleaned same visit'}</div>
                      </div>
                      {totalWheelies > 0 && (
                        <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                          <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Decrease kitchen bins" onClick={(e) => { e.stopPropagation(); setKitchenBins(kitchenBins - 1); }}>–</button>
                          <span className="min-w-[18px] text-center font-semibold text-[12px]">{kitchenBins}</span>
                          <button type="button" className="w-5 h-5 flex items-center justify-center rounded-full text-[11px] hover:bg-white" aria-label="Increase kitchen bins" onClick={(e) => { e.stopPropagation(); setKitchenBins(kitchenBins + 1); }}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bin count note for plans */}
                {binPlan > 0 && totalWheelies > 0 && (
                  <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500">
                    {totalWheelies} of {binPlan === 1 ? 5 : 3} included bins used{totalWheelies > (binPlan === 1 ? 5 : 3) ? ` — ${totalWheelies - (binPlan === 1 ? 5 : 3)} extra at $6/ea` : ''}
                  </div>
                )}
              </div>

              {/* Info footer */}
              <div className="text-[10px] text-slate-500 leading-relaxed">
                Flat rates per bin, no hidden fees. Subscriptions lock in lower rates and guarantee your spot.
                {(totalWheelies > 0 || validKitchenBins > 0) && (
                  <span className="text-slate-400"> Price updates in the bar below.</span>
                )}
              </div>
            </div>
          </div>
        )}

        {isActive && S.service === 'laundry_sneakers' && isSneakerCareCard && isSneakerRefresh && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/80 p-3"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <div className="flex items-center justify-between text-sm">
              <div className="font-semibold text-slate-900">Add sneaker details</div>
            </div>
            <div className="mt-3 space-y-2 text-xs text-slate-700">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'mesh', label: 'Mesh / knit' },
                  { key: 'leather', label: 'Leather' },
                  { key: 'synthetic', label: 'Synthetic' },
                  { key: 'suede', label: 'Suede / nubuck' },
                  { key: 'boots', label: 'Boots' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'px-3 py-1 rounded-full border text-sm',
                      refreshMaterial === c.key
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white border-black/10'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRefreshMaterial((curr) => (curr === c.key ? null : (c.key as typeof refreshMaterial)));
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'dirt', label: 'General dirt' },
                  { key: 'yellowing', label: 'Yellowing' },
                  { key: 'scuffs', label: 'Scuffs / marks' },
                  { key: 'odour', label: 'Odour' },
                  { key: 'wear', label: 'Wear & tear' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'px-3 py-1 rounded-full border text-sm',
                      refreshConcern === c.key
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white border-black/10'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRefreshConcern((curr) => (curr === c.key ? null : (c.key as typeof refreshConcern)));
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {refreshHints && (
                <div className="text-[11px] text-slate-600 space-y-1">
                  {refreshHints.map((h, i) => (
                    <div key={i}>{h}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {isActive && S.service === 'laundry_sneakers' && isSneakerCareCard && isSneakerDeep && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/80 p-3"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <div className="flex items-center justify-between text-sm">
              <div className="font-semibold text-slate-900">Add sneaker details</div>
            </div>
            <div className="mt-3 space-y-2 text-xs text-slate-700">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'light', label: 'Light wear' },
                  { key: 'noticeable', label: 'Noticeable dirt' },
                  { key: 'heavy', label: 'Heavy wear' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'px-3 py-1 rounded-full border text-sm',
                      deepSoiling === c.key
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white border-black/10'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeepSoiling(c.key as typeof deepSoiling);
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'suede', label: 'Suede / nubuck' },
                  { key: 'dyed', label: 'Dyed leather' },
                  { key: 'collectible', label: 'Collectible' },
                ].map((c) => {
                  const active = deepSensitive.has(c.key as any);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      className={cls(
                        'px-3 py-1 rounded-full border text-sm',
                        active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-black/10'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeepSensitive((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.key as any)) next.delete(c.key as any);
                          else next.add(c.key as any);
                          return next;
                        });
                      }}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              {deepHints && (
                <div className="text-[11px] text-slate-600 space-y-1">
                  {deepHints.map((h, i) => (
                    <div key={i}>{h}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {isActive && S.service === 'laundry_sneakers' && isSneakerCareCard && isSneakerMulti && (
          <div
            data-card-interactive="true"
            className="rounded-xl border border-black/5 bg-white/80 p-3"
            onClick={stopCardBubble}
            onMouseDown={stopCardBubble}
            onPointerDown={stopCardBubble}
            onTouchStart={stopCardBubble}
          >
            <div className="flex items-center justify-between text-sm">
              <div className="font-semibold text-slate-900">Add sneaker details</div>
            </div>
            <div className="mt-3 space-y-2 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-700">Pairs in this lot</span>
                <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2 py-1">
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMultiPairs((n) => Math.max(1, Math.min(10, n - 1)));
                    }}
                    aria-label="Decrease pairs"
                  >
                    –
                  </button>
                  <span className="min-w-[24px] text-center font-semibold">{multiPairs}</span>
                  <button
                    type="button"
                    className="px-2 py-0.5 rounded-full border border-black/10 text-[11px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMultiPairs((n) => Math.max(1, Math.min(10, n + 1)));
                    }}
                    aria-label="Increase pairs"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'no', label: 'Same care for all' },
                  { key: 'yes', label: 'Mix refresh + deep' },
                ].map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={cls(
                      'px-3 py-1 rounded-full border text-sm',
                      multiMixed === c.key
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white border-black/10'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMultiMixed(c.key as typeof multiMixed);
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {multiHints && (
                <div className="text-[11px] text-slate-600 space-y-1">
                  {multiHints.map((h, i) => (
                    <div key={i}>{h}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
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
