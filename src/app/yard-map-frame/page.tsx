"use client";

import React from "react";
import YardMap from "@/map/YardMap";
import type { LatLng } from "@/map/types";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const tryParseJson = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as T;
  } catch {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
};

const normalizeLatLng = (value: any): LatLng | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
};

const normalizePolygon = (value: unknown): LatLng[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const coords: LatLng[] = [];
  value.forEach((candidate) => {
    const normalized = normalizeLatLng(candidate);
    if (normalized) {
      coords.push(normalized);
    }
  });
  return coords.length ? coords : undefined;
};

const normalizeCenter = (value: unknown): LatLng | undefined => normalizeLatLng(value);

export default function YardMapFramePage() {
  const searchParams = React.useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search);
  }, []);
  const polyParam = searchParams?.get("poly") ?? null;
  const centerParam = searchParams?.get("center") ?? null;

  const initialPolygon = React.useMemo(() => {
    return normalizePolygon(tryParseJson<unknown>(polyParam));
  }, [polyParam]);

  const initialCenter = React.useMemo(() => {
    return normalizeCenter(tryParseJson<unknown>(centerParam));
  }, [centerParam]);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development") return undefined;
    if (typeof window === "undefined") return undefined;
    const root = document.getElementById("__MAP_ROOT__");
    if (!root) return undefined;
    const observer = new ResizeObserver(() => {
      console.log("MAP ROOT RESIZE");
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style jsx global>{`
        html,
        body,
        #__next {
          height: 100vh;
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: transparent;
        }
        body > main {
          height: 100vh;
          overflow: hidden;
        }
        body > main + footer {
          display: none;
        }
      `}</style>
      <YardMap apiKey={API_KEY} initialCenter={initialCenter} initialPolygon={initialPolygon} />
    </>
  );
}
