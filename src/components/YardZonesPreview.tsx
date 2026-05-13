"use client";

import React from "react";

type LatLng = { lat: number; lng: number };

type YardJob = {
  job_id: string;
  address?: string;
  polygon_geojson?: LatLng[][];
};

type Props = {
  jobs: YardJob[] | null | undefined;
  /** CSS class for the outer wrapper. */
  className?: string;
  /** Width of the static map (px). Height is derived from a 2:1 aspect ratio. */
  width?: number;
  height?: number;
};

const API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  "";

// Match the live map's polygon styling so the preview reads as "the thing you drew".
const STROKE_COLOR_STATIC = "0x0f5132ff";
const FILL_COLOR_STATIC = "0x16a34a55";
const STROKE_COLOR_SVG = "#0f5132";
const FILL_COLOR_SVG = "#16a34a";
const FILL_OPACITY_SVG = 0.33;
const STROKE_WEIGHT = 3;

const fmtCoord = (n: number) => n.toFixed(6);

/** Build a single `path` query-string value for Static Maps. */
function buildPath(zone: LatLng[]): string | null {
  if (!zone || zone.length < 3) return null;
  const closed = [...zone, zone[0]];
  const pts = closed
    .map((p) => `${fmtCoord(p.lat)},${fmtCoord(p.lng)}`)
    .join("|");
  return `color:${STROKE_COLOR_STATIC}|weight:${STROKE_WEIGHT}|fillcolor:${FILL_COLOR_STATIC}|${pts}`;
}

/** Collect all valid polygons across every job. */
function collectZones(jobs: YardJob[] | null | undefined): LatLng[][] {
  if (!jobs?.length) return [];
  const zones: LatLng[][] = [];
  jobs.forEach((job) => {
    (job.polygon_geojson ?? []).forEach((zone) => {
      if (zone && zone.length >= 3) zones.push(zone);
    });
  });
  return zones;
}

/** Bounding box of all vertices. */
function bbox(zones: LatLng[][]) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  zones.forEach((z) =>
    z.forEach((p) => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    })
  );
  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Compute the tightest Google-Maps zoom level (0–21) that still fits the bbox
 * inside a viewport of the given pixel dimensions, with a bit of padding.
 *
 * This is the canonical Mercator-projection fit-bounds calculation — same shape
 * as the one in Google's own examples but adapted for the Static Maps API,
 * which expects an integer zoom.
 */
function fitZoom(
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  width: number,
  height: number,
  paddingFraction = 0.18
): number {
  const WORLD_PX = 256;
  const ZOOM_MAX = 20; // Static Maps caps at 21; leave 1 level of headroom.

  // Convert latitude to Mercator y-fraction in [0, 1].
  const latToY = (lat: number) => {
    const sin = Math.sin((lat * Math.PI) / 180);
    const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
    return Math.max(Math.min(radX2, Math.PI), -Math.PI) / (2 * Math.PI) + 0.5;
  };

  const yNorth = latToY(bounds.maxLat);
  const ySouth = latToY(bounds.minLat);
  const latFraction = Math.abs(ySouth - yNorth); // already a 0–1 fraction
  const lngDiff = bounds.maxLng - bounds.minLng;
  const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

  // Apply padding by treating the viewport as smaller than it really is, so
  // the chosen zoom leaves whitespace around the shape.
  const effectiveW = width * (1 - paddingFraction);
  const effectiveH = height * (1 - paddingFraction);

  const zoomFromFraction = (mapPx: number, fraction: number) =>
    fraction <= 0 ? ZOOM_MAX : Math.log2(mapPx / WORLD_PX / fraction);

  const latZoom = zoomFromFraction(effectiveH, latFraction);
  const lngZoom = zoomFromFraction(effectiveW, lngFraction);

  // Use floor so the entire shape is guaranteed to fit (a fractional zoom
  // gets rounded down to the next-coarser integer).
  const z = Math.floor(Math.min(latZoom, lngZoom, ZOOM_MAX));
  return Math.max(0, Math.min(ZOOM_MAX, z));
}

export default function YardZonesPreview({
  jobs,
  className,
  width = 600,
  height = 300,
}: Props) {
  const zones = React.useMemo(() => collectZones(jobs), [jobs]);
  const [staticFailed, setStaticFailed] = React.useState(false);

  if (!zones.length) return null;

  const totalZones = zones.length;
  const siteCount = (jobs ?? []).filter((j) =>
    (j.polygon_geojson ?? []).some((z) => z.length >= 3)
  ).length;

  // ---- Shared bbox (used for both the static-map zoom AND the SVG fallback) ----
  const bounds = bbox(zones);
  const { minLat, maxLat, minLng, maxLng } = bounds;
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  // ---- Build the Static Maps URL (primary rendering) ----
  let staticSrc: string | null = null;
  if (API_KEY) {
    // Pass scale=2 — that doubles the effective pixel density but does NOT
    // affect zoom-fit math (the zoom level is still chosen for the base
    // width/height in CSS pixels).
    const zoom = fitZoom(bounds, width, height);

    const params = new URLSearchParams();
    params.set("size", `${width}x${height}`);
    params.set("maptype", "satellite");
    params.set("scale", "2");
    params.set("center", `${centerLat.toFixed(6)},${centerLng.toFixed(6)}`);
    params.set("zoom", String(zoom));
    params.set("key", API_KEY);
    zones.forEach((z) => {
      const p = buildPath(z);
      if (p) params.append("path", p);
    });
    staticSrc = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
  }

  // ---- SVG fallback (used when Static Maps fails / isn't enabled) ----
  // Pad the bounding box by ~8% so the polygons don't kiss the edges.
  const padLat = Math.max((maxLat - minLat) * 0.08, 1e-6);
  const padLng = Math.max((maxLng - minLng) * 0.08, 1e-6);
  const bMinLat = minLat - padLat;
  const bMaxLat = maxLat + padLat;
  const bMinLng = minLng - padLng;
  const bMaxLng = maxLng + padLng;
  // Approximate a square-ish projection: at our latitudes, 1° lng ≈ cos(lat) × 111km
  // and 1° lat ≈ 111km. Using a simple linear remap keeps shapes recognisable
  // because the bbox is tiny (a residential lot).
  const remap = (p: LatLng) => {
    const x = ((p.lng - bMinLng) / (bMaxLng - bMinLng)) * width;
    // Flip Y because SVG y grows downward but latitude grows northward.
    const y = (1 - (p.lat - bMinLat) / (bMaxLat - bMinLat)) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  };

  const renderStatic = staticSrc && !staticFailed;

  return (
    <figure className={className} style={{ margin: 0 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: `${width} / ${height}`,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid rgba(15,23,42,0.08)",
          background: renderStatic ? "#e2e8f0" : "#f1f5f9",
        }}
      >
        {renderStatic ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={staticSrc!}
            alt={`Aerial preview of ${totalZones} drawn zone${totalZones === 1 ? "" : "s"}`}
            loading="lazy"
            onError={() => setStaticFailed(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label={`Outline of ${totalZones} drawn zone${totalZones === 1 ? "" : "s"}`}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              background:
                "repeating-linear-gradient(45deg, #f8fafc 0, #f8fafc 10px, #eef2f7 10px, #eef2f7 20px)",
            }}
          >
            {zones.map((zone, i) => (
              <polygon
                key={i}
                points={zone.map(remap).join(" ")}
                fill={FILL_COLOR_SVG}
                fillOpacity={FILL_OPACITY_SVG}
                stroke={STROKE_COLOR_SVG}
                strokeWidth={STROKE_WEIGHT}
                strokeLinejoin="round"
              />
            ))}
          </svg>
        )}
      </div>
      <figcaption
        style={{
          marginTop: 6,
          fontSize: 11,
          color: "#475569",
        }}
      >
        Your drawn {totalZones === 1 ? "zone" : "zones"} ({siteCount}{" "}
        {siteCount === 1 ? "site" : "sites"})
        {!renderStatic && (
          <span style={{ color: "#94a3b8" }}> — shape preview</span>
        )}
      </figcaption>
    </figure>
  );
}
