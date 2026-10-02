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

type ConfirmationSource = 'none' | 'google' | 'manual' | 'saved';

export function ServiceAddressInput({ address, onAddressChange, onClear }: Props) {
  const inputId = React.useId();
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const autocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);
  const listenerRef = React.useRef<google.maps.MapsEventListener | null>(null);

  const [inputValue, setInputValue] = React.useState(address);
  const [confirmed, setConfirmed] = React.useState(!!address);
  const [confirmationSource, setConfirmationSource] = React.useState<ConfirmationSource>(
    address ? 'saved' : 'none'
  );
  const [error, setError] = React.useState<string | null>(null);
  const [mapsReady, setMapsReady] = React.useState(false);
  const [mapsUnavailable, setMapsUnavailable] = React.useState(!GOOGLE_MAPS_API_KEY);

  React.useEffect(() => {
    setInputValue(address);
    setConfirmed(!!address);
    setConfirmationSource((current) => {
      if (!address) return 'none';
      return current === 'google' || current === 'manual' ? current : 'saved';
    });
  }, [address]);

  React.useEffect(() => {
    const styleId = 'pac-container-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .pac-container {
        z-index: 10000 !important;
        background: rgba(255,255,255,0.98) !important;
        border-radius: 18px !important;
        box-shadow: 0 18px 50px rgba(15,23,42,0.14) !important;
        margin-top: 8px !important;
        padding: 6px !important;
        border: 1px solid rgba(15,23,42,0.08) !important;
        font-family: inherit !important;
        overflow: hidden !important;
      }
      .pac-item {
        min-height: 48px !important;
        padding: 10px 12px !important;
        margin: 2px 0 !important;
        cursor: pointer !important;
        border: 0 !important;
        border-radius: 12px !important;
        font-size: 12px !important;
        color: #64748b !important;
        line-height: 1.35 !important;
      }
      .pac-item:hover,
      .pac-item-selected,
      .pac-item-selected:hover {
        background-color: #ecfdf5 !important;
      }
      .pac-icon {
        margin: 3px 10px 0 2px !important;
        opacity: 0.65 !important;
      }
      .pac-item-query {
        font-size: 14px !important;
        font-weight: 600 !important;
        color: #0f172a !important;
      }
      .pac-matched {
        font-weight: 700 !important;
        color: #065f46 !important;
      }
      .pac-logo:after {
        margin: 7px 8px 4px !important;
        opacity: 0.7 !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  React.useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setMapsUnavailable(true);
      return;
    }

    let cancelled = false;
    loadGoogleMapsOnce({ apiKey: GOOGLE_MAPS_API_KEY, libraries: ['places'] })
      .then(() => {
        if (cancelled) return;
        setMapsReady(true);
        setMapsUnavailable(false);
      })
      .catch(() => {
        if (cancelled) return;
        setMapsUnavailable(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!mapsReady || !inputRef.current) return;
    const google = window.google;
    if (!google?.maps?.places) {
      setMapsUnavailable(true);
      return;
    }

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
        setError('That address looks outside Queensland. Please choose a Queensland address.');
        setConfirmed(false);
        setConfirmationSource('none');
        return;
      }

      const suburb =
        place.address_components?.find((component) =>
          component.types.includes('locality') || component.types.includes('sublocality')
        )?.long_name ?? '';

      setInputValue(formatted);
      setConfirmed(true);
      setConfirmationSource('google');
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
  }, [mapsReady, onAddressChange]);

  function handleClear() {
    setInputValue('');
    setConfirmed(false);
    setConfirmationSource('none');
    setError(null);
    onClear();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleManualConfirm() {
    const trimmed = inputValue.trim();
    if (trimmed.length < 5) {
      setError('Add a little more of the address first.');
      return;
    }

    setInputValue(trimmed);
    setConfirmed(true);
    setConfirmationSource('manual');
    setError(null);
    onAddressChange(trimmed, '');
  }

  if (confirmed && inputValue.trim()) {
    const verified = confirmationSource === 'google';

    return (
      <div
        className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white px-4 py-3.5 shadow-[0_8px_24px_-18px_rgba(5,150,105,0.45)]"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-slate-900">
                {verified ? 'Address found' : 'Address added'}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {verified ? 'Google verified' : 'Ready'}
              </span>
            </div>

            <div className="mt-1 break-words text-sm leading-5 text-slate-700">
              {inputValue}
            </div>
            <div className="mt-1 text-[11px] leading-4 text-slate-500">
              We&apos;ll use this to check travel and availability for your job.
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-emerald-300 hover:text-emerald-700"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/70 p-4 sm:p-5 shadow-[0_8px_26px_-22px_rgba(15,23,42,0.45)]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </span>
        <div>
          <label htmlFor={inputId} className="block text-sm font-semibold text-slate-900">
            Where should we come?
          </label>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
            Start typing the job address. We&apos;ll use it to check travel and availability.
          </p>
        </div>
      </div>

      <div className="relative mt-3">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        </span>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          value={inputValue}
          placeholder="e.g. 12 Example Street, Shailer Park"
          onChange={(event) => {
            setInputValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && mapsUnavailable) {
              event.preventDefault();
              handleManualConfirm();
            }
          }}
          className={cls(
            'w-full rounded-xl border bg-white py-3 pl-10 pr-16 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400',
            'focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20',
            error ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200 hover:border-slate-300'
          )}
          autoComplete="off"
          aria-describedby={error ? `${inputId}-error` : `${inputId}-help`}
        />
        {inputValue && (
          <button
            type="button"
            onClick={() => {
              setInputValue('');
              setError(null);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-700"
            aria-label="Clear address"
          >
            Clear
          </button>
        )}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-red-600">
          <svg className="mt-0.5 shrink-0" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          {error}
        </p>
      ) : (
        <div id={`${inputId}-help`} className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] leading-4 text-slate-500">
            {mapsUnavailable
              ? 'Address suggestions are unavailable right now — you can still enter it manually.'
              : inputValue.trim()
                ? 'Choose a suggestion below, or use the address exactly as typed.'
                : 'Start with your street number and street name.'}
          </p>

          {inputValue.trim().length >= 5 && (
            <button
              type="button"
              onClick={handleManualConfirm}
              className="text-[11px] font-semibold text-emerald-700 underline decoration-emerald-200 underline-offset-2 transition-colors hover:text-emerald-900"
            >
              Use this address
            </button>
          )}
        </div>
      )}
    </div>
  );
}
