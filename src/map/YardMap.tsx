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
  zoomControl: false,
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
  const [locating, setLocating] = React.useState(false);
  const [locateError, setLocateError] = React.useState<string | null>(null);
  const [showAttrib, setShowAttrib] = React.useState(false);

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

      // Re-frame the map onto the restored zones so the user lands looking at
      // their drawn area — not the full-Brisbane default the map boots into.
      // Without this, coming back from Step 3 makes the polygon look invisible
      // and the user thinks their work was wiped.
      const map = mapRef.current;
      const googleLib = googleRef.current;
      if (map && googleLib && zonesRef.current.length > 0) {
        const bounds = new googleLib.maps.LatLngBounds();
        zonesRef.current.forEach((zone) => {
          const path = zone.polygon.getPath();
          for (let i = 0; i < path.getLength(); i += 1) {
            bounds.extend(path.getAt(i));
          }
        });
        if (!bounds.isEmpty()) {
          // 60px padding leaves room for the search bar (top) and right-rail
          // control stack (right). Then guard against the auto-zoom going too
          // deep on a tiny single zone — cap at 20 so it doesn't snap to
          // street-level tile and lose orientation.
          map.fitBounds(bounds, 60);
          window.requestAnimationFrame(() => {
            const z = map.getZoom();
            if (typeof z === "number" && z > 20) map.setZoom(20);
          });
        }
      }
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
      // Defensive: force native zoom / map-type / streetview / fullscreen UI off, in case any
      // stale/HMR state from a previous build re-enabled them. We render our own zoom controls.
      map.setOptions({
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        rotateControl: false,
        scaleControl: false,
      });
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

      // Tell the parent we're fully ready to receive state. Critical for the
      // "re-enter Step 2 from Step 3" case: the parent's iframe.onLoad fires
      // BEFORE Google Maps finishes loading inside us, so zones it posts then
      // hit a half-initialised map. Once we send this READY signal, the parent
      // re-posts the current zones/scope and we're guaranteed to have map +
      // applyZones ready to render them.
      if (isInIframe()) {
        try {
          window.parent.postMessage({ type: "YARD_MAP_READY" }, "*");
        } catch {
          /* parent gone — nothing to do */
        }
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

  const handleLocateMe = React.useCallback(() => {
    if (!navigator.geolocation) {
      setLocateError("Location not supported by your browser");
      setTimeout(() => setLocateError(null), 3000);
      return;
    }
    setLocating(true);
    setLocateError(null);
    setShowAttrib(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        const inBounds =
          lat >= BRISBANE_BOUNDS.south && lat <= BRISBANE_BOUNDS.north &&
          lng >= BRISBANE_BOUNDS.west && lng <= BRISBANE_BOUNDS.east;
        if (!inBounds) {
          setLocateError("Outside service area — Brisbane & surrounds only");
          setTimeout(() => setLocateError(null), 3500);
          return;
        }
        const map = mapRef.current;
        if (!map) return;
        map.panTo({ lat, lng });
        map.setZoom(Math.max(map.getZoom() ?? 18, 18));
      },
      () => {
        setLocating(false);
        setLocateError("Location access denied");
        setTimeout(() => setLocateError(null), 3000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const clearAllZones = React.useCallback(() => {
    zonesRef.current.forEach((z) => {
      z.listeners.forEach((l) => l.remove());
      z.polygon.setMap(null);
    });
    zonesRef.current = [];
    setZoneCount(0);
    // Emit empty zones so the parent resets measurements and price
    emitAllZonesRef.current?.();
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

      // Multi-zone: set all zones at once.
      //
      // IMPORTANT: applyZonesRef is wired up BEFORE the async Google-Maps load
      // completes, so just checking `applyZonesRef.current` would let zones
      // through too early — applyZones would then run with mapRef.current still
      // null, createZoneFromCoords would silently produce orphan polygons (no
      // map attached) and the viewport would never re-fit. We must also wait
      // for mapRef and googleRef before applying, otherwise queue to pending so
      // initMap picks them up after the map is fully ready.
      if (data.type === "YARD_SET_ZONES") {
        const zones = Array.isArray(data.zones) ? data.zones : [];
        if (applyZonesRef.current && mapRef.current && googleRef.current) {
          applyZonesRef.current(zones);
        } else {
          pendingSetZonesRef.current = zones;
        }
        return;
      }

      // Backward compat: single polygon → treat as one zone. Same readiness
      // guard as YARD_SET_ZONES above.
      if (data.type === "YARD_SET_POLYGON") {
        const coords = Array.isArray(data.coords) ? normalizeCoords(data.coords as LatLng[]) : [];
        const zones = coords.length >= 3 ? [coords] : [];
        if (applyZonesRef.current && mapRef.current && googleRef.current) {
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
    return `${vertexCount} points placed — tap "Done" to finish`;
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: 520,
        position: "relative",
        overflow: "hidden",
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
          right: 76,
        }}
      >
        <input
          ref={searchInputRef}
          type="search"
          placeholder={
            loadError
              ? "Search unavailable"
              : searchEnabled
              ? "Search your address…"
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
            textOverflow: "ellipsis",
          }}
        />
      </div>
      {/* Zone count badge — below the search bar, left side */}
      {!drawingEnabled && zoneCount > 0 && (
        <div
          style={{
            position: "absolute",
            top: 68,
            left: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
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
        </div>
      )}

      {/* Keyframe for locate spinner + hide native Google attribution & default controls */}
      <style>{`
        @keyframes __ym_spin { to { transform: rotate(360deg); } }
        #__MAP_ROOT__ .gm-style-cc { display: none !important; }
        #__MAP_ROOT__ .gm-style > div > a { display: none !important; }
        /* Defensive: suppress Google's native zoom / fullscreen / map-type / streetview
           controls in case they slip through the options API. We render our own. */
        #__MAP_ROOT__ .gm-bundled-control,
        #__MAP_ROOT__ .gm-bundled-control-on-bottom,
        #__MAP_ROOT__ .gmnoprint.gm-bundled-control,
        #__MAP_ROOT__ .gm-svpc,
        #__MAP_ROOT__ .gm-fullscreen-control,
        #__MAP_ROOT__ button[aria-label="Keyboard shortcuts"],
        #__MAP_ROOT__ .gm-style div[title="Zoom in"],
        #__MAP_ROOT__ .gm-style div[title="Zoom out"],
        #__MAP_ROOT__ .gm-style button[title="Zoom in"],
        #__MAP_ROOT__ .gm-style button[title="Zoom out"] { display: none !important; }
      `}</style>

      {/* Right-rail control stack — Draw at top, then locate/info, then zoom */}
      {!loadError && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            right: 16,
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: 10,
            zIndex: 3,
          }}
        >
          {/* Draw button — featured, only when not already drawing */}
          {!drawingEnabled && (
            <button
              onClick={() => setDrawingEnabled(true)}
              title="Draw a zone on the map"
              aria-label="Start drawing a zone"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                width: 44,
                padding: "10px 0",
                borderRadius: 14,
                border: "none",
                background: "#0f5132",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.01em",
                cursor: "pointer",
                boxShadow: "0 6px 18px rgba(15,81,50,0.32)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>Draw</span>
            </button>
          )}

          {/* Locate me */}
          <button
            onClick={handleLocateMe}
            disabled={locating}
            title="Center on my location"
            aria-label="Center map on my location"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,0.08)",
              background: "rgba(255,255,255,0.98)",
              backdropFilter: "blur(8px)",
              boxShadow: "0 4px 14px rgba(15,23,42,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: locating ? "wait" : "pointer",
              padding: 0,
            }}
          >
            {locating ? (
              <svg
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="#0f5132" strokeWidth="2.5" strokeLinecap="round"
                style={{ animation: "__ym_spin 0.8s linear infinite" }}
              >
                <path d="M12 3a9 9 0 1 0 9 9" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f5132" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" fill="#0f5132" fillOpacity="0.25" />
                <circle cx="12" cy="12" r="8" />
                <line x1="12" y1="2" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="2" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="22" y2="12" />
              </svg>
            )}
          </button>

          {/* Info / attribution toggle */}
          <button
            onClick={() => setShowAttrib((v) => !v)}
            title={showAttrib ? "Hide map info" : "Map info"}
            aria-label="Toggle map information"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              border: showAttrib ? "1.5px solid #0f5132" : "1px solid rgba(15,23,42,0.08)",
              background: showAttrib ? "#0f5132" : "rgba(255,255,255,0.98)",
              backdropFilter: "blur(8px)",
              boxShadow: "0 4px 14px rgba(15,23,42,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: showAttrib ? "#fff" : "#475569",
              padding: 0,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </button>

          {/* Modern zoom control — joined pill, +/− stacked */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 44,
              borderRadius: 14,
              overflow: "hidden",
              background: "rgba(255,255,255,0.98)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(15,23,42,0.08)",
              boxShadow: "0 4px 14px rgba(15,23,42,0.12)",
            }}
          >
            <button
              onClick={() => {
                const m = mapRef.current;
                if (!m) return;
                const z = m.getZoom();
                if (typeof z === "number") m.setZoom(Math.min(21, z + 1));
              }}
              title="Zoom in"
              aria-label="Zoom in"
              style={{
                width: 44,
                height: 40,
                border: "none",
                background: "transparent",
                color: "#0f172a",
                fontSize: 20,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <div style={{ height: 1, background: "rgba(15,23,42,0.08)" }} />
            <button
              onClick={() => {
                const m = mapRef.current;
                if (!m) return;
                const z = m.getZoom();
                if (typeof z === "number") m.setZoom(Math.max(15, z - 1));
              }}
              title="Zoom out"
              aria-label="Zoom out"
              style={{
                width: 44,
                height: 40,
                border: "none",
                background: "transparent",
                color: "#0f172a",
                fontSize: 20,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Clear-zones bin — sits below the zoom control. Always visible (when not
              drawing), but greyed out & disabled when there are no zones to clear. */}
          {!drawingEnabled && (
            <button
              onClick={clearAllZones}
              disabled={zoneCount === 0}
              title={zoneCount === 0 ? "No zones to clear" : "Clear all zones"}
              aria-label="Clear all drawn zones"
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                border: zoneCount === 0
                  ? "1px solid rgba(15,23,42,0.08)"
                  : "1px solid rgba(244,63,94,0.3)",
                background: "rgba(255,255,255,0.98)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 14px rgba(15,23,42,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: zoneCount === 0 ? "not-allowed" : "pointer",
                color: zoneCount === 0 ? "rgba(15,23,42,0.35)" : "#e11d48",
                opacity: zoneCount === 0 ? 0.7 : 1,
                padding: 0,
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Attribution popover */}
      {showAttrib && !drawingEnabled && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 60,
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(8px)",
            borderRadius: 14,
            padding: "12px 16px",
            boxShadow: "0 8px 28px rgba(15,23,42,0.18)",
            border: "1px solid rgba(15,23,42,0.1)",
            fontSize: 11,
            color: "#475569",
            maxWidth: 230,
            lineHeight: 1.6,
            zIndex: 3,
          }}
        >
          <p style={{ fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>Map data</p>
          <p style={{ margin: "0 0 2px" }}>© 2026 Google</p>
          <p style={{ margin: "0 0 8px" }}>Imagery: Airbus · CNES / Airbus · Maxar Technologies · Vexcel Imaging</p>
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 10, borderTop: "1px solid #f1f5f9", paddingTop: 6 }}>
            Satellite view in hybrid mode. Draw zones to calculate area and price.
          </p>
        </div>
      )}

      {/* Locate error toast */}
      {locateError && (
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(239,68,68,0.95)",
            color: "#fff",
            borderRadius: 9999,
            padding: "6px 16px",
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 14px rgba(239,68,68,0.3)",
            zIndex: 4,
            pointerEvents: "none",
          }}
        >
          {locateError}
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
            backdropFilter: "blur(4px)",
            lineHeight: 1.5,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>{drawingStatusText()}</span>
          {/* Centred button group: Done + clear icon close together */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => {
                if (vertexCount >= 3) {
                  closeShape();
                } else {
                  setDrawingEnabled(false);
                }
              }}
              style={{
                padding: "6px 20px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.4)",
                background: vertexCount >= 3 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.15)",
                color: vertexCount >= 3 ? "#0f5132" : "rgba(255,255,255,0.65)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Done
            </button>
            <button
              onClick={clearAllZones}
              title="Clear all zones"
              disabled={zoneCount === 0}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.25)",
                background: "rgba(255,255,255,0.08)",
                color: zoneCount === 0 ? "rgba(255,255,255,0.25)" : "rgba(255,200,200,0.9)",
                cursor: zoneCount === 0 ? "default" : "pointer",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
