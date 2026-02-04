// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

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
      if (raw) dispatch({ type: 'merge', value: JSON.parse(raw) });
    } catch {}
  }, [key]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {}
    }, 200);
    return () => clearTimeout(id);
  }, [state, key]);
  return [state, dispatch] as const;
}
