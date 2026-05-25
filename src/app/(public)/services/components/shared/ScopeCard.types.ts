import type { Dispatch, SetStateAction } from 'react';
import type { WizardState, RouteLookupResult, SneakerTurnaround } from '../../types';
import type { useCarModelSelector } from '@/app/ui/car/useCarModelSelector';

export type RouteSlot = {
  expanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  transportExpanded: boolean;
  setTransportExpanded: Dispatch<SetStateAction<boolean>>;
  lookup: RouteLookupResult | null;
  loading: boolean;
  message: string | null;
  distanceLabel: string | null;
  onFocusChange: (focused: boolean) => void;
  onPlaceSelected: () => void;
};

export type LaundrySlot = {
  ironingOpen: boolean;
  setIroningOpen: Dispatch<SetStateAction<boolean>>;
  addOnTotal: number;
  priceLabel: string;
  isTurnaroundAvailable: (key: SneakerTurnaround) => boolean;
};

export type ScopeCardProps = {
  S: WizardState;
  sc: any;
  isActive: boolean;
  onSelect: (key: string) => void;
  onAdd: (key: string) => void;
  hookText: string;
  className?: string;
  activeServiceId: string | null;
  setActiveServiceId: Dispatch<SetStateAction<string | null>>;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  setMany: (values: Partial<WizardState>) => void;
  setHasInteractedStep2: Dispatch<SetStateAction<boolean>>;
  openChecklists: Record<string, boolean>;
  setOpenChecklists: Dispatch<SetStateAction<Record<string, boolean>>>;
  notifyDelta: (prevMin: number, nextMin: number) => void;
  conditionMult: number;
  carSelector: ReturnType<typeof useCarModelSelector>;
  routeSlot: RouteSlot;
  laundrySlot: LaundrySlot;
};

export function scopeCardPropsAreEqual(prev: ScopeCardProps, next: ScopeCardProps): boolean {
  // Always re-render if scope selection or activity changes
  if (prev.isActive !== next.isActive) return false;
  if (prev.sc.key !== next.sc.key) return false;
  if (prev.activeServiceId !== next.activeServiceId) return false;
  if (prev.hookText !== next.hookText) return false;
  if (prev.className !== next.className) return false;

  // Wizard state fields that affect all cards
  if (prev.S.service !== next.S.service) return false;
  if (prev.S.scope !== next.S.scope) return false;
  if (prev.S.context !== next.S.context) return false;
  if (prev.S.conditionLevel !== next.S.conditionLevel) return false;

  // Service-specific state — only check what this card's service uses
  const svc = next.S.service;
  if (svc === 'cleaning') {
    if (prev.S.paramsByService.cleaning !== next.S.paramsByService.cleaning) return false;
    if (prev.S.cleaningAddons !== next.S.cleaningAddons) return false;
    if (prev.S.commercialCleaningType !== next.S.commercialCleaningType) return false;
    if (prev.S.commPreset !== next.S.commPreset) return false;
    if (prev.S.commFrequency !== next.S.commFrequency) return false;
    if (prev.conditionMult !== next.conditionMult) return false;
  }
  if (svc === 'windows') {
    if (prev.S.winRows !== next.S.winRows) return false;
    if (prev.S.paramsByService.windows !== next.S.paramsByService.windows) return false;
  }
  if (svc === 'dump') {
    if (prev.S.dumpRun !== next.S.dumpRun) return false;
    if (prev.S.dumpDelivery !== next.S.dumpDelivery) return false;
    if (prev.S.dumpTransport !== next.S.dumpTransport) return false;
    if (prev.S.paramsByService.dump !== next.S.paramsByService.dump) return false;
    if (prev.routeSlot !== next.routeSlot) return false;
    if (prev.S.distanceKm !== next.S.distanceKm) return false;
  }
  if (svc === 'auto') {
    if (prev.carSelector !== next.carSelector) return false;
    if (prev.S.paramsByService.auto !== next.S.paramsByService.auto) return false;
    if (prev.S.carDetectedVehicle !== next.S.carDetectedVehicle) return false;
  }
  if (svc === 'laundry_sneakers') {
    if (prev.S.laundryLoads !== next.S.laundryLoads) return false;
    if (prev.S.laundryPerLoadAddOns !== next.S.laundryPerLoadAddOns) return false;
    if (prev.S.laundryPerOrderAddOns !== next.S.laundryPerOrderAddOns) return false;
    if (prev.S.laundryIroningItems !== next.S.laundryIroningItems) return false;
    if (prev.S.sneakerTier !== next.S.sneakerTier) return false;
    if (prev.S.sneakerPairCount !== next.S.sneakerPairCount) return false;
    if (prev.S.sneakerTurnaround !== next.S.sneakerTurnaround) return false;
    if (prev.laundrySlot !== next.laundrySlot) return false;
  }
  if (svc === 'yard') {
    if (prev.S.paramsByService.yard !== next.S.paramsByService.yard) return false;
    if (prev.S.yardArea !== next.S.yardArea) return false;
    if (prev.conditionMult !== next.conditionMult) return false;
  }

  // Checklist open state for this card's key
  const key = next.sc.key;
  if ((prev.openChecklists[key] ?? false) !== (next.openChecklists[key] ?? false)) return false;

  // All stable — skip re-render
  return true;
}
