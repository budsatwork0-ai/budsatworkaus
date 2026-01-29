import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

type LoadGoogleMapsOptions = {
  apiKey: string;
  libraries?: string[];
};

const loaderCache = new Map<string, Promise<typeof google>>();

const normalizeLibraries = (libraries: string[] = []) =>
  Array.from(new Set(["maps", ...libraries.filter(Boolean)])).sort();

const formatLoadError = (reason: unknown): Error => {
  if (reason instanceof Error) return reason;
  if (typeof Event !== "undefined" && reason instanceof Event) {
    const target = reason.target as HTMLScriptElement | null;
    const src = target?.src ? ` (${target.src})` : "";
    return new Error(`Google Maps script failed to load${src}.`);
  }
  if (reason && typeof reason === "object" && "message" in reason) {
    return new Error(String((reason as any).message ?? "Google Maps failed to load."));
  }
  return new Error(String(reason ?? "Google Maps failed to load."));
};

export function loadGoogleMapsOnce({ apiKey, libraries = [] }: LoadGoogleMapsOptions): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps must load in the browser."));
  }

  if (!apiKey) {
    return Promise.reject(new Error("Missing Google Maps API key."));
  }

  const libs = normalizeLibraries(libraries);
  const cacheKey = `${apiKey}::${libs.join(",")}`;

  const cached = loaderCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  setOptions({
    key: apiKey,
    v: "weekly",
    libraries: libs,
  });

  const promise = Promise.all(libs.map((lib) => importLibrary(lib))).then(() => {
    const g = window.google as typeof google;
    if (!g?.maps?.Map) {
      throw new Error("Google Maps failed to initialize.");
    }
    return g;
  });
  const wrappedPromise = promise.catch((reason) => {
    throw formatLoadError(reason);
  });

  loaderCache.set(cacheKey, wrappedPromise);
  return wrappedPromise;
}
