// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import type { WizardState, RouteLocation, RouteLookupResult } from '../../types';
import { cls, fmtAUD } from '../../utils/formatting';
import { GOOGLE_MAPS_API_KEY, QLD_BOUNDS, ROUTE_PER_KM_RATE } from '../../lib/pricing/constants';
import { isQueenslandPlace } from '../../lib/routing';
import { loadGoogleMapsOnce } from '@/map/yardMapLoader';

type DistanceConfiguratorProps = {
  S: WizardState;
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  routeLookup: RouteLookupResult | null;
  routeLookupLoading: boolean;
  routeLookupMessage: string | null;
  routeDistanceLabel: string | null;
  onFocusChange?: (focused: boolean) => void;
  onPlaceSelected?: () => void;
};

export const DistanceRouteConfigurator = React.memo(function DistanceRouteConfigurator({
  S,
  set,
  routeLookup,
  routeLookupLoading,
  routeLookupMessage,
  routeDistanceLabel,
  onFocusChange,
  onPlaceSelected,
}: DistanceConfiguratorProps) {
  const pickupInputRef = React.useRef<HTMLInputElement | null>(null);
  const dropoffInputRef = React.useRef<HTMLInputElement | null>(null);
  const pickupAutocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);
  const dropoffAutocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);
  const pickupListenerRef = React.useRef<google.maps.MapsEventListener | null>(null);
  const dropoffListenerRef = React.useRef<google.maps.MapsEventListener | null>(null);
  const [mapsReady, setMapsReady] = React.useState(false);
  const [mapsError, setMapsError] = React.useState<string | null>(null);
  const [pickupError, setPickupError] = React.useState<string | null>(null);
  const [dropoffError, setDropoffError] = React.useState<string | null>(null);
  const [inputs, setInputs] = React.useState({
    pickup: S.dumpRoutePickupQuery,
    dropoff: S.dumpRouteDropoffQuery,
  });
  const focusChangeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFocusChange = React.useCallback(
    (focused: boolean, delay = 0) => {
      if (!onFocusChange || typeof window === 'undefined') return;
      if (focusChangeTimerRef.current) {
        clearTimeout(focusChangeTimerRef.current);
      }
      focusChangeTimerRef.current = window.setTimeout(() => {
        onFocusChange(focused);
        focusChangeTimerRef.current = null;
      }, delay);
    },
    [onFocusChange]
  );

  React.useEffect(
    () => () => {
      if (focusChangeTimerRef.current) {
        clearTimeout(focusChangeTimerRef.current);
      }
    },
    []
  );

  // Inject styles for Google Places autocomplete dropdown
  React.useEffect(() => {
    const styleId = 'pac-container-styles';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .pac-container {
        z-index: 10000 !important;
        background-color: white !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
        margin-top: 4px !important;
        border: 1px solid rgba(0,0,0,0.1) !important;
        font-family: inherit !important;
      }
      .pac-item {
        padding: 10px 14px !important;
        cursor: pointer !important;
        border-top: 1px solid rgba(0,0,0,0.05) !important;
      }
      .pac-item:first-child {
        border-top: none !important;
      }
      .pac-item:hover {
        background-color: #f3f4f6 !important;
      }
      .pac-item-selected,
      .pac-item-selected:hover {
        background-color: #ecfdf5 !important;
      }
      .pac-icon {
        margin-right: 10px !important;
      }
      .pac-item-query {
        font-size: 14px !important;
        color: #1f2937 !important;
      }
      .pac-matched {
        font-weight: 600 !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      // Don't remove - other instances might need it
    };
  }, []);

  React.useEffect(() => {
    setInputs((prev) => ({ ...prev, pickup: S.dumpRoutePickupQuery }));
  }, [S.dumpRoutePickupQuery]);

  React.useEffect(() => {
    setInputs((prev) => ({ ...prev, dropoff: S.dumpRouteDropoffQuery }));
  }, [S.dumpRouteDropoffQuery]);

  const handleInputChange = React.useCallback((target: 'pickup' | 'dropoff', value: string) => {
    setInputs((prev) => ({ ...prev, [target]: value }));
    if (target === 'pickup') setPickupError(null);
    else setDropoffError(null);
  }, []);

  const handlePlaceSelection = React.useCallback(
    (target: 'pickup' | 'dropoff') => {
      const autocomplete =
        target === 'pickup' ? pickupAutocompleteRef.current : dropoffAutocompleteRef.current;
      if (!autocomplete) return;
      const place = autocomplete.getPlace();
      const formatted = place?.formatted_address?.trim();
      const location = place?.geometry?.location;
      if (!formatted || !location) return;
      if (!isQueenslandPlace(place)) {
        const message = 'Choose an address within Queensland.';
        if (target === 'pickup') {
          setPickupError(message);
        } else {
          setDropoffError(message);
        }
        return;
      }
      const nextLocation: RouteLocation = {
        address: formatted,
        lat: location.lat(),
        lng: location.lng(),
        placeId: place.place_id ?? undefined,
      };
      const queryKey: 'dumpRoutePickupQuery' | 'dumpRouteDropoffQuery' =
        target === 'pickup' ? 'dumpRoutePickupQuery' : 'dumpRouteDropoffQuery';
      const locationKey: 'dumpRoutePickup' | 'dumpRouteDropoff' =
        target === 'pickup' ? 'dumpRoutePickup' : 'dumpRouteDropoff';
      set(locationKey, nextLocation);
      set(queryKey, formatted);
      setInputs((prev) => ({ ...prev, [target]: formatted }));
      if (target === 'pickup') setPickupError(null);
      else setDropoffError(null);
      onPlaceSelected?.();
      triggerFocusChange(false, 100);
    },
    [set, onPlaceSelected, triggerFocusChange]
  );

  React.useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setMapsError('Autocomplete disabled until a Google Maps key is configured.');
      return;
    }
    let cancelled = false;
    loadGoogleMapsOnce({ apiKey: GOOGLE_MAPS_API_KEY, libraries: ['places'] })
      .then(() => {
        if (!cancelled) {
          setMapsReady(true);
          setMapsError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('Delivery autocomplete failed to load', err);
          setMapsError('Address suggestions unavailable right now.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!mapsReady) return;
    if (typeof window === 'undefined') return;
    const googleLib = window.google;
    if (!googleLib?.maps?.places) {
      setMapsError('Address suggestions unavailable.');
      return;
    }
    const bounds = new googleLib.maps.LatLngBounds(
      new googleLib.maps.LatLng(QLD_BOUNDS.south, QLD_BOUNDS.west),
      new googleLib.maps.LatLng(QLD_BOUNDS.north, QLD_BOUNDS.east)
    );

    const attachAutocomplete = (
      target: 'pickup' | 'dropoff',
      inputRef: React.MutableRefObject<HTMLInputElement | null>,
      listenerRef: React.MutableRefObject<google.maps.MapsEventListener | null>,
      autocompleteRef: React.MutableRefObject<google.maps.places.Autocomplete | null>
    ) => {
      if (!inputRef.current) return;
      const autocomplete = new googleLib.maps.places.Autocomplete(inputRef.current, {
        fields: ['formatted_address', 'geometry', 'address_components', 'place_id'],
        types: ['geocode'],
        componentRestrictions: { country: ['au'] },
        bounds,
        strictBounds: false,
      });
      autocompleteRef.current = autocomplete;
      listenerRef.current?.remove();
      listenerRef.current = autocomplete.addListener('place_changed', () => {
        handlePlaceSelection(target);
      });
    };

    attachAutocomplete('pickup', pickupInputRef, pickupListenerRef, pickupAutocompleteRef);
    attachAutocomplete('dropoff', dropoffInputRef, dropoffListenerRef, dropoffAutocompleteRef);

    return () => {
      pickupListenerRef.current?.remove();
      dropoffListenerRef.current?.remove();
      pickupAutocompleteRef.current = null;
      dropoffAutocompleteRef.current = null;
    };
  }, [mapsReady, handlePlaceSelection]);

  const summaryText = routeLookupLoading
    ? 'Calculating travel time…'
    : routeDistanceLabel ?? 'Add both addresses to see travel info.';

  const hasPickup = !!S.dumpRoutePickup;
  const hasDropoff = !!S.dumpRouteDropoff;
  const isComplete = hasPickup && hasDropoff && S.distanceKm > 0;

  return (
    <div
      className="rounded-xl border border-black/5 bg-white/90 p-4 shadow-sm space-y-4"
      style={{ overflow: 'visible' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Route Calculator
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Enter addresses for accurate distance-based pricing</div>
        </div>
        {isComplete && (
          <div className="flex items-center gap-2 text-emerald-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">{Math.round(S.distanceKm)} km</span>
          </div>
        )}
      </div>

      {/* Address inputs */}
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px]">A</span>
            Pickup location
            {hasPickup && (
              <svg className="w-4 h-4 text-emerald-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </label>
          <input
            ref={pickupInputRef}
            type="text"
            value={inputs.pickup}
            placeholder="Start address (Queensland only)"
            onChange={(e) => handleInputChange('pickup', e.target.value)}
            onFocus={() => triggerFocusChange(true)}
            onBlur={() => triggerFocusChange(false, 300)}
            className={cls(
              'w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none',
              hasPickup ? 'border-emerald-300 bg-emerald-50/30' : 'border-black/10 bg-white'
            )}
          />
          {pickupError && <div className="text-[11px] text-rose-500">{pickupError}</div>}
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px]">B</span>
            Drop-off location
            {hasDropoff && (
              <svg className="w-4 h-4 text-blue-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </label>
          <input
            ref={dropoffInputRef}
            type="text"
            value={inputs.dropoff}
            placeholder="Drop-off address (Queensland only)"
            onChange={(e) => handleInputChange('dropoff', e.target.value)}
            onFocus={() => triggerFocusChange(true)}
            onBlur={() => triggerFocusChange(false, 300)}
            className={cls(
              'w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none',
              hasDropoff ? 'border-blue-300 bg-blue-50/30' : 'border-black/10 bg-white'
            )}
          />
          {dropoffError && <div className="text-[11px] text-rose-500">{dropoffError}</div>}
        </div>
      </div>

      {/* Route summary */}
      <div
        className={cls(
          'p-3 rounded-lg border text-xs transition-all',
          isComplete
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : routeLookupLoading
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : 'border-dashed border-slate-200 bg-slate-50 text-slate-600'
        )}
        aria-live="polite"
      >
        <div className="flex items-center gap-2">
          {routeLookupLoading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : isComplete ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="font-medium">{summaryText}</span>
        </div>
        {isComplete && (
          <div className="mt-2 flex items-center gap-4 text-[11px]">
            <span>Distance travel fee: ~{fmtAUD(Math.round(S.distanceKm * ROUTE_PER_KM_RATE))}</span>
          </div>
        )}
      </div>

      {routeLookupMessage && (
        <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {routeLookupMessage}
        </div>
      )}
      {mapsError && (
        <div className="flex items-center gap-2 text-[11px] text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {mapsError}
        </div>
      )}
    </div>
  );
});
