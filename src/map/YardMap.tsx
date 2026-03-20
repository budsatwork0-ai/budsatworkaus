"use client";

import { loadGoogleMapsOnce } from "./yardMapLoader";
import { LatLng } from "./types";
import React from "react";

const DEFAULT_CENTER: LatLng = { lat: -27.4698, lng: 153.0251 };
const BRISBANE_BOUNDS: google.maps.LatLngBoundsLiteral = {
  // Expanded to cover Greater Brisbane incl. Logan, Ipswich, Gold Coast, Scenic Rim (Beaudesert)
  north: -26.2,
  south: -28.6,
  east: 153.8,
  west: 151.8,
};

const MAP_OPTIONS: google.maps.MapOptions = {
  mapTypeId: "hybrid",
  disableDefaultUI: true,
  clickableIcons: false,
  // "cooperative" normally: scroll page on single-touch, require two fingers to pan map.
  // We switch to "greedy" when drawing is active so mobile taps register on the map.
  gestureHandling: "cooperative",
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  zoomControl: true,
  keyboardShortcuts: false,
  zoom: 18,
  minZoom: 15,
  maxZoom: 21,
  backgroundColor: "#f8fafc",
};

const POLYGON_BASE: google.maps.PolygonOptions = {
  draggable: false,
  geodesic: true,
  strokeColor: "#0f5132",
  strokeOpacity: 1,
  strokeWeight: 2,
  fillColor: "#16a34a",
  fillOpacity: 0.22,
  zIndex: 3,
};

// Stroke weights represent the physical "width" of the job on the ground
const PERIMETER_STROKE_WEIGHTS: Record<string, number> = {
  yard_hedge: 8,   // hedges are wide — thick line
  gutter_clean: 4, // gutters are narrow — thinner line
};

function getScopePolygonOptions(scope: string): Partial<google.maps.PolygonOptions> {
  const isPerimeter = scope === "yard_hedge" || scope === "gutter_clean";
  if (isPerimeter) {
    return {
      fillOpacity: 0,
      strokeWeight: PERIMETER_STROKE_WEIGHTS[scope] ?? 4,
      strokeColor: scope === "yard_hedge" ? "#15803d" : "#0369a1",
    };
  }
  return {
    fillOpacity: 0.22,
    strokeWeight: 2,
    strokeColor: "#0f5132",
  };
}

const FRAME_EVENTS: Array<"set_at" | "insert_at" | "remove_at"> = [
  "set_at",
  "insert_at",
  "remove_at",
];

const roundCoord = (value: number) => Number(value.toFixed(7));

const normalizeCoords = (coords?: LatLng[]) =>
  (coords || [])
    .filter((c): c is LatLng => Number.isFinite(c?.lat) && Number.isFinite(c?.lng))
    .map((c) => ({ lat: Number(c.lat), lng: Number(c.lng) }));

const coordsFromPath = (path: google.maps.MVCArray<google.maps.LatLng>): LatLng[] => {
  const out: LatLng[] = [];
  for (let i = 0; i < path.getLength(); i += 1) {
    const point = path.getAt(i);
    out.push({ lat: roundCoord(point.lat()), lng: roundCoord(point.lng()) });
  }
  return out;
};

const isInIframe = () => typeof window !== "undefined" && window.parent && window.parent !== window;


type ZoneData = {
  polygon: google.maps.Polygon;
  listeners: google.maps.MapsEventListener[];
};

export type YardMapProps = {
  apiKey: string;
  mapId?: string;
  initialCenter?: LatLng;
  /** Initial zones to display. Each element is one zone's coordinate array. */
  initialZones?: LatLng[][];
  /** Deprecated single-polygon compat. Prefer initialZones. */
  initialPolygon?: LatLng[];
  onPolygonChange?: (zones: LatLng[][]) => void;
};

export default function YardMap({
  apiKey,
  mapId,
  initialCenter,
  initialZones,
  initialPolygon,
  onPolygonChange,
}: YardMapProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const mapRef = React.useRef<google.maps.Map | null>(null);
  const listenersRef = React.useRef<google.maps.MapsEventListener[]>([]);
  const didInitRef = React.useRef(false);
  const rafRef = React.useRef<number | null>(null);
  const suppressEmitRef = React.useRef(false);
  const autocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);
  const googleRef = React.useRef<typeof google | null>(null);

  // Zone management
  const zonesRef = React.useRef<ZoneData[]>([]);
  const currentScopeRef = React.useRef<string>("yard_mow");
  const pendingSetZonesRef = React.useRef<LatLng[][] | null>(null);

  // Function refs — set by the main useEffect after map init
  const emitAllZonesRef = React.useRef<(() => void) | null>(null);
  const applyZonesRef = React.useRef<((zones: LatLng[][]) => void) | null>(null);
  const removeZoneRef = React.useRef<((index: number) => void) | null>(null);

  // Custom tap-to-draw refs
  const drawingVerticesRef = React.useRef<google.maps.LatLng[]>([]);
  const vertexMarkersRef = React.useRef<google.maps.Marker[]>([]);
  const previewPolylineRef = React.useRef<google.maps.Polyline | null>(null);
  const mapClickListenerRef = React.useRef<google.maps.MapsEventListener | null>(null);

  const [searchEnabled, setSearchEnabled] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [drawingEnabled, setDrawingEnabled] = React.useState(false);
  const [vertexCount, setVertexCount] = React.useState(0);
  const [zoneCount, setZoneCount] = React.useState(0);

  const initialCenterRef = React.useRef(initialCenter);
  const initialZonesRef = React.useRef(
    initialZones ?? (initialPolygon?.length ? [initialPolygon] : undefined)
  );

  React.useEffect(() => {
    console.log("[YARD MAP] mounted");
  }, []);

  React.useEffect(() => {
    if (!containerRef.current || didInitRef.current) return undefined;
    didInitRef.current = true;

    if (!apiKey) {
      console.warn("YardMap missing Google Maps API key.");
      return undefined;
    }

    let cancelled = false;

    const cleanupListeners = () => {
      listenersRef.current.forEach((listener) => listener.remove());
      listenersRef.current = [];
    };

    // ---- Zone management functions (defined here to close over googleRef/mapRef) ----

    const emitAllZones = () => {
      if (suppressEmitRef.current) return;
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const zones = zonesRef.current.map((z) => coordsFromPath(z.polygon.getPath()));
        onPolygonChange?.(zones);
        if (isInIframe()) {
          window.parent.postMessage({ type: "YARD_POLYGON_CHANGE", zones }, "*");
        }
      });
    };
    emitAllZonesRef.current = emitAllZones;

    const attachZoneEvents = (zone: ZoneData) => {
      const path = zone.polygon.getPath();
      FRAME_EVENTS.forEach((evt) => {
        const listener = path.addListener(evt, emitAllZones);
        zone.listeners.push(listener);
        listenersRef.current.push(listener);
      });
      // Re-attach on path replacement
      const replacedListener = zone.polygon.addListener("paths_changed", () => {
        zone.listeners.forEach((l) => l.remove());
        zone.listeners = [];
        attachZoneEvents(zone);
      });
      zone.listeners.push(replacedListener);
      listenersRef.current.push(replacedListener);
    };

    const createZoneFromCoords = (coords: LatLng[]): ZoneData => {
      const map = mapRef.current!;
      const googleLib = googleRef.current!;
      const scopeOpts = getScopePolygonOptions(currentScopeRef.current);
      const poly = new googleLib.maps.Polygon({
        ...POLYGON_BASE,
        ...scopeOpts,
        map,
        editable: false,
        clickable: true,
      });
      poly.setPath(coords.map((c) => new googleLib.maps.LatLng(c.lat, c.lng)));
      const zone: ZoneData = { polygon: poly, listeners: [] };
      attachZoneEvents(zone);
      // Click to select this zone for editing
      poly.addListener("click", () => {
        zonesRef.current.forEach((z) => z.polygon.setEditable(false));
        poly.setEditable(true);
        setDrawingEnabled(false);
      });
      return zone;
    };

    const applyZones = (zones: LatLng[][]) => {
      // Remove existing zones
      zonesRef.current.forEach((z) => {
        z.listeners.forEach((l) => l.remove());
        z.polygon.setMap(null);
      });
      zonesRef.current = [];

      suppressEmitRef.current = true;
      zones.forEach((zoneCoords) => {
        const normalized = normalizeCoords(zoneCoords);
        if (normalized.length >= 3) {
          const zone = createZoneFromCoords(normalized);
          zonesRef.current.push(zone);
        }
      });
      window.requestAnimationFrame(() => {
        suppressEmitRef.current = false;
      });
      setZoneCount(zonesRef.current.length);
    };
    applyZonesRef.current = applyZones;

    const removeZone = (index: number) => {
      if (index < 0 || index >= zonesRef.current.length) return;
      const zone = zonesRef.current[index];
      zone.listeners.forEach((l) => l.remove());
      zone.polygon.setMap(null);
      zonesRef.current.splice(index, 1);
      setZoneCount(zonesRef.current.length);
      emitAllZones();
    };
    removeZoneRef.current = removeZone;

    // ---- Map initialization ----

    const initMap = (googleLib: typeof google, allowPlaces: boolean) => {
      if (cancelled) return;
      googleRef.current = googleLib;
      const map = new googleLib.maps.Map(containerRef.current!, {
        ...MAP_OPTIONS,
        center: initialCenterRef.current ?? DEFAULT_CENTER,
        mapId,
        restriction: {
          latLngBounds: BRISBANE_BOUNDS,
          strictBounds: false,
        },
      });
      mapRef.current = map;
      map.setMapTypeId(googleLib.maps.MapTypeId.HYBRID);
      map.setTilt(0);
      map.setHeading(0);
      const brisbaneBounds = new googleLib.maps.LatLngBounds(
        new googleLib.maps.LatLng(BRISBANE_BOUNDS.south, BRISBANE_BOUNDS.west),
        new googleLib.maps.LatLng(BRISBANE_BOUNDS.north, BRISBANE_BOUNDS.east)
      );
      map.fitBounds(brisbaneBounds, 0);

      const inputEl = searchInputRef.current;
      if (allowPlaces && inputEl) {
        try {
          setSearchEnabled(true);
          autocompleteRef.current = new googleLib.maps.places.Autocomplete(inputEl, {
            fields: ["geometry", "formatted_address"],
            types: ["geocode"],
            componentRestrictions: { country: ["au"] },
            bounds: brisbaneBounds,
            strictBounds: false,
          });
          autocompleteRef.current.bindTo("bounds", map);
          const listener = autocompleteRef.current.addListener("place_changed", () => {
            const place = autocompleteRef.current?.getPlace();
            const location = place?.geometry?.location;
            if (!location) return;
            map.panTo(location);
            const currentZoom = map.getZoom() ?? 18;
            map.setZoom(Math.max(currentZoom, 19));
            if (isInIframe()) {
              const address = (place?.formatted_address ?? "").trim();
              if (address) {
                window.parent.postMessage(
                  {
                    type: "YARD_ADDRESS",
                    address,
                    coords: { lat: location.lat(), lng: location.lng() },
                  },
                  "*"
                );
              }
            }
          });
          listenersRef.current.push(listener);
        } catch (err) {
          console.warn("YardMap: Autocomplete unavailable.", err);
          setSearchEnabled(false);
        }
      } else {
        setSearchEnabled(false);
      }

      // Preview polyline for in-progress drawing
      const previewLine = new googleLib.maps.Polyline({
        map,
        strokeColor: "#16a34a",
        strokeOpacity: 0.6,
        strokeWeight: 2,
        geodesic: true,
        clickable: false,
        zIndex: 4,
      });
      previewPolylineRef.current = previewLine;

      // Apply initial zones
      const initZones = initialZonesRef.current;
      if (initZones && initZones.length) {
        applyZones(initZones);
      }

      if (pendingSetZonesRef.current) {
        applyZones(pendingSetZonesRef.current);
        pendingSetZonesRef.current = null;
      }
    };

    const loadMaps = async () => {
      try {
        const googleWithPlaces = await loadGoogleMapsOnce({ apiKey, libraries: ["places"] });
        initMap(googleWithPlaces, true);
      } catch (err) {
        console.warn("YardMap: Places API unavailable, continuing without search.", err);
        if (cancelled) return;
        try {
          const googleBase = await loadGoogleMapsOnce({ apiKey, libraries: [] });
          initMap(googleBase, false);
        } catch (fatal) {
          console.error("YardMap failed to load Google Maps", fatal);
          if (!cancelled) {
            const message =
              fatal instanceof Error
                ? fatal.message
                : fatal && typeof (fatal as any)?.message === "string"
                ? (fatal as any).message
                : "Unable to load Google Maps.";
            setLoadError(message);
          }
        }
      }
    };

    loadMaps();

    return () => {
      cancelled = true;
      cleanupListeners();
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      zonesRef.current.forEach((z) => {
        z.listeners.forEach((l) => l.remove());
        z.polygon.setMap(null);
      });
      zonesRef.current = [];
      previewPolylineRef.current?.setMap(null);
      previewPolylineRef.current = null;
      mapClickListenerRef.current?.remove();
      mapClickListenerRef.current = null;
      vertexMarkersRef.current.forEach((m) => m.setMap(null));
      vertexMarkersRef.current = [];
      autocompleteRef.current = null;
    };
  }, [apiKey, mapId, onPolygonChange]);

  // --- Custom tap-to-draw helpers ---

  const clearDrawingState = React.useCallback(() => {
    vertexMarkersRef.current.forEach((m) => m.setMap(null));
    vertexMarkersRef.current = [];
    drawingVerticesRef.current = [];
    previewPolylineRef.current?.setPath([]);
    setVertexCount(0);
  }, []);

  const closeShape = React.useCallback(() => {
    const vertices = drawingVerticesRef.current;
    if (vertices.length < 3) return;

    const coords: LatLng[] = vertices.map((v) => ({
      lat: roundCoord(v.lat()),
      lng: roundCoord(v.lng()),
    }));

    // Create a new locked zone polygon and add it to the collection
    if (googleRef.current && mapRef.current) {
      const scopeOpts = getScopePolygonOptions(currentScopeRef.current);
      const poly = new googleRef.current.maps.Polygon({
        ...POLYGON_BASE,
        ...scopeOpts,
        map: mapRef.current,
        editable: false,
        clickable: true,
      });
      poly.setPath(coords.map((c) => new googleRef.current!.maps.LatLng(c.lat, c.lng)));
      const zone: ZoneData = { polygon: poly, listeners: [] };

      // Attach path-change listeners for this zone
      if (emitAllZonesRef.current) {
        const emitFn = emitAllZonesRef.current;
        FRAME_EVENTS.forEach((evt) => {
          const l = poly.getPath().addListener(evt, emitFn);
          zone.listeners.push(l);
          listenersRef.current.push(l);
        });
      }
      // Click to select for editing
      poly.addListener("click", () => {
        zonesRef.current.forEach((z) => z.polygon.setEditable(false));
        poly.setEditable(true);
        setDrawingEnabled(false);
      });

      zonesRef.current.push(zone);
    }

    emitAllZonesRef.current?.();
    clearDrawingState();
    setDrawingEnabled(false);
    setZoneCount(zonesRef.current.length);
  }, [clearDrawingState]);

  const applyDrawingMode = React.useCallback(
    (enabled: boolean) => {
      const map = mapRef.current;
      const googleLib = googleRef.current;
      if (!map || !googleLib) return;

      // Toggle gesture handling for mobile
      map.setOptions({ gestureHandling: enabled ? "greedy" : "cooperative" });

      // Remove any existing click listener
      mapClickListenerRef.current?.remove();
      mapClickListenerRef.current = null;

      if (enabled) {
        // Lock all existing zones (keep them visible, just non-editable)
        zonesRef.current.forEach((z) => z.polygon.setEditable(false));
        clearDrawingState();

        const listener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;

          const vertices = drawingVerticesRef.current;

          // Add this vertex
          vertices.push(event.latLng);
          drawingVerticesRef.current = vertices;
          setVertexCount(vertices.length);

          // Add a marker at this vertex
          const isFirst = vertices.length === 1;
          const marker = new googleLib.maps.Marker({
            position: event.latLng,
            map,
            icon: {
              path: googleLib.maps.SymbolPath.CIRCLE,
              scale: isFirst ? 8 : 6,
              fillColor: isFirst ? "#22c55e" : "#ffffff",
              fillOpacity: 1,
              strokeColor: "#0f5132",
              strokeWeight: 2,
            },
            clickable: false,
            zIndex: 5,
          });

          vertexMarkersRef.current.push(marker);

          // Update the preview polyline
          previewPolylineRef.current?.setPath(vertices);
        });

        mapClickListenerRef.current = listener;
      } else {
        clearDrawingState();
      }
    },
    [clearDrawingState, closeShape]
  );

  React.useEffect(() => {
    applyDrawingMode(drawingEnabled);
  }, [drawingEnabled, applyDrawingMode]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      // Multi-zone: set all zones at once
      if (data.type === "YARD_SET_ZONES") {
        const zones = Array.isArray(data.zones) ? data.zones : [];
        if (applyZonesRef.current) {
          applyZonesRef.current(zones);
        } else {
          pendingSetZonesRef.current = zones;
        }
        return;
      }

      // Backward compat: single polygon → treat as one zone
      if (data.type === "YARD_SET_POLYGON") {
        const coords = Array.isArray(data.coords) ? normalizeCoords(data.coords as LatLng[]) : [];
        const zones = coords.length >= 3 ? [coords] : [];
        if (applyZonesRef.current) {
          applyZonesRef.current(zones);
        } else {
          pendingSetZonesRef.current = zones;
        }
        return;
      }

      // Remove a specific zone by index
      if (data.type === "YARD_REMOVE_ZONE") {
        const index = typeof data.index === "number" ? data.index : -1;
        removeZoneRef.current?.(index);
        return;
      }

      if (data.type === "YARD_TOGGLE_DRAWING") {
        setDrawingEnabled(Boolean(data.enabled));
        return;
      }

      if (data.type === "YARD_SET_SCOPE") {
        const scope = typeof data.scope === "string" ? data.scope : "";
        currentScopeRef.current = scope;
        const opts = getScopePolygonOptions(scope);
        zonesRef.current.forEach((z) => z.polygon.setOptions(opts));
        return;
      }

      if (data.type === "YARD_GOTO_LOCATION") {
        const coords = data.coords as LatLng | undefined;
        if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return;
        const map = mapRef.current;
        if (!map) return;
        map.panTo({ lat: coords.lat, lng: coords.lng });
        const currentZoom = map.getZoom() ?? 18;
        map.setZoom(Math.max(currentZoom, 19));
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const inputEl = searchInputRef.current;
    if (!inputEl) return undefined;

    const postFocusMessage = (type: "YARD_ADDRESS_INPUT_FOCUS" | "YARD_ADDRESS_INPUT_BLUR") => {
      if (!isInIframe()) return;
      window.parent.postMessage({ type }, window.location.origin);
    };

    const onFocus = () => postFocusMessage("YARD_ADDRESS_INPUT_FOCUS");
    const onBlur = () => postFocusMessage("YARD_ADDRESS_INPUT_BLUR");

    inputEl.addEventListener("focus", onFocus);
    inputEl.addEventListener("blur", onBlur);

    return () => {
      inputEl.removeEventListener("focus", onFocus);
      inputEl.removeEventListener("blur", onBlur);
    };
  }, []);

  const drawingStatusText = () => {
    if (vertexCount === 0) return "Tap to place points on the map";
    if (vertexCount < 3) return `${vertexCount} point${vertexCount > 1 ? "s" : ""} placed — keep tapping to outline`;
    return `${vertexCount} points placed — tap "Close shape" to finish`;
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: 520,
        position: "relative",
        borderRadius: 30,
        overflow: "hidden",
        boxShadow: "0 20px 45px rgba(15,23,42,0.15)",
        background: "#f8fafc",
      }}
    >
      <div
        id="__MAP_ROOT__"
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
        }}
      />
      {loadError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
            padding: 32,
            background: "rgba(248,250,252,0.92)",
            textAlign: "center",
          }}
          role="alert"
        >
          <p style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "#0f172a" }}>
            Map unavailable
          </p>
          <p style={{ fontSize: 14, margin: 0, color: "#475569" }}>{loadError}</p>
          <p style={{ fontSize: 12, margin: 0, color: "#475569" }}>
            Please reload or try again later.
          </p>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
        }}
      >
        <input
          ref={searchInputRef}
          type="search"
          placeholder={
            loadError
              ? "Search unavailable"
              : searchEnabled
              ? "Search Brisbane, Logan, Ipswich, Gold Coast, Scenic Rim…"
              : "Search unavailable"
          }
          aria-label="Search address"
          disabled={!searchEnabled || Boolean(loadError)}
          style={{
            width: "100%",
            borderRadius: 9999,
            border: "1px solid rgba(15,23,42,0.2)",
            padding: "12px 18px",
            fontSize: 15,
            background: searchEnabled ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.6)",
            color: searchEnabled ? "#0f172a" : "rgba(15,23,42,0.5)",
            boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
          }}
        />
      </div>
      {/* Zone count badge */}
      {!drawingEnabled && (
        <div
          style={{
            position: "absolute",
            top: 68,
            left: 16,
            right: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          {zoneCount > 0 ? (
            <div
              style={{
                padding: "5px 12px",
                borderRadius: 9999,
                background: "rgba(22,163,74,0.92)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                boxShadow: "0 4px 12px rgba(15,23,42,0.15)",
              }}
            >
              {zoneCount} zone{zoneCount !== 1 ? "s" : ""} drawn
            </div>
          ) : (
            <div
              style={{
                padding: "6px 12px",
                borderRadius: 9999,
                background: "rgba(255,255,255,0.85)",
                color: "#0f5132",
                fontSize: 12,
                boxShadow: "0 4px 12px rgba(15,23,42,0.1)",
              }}
            >
              Search your address, then tap Draw
            </div>
          )}
          <button
            onClick={() => setDrawingEnabled(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 9999,
              border: "none",
              background: "#0f5132",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(15,81,50,0.35)",
              whiteSpace: "nowrap",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Draw
          </button>
        </div>
      )}
      {drawingEnabled && (
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: 16,
            right: 16,
            padding: "10px 16px",
            borderRadius: 12,
            background: "rgba(15,81,50,0.92)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 500,
            boxShadow: "0 10px 30px rgba(15,23,42,0.18)",
            textAlign: "center",
            backdropFilter: "blur(4px)",
            lineHeight: 1.5,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{drawingStatusText()}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {vertexCount > 0 && (
              <button
                onClick={closeShape}
                disabled={vertexCount < 3}
                style={{
                  padding: "6px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.4)",
                  background: vertexCount >= 3 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.15)",
                  color: vertexCount >= 3 ? "#0f5132" : "rgba(255,255,255,0.45)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: vertexCount >= 3 ? "pointer" : "default",
                  backdropFilter: "blur(4px)",
                }}
              >
                Close shape
              </button>
            )}
            <button
              onClick={() => setDrawingEnabled(false)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.3)",
                background: "transparent",
                color: "rgba(255,255,255,0.75)",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
