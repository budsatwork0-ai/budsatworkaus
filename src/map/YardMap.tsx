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

const POLYGON_OPTIONS: google.maps.PolygonOptions = {
  editable: true,
  draggable: false,
  geodesic: true,
  strokeColor: "#0f5132",
  strokeOpacity: 1,
  strokeWeight: 2,
  fillColor: "#16a34a",
  fillOpacity: 0.22,
  clickable: false,
  zIndex: 3,
};

const FRAME_EVENTS: Array<"set_at" | "insert_at" | "remove_at"> = [
  "set_at",
  "insert_at",
  "remove_at",
];

const CLOSE_DISTANCE_M = 25;

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

const haversineDistance = (a: google.maps.LatLng, b: google.maps.LatLng): number => {
  const R = 6378137;
  const dLat = ((b.lat() - a.lat()) * Math.PI) / 180;
  const dLng = ((b.lng() - a.lng()) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat() * Math.PI) / 180) * Math.cos((b.lat() * Math.PI) / 180) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export type YardMapProps = {
  apiKey: string;
  mapId?: string;
  initialCenter?: LatLng;
  initialPolygon?: LatLng[];
  onPolygonChange?: (coords: LatLng[]) => void;
};

export default function YardMap({
  apiKey,
  mapId,
  initialCenter,
  initialPolygon,
  onPolygonChange,
}: YardMapProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const mapRef = React.useRef<google.maps.Map | null>(null);
  const polygonRef = React.useRef<google.maps.Polygon | null>(null);
  const listenersRef = React.useRef<google.maps.MapsEventListener[]>([]);
  const didInitRef = React.useRef(false);
  const rafRef = React.useRef<number | null>(null);
  const pendingSetPolygonRef = React.useRef<LatLng[] | null>(null);
  const suppressEmitRef = React.useRef(false);
  const autocompleteRef = React.useRef<google.maps.places.Autocomplete | null>(null);
  const googleRef = React.useRef<typeof google | null>(null);
  const attachEventsRef = React.useRef<(() => void) | null>(null);

  // Custom tap-to-draw refs (replaces DrawingManager)
  const drawingVerticesRef = React.useRef<google.maps.LatLng[]>([]);
  const vertexMarkersRef = React.useRef<google.maps.Marker[]>([]);
  const previewPolylineRef = React.useRef<google.maps.Polyline | null>(null);
  const mapClickListenerRef = React.useRef<google.maps.MapsEventListener | null>(null);

  const [searchEnabled, setSearchEnabled] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [drawingEnabled, setDrawingEnabled] = React.useState(false);
  const [vertexCount, setVertexCount] = React.useState(0);

  const initialCenterRef = React.useRef(initialCenter);
  const initialPolygonRef = React.useRef(initialPolygon);

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

    const handlePolygonChange = () => {
      if (suppressEmitRef.current) return;
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const path = polygonRef.current?.getPath();
        if (!path) return;
        const coords = coordsFromPath(path);
        onPolygonChange?.(coords);
        if (isInIframe()) {
          window.parent.postMessage({ type: "YARD_POLYGON_CHANGE", coords }, "*");
        }
      });
    };

    // Track path-specific listeners separately so we can re-attach on path change
    let pathListeners: google.maps.MapsEventListener[] = [];

    const attachEvents = () => {
      // Remove old path listeners
      pathListeners.forEach((listener) => listener.remove());
      pathListeners = [];

      const path = polygonRef.current?.getPath();
      if (!path) return;
      FRAME_EVENTS.forEach((eventName) => {
        const listener = path.addListener(eventName, handlePolygonChange);
        pathListeners.push(listener);
        listenersRef.current.push(listener);
      });
    };

    // Store attachEvents in ref so it can be called from message handler
    attachEventsRef.current = attachEvents;

    const applyPolygonPath = (coords?: LatLng[]) => {
      const normalized = normalizeCoords(coords);
      const polygon = polygonRef.current;
      if (!polygon) return;
      suppressEmitRef.current = true;
      polygon.setPath(normalized);
      // Re-attach listeners to the new path
      attachEvents();
      window.requestAnimationFrame(() => {
        suppressEmitRef.current = false;
      });
    };

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

      const polygon = new googleLib.maps.Polygon({
        ...POLYGON_OPTIONS,
        map,
      });
      polygonRef.current = polygon;
      polygon.setEditable(true);

      // Create a preview polyline for showing the in-progress drawing
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

      const initialCoords = initialPolygonRef.current;
      if (initialCoords && initialCoords.length) {
        polygon.setPath(normalizeCoords(initialCoords));
      }

      attachEvents();

      if (pendingSetPolygonRef.current) {
        applyPolygonPath(pendingSetPolygonRef.current);
        pendingSetPolygonRef.current = null;
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
      polygonRef.current?.setMap(null);
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

    // Apply to the main polygon
    const polygon = polygonRef.current;
    if (polygon) {
      suppressEmitRef.current = true;
      polygon.setPath(coords.map((c) => new google.maps.LatLng(c.lat, c.lng)));
      polygon.setEditable(true);
      attachEventsRef.current?.();
      window.requestAnimationFrame(() => {
        suppressEmitRef.current = false;
        // Emit the change
        const path = polygon.getPath();
        if (!path) return;
        const finalCoords = coordsFromPath(path);
        onPolygonChange?.(finalCoords);
        if (isInIframe()) {
          window.parent.postMessage({ type: "YARD_POLYGON_CHANGE", coords: finalCoords }, "*");
        }
      });
    }

    clearDrawingState();
    setDrawingEnabled(false);
  }, [clearDrawingState, onPolygonChange]);

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
        // Hide the existing polygon while drawing a new one
        polygonRef.current?.setEditable(false);
        polygonRef.current?.setPath([]);

        clearDrawingState();

        const listener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;

          const vertices = drawingVerticesRef.current;

          // Check if tapping near the first point to close (need 3+ vertices)
          if (vertices.length >= 3) {
            const dist = haversineDistance(event.latLng, vertices[0]);
            if (dist < CLOSE_DISTANCE_M) {
              closeShape();
              return;
            }
          }

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
            clickable: isFirst && vertices.length >= 3,
            zIndex: 5,
          });

          if (isFirst) {
            // Allow clicking the first marker to close the shape
            marker.addListener("click", () => {
              if (drawingVerticesRef.current.length >= 3) {
                closeShape();
              }
            });
          }

          vertexMarkersRef.current.push(marker);

          // Update the preview polyline
          previewPolylineRef.current?.setPath(vertices);
        });

        mapClickListenerRef.current = listener;
      } else {
        clearDrawingState();
        // Re-enable polygon editing
        const polygon = polygonRef.current;
        if (polygon && polygon.getPath().getLength() > 0) {
          polygon.setEditable(true);
        }
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
      if (data.type === "YARD_SET_POLYGON") {
        const coords = Array.isArray(data.coords) ? data.coords : [];
        const normalized = normalizeCoords(coords as LatLng[]);
        if (polygonRef.current) {
          suppressEmitRef.current = true;
          polygonRef.current.setPath(normalized);
          // Re-attach event listeners to the new path
          attachEventsRef.current?.();
          window.requestAnimationFrame(() => {
            suppressEmitRef.current = false;
          });
        } else {
          pendingSetPolygonRef.current = normalized;
        }
        return;
      }
      if (data.type === "YARD_TOGGLE_DRAWING") {
        setDrawingEnabled(Boolean(data.enabled));
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
          <p
            style={{
              fontSize: 18,
              fontWeight: 600,
              margin: 0,
              color: "#0f172a",
            }}
          >
            Map unavailable
          </p>
          <p
            style={{
              fontSize: 14,
              margin: 0,
              color: "#475569",
            }}
          >
            {loadError}
          </p>
          <p
            style={{
              fontSize: 12,
              margin: 0,
              color: "#475569",
            }}
          >
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
      {!drawingEnabled && (
        <div
          style={{
            position: "absolute",
            top: 68,
            left: 16,
            right: 16,
            padding: "8px 16px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.85)",
            color: "#0f5132",
            fontSize: 12,
            boxShadow: "0 10px 30px rgba(15,23,42,0.12)",
            textAlign: "center",
          }}
        >
          Search your address above, then tap &ldquo;Draw or edit&rdquo; to outline your area.
        </div>
      )}
      {drawingEnabled && (
        <div
          style={{
            position: "absolute",
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
          <span>
            Tap to place points &mdash; tap the <strong>first point</strong> again to close the
            shape
          </span>
          {vertexCount >= 3 && (
            <button
              onClick={closeShape}
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.4)",
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                backdropFilter: "blur(4px)",
              }}
            >
              Close shape ({vertexCount} points)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
