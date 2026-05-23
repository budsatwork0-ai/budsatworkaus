'use client';

// -----------------------------------------------------------------------------
// Suburb Heatmap
// -----------------------------------------------------------------------------
// Module 4 — territory intelligence.
//
// Two views, one panel:
//   · "List" (default) — sorted suburb leaderboard with heat bars. Always
//     renders, never depends on Google Maps. This is the operational answer
//     to "which suburbs are heating up?".
//   · "Map" (toggle)   — Google Maps heatmap with glowing markers. Loads only
//     when a NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is present and the toggle is on.
//     Geocodes suburb names lazily and caches results in localStorage to
//     keep the quota footprint tiny.
//
// Why split it: a dependency-free leaderboard is always useful; the map adds
// spatial intuition but is not the operational source of truth.
// -----------------------------------------------------------------------------

import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { night } from '@/app/ui/theme';
import { NightPanel, NightChip, NightEmpty, NightDivider } from './NightPrimitives';
import { loadGoogleMapsOnce } from '@/map/yardMapLoader';
import { formatLeadMoney } from '../lib/leadAdapter';
import type { SuburbInsight } from '../lib/types';

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
const GEO_CACHE_KEY = 'budleads_suburb_geocache_v1';

// Brisbane/Logan defaults — map opens here when there is no data to focus on.
const DEFAULT_CENTER = { lat: -27.6479, lng: 152.9586 };

type Geocache = Record<string, { lat: number; lng: number }>;

export function SuburbHeatmap({ suburbs }: { suburbs: SuburbInsight[] }) {
  const [view, setView] = useState<'list' | 'map'>('list');
  const known = suburbs.filter((s) => s.suburb !== '— Unknown');

  if (known.length === 0) {
    return (
      <NightPanel
        title="Suburb intelligence"
        subtitle="Where leads are coming from, and where they're heating up."
      >
        <NightEmpty
          title="No suburb data yet"
          detail="Once quotes include a service address, you'll see your busiest suburbs ranked by lead density here — and an optional Google Maps heatmap on top."
        />
      </NightPanel>
    );
  }

  return (
    <NightPanel
      title="Suburb intelligence"
      subtitle="Where leads are coming from, and where they're heating up."
      right={
        GOOGLE_KEY ? (
          <div className="inline-flex rounded-full border p-0.5" style={{ borderColor: night.border, background: 'rgba(255,255,255,0.02)' }}>
            <ViewToggle active={view === 'list'} onClick={() => setView('list')}>List</ViewToggle>
            <ViewToggle active={view === 'map'} onClick={() => setView('map')}>Map</ViewToggle>
          </div>
        ) : (
          <NightChip>List view only — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable map</NightChip>
        )
      }
    >
      {view === 'list' || !GOOGLE_KEY ? (
        <SuburbList suburbs={known} />
      ) : (
        <SuburbMap suburbs={known} />
      )}
    </NightPanel>
  );
}

// ---- List view --------------------------------------------------------------

function SuburbList({ suburbs }: { suburbs: SuburbInsight[] }) {
  // Cap to top 12 for visual breathing room; show "+N more" footer if truncated.
  const visible = suburbs.slice(0, 12);
  return (
    <ul className="flex flex-col gap-2" role="list">
      {visible.map((row, idx) => {
        const widthPct = Math.max(6, Math.round(row.heat * 100));
        return (
          <li key={row.suburb} className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums"
                  style={{ background: 'rgba(255,255,255,0.04)', color: night.muted, border: `1px solid ${night.border}` }}
                >
                  {idx + 1}
                </span>
                <span className="truncate text-sm font-semibold" style={{ color: night.text }}>{row.suburb}</span>
                {row.hotLeads > 0 ? (
                  <NightChip tone="hot">{row.hotLeads} hot</NightChip>
                ) : null}
                {row.bookedJobs > 0 ? (
                  <NightChip tone="accent">{row.bookedJobs} booked</NightChip>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums" style={{ color: night.text }}>
                  {row.activeLeads + row.bookedJobs}
                </p>
                <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: night.subtle }}>
                  {row.revenue > 0 ? formatLeadMoney(row.revenue) : 'leads'}
                </p>
              </div>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${widthPct}%` }}
                transition={{ duration: 0.7, delay: idx * 0.04, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{
                  background: row.hotLeads > 0
                    ? `linear-gradient(90deg, ${night.accent}, ${night.hot})`
                    : `linear-gradient(90deg, ${night.accent}, ${night.cold})`,
                  boxShadow: row.hotLeads > 0 ? `0 0 12px ${night.hot}55` : `0 0 8px ${night.accent}55`,
                }}
              />
            </div>
          </li>
        );
      })}
      {suburbs.length > 12 ? (
        <li>
          <NightDivider className="my-2" />
          <p className="text-center text-[11px]" style={{ color: night.subtle }}>
            + {suburbs.length - 12} more suburbs with active leads
          </p>
        </li>
      ) : null}
    </ul>
  );
}

// ---- Map view (lazy) --------------------------------------------------------

function SuburbMap({ suburbs }: { suburbs: SuburbInsight[] }) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadGeocache = useCallback((): Geocache => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(GEO_CACHE_KEY);
      return raw ? (JSON.parse(raw) as Geocache) : {};
    } catch {
      return {};
    }
  }, []);

  const persistGeocache = useCallback((cache: Geocache) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // localStorage may be unavailable; safe to ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!mapDivRef.current || !GOOGLE_KEY) return;

    setStatus('loading');
    setErrorMessage(null);

    (async () => {
      try {
        // Geocoder lives in the core Maps API — only 'visualization' needs to be
        // listed explicitly for HeatmapLayer.
        const google = await loadGoogleMapsOnce({ apiKey: GOOGLE_KEY, libraries: ['visualization'] });
        if (cancelled || !mapDivRef.current) return;

        // Dark, minimal map style — cinematic territory feel.
        const map = new google.maps.Map(mapDivRef.current, {
          center: DEFAULT_CENTER,
          zoom: 10,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
          styles: NIGHT_MAP_STYLES,
          backgroundColor: night.bg,
        });

        // Geocode each suburb (cached). Append ", Australia" to nudge results
        // towards the right country.
        const cache = loadGeocache();
        const geocoder = new google.maps.Geocoder();
        const points: Array<{ row: SuburbInsight; lat: number; lng: number }> = [];

        for (const row of suburbs) {
          const key = row.suburb.toLowerCase();
          let coords = cache[key];
          if (!coords) {
            try {
              const result = await geocoder.geocode({ address: `${row.suburb}, Australia` });
              const top = result.results?.[0]?.geometry?.location;
              if (top) {
                coords = { lat: top.lat(), lng: top.lng() };
                cache[key] = coords;
              }
            } catch {
              // Skip this one — caller's quota or unknown suburb.
            }
          }
          if (coords) points.push({ row, lat: coords.lat, lng: coords.lng });
          if (cancelled) return;
        }
        persistGeocache(cache);
        if (cancelled || !mapDivRef.current) return;

        if (points.length === 0) {
          setErrorMessage('Could not geocode any suburbs — they may need more specific addresses.');
          setStatus('error');
          return;
        }

        // Heatmap layer — uses lead+hot weight.
        const heatmapData = points.map((p) => ({
          location: new google.maps.LatLng(p.lat, p.lng),
          weight: p.row.activeLeads + p.row.hotLeads * 2 + p.row.bookedJobs,
        }));

        new google.maps.visualization.HeatmapLayer({
          data: heatmapData,
          radius: 38,
          opacity: 0.85,
          gradient: HEAT_GRADIENT,
          map,
        });

        // Glowing markers on hot suburbs.
        points
          .filter((p) => p.row.hotLeads > 0 || p.row.bookedJobs > 0)
          .forEach((p) => {
            const isHot = p.row.hotLeads > 0;
            new google.maps.Marker({
              position: { lat: p.lat, lng: p.lng },
              map,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: isHot ? night.hot : night.accent,
                fillOpacity: 0.9,
                strokeColor: '#fff',
                strokeWeight: 1.2,
                scale: 6 + Math.min(8, p.row.activeLeads + p.row.bookedJobs),
              },
              title: `${p.row.suburb} — ${p.row.activeLeads} active · ${p.row.bookedJobs} booked`,
            });
          });

        // Fit bounds to the geocoded suburbs.
        const bounds = new google.maps.LatLngBounds();
        for (const p of points) bounds.extend({ lat: p.lat, lng: p.lng });
        map.fitBounds(bounds, 64);

        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load Google Maps.');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [suburbs, loadGeocache, persistGeocache]);

  return (
    <div className="relative">
      <div
        ref={mapDivRef}
        className="h-[420px] w-full overflow-hidden rounded-2xl border"
        style={{ borderColor: night.border, background: '#020806' }}
      />
      {status === 'loading' ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(7,16,12,0.6)' }}>
          <p className="text-sm" style={{ color: night.muted }}>Loading map and geocoding suburbs…</p>
        </div>
      ) : null}
      {status === 'error' ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl px-6 text-center" style={{ background: 'rgba(7,16,12,0.85)' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#FFD089' }}>Map unavailable</p>
            <p className="mt-1 text-xs" style={{ color: night.muted }}>{errorMessage}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
      style={{
        background: active ? 'rgba(28,124,84,0.18)' : 'transparent',
        color: active ? '#7CE0B0' : night.muted,
      }}
    >
      {children}
    </button>
  );
}

// ---- Map styling -----------------------------------------------------------

// Compact night-mode style. Tuned to match the dashboard's #07100C surface.
// Reference: Google Maps Styling Wizard reduced-detail dark theme.
const NIGHT_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0E1B16' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9FB4A8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#07100C' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#11241D' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#7CE0B0' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#0F1F19' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6B7F75' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#040A07' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4FA5FF' }] },
];

// Heatmap gradient — cold to hot, on-brand. First entry must be transparent.
const HEAT_GRADIENT = [
  'rgba(0, 0, 0, 0)',
  'rgba(79, 165, 255, 0.4)',
  'rgba(79, 165, 255, 0.7)',
  'rgba(28, 124, 84, 0.85)',
  'rgba(124, 224, 176, 0.95)',
  'rgba(245, 185, 69, 1)',
  'rgba(255, 138, 120, 1)',
  'rgba(255, 90, 69, 1)',
];
