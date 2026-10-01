import React from 'react';
import { cls } from '../../utils/formatting';
import { GOOGLE_MAPS_API_KEY, QLD_BOUNDS } from '../../lib/pricing/constants';
import { isQueenslandPlace } from '../../lib/routing';
import { loadGoogleMapsOnce } from '@/map/yardMapLoader';

type Props = {
  address: string;
  onAddressChange: (address: string, suburb: string, coords?: { lat: number; lng: number }) => void;
  onClear: () => void;
};

/**
 * Google Places-backed address input for Step 3.
 * Resolves a verified street address, extracts the suburb for region validation,
 * and restricts suggestions to Queensland addresses. Manual entry remains
 * available when the provider fails; the team must confirm these addresses.
 */
export function ServiceAddressInput({ address, onAddressChange, onClear }: Props) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const autocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);
  const listenerRef = React.useRef<google.maps.MapsEventListener | null>(null);
  const preserveInputRef = React.useRef(false);

  const [inputValue, setInputValue] = React.useState(address);
  const [confirmed, setConfirmed] = React.useState(!!address);
  const [error, setError] = React.useState<string | null>(null);
  const [mapsReady, setMapsReady] = React.useState(false);
  const [manual, setManual] = React.useState(false);
  const [suburb, setSuburb] = React.useState('');
  const [postcode, setPostcode] = React.useState('');

  // Keep local input in sync when parent resets
  React.useEffect(() => {
    if (preserveInputRef.current) {
      preserveInputRef.current = false;
      return;
    }
    setInputValue(address);
    setConfirmed(!!address);
  }, [address]);

  // Inject pac-container styles once
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
        font-size: 13px !important;
      }
      .pac-item:first-child { border-top: none !important; }
      .pac-item:hover { background-color: #f3f4f6 !important; }
      .pac-item-selected, .pac-item-selected:hover { background-color: #ecfdf5 !important; }
      .pac-icon { margin-right: 10px !important; }
      .pac-item-query { font-size: 13px !important; color: #1f2937 !important; }
      .pac-matched { font-weight: 600 !important; }
    `;
    document.head.appendChild(style);
  }, []);

  // Load Maps API
  React.useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    let cancelled = false;
    loadGoogleMapsOnce({ apiKey: GOOGLE_MAPS_API_KEY, libraries: ['places'] })
      .then(() => { if (!cancelled) setMapsReady(true); })
      .catch(() => { /* Manual entry remains available if the provider fails. */ });
    return () => { cancelled = true; };
  }, []);

  // Attach autocomplete once Maps is ready
  React.useEffect(() => {
    if (manual || !mapsReady || !inputRef.current) return;
    const google = window.google;
    if (!google?.maps?.places) return;

    const bounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(QLD_BOUNDS.south, QLD_BOUNDS.west),
      new google.maps.LatLng(QLD_BOUNDS.north, QLD_BOUNDS.east)
    );

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry', 'address_components', 'place_id'],
      types: ['address'],
      componentRestrictions: { country: ['au'] },
      bounds,
      strictBounds: false,
    });

    autocompleteRef.current = autocomplete;
    listenerRef.current?.remove();
    listenerRef.current = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const formatted = place?.formatted_address?.trim();
      if (!formatted || !place?.geometry?.location) return;

      if (!isQueenslandPlace(place)) {
        setError('Please enter an address within Queensland.');
        setConfirmed(false);
        return;
      }

      // Extract suburb (locality) for region matching
      const suburb =
        place.address_components?.find((c) =>
          c.types.includes('locality') || c.types.includes('sublocality')
        )?.long_name ?? '';

      setInputValue(formatted);
      setConfirmed(true);
      setError(null);
      onAddressChange(formatted, suburb, {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      });
    });

    return () => {
      listenerRef.current?.remove();
      autocompleteRef.current = null;
    };
  }, [manual, mapsReady, onAddressChange]);

  function confirmManualAddress() {
    if (inputValue.trim().length < 5 || !suburb.trim() || !/^4\d{3}$/.test(postcode.trim())) {
      setError('Enter a street address, suburb and four-digit Queensland postcode.');
      return;
    }
    const formatted = `${inputValue.trim()}, ${suburb.trim()} QLD ${postcode.trim()}`;
    setError(null);
    setConfirmed(true);
    onAddressChange(formatted, suburb.trim());
  }

  function handleClear() {
    setInputValue('');
    setConfirmed(false);
    setError(null);
    onClear();
    inputRef.current?.focus();
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        Service address
        {confirmed && (
          <span className="ml-auto flex items-center gap-1 text-emerald-600 text-[11px] font-medium">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            {manual ? 'Entered manually' : 'Address selected'}
          </span>
        )}
      </label>

      <div className="relative">
        <input
          key={manual ? 'manual-address' : 'places-address'}
          ref={inputRef}
          aria-label={manual ? 'Street address' : 'Service address search'}
          type="text"
          value={inputValue}
          placeholder={manual ? 'Street number and street name' : 'Start typing your street address…'}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (confirmed) {
              preserveInputRef.current = true;
              setConfirmed(false);
              onClear();
            }
            setError(null);
          }}
          className={cls(
            'w-full rounded-xl border px-3 py-2.5 pr-8 text-sm text-slate-900 outline-none transition-all',
            'focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400',
            confirmed
              ? 'border-emerald-300 bg-emerald-50/40'
              : error
              ? 'border-red-300 bg-red-50/30'
              : 'border-black/10 bg-white/80'
          )}
          autoComplete="off"
        />
        {(inputValue || confirmed) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Clear address"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {!manual && (
        <button type="button" className="text-xs text-emerald-800 underline" onClick={() => {
          setManual(true);
          setConfirmed(false);
          setInputValue('');
          setError(null);
          onClear();
        }}>Enter address manually</button>
      )}

      {manual && !confirmed && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">Address lookup unavailable? Enter your Queensland address for our team to confirm.</p>
          <label className="block text-xs">Suburb
            <input aria-label="Suburb" autoComplete="address-level2" value={suburb} onChange={e => setSuburb(e.target.value)} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs">Queensland postcode
            <input aria-label="Queensland postcode" autoComplete="postal-code" inputMode="numeric" maxLength={4} value={postcode} onChange={e => setPostcode(e.target.value)} className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 text-sm" />
          </label>
          <button type="button" onClick={confirmManualAddress} className="rounded-xl bg-emerald-800 px-3 py-2 text-xs text-white">Use this address</button>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-red-600 flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
        </p>
      )}

      {!manual && !confirmed && !error && (
        <p className="text-[11px] text-slate-500">
          Select from the dropdown to confirm your address.
        </p>
      )}
    </div>
  );
}
