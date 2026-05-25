'use client';

import { AnimatePresence } from 'framer-motion';
import type { WizardState } from '../../types';
import { M } from '../../utils/motion';
import type { LaundrySlot, RouteSlot } from './ScopeCard.types';
import type { useCarModelSelector } from '@/app/ui/car/useCarModelSelector';
import { WindowsServicePanel } from './WindowsServicePanel';
import { CarDetailingPanel } from './CarDetailingPanel';
import { LaundryPanel } from './LaundryPanel';
import { SneakerCarePanel } from './SneakerCarePanel';
import { DumpRunsPanel } from './DumpRunsPanel';
import { DeliveryPanel } from './DeliveryPanel';
import { TransportPanel } from './TransportPanel';
import { BinCleansPanel } from './BinCleansPanel';

interface ServiceDetailRouterProps {
  S: WizardState;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  setMany: (values: Partial<WizardState>) => void;
  notifyDelta: (prevMin: number, nextMin: number) => void;
  isActive: boolean;
  isLaundryCard: boolean;
  isSneakerCareCard: boolean;
  isDumpRunsCard: boolean;
  isDeliveryCard: boolean;
  isTransportCard: boolean;
  isBinCleans: boolean;
  isConfigOpen: boolean;
  scopeKey: string;
  laundrySlot: LaundrySlot;
  carSelector: ReturnType<typeof useCarModelSelector>;
  routeSlot: RouteSlot;
}

export function ServiceDetailRouter({
  S, set, setMany, notifyDelta,
  isActive, isLaundryCard, isSneakerCareCard, isDumpRunsCard, isDeliveryCard, isTransportCard, isBinCleans,
  isConfigOpen, scopeKey,
  laundrySlot, carSelector, routeSlot,
}: ServiceDetailRouterProps) {
  const { ironingOpen: laundryIroningOpen, setIroningOpen: setLaundryIroningOpen, addOnTotal: laundryAddOnTotal, priceLabel: priceLabelBase, isTurnaroundAvailable: isSneakerTurnaroundAvailable } = laundrySlot;

  const updateDumpParam = (key: string, value: number) => {
    set('paramsByService', {
      ...S.paramsByService,
      dump: { ...(S.paramsByService.dump || {}), [key]: value },
    });
  };
  const setBinPlan = (n: number) => {
    const next = Math.max(0, Math.min(2, n));
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

  return (
    <AnimatePresence>
      {isConfigOpen && (
        <M.div
          key={scopeKey + '-cta'}
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
            <DumpRunsPanel S={S} set={set} isConfigOpen={isConfigOpen} />
          )}
          {isDeliveryCard && (
            <DeliveryPanel S={S} set={set} routeSlot={routeSlot} />
          )}
          {isTransportCard && (
            <TransportPanel S={S} set={set} routeSlot={routeSlot} />
          )}
          {isBinCleans && (
            <BinCleansPanel
              dumpParams={S.paramsByService.dump || {}}
              updateDumpParam={updateDumpParam}
              setBinPlan={setBinPlan}
            />
          )}
        </M.div>
      )}
    </AnimatePresence>
  );
}
