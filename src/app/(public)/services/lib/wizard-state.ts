import React, { useEffect, useRef } from 'react';
import type { WizardState, Action } from '../types';
import { defaultParamsByService, createYardJob } from './service-helpers';
import { DEFAULT_DUMP_RUN, DEFAULT_DUMP_DELIVERY, DEFAULT_DUMP_TRANSPORT } from './pricing/constants';
import { RESET_ON_MOUNT } from './service-data';

export function getInitialState(): WizardState {
  return {
    step: 1,
    context: 'home',
    service: 'windows',
    scope: 'windows_full',
    paramsByService: defaultParamsByService(),
    cleaningAddons: {},
    distanceKm: 0,
    paidParking: false,
    tipFee: 0,
    dumpRun: { ...DEFAULT_DUMP_RUN },
    dumpDelivery: { ...DEFAULT_DUMP_DELIVERY },
    dumpTransport: { ...DEFAULT_DUMP_TRANSPORT },
    dumpRoutePickupQuery: '',
    dumpRouteDropoffQuery: '',
    dumpRoutePickup: null,
    dumpRouteDropoff: null,
    conditionLevel: 'standard',
    afterHours: false,

    sizeAdjust: 'standard',
    conditionFlat: 0,
    contractDiscount: 0,

    petHair: false,
    greaseSoap: false,
    clutterAccess: false,
    secondStorey: false,
    photosOK: false,
    preferredAvailability: [],
    yardMeasureRequested: false,
    commSecurityInduction: false,
    commClientConsumables: false,
    commPriorityNotes: '',
    commFrequency: 'none',
    commPriorityZones: [],
    commAccessNotes: '',
    commPreset: 'essential',

    selectedInclusions: {},

    winStoreys: 1,
    winRows: [{ int: 12, ext: 12, tracks: 12, screens: 12, label: 'Ground' }],
    winSessionSeg: null,

    commercialUplift: 1,
    commercialCleaningType: null,

    fullName: '',
    email: '',
    phone: '',
    address: '',
    region: '',
    companyName: '',
    abn: '',
    isBusinessExpense: false,
    notes: '',

    // Yard polygon estimate
    yardPolygon: [],
    yardArea: null,
    yardPerimeter: null,
    yardJobs: [createYardJob()],
    yardActiveJobId: null,

    // Floor plan (home cleaning)
    floorPlanLayout: '',
    floorPlanEstimate: null,

    // Car detailing 3D selector
    carModelType: 'sedan',
    carModelZones: [],
    carDirtLevel: 0,
    carModelPriceImpact: 0,
    carDetectedVehicle: null,
    carDetectedSizeCategory: null,
    carDetectedYear: null,
    sneakerTurnaround: 'standard',
    // Laundry & Sneaker Care
    laundryTier: 'wash_fold',
    laundryLoads: 1,
    laundryPerLoadAddOns: [],
    laundryPerOrderAddOns: [],
    laundryIroningItems: [],
    sneakerTier: 'deep',
    sneakerPairCount: 3,
  };
}

export function wizardReducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case 'set':
      return { ...state, [action.key]: action.value } as WizardState;
    case 'merge':
      return { ...state, ...action.value };
    case 'reset':
      return getInitialState();
    default:
      return state;
  }
}

// Migrate old localStorage data to new schema
function migrateState(stored: any): any {
  if (!stored) return stored;

  // Migrate 'sneakers' service to 'laundry_sneakers'
  if (stored.service === 'sneakers') {
    stored.service = 'laundry_sneakers';
    // Map old sneaker scopes to new unified scope
    if (stored.scope === 'sneaker_basic' || stored.scope === 'sneaker_full' || stored.scope === 'sneaker_lot') {
      const oldScope = stored.scope; // capture before overwriting
      stored.scope = 'sneaker_care';
      // Set sneakerTier based on the original scope
      if (oldScope === 'sneaker_basic') stored.sneakerTier = 'refresh';
      else if (oldScope === 'sneaker_lot') stored.sneakerTier = 'multi';
      else stored.sneakerTier = 'deep';
    }
  }

  // Migrate paramsByService if it has old 'sneakers' key
  if (stored.paramsByService?.sneakers) {
    stored.paramsByService.laundry_sneakers = stored.paramsByService.sneakers;
    delete stored.paramsByService.sneakers;
  }

  return stored;
}

export function useLocalStorageReducer<T>(key: string, reducer: React.Reducer<T, any>, init: () => T) {
  const [state, dispatch] = React.useReducer(reducer, undefined as any, init);
  useEffect(() => {
    if (RESET_ON_MOUNT) {
      try {
        localStorage.removeItem(key);
      } catch {}
      return;
    }
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        const migrated = migrateState(parsed);
        dispatch({ type: 'merge', value: migrated });
      }
    } catch {}
  }, [key]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const serialized = JSON.stringify(state);
        localStorage.setItem(key, serialized);
      } catch {
        // Serialisation or quota failure — silently skip.
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [state, key]);
  return [state, dispatch] as const;
}
